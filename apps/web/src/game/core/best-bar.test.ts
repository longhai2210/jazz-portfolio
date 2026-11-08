import { pickBestBar, snapToGrid, tapsInBar } from './best-bar';
import { opponentCall } from './call';
import { createBeatClock, stepTime, type BeatClock } from './clock';
import type { JudgeContext } from './judge';
import type { Button, Difficulty, Tap } from './types';

const T0 = 3;
/** The player's Solo bars in a duel: count-in bar 0, then 4 + 4 bars per turn. */
const SOLO_BARS = [21, 22, 23, 24];

function context(
  difficulty: Difficulty = 'session',
  overrides: Partial<Omit<JudgeContext, 'clock'>> = {},
  bpm = 84,
): JudgeContext {
  const clock: BeatClock = createBeatClock({ t0: T0, bpm, difficulty });
  return { clock, offsetMs: 0, assisted: false, ...overrides };
}

/** A raw tap `deltaMs` away from grid step `step` of bar `bar` once the offset is removed. */
function tapAt(
  ctx: JudgeContext,
  bar: number,
  step: number,
  deltaMs: number,
  button: Button = 0,
): Tap {
  return { time: stepTime(ctx.clock, bar, step) + (ctx.offsetMs + deltaMs) / 1000, button };
}

// At Session: 0-45 ms Perfect, up to 90 Great, up to 140 OK. At 84 BPM a step lasts 357 ms,
// so a tap 170 ms off its nearest step is a Miss.
const PERFECT = 10;
const GREAT = 70;
const OK = 120;
const MISS = 170;

