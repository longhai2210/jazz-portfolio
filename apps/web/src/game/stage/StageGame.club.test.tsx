/**
 * @jest-environment jsdom
 */
// StageGame in and out of the club (game-stage REQ-STAGE-005, design.md sections 2, 3 and 4):
// the duel as Sayo on the street's audio, the Shadow fading after a win, the way back to the
// street, a scene lost in the club, the grey-box note slot and the street under the rotate hint.
// The 3D street and club are stand-ins that record their props; the club stage itself is tested
// in scenes/ClubScene.test.tsx.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { ReadableStream as NodeReadableStream } from 'stream/web';
import { createFakeAudioScope, FakeAudioContext } from '../audio/testing/fake-audio-context';
import { createDuelSession } from '../core/campaign';
import { installPointerEvent } from '../ui/lanes/testing/pointer-event';
import { playTake } from '../ui/screens/testing/duel-results';
import { navigations } from '../ui/screens/testing/link';
import { useGameStore } from '@/stores/gameStore';
import { createFakeAssetServer } from './assets/testing/fake-asset-server';
import type { ClubSceneProps } from './scenes/ClubScene';
import StageGame, { type StreetSceneModule } from './StageGame';
import { installWebGL2, type InstalledWebGL2 } from './testing/fake-webgl';
import { createFakeStreetScene, type FakeStreetScene } from './testing/fake-street-scene';
import { setFakeLocale } from './testing/intl';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('../ui/screens/testing/link')>('../ui/screens/testing/link'),
);

const ENTER_CLUB = 'Enter the club';
const LEAVE_CLUB = 'Leave the club';
const SHADOW_FADING = 'The shadow fades away.';
const LIGHTS_ON = 'The street lights are on';
const NOTE_MISSING = 'The stage art is not available here, so this is the plain grey-box match.';
const NOTE_NO_WEBGL = 'This browser cannot draw the 3D stage, so this is the plain grey-box match.';

// ---------------------------------------------------------------------------------------------
// A stand-in for the 3D club, beside the street stand-in of testing/fake-street-scene.tsx
// ---------------------------------------------------------------------------------------------

interface FakeClubScene {
  readonly mounts: number;
  readonly mounted: boolean;
  /** The props of the latest render; throws if the club never rendered. */
  props(): ClubSceneProps;
}

interface FakeScenes {
  readonly street: FakeStreetScene;
  readonly club: FakeClubScene;
  /** The loader to pass as `loadScene`: the street and the club. */
  readonly load: () => Promise<StreetSceneModule>;
}

function createFakeScenes(): FakeScenes {
  const street = createFakeStreetScene();
  let mounts = 0;
  let unmounts = 0;
  let latest: ClubSceneProps | null = null;

  function FakeClub(props: ClubSceneProps) {
    latest = props;
    useEffect(() => {
      mounts += 1;
      return () => {
        unmounts += 1;
      };
    }, []);
    return (
      <div
        role="img"
        aria-label={props.label}
        data-testid="club-scene"
        data-shadow-faded={props.shadowFaded}
        data-paused={props.paused}
      />
    );
  }

  return {
    street,
    club: {
      get mounts() {
        return mounts;
      },
      get mounted() {
        return mounts > unmounts;
      },
      props() {
        if (latest === null) throw new Error('the fake club never rendered');
        return latest;
      },
    },
    load: async () => ({ ...(await street.load()), ClubScene: FakeClub }),
  };
}

// ---------------------------------------------------------------------------------------------
// Environment: jsdom has no streams, no fetch, no WebGL and no Web Audio
// ---------------------------------------------------------------------------------------------

let webgl: InstalledWebGL2 | null = null;
let audioContexts: FakeAudioContext[] = [];
let infoSpy: jest.SpyInstance;
let restorePointerEvent: () => void = () => undefined;

function installAudio(): void {
  const fake = createFakeAudioScope();
  audioContexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
}

function audioContext(): FakeAudioContext {
  const [first] = audioContexts;
  if (first === undefined) throw new Error('no AudioContext was made');
  return first;
}

function serveAssets(): void {
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: createFakeAssetServer().fetch,
  });
}

const realTimers = jest.requireActual<typeof import('timers')>('timers');

