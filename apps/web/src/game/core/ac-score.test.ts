import { createBeatClock, stepTime } from './clock';
import { scoreDirection } from './direction';
import { laneGuides, timingWindows } from './difficulty';
import { scoreFeel, type PlacedTap } from './feel';
import {
  callTurnTiming,
  isWin,
  judgeGridTaps,
  scoreDuel,
  soloTurnTiming,
  starsForTotal,
} from './scoring';
import type { Button, Difficulty, Grade, JudgeResult, NoteJudgement, Tap } from './types';

const nj = (bar: number, step: number, button: Button, tapButton: Button | null, grade: Grade = 'perfect'): NoteJudgement => ({
  note: { bar, step, button },
  grade: tapButton === null ? 'miss' : grade,
  tap: tapButton === null ? null : { time: 0, button: tapButton },
  deltaMs: tapButton === null ? null : 0,
});
const pt = (bar: number, step: number, button: Button = 0): PlacedTap => ({ bar, step, button });

describe('AC-DUEL-005 melodic direction', () => {
  it('AC-DUEL-005.1: Echo pair is correct when the player moves the same way', () => {
    expect(scoreDirection('echo', [nj(0, 0, 0, 1), nj(0, 2, 2, 3)]).score).toBe(1);
    expect(scoreDirection('echo', [nj(0, 0, 3, 2), nj(0, 2, 1, 0)]).score).toBe(1);
    expect(scoreDirection('echo', [nj(0, 0, 0, 3), nj(0, 2, 2, 0)]).correct).toBe(0);
  });

  it('AC-DUEL-005.1: a pair with an unmatched note is not correct', () => {
    expect(scoreDirection('echo', [nj(0, 0, 0, 1), nj(0, 2, 2, null)]).correct).toBe(0);
    expect(scoreDirection('echo', [nj(0, 0, 0, null), nj(0, 2, 2, 3)]).correct).toBe(0);
  });

  it('AC-DUEL-005.2: Answer pair is correct only when the player moves the opposite way', () => {
    expect(scoreDirection('answer', [nj(0, 0, 0, 3), nj(0, 2, 2, 0)]).score).toBe(1);
    expect(scoreDirection('answer', [nj(0, 0, 0, 0), nj(0, 2, 2, 3)]).correct).toBe(0); // same way
    expect(scoreDirection('answer', [nj(0, 0, 0, 1), nj(0, 2, 2, 1)]).correct).toBe(0); // repeated button
  });

  it('AC-DUEL-005.3: a pair where the opponent repeats a button is not counted', () => {
    const r = scoreDirection('echo', [nj(0, 0, 1, 1), nj(0, 2, 1, 2), nj(0, 4, 3, 3)]);
    expect(r.counted).toBe(1);
    expect(r.pairs[0]).toBe('uncounted');
    const a = scoreDirection('answer', [nj(0, 0, 1, 1), nj(0, 2, 1, 1)]);
    expect(a.counted).toBe(0);
  });

  it('AC-DUEL-005.4: score is correct / counted; no counted pair gives 1', () => {
    const r = scoreDirection('echo', [nj(0, 0, 0, 0), nj(0, 2, 1, 1), nj(0, 4, 2, 3), nj(0, 6, 1, 3)]);
    expect(r.counted).toBe(3);
    expect(r.correct).toBe(2);
    expect(r.score).toBeCloseTo(2 / 3, 9);
    expect(scoreDirection('echo', []).score).toBe(1);
    expect(scoreDirection('echo', [nj(0, 0, 2, 0)]).score).toBe(1);
    expect(scoreDirection('answer', [nj(0, 0, 2, 0), nj(0, 2, 2, 3)]).score).toBe(1);
  });

  it('AC-DUEL-005.4: notes given out of order are paired in time order', () => {
    const r = scoreDirection('echo', [nj(0, 2, 2, 3), nj(0, 0, 0, 1)]);
    expect(r.score).toBe(1);
  });
});

