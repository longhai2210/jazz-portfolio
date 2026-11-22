import { createBeatClock, stepTime } from './clock';
import { judgePair, melodicDirection, scoreDirection } from './direction';
import { judgeTaps } from './judge';
import type { Button, NoteJudgement, Tap, TargetNote } from './types';

const D: Button = 0;
const F: Button = 1;
const J: Button = 2;
const K: Button = 3;

/**
 * Judgements of a call whose notes sit on consecutive even steps of bar 5.
 * `player[i]` is the button the player tapped for note i, or null for a Miss.
 */
function judged(call: readonly Button[], player: readonly (Button | null)[]): NoteJudgement[] {
  return call.map((button, index) => {
    const note: TargetNote = { bar: 5, step: index * 2, button };
    const tapped = player[index];
    if (tapped === null || tapped === undefined) {
      return { note, grade: 'miss', tap: null, deltaMs: null };
    }
    return { note, grade: 'perfect', tap: { time: index, button: tapped }, deltaMs: 0 };
  });
}

function pairVerdict(
  turn: 'echo' | 'answer',
  call: [Button, Button],
  player: [Button | null, Button | null],
) {
  const [first, second] = judged(call, player);
  return judgePair(turn, first, second);
}

describe('melodic direction', () => {
  it('the direction of a pair is the sign of the button difference', () => {
    expect(melodicDirection(D, K)).toBe(1);
    expect(melodicDirection(J, F)).toBe(-1);
    expect(melodicDirection(F, F)).toBe(0);
  });

  it('AC-DUEL-005.1: in Echo a pair with both notes paired is correct when the player goes the way the opponent went', () => {
    expect(pairVerdict('echo', [D, J], [F, K])).toBe('correct');
    expect(pairVerdict('echo', [K, F], [J, D])).toBe('correct');
    expect(pairVerdict('echo', [D, J], [D, J])).toBe('correct');

    expect(pairVerdict('echo', [D, J], [K, F])).toBe('wrong');
    expect(pairVerdict('echo', [D, J], [J, J])).toBe('wrong');
    expect(pairVerdict('echo', [D, J], [D, null])).toBe('wrong');
    expect(pairVerdict('echo', [D, J], [null, J])).toBe('wrong');

    // Through the timing judge: both notes paired, player rises with the call.
    const clock = createBeatClock({ t0: 2, bpm: 84, difficulty: 'session' });
    const notes: TargetNote[] = [
      { bar: 5, step: 0, button: F },
      { bar: 5, step: 3, button: K },
    ];
    const taps: Tap[] = [
      { time: stepTime(clock, 5, 0) + 0.02, button: D },
      { time: stepTime(clock, 5, 3) - 0.03, button: J },
    ];
    const result = judgeTaps(notes, taps, { clock, offsetMs: 0, assisted: false });
    expect(result.notes.every((judgement) => judgement.tap !== null)).toBe(true);
    expect(scoreDirection('echo', result.notes)).toEqual({
      pairs: ['correct'],
      correct: 1,
      counted: 1,
      score: 1,
    });
  });

  it('AC-DUEL-005.2: in Answer a pair with both notes paired is correct only when the player goes against the opponent', () => {
    expect(pairVerdict('answer', [D, J], [K, F])).toBe('correct');
    expect(pairVerdict('answer', [K, F], [D, K])).toBe('correct');

    expect(pairVerdict('answer', [D, J], [F, K])).toBe('wrong');
    expect(pairVerdict('answer', [D, J], [J, J])).toBe('wrong');
    expect(pairVerdict('answer', [K, F], [D, D])).toBe('wrong');
    expect(pairVerdict('answer', [D, J], [K, null])).toBe('wrong');
  });

  it('AC-DUEL-005.3: a pair where the opponent repeats a button is not counted', () => {
    expect(pairVerdict('echo', [J, J], [J, J])).toBe('uncounted');
    expect(pairVerdict('echo', [J, J], [D, K])).toBe('uncounted');
    expect(pairVerdict('answer', [F, F], [K, D])).toBe('uncounted');
    expect(pairVerdict('answer', [F, F], [null, null])).toBe('uncounted');

    // D F F J: the F F pair drops out, the two others count.
    const result = scoreDirection('echo', judged([D, F, F, J], [D, F, D, K]));
    expect(result.pairs).toEqual(['correct', 'uncounted', 'correct']);
    expect(result.counted).toBe(2);
    expect(result.score).toBe(1);
  });

  it('AC-DUEL-005.4: the direction score is correct pairs over counted pairs, 1 when no pair counts', () => {
    // D F F J K, player gets the first and last counted pairs right and the middle one wrong.
    const echo = scoreDirection('echo', judged([D, F, F, J, K], [F, J, K, J, K]));
    expect(echo.pairs).toEqual(['correct', 'uncounted', 'wrong', 'correct']);
    expect(echo).toMatchObject({ correct: 2, counted: 3 });
    expect(echo.score).toBeCloseTo(2 / 3, 10);

    const answer = scoreDirection('answer', judged([D, J, F, K], [K, F, F, D]));
    expect(answer.pairs).toEqual(['correct', 'wrong', 'correct']);
    expect(answer.score).toBeCloseTo(2 / 3, 10);

    // A pair with a missed note counts and is wrong: an Echo with no taps scores 0, not 1.
    const silent = scoreDirection('echo', judged([D, F, J, K], [null, null, null, null]));
    expect(silent).toMatchObject({ correct: 0, counted: 3, score: 0 });

    // No counted pair: a call of one repeated button, a single note, or no note at all.
    expect(scoreDirection('answer', judged([J, J, J], [null, null, null])).score).toBe(1);
    expect(scoreDirection('echo', judged([K], [K])).score).toBe(1);
    expect(scoreDirection('echo', []).score).toBe(1);
  });

  it('pairs follow time order and run across bar lines', () => {
    const note = (bar: number, step: number, button: Button): NoteJudgement => ({
      note: { bar, step, button },
      grade: 'perfect',
      tap: { time: bar * 8 + step, button },
      deltaMs: 0,
    });
    // Given out of order; in time order the call is D (bar 5) -> K (bar 5) -> F (bar 6).
    const result = scoreDirection('echo', [note(6, 0, F), note(5, 6, K), note(5, 1, D)]);
    expect(result.pairs).toEqual(['correct', 'correct']);
    expect(result.counted).toBe(2);
  });
});