/** Lets downloads, the audio unlock and React settle, then waits one real macrotask. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
  await new Promise<void>((resolve) => realTimers.setImmediate(resolve));
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

/** Lets a few real animation frames run (jsdom draws them on a timer). */
async function frames(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => realTimers.setTimeout(resolve, 60));
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
  useGameStore.getState().reset();
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
// Flows
// ---------------------------------------------------------------------------------------------

interface Opened {
  readonly scenes: FakeScenes;
  readonly unmount: () => void;
}

/** Opens the street with every asset and both scenes, and presses Play. */
async function playStreet(): Promise<Opened> {
  installAudio();
  webgl = installWebGL2(true);
  serveAssets();
  const scenes = createFakeScenes();
  const view = render(<StageGame loadScene={scenes.load} />);
  await settle();
  act(() => scenes.street.props().onReady());
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await settle();
  return { scenes, unmount: view.unmount };
}

/** Walks in through the club door. */
async function enterClub(scenes: FakeScenes): Promise<void> {
  act(() => scenes.street.props().onNearDoorChange(true));
  fireEvent.click(screen.getByRole('button', { name: ENTER_CLUB }));
  await settle();
}

async function openClub(): Promise<Opened> {
  const opened = await playStreet();
  await enterClub(opened.scenes);
  return opened;
}

async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await settle();
}

/** Starts a run in the club's duel, as Sayo, as the setup steps would. */
function startRun(): void {
  act(() =>
    useGameStore.getState().startRun({ player: 'sayo', difficulty: 'lounge', offsetMs: 0 }),
  );
}

/** Ends the take on screen as a win or a loss: its result shows. */
function finishTake(win: boolean): void {
  const campaign = useGameStore.getState().campaign;
  if (campaign === null) throw new Error('no run');
  const result = playTake(createDuelSession(campaign), { win });
  act(() => useGameStore.getState().finishMatch(result));
}

function liveRegion(): HTMLElement {
  return screen.getByTestId('shadow-fading');
}

// ---------------------------------------------------------------------------------------------
// AC-STAGE-005.1: the duel as Sayo, on the street's audio, with no second Play
// ---------------------------------------------------------------------------------------------

describe('StageGame: entering the club', () => {
  it('AC-STAGE-005.1: entering the club runs DuelGame as Sayo on the unlocked audio, without a second Play', async () => {
    const { scenes } = await openClub();

    expect(scenes.street.mounted).toBe(false);
    expect(document.querySelector('[data-duel-game]')).not.toBeNull();
    // No second Play gate: the duel opens on the difficulty step.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    // The club is drawn behind it, on the same audio, and nothing made a second context.
    expect(screen.getByRole('img', { name: 'The club scene' })).toBeInTheDocument();
    expect(scenes.club.props().audio?.context).toBe(audioContext());
    expect(audioContexts).toHaveLength(1);
    expect(audioContext().state).toBe('suspended');

    // Continue wakes the audio inside the press; the calibration runs on it.
    await press('Continue');
    expect(audioContext().state).toBe('running');
    expect(audioContexts).toHaveLength(1);
    // No taps: once the clicks are over, the attempt fails and offers to go on without it.
    audioContext().currentTime = 1_000;
    await frames();
    await press('Continue without it');

    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    const { campaign, session } = useGameStore.getState();
    expect(campaign?.player).toBe('sayo');
    // Sayo's Shadows follow REQ-DUEL-012: Aki in match 1, Ren in match 2, Sayo at club 3.
    expect(campaign?.roster).toMatchObject({
      1: { character: 'aki' },
      2: { character: 'ren' },
      3: { character: 'sayo' },
    });
    expect(session?.config.character).toBe('aki');
  });

  it('the street music stops on the way in, and the club scene pauses with a hidden tab', async () => {
    const { scenes } = await openClub();
    expect(audioContext().state).toBe('suspended');

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(scenes.club.props().paused).toBe(true);
  });

  it('leaving the page from the club unmounts the club scene and closes the audio', async () => {
    const { scenes, unmount } = await openClub();
    expect(scenes.club.mounted).toBe(true);
    unmount();
    await settle();
    expect(scenes.club.mounted).toBe(false);
    expect(audioContext().state).toBe('closed');
  });

  it('Back to portfolio in the club closes the audio before the page leaves', async () => {
    await openClub();
    fireEvent.click(screen.getByRole('link', { name: /Back to portfolio/ }));
    await settle();
    expect(navigations).toEqual(['/en']);
    expect(audioContext().state).toBe('closed');
  });
});

