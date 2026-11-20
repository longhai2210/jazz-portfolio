/**
 * @jest-environment jsdom
 */
// QA tests for T-010, written from the ACs. Every test unmounts (cleanup) so audio is closed and
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
// One `act` around all the taps: each still sets the audio clock and fires keydown and keyup, but
// React renders once at the end instead of after each of ~40 taps (2 s a take). Scoring reads the
// store and the audio clock, not the rendered tree.
function playPlan(plan: TakePlan): void {
  const taps = planTaps(session(), plan);
  act(() => {
    for (const tap of taps) {
      ctx().currentTime = tap.time;
      const code = KEY[tap.button];
      fireEvent.keyDown(window, { code, key: code.slice(3).toLowerCase() });
      fireEvent.keyUp(window, { code, key: code.slice(3).toLowerCase() });
    }
  });
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

describe('T-010 QA', () => {
  it('AC-DUEL-011.1: no difficulty passed shows Lounge, Session and Late Set, Lounge preselected, and each is choosable', async () => {
    await start({ offsetMs: 0 });
    const group = screen.getByRole('radiogroup');
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    for (const radio of radios) {
      fireEvent.click(radio);
      expect(radio).toHaveAttribute('aria-checked', 'true');
      expect(radios.filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    }
    await press('Continue');
    expect(session().config.difficulty).toBe('lateSet');
  });

  it('AC-DUEL-011.1: a passed difficulty skips the difficulty screen', async () => {
    await start({ difficulty: 'lounge', offsetMs: 0 });
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(session().config.difficulty).toBe('lounge');
  });

  it('AC-DUEL-017.1: the passed character, difficulty and offset 0 are used (0 is not treated as missing)', async () => {
    await start({ character: 'sayo', difficulty: 'lateSet', offsetMs: 0 });
    expect(
      screen.queryByRole('heading', { name: 'Tap along to the click' }),
    ).not.toBeInTheDocument();
    expect(session().config).toMatchObject({
      character: 'aki',
      difficulty: 'lateSet',
      offsetMs: 0,
      duel: 1,
    });
  });

  it('AC-DUEL-017.1: the passed offset is kept for both matches (AC-DUEL-002.3)', async () => {
    await start({ character: 'ren', difficulty: 'session', offsetMs: 85 });
    expect(session().config).toMatchObject({ character: 'aki', offsetMs: 85 });
    playPlan({ win: true });
    finishTake();
    await press('On to match 2');
    expect(session().config).toMatchObject({ duel: 2, character: 'sayo', offsetMs: 85 });
  });

  it('AC-DUEL-017.2: startDuel 2 goes straight to match 2, the Solo opens with the best bar then its mirror', async () => {
    await start({ difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar: BEST_BAR });
    expect(screen.getByText('Match 2 of 2')).toBeInTheDocument();
    expect(session().config.duel).toBe(2);
    expect(session().calls.solo[0].notes).toEqual(BEST_BAR);
    expect(session().calls.solo[1].notes.map((n) => [n.step, n.button])).toEqual([
      [0, 3],
      [2, 1],
      [5, 0],
    ]);
  });

  it('AC-DUEL-017.2: startDuel 2 with no best bar builds the whole Shadow Solo from composed phrases', async () => {
    await start({ difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar: null });
    expect(session().calls.solo.map((b) => b.source)).toEqual([
      'composed',
      'composed',
      'composed',
      'composed',
    ]);
  });

  it('AC-DUEL-017.3: a loss in match 2 is reported once, and not again on re-render', async () => {
    const onMatchEnd = jest.fn();
    const view = await start({ difficulty: 'session', offsetMs: 0, startDuel: 2, onMatchEnd });
    finishTake();
    view.rerender(
      <DuelGame difficulty="session" offsetMs={0} startDuel={2} onMatchEnd={onMatchEnd} />,
    );
    advanceTo(clock().t0 + 200);
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
    expect(onMatchEnd).toHaveBeenCalledWith({ duel: 2, stars: 0, won: false, bestBar: null });
  });

  it('AC-DUEL-017.3: a win reports match, stars (at least 1) and its best bar', async () => {
    const onMatchEnd = jest.fn();
    await start({ difficulty: 'session', offsetMs: 0, onMatchEnd });
    playPlan({ win: true, soloBars: [BEST_BAR] });
    finishTake();
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
    const [report] = onMatchEnd.mock.calls[0] as [
      { duel: number; stars: number; won: boolean; bestBar: unknown },
    ];
    expect(report.duel).toBe(1);
    expect(report.won).toBe(true);
    expect(report.stars).toBeGreaterThanOrEqual(1);
    expect(report.bestBar).toEqual(BEST_BAR);
  });

  it('AC-DUEL-013.6: the result shows stars, the three scores and an empty quote list, and Replay restarts the same match', async () => {
    await start({ difficulty: 'session', offsetMs: 0, startDuel: 2 });
    finishTake();
    expect(screen.getByRole('img', { name: '0 of 3 stars' })).toBeInTheDocument();
    for (const t of ['Rhythm', 'Direction', 'Feel', 'None this take.']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
    await press('Replay this take');
    expect(session().config.duel).toBe(2);
    expect(session().status).toBe('playing');
  });

  it('AC-DUEL-013.7: a loss in match 1 or match 2 offers only Replay', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    expect(labels()).toEqual(['Replay this take']);
    cleanup();
    useGameStore.getState().reset();
    await start({ difficulty: 'session', offsetMs: 0, startDuel: 2 });
    finishTake();
    expect(labels()).toEqual(['Replay this take']);
    expect(screen.queryByRole('heading', { name: 'Session complete' })).not.toBeInTheDocument();
  });

  it('AC-DUEL-013.7: the summary offers Back to portfolio, and Play again returns to match 1', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    playPlan({ win: true });
    finishTake();
    await press('On to match 2');
    playPlan({ win: true });
    finishTake();
    await press('See summary');
    expect(screen.getAllByRole('link', { name: 'Back to portfolio' }).length).toBeGreaterThan(0);
    await press('Play again from the start');
    expect(session().config.duel).toBe(1);
  });

  it('AC-DUEL-011.3: no offer after one loss; offer on the second; declining keeps windows and does not re-offer', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();
    await press('Replay this take');
    finishTake();
    expect(screen.getByText('Want a little more room?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();
    await press('Replay this take');
    expect(session().config.assisted).toBe(false);
    finishTake();
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();
    expect(screen.queryByText('Timing windows were widened by 15%.')).not.toBeInTheDocument();
  });

  it('AC-DUEL-011.4: accepted help shows the note on later results, carries into match 2, and Play again clears it', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    await press('Replay this take');
    finishTake();
    fireEvent.click(screen.getByRole('button', { name: 'Widen windows' }));
    await press('Replay this take');
    expect(session().config.assisted).toBe(true);
    playPlan({ win: true });
    finishTake();
    expect(screen.getByText('Timing windows were widened by 15%.')).toBeInTheDocument();
    await press('On to match 2');
    expect(session().config.assisted).toBe(true);
    playPlan({ win: true });
    finishTake();
    expect(screen.getByText('Timing windows were widened by 15%.')).toBeInTheDocument();
    await press('See summary');
    await press('Play again from the start');
    expect(session().config.assisted).toBe(false);
  });

  it('AC-DUEL-014.1: a hidden tab pauses once; keys while paused add no tap; showing the tab does not resume', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    visibility('hidden');
    visibility('hidden');
    expect(calls('suspend')).toBe(1);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    const before = JSON.stringify(session().turns);
    ctx().currentTime = 5;
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    expect(JSON.stringify(session().turns)).toBe(before);
    visibility('visible');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
  });

  it('AC-DUEL-014.1: Esc during the opening count-in pauses and suspends', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    advanceTo(clock().t0 + 0.1);
    esc();
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(calls('suspend')).toBe(1);
  });

  it('AC-DUEL-014.1: the pause button suspends, and Resume restarts through a count-in', async () => {
    await start({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(calls('suspend')).toBe(1);
    await press('Resume');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('count-in')).toBeInTheDocument();
  });

  it('AC-DUEL-014.3: Back to portfolio from the pause overlay closes the context once and goes to the locale home', async () => {
    setFakeLocale('vi');
    await start({ difficulty: 'session', offsetMs: 0 }, 'Chơi');
    advanceTo(4);
    esc();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('link', { name: 'Về trang chủ' }));
    expect(calls('close')).toBe(1);
    expect(navigations).toEqual(['/vi']);
  });

  it('AC-DUEL-014.3: unmounting while paused closes the context once and leaves no timers', async () => {
    const view = await start({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    esc();
    view.unmount();
    expect(calls('close')).toBe(1);
    expect(liveIntervals.size).toBe(0);
  });

  it('AC-DUEL-013.9: every screen of the flow has a home link to the locale in use', async () => {
    setFakeLocale('vi');
    const view = render(<DuelGame />);
    const home = () => {
      const links = screen.getAllByRole('link', { name: 'Về trang chủ' });
      expect(links.length).toBeGreaterThan(0);
      links.forEach((l) => expect(l).toHaveAttribute('href', '/vi'));
    };
    home();
    await press('Chơi');
    home();
    await press('Tiếp tục');
    home();
    advanceTo(7);
    home();
    await press('Tiếp tục không hiệu chỉnh');
    home();
    finishTake();
    home();
    view.unmount();
  });

  it('AC-DUEL-013.2: when the AudioContext constructor throws, an alert with a way home shows', async () => {
    const fake = createFakeAudioScope({ throwOnCreate: true });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: fake.scope.AudioContext,
    });
    render(<DuelGame />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await settle();
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('link', { name: 'Back to portfolio' })).toHaveAttribute(
      'href',
      '/en',
    );
  });

  it('AC-DUEL-013.2: with no Web Audio the unsupported alert shows and no context is created', async () => {
    Reflect.deleteProperty(window, 'AudioContext');
    render(<DuelGame />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await settle();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(contexts).toHaveLength(0);
  });
});
