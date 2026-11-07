import { ASSIST_MULT, DIFFICULTIES, OFFBEAT_RATIO, SWING_RATIO } from './config';
import { difficultyProfile, laneGuides, timingWindows } from './difficulty';
import { hitWindows } from './judge';

describe('difficulty', () => {
  it('AC-DUEL-011.2: Lounge shows target notes on the player turn; Session shows notes only while the opponent plays and beat lines always; Late Set shows neither', () => {
    expect(laneGuides('lounge', 'player').noteMarkers).toBe(true);

    expect(laneGuides('session', 'opponent').noteMarkers).toBe(true);
    expect(laneGuides('session', 'player').noteMarkers).toBe(false);
    expect(laneGuides('session', 'opponent').beatLines).toBe(true);
    expect(laneGuides('session', 'player').beatLines).toBe(true);

    expect(laneGuides('lateSet', 'opponent')).toEqual({ noteMarkers: false, beatLines: false });
    expect(laneGuides('lateSet', 'player')).toEqual({ noteMarkers: false, beatLines: false });
  });

  it('windows widen by ASSIST_MULT once assistance is accepted', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(timingWindows(difficulty, false)).toEqual(hitWindows(difficulty, false));
      expect(timingWindows(difficulty, true)).toEqual(hitWindows(difficulty, true));
    }
    expect(ASSIST_MULT).toBe(1.15);
    expect(timingWindows('session', true)).toEqual({ perfect: 51.75, great: 103.5, ok: 161 });
    expect(timingWindows('lounge', true).great).toBeCloseTo(126 * 1.15, 6);
  });

  it('the profile bundles windows, swing and lane guides of a difficulty', () => {
    expect(difficultyProfile('session')).toEqual({
      difficulty: 'session',
      assisted: false,
      windows: hitWindows('session', false),
      offbeatRatio: OFFBEAT_RATIO.session,
      lanes: {
        opponent: laneGuides('session', 'opponent'),
        player: laneGuides('session', 'player'),
      },
    });

    const lateSet = difficultyProfile('lateSet', true);
    expect(lateSet.assisted).toBe(true);
    expect(lateSet.windows).toEqual(hitWindows('lateSet', true));
    expect(lateSet.offbeatRatio).toBe(SWING_RATIO);
  });
});
