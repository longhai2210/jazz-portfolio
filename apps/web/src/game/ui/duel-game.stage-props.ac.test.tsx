/**
 * @jest-environment jsdom
 */
// Tester's tests for T-022 (game-stage), DuelGame level, from the ACs and the Done when items of
// the task: the note under the top bar, the extra action only on result and summary, the audio
// that skips Start, and no new props meaning the screens as before.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createGameAudio, type GameAudio } from '../audio';
import {
  createFakeAudioScope,
  createManualTimer,
  FakeAudioContext,
} from '../audio/testing/fake-audio-context';
import { createDuelSession } from '../core/campaign';
import { useGameStore } from '@/stores/gameStore';
import DuelGame from './DuelGame';
import { installPointerEvent } from './lanes/testing/pointer-event';
import { playTake } from './screens/testing/duel-results';
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

let restorePointerEvent: () => void = () => undefined;
let contexts: FakeAudioContext[] = [];

beforeEach(() => {
  restorePointerEvent = installPointerEvent();
  const fake = createFakeAudioScope();
  contexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
});

afterEach(() => {
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  Reflect.deleteProperty(window, 'matchMedia');
  restorePointerEvent();
});

function unlockedAudio(): GameAudio {
  const context = new FakeAudioContext();
  context.state = 'suspended';
  return createGameAudio(context, { timer: createManualTimer() });
}

const NOTE = <p data-testid="the-note">Plain grey-box match</p>;
const EXTRA = <button type="button">Leave the club</button>;

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

describe('AC-STAGE-005.1: DuelGame with the audio of the street', () => {
  it('AC-STAGE-005.1: with an unlocked audio there is no Start screen and the game opens on the difficulty step', () => {
    render(<DuelGame character="sayo" audio={unlockedAudio()} />);
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
  });

  it('AC-STAGE-005.1: the passed audio is reused, no second AudioContext is made', () => {
    render(<DuelGame character="sayo" audio={unlockedAudio()} />);
    expect(contexts).toHaveLength(0);
  });

  it('AC-STAGE-005.1: the caller owns the audio, so unmounting does not close it', () => {
    const audio = unlockedAudio();
    const view = render(<DuelGame character="sayo" audio={audio} />);
    view.unmount();
    expect(audio.context.state).not.toBe('closed');
  });

  it('AC-STAGE-005.1: with no audio prop the Start screen and its Play button are as before', () => {
    render(<DuelGame />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});

describe('DuelGame with no stage props renders as before', () => {
  it('has no note slot, no backdrop, no extra action on any screen', () => {
    render(<DuelGame />);
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('duel-backdrop')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave the club' })).not.toBeInTheDocument();
  });

  it('the duel and result show no extra action, no note slot and the normal layout', () => {
    render(<DuelGame audio={unlockedAudio()} />);
    startRun();
    expect(screen.getByTestId('duel-screen')).not.toHaveAttribute('data-layout', 'stage');
    finishTake(true);
    expect(screen.queryByRole('button', { name: 'Leave the club' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
  });
});

describe('the note slot under the top bar', () => {
  it('sits right after the top bar, once, on every screen', () => {
    render(<DuelGame audio={unlockedAudio()} note={NOTE} />);
    const check = (): void => {
      const slot = screen.getByTestId('duel-note');
      expect(slot).toContainElement(screen.getByTestId('the-note'));
      expect(slot.previousElementSibling?.tagName).toBe('HEADER');
      expect(screen.getAllByTestId('duel-note')).toHaveLength(1);
    };
    check(); // difficulty
    startRun();
    check(); // the duel
    finishTake(true);
    check(); // result
  });

  it('pushes the HUD down: the note comes before the HUD in the page and does not float over it', () => {
    render(<DuelGame audio={unlockedAudio()} note={NOTE} />);
    startRun();
    const slot = screen.getByTestId('duel-note');
    const hud = screen.getByTestId('hud-who');
    expect(slot.compareDocumentPosition(hud) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (let el: HTMLElement | null = slot; el !== null; el = el.parentElement) {
      expect(['absolute', 'fixed']).not.toContain(el.style.position);
      expect(el.className).not.toMatch(/(^|\s)(absolute|fixed)(\s|$)/);
    }
  });

  it('keeps the touch pads on a phone held sideways with a note: the board fits the screen', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList =>
        ({
          matches: query.includes('max-height: 500px'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    });
    render(<DuelGame audio={unlockedAudio()} note={NOTE} />);
    startRun();
    expect(screen.getByTestId('duel-screen')).toHaveAttribute('data-layout', 'stage');
    expect(screen.getByTestId('duel-pads')).toBeInTheDocument();
  });
});

describe('the extra end action', () => {
  it('shows in the result and the summary button rows only', () => {
    render(<DuelGame audio={unlockedAudio()} endAction={EXTRA} />);
    const leave = (): HTMLElement | null => screen.queryByRole('button', { name: 'Leave the club' });
    expect(leave()).toBeNull(); // difficulty
    startRun();
    expect(leave()).toBeNull(); // the duel
    finishTake(true);
    expect(screen.getAllByRole('button', { name: 'Leave the club' })).toHaveLength(1); // result
    act(() => useGameStore.getState().nextMatch());
    expect(leave()).toBeNull(); // match 2 duel
    finishTake(true);
    act(() => useGameStore.getState().showSummary());
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Leave the club' })).toHaveLength(1);
  });

  it('is in the same row as the other buttons of the result', () => {
    render(<DuelGame audio={unlockedAudio()} endAction={EXTRA} />);
    startRun();
    finishTake(false);
    const leave = screen.getByRole('button', { name: 'Leave the club' });
    const replay = screen.getByRole('button', { name: 'Replay this take' });
    expect(leave.parentElement).toBe(replay.parentElement);
  });
});
