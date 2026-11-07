import { createBeatClock, stepTime, type BeatClock } from './clock';
import { ASSIST_MULT, DIFFICULTIES, DIFFICULTY_MULT, WINDOWS_MS } from './config';
import { gradeDelta, hitWindows, isGradeAtLeast, judgeTaps, type JudgeContext } from './judge';
import type { Button, Difficulty, Tap, TargetNote } from './types';

const T0 = 5;

function clockAt(difficulty: Difficulty, bpm = 96): BeatClock {
  return createBeatClock({ t0: T0, bpm, difficulty });
}

function context(
  clock: BeatClock,
  overrides: Partial<Omit<JudgeContext, 'clock'>> = {},
): JudgeContext {
  return { clock, offsetMs: 0, assisted: false, ...overrides };
}

function note(bar: number, step: number, button: Button = 0): TargetNote {
  return { bar, step, button };
}

/** A tap `deltaMs` away from grid step `step` of bar `bar` (positive: late). */
function tapAt(
  clock: BeatClock,
  bar: number,
  step: number,
  deltaMs: number,
  button: Button = 0,
): Tap {
  return { time: stepTime(clock, bar, step) + deltaMs / 1000, button };
}

function gradeOne(difficulty: Difficulty, deltaMs: number, assisted = false) {
  const clock = clockAt(difficulty);
  return judgeTaps([note(1, 0)], [tapAt(clock, 1, 0, deltaMs)], context(clock, { assisted }))
    .notes[0];
}

