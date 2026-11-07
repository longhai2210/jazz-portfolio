/**
 * Tunable constants of the duel ("Giá trị khởi đầu" in the game-duel spec).
 * Playtests change these numbers, never the logic that reads them.
 *
 * Units: windows and offsets in ms, tempo in beats per minute, ratios as fractions (0.6 = 60%).
 */
import type { Button, Difficulty, DuelNumber, Grade, HitWindows } from './types';

/** Grid steps per bar. A bar is 4 beats, so odd steps sit between two beats. */
export const GRID_STEPS = 8;

/** Beats per bar. */
export const BEATS_PER_BAR = 4;

/** Grid steps per beat (GRID_STEPS / BEATS_PER_BAR). */
export const STEPS_PER_BEAT = GRID_STEPS / BEATS_PER_BAR;

/** The 4 buttons, lowest to highest. */
export const BUTTONS: readonly Button[] = [0, 1, 2, 3];

/** Keyboard label of each button, indexed by `Button`. */
export const BUTTON_LABELS: readonly string[] = ['D', 'F', 'J', 'K'];

/** Difficulty levels, easiest first. */
export const DIFFICULTIES: readonly Difficulty[] = ['lounge', 'session', 'lateSet'];

/** Tempo of each duel in BPM: duel 1 is club 1 and duel 2 is club 2 of Hồ Làng. */
export const DUEL_BPM: Readonly<Record<DuelNumber, number>> = { 1: 84, 2: 96 };

/** Timing windows in ms at Session level (each is a maximum absolute deviation, inclusive). */
export const WINDOWS_MS: HitWindows = { perfect: 45, great: 90, ok: 140 };

/** Multiplier applied to every timing window, per difficulty. */
export const DIFFICULTY_MULT: Readonly<Record<Difficulty, number>> = {
  lounge: 1.4,
  session: 1.0,
  lateSet: 0.8,
};

/** Swing: at Late Set an odd step falls 2/3 of the way through its beat. */
export const SWING_RATIO = 2 / 3;

/** Where an odd step falls inside its beat, as a fraction of the beat: straight 1/2, swung only at Late Set. */
export const OFFBEAT_RATIO: Readonly<Record<Difficulty, number>> = {
  lounge: 1 / 2,
  session: 1 / 2,
  lateSet: SWING_RATIO,
};

/** Extra multiplier on every window once the player accepts assistance (after 2 losses in a row). */
export const ASSIST_MULT = 1.15;

/** Note points per grade. */
export const HIT_POINTS: Readonly<Record<Grade, number>> = {
  perfect: 1,
  great: 0.7,
  ok: 0.4,
  miss: 0,
};

/** Note points removed per extra tap, in Echo and Answer turns only. */
export const EXTRA_TAP_PENALTY = 0.25;

/** Weights of the 100-point score. */
export const SCORE_WEIGHTS: Readonly<{ timing: number; direction: number; feel: number }> = {
  timing: 60,
  direction: 25,
  feel: 15,
};

/** Quote bonus, added on top of the 100-point score: points per distinct lick, counted for at most `maxLicks` licks. */
export const QUOTE_BONUS: Readonly<{ perLick: number; maxLicks: number }> = {
  perLick: 5,
  maxLicks: 2,
};

/** Minimum total for 1, 2 and 3 stars (index 0 is 1 star). 1 star or more is a win. */
export const STAR_THRESHOLDS: readonly [number, number, number] = [40, 65, 85];

/** Shape of a composed opponent call, per difficulty: notes per bar (inclusive range) and allowed steps. */
export interface CallDensity {
  readonly minNotes: number;
  readonly maxNotes: number;
  /** Only even steps (on the beat). */
  readonly evenStepsOnly: boolean;
}

/** Composed call density per difficulty. Late Set calls are swung through OFFBEAT_RATIO. */
export const CALL_DENSITY: Readonly<Record<Difficulty, CallDensity>> = {
  lounge: { minNotes: 3, maxNotes: 4, evenStepsOnly: true },
  session: { minNotes: 5, maxNotes: 7, evenStepsOnly: false },
  lateSet: { minNotes: 5, maxNotes: 7, evenStepsOnly: false },
};

/** Clicks played during calibration. */
export const CALIBRATION_CLICKS = 8;

/** Leading calibration taps that are ignored. */
export const CALIBRATION_SKIP_TAPS = 2;

/** A calibration tap deviating more than this (ms, absolute) is ignored. */
export const CALIBRATION_MAX_MS = 250;

/** Fewer valid calibration taps than this gives offset 0 and asks for a retry. */
export const CALIBRATION_MIN_VALID = 4;

/** A solo bar can be the best bar only with at least this many taps graded BEST_BAR_MIN_GRADE or better. */
export const BEST_BAR_MIN_HITS = 3;

/** Grade a tap needs to count towards BEST_BAR_MIN_HITS. */
export const BEST_BAR_MIN_GRADE: Grade = 'ok';

/** Feel: one button may take at most this fraction of the solo taps (0.6 = 60%). */
export const FEEL_SINGLE_BUTTON_MAX = 0.6;
