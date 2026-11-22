/**
 * @jest-environment jsdom
 */
// DuelGame inside the 3D stage (game-stage, design.md sections 2 and 4, decision 1): an audio
// unlocked elsewhere, a scene behind the screens, a note under the top bar and an extra action on
// the result and summary screens. Without these props DuelGame is the grey-box duel of game-duel,
// which its own tests cover.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createGameAudio, type GameAudio } from '../audio';
import {
  createFakeAudioScope,
  createManualTimer,
  FakeAudioContext,
} from '../audio/testing/fake-audio-context';
import { createDuelSession } from '../core/campaign';
import type { DuelResult } from '../core/session';
import { useGameStore } from '@/stores/gameStore';
import DuelGame, { type DuelGameProps } from './DuelGame';
import { installPointerEvent } from './lanes/testing/pointer-event';
import { playTake } from './screens/testing/duel-results';
import { setFakeLocale } from './screens/testing/intl';
import { navigations } from './screens/testing/link';
import { LeaveGameContext } from './screens/ui';

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

beforeEach(() => {
  jest.useFakeTimers();
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  restorePointerEvent();
  jest.useRealTimers();
});

/** An audio a Play press elsewhere unlocked, suspended since (the street stops on the way in). */
function unlockedAudio(state: 'running' | 'suspended' = 'suspended'): {
  context: FakeAudioContext;
  audio: GameAudio;
} {
  const context = new FakeAudioContext();
  context.state = state;
  return { context, audio: createGameAudio(context, { timer: createManualTimer() }) };
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

function root(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[data-duel-game]');
  if (found === null) throw new Error('DuelGame is not on screen');
  return found;
}

/** The take on screen, played to the end as a win or a loss, then recorded: its result shows. */
function finishTake(win: boolean): DuelResult {
  const campaign = useGameStore.getState().campaign;
  if (campaign === null) throw new Error('no run');
  const result = playTake(createDuelSession(campaign), { win });
  act(() => useGameStore.getState().finishMatch(result));
  return result;
}

function renderGame(props: DuelGameProps) {
  return render(<DuelGame {...props} />);
}

describe('DuelGame with an audio unlocked elsewhere (design decision 1)', () => {
  it('never shows its Start screen and opens on the difficulty step, without making an audio of its own', async () => {
    const created = createFakeAudioScope();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: created.scope.AudioContext,
    });
    const { audio } = unlockedAudio();
    renderGame({ audio, character: 'sayo' });
    await settle();

    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(created.contexts).toHaveLength(0);
  });

  it('wakes the suspended audio inside the Continue press, then calibrates on it', async () => {
    const { context, audio } = unlockedAudio();
    renderGame({ audio });
    await settle();
    expect(context.calls).not.toContain('resume');

    await press('Continue');
    expect(context.calls).toContain('resume');
    expect(context.state).toBe('running');
    expect(screen.getByRole('heading', { name: 'Tap along to the click' })).toBeInTheDocument();
  });

  it('with the character, difficulty and offset passed too, the match starts at once on that audio', async () => {
    const { context, audio } = unlockedAudio();
    renderGame({ audio, character: 'sayo', difficulty: 'session', offsetMs: 0 });
    await settle();

    expect(context.state).toBe('running');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    // Sayo's first opponent is the Shadow of Aki (REQ-DUEL-012).
    expect(useGameStore.getState().session?.config).toMatchObject({
      character: 'aki',
      difficulty: 'session',
    });
  });

  it('unmounting drops what the duel queued but leaves the audio open for its owner', async () => {
    const { context, audio } = unlockedAudio('running');
    const clearScheduled = jest.spyOn(audio, 'clearScheduled');
    const view = renderGame({ audio, difficulty: 'session', offsetMs: 0 });
    await settle();
    clearScheduled.mockClear();

    view.unmount();
    await settle();
    expect(clearScheduled).toHaveBeenCalled();
    expect(context.calls).not.toContain('close');
    expect(context.state).toBe('running');
    expect(useGameStore.getState().screen).toBe('start');
  });

  it("Back to portfolio hands the audio to its owner's leave instead of closing it here", async () => {
    const { context, audio } = unlockedAudio();
    const ownerLeave = jest.fn();
    render(
      <LeaveGameContext.Provider value={ownerLeave}>
        <DuelGame audio={audio} />
      </LeaveGameContext.Provider>,
    );
    await settle();

    fireEvent.click(screen.getByRole('link', { name: /Back to portfolio/ }));
    expect(ownerLeave).toHaveBeenCalledTimes(1);
    expect(context.calls).not.toContain('close');
  });
});

