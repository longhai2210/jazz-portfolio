/**
 * Feel of the Solo turn (REQ-DUEL-009): rhythmic variety, rests, and not leaning on one button.
 * Each criterion is 0 to 1; the feel is their mean, or 0 when the turn has too few taps.
 *
 * Input taps are already placed on the grid (the step nearest to each corrected tap, as
 * `judgeGridTaps` in `scoring.ts` returns them). The bars recognised as quotes are passed in.
 */
import { FEEL_SINGLE_BUTTON_MAX, GRID_STEPS } from './config';
import type { Button } from './types';

/** A Solo tap placed on the grid step nearest to it. */
export interface PlacedTap {
  /** Bar on the duel clock. */
  readonly bar: number;
  /** Grid step inside the bar (0 to GRID_STEPS - 1). */
  readonly step: number;
  readonly button: Button;
}

export interface FeelInput {
  /** Every tap of the player's Solo bars, placed on the grid. */
  readonly taps: readonly PlacedTap[];
  /** Bars (on the duel clock) recognised as quotes of a lick. */
  readonly quoteBars: readonly number[];
}

export interface FeelResult {
  /** 1 for at least 3 distinct step patterns among the bars with taps, 0.5 for exactly 2, else 0. */
  readonly rhythmVariety: number;
  /** 1 when two consecutive taps are at least FEEL_MIN_REST_STEPS grid steps apart, else 0. */
  readonly rest: number;
  /** 0 when one button takes more than FEEL_SINGLE_BUTTON_MAX of the taps outside quote bars, else 1. */
  readonly buttonVariety: number;
  /** Mean of the three criteria, or 0 with fewer than FEEL_MIN_TAPS taps. */
  readonly score: number;
}

/** A Solo turn with fewer taps than this has a feel of 0. */
export const FEEL_MIN_TAPS = 3;

/**
 * Credit for rhythmic variety by the number of distinct step patterns among the bars with taps,
 * highest first: the first entry whose `minPatterns` is reached gives the credit, none gives 0.
 */
export const RHYTHM_VARIETY_CREDIT: readonly {
  readonly minPatterns: number;
  readonly credit: number;
}[] = [
  { minPatterns: 3, credit: 1 },
  { minPatterns: 2, credit: 0.5 },
];

/**
 * A rest is a stretch with no tap between two consecutive taps whose grid steps are at least this
 * far apart: 2 steps is 1 beat. Steps count across bar lines.
 */
export const FEEL_MIN_REST_STEPS = 2;

/** Position of a placed tap on the grid of the whole duel, in steps. */
function gridIndex(tap: PlacedTap): number {
  return tap.bar * GRID_STEPS + tap.step;
}

/** Rhythmic variety: distinct step patterns among the bars with taps. */
export function rhythmVariety(taps: readonly PlacedTap[]): number {
  const stepsByBar = new Map<number, Set<number>>();
  for (const tap of taps) {
    const steps = stepsByBar.get(tap.bar) ?? new Set<number>();
    steps.add(tap.step);
    stepsByBar.set(tap.bar, steps);
  }
  const patterns = new Set(
    [...stepsByBar.values()].map((steps) => [...steps].sort((a, b) => a - b).join(',')),
  );
  const tier = RHYTHM_VARIETY_CREDIT.find((entry) => patterns.size >= entry.minPatterns);
  return tier ? tier.credit : 0;
}

/** Rests: 1 when two consecutive taps lie at least FEEL_MIN_REST_STEPS grid steps apart. */
export function rest(taps: readonly PlacedTap[]): number {
  const indices = taps.map(gridIndex).sort((a, b) => a - b);
  for (let index = 1; index < indices.length; index += 1) {
    if (indices[index] - indices[index - 1] >= FEEL_MIN_REST_STEPS) return 1;
  }
  return 0;
}

/**
 * Button variety: 0 when one button takes more than FEEL_SINGLE_BUTTON_MAX of the taps outside the
 * quote bars, else 1 (also 1 when every tap is in a quote bar).
 */
export function buttonVariety(taps: readonly PlacedTap[], quoteBars: readonly number[]): number {
  const quotes = new Set(quoteBars);
  const counted = taps.filter((tap) => !quotes.has(tap.bar));
  if (counted.length === 0) return 1;
  const perButton = new Map<Button, number>();
  for (const tap of counted) perButton.set(tap.button, (perButton.get(tap.button) ?? 0) + 1);
  const top = Math.max(...perButton.values());
  return top / counted.length > FEEL_SINGLE_BUTTON_MAX ? 0 : 1;
}

/** Feel of a Solo turn: the mean of the three criteria, or 0 with fewer than FEEL_MIN_TAPS taps. */
export function scoreFeel(input: FeelInput): FeelResult {
  const result = {
    rhythmVariety: rhythmVariety(input.taps),
    rest: rest(input.taps),
    buttonVariety: buttonVariety(input.taps, input.quoteBars),
  };
  const score =
    input.taps.length < FEEL_MIN_TAPS
      ? 0
      : (result.rhythmVariety + result.rest + result.buttonVariety) / 3;
  return { ...result, score };
}
