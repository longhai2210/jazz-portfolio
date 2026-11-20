/**
 * Runs one take of the duel against the game audio, outside React (design 12.1): the frame loop,
 * taps, pause and resume all go through here. It reads and writes `useGameStore` directly, turns
 * the session's events into sounds, and writes what the board shows only when it changes.
 *
 * Audio rules (REQ-DUEL-014, game-duel Lead notes):
 * - A count-in queues its clicks, then the drums and the opponent's calls on the clock it brings.
 * - A pause drops every queued sound (the turn restarts from the call, and its quotes are gone),
 *   then suspends the audio clock. A resume restarts the clock first, then queues everything again.
 * - A lick sound may come after its downbeat (a large offset delays the bar check); it then plays
 *   at once instead of being dropped.
 * - The end of the duel never stops the audio: the last quote sounds after it. Only leaving the
 *   game closes the context.
 */
import type { GameAudio } from '../../audio';
import { beatToTime, timeToBeat } from '../../core/clock';
import { BEATS_PER_BAR } from '../../core/config';
import {
  DUEL_BARS,
  phaseAt,
  stepSession,
  type DuelResult,
  type SessionEvent,
  type SessionInput,
  type SessionPhase,
} from '../../core/session';
import type { Tap } from '../../core/types';
import { useGameStore } from '@/stores/gameStore';
import { LICK_SOUNDS, SHADOW_VOICES, lickIdOf } from './game-ids';

/** Seconds between a start or resume and its count-in bar, so the first click is never late. */
export const START_LEAD_S = 0.2;

export interface DuelController {
  /** Starts the take in the store when it is ready: count-in, drums and calls are queued. */
  begin(): void;
  /** One frame: moves the take to the audio clock's time. */
  tick(): void;
  /** A tap of the player: its note plays at once (AC-DUEL-013.5), then the take judges it. */
  tap(tap: Tap): void;
  /**
   * Pauses a take in play and suspends the audio clock (AC-DUEL-014.1). Called while a resume
   * waits on the audio, it makes that resume stay paused.
   */
  pause(): void;
  /**
   * Resumes a paused take with a count-in bar (AC-DUEL-014.2). Stays paused if audio stays off, or
   * if the tab is hidden or a pause is asked for before the audio runs (AC-DUEL-014.1).
   */
  resume(): Promise<void>;
}

export interface DuelControllerOptions {
  readonly audio: GameAudio;
  /** Called once per take, when it ends, after the store shows the result. */
  readonly onEnd: (result: DuelResult) => void;
}

function samePhase(a: SessionPhase | null, b: SessionPhase): boolean {
  if (a === null || a.kind !== b.kind) return false;
  switch (b.kind) {
    case 'ready':
    case 'finished':
      return true;
    case 'paused':
      return a.kind === 'paused' && a.turn === b.turn;
    case 'countIn':
      return a.kind === 'countIn' && a.turn === b.turn && a.bar === b.bar && a.beat === b.beat;
    case 'opponent':
    case 'player':
      return (a.kind === 'opponent' || a.kind === 'player') && a.turn === b.turn && a.bar === b.bar;
  }
}

function isTabHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function createDuelController({ audio, onEnd }: DuelControllerOptions): DuelController {
  let resuming = false;
  /** A pause asked for while a resume waits on the audio, for example the tab being hidden. */
  let pauseWhileResuming = false;

  function store() {
    return useGameStore.getState();
  }

  function step(input: SessionInput): readonly SessionEvent[] {
    const session = store().session;
    if (session === null) return [];
    const next = stepSession(session, input);
    store().setSession(next.state);
    return next.events;
  }

  function updateView(): void {
    const { session, phase, beat, justQuoted } = store();
    if (session === null) return;
    const now = audio.currentTime;
    const nextPhase = phaseAt(session, now);
    const nextBeat = session.clock === null ? null : Math.floor(timeToBeat(session.clock, now));
    if (!samePhase(phase, nextPhase) || beat !== nextBeat) store().setView(nextPhase, nextBeat);
    // The lick book keeps the quote lit through the bar its sound plays in.
    if (
      justQuoted !== null &&
      nextBeat !== null &&
      Math.floor(nextBeat / BEATS_PER_BAR) > justQuoted.bar + 1
    ) {
      store().lightQuote(null);
    }
  }

  function queueTake(event: Extract<SessionEvent, { type: 'countIn' }>): void {
    const { clock, bar, calls } = event;
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
      audio.scheduleClick(beatToTime(clock, bar * BEATS_PER_BAR + beat), beat === 0);
    }
    const firstPlayed = bar + 1;
    audio.scheduleDrumBars(clock, firstPlayed, DUEL_BARS - firstPlayed);
    const character = store().session?.config.character;
    if (character === undefined) return;
    for (const call of calls) {
      audio.scheduleCall(clock, SHADOW_VOICES[character], call.firstBar, call.bars);
    }
  }

  function handle(events: readonly SessionEvent[]): void {
    let ended: DuelResult | null = null;
    for (const event of events) {
      switch (event.type) {
        case 'countIn':
          queueTake(event);
          store().setCountInResumed(event.resumed);
          store().showFeedback(null);
          break;
        case 'tap':
          if (event.feedback === 'extra') store().showFeedback({ kind: 'extra' });
          else if (event.feedback !== null) {
            store().showFeedback({ kind: 'grade', grade: event.feedback });
          }
          break;
        case 'lickSound': {
          const lickId = lickIdOf(event.lick);
          if (lickId === null) break;
          audio.scheduleLickSound(LICK_SOUNDS[lickId], Math.max(event.time, audio.currentTime));
          store().showFeedback({ kind: 'quote', lickId });
          store().lightQuote({ lickId, bar: event.bar });
          break;
        }
        case 'end':
          ended = event.result;
          break;
        case 'turnEnd':
        case 'paused':
          break;
      }
    }
    if (ended !== null) {
      store().finishMatch(ended);
      onEnd(ended);
    }
  }

  return {
    begin() {
      if (store().session?.status !== 'ready') return;
      // Whatever the previous screen left queued (a calibration click, the last quote) goes.
      audio.clearScheduled();
      handle(step({ type: 'start', time: audio.currentTime + START_LEAD_S }));
      updateView();
    },

    tick() {
      if (store().session?.status === 'playing') {
        handle(step({ type: 'advance', time: audio.currentTime }));
      }
      updateView();
    },

    tap(tap) {
      audio.playPlayerNote(tap.button);
      if (store().session?.status !== 'playing') return;
      handle(step({ type: 'tap', tap }));
      updateView();
    },

    pause() {
      if (resuming && store().session?.status === 'paused') {
        pauseWhileResuming = true;
        return;
      }
      if (store().session?.status !== 'playing') return;
      handle(step({ type: 'pause', time: audio.currentTime }));
      // A pause after the last Solo bar ends the duel instead: the result is already up.
      if (store().session?.status !== 'paused') return;
      audio.clearScheduled();
      void audio.suspend();
      store().lightQuote(null);
      updateView();
    },

    async resume() {
      if (resuming || store().session?.status !== 'paused') return;
      resuming = true;
      pauseWhileResuming = false;
      try {
        await audio.resume();
      } finally {
        resuming = false;
      }
      // The player left meanwhile: nothing to resume.
      if (store().session?.status !== 'paused') return;
      // The tab was hidden (or a pause asked for) while the audio woke up: the pause still holds.
      if (pauseWhileResuming || isTabHidden()) {
        pauseWhileResuming = false;
        await audio.suspend();
        return;
      }
      // The browser kept the audio off: stay paused.
      if (audio.context.state !== 'running') return;
      handle(step({ type: 'resume', time: audio.currentTime + START_LEAD_S }));
      updateView();
    },
  };
}
