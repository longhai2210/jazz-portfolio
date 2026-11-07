import { createBeatClock, stepTime, stepToBeat, timeToBeat, correctedTime } from './clock';
import { calibrate, calibrationClickTimes } from './calibration';
import { judgeTaps } from './judge';
import type { Difficulty, Tap, TargetNote } from './types';

const clockOf = (difficulty: Difficulty, bpm = 84, t0 = 10) => createBeatClock({ t0, bpm, difficulty });
const ctx = (difficulty: Difficulty, o: { offsetMs?: number; assisted?: boolean } = {}) => ({
  clock: clockOf(difficulty),
  offsetMs: o.offsetMs ?? 0,
  assisted: o.assisted ?? false,
});
const note = (step: number, bar = 0): TargetNote => ({ bar, step, button: 1 });
const tapAt = (difficulty: Difficulty, step: number, deltaMs: number, bar = 0): Tap => ({
  time: stepTime(clockOf(difficulty), bar, step) + deltaMs / 1000,
  button: 1,
});

describe('AC-DUEL-001 beat clock', () => {
  it('AC-DUEL-001.1: BPM 96, t0 + 2.5 s is beat 4.0', () => {
    const c = createBeatClock({ t0: 3.2, bpm: 96, difficulty: 'session' });
    expect(timeToBeat(c, 3.2 + 2.5)).toBeCloseTo(4.0, 9);
  });

  it('AC-DUEL-001.2: BPM 84 Session, bar b step s is t0 + (8b+s)*60/84/2', () => {
    const c = clockOf('session', 84, 5);
    for (const [b, s] of [[0, 0], [0, 7], [1, 3], [5, 5], [24, 7]]) {
      expect(stepTime(c, b, s)).toBeCloseTo(5 + ((8 * b + s) * 60) / 84 / 2, 9);
    }
  });

  it('AC-DUEL-001.3: Late Set odd step sits at 2/3 of the beat; other levels at 1/2', () => {
    expect(stepToBeat(clockOf('lateSet'), 0, 1)).toBeCloseTo(2 / 3, 9);
    expect(stepToBeat(clockOf('lateSet'), 1, 3)).toBeCloseTo(4 + 1 + 2 / 3, 9);
    expect(stepToBeat(clockOf('lateSet'), 0, 2)).toBeCloseTo(1, 9);
    expect(stepToBeat(clockOf('session'), 0, 1)).toBeCloseTo(0.5, 9);
    expect(stepToBeat(clockOf('lounge'), 0, 1)).toBeCloseTo(0.5, 9);
  });

  it('AC-DUEL-001.4: judging time is t - o', () => {
    expect(correctedTime(10.2, 50)).toBeCloseTo(10.15, 9);
    expect(correctedTime(10.2, 0)).toBeCloseTo(10.2, 9);
    expect(correctedTime(10.2, -30)).toBeCloseTo(10.23, 9);
    // 100 ms late on the raw clock with a 60 ms offset is judged 40 ms late: Perfect
    const r = judgeTaps([note(2)], [tapAt('session', 2, 100)], ctx('session', { offsetMs: 60 }));
    expect(r.notes[0].grade).toBe('perfect');
    expect(r.notes[0].deltaMs).toBeCloseTo(40, 3);
  });
});

describe('AC-DUEL-002 calibration', () => {
  const clicks = calibrationClickTimes(20, 90, 8);
  const tapsWith = (devs: number[]) => devs.map((d, i) => clicks[i] + d / 1000);

  it('AC-DUEL-002.1: median of in-range deviations, +300 ms dropped, first 2 taps skipped', () => {
    const r = calibrate(clicks, tapsWith([200, -180, 40, 55, 60, 48, 52, 300]));
    expect(r.offsetMs).toBeCloseTo(52, 3);
    expect(r.validTaps).toBe(5);
    expect(r.needsRetry).toBe(false);
  });

  it('AC-DUEL-002.1: the first 2 are by time even if taps arrive unordered', () => {
    const taps = tapsWith([200, -180, 40, 55, 60, 48, 52, 300]).reverse();
    expect(calibrate(clicks, taps).offsetMs).toBeCloseTo(52, 3);
  });

  it('AC-DUEL-002.1: a +300 ms tap pairs with its own click at 90 BPM, not the next', () => {
    const r = calibrate(clicks, tapsWith([0, 0, 40, 40, 40, 40, 40, 300]));
    expect(r.validTaps).toBe(5);
    expect(r.offsetMs).toBeCloseTo(40, 3);
  });

  it('AC-DUEL-002.1: deviation of exactly 250 ms counts, 251 does not', () => {
    expect(calibrate(clicks, tapsWith([0, 0, 250, 250, 250, 250])).validTaps).toBe(4);
    expect(calibrate(clicks, tapsWith([0, 0, 251, 251, 251, 251])).validTaps).toBe(0);
  });

  it('AC-DUEL-002.2: fewer than 4 valid taps gives offset 0 and retry', () => {
    const r = calibrate(clicks, tapsWith([0, 0, 40, 50, 60]));
    expect(r).toMatchObject({ offsetMs: 0, validTaps: 3, needsRetry: true });
  });

  it('AC-DUEL-002.2: no taps gives offset 0 and retry', () => {
    expect(calibrate(clicks, [])).toMatchObject({ offsetMs: 0, needsRetry: true });
  });

  it('AC-DUEL-002.2: exactly 4 valid taps is enough', () => {
    const r = calibrate(clicks, tapsWith([0, 0, 30, 30, 30, 30]));
    expect(r.needsRetry).toBe(false);
    expect(r.offsetMs).toBeCloseTo(30, 3);
  });
});