describe('AC-DUEL-009 feel', () => {
  it('AC-DUEL-009.1: 3+ distinct bar patterns give 1, exactly 2 give 0.5, else 0', () => {
    const three = [pt(0, 0), pt(0, 2), pt(1, 1), pt(1, 4), pt(2, 3), pt(2, 6)];
    expect(scoreFeel({ taps: three, quoteBars: [] }).rhythmVariety).toBe(1);
    const two = [pt(0, 0), pt(0, 2), pt(1, 1), pt(1, 4), pt(2, 0), pt(2, 2)];
    expect(scoreFeel({ taps: two, quoteBars: [] }).rhythmVariety).toBe(0.5);
    const one = [pt(0, 0), pt(0, 2), pt(1, 0), pt(1, 2), pt(2, 2), pt(2, 0)];
    expect(scoreFeel({ taps: one, quoteBars: [] }).rhythmVariety).toBe(0);
    expect(scoreFeel({ taps: [], quoteBars: [] }).rhythmVariety).toBe(0);
  });

  it('AC-DUEL-009.2: rest needs 2 consecutive empty positions: taps at 0 and 3 count, 0 and 2 do not', () => {
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 3)], quoteBars: [] }).rest).toBe(1);
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 2)], quoteBars: [] }).rest).toBe(0);
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 1)], quoteBars: [] }).rest).toBe(0);
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 2), pt(0, 4), pt(0, 6), pt(1, 0)], quoteBars: [] }).rest).toBe(0);
  });

  it('AC-DUEL-009.2: rest is found across a bar line and with unordered taps', () => {
    expect(scoreFeel({ taps: [pt(1, 1), pt(0, 6)], quoteBars: [] }).rest).toBe(1); // 6 -> 9, 2 empty
    expect(scoreFeel({ taps: [pt(1, 0), pt(0, 7)], quoteBars: [] }).rest).toBe(0); // adjacent
    expect(scoreFeel({ taps: [pt(0, 5), pt(0, 1)], quoteBars: [] }).rest).toBe(1);
  });

  it('AC-DUEL-009.3: a button above 60% (quotes excluded) scores 0; exactly 60% scores 1', () => {
    const over = [pt(0, 0, 0), pt(0, 2, 0), pt(0, 4, 0), pt(0, 6, 1)]; // 75%
    expect(scoreFeel({ taps: over, quoteBars: [] }).buttonVariety).toBe(0);
    const exact = [pt(0, 0, 0), pt(0, 2, 0), pt(0, 4, 0), pt(0, 6, 1), pt(1, 0, 2)]; // 60%
    expect(scoreFeel({ taps: exact, quoteBars: [] }).buttonVariety).toBe(1);
    const withQuote = [pt(0, 0, 0), pt(0, 2, 0), pt(0, 4, 0), pt(0, 6, 0), pt(1, 0, 1), pt(1, 2, 2)];
    expect(scoreFeel({ taps: withQuote, quoteBars: [0] }).buttonVariety).toBe(1);
    expect(scoreFeel({ taps: withQuote, quoteBars: [] }).buttonVariety).toBe(0);
  });

  it('AC-DUEL-009.4: fewer than 3 taps gives 0; otherwise the mean of the three criteria', () => {
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 5, 1)], quoteBars: [] }).score).toBe(0);
    expect(scoreFeel({ taps: [], quoteBars: [] }).score).toBe(0);
    const full = [pt(0, 0, 0), pt(0, 3, 1), pt(1, 1, 2), pt(1, 4, 3), pt(2, 2, 0), pt(2, 7, 1)];
    expect(scoreFeel({ taps: full, quoteBars: [] }).score).toBe(1);
    expect(scoreFeel({ taps: [pt(0, 0), pt(0, 1), pt(0, 2)], quoteBars: [] }).score).toBe(0);
    const mixed = [pt(0, 0, 0), pt(0, 3, 1), pt(0, 4, 2)];
    expect(scoreFeel({ taps: mixed, quoteBars: [] }).score).toBeCloseTo(2 / 3, 9);
  });
});

