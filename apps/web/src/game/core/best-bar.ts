/**
 * Best Solo bar (design 6.1, 6.4) and the grid snapping it relies on.
 *
 * In the Solo turn there are no target notes: every tap is judged against its nearest grid step.
 * The best bar is the one the next Shadow opens its Solo with, so it is returned as plain notes
 * that the duel can hand out and take back in (see `opponentCall`).
 */
import { correctedTime, nearestStep, secondsToMs } from './clock';
import { BEST_BAR_MIN_GRADE, BEST_BAR_MIN_HITS, HIT_POINTS } from './config';
import { gradeDelta, hitWindows, isGradeAtLeast, type JudgeContext } from './judge';
import type { BarNote, Grade, Tap } from './types';

/** A tap placed on its nearest grid step. */
export interface GridTap {
  readonly tap: Tap;
  /** Bar of the nearest grid step, on the duel clock (bar 0 starts at `t0`). */
  readonly bar: number;
  /** The nearest grid step in that bar, 0 to GRID_STEPS - 1. */
  readonly step: number;
  /** Corrected tap time minus the time of the step, in ms (positive is late). */
  readonly deltaMs: number;
  /** Grade of `deltaMs` with the context's windows (difficulty, assistance). */
  readonly grade: Grade;
  /** HIT_POINTS of the grade. */
  readonly points: number;
}

/** The best bar of a Solo turn. */
export interface BestBar {
  /** The bar on the duel clock. */
  readonly bar: number;
  /** Mean HIT_POINTS of all the bar's taps against their nearest grid step (a Miss counts 0). */
  readonly timing: number;
  /**
   * The bar's taps graded BEST_BAR_MIN_GRADE or better, each moved onto its nearest grid step.
   * One note per step, in step order: of two taps on one step the closer one is kept.
   */
  readonly notes: readonly BarNote[];
}

/** Timing means closer than this are a tie: sums of 0.7 and 0.4 differ in the last bit by order. */
const TIMING_TIE_EPSILON = 1e-9;

/**
 * Places a tap on its nearest grid step. The tap is corrected by the calibration offset first, and
 * the nearest step follows the clock's swing. A tap a little early on step 0 belongs to that bar,
 * not to the bar before it.
 */
export function snapToGrid(tap: Tap, context: JudgeContext): GridTap {
  const time = correctedTime(tap.time, context.offsetMs);
  const point = nearestStep(context.clock, time);
  const deltaMs = secondsToMs(time - point.time);
  const grade = gradeDelta(deltaMs, hitWindows(context.clock.difficulty, context.assisted));
  return { tap, bar: point.bar, step: point.step, deltaMs, grade, points: HIT_POINTS[grade] };
}

/** The taps whose nearest grid step lies in bar `bar`, in the order given. */
export function tapsInBar(taps: readonly Tap[], bar: number, context: JudgeContext): Tap[] {
  return taps.filter((tap) => snapToGrid(tap, context).bar === bar);
}

/**
 * Picks the best bar among `bars` (the player's Solo bars on the duel clock).
 *
 * Only a bar with at least BEST_BAR_MIN_HITS taps graded BEST_BAR_MIN_GRADE or better can be
 * picked. Of those, the bar with the highest mean timing points wins; a tie goes to the earlier
 * bar. Returns null when no bar qualifies. Taps outside `bars` are ignored.
 */
export function pickBestBar(
  taps: readonly Tap[],
  bars: readonly number[],
  context: JudgeContext,
): BestBar | null {
  const gridTaps = taps.map((tap) => snapToGrid(tap, context));
  let best: BestBar | null = null;
  for (const bar of [...bars].sort((a, b) => a - b)) {
    const inBar = gridTaps.filter((gridTap) => gridTap.bar === bar);
    const hits = inBar.filter((gridTap) => isGradeAtLeast(gridTap.grade, BEST_BAR_MIN_GRADE));
    if (hits.length < BEST_BAR_MIN_HITS) continue;

    const timing = mean(inBar.map((gridTap) => gridTap.points));
    if (best !== null && timing <= best.timing + TIMING_TIE_EPSILON) continue;
    best = { bar, timing, notes: snappedNotes(hits) };
  }
  return best;
}

/** One note per grid step, keeping the closest tap (then the earlier one), in step order. */
function snappedNotes(gridTaps: readonly GridTap[]): BarNote[] {
  const byStep = new Map<number, GridTap>();
  for (const gridTap of gridTaps) {
    const kept = byStep.get(gridTap.step);
    if (kept === undefined || isCloser(gridTap, kept)) byStep.set(gridTap.step, gridTap);
  }
  return [...byStep.values()]
    .sort((a, b) => a.step - b.step)
    .map((gridTap) => ({ step: gridTap.step, button: gridTap.tap.button }));
}

function isCloser(candidate: GridTap, kept: GridTap): boolean {
  const distance = Math.abs(candidate.deltaMs) - Math.abs(kept.deltaMs);
  return distance < 0 || (distance === 0 && candidate.tap.time < kept.tap.time);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
