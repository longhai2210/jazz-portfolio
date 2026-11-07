import { FEEL_SINGLE_BUTTON_MAX } from './config';
import {
  buttonVariety,
  FEEL_MIN_REST_STEPS,
  rest,
  rhythmVariety,
  scoreFeel,
  type PlacedTap,
} from './feel';
import type { Button } from './types';

const D: Button = 0;
const F: Button = 1;
const J: Button = 2;
const K: Button = 3;

/** Taps in one bar at the given steps; buttons cycle D F J K unless given. */
function bar(barIndex: number, steps: readonly number[], buttons?: readonly Button[]): PlacedTap[] {
  return steps.map((step, index) => ({
    bar: barIndex,
    step,
    button: buttons ? buttons[index] : (([D, F, J, K] as const)[index % 4] as Button),
  }));
}

describe('solo feel', () => {
  it('AC-DUEL-009.1: at least 3 distinct step patterns score 1, exactly 2 score 0.5, fewer score 0', () => {
    const three = [...bar(20, [0, 2, 4]), ...bar(21, [0, 3, 6]), ...bar(22, [1, 4])];
    expect(rhythmVariety(three)).toBe(1);
    expect(rhythmVariety([...three, ...bar(23, [0, 2, 4, 6])])).toBe(1);

    // Two bars share a pattern, so 3 bars with taps make only 2 patterns.
    const two = [...bar(20, [0, 2, 4]), ...bar(21, [0, 3, 6]), ...bar(22, [0, 2, 4])];
    expect(rhythmVariety(two)).toBe(0.5);

    const one = [...bar(20, [0, 2, 4]), ...bar(21, [0, 2, 4]), ...bar(23, [0, 2, 4])];
    expect(rhythmVariety(one)).toBe(0);
    expect(rhythmVariety([])).toBe(0);

    // A pattern is the set of steps: buttons, tap order and repeated steps do not make a new one.
    const samePattern = [...bar(20, [0, 2, 4], [D, D, D]), ...bar(21, [4, 2, 0, 2], [K, J, F, D])];
    expect(rhythmVariety(samePattern)).toBe(0);
  });

  it('AC-DUEL-009.2: a rest of at least 1 beat between two taps scores 1, none scores 0', () => {
    // Steps 1 and 2 are empty between the taps at 0 and 3.
    expect(rest(bar(20, [0, 3, 4]))).toBe(1);
    // Across a bar line: step 7 of bar 20, then step 2 of bar 21.
    expect(rest([...bar(20, [5, 6, 7]), ...bar(21, [2, 3])])).toBe(1);
    // Taps given out of time order.
    expect(rest([...bar(22, [0]), ...bar(20, [6, 7])])).toBe(1);

    // An unbroken run of adjacent steps, across a bar line, has no rest.
    expect(rest([...bar(20, [4, 5, 6, 7]), ...bar(21, [0, 1, 2])])).toBe(0);
    expect(rest(bar(20, [0, 1, 1, 2]))).toBe(0);
    // Silence before the first tap or after the last is not between two taps.
    expect(rest(bar(21, [5, 6, 7]))).toBe(0);
    expect(rest(bar(21, [3]))).toBe(0);
    expect(rest([])).toBe(0);
  });

  it(`rest threshold: two taps FEEL_MIN_REST_STEPS (${FEEL_MIN_REST_STEPS}) grid steps apart count as a rest`, () => {
    expect(FEEL_MIN_REST_STEPS).toBe(2);
    expect(rest(bar(20, [0, 2]))).toBe(1);
    expect(rest(bar(20, [0, 1]))).toBe(0);
  });

  it('AC-DUEL-009.3: one button taking more than 60% of the taps outside quote bars scores 0', () => {
    expect(FEEL_SINGLE_BUTTON_MAX).toBe(0.6);

    // 4 of 5 taps on D (80%).
    expect(buttonVariety(bar(20, [0, 1, 2, 4, 6], [D, D, K, D, D]), [])).toBe(0);
    // 3 of 5 on D is exactly 60%, not more.
    expect(buttonVariety(bar(20, [0, 1, 2, 4, 6], [D, F, D, J, D]), [])).toBe(1);
    // 4 of 6 on J (66.7%).
    expect(buttonVariety(bar(20, [0, 1, 2, 3, 4, 5], [J, J, F, J, K, J]), [])).toBe(0);
    expect(buttonVariety(bar(20, [0, 2, 4, 6], [D, F, J, K]), [])).toBe(1);

    // D takes 6 of 9 taps (66.7%), all in bar 21; with bar 21 a quote, the rest is spread.
    const spreadOutsideQuote = [
      ...bar(20, [0, 4], [F, J]),
      ...bar(21, [1, 2, 4, 5, 6, 7], [D, D, D, D, D, D]),
      ...bar(22, [3], [K]),
    ];
    expect(buttonVariety(spreadOutsideQuote, [])).toBe(0);
    expect(buttonVariety(spreadOutsideQuote, [21])).toBe(1);

    // Outside the quote bar 21, 3 of 4 taps are K (75%) although only 3 of 7 overall are.
    const leaningOutsideQuote = [
      ...bar(20, [0, 2], [K, K]),
      ...bar(21, [2, 3, 6], [D, F, J]),
      ...bar(22, [1, 5], [K, D]),
    ];
    expect(buttonVariety(leaningOutsideQuote, [])).toBe(1);
    expect(buttonVariety(leaningOutsideQuote, [21])).toBe(0);

    // Every tap in a quote bar: no button can lean, the criterion holds.
    expect(buttonVariety(bar(21, [2, 3, 6], [D, D, D]), [21])).toBe(1);
    expect(buttonVariety([], [])).toBe(1);

    expect(scoreFeel({ taps: leaningOutsideQuote, quoteBars: [21] }).buttonVariety).toBe(0);
  });

  it('AC-DUEL-009.4: fewer than 3 taps give a feel of 0, otherwise the mean of the three criteria', () => {
    // 2 taps would pass rest and button variety, but the turn has too few taps.
    const twoTaps = [...bar(20, [0], [D]), ...bar(22, [4], [K])];
    expect(scoreFeel({ taps: twoTaps, quoteBars: [] })).toEqual({
      rhythmVariety: 0.5,
      rest: 1,
      buttonVariety: 1,
      score: 0,
    });
    expect(scoreFeel({ taps: [], quoteBars: [] }).score).toBe(0);

    // 3 taps: one pattern (0), a rest (1), spread buttons (1).
    const threeTaps = bar(20, [0, 4, 6], [D, F, J]);
    const three = scoreFeel({ taps: threeTaps, quoteBars: [] });
    expect(three).toMatchObject({ rhythmVariety: 0, rest: 1, buttonVariety: 1 });
    expect(three.score).toBeCloseTo(2 / 3, 10);

    // Two patterns (0.5), a rest (1), D on 4 of 6 taps (0).
    const leaning = [...bar(20, [0, 1, 2], [D, D, F]), ...bar(21, [4, 5, 6], [D, J, D])];
    const mean = scoreFeel({ taps: leaning, quoteBars: [] });
    expect(mean).toMatchObject({ rhythmVariety: 0.5, rest: 1, buttonVariety: 0 });
    expect(mean.score).toBeCloseTo(0.5, 10);

    // All three criteria met.
    const full = [...bar(20, [0, 2, 4]), ...bar(21, [0, 3, 6]), ...bar(22, [1, 4])];
    expect(scoreFeel({ taps: full, quoteBars: [] }).score).toBe(1);
  });
});
