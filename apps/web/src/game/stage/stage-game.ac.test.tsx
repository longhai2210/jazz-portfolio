/**
 * @jest-environment jsdom
 */
// Tester's tests for T-021, written from the ACs of specs/game-stage (not from the code).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { createGameAudio } from '../audio';
import {
  createFakeAudioScope,
  createManualTimer,
  FakeAudioContext,
} from '../audio/testing/fake-audio-context';
import { BEATS_PER_BAR } from '../core/config';
import { installPointerEvent } from '../ui/lanes/testing/pointer-event';
import { navigations } from '../ui/screens/testing/link';
import {
  createFakeAssetServer,
  createManualStream,
  FAKE_FILE_URLS,
  validManifestJson,
} from './assets/testing/fake-asset-server';
import { createStreetStage, type StreetStage } from './scenes/StreetScene';
import StageGame from './StageGame';
import { STREET_BPM } from './street/config';
import { FakeRenderer, installWebGL2, type InstalledWebGL2 } from './testing/fake-webgl';
import { buildFakeStreetModels, FAKE_STREET } from './testing/fake-street';
import { createFakeStreetScene, type FakeStreetScene } from './testing/fake-street-scene';
import { setFakeLocale } from './testing/intl';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('../ui/screens/testing/link')>('../ui/screens/testing/link'),
);
jest.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }));

let webgl: InstalledWebGL2 | null = null;
let infoSpy: jest.SpyInstance;
let restorePointerEvent: () => void = () => undefined;

function serve(fetchFn: unknown): void {
  Object.defineProperty(window, 'fetch', { configurable: true, writable: true, value: fetchFn });
}

let audioContexts: FakeAudioContext[] = [];

function installAudio(): void {
  const fake = createFakeAudioScope();
  audioContexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
}

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
});

/** One half of the touch zones; fails the test when it is missing. */
function half(zones: HTMLElement, side: 'left' | 'right'): HTMLElement {
  const found = zones.querySelector<HTMLElement>(`[data-side="${side}"]`);
  if (found === null) throw new Error(`the ${side} touch half is missing`);
  return found;
}

function openWith(fetchFn: unknown): FakeStreetScene {
  webgl = installWebGL2(true);
  serve(fetchFn);
  const scene = createFakeStreetScene();
  render(<StageGame loadScene={scene.load} />);
  return scene;
}

async function playStreet(): Promise<FakeStreetScene> {
  installAudio();
  const scene = openWith(createFakeAssetServer().fetch);
  await settle();
  act(() => scene.props().onReady());
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await settle();
  return scene;
}

