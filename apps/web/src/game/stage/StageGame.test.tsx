/**
 * @jest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fc from 'fast-check';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { Euler, Quaternion, Texture, type BufferGeometry, type Material } from 'three';
import { createGameAudio, type GameAudio } from '../audio';
import {
  createFakeAudioScope,
  createManualTimer,
  FakeAudioContext,
  isRoutedTo,
  type ResumeBehaviour,
} from '../audio/testing/fake-audio-context';
import { timeToBeat } from '../core/clock';
import { BEATS_PER_BAR } from '../core/config';
import { installPointerEvent } from '../ui/lanes/testing/pointer-event';
import { navigations } from '../ui/screens/testing/link';
import {
  createFakeAssetServer,
  createManualStream,
  FAKE_FILE_SIZES,
  validManifestJson,
  type FakeAssetServer,
} from './assets/testing/fake-asset-server';
import { WALK_STRIDE } from './character/config';
import {
  CAMERA_FOLLOW_TAU_S,
  createStreetStage,
  followCamera,
  MAX_DPR,
  readFraming,
  readStreetLayout,
  REFERENCE_FRAMING,
  stagePixelRatio,
  STREET_CAMERA_CLOSER,
  streetCameraDistance,
  type StreetStage,
  type StreetStageOptions,
} from './scenes/StreetScene';
import StageGame from './StageGame';
import { cameraX, createCameraBounds } from './street/camera';
import { DOOR_PROMPT_RADIUS, DUCK_BOB_DEPTH, STREET_WALK_SPEED } from './street/config';
import { quackTimesBetween } from './street/ducks';
import type { WalkDirection } from './street/movement';
import { FakeRenderer, installWebGL2, type InstalledWebGL2 } from './testing/fake-webgl';
import {
  buildFakeStreet,
  buildFakeStreetModels,
  FAKE_FRAMING,
  FAKE_LAMP_INTENSITY,
  FAKE_STREET,
  type FakeStreetModels,
} from './testing/fake-street';
import { createFakeStreetScene, type FakeStreetScene } from './testing/fake-street-scene';
import { setFakeLocale } from './testing/intl';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('../ui/screens/testing/link')>('../ui/screens/testing/link'),
);
// GLTFLoader ships as an ES module Jest does not load; no test here parses a file.
jest.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }));

const NOTE_MISSING = 'The stage art is not available here, so this is the plain grey-box match.';
const NOTE_NO_WEBGL = 'This browser cannot draw the 3D stage, so this is the plain grey-box match.';
const CHECKING = 'Checking the stage files...';
const DOOR_NEAR = 'You are at the club door.';
const ENTER_CLUB = 'Enter the club';

// ---------------------------------------------------------------------------------------------
// Environment: jsdom has no streams, no fetch, no WebGL and no Web Audio
// ---------------------------------------------------------------------------------------------

let webgl: InstalledWebGL2 | null = null;
let audioContexts: FakeAudioContext[] = [];
let infoSpy: jest.SpyInstance;
let restorePointerEvent: () => void = () => undefined;

function fakeWebGL2(supported: boolean): InstalledWebGL2 {
  webgl = installWebGL2(supported);
  return webgl;
}

function serve(server: FakeAssetServer): FakeAssetServer {
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: server.fetch });
  return server;
}

function installAudio(resume: ResumeBehaviour = 'run'): void {
  const fake = createFakeAudioScope({
    setup: (context) => {
      context.resumeBehaviour = resume;
    },
  });
  audioContexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
}

function audioContext(index = 0): FakeAudioContext {
  const found = audioContexts[index];
  if (found === undefined) throw new Error(`no AudioContext number ${index}`);
  return found;
}

/** Lets downloads, the audio unlock and React settle, then waits one real macrotask. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
  const timers = jest.requireActual<typeof import('timers')>('timers');
  await new Promise<void>((resolve) => timers.setImmediate(resolve));
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** A `matchMedia` where only the queries `matches` picks are true. */
function stubMedia(matches: (query: string) => boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

beforeAll(() => {
  if (!('ReadableStream' in globalThis)) {
    Object.defineProperty(globalThis, 'ReadableStream', {
      configurable: true,
      writable: true,
      value: NodeReadableStream,
    });
  }
});

beforeEach(() => {
  infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  webgl?.restore();
  webgl = null;
  infoSpy.mockRestore();
  restorePointerEvent();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'fetch');
  Reflect.deleteProperty(window, 'AudioContext');
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(document, 'visibilityState');
  audioContexts = [];
});

// ---------------------------------------------------------------------------------------------
// StageGame with a fake 3D module
// ---------------------------------------------------------------------------------------------

interface Opened {
  readonly scene: FakeStreetScene;
  readonly server: FakeAssetServer;
  readonly unmount: () => void;
}