describe('DuelGame over a 3D scene (design.md section 4)', () => {
  it('draws the backdrop behind the screens on a transparent page, dimmed behind the setup panels', async () => {
    const { audio } = unlockedAudio();
    renderGame({ audio, backdrop: <div data-testid="scene" /> });
    await settle();

    expect(root()).not.toHaveClass('bg-jazz-black');
    expect(root()).toHaveAttribute('data-backdrop');
    const backdrop = screen.getByTestId('duel-backdrop');
    expect(backdrop).toContainElement(screen.getByTestId('scene'));
    // Behind the page's own content, on solid black until the scene draws.
    expect(backdrop).toHaveClass('fixed', 'inset-0', '-z-10', 'bg-jazz-black');
    expect(screen.getByTestId('duel-backdrop-dim')).toHaveClass('bg-jazz-black/40');
  });

  it('keeps the scene clear during play, and dims it again while the take is paused and on the result', async () => {
    const { audio } = unlockedAudio();
    renderGame({ audio, difficulty: 'session', offsetMs: 0, backdrop: <div data-testid="scene" /> });
    await settle();
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(useGameStore.getState().session?.status).toBe('playing');
    expect(screen.queryByTestId('duel-backdrop-dim')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await settle();
    expect(useGameStore.getState().session?.status).toBe('paused');
    expect(screen.getByTestId('duel-backdrop-dim')).toBeInTheDocument();

    finishTake(true);
    expect(screen.getByTestId('duel-backdrop-dim')).toBeInTheDocument();
  });

  it('lays the note over the page right under the top bar, on the Start, setup and duel screens', async () => {
    const note = <p data-testid="note">The stage art is missing.</p>;
    const first = renderGame({ note });
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    const slot = screen.getByTestId('duel-note');
    expect(slot).toContainElement(screen.getByTestId('note'));
    // Out of the page flow, so the page is no taller than the screen; clicks go through it.
    expect(slot).toHaveClass('absolute', 'inset-x-0', 'top-[calc(4rem+1px)]', 'pointer-events-none');
    expect(slot.parentElement).toBe(root());
    // After the screen, so it is laid over it.
    expect(root().lastElementChild).toBe(slot);
    first.unmount();

    const { audio } = unlockedAudio();
    const second = renderGame({ audio, note });
    await settle();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expect(screen.getByTestId('duel-note')).toContainElement(screen.getByTestId('note'));
    second.unmount();

    renderGame({ audio, difficulty: 'session', offsetMs: 0, note });
    await settle();
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.getByTestId('duel-note')).toContainElement(screen.getByTestId('note'));
  });

  it('shows the extra action under the result and summary panels, and nowhere else', async () => {
    const { audio } = unlockedAudio();
    renderGame({
      audio,
      difficulty: 'session',
      offsetMs: 0,
      endAction: <button type="button">Leave the club</button>,
    });
    await settle();
    expect(screen.queryByRole('button', { name: 'Leave the club' })).not.toBeInTheDocument();

    finishTake(true);
    expect(screen.getByRole('heading', { name: /is back in the band/ })).toBeInTheDocument();
    expect(screen.getByTestId('duel-end-action')).toContainElement(
      screen.getByRole('button', { name: 'Leave the club' }),
    );

    await press('On to match 2');
    expect(screen.queryByRole('button', { name: 'Leave the club' })).not.toBeInTheDocument();

    finishTake(true);
    await press('See summary');
    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave the club' })).toBeInTheDocument();
  });

  it('without the stage props it is the grey-box duel as before: solid page, Start, no slots', () => {
    renderGame({});
    expect(root()).toHaveClass('bg-jazz-black');
    expect(root()).not.toHaveAttribute('data-backdrop');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByTestId('duel-backdrop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('duel-end-action')).not.toBeInTheDocument();
  });
});