describe('timing judge', () => {
  it('AC-DUEL-003.1: at Session a tap 40 ms off the target note is Perfect', () => {
    expect(hitWindows('session', false)).toEqual(WINDOWS_MS);

    const late = gradeOne('session', 40);
    expect(late.grade).toBe('perfect');
    expect(late.deltaMs).toBe(40);
    expect(gradeOne('session', -40).grade).toBe('perfect');
  });

  it('AC-DUEL-003.2: at Session a tap 100 ms off is OK', () => {
    expect(gradeOne('session', 100).grade).toBe('ok');
    expect(gradeOne('session', -100).grade).toBe('ok');
  });

  it('AC-DUEL-003.3: at Lounge a tap 120 ms off is Great, because the Great window is 126 ms', () => {
    const windows = hitWindows('lounge', false);
    expect(windows.great).toBe(126);
    expect(windows).toEqual({ perfect: 63, great: 126, ok: 196 });

    expect(gradeOne('lounge', 120).grade).toBe('great');
    expect(gradeOne('lounge', -120).grade).toBe('great');
    expect(gradeOne('lounge', 126).grade).toBe('great');
    expect(gradeOne('session', 120).grade).toBe('ok');
  });

  it('AC-DUEL-003.4: beyond the OK window of the level the note is a Miss and judging carries on', () => {
    const clock = clockAt('session');
    const notes = [note(1, 0), note(1, 2), note(1, 4)];
    const taps = [tapAt(clock, 1, 0, 150), tapAt(clock, 1, 2, 0), tapAt(clock, 1, 4, -50)];

    const result = judgeTaps(notes, taps, context(clock));

    expect(result.notes.map((judged) => judged.grade)).toEqual(['miss', 'perfect', 'great']);
    expect(result.notes[0]).toMatchObject({ tap: null, deltaMs: null });
    expect(gradeDelta(140, hitWindows('session', false))).toBe('ok');
    expect(gradeDelta(140.5, hitWindows('session', false))).toBe('miss');
    expect(gradeDelta(120, hitWindows('lateSet', false))).toBe('miss');
    expect(gradeDelta(Number.NaN, hitWindows('session', false))).toBe('miss');
  });

  it('AC-DUEL-003.4: a note with no tap at all is a Miss', () => {
    const clock = clockAt('lounge');

    const result = judgeTaps([note(2, 0), note(2, 4)], [], context(clock));

    expect(result.notes.map((judged) => judged.grade)).toEqual(['miss', 'miss']);
    expect(result.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.5: of two taps inside one note window the closer pairs with the note and the other is extra', () => {
    const clock = clockAt('session');
    const farEarly = tapAt(clock, 1, 0, -80);
    const closeLate = tapAt(clock, 1, 0, 30);

    const result = judgeTaps([note(1, 0)], [farEarly, closeLate], context(clock));

    expect(result.notes[0]).toMatchObject({ grade: 'perfect', tap: closeLate, deltaMs: 30 });
    expect(result.extraTaps).toEqual([farEarly]);
  });

  it('AC-DUEL-003.5: a tap pairs with at most one note, the nearest one', () => {
    // At Late Set the swung step 1 and step 2 are 208 ms apart at 96 BPM, so their 112 ms OK windows overlap.
    const clock = clockAt('lateSet');
    const tap = tapAt(clock, 1, 1, 100);

    const result = judgeTaps([note(1, 1), note(1, 2)], [tap], context(clock));

    expect(result.notes[0]).toMatchObject({ grade: 'ok', tap, deltaMs: 100 });
    expect(result.notes[1]).toMatchObject({ grade: 'miss', tap: null });
    expect(result.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.5: every tap and every note pairs at most once', () => {
    const clock = clockAt('session');
    const notes = [note(1, 0), note(1, 4), note(1, 6)];
    const taps = [
      tapAt(clock, 1, 0, 10),
      tapAt(clock, 1, 0, 60),
      tapAt(clock, 1, 4, -20),
      tapAt(clock, 1, 6, 5),
    ];

    const result = judgeTaps(notes, taps, context(clock));

    const pairedTaps = result.notes.map((judged) => judged.tap);
    expect(pairedTaps).toEqual([taps[0], taps[2], taps[3]]);
    expect(new Set(pairedTaps).size).toBe(3);
    expect(result.extraTaps).toEqual([taps[1]]);
  });

  it('AC-DUEL-003.6: once the player accepts assistance every window is multiplied by 1.15', () => {
    expect(ASSIST_MULT).toBe(1.15);
    expect(hitWindows('session', true)).toEqual({ perfect: 51.75, great: 103.5, ok: 161 });
    for (const difficulty of DIFFICULTIES) {
      const assisted = hitWindows(difficulty, true);
      const base = DIFFICULTY_MULT[difficulty] * ASSIST_MULT;
      expect(assisted.perfect).toBeCloseTo(WINDOWS_MS.perfect * base, 9);
      expect(assisted.great).toBeCloseTo(WINDOWS_MS.great * base, 9);
      expect(assisted.ok).toBeCloseTo(WINDOWS_MS.ok * base, 9);
    }

    expect(gradeOne('session', 50, true).grade).toBe('perfect');
    expect(gradeOne('session', 50, false).grade).toBe('great');
    expect(gradeOne('session', 100, true).grade).toBe('great');
    expect(gradeOne('session', 100, false).grade).toBe('ok');
    expect(gradeOne('session', 150, true).grade).toBe('ok');
    expect(gradeOne('session', 150, false).grade).toBe('miss');
  });

  it('AC-DUEL-001.4: the judge grades a tap at its audio time minus the calibration offset', () => {
    const clock = clockAt('session');
    const tap = tapAt(clock, 1, 0, 100);

    const withOffset = judgeTaps([note(1, 0)], [tap], context(clock, { offsetMs: 60 })).notes[0];
    const withoutOffset = judgeTaps([note(1, 0)], [tap], context(clock, { offsetMs: 0 })).notes[0];

    expect(withOffset).toMatchObject({ grade: 'perfect', deltaMs: 40, tap });
    expect(withoutOffset).toMatchObject({ grade: 'ok', deltaMs: 100, tap });
  });

  it('pairs on timing only, whatever button the tap uses', () => {
    const clock = clockAt('session');
    const tap = tapAt(clock, 1, 0, 0, 3);

    const result = judgeTaps([note(1, 0, 0)], [tap], context(clock));

    expect(result.notes[0]).toMatchObject({ grade: 'perfect', tap });
  });

  it('counts a tap outside every OK window as an extra tap', () => {
    const clock = clockAt('session');
    const stray = tapAt(clock, 1, 0, 150);

    const result = judgeTaps([note(1, 0)], [stray], context(clock));

    expect(result.notes[0].grade).toBe('miss');
    expect(result.extraTaps).toEqual([stray]);
  });

  it('orders grades from Perfect down to Miss', () => {
    expect(isGradeAtLeast('perfect', 'ok')).toBe(true);
    expect(isGradeAtLeast('ok', 'ok')).toBe(true);
    expect(isGradeAtLeast('ok', 'great')).toBe(false);
    expect(isGradeAtLeast('miss', 'ok')).toBe(false);
  });
});
