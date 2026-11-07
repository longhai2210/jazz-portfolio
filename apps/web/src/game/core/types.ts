/**
 * Shared types of the duel core. Pure TypeScript: no React, three.js or browser APIs.
 *
 * Units: points in time are seconds on the audio clock (`AudioContext.currentTime`);
 * offsets, deviations and windows are milliseconds and carry an `Ms` suffix.
 */

/** One of the 4 play buttons, lowest to highest: D = 0, F = 1, J = 2, K = 3. */
export type Button = 0 | 1 | 2 | 3;

/** Difficulty level: Lounge, Session or Late Set. */
export type Difficulty = 'lounge' | 'session' | 'lateSet';

/** Which duel of the two-duel run: 1 (club 1) or 2 (club 2). */
export type DuelNumber = 1 | 2;

/** The kind of a turn: Echo, then Answer, then Solo. */
export type Turn = 'echo' | 'answer' | 'solo';

/** Timing grade of one note. */
export type Grade = 'perfect' | 'great' | 'ok' | 'miss';

/** Timing windows in ms: a deviation up to `perfect` is Perfect, and so on. */
export interface HitWindows {
  readonly perfect: number;
  readonly great: number;
  readonly ok: number;
}

/** One tap of the player: the raw audio-clock time of the input and its button. */
export interface Tap {
  /** Seconds on the audio clock, before the calibration offset is applied. */
  readonly time: number;
  readonly button: Button;
}

/** A note inside one bar: a grid step (0 to GRID_STEPS - 1) and a button. */
export interface BarNote {
  readonly step: number;
  readonly button: Button;
}

/**
 * A note the player is judged against.
 * `bar` counts bars on the duel clock: bar 0 starts at the clock's `t0`.
 */
export interface TargetNote extends BarNote {
  readonly bar: number;
}

/** The judgement of one target note. */
export interface NoteJudgement {
  readonly note: TargetNote;
  readonly grade: Grade;
  /** The tap paired with the note, or null when no tap fell inside the OK window. */
  readonly tap: Tap | null;
  /** Corrected tap time minus note time, in ms (positive is late); null when unpaired. */
  readonly deltaMs: number | null;
}

/** Result of judging a set of taps against a set of target notes. */
export interface JudgeResult {
  /** One judgement per target note, in the order the notes were given. */
  readonly notes: readonly NoteJudgement[];
  /** Taps paired with no note, in the order the taps were given. */
  readonly extraTaps: readonly Tap[];
}

/** A learned lick: a rhythm on the 8-step grid of one bar, starting at the bar's first step. */
export interface Lick {
  readonly id: string;
  readonly steps: readonly number[];
}

/** Where a bar of the opponent's call comes from. */
export type CallBarSource = 'composed' | 'player';

/** One bar of the opponent's call. `source: 'player'` marks a bar built from the player's solo. */
export interface CallBar {
  readonly notes: readonly BarNote[];
  readonly source: CallBarSource;
}
