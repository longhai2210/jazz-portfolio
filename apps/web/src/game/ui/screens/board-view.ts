/**
 * What the lane board draws for a moment of the duel: which 4 bars, whose they are, and how each
 * target note stands. Pure: the duel screen calls it on every render with what the store holds.
 */
import { beatToTime, stepTime, type BeatClock } from '../../core/clock';
import { TURNS } from '../../core/call';
import type { LaneSide } from '../../core/difficulty';
import { hitWindows, judgeTaps } from '../../core/judge';
import {
  turnLayout,
  turnTargets,
  type SessionPhase,
  type SessionState,
} from '../../core/session';
import type { CallBar, Tap, Turn } from '../../core/types';
import type { LaneTarget } from '../lanes/LaneBoard';

export interface BoardInput {
  readonly calls: SessionState['calls'];
  readonly clock: BeatClock;
  readonly offsetMs: number;
  readonly assisted: boolean;
  /** Taps counted for the current turn. */
  readonly taps: readonly Tap[];
  readonly phase: SessionPhase | null;
  /** The latest whole beat reached on `clock`; null before the start. */
  readonly beat: number | null;
  /** Index in TURNS of the turn being played. */
  readonly turnIndex: number;
}

export interface BoardView {
  readonly turn: Turn;
  /** Bar on the duel clock where the 4 bars on screen start. */
  readonly firstBar: number;
  readonly side: LaneSide;
  /** Position of the bar playing now in the 4 on screen, 0 to 3; null during a count-in. */
  readonly barIndex: number | null;
  readonly call?: readonly CallBar[];
  readonly targets?: readonly LaneTarget[];
  readonly taps?: readonly Tap[];
}

/**
 * The 4 bars on screen. While the opponent or the player plays, the half of the turn being played.
 * During a count-in, a pause or before the start, the opponent's bars of the turn coming up.
 *
 * On the player's Echo and Answer bars every target is drawn with its state: hit once a tap pairs
 * with it, missed once its OK window has passed without one, pending otherwise. The Solo turn has
 * no targets, only the player's taps.
 */
export function boardView(input: BoardInput): BoardView {
  const { calls, phase } = input;
  if (phase !== null && (phase.kind === 'opponent' || phase.kind === 'player')) {
    const firstBar = phase.bar - phase.index;
    if (phase.kind === 'opponent') {
      return {
        turn: phase.turn,
        firstBar,
        side: 'opponent',
        barIndex: phase.index,
        call: calls[phase.turn],
      };
    }
    return {
      turn: phase.turn,
      firstBar,
      side: 'player',
      barIndex: phase.index,
      taps: input.taps,
      targets: phase.turn === 'solo' ? undefined : targetStates(input, phase.turn),
    };
  }

  const turn =
    phase !== null && (phase.kind === 'countIn' || phase.kind === 'paused')
      ? phase.turn
      : TURNS[Math.min(input.turnIndex, TURNS.length - 1)];
  return {
    turn,
    firstBar: turnLayout(turn).opponentBars[0],
    side: 'opponent',
    barIndex: null,
    call: calls[turn],
  };
}

function targetStates(input: BoardInput, turn: 'echo' | 'answer'): LaneTarget[] {
  const { calls, clock, offsetMs, assisted, taps, beat } = input;
  const context = { clock, offsetMs, assisted };
  const okSeconds = hitWindows(clock.difficulty, assisted).ok / 1000;
  const reached = beat === null ? Number.NEGATIVE_INFINITY : beatToTime(clock, beat);
  return judgeTaps(turnTargets({ calls }, turn), taps, context).notes.map((judged) => {
    if (judged.tap !== null) return { note: judged.note, state: 'hit' };
    const closes = stepTime(clock, judged.note.bar, judged.note.step) + okSeconds + offsetMs / 1000;
    return { note: judged.note, state: closes < reached ? 'miss' : 'pending' };
  });
}
