/**
 * What each difficulty gives the player (REQ-DUEL-011): the guides the beat lane shows on each
 * side of a turn, and the timing windows, widened when the player accepted assistance.
 */
import { OFFBEAT_RATIO } from './config';
import { hitWindows } from './judge';
import type { Difficulty, HitWindows } from './types';

/** Who is playing the bars on screen: the opponent's call, or the player's reply. */
export type LaneSide = 'opponent' | 'player';

/** What the beat lane draws. */
export interface LaneGuides {
  /** Markers at the positions of the notes being played or to be played. */
  readonly noteMarkers: boolean;
  /** Lines on every beat. */
  readonly beatLines: boolean;
}

/**
 * Lane guides per difficulty and side.
 * - Lounge: note markers on the player's bars, and on the opponent's; beat lines on both.
 * - Session: note markers only while the opponent plays; beat lines always.
 * - Late Set: no note markers and no beat lines, sound only.
 */
export const LANE_GUIDES: Readonly<Record<Difficulty, Readonly<Record<LaneSide, LaneGuides>>>> = {
  lounge: {
    opponent: { noteMarkers: true, beatLines: true },
    player: { noteMarkers: true, beatLines: true },
  },
  session: {
    opponent: { noteMarkers: true, beatLines: true },
    player: { noteMarkers: false, beatLines: true },
  },
  lateSet: {
    opponent: { noteMarkers: false, beatLines: false },
    player: { noteMarkers: false, beatLines: false },
  },
};

/** Everything a difficulty sets for one duel. */
export interface DifficultyProfile {
  readonly difficulty: Difficulty;
  /** The player accepted assistance: windows × ASSIST_MULT. */
  readonly assisted: boolean;
  /** Timing windows in ms (see `hitWindows`). */
  readonly windows: HitWindows;
  /** Where an odd step falls inside its beat (1/2 straight, 2/3 swung). */
  readonly offbeatRatio: number;
  readonly lanes: Readonly<Record<LaneSide, LaneGuides>>;
}

/** What the beat lane shows at a difficulty while `side` plays. */
export function laneGuides(difficulty: Difficulty, side: LaneSide): LaneGuides {
  return LANE_GUIDES[difficulty][side];
}

/** Timing windows in ms at a difficulty, × ASSIST_MULT when the player accepted assistance. */
export function timingWindows(difficulty: Difficulty, assisted: boolean): HitWindows {
  return hitWindows(difficulty, assisted);
}

/** The settings of a difficulty, with or without assistance. */
export function difficultyProfile(difficulty: Difficulty, assisted = false): DifficultyProfile {
  return {
    difficulty,
    assisted,
    windows: timingWindows(difficulty, assisted),
    offbeatRatio: OFFBEAT_RATIO[difficulty],
    lanes: LANE_GUIDES[difficulty],
  };
}
