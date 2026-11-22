/**
 * @jest-environment jsdom
 */
import { createGameAudio, type GameAudio } from '../../audio';
import { FakeAudioContext, createManualTimer } from '../../audio/testing/fake-audio-context';
import { useGameStore } from '@/stores/gameStore';
import { createDuelController, type DuelController } from './duel-controller';

/** A fake whose `resume()` settles only when the test says so, as a slow browser would. */
class DeferredResumeContext extends FakeAudioContext {
  private pending: (() => void) | null = null;

  resume(): Promise<void> {
    this.calls.push('resume');
    return new Promise<void>((resolve) => {
      this.pending = () => {
        this.state = 'running';
        resolve();
      };
    });
  }

  /** The browser lets the audio clock run again. */
  finishResume(): void {
    if (this.pending === null) throw new Error('no resume is waiting');
    this.pending();
    this.pending = null;
  }
}

let context: DeferredResumeContext;
let audio: GameAudio;
let controller: DuelController;

function status() {
  return useGameStore.getState().session?.status;
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

/** The tab is hidden: DuelScreen's `visibilitychange` handler asks the controller to pause. */
function hideTab(): void {
  setVisibility('hidden');
  controller.pause();
}

function callsAfterLastResume(): string[] {
  return context.calls.slice(context.calls.lastIndexOf('resume') + 1);
}

beforeEach(() => {
  useGameStore.getState().startRun({ difficulty: 'lounge', offsetMs: 0 });
  context = new DeferredResumeContext();
  context.state = 'running';
  audio = createGameAudio(context, { timer: createManualTimer() });
  controller = createDuelController({ audio, onEnd: jest.fn() });

  controller.begin();
  context.currentTime = 1;
  controller.tick();
  controller.pause();
  expect(status()).toBe('paused');
  expect(context.state).toBe('suspended');
});

afterEach(async () => {
  await audio.close();
  useGameStore.getState().reset();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('createDuelController', () => {
  it('AC-DUEL-014.1: a tab hidden while resume() waits on the audio keeps the match paused and suspends the audio', async () => {
    const resuming = controller.resume();
    hideTab();
    context.finishResume();
    await resuming;

    expect(status()).toBe('paused');
    expect(useGameStore.getState().countInResumed).toBe(false);
    expect(callsAfterLastResume()).toContain('suspend');
    expect(context.state).toBe('suspended');
  });

  it('AC-DUEL-014.1: a tab hidden and shown again while resume() waits still keeps the match paused', async () => {
    const resuming = controller.resume();
    hideTab();
    setVisibility('visible');
    context.finishResume();
    await resuming;

    expect(status()).toBe('paused');
    expect(callsAfterLastResume()).toContain('suspend');
    expect(context.state).toBe('suspended');
  });

  it('AC-DUEL-014.1: a tab already hidden when resume() settles keeps the match paused and suspends the audio', async () => {
    const resuming = controller.resume();
    setVisibility('hidden');
    context.finishResume();
    await resuming;

    expect(status()).toBe('paused');
    expect(callsAfterLastResume()).toContain('suspend');
    expect(context.state).toBe('suspended');
  });

  it('AC-DUEL-014.1: with the tab visible throughout, the resume goes ahead after the audio runs', async () => {
    const resuming = controller.resume();
    context.finishResume();
    await resuming;

    expect(status()).toBe('playing');
    expect(useGameStore.getState().countInResumed).toBe(true);
    expect(callsAfterLastResume()).not.toContain('suspend');
    expect(context.state).toBe('running');
  });

  it('AC-DUEL-014.1: a pause after a resume interrupted by a hidden tab still pauses the next take in play', async () => {
    const interrupted = controller.resume();
    hideTab();
    context.finishResume();
    await interrupted;
    setVisibility('visible');

    const resumed = controller.resume();
    context.finishResume();
    await resumed;
    expect(status()).toBe('playing');

    hideTab();
    expect(status()).toBe('paused');
    expect(context.calls[context.calls.length - 1]).toBe('suspend');
    expect(context.state).toBe('suspended');
  });
});
