import { createBeatClock, stepTime } from './clock';
import { LICKS } from './data/licks';
import { detectQuote, lickProblems, matchLick, pickQuote, quoteBonus } from './lick';
import type { LickMatch } from './lick';
import { callProblems, composedCall, opponentCall } from './call';
import { pickBestBar, snapToGrid } from './best-bar';
import { buildRoster, CHARACTERS } from './roster';
import { CALL_DENSITY, DIFFICULTIES } from './config';
import type { BarNote, Button, Difficulty, Lick, Tap, Turn } from './types';

const clock = createBeatClock({ t0: 10, bpm: 84, difficulty: 'session' });
const context = { clock, offsetMs: 0, assisted: false };
const tap = (bar: number, step: number, deltaMs = 0, button: Button = 1): Tap => ({
  time: stepTime(clock, bar, step) + deltaMs / 1000,
  button,
});
const duck = LICKS[0];

describe('AC-DUEL-006 licks and quotes', () => {
  it('AC-DUEL-006.1: preset licks have 3-6 steps, an odd step, and are unique', () => {
    expect(LICKS.map((l) => l.id)).toEqual(['duck', 'frog', 'windChime']);
    expect(LICKS.map((l) => [...l.steps])).toEqual([
      [2, 3, 6],
      [0, 3, 5],
      [1, 4, 6, 7],
    ]);
    for (const l of LICKS) {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.steps.length).toBeLessThanOrEqual(6);
      expect(l.steps.some((s) => s % 2 === 1)).toBe(true);
    }
    expect(new Set(LICKS.map((l) => l.steps.join(','))).size).toBe(LICKS.length);
    expect(lickProblems(LICKS)).toEqual([]);
  });

  it('AC-DUEL-006.1: lickProblems rejects bad sets', () => {
    expect(lickProblems([{ id: 'a', steps: [0, 2, 4] }])).not.toEqual([]);
    expect(lickProblems([{ id: 'a', steps: [1, 3] }])).not.toEqual([]);
    expect(lickProblems([{ id: 'a', steps: [0, 1, 2, 3, 4, 5, 6] }])).not.toEqual([]);
    expect(
      lickProblems([
        { id: 'a', steps: [1, 2, 3] },
        { id: 'b', steps: [1, 2, 3] },
      ]),
    ).not.toEqual([]);
  });

  it('AC-DUEL-006.2: Duck 2,3,6 within Great plus one extra at 0 is a Duck quote', () => {
    const taps = [tap(3, 2, 80), tap(3, 3, -85), tap(3, 6, 0), tap(3, 0, 0)];
    const q = detectQuote(taps, 3, context);
    expect(q?.lick.id).toBe('duck');
    expect(q?.bar).toBe(3);
  });

  it('AC-DUEL-006.2: exact Duck with no extra tap is a quote; Great boundary 90 ms holds', () => {
    expect(detectQuote([tap(0, 2, 90), tap(0, 3), tap(0, 6)], 0, context)?.lick.id).toBe('duck');
  });

  it('AC-DUEL-006.3: two extra taps cancel the quote', () => {
    const taps = [tap(0, 2), tap(0, 3), tap(0, 6), tap(0, 0), tap(0, 4)];
    expect(detectQuote(taps, 0, context)).toBeNull();
    expect(matchLick(duck, taps, 0, context)).toBeNull();
  });

  it('AC-DUEL-006.4: a step-3 tap that is only OK is not a quote', () => {
    expect(detectQuote([tap(0, 2), tap(0, 3, 120), tap(0, 6)], 0, context)).toBeNull();
    expect(detectQuote([tap(0, 2), tap(0, 3, 91), tap(0, 6)], 0, context)).toBeNull();
  });

  it('AC-DUEL-006.2: missing a step, or no taps, is not a quote', () => {
    expect(detectQuote([tap(0, 2), tap(0, 3)], 0, context)).toBeNull();
    expect(detectQuote([], 0, context)).toBeNull();
  });

  it('AC-DUEL-006.2: taps of other bars are ignored when matching a bar', () => {
    const taps = [tap(1, 2), tap(1, 3), tap(1, 6)];
    expect(detectQuote(taps, 2, context)).toBeNull();
    expect(detectQuote(taps, 1, context)?.bar).toBe(1);
  });

  it('AC-DUEL-006.5: the lick with more steps wins', () => {
    const big: Lick = { id: 'big', steps: [2, 3, 5, 6] };
    const taps = [tap(0, 2), tap(0, 3), tap(0, 5), tap(0, 6)];
    expect(detectQuote(taps, 0, context, [duck, big])?.lick.id).toBe('big');
    expect(detectQuote(taps, 0, context, [big, duck])?.lick.id).toBe('big');
  });

  it('AC-DUEL-006.5: equal steps, fewer extra taps wins (pickQuote)', () => {
    const a: LickMatch = { lick: { id: 'a', steps: [1, 2, 3] }, bar: 0, extraTaps: 1 };
    const b: LickMatch = { lick: { id: 'b', steps: [4, 5, 6] }, bar: 0, extraTaps: 0 };
    expect(pickQuote([a, b])?.lick.id).toBe('b');
    expect(pickQuote([b, a])?.lick.id).toBe('b');
  });

  it('AC-DUEL-006.5: still equal, the lick learned first wins', () => {
    const a: LickMatch = { lick: { id: 'a', steps: [1, 2, 3] }, bar: 0, extraTaps: 0 };
    const b: LickMatch = { lick: { id: 'b', steps: [4, 5, 6] }, bar: 0, extraTaps: 0 };
    expect(pickQuote([a, b])?.lick.id).toBe('a');
    expect(pickQuote([b, a])?.lick.id).toBe('b');
    expect(pickQuote([])).toBeNull();
    const x: Lick = { id: 'x', steps: [2, 3, 7] };
    const taps = [tap(0, 2), tap(0, 3), tap(0, 6), tap(0, 7)];
    expect(detectQuote(taps, 0, context, [duck, x])?.lick.id).toBe('duck');
    expect(detectQuote(taps, 0, context, [x, duck])?.lick.id).toBe('x');
  });

  it('AC-DUEL-006.6: Duck twice + Frog once gives 10; three distinct licks still 10', () => {
    const m = (id: string, bar: number): LickMatch => ({
      lick: { id, steps: [1, 2, 3] },
      bar,
      extraTaps: 0,
    });
    expect(quoteBonus([m('duck', 1), m('duck', 3), m('frog', 2)])).toBe(10);
    expect(quoteBonus([m('duck', 1), m('frog', 2), m('windChime', 3)])).toBe(10);
    expect(quoteBonus([m('duck', 1), m('duck', 2)])).toBe(5);
    expect(quoteBonus([])).toBe(0);
  });
});

