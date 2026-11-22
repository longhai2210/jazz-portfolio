import { createBeatClock, stepTime } from './clock';
import { BUTTONS } from './config';
import { LICK_IDS, LICKS } from './data/licks';
import type { JudgeContext } from './judge';
import {
  compareMatches,
  detectQuote,
  matchLick,
  pickQuote,
  quoteBonus,
  type LickMatch,
} from './lick';
import type { Button, Difficulty, Lick, Tap } from './types';

const T0 = 2;
/** A bar of the player's Solo turn. */
const BAR = 21;

const DUCK = LICKS[0];
const FROG = LICKS[1];
const WIND_CHIME = LICKS[2];

function context(
  difficulty: Difficulty = 'session',
  overrides: Partial<Omit<JudgeContext, 'clock'>> = {},
): JudgeContext {
  return {
    clock: createBeatClock({ t0: T0, bpm: 96, difficulty }),
    offsetMs: 0,
    assisted: false,
    ...overrides,
  };
}

/** A raw tap `deltaMs` away from grid step `step` of bar `bar` once the offset is removed. */
function tapAt(
  ctx: JudgeContext,
  step: number,
  deltaMs = 0,
  button: Button = 0,
  bar: number = BAR,
): Tap {
  return { time: stepTime(ctx.clock, bar, step) + (ctx.offsetMs + deltaMs) / 1000, button };
}

/** Taps on every step of a lick, in Session's Great window but outside its Perfect window. */
function greatTaps(ctx: JudgeContext, lick: Lick, bar: number = BAR): Tap[] {
  const deltas = [60, -80, 90, -70, 75, -85];
  return lick.steps.map((step, i) => tapAt(ctx, step, deltas[i], BUTTONS[(i + 1) % 4], bar));
}

