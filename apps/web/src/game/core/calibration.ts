/**
 * Latency calibration: the player taps along with CALIBRATION_CLICKS clicks; the offset is the
 * median deviation of the valid taps. The judge subtracts it from every tap (see `correctedTime`).
 */
import {
  CALIBRATION_BPM,
  CALIBRATION_CLICKS,
  CALIBRATION_MAX_MS,
  CALIBRATION_MIN_VALID,
  CALIBRATION_SKIP_TAPS,
} from './config';
import { secondsPerBeat, secondsToMs } from './clock';

export interface CalibrationResult {
  /** Offset in ms to subtract from tap times (positive: taps land late). 0 when a retry is needed. */
  readonly offsetMs: number;
  /** Taps that counted: after the skipped leading taps, within CALIBRATION_MAX_MS. */
  readonly validTaps: number;
  /** Fewer than CALIBRATION_MIN_VALID valid taps: offset is 0 and the screen asks to calibrate again. */
  readonly needsRetry: boolean;
}

/** Audio-clock times (seconds) of the calibration clicks: one per beat from `startTime`. */
export function calibrationClickTimes(
  startTime: number,
  bpm: number = CALIBRATION_BPM,
  count: number = CALIBRATION_CLICKS,
): number[] {
  const beat = secondsPerBeat(bpm);
  return Array.from({ length: count }, (_, i) => startTime + i * beat);
}

/**
 * Deviation in ms of each tap from its nearest click, in tap time order (positive: late).
 * A tap more than half the click spacing away from its click pairs with the neighbouring click,
 * so clicks must be more than 2 × CALIBRATION_MAX_MS apart (under 120 BPM at one click per beat).
 */
export function tapDeviationsMs(
  clickTimes: readonly number[],
  tapTimes: readonly number[],
): number[] {
  if (clickTimes.length === 0) return [];
  return [...tapTimes]
    .sort((a, b) => a - b)
    .map((tap) => {
      let nearest = clickTimes[0];
      for (const click of clickTimes) {
        if (Math.abs(tap - click) < Math.abs(tap - nearest)) nearest = click;
      }
      return secondsToMs(tap - nearest);
    });
}

/**
 * Offset from tap deviations given in tap order: skips the first CALIBRATION_SKIP_TAPS, drops any
 * deviation beyond CALIBRATION_MAX_MS, and takes the median of the rest.
 */
export function calibrationOffset(deviationsMs: readonly number[]): CalibrationResult {
  const valid = deviationsMs
    .slice(CALIBRATION_SKIP_TAPS)
    .filter((deviation) => Number.isFinite(deviation) && Math.abs(deviation) <= CALIBRATION_MAX_MS);
  if (valid.length < CALIBRATION_MIN_VALID) {
    return { offsetMs: 0, validTaps: valid.length, needsRetry: true };
  }
  return { offsetMs: median(valid), validTaps: valid.length, needsRetry: false };
}

/** Calibrates from click and tap times (seconds on the audio clock). */
export function calibrate(
  clickTimes: readonly number[],
  tapTimes: readonly number[],
): CalibrationResult {
  return calibrationOffset(tapDeviationsMs(clickTimes, tapTimes));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
