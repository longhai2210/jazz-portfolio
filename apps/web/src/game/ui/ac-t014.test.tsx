/**
 * @jest-environment jsdom
 */
// QA tests for T-014, written from the ACs. Every test unmounts (cleanup) so audio is closed and
// no scheduler timer leaks.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  createFakeAudioScope,
  type FakeAudioContext,
} from '../audio/testing/fake-audio-context';
import type { BeatClock } from '../core/clock';
import type { SessionState } from '../core/session';
import type { Button } from '../core/types';
import { useGameStore } from '@/stores/gameStore';
import DuelGame, { type DuelGameProps } from './DuelGame';
import { installPointerEvent } from './lanes/testing/pointer-event';
import { BEST_BAR, planTaps, type TakePlan } from './screens/testing/duel-results';
import { setFakeLocale } from './screens/testing/intl';
import { navigations } from './screens/testing/link';

jest.mock(
  'next-intl',
  () =>
    jest.requireActual<typeof import('./screens/testing/intl')>('./screens/testing/intl')
      .nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./screens/testing/link')>('./screens/testing/link'),
);

const KEY: Readonly<Record<Button, string>> = { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' };

let contexts: FakeAudioContext[] = [];
let restorePointer: () => void = () => undefined;

function ctx(): FakeAudioContext {
  const c = contexts[contexts.length - 1];
  if (c === undefined) throw new Error('no AudioContext');
  return c;
}
const calls = (name: 'resume' | 'suspend' | 'close') =>
  ctx().calls.filter((c) => c === name).length;
function session(): SessionState {
  const s = useGameStore.getState().session;
  if (s === null) throw new Error('no session');
  return s;
}
function clock(): BeatClock {
  const c = session().clock;
  if (c === null) throw new Error('no clock');
  return c;
}
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await settle();
}
async function start(props: DuelGameProps = {}, play = 'Play') {
  const view = render(<DuelGame {...props} />);
  await press(play);
  return view;
}
function advanceTo(time: number): void {
  ctx().currentTime = time;
  act(() => {
    jest.advanceTimersByTime(17);
  });
}
function playPlan(plan: TakePlan): void {
  for (const tap of planTaps(session(), plan)) {
    ctx().currentTime = tap.time;
    const code = KEY[tap.button];
    fireEvent.keyDown(window, { code, key: code.slice(3).toLowerCase() });
    fireEvent.keyUp(window, { code, key: code.slice(3).toLowerCase() });
  }
}
const finishTake = () => advanceTo(clock().t0 + 100);
const esc = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
function visibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  fireEvent(document, new Event('visibilitychange'));
}
const labels = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => t !== '');

let liveIntervals = new Set<unknown>();

beforeEach(() => {
  jest.useFakeTimers();
  // Track every setInterval (the audio scheduler's tick) until it is cleared.
  liveIntervals = new Set();
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  jest.spyOn(globalThis, 'setInterval').mockImplementation(((...args: Parameters<typeof realSet>) => {
    const id = realSet(...args);
    liveIntervals.add(id);
    return id;
  }) as typeof setInterval);
  jest.spyOn(globalThis, 'clearInterval').mockImplementation(((id: Parameters<typeof realClear>[0]) => {
    liveIntervals.delete(id);
    realClear(id);
  }) as typeof clearInterval);
  const fake = createFakeAudioScope();
  contexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
  restorePointer = installPointerEvent();
});

afterEach(() => {
  cleanup();
  // Unmount closed the audio: no scheduler interval may survive, and every context is closed.
  expect(liveIntervals.size).toBe(0);
  for (const context of contexts) expect(context.calls).toContain('close');
  jest.restoreAllMocks();
  jest.clearAllTimers();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  Reflect.deleteProperty(document, 'visibilityState');
  restorePointer();
  jest.useRealTimers();
});

/** Makes the next `resume()` on the live context wait until the returned function is called. */
function holdResume(): () => void {
  const c = ctx();
  let release: () => void = () => undefined;
  c.resume = () => {
    c.calls.push('resume');
    return new Promise<void>((resolve) => {
      release = () => {
        c.state = 'running';
        resolve();
      };
    });
  };
  return () => release();
}

async function pauseAndStartHeldResume() {
  await start({ difficulty: 'session', offsetMs: 0 });
  advanceTo(4);
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  const release = holdResume();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await settle();
  return release;
}

describe('T-014 QA', () => {
  it('AC-DUEL-014.1: tab hidden while Resume waits on the audio: the duel stays paused and the audio is suspended', async () => {
    const release = await pauseAndStartHeldResume();
    const suspendsBefore = calls('suspend');
    visibility('hidden');
    release();
    await settle();
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.queryByTestId('count-in')).not.toBeInTheDocument();
    expect(ctx().state).toBe('suspended');
    expect(calls('suspend')).toBeGreaterThan(suspendsBefore);
  });

  it('AC-DUEL-014.1: tab hidden and shown again before the audio wakes still leaves the duel paused', async () => {
    const release = await pauseAndStartHeldResume();
    visibility('hidden');
    visibility('visible');
    release();
    await settle();
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(ctx().state).toBe('suspended');
  });

  it('AC-DUEL-014.1: Resume while the tab is already hidden stays paused and suspended', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    visibility('hidden');
    await press('Resume');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(ctx().state).toBe('suspended');
  });

  it('AC-DUEL-014.1: with the tab visible the held Resume completes into a count-in', async () => {
    const release = await pauseAndStartHeldResume();
    release();
    await settle();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('count-in')).toBeInTheDocument();
    expect(ctx().state).toBe('running');
  });

  it('AC-DUEL-014.1: after an interrupted resume, the player can resume again and play on', async () => {
    const release = await pauseAndStartHeldResume();
    visibility('hidden');
    release();
    await settle();
    visibility('visible');
    const releaseAgain = holdResume();
    await press('Resume');
    releaseAgain();
    await settle();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('count-in')).toBeInTheDocument();
    expect(ctx().state).toBe('running');
  });
});

