/**
 * Score of a duel (REQ-DUEL-010): timing per turn, the 60/25/15 total plus the quote bonus,
 * stars and the win.
 *
 * Every component score is a fraction from 0 to 1; the total is on a 100-point scale with the
 * quote bonus on top.
 */
import { EXTRA_TAP_PENALTY, HIT_POINTS, SCORE_WEIGHTS, STAR_THRESHOLDS } from './config';
import { correctedTime, nearestStep, secondsToMs } from './clock';
import type { DirectionTurn } from './direction';
import { gradeDelta, hitWindows, type JudgeContext } from './judge';
import type { Button, Grade, JudgeResult, Tap, Turn } from './types';

/** Star count of a duel: 0 is a loss, 1 to 3 is a win. */
export type StarCount = 0 | 1 | 2 | 3;

/** A tap of the free Solo turn, judged against the grid step nearest to it. */
export interface GridTapJudgement {
  readonly tap: Tap;
  /** Bar of the nearest grid step, on the duel clock. */
  readonly bar: number;
  /** The nearest grid step (0 to GRID_STEPS - 1). */
  readonly step: number;
  /** The tap's button. */
  readonly button: Button;
  /** Corrected tap time minus the grid step's time, in ms (positive is late). */
  readonly deltaMs: number;
  readonly grade: Grade;
}

export interface DuelScoreInput {
  /** Timing score of each turn (0 to 1). */
  readonly timing: Readonly<Record<Turn, number>>;
  /** Direction score of the Echo and Answer turns (0 to 1). */
  readonly direction: Readonly<Record<DirectionTurn, number>>;
  /** Feel of the Solo turn (0 to 1). */
  readonly feel: number;
  /** Quote bonus in points, added on top of the 100-point scale. */
  readonly quoteBonus: number;
}

export interface DuelScore {
  /** Mean timing score of the three turns (0 to 1). */
  readonly timing: number;
  /** Mean direction score of Echo and Answer (0 to 1). */
  readonly direction: number;
  /** Feel of the Solo turn (0 to 1). */
  readonly feel: number;
  readonly quoteBonus: number;
  /** 60 × timing + 25 × direction + 15 × feel + quote bonus. */
  readonly total: number;
  readonly stars: StarCount;
  /** 1 star or more. */
  readonly won: boolean;
}

/** Rounds a total to 6 decimals so floating-point noise never moves it across a star threshold. */
function roundTotal(total: number): number {
  return Math.round(total * 1e6) / 1e6;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Timing score of an Echo or Answer turn: (sum of note points − EXTRA_TAP_PENALTY × extra taps)
 * divided by the number of target notes, never below 0. A turn with no target notes scores 0.
 */
export function callTurnTiming(result: JudgeResult): number {
  if (result.notes.length === 0) return 0;
  const points = result.notes.reduce((sum, judgement) => sum + HIT_POINTS[judgement.grade], 0);
  const penalty = EXTRA_TAP_PENALTY * result.extraTaps.length;
  return Math.max(0, (points - penalty) / result.notes.length);
}

/**
 * Judges each Solo tap against the grid step nearest to its corrected time, with the clock's swing
 * and the windows of the difficulty (× ASSIST_MULT when assisted). Taps keep their given order.
 */
export function judgeGridTaps(taps: readonly Tap[], context: JudgeContext): GridTapJudgement[] {
  const windows = hitWindows(context.clock.difficulty, context.assisted);
  return taps.map((tap) => {
    const time = correctedTime(tap.time, context.offsetMs);
    const point = nearestStep(context.clock, time);
    const deltaMs = secondsToMs(time - point.time);
    return {
      tap,
      bar: point.bar,
      step: point.step,
      button: tap.button,
      deltaMs,
      grade: gradeDelta(deltaMs, windows),
    };
  });
}

/** Timing score of the Solo turn: mean note points of the grid-judged taps, 0 with no taps. */
export function soloTurnTiming(judgements: readonly GridTapJudgement[]): number {
  if (judgements.length === 0) return 0;
  return mean(judgements.map((judgement) => HIT_POINTS[judgement.grade]));
}

/** Stars for a total: STAR_THRESHOLDS are the minimum totals for 1, 2 and 3 stars. */
export function starsForTotal(total: number): StarCount {
  const [one, two, three] = STAR_THRESHOLDS;
  if (total >= three) return 3;
  if (total >= two) return 2;
  if (total >= one) return 1;
  return 0;
}

/** True when the stars make a win (1 star or more). */
export function isWin(stars: StarCount): boolean {
  return stars >= 1;
}

/**
 * Total of a duel: SCORE_WEIGHTS.timing × mean timing of the three turns
 * + SCORE_WEIGHTS.direction × mean direction of Echo and Answer + SCORE_WEIGHTS.feel × feel
 * + quote bonus; then its stars and whether it wins.
 */
export function scoreDuel(input: DuelScoreInput): DuelScore {
  const timing = mean([input.timing.echo, input.timing.answer, input.timing.solo]);
  const direction = mean([input.direction.echo, input.direction.answer]);
  const total = roundTotal(
    SCORE_WEIGHTS.timing * timing +
      SCORE_WEIGHTS.direction * direction +
      SCORE_WEIGHTS.feel * input.feel +
      input.quoteBonus,
  );
  const stars = starsForTotal(total);
  return {
    timing,
    direction,
    feel: input.feel,
    quoteBonus: input.quoteBonus,
    total,
    stars,
    won: isWin(stars),
  };
}
