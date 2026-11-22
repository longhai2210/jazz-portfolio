import { createBeatClock, stepTime, type BeatClock } from './clock';
import { DUEL_BPM, EXTRA_TAP_PENALTY, HIT_POINTS, SCORE_WEIGHTS, STAR_THRESHOLDS } from './config';
import { scoreDirection } from './direction';
import { scoreFeel } from './feel';
import { judgeTaps, type JudgeContext } from './judge';
import {
  callTurnTiming,
  isWin,
  judgeGridTaps,
  scoreDuel,
  soloTurnTiming,
  starsForTotal,
  type DuelScoreInput,
} from './scoring';
import type { BarNote, Button, Difficulty, Tap, TargetNote } from './types';

const D: Button = 0;
const F: Button = 1;
const J: Button = 2;
const K: Button = 3;

function clockAt(difficulty: Difficulty, bpm = 96): BeatClock {
  return createBeatClock({ t0: 3, bpm, difficulty });
}

function context(clock: BeatClock, offsetMs = 0): JudgeContext {
  return { clock, offsetMs, assisted: false };
}

/** A raw tap `deltaMs` away from step `step` of bar `bar`, as heard with `offsetMs` of latency. */
function tapAt(
  clock: BeatClock,
  bar: number,
  step: number,
  deltaMs: number,
  button: Button = D,
  offsetMs = 0,
): Tap {
  return { time: stepTime(clock, bar, step) + (deltaMs + offsetMs) / 1000, button };
}

function scoreInput(overrides: Partial<DuelScoreInput> = {}): DuelScoreInput {
  return {
    timing: { echo: 0, answer: 0, solo: 0 },
    direction: { echo: 0, answer: 0 },
    feel: 0,
    quoteBonus: 0,
    ...overrides,
  };
}