describe('AC-STAGE-001.1 the 3D stage opens with a valid manifest', () => {
  it('AC-STAGE-001.1: with every file downloaded the street scene mounts and no grey-box note shows', async () => {
    const scene = openWith(createFakeAssetServer().fetch);
    await settle();
    expect(scene.mounted).toBe(true);
    expect(scene.props().files).toBeDefined();
    expect(screen.queryByTestId('stage-note')).not.toBeInTheDocument();
    expect(document.querySelector('[data-duel-game]')).toBeNull();
  });

  it('AC-STAGE-001.1: the loading panel goes once the scene reports ready, and the Play gate shows', async () => {
    installAudio();
    const scene = openWith(createFakeAssetServer().fetch);
    await settle();
    act(() => scene.props().onReady());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});

describe('AC-STAGE-001.4 loading shows the real bytes', () => {
  it('AC-STAGE-001.4: while the manifest is read only the checking text shows, with no bar', () => {
    webgl = installWebGL2(true);
    serve(() => new Promise(() => undefined));
    render(<StageGame loadScene={createFakeStreetScene().load} />);
    expect(screen.getByText('Checking the stage files...')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('AC-STAGE-001.4: the bar and the MB text follow the bytes that really arrived', async () => {
    const stream = createManualStream();
    const server = createFakeAssetServer({
      routes: { [FAKE_FILE_URLS.hoLangStreet]: { kind: 'stream', stream: stream.stream } },
    });
    openWith(server.fetch);
    await settle();

    const bar = screen.getByRole('progressbar', { name: 'Loading progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    const before = Number(bar.getAttribute('aria-valuenow'));
    expect(before).toBeLessThan(100);
    expect(screen.getByText(/MB of/)).toBeInTheDocument();

    // 400-byte street file: feeding it moves the bar by exactly those bytes.
    act(() => stream.push(200));
    await settle();
    const mid = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(mid).toBeGreaterThan(before);
    expect(mid).toBeLessThan(100);

    act(() => stream.push(200));
    await settle();
    const late = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
    expect(late).toBeGreaterThan(mid);
  });

  it('AC-STAGE-001.4: the bar never advances without data (no fake progress)', async () => {
    const stream = createManualStream();
    const server = createFakeAssetServer({
      routes: { [FAKE_FILE_URLS.hoLangStreet]: { kind: 'stream', stream: stream.stream } },
    });
    openWith(server.fetch);
    await settle();
    const first = screen.getByRole('progressbar').getAttribute('aria-valuenow');
    await settle();
    await settle();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(first);
  });

  it('AC-STAGE-001.4: a manifest that declares 0 bytes shows no bar, only the checking text', async () => {
    const manifest = validManifestJson() as {
      characters: { player: { bytes: number } };
      stages: { hoLangStreet: { bytes: number }; hoLangClub: { bytes: number } };
      props: { duck: { bytes: number } };
      sprites: { drummer: { bytes: number } };
    };
    manifest.characters.player.bytes = 0;
    manifest.stages.hoLangStreet.bytes = 0;
    manifest.stages.hoLangClub.bytes = 0;
    manifest.props.duck.bytes = 0;
    manifest.sprites.drummer.bytes = 0;
    const stream = createManualStream();
    const server = createFakeAssetServer({
      manifest,
      routes: { [FAKE_FILE_URLS.hoLangStreet]: { kind: 'stream', stream: stream.stream } },
    });
    openWith(server.fetch);
    await settle();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Checking the stage files...')).toBeInTheDocument();
  });
});

describe('AC-STAGE-003.1 walking by keyboard and touch', () => {
  it('AC-STAGE-003.1: A and the left arrow walk left, D and the right arrow walk right, release stops', async () => {
    const scene = await playStreet();
    const dir = () => scene.props().getDirection();
    expect(dir()).toBe(0);
    for (const [key, expected] of [
      ['a', -1],
      ['ArrowLeft', -1],
      ['d', 1],
      ['ArrowRight', 1],
    ] as const) {
      fireEvent.keyDown(window, { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key });
      expect(dir()).toBe(expected);
      fireEvent.keyUp(window, { key, code: key.length === 1 ? `Key${key.toUpperCase()}` : key });
      expect(dir()).toBe(0);
    }
  });

  it('AC-STAGE-003.1: both directions held together stand still', async () => {
    const scene = await playStreet();
    fireEvent.keyDown(window, { key: 'a', code: 'KeyA' });
    fireEvent.keyDown(window, { key: 'd', code: 'KeyD' });
    expect(scene.props().getDirection()).toBe(0);
    fireEvent.keyUp(window, { key: 'a', code: 'KeyA' });
    expect(scene.props().getDirection()).toBe(1);
  });

  it('AC-STAGE-003.1: losing window focus drops held keys', async () => {
    const scene = await playStreet();
    fireEvent.keyDown(window, { key: 'd', code: 'KeyD' });
    expect(scene.props().getDirection()).toBe(1);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(scene.props().getDirection()).toBe(0);
  });

  it('AC-STAGE-003.1: holding the left or right half of the touch zone walks that way until release', async () => {
    const scene = await playStreet();
    const zones = screen.getByTestId('street-touch-zones');
    const left = half(zones, 'left');
    const right = half(zones, 'right');
    fireEvent.pointerDown(left, { pointerId: 1, button: 0 });
    expect(scene.props().getDirection()).toBe(-1);
    fireEvent.pointerUp(left, { pointerId: 1 });
    expect(scene.props().getDirection()).toBe(0);
    fireEvent.pointerDown(right, { pointerId: 2, button: 0 });
    expect(scene.props().getDirection()).toBe(1);
    fireEvent.pointerCancel(right, { pointerId: 2 });
    expect(scene.props().getDirection()).toBe(0);
  });

  it('AC-STAGE-003.1: two fingers on both halves stand still', async () => {
    const scene = await playStreet();
    const zones = screen.getByTestId('street-touch-zones');
    fireEvent.pointerDown(half(zones, 'left'), {
      pointerId: 1,
      button: 0,
    });
    fireEvent.pointerDown(half(zones, 'right'), {
      pointerId: 2,
      button: 0,
    });
    expect(scene.props().getDirection()).toBe(0);
  });

  it('AC-STAGE-003.1: the character cannot walk before Play', async () => {
    installAudio();
    const scene = openWith(createFakeAssetServer().fetch);
    await settle();
    act(() => scene.props().onReady());
    fireEvent.keyDown(window, { key: 'd', code: 'KeyD' });
    expect(scene.props().getDirection()).toBe(0);
  });
});

describe('AC-STAGE-003.3 the club door prompt (scene wiring)', () => {
  it('AC-STAGE-003.3: away from the door there is no enter button and E or Enter do nothing', async () => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(false));
    expect(screen.queryByRole('button', { name: /Enter the club/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
    fireEvent.keyDown(window, { key: 'Enter', code: 'Enter' });
    expect(scene.mounted).toBe(true);
    expect(document.querySelector('[data-duel-game]')).toBeNull();
  });

  it('AC-STAGE-003.3: near the door the button shows with a polite announcement', async () => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    expect(screen.getByRole('button', { name: /Enter the club/ })).toBeInTheDocument();
    expect(screen.getByText('You are at the club door.')).toBeInTheDocument();
  });

  it.each([
    ['E', { key: 'e', code: 'KeyE' }],
    ['Enter', { key: 'Enter', code: 'Enter' }],
  ])('AC-STAGE-003.3: pressing %s near the door enters the club', async (_label, event) => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.keyDown(window, event);
    expect(scene.mounted).toBe(false);
    expect(screen.queryByTestId('street-scene')).not.toBeInTheDocument();
  });

  it('AC-STAGE-003.3: a repeated keydown does not enter', async () => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE', repeat: true });
    expect(scene.mounted).toBe(true);
  });

  it('AC-STAGE-003.3: clicking the button enters the club', async () => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    fireEvent.click(screen.getByRole('button', { name: /Enter the club/ }));
    expect(scene.mounted).toBe(false);
  });

  it('AC-STAGE-003.3: E typed in a text field does not enter', async () => {
    const scene = await playStreet();
    act(() => scene.props().onNearDoorChange(true));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'e', code: 'KeyE' });
    input.remove();
    expect(scene.mounted).toBe(true);
  });
});

describe('AC-STAGE-008.2 a hidden tab pauses the street', () => {
  it('AC-STAGE-008.2: the scene is told it is paused while the tab is hidden, and walking stops', async () => {
    const scene = await playStreet();
    expect(scene.props().paused).toBe(false);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(scene.props().paused).toBe(true);
    fireEvent.keyDown(window, { key: 'd', code: 'KeyD' });
    expect(scene.props().getDirection()).toBe(0);
  });
});

describe('AC-STAGE-008.1 leaving /game cleans up', () => {
  it('AC-STAGE-008.1: unmounting unmounts the scene and closes the audio context', async () => {
    installAudio();
    webgl = installWebGL2(true);
    serve(createFakeAssetServer().fetch);
    const scene = createFakeStreetScene();
    const view = render(<StageGame loadScene={scene.load} />);
    await settle();
    act(() => scene.props().onReady());
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await settle();
    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0].state).not.toBe('closed');
    view.unmount();
    await settle();
    expect(scene.mounted).toBe(false);
    expect(audioContexts[0].state).toBe('closed');
  });

  it('AC-STAGE-008.1: unmounting mid-download aborts the requests and falls back to nothing', async () => {
    const stream = createManualStream();
    const server = createFakeAssetServer({
      routes: { [FAKE_FILE_URLS.hoLangStreet]: { kind: 'stream', stream: stream.stream } },
    });
    webgl = installWebGL2(true);
    serve(server.fetch);
    const scene = createFakeStreetScene();
    const view = render(<StageGame loadScene={scene.load} />);
    await settle();
    view.unmount();
    await settle();
    expect(stream.cancelled()).toBe(true);
    expect(scene.loads).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// The scene halves: camera and duck quacks, on the real street stage with a fake renderer.
// ---------------------------------------------------------------------------------------------

function makeStage(options: {
  reducedMotion: boolean;
  direction: () => -1 | 0 | 1;
  schedulerTimer?: ReturnType<typeof createManualTimer>;
}): { stage: StreetStage; renderer: FakeRenderer } {
  const renderer = new FakeRenderer();
  const { models } = buildFakeStreetModels();
  const stage = createStreetStage({
    renderer,
    models,
    getDirection: options.direction,
    onNearDoorChange: () => undefined,
    reducedMotion: options.reducedMotion,
    schedulerTimer: options.schedulerTimer,
  });
  return { stage, renderer };
}

describe('AC-STAGE-003.4 camera follows within cam_min..cam_max', () => {
  it('AC-STAGE-003.4: walking the whole street right then left the camera never leaves the bounds (smoothed)', () => {
    let dir: -1 | 0 | 1 = 1;
    const { stage } = makeStage({ reducedMotion: false, direction: () => dir });
    let sawLag = false;
    for (let i = 0; i < 400; i++) {
      stage.frame(0.05);
      const x = stage.camera.position.x;
      expect(x).toBeGreaterThanOrEqual(FAKE_STREET.camMin - 1e-9);
      expect(x).toBeLessThanOrEqual(FAKE_STREET.camMax + 1e-9);
      if (stage.playerX > FAKE_STREET.camMin && stage.playerX < FAKE_STREET.camMax) {
        if (Math.abs(x - stage.playerX) > 1e-6) sawLag = true;
      }
    }
    // The character is past the camera's right bound (walk_max 40 > cam_max 36): held at cam_max.
    expect(stage.playerX).toBeCloseTo(FAKE_STREET.walkMax);
    expect(stage.camera.position.x).toBeLessThanOrEqual(FAKE_STREET.camMax + 1e-9);
    dir = -1;
    for (let i = 0; i < 900; i++) {
      stage.frame(0.05);
      const x = stage.camera.position.x;
      expect(x).toBeGreaterThanOrEqual(FAKE_STREET.camMin - 1e-9);
      expect(x).toBeLessThanOrEqual(FAKE_STREET.camMax + 1e-9);
    }
    expect(stage.playerX).toBeCloseTo(FAKE_STREET.walkMin);
    expect(stage.camera.position.x).toBeCloseTo(FAKE_STREET.camMin);
    expect(sawLag).toBe(true);
  });

  it('AC-STAGE-003.4: with reduced motion the camera sits exactly on the character (no lag) and still obeys the bounds', () => {
    let dir: -1 | 0 | 1 = 1;
    const { stage } = makeStage({ reducedMotion: true, direction: () => dir });
    for (let i = 0; i < 400; i++) {
      stage.frame(0.05);
      const expected = Math.min(FAKE_STREET.camMax, Math.max(FAKE_STREET.camMin, stage.playerX));
      expect(stage.camera.position.x).toBeCloseTo(expected, 9);
    }
    dir = -1;
    for (let i = 0; i < 900; i++) {
      stage.frame(0.05);
      const expected = Math.min(FAKE_STREET.camMax, Math.max(FAKE_STREET.camMin, stage.playerX));
      expect(stage.camera.position.x).toBeCloseTo(expected, 9);
    }
  });

  it('AC-STAGE-003.4: a huge frame step (stall) still keeps the camera inside', () => {
    const { stage } = makeStage({ reducedMotion: false, direction: () => 1 });
    stage.frame(1000);
    expect(stage.camera.position.x).toBeLessThanOrEqual(FAKE_STREET.camMax);
    expect(stage.camera.position.x).toBeGreaterThanOrEqual(FAKE_STREET.camMin);
  });

  it('AC-STAGE-003.4: switching reduced motion on mid-walk snaps the camera to the character', () => {
    const { stage } = makeStage({ reducedMotion: false, direction: () => 1 });
    for (let i = 0; i < 10; i++) stage.frame(0.05);
    stage.setReducedMotion(true);
    stage.frame(0.05);
    expect(stage.camera.position.x).toBeCloseTo(stage.playerX, 9);
  });
});

describe('AC-STAGE-004.1 the scene schedules duck quacks on beats 2 and 4', () => {
  it('AC-STAGE-004.1: frames on the audio clock queue every quack once, on beats 2 and 4 of each bar', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const audio = createGameAudio(context, { timer: createManualTimer() });
    const { stage } = makeStage({
      reducedMotion: false,
      direction: () => 0,
      schedulerTimer: createManualTimer(),
    });
    stage.setAudio(audio);
    const music = stage.music;
    if (music === null) throw new Error('music not started');
    const pump = jest.spyOn(music, 'pump');

    for (let t = 0; t <= 12; t += 1 / 60) {
      context.currentTime = t;
      stage.frame(1 / 60);
    }
    const queued = pump.mock.results.flatMap((r) => r.value as number[]);
    expect(queued.length).toBeGreaterThanOrEqual(8);

    const spb = 60 / STREET_BPM;
    const t0 = music.clock.t0;
    const beats = queued.map((time) => (time - t0) / spb);
    for (const beat of beats) {
      const index = Math.round(beat);
      expect(beat).toBeCloseTo(index, 6);
      // Index within the bar: 0-based beat 1 and 3 are beats 2 and 4.
      expect([1, 3]).toContain(index % BEATS_PER_BAR);
    }
    // No duplicate and no gap: both quacks of every bar until the end of what was scheduled.
    expect(new Set(queued.map((time) => time.toFixed(6))).size).toBe(queued.length);
    const sorted = [...beats].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeCloseTo(2, 6);
    }
  });

  it('AC-STAGE-004.1: the hidden-tab pause stops queuing quacks and resuming does not replay the gap', () => {
    const context = new FakeAudioContext();
    context.state = 'running';
    const audio = createGameAudio(context, { timer: createManualTimer() });
    const { stage } = makeStage({ reducedMotion: false, direction: () => 0 });
    stage.setAudio(audio);
    const music = stage.music;
    if (music === null) throw new Error('music not started');
    const pump = jest.spyOn(music, 'pump');
    for (let t = 0; t < 2; t += 1 / 60) {
      context.currentTime = t;
      stage.frame(1 / 60);
    }
    stage.setPaused(true);
    const callsWhilePaused = pump.mock.calls.length;
    expect(stage.running).toBe(false);
    context.currentTime = 20;
    stage.setPaused(false);
    stage.frame(1 / 60);
    expect(pump.mock.calls.length).toBe(callsWhilePaused + 1);
    const lastQueued = pump.mock.results[pump.mock.results.length - 1].value as number[];
    for (const time of lastQueued) expect(time).toBeGreaterThanOrEqual(20);
  });
});

const NOTE_MISSING = 'The stage art is not available here, so this is the plain grey-box match.';
const NOTE_NO_WEBGL = 'This browser cannot draw the 3D stage, so this is the plain grey-box match.';

function expectGreyBoxWithNote(note: string): void {
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent(note);
  expect(document.querySelector('[data-duel-game]')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  expect(screen.queryByTestId('street-scene')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
}

describe('AC-STAGE-001.2 missing assets give the grey-box duel', () => {
  it('AC-STAGE-001.2: with no manifest (404) the grey-box duel runs with the missing-assets note', async () => {
    const server = createFakeAssetServer({
      routes: { '/game-assets/manifest.json': { kind: 'status', status: 404 } },
    });
    const scene = openWith(server.fetch);
    await settle();
    expectGreyBoxWithNote(NOTE_MISSING);
    expect(scene.loads).toBe(0);
  });

  it('AC-STAGE-001.2: when the manifest request itself fails (network error) the same fallback shows', async () => {
    const server = createFakeAssetServer({
      routes: { '/game-assets/manifest.json': { kind: 'network-error' } },
    });
    openWith(server.fetch);
    await settle();
    expectGreyBoxWithNote(NOTE_MISSING);
  });

  it.each(Object.entries(FAKE_FILE_URLS))(
    'AC-STAGE-001.2: when %s answers an error the grey-box duel runs with the note',
    async (_id, url) => {
      const server = createFakeAssetServer({ routes: { [url]: { kind: 'status', status: 500 } } });
      const scene = openWith(server.fetch);
      await settle();
      expectGreyBoxWithNote(NOTE_MISSING);
      expect(scene.loads).toBe(0);
    },
  );

  it('AC-STAGE-001.2: the note is localised (vi)', async () => {
    setFakeLocale('vi');
    const server = createFakeAssetServer({
      routes: { '/game-assets/manifest.json': { kind: 'status', status: 404 } },
    });
    openWith(server.fetch);
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chưa có hình ảnh sân khấu ở đây, nên đây là trận khối xám đơn giản.',
    );
  });
});

describe('AC-STAGE-002.1 no WebGL2 gives the grey-box duel', () => {
  it('AC-STAGE-002.1: without a webgl2 context the grey-box duel runs with the no-WebGL note, nothing is fetched and the 3D module is never loaded', async () => {
    webgl = installWebGL2(false);
    const server = createFakeAssetServer();
    serve(server.fetch);
    const scene = createFakeStreetScene();
    render(<StageGame loadScene={scene.load} />);
    await settle();
    expectGreyBoxWithNote(NOTE_NO_WEBGL);
    expect(scene.loads).toBe(0);
    expect(scene.mounts).toBe(0);
    expect(server.requests).toEqual([]);
  });
});