/** Renders the stage with WebGL2 and every asset, and lets the fake scene report it is ready. */
async function openStreet(): Promise<Opened> {
  fakeWebGL2(true);
  const server = serve(createFakeAssetServer());
  const scene = createFakeStreetScene();
  const view = render(<StageGame loadScene={scene.load} />);
  await settle();
  act(() => scene.props().onReady());
  return { scene, server, unmount: view.unmount };
}

/** Opens the street and presses Play. */
async function playStreet(): Promise<Opened> {
  installAudio();
  const opened = await openStreet();
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await settle();
  return opened;
}

function direction(scene: FakeStreetScene): WalkDirection {
  return scene.props().getDirection();
}

function expectGreyBox(note: string): void {
  expect(screen.getByTestId('stage-note')).toHaveTextContent(note);
  expect(screen.getByTestId('stage-note')).toHaveAttribute('role', 'status');
  // The duel's own Start screen: the grey-box match runs as in game-duel.
  expect(document.querySelector('[data-duel-game]')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Midnight Session' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  expect(screen.queryByTestId('street-scene')).not.toBeInTheDocument();
}

describe('StageGame: WebGL2, assets and the grey-box fallback', () => {
  it('AC-STAGE-002.1: without a webgl2 context runs the grey-box duel with its note, downloads nothing and never loads the 3D module', async () => {
    const probe = fakeWebGL2(false);
    const server = serve(createFakeAssetServer());
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();

    expect(probe.requests).toContain('webgl2');
    expectGreyBox(NOTE_NO_WEBGL);
    expect(scene.loads).toBe(0);
    expect(server.requests).toEqual([]);
  });

  it('AC-STAGE-001.2: with no manifest runs the grey-box duel with the missing-assets note', async () => {
    fakeWebGL2(true);
    serve(
      createFakeAssetServer({
        routes: { '/game-assets/manifest.json': { kind: 'status', status: 404 } },
      }),
    );
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();

    expectGreyBox(NOTE_MISSING);
    expect(scene.loads).toBe(0);
  });

  it('AC-STAGE-001.2: when one file of the manifest fails runs the grey-box duel with the missing-assets note', async () => {
    fakeWebGL2(true);
    serve(
      createFakeAssetServer({
        routes: { '/game-assets/props/duck.glb': { kind: 'status', status: 500 } },
      }),
    );
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();

    expectGreyBox(NOTE_MISSING);
    expect(scene.loads).toBe(0);
  });

  it('AC-STAGE-001.2: when a downloaded file does not parse, leaves the street for the grey-box duel with the missing-assets note', async () => {
    const { scene } = await openStreet();
    act(() => scene.props().onFallback('missing'));

    expectGreyBox(NOTE_MISSING);
    expect(scene.mounted).toBe(false);
  });

  it('a manifest with the wrong version falls back like a missing one', async () => {
    fakeWebGL2(true);
    serve(createFakeAssetServer({ manifest: { ...validManifestJson(), version: 2 } }));
    render(<StageGame loadScene={createFakeStreetScene().load} />);
    await settle();

    expectGreyBox(NOTE_MISSING);
  });

  it('AC-STAGE-001.1: with a valid manifest and every file, opens the 3D street on the downloaded files', async () => {
    fakeWebGL2(true);
    const server = serve(createFakeAssetServer());
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();

    expect(scene.loads).toBe(1);
    const props = scene.props();
    for (const id of Object.keys(FAKE_FILE_SIZES) as (keyof typeof FAKE_FILE_SIZES)[]) {
      expect(props.files[id].byteLength).toBe(FAKE_FILE_SIZES[id]);
    }
    expect(server.requests).toHaveLength(7);
    expect(screen.getByRole('img', { name: 'The street scene' })).toBeInTheDocument();
    expect(document.querySelector('[data-duel-game]')).toBeNull();
    expect(screen.queryByTestId('stage-note')).not.toBeInTheDocument();
    // The loading panel stays until the scene has parsed and drawn the street; no "done" screen.
    expect(screen.getByRole('heading', { name: 'Loading the street and the club' })).toBeInTheDocument();

    act(() => props.onReady());
    expect(screen.queryByRole('heading', { name: 'Loading the street and the club' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(
      screen.getByText(
        'Walk down the street to the club door, then trade fours with a shadow on stage.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to portfolio/ })).toBeInTheDocument();
  });

  it('AC-STAGE-001.2: a 3D module that fails to load falls back to the grey-box duel with the missing-assets note', async () => {
    fakeWebGL2(true);
    serve(createFakeAssetServer());
    render(<StageGame loadScene={() => Promise.reject(new Error('chunk failed'))} />);
    await settle();

    expectGreyBox(NOTE_MISSING);
  });
});

describe('StageGame: the loading panel', () => {
  /** A manifest that declares 3 MB for the street and 0 for the rest, with the street streamed by hand. */
  function streetOnly(streetBytes: number) {
    const manifest = validManifestJson();
    const zero = { bytes: 0 };
    const stream = createManualStream();
    const empty = { kind: 'file', chunks: [] } as const;
    serve(
      createFakeAssetServer({
        manifest: {
          ...manifest,
          characters: {
            player: {
              vrm: 'characters/player.vrm',
              shadowPalette: 'characters/player_shadow.png',
              ...zero,
            },
          },
          stages: {
            hoLangStreet: { glb: 'stages/ho-lang-street.glb', bytes: streetBytes },
            hoLangClub: { glb: 'stages/ho-lang-club.glb', ...zero },
          },
          props: { duck: { glb: 'props/duck.glb', ...zero } },
          sprites: { drummer: { png: 'sprites/drummer.png', ...zero } },
        },
        routes: {
          '/game-assets/characters/player.vrm': empty,
          '/game-assets/characters/player_shadow.png': empty,
          '/game-assets/stages/ho-lang-street.glb': { kind: 'stream', stream: stream.stream },
          '/game-assets/stages/ho-lang-club.glb': empty,
          '/game-assets/props/duck.glb': empty,
          '/game-assets/sprites/drummer.png': empty,
        },
      }),
    );
    return stream;
  }

  function progressbar(): HTMLElement {
    return screen.getByRole('progressbar', { name: 'Loading progress' });
  }

  it('AC-STAGE-001.4: while the manifest is read shows only the checking line, with no bar', () => {
    fakeWebGL2(true);
    streetOnly(3_000_000);
    render(<StageGame loadScene={createFakeStreetScene().load} />);

    expect(screen.getByText(CHECKING)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loading the street and the club' }).closest('section'))
      .toHaveAttribute('aria-busy', 'true');
  });

  it('AC-STAGE-001.4: while the files download, the bar and the MB line follow the bytes really received', async () => {
    fakeWebGL2(true);
    const stream = streetOnly(3_000_000);
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();

    expect(progressbar()).toHaveAttribute('aria-valuenow', '0');
    expect(progressbar()).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar()).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('0.0 MB of 3.0 MB')).toBeInTheDocument();
    expect(screen.queryByText(CHECKING)).not.toBeInTheDocument();

    act(() => stream.push(1_200_000));
    await settle();
    expect(progressbar()).toHaveAttribute('aria-valuenow', '40');
    expect(progressbar().firstElementChild).toHaveStyle({ width: '40%' });
    expect(screen.getByText('1.2 MB of 3.0 MB')).toBeInTheDocument();

    act(() => stream.push(1_000_000));
    await settle();
    // 2.2 of 3 MB is 73.3%: the label rounds, the bar does not.
    expect(progressbar()).toHaveAttribute('aria-valuenow', '73');
    expect(screen.getByText('2.2 MB of 3.0 MB')).toBeInTheDocument();
    expect(scene.loads).toBe(0);

    act(() => {
      stream.push(800_000);
      stream.close();
    });
    await settle();
    expect(scene.loads).toBe(1);
    expect(progressbar()).toHaveAttribute('aria-valuenow', '100');
  });

  it('AC-STAGE-001.4: formats the MB line in the language in use', async () => {
    setFakeLocale('vi');
    fakeWebGL2(true);
    const stream = streetOnly(3_000_000);
    render(<StageGame loadScene={createFakeStreetScene().load} />);
    await settle();
    act(() => stream.push(1_200_000));
    await settle();

    expect(screen.getByRole('progressbar', { name: 'Tiến độ tải' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(screen.getByText('1,2 MB trên 3,0 MB')).toBeInTheDocument();
  });

  it('AC-STAGE-001.4: a manifest that declares 0 bytes never draws a bar, only the checking line', async () => {
    fakeWebGL2(true);
    const stream = streetOnly(0);
    render(<StageGame loadScene={createFakeStreetScene().load} />);
    await settle();
    act(() => stream.push(5000));
    await settle();

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(CHECKING)).toBeInTheDocument();
  });

  it('leaving the page while the files download cancels the downloads', async () => {
    fakeWebGL2(true);
    const stream = streetOnly(3_000_000);
    const scene = createFakeStreetScene();
    const view = render(<StageGame loadScene={scene.load} />);
    await settle();

    view.unmount();
    await settle();
    expect(stream.cancelled()).toBe(true);
    expect(scene.loads).toBe(0);
  });
});

describe('StageGame: the Play gate on the street', () => {
  it('Play unlocks the audio inside the press and starts the street with it', async () => {
    installAudio();
    const { scene } = await openStreet();
    expect(scene.props().audio).toBeNull();
    // No walking before Play: the gate is up.
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    expect(direction(scene)).toBe(0);
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    // Created and resumed synchronously, inside the click.
    expect(audioContexts).toHaveLength(1);
    expect(audioContext().calls[0]).toBe('resume');
    await settle();

    expect(scene.props().audio?.context).toBe(audioContext());
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByTestId('street-controls-hint')).toHaveTextContent(
      'Walk: A and D or the arrow keys. Touch the left or right half of the screen.',
    );
    expect(screen.getByTestId('street-touch-zones')).toHaveAttribute('aria-hidden', 'true');
  });

  it('a blocked sound shows Try again, which retries the same context', async () => {
    installAudio('stay');
    const { scene } = await openStreet();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The browser did not start the sound. Press Try again to turn it on.',
    );
    expect(scene.props().audio).toBeNull();

    audioContext().resumeBehaviour = 'run';
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await settle();
    expect(audioContexts).toHaveLength(1);
    expect(scene.props().audio?.context).toBe(audioContext());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a browser without Web Audio gets the cannot-play screen and the way home', async () => {
    const { scene } = await openStreet();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await settle();

    expect(screen.getByRole('alert', { name: 'This browser cannot play the game' })).toBeInTheDocument();
    expect(scene.mounted).toBe(false);
  });
});

describe('StageGame: walking and the club door', () => {
  it('AC-STAGE-003.1: holding A or D, or the left or right arrow, walks that way, and letting go stops', async () => {
    const { scene } = await playStreet();

    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    expect(direction(scene)).toBe(1);
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    expect(direction(scene)).toBe(0);

    fireEvent.keyDown(window, { code: 'ArrowLeft', key: 'ArrowLeft' });
    expect(direction(scene)).toBe(-1);
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(direction(scene)).toBe(0);
    fireEvent.keyUp(window, { code: 'ArrowLeft', key: 'ArrowLeft' });
    expect(direction(scene)).toBe(1);
    fireEvent.keyUp(window, { code: 'ArrowRight', key: 'ArrowRight' });

    fireEvent.keyDown(window, { code: 'KeyA', key: 'a' });
    expect(direction(scene)).toBe(-1);
    fireEvent.keyUp(window, { code: 'KeyA', key: 'a' });
    expect(direction(scene)).toBe(0);
    // The first step hides the controls hint.
    expect(screen.queryByTestId('street-controls-hint')).not.toBeInTheDocument();
  });

  it('AC-STAGE-003.1: holding the left or right half of the touch zone walks that way, and letting go stops', async () => {
    const { scene } = await playStreet();
    const zones = screen.getByTestId('street-touch-zones');
    const left = zones.querySelector<HTMLElement>('[data-side="left"]');
    const right = zones.querySelector<HTMLElement>('[data-side="right"]');
    if (left === null || right === null) throw new Error('no touch halves');

    fireEvent.pointerDown(left, { pointerId: 1, button: 0 });
    expect(direction(scene)).toBe(-1);
    fireEvent.pointerDown(right, { pointerId: 2, button: 0 });
    expect(direction(scene)).toBe(0);
    fireEvent.pointerUp(left, { pointerId: 1 });
    expect(direction(scene)).toBe(1);
    fireEvent.pointerCancel(right, { pointerId: 2 });
    expect(direction(scene)).toBe(0);
  });

  it('AC-STAGE-003.3: away from the door there is no prompt and E does nothing', async () => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(false));

    expect(screen.queryByRole('button', { name: ENTER_CLUB })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter' });
    expect(scene.mounted).toBe(true);
    expect(document.querySelector('[data-duel-game]')).toBeNull();
  });

  it('AC-STAGE-003.3: by the door the Enter the club button shows and is announced', async () => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(true));

    const button = screen.getByRole('button', { name: ENTER_CLUB });
    expect(button).toBeEnabled();
    expect(within(button).getByText('E or Enter')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(DOOR_NEAR)).toHaveAttribute('aria-live', 'polite');

    act(() => scene.props().onNearDoorChange(false));
    expect(screen.queryByRole('button', { name: ENTER_CLUB })).not.toBeInTheDocument();
    expect(screen.queryByText(DOOR_NEAR)).not.toBeInTheDocument();
  });

  it.each([
    ['E', { code: 'KeyE', key: 'e' }],
    ['Enter', { code: 'Enter', key: 'Enter' }],
  ])('AC-STAGE-003.3: by the door, %s enters the club', async (_name, key) => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.keyDown(window, key);

    expect(scene.mounted).toBe(false);
    expect(document.querySelector('[data-duel-game]')).not.toBeNull();
  });

  it('AC-STAGE-003.3: by the door, a tap on Enter the club enters the club', async () => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.click(screen.getByRole('button', { name: ENTER_CLUB }));

    expect(scene.mounted).toBe(false);
    expect(document.querySelector('[data-duel-game]')).not.toBeNull();
  });

  it('AC-STAGE-003.3: Enter on the focused button is left to the button, and a held E does not repeat', async () => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    const button = screen.getByRole('button', { name: ENTER_CLUB });

    fireEvent.keyDown(button, { code: 'Enter', key: 'Enter' });
    fireEvent.keyDown(window, { code: 'KeyE', key: 'e', repeat: true });
    expect(scene.mounted).toBe(true);
    // The browser turns Enter on a focused button into its click: one entry.
    fireEvent.click(button);
    expect(scene.mounted).toBe(false);
  });

  it('entering the club stops the street music', async () => {
    const { scene } = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.click(screen.getByRole('button', { name: ENTER_CLUB }));
    await settle();

    expect(audioContext().state).toBe('suspended');
  });
});

