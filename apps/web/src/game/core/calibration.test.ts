import {
  calibrate,
  calibrationClickTimes,
  calibrationOffset,
  tapDeviationsMs,
} from './calibration';
import {
  CALIBRATION_BPM,
  CALIBRATION_CLICKS,
  CALIBRATION_MAX_MS,
  CALIBRATION_MIN_VALID,
  CALIBRATION_SKIP_TAPS,
} from './config';

describe('latency calibration', () => {
  it('AC-DUEL-002.1: offset is the median of the deviations within 250 ms after skipping the first 2 taps (52 ms)', () => {
    expect(CALIBRATION_CLICKS).toBe(8);
    expect(CALIBRATION_SKIP_TAPS).toBe(2);
    expect(CALIBRATION_MAX_MS).toBe(250);

    // The two leading taps are far off on purpose: they must be skipped, not averaged in.
    const result = calibrationOffset([-200, 180, 40, 55, 60, 48, 52, 300]);

    expect(result).toEqual({ offsetMs: 52, validTaps: 5, needsRetry: false });
  });

  it('AC-DUEL-002.1: the same 52 ms offset comes from click and tap times at the 90 BPM calibration tempo', () => {
    expect(CALIBRATION_BPM).toBe(90);
    const clicks = calibrationClickTimes(3);
    const deviations = [-200, 180, 40, 55, 60, 48, 52, 300];
    const taps = clicks.map((click, i) => click + deviations[i] / 1000);

    expect(clicks).toHaveLength(CALIBRATION_CLICKS);
    expect(clicks[1] - clicks[0]).toBeCloseTo(60 / CALIBRATION_BPM, 12);
    expect(calibrationClickTimes(3, CALIBRATION_BPM)).toEqual(clicks);
    expect(tapDeviationsMs(clicks, taps)).toEqual(deviations);
    expect(calibrate(clicks, taps)).toEqual({ offsetMs: 52, validTaps: 5, needsRetry: false });
  });

  it('AC-DUEL-002.1: early taps count by their absolute deviation and an even count takes the middle mean', () => {
    expect(calibrationOffset([0, 0, -20, -10, 250, 30, -251]).offsetMs).toBe(10);
    expect(calibrationOffset([0, 0, -20, -10, 250, 30, -251]).validTaps).toBe(4);
  });

  it('AC-DUEL-002.1: taps are taken in time order, whatever order they arrive in', () => {
    const clicks = calibrationClickTimes(0);
    // In time order: two skipped taps at +240 ms, four at +50 ms, two dropped at +300 ms.
    const deviations = [240, 240, 50, 50, 50, 50, 300, 300];
    const taps = clicks.map((click, i) => click + deviations[i] / 1000);

    expect(calibrate(clicks, [...taps].reverse())).toEqual({
      offsetMs: 50,
      validTaps: 4,
      needsRetry: false,
    });
  });

  it('AC-DUEL-002.2: fewer than 4 valid taps gives offset 0 and asks for a retry', () => {
    expect(CALIBRATION_MIN_VALID).toBe(4);

    expect(calibrationOffset([40, 40, 50, 60, 300, 400, -260, 70])).toEqual({
      offsetMs: 0,
      validTaps: 3,
      needsRetry: true,
    });
    expect(calibrationOffset([50, 50, 50])).toEqual({
      offsetMs: 0,
      validTaps: 1,
      needsRetry: true,
    });
    expect(calibrationOffset([])).toEqual({ offsetMs: 0, validTaps: 0, needsRetry: true });
    expect(calibrate([], [1, 2, 3, 4, 5, 6])).toEqual({
      offsetMs: 0,
      validTaps: 0,
      needsRetry: true,
    });
  });

  it('AC-DUEL-002.2: exactly 4 valid taps is enough', () => {
    expect(calibrationOffset([0, 0, 10, 20, 30, 40, 900])).toEqual({
      offsetMs: 25,
      validTaps: 4,
      needsRetry: false,
    });
  });
});
