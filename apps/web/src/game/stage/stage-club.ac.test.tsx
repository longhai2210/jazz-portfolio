/**
 * @jest-environment jsdom
 */
// Tester's tests for T-022 (game-stage REQ-STAGE-005), StageGame level, from the ACs and the
// Done when items of the task. The 3D scenes are stand-ins that record their props.
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

const LEAVE = 'Leave the club';
const realTimers = jest.requireActual<typeof import('timers')>('timers');

interface Scenes {
  readonly street: FakeStreetScene;
  readonly load: () => Promise<StreetSceneModule>;
  club(): ClubSceneProps;
  clubMounted(): boolean;
}

function createScenes(): Scenes {
  const street = createFakeStreetScene();
  let latest: ClubSceneProps | null = null;
  let live = 0;
  function FakeClub(props: ClubSceneProps) {
    latest = props;
    useEffect(() => {
      live += 1;
      return () => {
        live -= 1;
      };
    }, []);
    return <div role="img" aria-label={props.label} />;
  }
  return {
    street,
    load: async () => ({ ...(await street.load()), ClubScene: FakeClub }),
    club() {
      if (latest === null) throw new Error('club never rendered');
      return latest;
    },
    clubMounted: () => live > 0,
  };
}

let webgl: InstalledWebGL2 | null = null;
let contexts: FakeAudioContext[] = [];
let restorePointerEvent: () => void = () => undefined;
let infoSpy: jest.SpyInstance;

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
  const fake = createFakeAudioScope();
  contexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
  webgl = installWebGL2(true);
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: createFakeAssetServer().fetch,
  });
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
});

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  });
  await new Promise<void>((resolve) => realTimers.setImmediate(resolve));
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function playStreet(): Promise<Scenes> {
  const scenes = createScenes();
  render(<StageGame loadScene={scenes.load} />);
  await settle();
  act(() => scenes.street.props().onReady());
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await settle();
  return scenes;
}

async function openClub(): Promise<Scenes> {
  const scenes = await playStreet();
  act(() => scenes.street.props().onNearDoorChange(true));
  fireEvent.click(screen.getByRole('button', { name: 'Enter the club' }));
  await settle();
  return scenes;
}

function startRun(): void {
  act(() =>
    useGameStore.getState().startRun({ player: 'sayo', difficulty: 'lounge', offsetMs: 0 }),
  );
}

function finishTake(win: boolean): void {
  const campaign = useGameStore.getState().campaign;
  if (campaign === null) throw new Error('no run');
  const result = playTake(createDuelSession(campaign), { win });
  act(() => useGameStore.getState().finishMatch(result));
}

async function leaveClub(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: LEAVE }));
  await settle();
}

describe('AC-STAGE-005.1: entering the club', () => {
  it('AC-STAGE-005.1: the duel runs as Sayo, with the Shadows of REQ-DUEL-012, on one AudioContext and with no second Play', async () => {
    const scenes = await openClub();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(scenes.clubMounted()).toBe(true);
    expect(contexts).toHaveLength(1);
    expect(scenes.club().audio?.context).toBe(contexts[0]);

    startRun();
    const { campaign, session } = useGameStore.getState();
    expect(campaign?.player).toBe('sayo');
    expect(session?.config.character).toBe('aki');
  });

  it('AC-STAGE-005.1: after the take, a second visit also starts as Sayo with no second Play or context', async () => {
    const scenes = await openClub();
    startRun();
    finishTake(false);
    await leaveClub();
    act(() => scenes.street.props().onNearDoorChange(true));
    fireEvent.click(screen.getByRole('button', { name: 'Enter the club' }));
    await settle();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(contexts).toHaveLength(1);
  });

  it('a WebGL context lost after Play on the street skips the DuelGame Start and reuses the audio', async () => {
    const scenes = await playStreet();
    act(() => scenes.street.props().onFallback('noWebgl'));
    await settle();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(contexts).toHaveLength(1);
    // No backdrop, so no street to leave to.
    expect(screen.queryByRole('button', { name: LEAVE })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('AC-STAGE-005.3: the Shadow after a win', () => {
  it('AC-STAGE-005.3: a win fades the Shadow while the result shows at once, a loss does not', async () => {
    const scenes = await openClub();
    startRun();
    expect(scenes.club().shadowFaded).toBe(false);
    finishTake(false);
    expect(scenes.club().shadowFaded).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Replay this take' }));
    await settle();
    finishTake(true);
    expect(screen.getByRole('button', { name: 'On to match 2' })).toBeInTheDocument();
    expect(scenes.club().shadowFaded).toBe(true);
  });

  it('AC-STAGE-005.3: the Shadow is back at full strength in the next match', async () => {
    const scenes = await openClub();
    startRun();
    finishTake(true);
    fireEvent.click(screen.getByRole('button', { name: 'On to match 2' }));
    await settle();
    expect(scenes.club().shadowFaded).toBe(false);
  });
});

describe('AC-STAGE-005.4: back on the street', () => {
  it('AC-STAGE-005.4: leaving after a loss puts the player at the door, lights off, same audio', async () => {
    const scenes = await openClub();
    startRun();
    finishTake(false);
    await leaveClub();
    expect(scenes.clubMounted()).toBe(false);
    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(false);
    expect(scenes.street.props().audio?.context).toBe(contexts[0]);
    expect(contexts).toHaveLength(1);
  });

  it('AC-STAGE-005.4: leaving after a win lights the street', async () => {
    const scenes = await openClub();
    startRun();
    finishTake(true);
    await leaveClub();
    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(true);
  });

  it('AC-STAGE-005.4: leaving from the summary works and lights the street after wins', async () => {
    const scenes = await openClub();
    startRun();
    finishTake(true);
    fireEvent.click(screen.getByRole('button', { name: 'On to match 2' }));
    await settle();
    finishTake(true);
    fireEvent.click(screen.getByRole('button', { name: 'See summary' }));
    await settle();
    await leaveClub();
    expect(scenes.street.props().startAt).toBe('door');
    expect(scenes.street.props().lightsOn).toBe(true);
  });

  it('Leave the club is only in the result and summary, never in setup or during the take', async () => {
    await openClub();
    expect(screen.queryByRole('button', { name: LEAVE })).not.toBeInTheDocument();
    startRun();
    expect(screen.queryByRole('button', { name: LEAVE })).not.toBeInTheDocument();
    finishTake(false);
    expect(screen.getAllByRole('button', { name: LEAVE })).toHaveLength(1);
  });
});

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

describe('the street under the rotate hint', () => {
  it('is inert while a phone is held upright, with its controls out of reach', async () => {
    stubMedia((query) => query.includes('orientation: portrait'));
    await playStreet();
    expect(screen.getByTestId('rotate-hint')).toBeInTheDocument();
    const layer = screen.getByTestId('street-layer');
    expect(layer).toHaveAttribute('inert');
    expect(layer.querySelector('[data-testid="street-touch-zones"]')).not.toBeNull();
    // Every interactive element of the street sits inside the inert layer.
    const outside = Array.from(document.querySelectorAll('button')).filter(
      (b) => !layer.contains(b) && b.closest('[data-testid="rotate-hint"]') === null,
    );
    expect(outside.map((b) => b.textContent)).not.toContain('Play');
  });

  it('is not inert when held sideways, and there is no rotate hint', async () => {
    stubMedia((query) => !query.includes('orientation: portrait'));
    await playStreet();
    expect(screen.queryByTestId('rotate-hint')).not.toBeInTheDocument();
    expect(screen.getByTestId('street-layer')).not.toHaveAttribute('inert');
  });
});