// ---------------------------------------------------------------------------------------------
// AC-STAGE-005.3: the Shadow fades after a win
// ---------------------------------------------------------------------------------------------

describe('StageGame: the Shadow after a take', () => {
  it('AC-STAGE-005.3: a won take fades the Shadow and says so politely; Replay brings it back', async () => {
    const { scenes } = await openClub();
    const region = liveRegion();
    // In the page before anything is said, so the announcement is heard.
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveClass('sr-only');
    expect(region).toBeEmptyDOMElement();

    startRun();
    expect(scenes.club.props().shadowFaded).toBe(false);
    finishTake(true);
    // The result panel shows at once; the scene fades the Shadow behind it.
    expect(screen.getByRole('heading', { name: /is back in the band/ })).toBeInTheDocument();
    expect(scenes.club.props().shadowFaded).toBe(true);
    expect(liveRegion()).toHaveTextContent(SHADOW_FADING);

    await press('Replay this take');
    expect(scenes.club.props().shadowFaded).toBe(false);
    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('AC-STAGE-005.3: the Shadow stays gone on the summary after the last win, and match 2 brings it back', async () => {
    const { scenes } = await openClub();
    startRun();
    finishTake(true);
    await press('On to match 2');
    expect(scenes.club.props().shadowFaded).toBe(false);

    finishTake(true);
    expect(scenes.club.props().shadowFaded).toBe(true);
    await press('See summary');
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(scenes.club.props().shadowFaded).toBe(true);
  });

  it('AC-STAGE-005.3: a lost take leaves the Shadow standing, with nothing announced', async () => {
    const { scenes } = await openClub();
    startRun();
    finishTake(false);
    expect(screen.getByRole('heading', { name: 'Not this take' })).toBeInTheDocument();
    expect(scenes.club.props().shadowFaded).toBe(false);
    expect(liveRegion()).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------------------------
// AC-STAGE-005.4: back on the street, at the club door, lit after a win
// ---------------------------------------------------------------------------------------------

describe('StageGame: leaving the club', () => {
  it('AC-STAGE-005.4: Leave the club is offered on the result, never during the take', async () => {
    await openClub();
    expect(screen.queryByRole('button', { name: LEAVE_CLUB })).not.toBeInTheDocument();
    startRun();
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LEAVE_CLUB })).not.toBeInTheDocument();
    finishTake(false);
    expect(screen.getByRole('button', { name: LEAVE_CLUB })).toBeInTheDocument();
  });

  it('AC-STAGE-005.4: leaving after a lost take puts the player at the club door, with the lamps dark', async () => {
    const { scenes } = await openClub();
    startRun();
    finishTake(false);
    await press(LEAVE_CLUB);

    expect(document.querySelector('[data-duel-game]')).toBeNull();
    expect(scenes.club.mounted).toBe(false);
    expect(scenes.street.mounted).toBe(true);
    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(false);
    expect(screen.queryByText(LIGHTS_ON)).not.toBeInTheDocument();
    // The street goes on with the same audio, its music running again.
    expect(scenes.street.props().audio?.context).toBe(audioContext());
    expect(audioContext().state).toBe('running');
    expect(audioContexts).toHaveLength(1);
    // At the door the scene reports the door near, and the way back in is there.
    act(() => scenes.street.props().onNearDoorChange(true));
    expect(screen.getByRole('button', { name: ENTER_CLUB })).toBeInTheDocument();
  });

  it('AC-STAGE-005.4: leaving after a win lights the street, says so, and keeps it lit on later visits', async () => {
    const { scenes } = await openClub();
    startRun();
    finishTake(true);
    await press(LEAVE_CLUB);

    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(true);
    const chip = screen.getByTestId('street-lights-chip');
    expect(chip).toHaveAttribute('role', 'status');
    expect(chip).toHaveTextContent(LIGHTS_ON);

    // A second visit lost: once a take is won, the street stays lit.
    await enterClub(scenes);
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    startRun();
    finishTake(false);
    await press(LEAVE_CLUB);
    expect(scenes.street.props().lightsOn).toBe(true);
    expect(screen.getByText(LIGHTS_ON)).toBeInTheDocument();
  });

  it('AC-STAGE-005.4: leaving from the summary also puts the player at the lit club door', async () => {
    const { scenes } = await openClub();
    startRun();
    finishTake(true);
    await press('On to match 2');
    finishTake(true);
    await press('See summary');
    await press(LEAVE_CLUB);

    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// The club without its scene, the grey-box note slot, and the street under the rotate hint
// ---------------------------------------------------------------------------------------------

describe('StageGame: a club or a page without the 3D scene', () => {
  it('a WebGL context lost in the club keeps the take going, drops the scene and shows the no-WebGL note', async () => {
    const { scenes } = await openClub();
    startRun();
    const session = useGameStore.getState().session;
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();

    act(() => scenes.club.props().onFallback('noWebgl'));
    await settle();
    expect(scenes.club.mounted).toBe(false);
    // The same duel, still on screen, with its take.
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(useGameStore.getState().campaign?.player).toBe('sayo');
    expect(useGameStore.getState().session?.calls).toBe(session?.calls);
    expect(audioContext().state).not.toBe('closed');
    const note = screen.getByTestId('stage-note');
    expect(note).toHaveTextContent(NOTE_NO_WEBGL);
    expect(note).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('duel-note')).toContainElement(note);

    // Without the scene there is no street to go back to.
    finishTake(true);
    expect(screen.queryByRole('button', { name: LEAVE_CLUB })).not.toBeInTheDocument();
    expect(liveRegion()).toBeEmptyDOMElement();
  });

  it('a club file that does not parse leaves the duel without the scene, with the missing-assets note', async () => {
    const { scenes } = await openClub();
    act(() => scenes.club.props().onFallback('missing'));
    await settle();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(screen.getByTestId('stage-note')).toHaveTextContent(NOTE_MISSING);
  });

  it('the grey-box note sits in the page flow right under the top bar of the duel, inside its page', async () => {
    webgl = installWebGL2(false);
    serveAssets();
    render(<StageGame loadScene={createFakeScenes().load} />);
    await settle();

    const note = screen.getByTestId('stage-note');
    expect(note).toHaveTextContent(NOTE_NO_WEBGL);
    const slot = screen.getByTestId('duel-note');
    expect(slot).toContainElement(note);
    expect(slot.previousElementSibling?.tagName).toBe('HEADER');
    // Inside the duel's page: nothing before the duel adds to the page's height.
    const game = document.querySelector('[data-duel-game]');
    expect(game).toContainElement(slot);
    expect(game?.parentElement?.firstElementChild).toBe(game);
    // Before Play the grey-box duel keeps its own Start (AC-STAGE-002.1).
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('a WebGL context lost on the street after Play goes on as Sayo, on the same audio', async () => {
    const { scenes } = await playStreet();
    act(() => scenes.street.props().onFallback('noWebgl'));
    await settle();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LEAVE_CLUB })).not.toBeInTheDocument();

    await press('Continue');
    audioContext().currentTime = 1_000;
    await frames();
    await press('Continue without it');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(useGameStore.getState().campaign?.player).toBe('sayo');
    expect(useGameStore.getState().session?.config.character).toBe('aki');
    expect(audioContexts).toHaveLength(1);
    expect(screen.getByTestId('stage-note')).toHaveTextContent(NOTE_NO_WEBGL);
  });

  it('while the rotate hint covers a phone held upright, the street under it is inert', async () => {
    stubMedia((query) => query.includes('orientation: portrait'));
    await playStreet();
    expect(screen.getByTestId('rotate-hint')).toBeInTheDocument();
    expect(screen.getByTestId('street-layer')).toHaveAttribute('inert');
    expect(screen.getByTestId('street-layer')).toContainElement(
      screen.getByTestId('street-touch-zones'),
    );
  });

  it('held sideways, the street is not inert', async () => {
    await playStreet();
    expect(screen.queryByTestId('rotate-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('street-layer')).not.toHaveAttribute('inert');
  });
});
