/**
 * Licks and quotes (design 3.1, 6.2).
 *
 * A bar quotes lick L when every step of L has a tap graded QUOTE_MIN_GRADE or better (the
 * difficulty and assistance windows apply) and at most QUOTE_MAX_EXTRA_TAPS taps of the bar are on
 * none of L's steps. Steps are absolute: the lick starts at the bar's first step, and any button
 * counts. These are pure functions; the duel session decides that only Solo bars are checked.
 */
import { tapsInBar } from './best-bar';
import { GRID_STEPS, QUOTE_BONUS } from './config';
import { LICKS } from './data/licks';
import { isGradeAtLeast, judgeTaps, type JudgeContext } from './judge';
import type { Grade, Lick, Tap, TargetNote } from './types';

/** Grade every step of a lick needs for a quote. */
export const QUOTE_MIN_GRADE: Grade = 'great';

/** Taps of the bar off the lick's steps that a quote still allows. */
export const QUOTE_MAX_EXTRA_TAPS = 1;

/** Steps a lick has: few enough to stay one bar, enough that random tapping rarely matches. */
export const LICK_STEPS: Readonly<{ min: number; max: number }> = { min: 3, max: 6 };

/** A lick matched in one bar. */
export interface LickMatch {
  readonly lick: Lick;
  /** The bar on the duel clock. */
  readonly bar: number;
  /** Taps of the bar paired with none of the lick's steps (0 to QUOTE_MAX_EXTRA_TAPS). */
  readonly extraTaps: number;
}

/**
 * Matches one lick against bar `bar`. Of `taps`, only those whose nearest grid step lies in the
 * bar are used, so passing every tap of the Solo turn is fine. Returns null when it is no quote.
 */
export function matchLick(
  lick: Lick,
  taps: readonly Tap[],
  bar: number,
  context: JudgeContext,
): LickMatch | null {
  if (lick.steps.length === 0) return null;
  // The judge pairs on timing only, so the button of the target notes does not matter.
  const notes: TargetNote[] = lick.steps.map((step) => ({ bar, step, button: 0 }));
  const result = judgeTaps(notes, tapsInBar(taps, bar, context), context);
  if (!result.notes.every((judged) => isGradeAtLeast(judged.grade, QUOTE_MIN_GRADE))) return null;
  if (result.extraTaps.length > QUOTE_MAX_EXTRA_TAPS) return null;
  return { lick, bar, extraTaps: result.extraTaps.length };
}

/**
 * Orders two matches of one bar: the lick with more steps first, then the one with fewer extra
 * taps. Negative when `a` goes first, 0 when only the learned order can decide.
 */
export function compareMatches(a: LickMatch, b: LickMatch): number {
  return b.lick.steps.length - a.lick.steps.length || a.extraTaps - b.extraTaps;
}

/** The quote among matches given in learned order: the first one that no later match beats. */
export function pickQuote(matches: readonly LickMatch[]): LickMatch | null {
  let best: LickMatch | null = null;
  for (const match of matches) {
    if (best === null || compareMatches(match, best) < 0) best = match;
  }
  return best;
}

/**
 * The lick bar `bar` quotes, or null. `licks` are in learned order (default: the grey-box licks);
 * when several match, the rule of `compareMatches` applies, then the lick learned first.
 */
export function detectQuote(
  taps: readonly Tap[],
  bar: number,
  context: JudgeContext,
  licks: readonly Lick[] = LICKS,
): LickMatch | null {
  const matches: LickMatch[] = [];
  for (const lick of licks) {
    const match = matchLick(lick, taps, bar, context);
    if (match !== null) matches.push(match);
  }
  return pickQuote(matches);
}

/**
 * Quote bonus of one duel: QUOTE_BONUS.perLick per distinct lick quoted, counting at most
 * QUOTE_BONUS.maxLicks licks. Quoting one lick again adds nothing.
 */
export function quoteBonus(quotes: readonly LickMatch[]): number {
  const distinct = new Set(quotes.map((quote) => quote.lick.id)).size;
  return QUOTE_BONUS.perLick * Math.min(distinct, QUOTE_BONUS.maxLicks);
}

/**
 * Problems of a set of licks against the lick rules (design 3.1); empty when the set is valid.
 * Each lick has LICK_STEPS.min to LICK_STEPS.max distinct steps on the grid and at least one odd
 * step (so tapping every beat never quotes it); ids are unique and no two licks share their steps.
 */
export function lickProblems(licks: readonly Lick[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const shapes = new Map<string, string>();
  for (const lick of licks) {
    const steps = lick.steps;
    if (steps.length < LICK_STEPS.min || steps.length > LICK_STEPS.max) {
      problems.push(
        `${lick.id} has ${steps.length} steps, expected ${LICK_STEPS.min}-${LICK_STEPS.max}`,
      );
    }
    if (steps.some((step) => !Number.isInteger(step) || step < 0 || step >= GRID_STEPS)) {
      problems.push(`${lick.id} has a step outside the grid`);
    }
    if (new Set(steps).size !== steps.length) problems.push(`${lick.id} repeats a step`);
    if (!steps.some((step) => step % 2 === 1)) problems.push(`${lick.id} has no odd step`);

    if (ids.has(lick.id)) problems.push(`${lick.id} is not a unique id`);
    ids.add(lick.id);

    const shape = [...new Set(steps)].sort((a, b) => a - b).join(',');
    const twin = shapes.get(shape);
    if (twin !== undefined) problems.push(`${lick.id} has the same steps as ${twin}`);
    else shapes.set(shape, lick.id);
  }
  return problems;
}
