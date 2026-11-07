/**
 * Beat clock: converts between the audio clock (seconds, as read from `AudioContext.currentTime`)
 * and beats or grid steps of the duel. Beats are straight; only the odd grid steps move with swing.
 */
import { BEATS_PER_BAR, GRID_STEPS, OFFBEAT_RATIO, STEPS_PER_BEAT } from './config';
import type { Difficulty } from './types';

/** Timing context of one duel. Beat 0, the start of bar 0, is at `t0`. */
export interface BeatClock {
  /** Audio-clock time (seconds) of beat 0. */
  readonly t0: number;
  readonly bpm: number;
  /** Sets the swing of the grid; the judge reads the same field for its windows. */
  readonly difficulty: Difficulty;
}

/** A grid step located on the clock. */
export interface GridPoint {
  readonly bar: number;
  readonly step: number;
  /** Audio-clock time (seconds) of the step. */
  readonly time: number;
}

export function createBeatClock(options: {
  t0: number;
  bpm: number;
  difficulty: Difficulty;
}): BeatClock {
  const { t0, bpm, difficulty } = options;
  if (!Number.isFinite(t0)) {
    throw new RangeError(`t0 must be a finite number, got ${t0}`);
  }
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError(`bpm must be a positive number, got ${bpm}`);
  }
  return Object.freeze({ t0, bpm, difficulty });
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

/** Converts seconds to ms, rounded to the microsecond to drop floating-point noise. */
export function secondsToMs(seconds: number): number {
  return roundMs(seconds * 1000);
}

/** Rounds a ms value to the microsecond. */
export function roundMs(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

/** Beat position (fractional) of an audio-clock time. */
export function timeToBeat(clock: BeatClock, time: number): number {
  return (time - clock.t0) / secondsPerBeat(clock.bpm);
}

/** Audio-clock time of a beat position. */
export function beatToTime(clock: BeatClock, beat: number): number {
  return clock.t0 + beat * secondsPerBeat(clock.bpm);
}

/** Beat position of grid step `step` of bar `bar`, with the clock's swing on odd steps. */
export function stepToBeat(clock: BeatClock, bar: number, step: number): number {
  const beatInBar = Math.floor(step / STEPS_PER_BEAT);
  const offbeat = step % STEPS_PER_BEAT === 0 ? 0 : OFFBEAT_RATIO[clock.difficulty];
  return bar * BEATS_PER_BAR + beatInBar + offbeat;
}

/** Audio-clock time of grid step `step` of bar `bar`. */
export function stepTime(clock: BeatClock, bar: number, step: number): number {
  return beatToTime(clock, stepToBeat(clock, bar, step));
}

/** The grid step nearest to an audio-clock time, with the clock's swing. Ties go to the earlier step. */
export function nearestStep(clock: BeatClock, time: number): GridPoint {
  const beat = timeToBeat(clock, time);
  const whole = Math.floor(beat);
  const candidates = [
    { index: whole * STEPS_PER_BEAT, beat: whole },
    { index: whole * STEPS_PER_BEAT + 1, beat: whole + OFFBEAT_RATIO[clock.difficulty] },
    { index: (whole + 1) * STEPS_PER_BEAT, beat: whole + 1 },
  ];
  let best = candidates[0];
  for (const candidate of candidates) {
    if (Math.abs(candidate.beat - beat) < Math.abs(best.beat - beat)) best = candidate;
  }
  const bar = Math.floor(best.index / GRID_STEPS);
  const step = best.index - bar * GRID_STEPS;
  return { bar, step, time: stepTime(clock, bar, step) };
}

/** The time a tap is judged at: raw tap time `time` minus the calibration offset `offsetMs`. */
export function correctedTime(time: number, offsetMs: number): number {
  return time - offsetMs / 1000;
}