describe('best Solo bar', () => {
  it('AC-DUEL-008.1: only bars with 3 or more OK-or-better taps count, and the highest mean timing wins', () => {
    const ctx = context();
    const taps = [
      // Bar 21: two Perfect taps only. Mean 1, but too few hits.
      tapAt(ctx, 21, 0, PERFECT),
      tapAt(ctx, 21, 4, -PERFECT),
      // Bar 22: three OK taps. Mean 0.4.
      tapAt(ctx, 22, 0, OK),
      tapAt(ctx, 22, 2, -OK),
      tapAt(ctx, 22, 5, OK),
      // Bar 23: three Perfect and one Great. Mean 0.925.
      tapAt(ctx, 23, 0, PERFECT, 0),
      tapAt(ctx, 23, 3, -PERFECT, 1),
      tapAt(ctx, 23, 4, GREAT, 2),
      tapAt(ctx, 23, 7, PERFECT, 3),
      // Bar 24: nothing.
    ];

    const best = pickBestBar(taps, SOLO_BARS, ctx);

    expect(best).not.toBeNull();
    expect(best?.bar).toBe(23);
    expect(best?.timing).toBeCloseTo(0.925, 10);
    expect(best?.notes).toEqual([
      { step: 0, button: 0 },
      { step: 3, button: 1 },
      { step: 4, button: 2 },
      { step: 7, button: 3 },
    ]);
  });

  it('AC-DUEL-008.1: equal mean timing goes to the earlier bar, whatever the order of taps and bars', () => {
    const ctx = context();
    // Bar 22: Great, Great, Great; bar 24: Perfect, Great, OK. Both mean 0.7, though the float sums
    // differ in the last bit (0.7 + 0.7 + 0.7 < 1 + 0.7 + 0.4).
    const bar22 = [tapAt(ctx, 22, 0, GREAT), tapAt(ctx, 22, 2, GREAT), tapAt(ctx, 22, 4, -GREAT)];
    const bar24 = [tapAt(ctx, 24, 1, PERFECT), tapAt(ctx, 24, 3, GREAT), tapAt(ctx, 24, 6, OK)];

    expect(pickBestBar([...bar22, ...bar24], SOLO_BARS, ctx)?.bar).toBe(22);
    expect(pickBestBar([...bar24, ...bar22], [...SOLO_BARS].reverse(), ctx)?.bar).toBe(22);
  });

  it('AC-DUEL-008.1: the mean covers every tap of the bar against the grid, so a Miss tap counts 0', () => {
    const ctx = context();
    const threeGreat = [
      tapAt(ctx, 22, 0, GREAT),
      tapAt(ctx, 22, 2, GREAT),
      tapAt(ctx, 22, 4, GREAT),
    ];
    const threePerfect = [
      tapAt(ctx, 23, 0, PERFECT),
      tapAt(ctx, 23, 2, PERFECT),
      tapAt(ctx, 23, 4, PERFECT),
    ];

    // Bar 23 with one Miss: (1 + 1 + 1 + 0) / 4 = 0.75 beats 0.7.
    const oneMiss = pickBestBar(
      [...threeGreat, ...threePerfect, tapAt(ctx, 23, 6, MISS)],
      SOLO_BARS,
      ctx,
    );
    expect(oneMiss?.bar).toBe(23);
    expect(oneMiss?.timing).toBeCloseTo(0.75, 10);
    // The Miss tap is not carried into the bar's notes.
    expect(oneMiss?.notes.map((note) => note.step)).toEqual([0, 2, 4]);

    // With two Misses: 3 / 5 = 0.6, so bar 22 wins.
    const twoMisses = pickBestBar(
      [...threeGreat, ...threePerfect, tapAt(ctx, 23, 6, MISS), tapAt(ctx, 23, 7, MISS)],
      SOLO_BARS,
      ctx,
    );
    expect(twoMisses?.bar).toBe(22);
  });

  it('AC-DUEL-008.1: grades use the windows of the difficulty and the assistance', () => {
    // 150 ms is a Miss at Session (OK 140 ms) but OK once assisted (OK 161 ms);
    // 120 ms is Great at Lounge (Great 126 ms).
    const session = context('session');
    const sessionTaps = [0, 2, 4].map((step) => tapAt(session, 22, step, 150));
    expect(pickBestBar(sessionTaps, SOLO_BARS, session)).toBeNull();

    const assisted = context('session', { assisted: true });
    const assistedTaps = [0, 2, 4].map((step) => tapAt(assisted, 22, step, 150));
    expect(pickBestBar(assistedTaps, SOLO_BARS, assisted)?.timing).toBeCloseTo(0.4, 10);

    const lounge = context('lounge');
    const loungeTaps = [0, 2, 4].map((step) => tapAt(lounge, 22, step, 120));
    expect(pickBestBar(loungeTaps, SOLO_BARS, lounge)?.timing).toBeCloseTo(0.7, 10);
  });

  it('AC-DUEL-008.2: a tap 30 ms off its nearest grid step lands exactly on that step in the opponent call', () => {
    const ctx = context('session', { offsetMs: 52 });
    const taps = [
      // 30 ms early on step 0: its corrected time lies in bar 22, but it belongs to step 0 of bar 23.
      tapAt(ctx, 23, 0, -30, 0),
      tapAt(ctx, 23, 2, 30, 2),
      tapAt(ctx, 23, 5, -30, 3),
    ];
    expect(taps[0].time - ctx.offsetMs / 1000).toBeLessThan(stepTime(ctx.clock, 23, 0));

    const grid = taps.map((tap) => snapToGrid(tap, ctx));
    expect(grid.map(({ bar, step, deltaMs }) => ({ bar, step, deltaMs }))).toEqual([
      { bar: 23, step: 0, deltaMs: -30 },
      { bar: 23, step: 2, deltaMs: 30 },
      { bar: 23, step: 5, deltaMs: -30 },
    ]);
    expect(tapsInBar(taps, 23, ctx)).toEqual(taps);
    expect(tapsInBar(taps, 22, ctx)).toEqual([]);

    const best = pickBestBar(taps, SOLO_BARS, ctx);
    expect(best?.notes).toEqual([
      { step: 0, button: 0 },
      { step: 2, button: 2 },
      { step: 5, button: 3 },
    ]);

    const call = opponentCall({
      character: 'sayo',
      difficulty: 'session',
      turn: 'solo',
      duel: 2,
      bestBar: best?.notes ?? null,
    });
    expect(call[0].notes).toEqual([
      { step: 0, button: 0 },
      { step: 2, button: 2 },
      { step: 5, button: 3 },
    ]);
  });

  it('AC-DUEL-008.2: at Late Set an odd step is the swung one, 2/3 into its beat', () => {
    const ctx = context('lateSet', {}, 96);
    // Late Set Great is 72 ms and OK 112 ms; at 96 BPM the swung step 3 sits 417 ms into beat 2.
    const taps = [tapAt(ctx, 21, 1, 30, 1), tapAt(ctx, 21, 3, -30, 2), tapAt(ctx, 21, 6, 30, 3)];

    expect(taps.map((tap) => snapToGrid(tap, ctx).step)).toEqual([1, 3, 6]);
    expect(pickBestBar(taps, SOLO_BARS, ctx)?.notes).toEqual([
      { step: 1, button: 1 },
      { step: 3, button: 2 },
      { step: 6, button: 3 },
    ]);
  });

  it('AC-DUEL-008.2: two taps on one step give one note, from the closer tap', () => {
    const ctx = context();
    const taps = [
      tapAt(ctx, 22, 0, PERFECT, 0),
      tapAt(ctx, 22, 4, -40, 1),
      tapAt(ctx, 22, 4, 20, 3),
      tapAt(ctx, 22, 6, PERFECT, 2),
    ];

    expect(pickBestBar(taps, SOLO_BARS, ctx)?.notes).toEqual([
      { step: 0, button: 0 },
      { step: 4, button: 3 },
      { step: 6, button: 2 },
    ]);
  });

  it('AC-DUEL-008.3: no bar with 3 OK-or-better taps means there is no best bar', () => {
    const ctx = context();

    expect(pickBestBar([], SOLO_BARS, ctx)).toBeNull();

    const twoHitsEach = SOLO_BARS.flatMap((bar) => [
      tapAt(ctx, bar, 0, PERFECT),
      tapAt(ctx, bar, 4, PERFECT),
      tapAt(ctx, bar, 6, MISS),
    ]);
    expect(pickBestBar(twoHitsEach, SOLO_BARS, ctx)).toBeNull();

    const allMisses = [0, 2, 4, 6].map((step) => tapAt(ctx, 22, step, MISS));
    expect(pickBestBar(allMisses, SOLO_BARS, ctx)).toBeNull();

    // Good taps outside the Solo bars (here the opponent's bar 20) do not count.
    const outside = [0, 2, 4, 6].map((step) => tapAt(ctx, 20, step, PERFECT));
    expect(pickBestBar(outside, SOLO_BARS, ctx)).toBeNull();
  });
});
