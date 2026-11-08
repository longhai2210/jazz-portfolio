/**
 * @jest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  FakeGainNode,
  createFakeAudioScope,
  isRoutedTo,
  type FakeAudioContext,
} from '../audio/testing/fake-audio-context';
import { stepTime, type BeatClock } from '../core/clock';
import { turnLayout, turnTargets, type SessionState } from '../core/session';
import type { Button } from '../core/types';
import { useGameStore } from '@/stores/gameStore';
import DuelGame, { type DuelGameProps } from './DuelGame';
import { installPointerEvent } from './lanes/testing/pointer-event';
import { BEST_BAR, DUCK_BAR, planTaps, type TakePlan } from './screens/testing/duel-results';
import { setFakeLocale } from './screens/testing/intl';
import { navigations } from './screens/testing/link';
import { PORTRAIT_PHONE_QUERY } from './screens/use-media-query';

jest.mock(
  'next-intl',
  () =>
    jest.requireActual<typeof import('./screens/testing/intl')>('./screens/testing/intl')
      .nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./screens/testing/link')>('./screens/testing/link'),
);

const KEY_CODES: Readonly<Record<Button, string>> = { 0: 'KeyD', 1: 'KeyF', 2: 'KeyJ', 3: 'KeyK' };

let contexts: FakeAudioContext[] = [];
let restorePointerEvent: () => void = () => undefined;
let restoreMedia: () => void = () => undefined;

/** Installs a recording fake as the browser's `AudioContext`. */
function installAudio(): void {
  const fake = createFakeAudioScope();
  contexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
}

function audioContext(): FakeAudioContext {
  const context = contexts[contexts.length - 1];
  if (context === undefined) throw new Error('no AudioContext was created');
  return context;
}

function callCount(name: 'resume' | 'suspend' | 'close'): number {
  return audioContext().calls.filter((call) => call === name).length;
}

function session(): SessionState {
  const current = useGameStore.getState().session;
  if (current === null) throw new Error('no session in the store');
  return current;
}

function clock(): BeatClock {
  const current = session().clock;
  if (current === null) throw new Error('the take has not started');
  return current;
}

/** Lets the audio unlock, a resume and React settle. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await settle();
}

async function renderAndPlay(props: DuelGameProps = {}, play = 'Play') {
  const view = render(<DuelGame {...props} />);
  await press(play);
  return view;
}

/** Moves the audio clock to `time` and lets one animation frame run. */
function advanceTo(time: number): void {
  audioContext().currentTime = time;
  act(() => {
    jest.advanceTimersByTime(17);
  });
}

/** Presses the key of `button` when the audio clock reads `time`. */
function tapAt(time: number, button: Button): void {
  audioContext().currentTime = time;
  const code = KEY_CODES[button];
  const key = code.slice(3).toLowerCase();
  fireEvent.keyDown(window, { code, key });
  fireEvent.keyUp(window, { code, key });
}

function playPlan(plan: TakePlan): void {
  for (const tap of planTaps(session(), plan)) tapAt(tap.time, tap.button);
}

/** Moves the clock past the last bar: the take ends with the taps it has. */
function finishTake(): void {
  advanceTo(clock().t0 + 100);
}

function pressEscape(): void {
  fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  fireEvent(document, new Event('visibilitychange'));
}