describe('scoring', () => {
  it('AC-DUEL-010.1: Echo and Answer timing is (note points - 0.25 per extra tap) over the target notes, never below 0', () => {
    expect(EXTRA_TAP_PENALTY).toBe(0.25);
    const clock = clockAt('session');
    const notes: TargetNote[] = [0, 2, 4, 6].map((step) => ({ bar: 5, step, button: F }));

    // Perfect, Great, OK, Miss and one extra tap: (1 + 0.7 + 0.4 + 0 - 0.25) / 4.
    const mixed = judgeTaps(
      notes,
      [
        tapAt(clock, 5, 0, 10),
        tapAt(clock, 5, 2, 60),
        tapAt(clock, 5, 4, -120),
        tapAt(clock, 5, 7, 0),
      ],
      context(clock),
    );
    expect(mixed.notes.map((judgement) => judgement.grade)).toEqual([
      'perfect',
      'great',
      'ok',
      'miss',
    ]);
    expect(mixed.extraTaps).toHaveLength(1);
    expect(callTurnTiming(mixed)).toBeCloseTo((1 + 0.7 + 0.4 - 0.25) / 4, 10);

    const clean = judgeTaps(
      notes,
      notes.map((note) => tapAt(clock, note.bar, note.step, 0)),
      context(clock),
    );
    expect(callTurnTiming(clean)).toBe(1);

    // 2 Perfect notes and 10 extra taps: (2 - 2.5) / 4 is below 0, so 0.
    const mashing = judgeTaps(
      notes,
      [
        tapAt(clock, 5, 0, 0),
        tapAt(clock, 5, 2, 0),
        ...Array.from({ length: 10 }, (_, index) => tapAt(clock, 7, index % 8, 0)),
      ],
      context(clock),
    );
    expect(mashing.extraTaps).toHaveLength(10);
    expect(callTurnTiming(mashing)).toBe(0);

    expect(callTurnTiming({ notes: [], extraTaps: [] })).toBe(0);
  });

  it('AC-DUEL-010.2: Solo timing grades each tap against its nearest grid step and averages; no taps give 0', () => {
    const clock = clockAt('session');
    const judged = judgeGridTaps(
      [tapAt(clock, 21, 0, 0, D), tapAt(clock, 21, 3, 60, J), tapAt(clock, 22, 5, -120, K)],
      context(clock),
    );
    expect(judged.map(({ bar, step, button, grade }) => ({ bar, step, button, grade }))).toEqual([
      { bar: 21, step: 0, button: D, grade: 'perfect' },
      { bar: 21, step: 3, button: J, grade: 'great' },
      { bar: 22, step: 5, button: K, grade: 'ok' },
    ]);
    expect(judged.map((judgement) => judgement.deltaMs)).toEqual([0, 60, -120]);
    expect(soloTurnTiming(judged)).toBeCloseTo((1 + 0.7 + 0.4) / 3, 10);

    // At 84 BPM a tap 170 ms after a step is still nearest to it, beyond OK: a Miss counts 0.
    const slow = clockAt('session', 84);
    const withMiss = judgeGridTaps([tapAt(slow, 21, 2, 0), tapAt(slow, 21, 4, 170)], context(slow));
    expect(withMiss.map(({ step, grade }) => ({ step, grade }))).toEqual([
      { step: 2, grade: 'perfect' },
      { step: 4, grade: 'miss' },
    ]);
    expect(soloTurnTiming(withMiss)).toBe(0.5);

    // The calibration offset comes off first, and Late Set measures odd steps on the swung grid.
    const swung = clockAt('lateSet', 84);
    const offset = judgeGridTaps([tapAt(swung, 22, 1, 0, F, 50)], context(swung, 50));
    expect(offset[0]).toMatchObject({ bar: 22, step: 1, grade: 'perfect' });
    expect(offset[0].deltaMs).toBeCloseTo(0, 6);

    expect(soloTurnTiming(judgeGridTaps([], context(clock)))).toBe(0);
  });

  it('AC-DUEL-010.3: the total is 60 x mean timing + 25 x mean direction + 15 x feel + the quote bonus', () => {
    expect(SCORE_WEIGHTS).toEqual({ timing: 60, direction: 25, feel: 15 });

    const score = scoreDuel({
      timing: { echo: 0.8, answer: 0.5, solo: 0.6 },
      direction: { echo: 0.5, answer: 1 },
      feel: 2 / 3,
      quoteBonus: 5,
    });
    expect(score.timing).toBeCloseTo(1.9 / 3, 10);
    expect(score.direction).toBe(0.75);
    expect(score.feel).toBeCloseTo(2 / 3, 10);
    expect(score.quoteBonus).toBe(5);
    // 38 + 18.75 + 10 + 5
    expect(score.total).toBe(71.75);

    // The quote bonus is added on top of the 100-point scale.
    const perfect = { timing: { echo: 1, answer: 1, solo: 1 }, direction: { echo: 1, answer: 1 } };
    expect(scoreDuel(scoreInput({ ...perfect, feel: 1, quoteBonus: 10 })).total).toBe(110);
    expect(scoreDuel(scoreInput({ quoteBonus: 10 })).total).toBe(10);
  });

  it('AC-DUEL-010.4: totals 39, 40, 65 and 85 give 0, 1, 2 and 3 stars; 1 star or more wins', () => {
    expect(STAR_THRESHOLDS).toEqual([40, 65, 85]);
    expect([39, 40, 65, 85].map(starsForTotal)).toEqual([0, 1, 2, 3]);
    expect([39.999, 64.999, 84.999, 100, 110, 0].map(starsForTotal)).toEqual([0, 1, 2, 3, 3, 0]);
    expect(([0, 1, 2, 3] as const).map(isWin)).toEqual([false, true, true, true]);

    // Through the total: each case lands exactly on 39, 40, 65 and 85.
    const at39 = scoreDuel(scoreInput({ timing: { echo: 0.65, answer: 0.65, solo: 0.65 } }));
    const at40 = scoreDuel(
      scoreInput({
        timing: { echo: 0.5, answer: 0.5, solo: 0.5 },
        direction: { echo: 0.4, answer: 0.4 },
      }),
    );
    const at65 = scoreDuel(
      scoreInput({
        timing: { echo: 0.75, answer: 0.75, solo: 0.75 },
        direction: { echo: 0.8, answer: 0.8 },
      }),
    );
    const at85 = scoreDuel(
      scoreInput({ timing: { echo: 1, answer: 1, solo: 1 }, direction: { echo: 1, answer: 1 } }),
    );
    expect(
      [at39, at40, at65, at85].map(({ total, stars, won }) => ({ total, stars, won })),
    ).toEqual([
      { total: 39, stars: 0, won: false },
      { total: 40, stars: 1, won: true },
      { total: 65, stars: 2, won: true },
      { total: 85, stars: 3, won: true },
    ]);
  });

  it('AC-DUEL-010.5: every note Perfect, every direction right, feel 1 and no quote give 3 stars', () => {
    const clock = clockAt('session', DUEL_BPM[1]);
    const offsetMs = 30;
    const judge = context(clock, offsetMs);
    // Within the Perfect window, never on the dot.
    const jitter = [12, -25, 0, 38, -8, 20, -40];
    const mirror: Record<Button, Button> = { 0: 3, 1: 2, 2: 1, 3: 0 };
    const call: BarNote[] = [
      { step: 0, button: D },
      { step: 2, button: F },
      { step: 3, button: J },
      { step: 4, button: F },
      { step: 6, button: K },
    ];
    const targets = (firstBar: number): TargetNote[] =>
      [0, 1, 2, 3].flatMap((offset) => call.map((note) => ({ ...note, bar: firstBar + offset })));
    const play = (notes: readonly TargetNote[], buttonOf: (button: Button) => Button) =>
      notes.map((note, index) =>
        tapAt(
          clock,
          note.bar,
          note.step,
          jitter[index % jitter.length],
          buttonOf(note.button),
          offsetMs,
        ),
      );

    // Echo on bars 5-8 repeats the call; Answer on bars 13-16 mirrors its buttons.
    const echoTargets = targets(5);
    const echo = judgeTaps(
      echoTargets,
      play(echoTargets, (button) => button),
      judge,
    );
    const answerTargets = targets(13);
    const answer = judgeTaps(
      answerTargets,
      play(answerTargets, (button) => mirror[button]),
      judge,
    );
    for (const turn of [echo, answer]) {
      expect(turn.notes.every((judgement) => judgement.grade === 'perfect')).toBe(true);
      expect(turn.extraTaps).toHaveLength(0);
    }

    // Solo on bars 21-24: three step patterns, a rest, buttons spread.
    const soloNotes = [
      { bar: 21, step: 0, button: D },
      { bar: 21, step: 2, button: F },
      { bar: 21, step: 4, button: J },
      { bar: 22, step: 0, button: K },
      { bar: 22, step: 3, button: J },
      { bar: 22, step: 6, button: F },
      { bar: 23, step: 1, button: D },
      { bar: 23, step: 4, button: K },
    ];
    const solo = judgeGridTaps(
      play(soloNotes, (button) => button),
      judge,
    );
    expect(solo.every((judgement) => judgement.grade === 'perfect')).toBe(true);

    const echoDirection = scoreDirection('echo', echo.notes);
    const answerDirection = scoreDirection('answer', answer.notes);
    expect(echoDirection.counted).toBe(echoTargets.length - 1);
    expect(answerDirection.counted).toBe(answerTargets.length - 1);
    const feel = scoreFeel({ taps: solo, quoteBars: [] });
    expect(feel.score).toBe(1);

    const score = scoreDuel({
      timing: {
        echo: callTurnTiming(echo),
        answer: callTurnTiming(answer),
        solo: soloTurnTiming(solo),
      },
      direction: { echo: echoDirection.score, answer: answerDirection.score },
      feel: feel.score,
      quoteBonus: 0,
    });
    expect(HIT_POINTS.perfect).toBe(1);
    expect(score).toEqual({
      timing: 1,
      direction: 1,
      feel: 1,
      quoteBonus: 0,
      total: 100,
      stars: 3,
      won: true,
    });
  });
});