describe('lick quotes', () => {
  it('AC-DUEL-006.2: at Session, Duck on 2, 3 and 6 in the Great window plus one extra tap on 0 quotes Duck', () => {
    const ctx = context('session');
    const taps = [tapAt(ctx, 0, 0, 3), ...greatTaps(ctx, DUCK)];

    const quote = detectQuote(taps, BAR, ctx);

    expect(quote).toEqual({ lick: DUCK, bar: BAR, extraTaps: 1 });
    expect(quote?.lick.id).toBe(LICK_IDS.duck);
  });

  it('AC-DUEL-006.2: any button counts, only the steps matter, and only the taps of that bar are used', () => {
    const ctx = context('session');
    const sameButton = DUCK.steps.map((step) => tapAt(ctx, step, 0, 2));
    expect(detectQuote(sameButton, BAR, ctx)?.lick).toBe(DUCK);

    // Taps of the bars around it do not count as extra taps.
    const around = [tapAt(ctx, 0, 0, 0, BAR - 1), tapAt(ctx, 4, 0, 0, BAR + 1)];
    expect(detectQuote([...around, ...sameButton], BAR, ctx)).toEqual({
      lick: DUCK,
      bar: BAR,
      extraTaps: 0,
    });
    expect(detectQuote(sameButton, BAR + 1, ctx)).toBeNull();
  });

  it('AC-DUEL-006.2: the lick starts at the first step of the bar, so a shifted shape is no quote', () => {
    const ctx = context('session');
    const shifted = DUCK.steps.map((step) => tapAt(ctx, step + 1));

    expect(matchLick(DUCK, shifted, BAR, ctx)).toBeNull();
    expect(detectQuote(shifted, BAR, ctx)).toBeNull();
  });

  it('AC-DUEL-006.2: a tap a little early on step 0 still counts for that bar, after the calibration offset', () => {
    const ctx = context('session', { offsetMs: 52 });
    const taps = [tapAt(ctx, 0, -50), tapAt(ctx, 3, 40), tapAt(ctx, 5, -20)];

    expect(detectQuote(taps, BAR, ctx)).toEqual({ lick: FROG, bar: BAR, extraTaps: 0 });
  });

  it('AC-DUEL-006.3: Duck with two extra taps is no quote', () => {
    const ctx = context('session');
    const duck = greatTaps(ctx, DUCK);

    expect(detectQuote([...duck, tapAt(ctx, 0)], BAR, ctx)?.lick).toBe(DUCK);
    expect(detectQuote([...duck, tapAt(ctx, 0), tapAt(ctx, 7)], BAR, ctx)).toBeNull();
    // A second tap on a lick step is an extra tap too.
    expect(detectQuote([...duck, tapAt(ctx, 0), tapAt(ctx, 6, -40)], BAR, ctx)).toBeNull();
  });

  it('AC-DUEL-006.4: a tap on step 3 that is only OK means the bar does not quote Duck', () => {
    const ctx = context('session');
    const withStep3 = (deltaMs: number) => [tapAt(ctx, 2), tapAt(ctx, 3, deltaMs), tapAt(ctx, 6)];

    expect(detectQuote(withStep3(90), BAR, ctx)?.lick).toBe(DUCK);
    expect(detectQuote(withStep3(91), BAR, ctx)).toBeNull();
    expect(detectQuote(withStep3(100), BAR, ctx)).toBeNull();
    expect(detectQuote(withStep3(-100), BAR, ctx)).toBeNull();
    // Missing the step altogether is no quote either.
    expect(detectQuote([tapAt(ctx, 2), tapAt(ctx, 6)], BAR, ctx)).toBeNull();
  });

  it('AC-DUEL-006.4: the Great window follows the difficulty and the assistance', () => {
    const at = (ctx: JudgeContext, deltaMs: number) =>
      detectQuote([tapAt(ctx, 2), tapAt(ctx, 3, deltaMs), tapAt(ctx, 6)], BAR, ctx);

    // Lounge Great is 126 ms, Late Set 72 ms, Session with assistance 103.5 ms.
    expect(at(context('lounge'), 120)?.lick).toBe(DUCK);
    expect(at(context('lounge'), 127)).toBeNull();
    expect(at(context('lateSet'), 72)?.lick).toBe(DUCK);
    expect(at(context('lateSet'), 80)).toBeNull();
    expect(at(context('session', { assisted: true }), 100)?.lick).toBe(DUCK);
    expect(at(context('session', { assisted: false }), 100)).toBeNull();
  });

  it('AC-DUEL-006.5: when two licks match one bar, the lick with more steps wins', () => {
    const ctx = context('session');
    const short: Lick = { id: 'short', steps: [2, 3, 6] };
    const long: Lick = { id: 'long', steps: [2, 3, 6, 7] };
    const taps = [2, 3, 6, 7].map((step) => tapAt(ctx, step));

    expect(matchLick(short, taps, BAR, ctx)).toEqual({ lick: short, bar: BAR, extraTaps: 1 });
    expect(matchLick(long, taps, BAR, ctx)).toEqual({ lick: long, bar: BAR, extraTaps: 0 });
    expect(detectQuote(taps, BAR, ctx, [short, long])?.lick).toBe(long);
    expect(detectQuote(taps, BAR, ctx, [long, short])?.lick).toBe(long);
  });

  it('AC-DUEL-006.5: with equal steps the lick with fewer extra taps wins', () => {
    const a: Lick = { id: 'a', steps: [0, 3, 5] };
    const b: Lick = { id: 'b', steps: [1, 4, 6] };
    const oneExtra: LickMatch = { lick: a, bar: BAR, extraTaps: 1 };
    const noExtra: LickMatch = { lick: b, bar: BAR, extraTaps: 0 };

    expect(compareMatches(noExtra, oneExtra)).toBeLessThan(0);
    expect(compareMatches(oneExtra, noExtra)).toBeGreaterThan(0);
    expect(pickQuote([oneExtra, noExtra])).toBe(noExtra);
    expect(pickQuote([noExtra, oneExtra])).toBe(noExtra);
    // More steps still comes before fewer extra taps.
    const longer: LickMatch = { lick: { id: 'c', steps: [0, 2, 3, 5] }, bar: BAR, extraTaps: 1 };
    expect(pickQuote([noExtra, longer])).toBe(longer);
    expect(pickQuote([])).toBeNull();
  });

  it('AC-DUEL-006.5: with equal steps and extra taps the lick learned first wins', () => {
    const ctx = context('session');
    const first: Lick = { id: 'first', steps: [0, 2, 5] };
    const second: Lick = { id: 'second', steps: [0, 2, 4] };
    const taps = [0, 2, 4, 5].map((step) => tapAt(ctx, step));

    expect(matchLick(first, taps, BAR, ctx)?.extraTaps).toBe(1);
    expect(matchLick(second, taps, BAR, ctx)?.extraTaps).toBe(1);
    expect(detectQuote(taps, BAR, ctx, [first, second])?.lick).toBe(first);
    expect(detectQuote(taps, BAR, ctx, [second, first])?.lick).toBe(second);
  });

  it('AC-DUEL-006.6: Duck quoted twice and Frog once add 10 points; all three licks also add only 10', () => {
    const ctx = context('session');
    const taps = [
      ...greatTaps(ctx, DUCK, 21),
      ...greatTaps(ctx, DUCK, 22),
      ...greatTaps(ctx, FROG, 23),
      ...greatTaps(ctx, WIND_CHIME, 24),
    ];
    const quotes = [21, 22, 23, 24].map((bar) => detectQuote(taps, bar, ctx));
    expect(quotes.map((quote) => quote?.lick.id)).toEqual([
      LICK_IDS.duck,
      LICK_IDS.duck,
      LICK_IDS.frog,
      LICK_IDS.windChime,
    ]);
    const found = quotes.filter((quote): quote is LickMatch => quote !== null);

    expect(quoteBonus(found.slice(0, 3))).toBe(10);
    expect(quoteBonus(found)).toBe(10);
    expect(quoteBonus(found.slice(0, 2))).toBe(5);
    expect(quoteBonus([])).toBe(0);
  });
});
