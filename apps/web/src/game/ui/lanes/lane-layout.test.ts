import { createBeatClock } from '../../core/clock';
import { LANE_IDENTITY, LANE_ORDER } from './lane-identity';
import {
  BAR_LINE_FRACTIONS,
  BEAT_LINE_FRACTIONS,
  barInPhase,
  clampFraction,
  playerPhraseRuns,
  stepFraction,
  timeFraction,
} from './lane-layout';

describe('lane layout', () => {
  const session = createBeatClock({ t0: 2, bpm: 120, difficulty: 'session' });
  const lateSet = createBeatClock({ t0: 2, bpm: 120, difficulty: 'lateSet' });

  it('places a grid step at its beat within the 4-bar phase on screen', () => {
    // Phase of bars 5 to 8: bar 5 step 0 is the left edge, bar 6 step 4 is beat 6 of 16.
    expect(stepFraction(session, 5, 5, 0)).toBe(0);
    expect(stepFraction(session, 5, 6, 4)).toBe(6 / 16);
    expect(stepFraction(session, 5, 5, 1)).toBe(0.5 / 16);
  });

  it('moves odd steps to 2/3 of the beat at Late Set, like the clock does', () => {
    expect(stepFraction(lateSet, 0, 0, 1)).toBeCloseTo(2 / 3 / 16, 12);
    expect(stepFraction(lateSet, 0, 0, 2)).toBe(1 / 16);
  });

  it('puts an audio-clock time on the same scale as the steps', () => {
    // 120 BPM: a beat is 0.5 s, so bar 1 starts at t0 + 2 s.
    expect(timeFraction(session, 1, 4)).toBe(0);
    expect(timeFraction(session, 1, 6)).toBe(0.25);
    expect(timeFraction(session, 1, 4 + 0.5 * 9)).toBe(stepFraction(session, 1, 3, 2));
    expect(timeFraction(session, 1, 3)).toBeLessThan(0);
  });

  it('knows the bar of the playhead only inside the phase', () => {
    expect(barInPhase(-0.01)).toBeNull();
    expect(barInPhase(0)).toBe(0);
    expect(barInPhase(0.26)).toBe(1);
    expect(barInPhase(0.999)).toBe(3);
    expect(barInPhase(1)).toBeNull();
    expect(barInPhase(Number.NaN)).toBeNull();
    expect(clampFraction(-0.2)).toBe(0);
    expect(clampFraction(1.3)).toBe(1);
  });

  it('draws a thick line at each bar start and a thin line on every other beat', () => {
    expect(BAR_LINE_FRACTIONS).toEqual([0.25, 0.5, 0.75]);
    expect(BEAT_LINE_FRACTIONS).toHaveLength(12);
    expect(BEAT_LINE_FRACTIONS).not.toContain(0.25);
    expect(BEAT_LINE_FRACTIONS[0]).toBe(1 / 16);
  });

  it('groups neighbouring bars built from the player into one run', () => {
    const bar = (source: 'player' | 'composed') => ({ source });
    expect(
      playerPhraseRuns([bar('player'), bar('player'), bar('composed'), bar('composed')]),
    ).toEqual([{ start: 0, length: 2 }]);
    expect(
      playerPhraseRuns([bar('composed'), bar('player'), bar('composed'), bar('player')]),
    ).toEqual([
      { start: 1, length: 1 },
      { start: 3, length: 1 },
    ]);
    expect(
      playerPhraseRuns([bar('composed'), bar('composed'), bar('composed'), bar('composed')]),
    ).toEqual([]);
    expect(playerPhraseRuns([])).toEqual([]);
  });

  it('AC-DUEL-013.11: the 4 lanes differ in shape and in color, K on top and D at the bottom', () => {
    const lanes = LANE_ORDER.map((button) => LANE_IDENTITY[button]);
    expect(lanes.map((lane) => lane.key)).toEqual(['K', 'J', 'F', 'D']);
    expect(new Set(lanes.map((lane) => lane.shape)).size).toBe(4);
    expect(new Set(lanes.map((lane) => lane.color)).size).toBe(4);
    expect(new Set(lanes.map((lane) => lane.filledClass)).size).toBe(4);
    expect(new Set(lanes.map((lane) => lane.hollowClass)).size).toBe(4);
    expect(LANE_IDENTITY[0]).toMatchObject({ shape: 'circle', color: 'jazz-copper' });
    expect(LANE_IDENTITY[1]).toMatchObject({ shape: 'square', color: 'jazz-amber' });
    expect(LANE_IDENTITY[2]).toMatchObject({ shape: 'diamond', color: 'jazz-text' });
    expect(LANE_IDENTITY[3]).toMatchObject({ shape: 'triangle', color: 'jazz-steel' });
  });
});