describe('StageGame: hidden tab, leaving and a lost context', () => {
  it('AC-STAGE-008.2: a hidden tab pauses the street, suspends its audio and lets go of held keys', async () => {
    const { scene } = await playStreet();
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    expect(direction(scene)).toBe(1);

    setVisibility('hidden');
    await settle();
    expect(scene.props().paused).toBe(true);
    expect(audioContext().state).toBe('suspended');
    expect(direction(scene)).toBe(0);

    setVisibility('visible');
    await settle();
    expect(scene.props().paused).toBe(false);
    expect(audioContext().state).toBe('running');
    // The key-up was lost while hidden: D counts again only once pressed again.
    expect(direction(scene)).toBe(0);
  });

  it('a phone held upright shows the rotate hint and pauses the street', async () => {
    stubMedia((query) => query.includes('orientation: portrait'));
    const { scene } = await playStreet();

    expect(screen.getByTestId('rotate-hint')).toBeInTheDocument();
    expect(scene.props().paused).toBe(true);
    expect(audioContext().state).toBe('suspended');
  });

  it('AC-STAGE-008.1: leaving the page unmounts the 3D scene and closes the audio', async () => {
    const { scene, unmount } = await playStreet();
    expect(scene.mounted).toBe(true);

    unmount();
    await settle();
    expect(scene.unmounts).toBe(1);
    expect(audioContext().state).toBe('closed');
  });

  it('Back to portfolio releases the audio before the page leaves', async () => {
    await playStreet();
    fireEvent.click(screen.getByRole('link', { name: /Back to portfolio/ }));
    await settle();

    expect(navigations).toEqual(['/en']);
    expect(audioContext().state).toBe('closed');
  });

  it('a WebGL context lost on the street after Play (design decision 3) falls back to the grey-box duel on the same audio, with no second Play', async () => {
    const { scene, unmount } = await playStreet();
    act(() => scene.props().onFallback('noWebgl'));
    await settle();

    expect(screen.getByTestId('stage-note')).toHaveTextContent(NOTE_NO_WEBGL);
    expect(screen.getByTestId('stage-note')).toHaveAttribute('role', 'status');
    expect(document.querySelector('[data-duel-game]')).not.toBeNull();
    expect(scene.mounted).toBe(false);
    // The Play press on the street already unlocked the audio: straight to the difficulty step.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(audioContexts).toHaveLength(1);
    expect(audioContext().state).not.toBe('closed');

    // Leaving the page still releases it.
    unmount();
    await settle();
    expect(audioContext().state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------------------------
// The street stage itself (scenes/StreetScene.tsx), driven with a fake renderer
// ---------------------------------------------------------------------------------------------

interface Rig {
  readonly stage: StreetStage;
  readonly renderer: FakeRenderer;
  readonly fakes: FakeStreetModels;
  readonly nearDoor: boolean[];
  hold(next: WalkDirection): void;
  /** Steps the stage `count` frames of `dt` seconds. */
  run(count: number, dt?: number): void;
}

function buildRig(options: Partial<StreetStageOptions> = {}): Rig {
  const renderer = new FakeRenderer();
  const fakes = buildFakeStreetModels();
  const nearDoor: boolean[] = [];
  let held: WalkDirection = 0;
  const stage = createStreetStage({
    renderer,
    models: fakes.models,
    getDirection: () => held,
    onNearDoorChange: (near) => nearDoor.push(near),
    ...options,
  });
  return {
    stage,
    renderer,
    fakes,
    nearDoor,
    hold: (next) => {
      held = next;
    },
    run: (count, dt = 1 / 60) => {
      for (let i = 0; i < count; i++) stage.frame(dt);
    },
  };
}

function yawOf(stage: StreetStage): number {
  const quaternion = stage.scene.getObjectByName('fixture')?.quaternion ?? new Quaternion();
  return new Euler().setFromQuaternion(quaternion, 'YXZ').y;
}

describe('street stage', () => {
  let rig: Rig | null = null;

  afterEach(() => {
    rig?.stage.release();
    rig = null;
  });

  function useRig(options: Partial<StreetStageOptions> = {}): Rig {
    rig = buildRig(options);
    return rig;
  }

  it('reads the logic nodes and the camera extras of the street', () => {
    const { layout } = useRig().stage;
    expect(layout.walk).toEqual({ walkMin: FAKE_STREET.walkMin, walkMax: FAKE_STREET.walkMax });
    expect(layout.camera).toEqual({ camMin: FAKE_STREET.camMin, camMax: FAKE_STREET.camMax });
    expect(layout.doorX).toBe(FAKE_STREET.doorX);
    expect(layout.spawnX).toBe(FAKE_STREET.spawnX);
    expect(layout.spawnYaw).toBeCloseTo(Math.PI / 2);
    expect(layout.framing).toEqual(FAKE_FRAMING);
    expect(layout.duckSpots).toHaveLength(5);
    expect(readFraming(buildFakeStreet({ noFraming: true }).street.getObjectByName('cam_min')!))
      .toEqual(REFERENCE_FRAMING);
  });

  it('a street without a required node breaks the asset contract', () => {
    for (const name of ['spawn', 'walk_max', 'cam_min', 'club_door', 'duck_path_3']) {
      expect(() => readStreetLayout(buildFakeStreet({ omit: name }).street)).toThrow(name);
    }
  });

  it('caps the pixel ratio at MAX_DPR: 1.5 on a computer, 1.25 on a phone', () => {
    expect(MAX_DPR).toEqual({ desktop: 1.5, phone: 1.25 });
    expect(stagePixelRatio(3, false)).toBe(1.5);
    expect(stagePixelRatio(3, true)).toBe(1.25);
    expect(stagePixelRatio(1, false)).toBe(1);
    expect(stagePixelRatio(Number.NaN, true)).toBe(1);

    const { stage, renderer } = useRig();
    stage.resize(1280, 720, stagePixelRatio(2, false));
    expect(renderer.pixelRatio).toBe(1.5);
    expect(renderer.size).toEqual({ width: 1280, height: 720 });
    expect(stage.camera.aspect).toBeCloseTo(16 / 9);
  });

  it('AC-STAGE-003.1: the character walks at STREET_WALK_SPEED in the held direction and stops when let go', () => {
    const { stage, hold, run } = useRig();
    const start = stage.playerX;

    hold(1);
    run(30);
    expect(stage.playerVelocity).toBeCloseTo(STREET_WALK_SPEED);
    expect(stage.playerX).toBeCloseTo(start + STREET_WALK_SPEED * 0.5);

    hold(0);
    run(30);
    expect(stage.playerVelocity).toBe(0);
    expect(stage.playerX).toBeCloseTo(start + STREET_WALK_SPEED * 0.5);

    hold(-1);
    run(60);
    expect(stage.playerVelocity).toBeCloseTo(-STREET_WALK_SPEED);
    expect(stage.playerX).toBeCloseTo(start + STREET_WALK_SPEED * 0.5 - STREET_WALK_SPEED);
  });

  it('wires the walk cycle to the walking speed, |v| / WALK_STRIDE steps a second, and turns the character', () => {
    const { stage, hold, run } = useRig();
    hold(1);
    run(60);
    expect(stage.gait).toBeCloseTo(STREET_WALK_SPEED / WALK_STRIDE);
    expect(yawOf(stage)).toBeCloseTo(Math.PI / 2);

    hold(-1);
    run(30);
    expect(yawOf(stage)).toBeCloseTo(-Math.PI / 2);

    // Held at the end of the street the speed is 0: the legs stop with it.
    hold(-1);
    run(60 * 20);
    expect(stage.playerX).toBe(FAKE_STREET.walkMin);
    const gait = stage.gait;
    run(30);
    expect(stage.gait).toBe(gait);
  });

  it('AC-STAGE-003.3: walking into the door radius reports it once, and walking out reports it again', () => {
    const { stage, hold, run, nearDoor } = useRig();
    expect(nearDoor).toEqual([false]);

    hold(1);
    const toDoor = FAKE_STREET.doorX - DOOR_PROMPT_RADIUS - stage.playerX;
    run(Math.ceil((toDoor / STREET_WALK_SPEED) * 60) + 1);
    expect(nearDoor).toEqual([false, true]);
    run(5);
    expect(nearDoor).toEqual([false, true]);
    run(60 * 3);
    expect(nearDoor).toEqual([false, true, false]);
  });

  it('starting at the club door puts the character inside the door radius', () => {
    const { stage, nearDoor } = useRig({ startAt: 'door' });
    expect(stage.playerX).toBe(FAKE_STREET.doorX);
    expect(nearDoor).toEqual([true]);
  });

  it('AC-STAGE-003.4: the smoothed camera follows on X and never passes cam_min or cam_max', () => {
    const { stage, hold, run } = useRig();
    const { camMin, camMax } = stage.layout.camera;
    const seen: number[] = [];
    hold(1);
    for (let i = 0; i < 60 * 20; i++) {
      run(1);
      seen.push(stage.camera.position.x);
    }
    hold(-1);
    for (let i = 0; i < 60 * 20; i++) {
      run(1);
      seen.push(stage.camera.position.x);
    }
    expect(Math.max(...seen)).toBeLessThanOrEqual(camMax);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(camMin);
    // It gets all the way to each bound, and no further.
    expect(Math.max(...seen)).toBeCloseTo(camMax, 6);
    expect(stage.camera.position.x).toBeCloseTo(camMin, 6);
    // Only along X: the camera keeps its height, depth and pitch.
    expect(stage.camera.rotation.y).toBe(0);
  });

  it('AC-STAGE-003.4: with normal motion the camera eases after the character, within the bounds', () => {
    const { stage, hold, run } = useRig();
    const startX = stage.camera.position.x;
    hold(1);
    run(6);
    const target = cameraX(stage.playerX, stage.layout.camera);
    expect(stage.camera.position.x).toBeGreaterThan(startX);
    expect(stage.camera.position.x).toBeLessThan(target);

    const bounds = createCameraBounds(-3, 12);
    fc.assert(
      fc.property(
        fc.double({ min: -3, max: 12, noNaN: true }),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (current, characterX, dt) => {
          const next = followCamera(current, characterX, dt, bounds, false);
          return next >= bounds.camMin && next <= bounds.camMax;
        },
      ),
    );
    expect(followCamera(0, 10, CAMERA_FOLLOW_TAU_S, bounds, false)).toBeCloseTo(10 * (1 - Math.exp(-1)));
  });

  it('AC-STAGE-003.4: with reduced motion the camera sits exactly on the character, held within the bounds', () => {
    const { stage, hold, run } = useRig({ reducedMotion: true });
    hold(1);
    for (let i = 0; i < 60 * 20; i++) {
      run(1);
      expect(stage.camera.position.x).toBe(cameraX(stage.playerX, stage.layout.camera));
    }
    expect(stage.camera.position.x).toBe(stage.layout.camera.camMax);
  });

  it('frames the street closer than the reference still, backing off on a narrow screen so the ends stay in view', () => {
    const { stage } = useRig();
    const { layout } = stage;
    const closer = FAKE_FRAMING.distance * STREET_CAMERA_CLOSER;
    expect(streetCameraDistance(layout, 16 / 9)).toBe(closer);
    stage.resize(1280, 720, 1);
    expect(stage.camera.position.z - layout.pathZ).toBeCloseTo(closer);

    // Portrait: the camera stands back until the far end of the walk fits beside cam_max.
    const narrow = streetCameraDistance(layout, 9 / 16);
    expect(narrow).toBeGreaterThan(closer);
    const halfWidth = Math.tan((FAKE_FRAMING.fovDeg * Math.PI) / 360) * (9 / 16) * narrow;
    expect(halfWidth).toBeGreaterThanOrEqual(layout.walk.walkMax - layout.camera.camMax);
  });

  it('AC-STAGE-004.1: the street queues the duck quacks on beats 2 and 4 of every bar, on the audio clock', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const audio: GameAudio = createGameAudio(context, { timer: createManualTimer() });
    const quackTimer = createManualTimer();
    const { stage } = useRig({ schedulerTimer: quackTimer });
    stage.setAudio(audio);
    const music = stage.music;
    if (music === null) throw new Error('no street music');

    const frames = 60 * 12;
    for (let i = 0; i <= frames; i++) {
      context.currentTime = i / 60;
      stage.frame(1 / 60);
      quackTimer.fire();
    }
    const end = frames / 60;

    const duckStarts = context
      .audibleSources()
      .filter((source) => isRoutedTo(source, audio.channels.sfx))
      .map((source) => source.startTime ?? Number.NaN);
    // Each quack is the duck lick sound: two calls, the second 0.13 s after the first.
    const quacks = duckStarts.filter((_time, index) => index % 2 === 0);
    // 12 s at 84 BPM is about 4 bars: two quacks a bar.
    expect(quacks.length).toBeGreaterThanOrEqual(7);
    expect(new Set(quacks).size).toBe(quacks.length);
    for (const time of quacks) {
      const beatInBar = timeToBeat(music.clock, time) % BEATS_PER_BAR;
      // Beats 2 and 4, counted from 1, sit 1 and 3 beats into the bar.
      expect([1, 3].some((beat) => Math.abs(beatInBar - beat) < 1e-9)).toBe(true);
    }
    expect(quacks).toEqual(quackTimesBetween(music.clock, music.clock.t0, quacks[quacks.length - 1] + 1e-9));
    expect(quacks[quacks.length - 1]).toBeGreaterThan(end - 2);
  });

  it('the ducks dip at each quack, and stay still with reduced motion', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const audio = createGameAudio(context, { timer: createManualTimer() });

    function dipAtFirstQuack(reducedMotion: boolean): number {
      const local = buildRig({ schedulerTimer: createManualTimer(), reducedMotion });
      local.stage.setAudio(audio);
      const clock = local.stage.music?.clock;
      if (!clock) throw new Error('no street music');
      const [quack] = quackTimesBetween(clock, clock.t0, clock.t0 + 4);
      context.currentTime = quack;
      local.stage.frame(1 / 60);
      const [mesh] = local.stage.ducks;
      const restY = local.stage.layout.duckSpots[0].elements[13];
      const y = mesh.instanceMatrix.array[13];
      local.stage.release();
      return y - restY;
    }

    expect(dipAtFirstQuack(false)).toBeCloseTo(-DUCK_BOB_DEPTH);
    // The instance matrices are 32-bit floats.
    expect(dipAtFirstQuack(true)).toBeCloseTo(0, 6);
  });

  it('the street lamps are dark until lit', () => {
    const { stage, fakes } = useRig();
    expect(fakes.lampMaterial.emissiveIntensity).toBe(0);
    stage.setLightsOn(true);
    expect(fakes.lampMaterial.emissiveIntensity).toBe(FAKE_LAMP_INTENSITY);
    stage.setLightsOn(false);
    expect(fakes.lampMaterial.emissiveIntensity).toBe(0);
  });

  it('AC-STAGE-008.2: pausing stops the render loop and the duck scheduler, and resuming restarts them', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const quackTimer = createManualTimer();
    const { stage, renderer } = useRig({ schedulerTimer: quackTimer });
    stage.setAudio(createGameAudio(context, { timer: createManualTimer() }));
    expect(stage.running).toBe(true);
    expect(renderer.tick(0)).toBe(true);
    expect(renderer.tick(16)).toBe(true);
    expect(renderer.renders).toBe(2);
    expect(quackTimer.active).toBe(true);

    stage.setPaused(true);
    expect(stage.running).toBe(false);
    expect(renderer.loopCalls[renderer.loopCalls.length - 1]).toBe('stop');
    expect(renderer.tick(32)).toBe(false);
    expect(renderer.renders).toBe(2);
    expect(quackTimer.active).toBe(false);

    stage.setPaused(false);
    expect(renderer.tick(10_000)).toBe(true);
    expect(quackTimer.active).toBe(true);
    // The first frame after a pause steps 0 s: the character does not jump.
    expect(stage.playerVelocity).toBe(0);
  });

  it('AC-STAGE-008.1: release stops the loop and the music, disposes geometry, textures and the VRM, and gives the context back', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const quackTimer = createManualTimer();
    const { stage, renderer, fakes } = useRig({ schedulerTimer: quackTimer });
    const audio = createGameAudio(context, { timer: createManualTimer() });
    stage.setAudio(audio);
    stage.frame(1 / 60);

    const disposed = new Set<unknown>();
    const watch = (target: { addEventListener(type: 'dispose', listener: () => void): void }) =>
      target.addEventListener('dispose', () => disposed.add(target));
    const geometries: BufferGeometry[] = [
      fakes.facade.geometry,
      fakes.body.geometry,
      fakes.player.body.geometry,
      fakes.player.prop.geometry,
    ];
    const textures: Texture[] = [fakes.facadeTexture, fakes.player.palette, fakes.player.shade];
    const materials: Material[] = [
      fakes.lampMaterial,
      fakes.facade.material,
      fakes.body.material,
      fakes.player.surface,
      fakes.player.plain,
    ];
    const [ducks] = stage.ducks;
    [...geometries, ...textures, ...materials, ducks].forEach(watch);

    stage.release();
    expect(stage.running).toBe(false);
    expect(renderer.loop).toBeNull();
    expect(renderer.tick(100)).toBe(false);
    expect(quackTimer.active).toBe(false);
    for (const item of [...geometries, ...textures, ...materials, ducks]) {
      expect(disposed.has(item)).toBe(true);
    }
    expect(stage.scene.children).toHaveLength(0);
    expect(renderer.disposeCalls).toBe(1);
    expect(renderer.context.loseContextCalls).toBe(1);
    expect(renderer.context.isContextLost()).toBe(true);

    stage.release();
    expect(renderer.context.loseContextCalls).toBe(1);
    rig = null;
  });
});