describe('AC-DUEL-003 note judging', () => {
  const grade = (d: Difficulty, deltaMs: number, o = {}) =>
    judgeTaps([note(2)], [tapAt(d, 2, deltaMs)], ctx(d, o)).notes[0].grade;

  it('AC-DUEL-003.1: Session 40 ms is Perfect (45 included, 46 is not)', () => {
    expect(grade('session', 40)).toBe('perfect');
    expect(grade('session', -40)).toBe('perfect');
    expect(grade('session', 45)).toBe('perfect');
    expect(grade('session', 46)).toBe('great');
  });

  it('AC-DUEL-003.2: Session 100 ms is OK (Great ends at 90, OK at 140)', () => {
    expect(grade('session', 100)).toBe('ok');
    expect(grade('session', 90)).toBe('great');
    expect(grade('session', 91)).toBe('ok');
    expect(grade('session', 140)).toBe('ok');
  });

  it('AC-DUEL-003.3: Lounge 120 ms is Great (window 126 ms)', () => {
    expect(grade('lounge', 120)).toBe('great');
    expect(grade('lounge', 126)).toBe('great');
    expect(grade('lounge', 127)).toBe('ok');
    expect(grade('lounge', 196)).toBe('ok');
    expect(grade('lounge', 197)).toBe('miss');
  });

  it('AC-DUEL-003.3: Late Set windows are 0.8x', () => {
    expect(grade('lateSet', 36)).toBe('perfect');
    expect(grade('lateSet', 37)).toBe('great');
    expect(grade('lateSet', 112)).toBe('ok');
    expect(grade('lateSet', 113)).toBe('miss');
  });

  it('AC-DUEL-003.4: beyond the OK window is Miss and other notes still judge', () => {
    const r = judgeTaps(
      [note(0), note(4)],
      [tapAt('session', 0, 141), tapAt('session', 4, 0)],
      ctx('session'),
    );
    expect(r.notes.map((n) => n.grade)).toEqual(['miss', 'perfect']);
  });

  it('AC-DUEL-003.4: no taps gives all Miss without throwing', () => {
    const r = judgeTaps([note(0), note(4)], [], ctx('session'));
    expect(r.notes.map((n) => n.grade)).toEqual(['miss', 'miss']);
    expect(r.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.4: a tap outside every OK window is an extra tap', () => {
    const t = tapAt('session', 0, 141);
    const r = judgeTaps([note(0)], [t], ctx('session'));
    expect(r.extraTaps).toEqual([t]);
  });

  it('AC-DUEL-003.5: the closer of two taps pairs with the note, the other is extra', () => {
    const near = tapAt('session', 2, 20);
    const far = tapAt('session', 2, -60);
    for (const taps of [[near, far], [far, near]]) {
      const r = judgeTaps([note(2)], taps, ctx('session'));
      expect(r.notes[0].tap).toBe(near);
      expect(r.notes[0].grade).toBe('perfect');
      expect(r.extraTaps).toEqual([far]);
    }
  });

  it('AC-DUEL-003.5: one tap pairs with at most one note', () => {
    const t = tapAt('lounge', 2, 150);
    const r = judgeTaps([note(2), note(3)], [t], ctx('lounge'));
    expect(r.notes.filter((n) => n.tap !== null).length).toBeLessThanOrEqual(1);
  });

  it('AC-DUEL-003.5: each note pairs its own tap when taps are in order', () => {
    const t1 = tapAt('session', 0, 10);
    const t2 = tapAt('session', 1, -10);
    const r = judgeTaps([note(0), note(1)], [t1, t2], ctx('session'));
    expect(r.notes[0].tap).toBe(t1);
    expect(r.notes[1].tap).toBe(t2);
    expect(r.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.6: assisted multiplies every window by 1.15', () => {
    expect(grade('session', 50, { assisted: true })).toBe('perfect');
    expect(grade('session', 50)).toBe('great');
    expect(grade('session', 100, { assisted: true })).toBe('great');
    expect(grade('session', 160, { assisted: true })).toBe('ok');
    expect(grade('session', 162, { assisted: true })).toBe('miss');
    expect(grade('session', 150)).toBe('miss');
  });
});
