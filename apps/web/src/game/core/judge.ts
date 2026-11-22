/**
 * Timing judge: grades taps against target notes on the beat clock.
 * Pairing is on timing only; buttons are scored elsewhere (melodic direction).
 */
import { ASSIST_MULT, DIFFICULTY_MULT, WINDOWS_MS } from './config';
import { correctedTime, roundMs, secondsToMs, stepTime, type BeatClock } from './clock';
import type {
  Difficulty,
  Grade,
  HitWindows,
  JudgeResult,
  NoteJudgement,
  Tap,
  TargetNote,
} from './types';

export interface JudgeContext {
  /** Note times and the difficulty (windows) both come from the clock. */
  readonly clock: BeatClock;
  /** Calibration offset in ms, subtracted from every tap time. */
  readonly offsetMs: number;
  /** The player accepted assistance: every window × ASSIST_MULT. */
  readonly assisted: boolean;
}

/** Grades from best to worst. */
export const GRADE_ORDER: readonly Grade[] = ['perfect', 'great', 'ok', 'miss'];

/** True when `grade` is `min` or better. */
export function isGradeAtLeast(grade: Grade, min: Grade): boolean {
  return GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(min);
}

/** Timing windows in ms for a difficulty: WINDOWS_MS × DIFFICULTY_MULT, × ASSIST_MULT when assisted. */
export function hitWindows(difficulty: Difficulty, assisted: boolean): HitWindows {
  const mult = DIFFICULTY_MULT[difficulty] * (assisted ? ASSIST_MULT : 1);
  return {
    perfect: roundMs(WINDOWS_MS.perfect * mult),
    great: roundMs(WINDOWS_MS.great * mult),
    ok: roundMs(WINDOWS_MS.ok * mult),
  };
}

/** Grade of a deviation in ms; window edges are inclusive. Beyond the OK window is a Miss. */
export function gradeDelta(deltaMs: number, windows: HitWindows): Grade {
  const distance = Math.abs(roundMs(deltaMs));
  if (distance <= windows.perfect) return 'perfect';
  if (distance <= windows.great) return 'great';
  if (distance <= windows.ok) return 'ok';
  return 'miss';
}

/**
 * Judges taps against target notes.
 *
 * Pairing rule: a tap and a note can pair only when the corrected tap lies inside the note's OK
 * window. Candidate pairs are taken closest first (ties: earlier note, then earlier tap), and each
 * note and each tap pairs at most once. A note left unpaired is a Miss; a tap left unpaired, even
 * one just outside every window, is an extra tap.
 */
export function judgeTaps(
  notes: readonly TargetNote[],
  taps: readonly Tap[],
  context: JudgeContext,
): JudgeResult {
  const windows = hitWindows(context.clock.difficulty, context.assisted);
  const noteTimes = notes.map((note) => stepTime(context.clock, note.bar, note.step));
  const tapTimes = taps.map((tap) => correctedTime(tap.time, context.offsetMs));

  const candidates: { note: number; tap: number; deltaMs: number }[] = [];
  noteTimes.forEach((noteTime, note) => {
    tapTimes.forEach((tapTime, tap) => {
      const deltaMs = secondsToMs(tapTime - noteTime);
      if (gradeDelta(deltaMs, windows) !== 'miss') candidates.push({ note, tap, deltaMs });
    });
  });
  candidates.sort(
    (a, b) =>
      Math.abs(a.deltaMs) - Math.abs(b.deltaMs) ||
      noteTimes[a.note] - noteTimes[b.note] ||
      tapTimes[a.tap] - tapTimes[b.tap] ||
      a.note - b.note ||
      a.tap - b.tap,
  );

  const deltaByNote = new Map<number, { tap: number; deltaMs: number }>();
  const pairedTaps = new Set<number>();
  for (const candidate of candidates) {
    if (deltaByNote.has(candidate.note) || pairedTaps.has(candidate.tap)) continue;
    deltaByNote.set(candidate.note, { tap: candidate.tap, deltaMs: candidate.deltaMs });
    pairedTaps.add(candidate.tap);
  }

  const judged: NoteJudgement[] = notes.map((note, index) => {
    const pair = deltaByNote.get(index);
    if (!pair) return { note, grade: 'miss', tap: null, deltaMs: null };
    return {
      note,
      grade: gradeDelta(pair.deltaMs, windows),
      tap: taps[pair.tap],
      deltaMs: pair.deltaMs,
    };
  });
  return { notes: judged, extraTaps: taps.filter((_, index) => !pairedTaps.has(index)) };
}