describe('AC-DUEL-010 score and stars', () => {
  const jr = (grades: Grade[], extra: number): JudgeResult => ({
    notes: grades.map((g, i) => ({ note: { bar: 0, step: i, button: 0 }, grade: g, tap: null, deltaMs: null })),
    extraTaps: Array.from({ length: extra }, (): Tap => ({ time: 0, button: 0 })),
  });

  it('AC-DUEL-010.1: (note points - 0.25 * extra taps) / targets, floored at 0', () => {
    expect(callTurnTiming(jr(['perfect', 'great', 'ok', 'miss'], 0))).toBeCloseTo((1 + 0.7 + 0.4) / 4, 9);
    expect(callTurnTiming(jr(['perfect', 'perfect', 'perfect', 'perfect'], 2))).toBeCloseTo(3.5 / 4, 9);
    expect(callTurnTiming(jr(['ok', 'miss'], 5))).toBe(0);
    expect(callTurnTiming(jr(['perfect', 'perfect'], 0))).toBe(1);
  });

  it('AC-DUEL-010.2: Solo taps are graded against the nearest grid step and averaged; no taps is 0', () => {
    const clock = createBeatClock({ t0: 2, bpm: 84, difficulty: 'session' });
    const ctx = { clock, offsetMs: 0, assisted: false };
    const at = (bar: number, step: number, ms: number): Tap => ({ time: stepTime(clock, bar, step) + ms / 1000, button: 1 });
    const j = judgeGridTaps([at(0, 3, 30), at(1, 5, -100), at(2, 0, 0)], ctx);
    expect(j.map((x) => [x.bar, x.step])).toEqual([[0, 3], [1, 5], [2, 0]]);
    expect(j.map((x) => x.grade)).toEqual(['perfect', 'ok', 'perfect']);
    expect(soloTurnTiming(j)).toBeCloseTo((1 + 0.4 + 1) / 3, 9);
    expect(soloTurnTiming([])).toBe(0);
    expect(judgeGridTaps([], ctx)).toEqual([]);
  });

  it('AC-DUEL-010.2: the calibration offset is subtracted before grading', () => {
    const clock = createBeatClock({ t0: 0, bpm: 84, difficulty: 'session' });
    const base = stepTime(clock, 0, 2);
    const [a] = judgeGridTaps([{ time: base + 0.2, button: 0 }], { clock, offsetMs: 160, assisted: false });
    expect(a.step).toBe(2);
    expect(a.deltaMs).toBeCloseTo(40, 3);
    expect(a.grade).toBe('perfect');
  });

  it('AC-DUEL-010.3: total = 60*timing + 25*direction + 15*feel + bonus', () => {
    const r = scoreDuel({
      timing: { echo: 1, answer: 0.5, solo: 0 },
      direction: { echo: 1, answer: 0.5 },
      feel: 0.6,
      quoteBonus: 10,
    });
    expect(r.total).toBeCloseTo(60 * 0.5 + 25 * 0.75 + 15 * 0.6 + 10, 6);
    expect(r.timing).toBeCloseTo(0.5, 9);
    expect(r.direction).toBeCloseTo(0.75, 9);
  });

  it('AC-DUEL-010.4: totals 39, 40, 65, 85 give 0, 1, 2, 3 stars; 1 star or more wins', () => {
    expect([39, 40, 65, 85].map(starsForTotal)).toEqual([0, 1, 2, 3]);
    expect([0, 39.999, 64.999, 84.999, 100, 110].map(starsForTotal)).toEqual([0, 0, 1, 2, 3, 3]);
    expect(([0, 1, 2, 3] as const).map((s) => isWin(s))).toEqual([false, true, true, true]);
  });

  it('AC-DUEL-010.4: stars and won come out of scoreDuel at the thresholds', () => {
    const at = (total: number) =>
      scoreDuel({ timing: { echo: 0, answer: 0, solo: 0 }, direction: { echo: 0, answer: 0 }, feel: 0, quoteBonus: total });
    expect(at(39).stars).toBe(0);
    expect(at(39).won).toBe(false);
    expect(at(40).stars).toBe(1);
    expect(at(40).won).toBe(true);
    expect(at(85).stars).toBe(3);
  });

  it('AC-DUEL-010.5: all Perfect, direction right, feel 1, no quotes gives 3 stars', () => {
    const r = scoreDuel({
      timing: { echo: 1, answer: 1, solo: 1 },
      direction: { echo: 1, answer: 1 },
      feel: 1,
      quoteBonus: 0,
    });
    expect(r.total).toBe(100);
    expect(r.stars).toBe(3);
  });

  it('AC-DUEL-010.5: floating-point noise does not drop a score across a threshold', () => {
    const r = scoreDuel({
      timing: { echo: 1, answer: 1, solo: 0.55 },
      direction: { echo: 1, answer: 1 },
      feel: 1,
      quoteBonus: 0,
    });
    expect(r.total).toBeCloseTo(60 * 0.85 + 25 + 15, 6);
    expect(r.stars).toBe(3);
  });
});

describe('AC-DUEL-011.2 lane guides', () => {
  it('AC-DUEL-011.2: Lounge shows note markers on the player turn (and beat lines on both sides)', () => {
    expect(laneGuides('lounge', 'player').noteMarkers).toBe(true);
    expect(laneGuides('lounge', 'player').beatLines).toBe(true);
    expect(laneGuides('lounge', 'opponent').noteMarkers).toBe(true);
    expect(laneGuides('lounge', 'opponent').beatLines).toBe(true);
  });

  it('AC-DUEL-011.2: Session shows note markers only while the opponent plays; beat lines always', () => {
    expect(laneGuides('session', 'opponent')).toEqual({ noteMarkers: true, beatLines: true });
    expect(laneGuides('session', 'player')).toEqual({ noteMarkers: false, beatLines: true });
  });

  it('AC-DUEL-011.2: Late Set shows neither markers nor beat lines', () => {
    for (const side of ['opponent', 'player'] as const) {
      expect(laneGuides('lateSet', side)).toEqual({ noteMarkers: false, beatLines: false });
    }
  });

  it('AC-DUEL-011.2: assistance widens every window by 1.15 at every level', () => {
    for (const d of ['lounge', 'session', 'lateSet'] as Difficulty[]) {
      const a = timingWindows(d, false);
      const b = timingWindows(d, true);
      expect(b.perfect).toBeCloseTo(a.perfect * 1.15, 6);
      expect(b.great).toBeCloseTo(a.great * 1.15, 6);
      expect(b.ok).toBeCloseTo(a.ok * 1.15, 6);
    }
    expect(timingWindows('lounge', false).great).toBeCloseTo(126, 6);
  });
});