describe('AC-DUEL-004.3 composed calls', () => {
  const turns: Turn[] = ['echo', 'answer', 'solo'];
  for (const character of CHARACTERS) {
    for (const difficulty of DIFFICULTIES) {
      for (const turn of turns) {
        it(`AC-DUEL-004.3: ${character} ${difficulty} ${turn} follows density`, () => {
          const bars = composedCall(character, difficulty, turn);
          expect(bars).toHaveLength(4);
          const d = CALL_DENSITY[difficulty];
          for (const bar of bars) {
            expect(bar.notes.length).toBeGreaterThanOrEqual(d.minNotes);
            expect(bar.notes.length).toBeLessThanOrEqual(d.maxNotes);
            expect(bar.source).toBe('composed');
            const steps = bar.notes.map((n) => n.step);
            expect(new Set(steps).size).toBe(steps.length);
            for (const s of steps) {
              expect(s).toBeGreaterThanOrEqual(0);
              expect(s).toBeLessThan(8);
              if (difficulty === 'lounge') expect(s % 2).toBe(0);
            }
          }
          expect(
            callProblems(
              bars.map((b) => b.notes),
              difficulty,
            ),
          ).toEqual([]);
        });
      }
    }
  }

  it('AC-DUEL-004.3: callProblems flags density violations', () => {
    const n = (step: number): BarNote => ({ step, button: 0 });
    const ok = [0, 2, 4].map(n);
    expect(callProblems([ok, ok, ok, ok], 'lounge')).toEqual([]);
    expect(callProblems([[0, 2].map(n), ok, ok, ok], 'lounge')).not.toEqual([]);
    expect(callProblems([[0, 1, 4].map(n), ok, ok, ok], 'lounge')).not.toEqual([]);
    expect(callProblems([ok, ok, ok, ok], 'session')).not.toEqual([]);
  });
});

