/**
 * Where things sit on the lane board. The board shows one 4-bar phase (the opponent's call or the
 * player's reply); every horizontal position is a fraction of that phase, 0 at its first beat and
 * 1 at the end of its last bar.
 *
 * Markers, beat lines and the playhead all go through `beatFraction`, so a marker sits exactly
 * where the playhead is when its note sounds, with the swing of Late Set included.
 */
import { stepToBeat, timeToBeat, type BeatClock } from '../../core/clock';
import { BEATS_PER_BAR, GRID_STEPS } from '../../core/config';
import type { CallBar } from '../../core/types';

/** Bars on the board at once: one side of a turn. */
export const PHASE_BARS = 4;

/** Beats on the board at once. */
export const PHASE_BEATS = PHASE_BARS * BEATS_PER_BAR;

/** Half a grid step, as a fraction of the phase: how far outside the phase a tap is still drawn. */
export const HALF_STEP_FRACTION = 1 / (PHASE_BARS * GRID_STEPS * 2);

/** Fraction of the phase starting at bar `firstBar` for a beat position on the duel clock. */
export function beatFraction(firstBar: number, beat: number): number {
  return (beat - firstBar * BEATS_PER_BAR) / PHASE_BEATS;
}

/** Fraction of the phase for grid step `step` of bar `bar` (bars count on the duel clock). */
export function stepFraction(
  clock: BeatClock,
  firstBar: number,
  bar: number,
  step: number,
): number {
  return beatFraction(firstBar, stepToBeat(clock, bar, step));
}

/** Fraction of the phase for an audio-clock time. Below 0 before the phase, 1 or more after it. */
export function timeFraction(clock: BeatClock, firstBar: number, time: number): number {
  return beatFraction(firstBar, timeToBeat(clock, time));
}

export function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

/** Index (0 to 3) of the bar the playhead is in, or null before or after the phase. */
export function barInPhase(fraction: number): number | null {
  if (!(fraction >= 0 && fraction < 1)) return null;
  return Math.floor(fraction * PHASE_BARS);
}

/** Thin lines: every beat that does not start a bar. */
export const BEAT_LINE_FRACTIONS: readonly number[] = Array.from(
  { length: PHASE_BEATS },
  (_, beat) => beat,
)
  .filter((beat) => beat % BEATS_PER_BAR !== 0)
  .map((beat) => beat / PHASE_BEATS);

/** Thick lines: the start of bars 2 to 4 (the track's left edge starts bar 1). */
export const BAR_LINE_FRACTIONS: readonly number[] = Array.from(
  { length: PHASE_BARS - 1 },
  (_, index) => (index + 1) / PHASE_BARS,
);

/** A run of neighbouring bars, by index in the phase (0 to 3). */
export interface BarRun {
  readonly start: number;
  readonly length: number;
}

/** Runs of bars of the call that were built from the player's own solo (AC-DUEL-007.4). */
export function playerPhraseRuns(call: readonly Pick<CallBar, 'source'>[]): BarRun[] {
  const runs: BarRun[] = [];
  const bars = Math.min(call.length, PHASE_BARS);
  let start = -1;
  for (let index = 0; index <= bars; index++) {
    const isPlayer = index < bars && call[index].source === 'player';
    if (isPlayer && start < 0) start = index;
    if (!isPlayer && start >= 0) {
      runs.push({ start, length: index - start });
      start = -1;
    }
  }
  return runs;
}