/** A `matchMedia` stub whose answers can change, notifying the listeners like a real one. */
function stubMedia(initial: (query: string) => boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matches(query),
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  restoreMedia = () => Reflect.deleteProperty(window, 'matchMedia');
  return {
    set(next: (query: string) => boolean) {
      matches = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

function expectHomeLinks(name: string, href: string): void {
  const links = screen.getAllByRole('link', { name });
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toHaveAttribute('href', href);
}

function buttonNames(): string[] {
  return screen
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((name) => name !== '');
}

beforeEach(() => {
  jest.useFakeTimers();
  installAudio();
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  Reflect.deleteProperty(document, 'visibilityState');
  restorePointerEvent();
  restoreMedia();
  restoreMedia = () => undefined;
  jest.useRealTimers();
});

describe('DuelGame', () => {
  it('AC-DUEL-011.1: with no difficulty passed in, Play opens the difficulty screen: Lounge selected, all three choosable', async () => {
    await renderAndPlay();

    const group = screen.getByRole('radiogroup', { name: 'Choose your difficulty' });
    const lounge = within(group).getByRole('radio', { name: /^Lounge/ });
    const session_ = within(group).getByRole('radio', { name: /^Session/ });
    const lateSet = within(group).getByRole('radio', { name: /^Late Set/ });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(lounge).toHaveAttribute('aria-checked', 'true');
    expect(session_).toHaveAttribute('aria-checked', 'false');
    expect(lateSet).toHaveAttribute('aria-checked', 'false');
    expect(lounge).toHaveTextContent('Timing x1.4');

    fireEvent.click(session_);
    expect(session_).toHaveAttribute('aria-checked', 'true');
    expect(lounge).toHaveAttribute('aria-checked', 'false');

    // Arrow keys move the choice and the focus, wrapping around.
    fireEvent.keyDown(session_, { key: 'ArrowRight' });
    expect(lateSet).toHaveAttribute('aria-checked', 'true');
    expect(lateSet).toHaveFocus();
    fireEvent.keyDown(lateSet, { key: 'ArrowDown' });
    expect(lounge).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(lounge, { key: 'ArrowLeft' });
    expect(lateSet).toHaveAttribute('aria-checked', 'true');

    // Continue goes to calibration; without a valid tap, the take plays Late Set with offset 0.
    await press('Continue');
    expect(screen.getByRole('heading', { name: 'Tap along to the click' })).toBeInTheDocument();
    advanceTo(7);
    expect(screen.getByRole('heading', { name: 'We could not measure the delay' })).toBeInTheDocument();
    await press('Continue without it');

    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(session().config).toMatchObject({ difficulty: 'lateSet', offsetMs: 0 });
    expect(screen.getByText('Late Set')).toBeInTheDocument();
  });

  it('AC-DUEL-011.1: Continue with the default keeps Lounge', async () => {
    await renderAndPlay({ offsetMs: 0 });
    await press('Continue');
    expect(session().config.difficulty).toBe('lounge');
  });

  it('AC-DUEL-017.1: with a character, difficulty and offset passed in, Play skips both steps and uses those values', async () => {
    await renderAndPlay({ character: 'aki', difficulty: 'session', offsetMs: 120 });

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tap along to the click' })).not.toBeInTheDocument();
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    // Aki's first opponent is the Shadow of Sayo (AC-DUEL-012.1).
    expect(session().config).toMatchObject({
      character: 'sayo',
      difficulty: 'session',
      offsetMs: 120,
      duel: 1,
    });
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('84 BPM')).toBeInTheDocument();

    advanceTo(stepTime(clock(), 1, 1));
    expect(screen.getByTestId('hud-who')).toHaveTextContent('Sayo plays');

    // 120 ms late on the audio clock is on time with that offset: Perfect, not OK.
    const [target] = turnTargets(session(), 'echo');
    tapAt(stepTime(clock(), target.bar, target.step) + 0.12, target.button);
    expect(screen.getByTestId('duel-feedback')).toHaveTextContent('Perfect');
  });

  it('AC-DUEL-017.1: with no offset, the calibration step measures one from pad, key and Space taps', async () => {
    await renderAndPlay({ difficulty: 'session' });
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tap along to the click' })).toBeInTheDocument();

    // 8 clicks at 90 BPM from 1 s; every tap lands 50 ms after its click.
    const click = (index: number) => 1 + (index * 60) / 90;
    const pad = screen.getByRole('button', { name: 'Tap' });
    const inputs: (() => void)[] = [
      () => fireEvent.pointerDown(pad, { button: 0 }),
      () => fireEvent.keyDown(window, { code: 'Space', key: ' ' }),
      () => fireEvent.keyDown(window, { code: 'KeyD', key: 'd' }),
      () => fireEvent.keyDown(window, { code: 'KeyF', key: 'f' }),
      () => fireEvent.keyDown(window, { code: 'KeyJ', key: 'j' }),
      () => fireEvent.keyDown(window, { code: 'KeyK', key: 'k' }),
      () => fireEvent.keyDown(window, { code: 'Space', key: ' ' }),
      () => fireEvent.pointerDown(pad, { button: 0 }),
    ];
    inputs.forEach((input, index) => {
      advanceTo(click(index) + 0.05);
      input();
    });
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '8');
    expect(progress).toHaveAttribute('aria-valuetext', '8 of 8');

    advanceTo(7);
    expect(screen.getByRole('heading', { name: 'Delay set to 50 ms' })).toBeInTheDocument();
    await press('Start match 1');
    expect(session().config.offsetMs).toBeCloseTo(50, 6);
  });

  it('AC-DUEL-017.2: started at match 2 with the match-1 best bar, Play goes straight to match 2 and the Shadow Solo opens with it', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar: BEST_BAR });

    expect(screen.getByText('Match 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('96 BPM')).toBeInTheDocument();
    expect(session().config).toMatchObject({ duel: 2, character: 'sayo' });
    expect(session().calls.solo.map((bar) => bar.source)).toEqual([
      'player',
      'player',
      'composed',
      'composed',
    ]);
    expect(session().calls.solo[0].notes).toEqual(BEST_BAR);

    advanceTo(stepTime(clock(), turnLayout('solo').opponentBars[0], 1));
    expect(screen.getByTestId('hud-who')).toHaveTextContent('Sayo plays');
    expect(screen.getByText('Your phrase')).toHaveAttribute('data-bars', '1 2');
  });

  it('AC-DUEL-017.3: when a take ends, the game reports the match, stars, win and best bar', async () => {
    const onMatchEnd = jest.fn();
    await renderAndPlay({ difficulty: 'session', offsetMs: 0, onMatchEnd });

    playPlan({ win: true, soloBars: [BEST_BAR] });
    finishTake();
    expect(onMatchEnd).toHaveBeenCalledTimes(1);
    expect(onMatchEnd).toHaveBeenLastCalledWith({
      duel: 1,
      stars: 3,
      won: true,
      bestBar: BEST_BAR,
    });

    await press('Replay this take');
    finishTake();
    expect(onMatchEnd).toHaveBeenCalledTimes(2);
    expect(onMatchEnd).toHaveBeenLastCalledWith({ duel: 1, stars: 0, won: false, bestBar: null });
  });

  it('AC-DUEL-013.6: the result shows the stars, Rhythm, Direction, Feel and quoted licks, and "Replay this take" plays that match again', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    playPlan({ win: true, soloBars: [BEST_BAR, DUCK_BAR, DUCK_BAR] });
    finishTake();

    const result = useGameStore.getState().campaign?.lastResult;
    expect(result?.quotes).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Aki is back in the band' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: `${result?.score.stars} of 3 stars` })).toBeInTheDocument();
    expect(screen.getByText('Rhythm')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Feel')).toBeInTheDocument();
    expect(screen.getByText('Duck x2')).toBeInTheDocument();

    const finished = session();
    await press('Replay this take');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(session()).not.toBe(finished);
    expect(session().config).toEqual(finished.config);
    expect(session().status).toBe('playing');
    expect(session().turns).toEqual({});
  });

  it('AC-DUEL-013.7: a match 1 win leads on to match 2, a match 2 win to the summary, and the summary back to match 1', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    playPlan({ win: true, soloBars: [BEST_BAR] });
    finishTake();
    expect(buttonNames()).toEqual(['On to match 2', 'Replay this take']);

    await press('On to match 2');
    expect(screen.getByText('Match 2 of 2')).toBeInTheDocument();
    expect(session().calls.solo[0]).toEqual({ source: 'player', notes: BEST_BAR });
    playPlan({ win: true });
    finishTake();
    expect(screen.getByRole('heading', { name: 'Sayo is back in the band' })).toBeInTheDocument();
    expect(buttonNames()).toEqual(['See summary', 'Replay this take']);

    await press('See summary');
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByText('Match 1 · Aki')).toBeInTheDocument();
    expect(screen.getByText('Match 2 · Sayo')).toBeInTheDocument();

    await press('Play again from the start');
    expect(screen.getByText('Match 1 of 2')).toBeInTheDocument();
    expect(session().config).toMatchObject({ duel: 1, difficulty: 'session', offsetMs: 0 });
  });

  it('AC-DUEL-013.7: a loss offers only "Replay this take"', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    expect(screen.getByRole('heading', { name: 'Not this take' })).toBeInTheDocument();
    expect(buttonNames()).toEqual(['Replay this take']);
  });

  it('AC-DUEL-011.3: the second loss in a row offers wider windows, and "No thanks" keeps them as they are', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();

    await press('Replay this take');
    finishTake();
    const offer = screen.getByRole('group', { name: 'Want a little more room?' });
    fireEvent.click(within(offer).getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();

    await press('Replay this take');
    expect(session().config.assisted).toBe(false);
    finishTake();
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('AC-DUEL-011.4: after "Widen windows", later takes are played wider and their results say so', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    finishTake();
    await press('Replay this take');
    finishTake();
    fireEvent.click(screen.getByRole('button', { name: 'Widen windows' }));
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();

    await press('Replay this take');
    expect(session().config.assisted).toBe(true);
    finishTake();
    expect(screen.getByRole('note')).toHaveTextContent('Timing windows were widened by 15%.');
  });

  it('AC-DUEL-014.1: a hidden tab stops the match and suspends the AudioContext', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    expect(callCount('suspend')).toBe(0);

    setVisibility('hidden');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(callCount('suspend')).toBe(1);
    expect(session().status).toBe('paused');

    // Time going by moves nothing, and showing the tab again keeps the pause.
    advanceTo(500);
    setVisibility('visible');
    expect(session().status).toBe('paused');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
  });

  it('AC-DUEL-014.1: the pause button stops the match and suspends the AudioContext', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(callCount('suspend')).toBe(1);
    expect(session().status).toBe('paused');
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
  });

  it('AC-DUEL-014.1: Esc stops the match and suspends the AudioContext; Esc again resumes through a count-in bar', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    expect(screen.getByTestId('hud-who')).toHaveTextContent('Aki plays');

    pressEscape();
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(callCount('suspend')).toBe(1);
    expect(session().status).toBe('paused');

    pressEscape();
    await settle();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callCount('resume')).toBe(2);
    expect(session().status).toBe('playing');
    expect(screen.getByTestId('count-in')).toHaveTextContent('Round 1 of 3 · Echo restarts');
  });

  it('AC-DUEL-014.3: "Back to portfolio" while paused closes the AudioContext and leaves the page', async () => {
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    advanceTo(4);
    pressEscape();

    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    fireEvent.click(within(dialog).getByRole('link', { name: 'Back to portfolio' }));

    expect(callCount('close')).toBe(1);
    expect(audioContext().state).toBe('closed');
    expect(navigations).toEqual(['/en']);
  });

  it('AC-DUEL-014.3: unmounting the game, whatever the route, closes the AudioContext', async () => {
    const { unmount } = await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    unmount();
    expect(callCount('close')).toBe(1);
    expect(useGameStore.getState().screen).toBe('start');
  });

  it('AC-DUEL-013.9: start, difficulty, calibration, duel, pause and result screens lead home in the language in use', async () => {
    setFakeLocale('vi');
    render(<DuelGame />);
    expectHomeLinks('Về trang chủ', '/vi');

    await press('Chơi');
    expect(screen.getByRole('radiogroup', { name: 'Chọn độ khó' })).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');

    await press('Tiếp tục');
    expect(screen.getByRole('heading', { name: 'Gõ theo tiếng click' })).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');
    advanceTo(7);
    expectHomeLinks('Về trang chủ', '/vi');

    await press('Tiếp tục không hiệu chỉnh');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');

    advanceTo(4);
    pressEscape();
    const dialog = screen.getByRole('dialog', { name: 'Đang tạm dừng' });
    expect(within(dialog).getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/vi');
    pressEscape();
    await settle();

    finishTake();
    expect(screen.getByRole('heading', { name: 'Take này chưa được' })).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');
  });

  it('AC-DUEL-013.9: the summary leads home in the language in use', async () => {
    setFakeLocale('vi');
    await renderAndPlay(
      { difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar: BEST_BAR },
      'Chơi',
    );
    playPlan({ win: true });
    finishTake();
    await press('Xem tổng kết');
    expect(screen.getByRole('heading', { name: 'Hoàn thành phiên' })).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');
  });

  it('AC-DUEL-013.9: the rotate hint on an upright phone leads home in the language in use', async () => {
    setFakeLocale('vi');
    stubMedia((query) => query === PORTRAIT_PHONE_QUERY);
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 }, 'Chơi');
    expect(screen.getByText('Xoay ngang điện thoại để chơi')).toBeInTheDocument();
    expectHomeLinks('Về trang chủ', '/vi');
  });

  it('AC-DUEL-013.2: without Web Audio, Play shows the cannot-play message and the way back, never a blank screen', async () => {
    Reflect.deleteProperty(window, 'AudioContext');
    await renderAndPlay();

    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'This browser cannot play the game' }),
    ).toBeInTheDocument();
    expect(within(alert).getByText(/needs Web Audio/)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Back to portfolio' })).toHaveAttribute(
      'href',
      '/en',
    );
    expect(contexts).toHaveLength(0);
  });

  it('keeps Play on screen and retries the same context when the browser blocks the unlock', async () => {
    const fake = createFakeAudioScope({
      setup: (context) => {
        context.resumeBehaviour = 'stay';
      },
    });
    contexts = fake.contexts;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: fake.scope.AudioContext,
    });
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();

    audioContext().resumeBehaviour = 'run';
    await press('Play');
    expect(contexts).toHaveLength(1);
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
  });

  it('plays a quote whose bar check comes after the downbeat at once, instead of dropping it', async () => {
    // With a 250 ms offset the Solo bar closes after the next downbeat has gone by.
    await renderAndPlay({ difficulty: 'session', offsetMs: 250 });
    playPlan({ soloBars: [DUCK_BAR] });
    const downbeat = stepTime(clock(), turnLayout('solo').playerBars[1], 0);
    const late = downbeat + 0.1;
    advanceTo(late);

    expect(screen.getByTestId('duel-feedback')).toHaveTextContent('Quote: Duck!');
    expect(screen.getByTestId('lick-book').querySelector('[data-lick="duck"]')).toHaveAttribute(
      'data-lit',
      'true',
    );
    const sfx = audioContext().nodes.filter((node) => node instanceof FakeGainNode)[3];
    const lickSources = audioContext()
      .audibleSources()
      .filter((source) => isRoutedTo(source, sfx));
    expect(lickSources.length).toBeGreaterThan(0);
    // The sound starts now (its later sources are the rest of the quack), not at the past downbeat.
    const starts = lickSources.map((source) => source.startTime ?? Number.NaN);
    expect(Math.min(...starts)).toBeCloseTo(late, 6);
  });

  it('holds a match on an upright phone, starts it once turned sideways, and pauses when turned back', async () => {
    const media = stubMedia((query) => query === PORTRAIT_PHONE_QUERY);
    await renderAndPlay({ difficulty: 'session', offsetMs: 0 });
    expect(screen.getByTestId('rotate-hint')).toBeInTheDocument();
    expect(session().status).toBe('ready');

    media.set(() => false);
    expect(session().status).toBe('playing');
    advanceTo(4);

    media.set((query) => query === PORTRAIT_PHONE_QUERY);
    expect(session().status).toBe('paused');
    expect(callCount('suspend')).toBe(1);
    expect(screen.getByTestId('rotate-hint')).toBeInTheDocument();

    media.set(() => false);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
  });

  it('turns every transition in the game off when reduced motion is asked for', () => {
    const { container } = render(<DuelGame />);
    const root = container.querySelector('[data-duel-game]');
    expect(root).not.toBeNull();
    const css = root?.querySelector('style')?.textContent ?? '';
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('[data-duel-game] *{transition:none!important');
  });
});