describe('AC-DUEL-007 Solo opening from the player', () => {
  const best: BarNote[] = [
    { step: 0, button: 0 },
    { step: 2, button: 2 },
    { step: 5, button: 3 },
  ];
  const opts = (duel: 1 | 2, bestBar: BarNote[] | null) => ({
    character: 'aki' as const,
    difficulty: 'session' as Difficulty,
    turn: 'solo' as Turn,
    duel,
    bestBar,
  });

  it('AC-DUEL-007.1: duel 1 Solo is all composed even if a best bar is passed', () => {
    for (const bb of [null, best]) {
      const call = opponentCall(opts(1, bb));
      expect(call).toHaveLength(4);
      expect(call.every((b) => b.source === 'composed')).toBe(true);
      expect(call).toEqual(composedCall('aki', 'session', 'solo'));
    }
  });

  it('AC-DUEL-007.2: duel 2 bars 1 and 2 are the player phrase and its inversion, 3-4 composed', () => {
    const call = opponentCall(opts(2, best));
    const composed = composedCall('aki', 'session', 'solo');
    expect(call).toHaveLength(4);
    expect(call[0].notes).toEqual([
      { step: 0, button: 0 },
      { step: 2, button: 2 },
      { step: 5, button: 3 },
    ]);
    expect(call[1].notes).toEqual([
      { step: 0, button: 3 },
      { step: 2, button: 1 },
      { step: 5, button: 0 },
    ]);
    expect(call[0].source).toBe('player');
    expect(call[1].source).toBe('player');
    expect(call[2]).toEqual(composed[2]);
    expect(call[3]).toEqual(composed[3]);
    expect(call[2].source).toBe('composed');
  });

  it('AC-DUEL-007.3: duel 2 without a best bar is all composed', () => {
    const call = opponentCall(opts(2, null));
    expect(call).toEqual(composedCall('aki', 'session', 'solo'));
    expect(call.every((b) => b.source === 'composed')).toBe(true);
  });

  it('AC-DUEL-007.2: Echo/Answer in duel 2 stay composed', () => {
    for (const turn of ['echo', 'answer'] as Turn[]) {
      const call = opponentCall({ ...opts(2, best), turn });
      expect(call).toEqual(composedCall('aki', 'session', turn));
    }
  });
});

