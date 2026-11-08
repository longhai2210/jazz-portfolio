import { BARS_PER_CALL, callProblems, composedCall, parseBarPattern, TURNS } from '../call';
import { CALL_DENSITY, DIFFICULTIES, GRID_STEPS } from '../config';
import { LICK_STEPS, lickProblems } from '../lick';
import { CHARACTERS } from '../roster';
import type { BarNote, Lick } from '../types';
import { COMPOSED_CALLS } from './calls';
import { LICK_IDS, LICKS } from './licks';

/** Every composed call in the data, with where it sits. */
const ALL_CALLS = CHARACTERS.flatMap((character) =>
  DIFFICULTIES.flatMap((difficulty) =>
    TURNS.map((turn) => ({
      character,
      difficulty,
      turn,
      label: `${character}/${difficulty}/${turn}`,
    })),
  ),
);

function bars(...patterns: string[]): BarNote[][] {
  return patterns.map(parseBarPattern);
}

describe('grey-box game data', () => {
  it('AC-DUEL-004.3: every composed call of every Shadow and level has its CALL_DENSITY of notes per bar, on the beat only at Lounge', () => {
    // The data holds exactly the 3 Shadows x 3 levels x 3 turns, 4 bars each.
    expect(Object.keys(COMPOSED_CALLS).sort()).toEqual([...CHARACTERS].sort());
    for (const character of CHARACTERS) {
      expect(Object.keys(COMPOSED_CALLS[character]).sort()).toEqual([...DIFFICULTIES].sort());
      for (const difficulty of DIFFICULTIES) {
        expect(Object.keys(COMPOSED_CALLS[character][difficulty]).sort()).toEqual(
          [...TURNS].sort(),
        );
      }
    }
    expect(ALL_CALLS).toHaveLength(27);

    for (const { character, difficulty, turn, label } of ALL_CALLS) {
      const call = composedCall(character, difficulty, turn);
      const notes = call.map((bar) => bar.notes);
      const density = CALL_DENSITY[difficulty];

      expect({ label, problems: callProblems(notes, difficulty) }).toEqual({ label, problems: [] });
      expect(call).toHaveLength(BARS_PER_CALL);
      for (const bar of notes) {
        expect(bar.length).toBeGreaterThanOrEqual(density.minNotes);
        expect(bar.length).toBeLessThanOrEqual(density.maxNotes);
        if (difficulty === 'lounge') {
          expect({ label, oddSteps: bar.filter((note) => note.step % 2 !== 0) }).toEqual({
            label,
            oddSteps: [],
          });
        }
      }
    }
  });

  it('AC-DUEL-004.3: Session and Late Set calls use steps between beats, which Lounge never does', () => {
    for (const { character, difficulty, turn, label } of ALL_CALLS) {
      if (difficulty === 'lounge') continue;
      const oddSteps = composedCall(character, difficulty, turn)
        .flatMap((bar) => bar.notes)
        .filter((note) => note.step % 2 !== 0);
      expect({ label, hasOddSteps: oddSteps.length > 0 }).toEqual({ label, hasOddSteps: true });
    }
  });

  it('AC-DUEL-004.3: the density check catches a bar with too few or too many notes, or off the beat at Lounge', () => {
    const lounge = bars('D.F.J.K.', 'K.J.F...', 'D.F.J...', 'F.J.K.J.');
    expect(callProblems(lounge, 'lounge')).toEqual([]);

    expect(callProblems(bars('D.F.....', 'K.J.F...', 'D.F.J...', 'F.J.K.J.'), 'lounge')).toEqual([
      'bar 1 has 2 notes, expected 3-4',
    ]);
    expect(callProblems(bars('D.F.J.K.', 'K.JF....', 'D.F.J...', 'F.J.K.J.'), 'lounge')).toEqual([
      'bar 2 has odd step 3',
    ]);
    expect(callProblems(bars('DFJK.JF.', 'DFJKDFJK', 'D.FJK.J.', 'KJF.D.F.'), 'session')).toEqual([
      'bar 2 has 8 notes, expected 5-7',
    ]);
    expect(callProblems(lounge.slice(0, 3), 'lounge')).toEqual(['has 3 bars, expected 4']);

    const outOfOrder: BarNote[] = [
      { step: 4, button: 0 },
      { step: 2, button: 1 },
      { step: 6, button: 2 },
    ];
    expect(callProblems([outOfOrder, ...lounge.slice(1)], 'lounge')).toEqual([
      'bar 1 has step 2 out of order or repeated',
    ]);
  });

  it('AC-DUEL-006.1: each grey-box lick has 3 to 6 steps on the 8-step grid, at least one odd step, and no two licks share their steps', () => {
    expect(lickProblems(LICKS)).toEqual([]);

    for (const lick of LICKS) {
      expect(lick.steps.length).toBeGreaterThanOrEqual(LICK_STEPS.min);
      expect(lick.steps.length).toBeLessThanOrEqual(LICK_STEPS.max);
      expect(lick.steps.every((step) => step >= 0 && step < GRID_STEPS)).toBe(true);
      expect(lick.steps.some((step) => step % 2 === 1)).toBe(true);
    }
    const shapes = LICKS.map((lick) => [...lick.steps].sort((a, b) => a - b).join(','));
    expect(new Set(shapes).size).toBe(LICKS.length);
  });

  it('AC-DUEL-006.1: the licks are the spec table, in learned order: Duck, Frog, Wind chime', () => {
    expect(LICKS).toEqual([
      { id: LICK_IDS.duck, steps: [2, 3, 6] },
      { id: LICK_IDS.frog, steps: [0, 3, 5] },
      { id: LICK_IDS.windChime, steps: [1, 4, 6, 7] },
    ]);
    expect(new Set(LICKS.map((lick) => lick.id)).size).toBe(LICKS.length);
  });

  it('AC-DUEL-006.1: the lick check catches each broken rule', () => {
    const broken: Lick[] = [
      { id: 'tooShort', steps: [1, 3] },
      { id: 'tooLong', steps: [0, 1, 2, 3, 4, 5, 6] },
      { id: 'onTheBeat', steps: [0, 2, 4, 6] },
      { id: 'offGrid', steps: [1, 3, 8] },
      { id: 'repeats', steps: [1, 1, 5] },
      { id: 'duckTwin', steps: [6, 3, 2] },
      { id: 'tooShort', steps: [1, 5, 7] },
    ];

    expect(lickProblems([LICKS[0], ...broken])).toEqual([
      'tooShort has 2 steps, expected 3-6',
      'tooLong has 7 steps, expected 3-6',
      'onTheBeat has no odd step',
      'offGrid has a step outside the grid',
      'repeats repeats a step',
      'duckTwin has the same steps as duck',
      'tooShort is not a unique id',
    ]);
  });
});
