import {
  BARS_PER_CALL,
  composedCall,
  invertButton,
  opponentCall,
  parseBarPattern,
  TURNS,
  type OpponentCallOptions,
} from './call';
import { DIFFICULTIES } from './config';
import { CHARACTERS, type Character } from './roster';
import type { BarNote, Button, Difficulty } from './types';

const D: Button = 0;
const F: Button = 1;
const J: Button = 2;
const K: Button = 3;

/** The best Solo bar of AC-DUEL-007.2: steps 0, 2, 5 with D, J, K. */
const BEST_BAR: readonly BarNote[] = [
  { step: 0, button: D },
  { step: 2, button: J },
  { step: 5, button: K },
];

function soloCall(overrides: Partial<OpponentCallOptions>) {
  return opponentCall({
    character: 'sayo',
    difficulty: 'session',
    turn: 'solo',
    duel: 2,
    bestBar: BEST_BAR,
    ...overrides,
  });
}

describe('opponent calls', () => {
  it('AC-DUEL-007.1: in duel 1 the Solo call is all 4 composed bars, even when a best bar is given', () => {
    for (const character of CHARACTERS) {
      for (const difficulty of DIFFICULTIES) {
        const composed = composedCall(character, difficulty, 'solo');

        for (const bestBar of [BEST_BAR, null]) {
          const call = soloCall({ character, difficulty, duel: 1, bestBar });
          expect(call).toEqual(composed);
          expect(call).toHaveLength(BARS_PER_CALL);
          expect(call.every((bar) => bar.source === 'composed')).toBe(true);
        }
      }
    }
  });

  it('AC-DUEL-007.2: in duel 2 the Solo call opens with the best bar as played, then inverted, then composed bars 3 and 4', () => {
    const composed = composedCall('sayo', 'session', 'solo');

    const call = soloCall({});

    expect(call).toHaveLength(BARS_PER_CALL);
    expect(call[0]).toEqual({
      source: 'player',
      notes: [
        { step: 0, button: D },
        { step: 2, button: J },
        { step: 5, button: K },
      ],
    });
    expect(call[1]).toEqual({
      source: 'player',
      notes: [
        { step: 0, button: K },
        { step: 2, button: F },
        { step: 5, button: D },
      ],
    });
    expect(call[2]).toEqual({ source: 'composed', notes: composed[2].notes });
    expect(call[3]).toEqual({ source: 'composed', notes: composed[3].notes });
  });

  it('AC-DUEL-007.2: bar 2 swaps D with K and F with J', () => {
    expect([D, F, J, K].map(invertButton)).toEqual([K, J, F, D]);
  });

  it('AC-DUEL-007.2: the player bars hold for every Shadow and difficulty, in step order, without touching the input', () => {
    const unordered: BarNote[] = [
      { step: 5, button: K },
      { step: 0, button: D },
      { step: 2, button: J },
    ];
    const snapshot = JSON.parse(JSON.stringify(unordered)) as BarNote[];

    for (const character of CHARACTERS) {
      for (const difficulty of DIFFICULTIES) {
        const call = soloCall({ character, difficulty, bestBar: unordered });
        const composed = composedCall(character, difficulty, 'solo');

        expect(call.map((bar) => bar.source)).toEqual(['player', 'player', 'composed', 'composed']);
        expect(call[0].notes).toEqual(BEST_BAR);
        expect(call[1].notes.map((note) => note.button)).toEqual([K, F, D]);
        expect(call.slice(2)).toEqual(composed.slice(2));
        expect(call[0].notes).not.toBe(unordered);
      }
    }
    expect(unordered).toEqual(snapshot);
  });

  it('AC-DUEL-007.2: only the Solo turn uses the best bar; Echo and Answer of duel 2 stay composed', () => {
    for (const turn of ['echo', 'answer'] as const) {
      const call = soloCall({ turn });
      expect(call).toEqual(composedCall('sayo', 'session', turn));
      expect(call.every((bar) => bar.source === 'composed')).toBe(true);
    }
  });

  it('AC-DUEL-007.3: in duel 2 without a best bar the Solo call is all 4 composed bars', () => {
    const cases: [Character, Difficulty][] = [
      ['sayo', 'lounge'],
      ['sayo', 'session'],
      ['ren', 'lateSet'],
      ['aki', 'session'],
    ];
    for (const [character, difficulty] of cases) {
      const composed = composedCall(character, difficulty, 'solo');

      for (const bestBar of [null, []]) {
        const call = soloCall({ character, difficulty, bestBar });
        expect(call).toEqual(composed);
        expect(call.every((bar) => bar.source === 'composed')).toBe(true);
      }
    }
  });

  it('rejects a best bar with a step outside the grid or an unknown button', () => {
    expect(() => soloCall({ bestBar: [{ step: 8, button: D }] })).toThrow(RangeError);
    expect(() => soloCall({ bestBar: [{ step: 1.5, button: D }] })).toThrow(RangeError);
    expect(() => soloCall({ bestBar: [{ step: 0, button: 4 as Button }] })).toThrow(RangeError);
  });

  it('composed calls are fresh copies with 4 bars for every Shadow, difficulty and turn', () => {
    for (const character of CHARACTERS) {
      for (const difficulty of DIFFICULTIES) {
        for (const turn of TURNS) {
          const first = composedCall(character, difficulty, turn);
          const second = composedCall(character, difficulty, turn);
          expect(first).toHaveLength(BARS_PER_CALL);
          expect(second).toEqual(first);
          expect(second[0]).not.toBe(first[0]);
          expect(second[0].notes).not.toBe(first[0].notes);
        }
      }
    }
    expect(() => composedCall('drummer' as Character, 'session', 'echo')).toThrow(RangeError);
  });

  it('parses a bar pattern into notes by step', () => {
    expect(parseBarPattern('D.J..K.F')).toEqual([
      { step: 0, button: D },
      { step: 2, button: J },
      { step: 5, button: K },
      { step: 7, button: F },
    ]);
    expect(parseBarPattern('........')).toEqual([]);
    expect(() => parseBarPattern('D.J.K.F')).toThrow(RangeError);
    expect(() => parseBarPattern('D.J.K.Fx')).toThrow(RangeError);
  });
});
