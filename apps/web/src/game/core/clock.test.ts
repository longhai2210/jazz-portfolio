import {
  beatToTime,
  correctedTime,
  createBeatClock,
  nearestStep,
  secondsPerBeat,
  stepTime,
  stepToBeat,
  timeToBeat,
} from './clock';
import { BEATS_PER_BAR, DUEL_BPM, GRID_STEPS, SWING_RATIO } from './config';

const T0 = 12.345;

describe('beat clock', () => {
  it('AC-DUEL-001.1: at 96 BPM, t0 + 2.5 s is beat 4.0, the start of the second bar', () => {
    const clock = createBeatClock({ t0: T0, bpm: DUEL_BPM[2], difficulty: 'session' });

    const beat = timeToBeat(clock, T0 + 2.5);

    expect(DUEL_BPM[2]).toBe(96);
    expect(beat).toBeCloseTo(4, 9);
    expect(Math.floor(beat / BEATS_PER_BAR)).toBe(1);
    expect(stepTime(clock, 1, 0)).toBeCloseTo(T0 + 2.5, 9);
    expect(beatToTime(clock, 4)).toBeCloseTo(T0 + 2.5, 9);
  });

  it('AC-DUEL-001.2: at 84 BPM Session, bar b step s is at t0 + (8b + s) × 60 / 84 / 2 s', () => {
    const clock = createBeatClock({ t0: T0, bpm: DUEL_BPM[1], difficulty: 'session' });
    expect(DUEL_BPM[1]).toBe(84);

    for (let bar = 0; bar < 25; bar++) {
      for (let step = 0; step < GRID_STEPS; step++) {
        expect(stepTime(clock, bar, step)).toBeCloseTo(T0 + ((8 * bar + step) * 60) / 84 / 2, 9);
      }
    }
  });

  it('AC-DUEL-001.3: at Late Set an odd step falls 2/3 of a beat after the previous beat instead of 1/2', () => {
    const lateSet = createBeatClock({ t0: T0, bpm: 96, difficulty: 'lateSet' });
    const session = createBeatClock({ t0: T0, bpm: 96, difficulty: 'session' });
    const beat = secondsPerBeat(96);

    for (let bar = 0; bar < 3; bar++) {
      for (let step = 1; step < GRID_STEPS; step += 2) {
        const previousBeat = beatToTime(lateSet, bar * BEATS_PER_BAR + (step - 1) / 2);
        expect(stepTime(lateSet, bar, step) - previousBeat).toBeCloseTo(beat * SWING_RATIO, 9);
        expect(stepTime(session, bar, step) - previousBeat).toBeCloseTo(beat / 2, 9);
      }
    }
    expect(SWING_RATIO).toBeCloseTo(2 / 3, 12);
  });

  it('AC-DUEL-001.3: swing leaves even steps on the beat at Late Set', () => {
    const lateSet = createBeatClock({ t0: T0, bpm: 84, difficulty: 'lateSet' });

    for (let step = 0; step < GRID_STEPS; step += 2) {
      expect(stepToBeat(lateSet, 2, step)).toBe(2 * BEATS_PER_BAR + step / 2);
    }
  });

  it('AC-DUEL-001.4: a tap at audio time t with calibration offset o is judged at t − o', () => {
    expect(correctedTime(10, 52)).toBeCloseTo(10 - 0.052, 12);
    expect(correctedTime(10, -30)).toBeCloseTo(10.03, 12);
    expect(correctedTime(10, 0)).toBe(10);
  });

  it('snaps a time to the nearest grid step, following the swing at Late Set', () => {
    const session = createBeatClock({ t0: 0, bpm: 96, difficulty: 'session' });
    const lateSet = createBeatClock({ t0: 0, bpm: 96, difficulty: 'lateSet' });
    const beat = secondsPerBeat(96);

    expect(nearestStep(session, 2.5 + 0.03)).toMatchObject({ bar: 1, step: 0 });
    expect(nearestStep(session, 2.5 - 0.03)).toMatchObject({ bar: 1, step: 0 });
    expect(nearestStep(session, 1.6 * beat)).toMatchObject({ bar: 0, step: 3 });
    expect(nearestStep(session, 3.8 * beat)).toMatchObject({ bar: 1, step: 0 });
    expect(nearestStep(lateSet, 3.8 * beat)).toMatchObject({ bar: 0, step: 7 });
    expect(nearestStep(session, 3.3 * beat)).toMatchObject({ bar: 0, step: 7 });
    expect(nearestStep(lateSet, 3.3 * beat)).toMatchObject({ bar: 0, step: 6 });
    expect(nearestStep(lateSet, 0.6 * beat)).toMatchObject({ bar: 0, step: 1 });

    const snapped = nearestStep(lateSet, 5.7 * beat);
    expect(snapped).toMatchObject({ bar: 1, step: 3 });
    expect(snapped.time).toBeCloseTo(stepTime(lateSet, 1, 3), 12);
  });

  it('rejects a non-positive or non-finite tempo', () => {
    expect(() => createBeatClock({ t0: 0, bpm: 0, difficulty: 'session' })).toThrow(RangeError);
    expect(() => createBeatClock({ t0: 0, bpm: Number.NaN, difficulty: 'session' })).toThrow(
      RangeError,
    );
    expect(() =>
      createBeatClock({ t0: Number.POSITIVE_INFINITY, bpm: 96, difficulty: 'session' }),
    ).toThrow(RangeError);
  });
});