describe('AC-DUEL-008 best bar', () => {
  const bars = [9, 10, 11, 12];

  it('AC-DUEL-008.1: highest mean timing wins; a Miss counts 0 in the mean', () => {
    // bar 9: 3 perfect + 2 misses (160 ms off) => 0.6; bar 10: 3 great => 0.7
    const taps = [
      tap(9, 0),
      tap(9, 2),
      tap(9, 4),
      tap(9, 6, 160),
      tap(9, 7, 160),
      tap(10, 0, 80),
      tap(10, 2, 80),
      tap(10, 4, 80),
    ];
    const best = pickBestBar(taps, bars, context);
    expect(best?.bar).toBe(10);
    expect(best?.timing).toBeCloseTo(0.7, 9);
  });

  it('AC-DUEL-008.1: a bar with a Miss still wins if its mean is higher', () => {
    // bar 9: 3 perfect + 1 miss => 0.75; bar 10: 3 OK => 0.4
    const taps = [
      tap(9, 0),
      tap(9, 2),
      tap(9, 4),
      tap(9, 6, 160),
      tap(10, 0, 120),
      tap(10, 2, 120),
      tap(10, 4, 120),
    ];
    const best = pickBestBar(taps, bars, context);
    expect(best?.bar).toBe(9);
    expect(best?.timing).toBeCloseTo(0.75, 9);
  });

  it('AC-DUEL-008.1: needs at least 3 OK-or-better taps; 2 is not enough', () => {
    expect(pickBestBar([tap(9, 0), tap(9, 2)], bars, context)).toBeNull();
    expect(pickBestBar([tap(9, 0), tap(9, 2), tap(9, 4, 160)], bars, context)).toBeNull();
    expect(
      pickBestBar([tap(9, 0, 140), tap(9, 2, 140), tap(9, 4, 140)], bars, context)?.bar,
    ).toBe(9);
  });

  it('AC-DUEL-008.1: ties go to the earlier bar', () => {
    const taps = [tap(11, 0), tap(11, 2), tap(11, 4), tap(10, 0), tap(10, 2), tap(10, 4)];
    expect(pickBestBar(taps, bars, context)?.bar).toBe(10);
    const mixA = [tap(10, 0, 80), tap(10, 2, 120), tap(10, 4, 80)];
    const mixB = [tap(11, 0, 120), tap(11, 2, 80), tap(11, 4, 80)];
    expect(pickBestBar([...mixB, ...mixA], bars, context)?.bar).toBe(10);
  });

  it('AC-DUEL-008.1: taps outside the given Solo bars are ignored', () => {
    expect(pickBestBar([tap(2, 0), tap(2, 2), tap(2, 4)], bars, context)).toBeNull();
  });

  it('AC-DUEL-008.2: a tap 30 ms off the grid lands exactly on the nearest step', () => {
    const taps = [tap(9, 1, 30, 2), tap(9, 3, -30, 3), tap(9, 6, 0, 0)];
    const best = pickBestBar(taps, bars, context);
    expect(best?.notes).toEqual([
      { step: 1, button: 2 },
      { step: 3, button: 3 },
      { step: 6, button: 0 },
    ]);
    const g = snapToGrid(taps[0], context);
    expect(g.step).toBe(1);
    expect(g.bar).toBe(9);
    expect(g.deltaMs).toBeCloseTo(30, 3);
  });

  it('AC-DUEL-008.2: calibration offset is applied before snapping', () => {
    const ctx = { ...context, offsetMs: 50 };
    const g = snapToGrid(tap(9, 2, 50), ctx);
    expect(g.step).toBe(2);
    expect(g.deltaMs).toBeCloseTo(0, 3);
  });

  it('AC-DUEL-008.3: no bar with 3 OK taps means no best bar', () => {
    expect(pickBestBar([], bars, context)).toBeNull();
    expect(pickBestBar([tap(9, 0), tap(10, 2), tap(11, 4)], bars, context)).toBeNull();
  });
});

describe('AC-DUEL-012 roster', () => {
  const ids = (r: ReturnType<typeof buildRoster>) =>
    ([1, 2, 3] as const).map((c) => r[c].character);

  it('AC-DUEL-012.1: Aki gets Sayo then Ren', () => {
    expect(ids(buildRoster('aki')).slice(0, 2)).toEqual(['sayo', 'ren']);
  });

  it('AC-DUEL-012.2: Sayo gets Aki then Ren; Ren gets Aki then Sayo', () => {
    expect(ids(buildRoster('sayo')).slice(0, 2)).toEqual(['aki', 'ren']);
    expect(ids(buildRoster('ren')).slice(0, 2)).toEqual(['aki', 'sayo']);
  });

  it('AC-DUEL-012.3: club 3 is the chosen character with the shadow palette; every Shadow has the flag', () => {
    for (const c of CHARACTERS) {
      const r = buildRoster(c);
      expect(r[3].character).toBe(c);
      expect(r[3].shadowPalette).toBe(true);
      for (const club of [1, 2, 3] as const) {
        expect(r[club].club).toBe(club);
        expect(r[club].shadowPalette).toBe(true);
      }
    }
  });

  it('AC-DUEL-012.2: an unknown character is rejected', () => {
    expect(() => buildRoster('bob' as never)).toThrow();
  });
});
