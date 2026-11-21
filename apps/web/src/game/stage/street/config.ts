/**
 * Tunable constants of the street scene ("Giá trị khởi đầu" in the game-stage spec), plus the
 * visual tuning of the duck bob. Playtests change these numbers, never the logic that reads them.
 *
 * Units: distances in metres along the street (the X axis of the street GLB), speeds in metres
 * per second, times in seconds, tempo in beats per minute.
 */

/** Walking speed of the player character along the street, in m/s. */
export const STREET_WALK_SPEED = 2.4;

/** Tempo of the street music in BPM, matching Hồ Làng. */
export const STREET_BPM = 84;

/**
 * Beats of each 4-beat bar on which the ducks quack, counted from 1 as musicians do ("on 2 and
 * 4"). Beat `n` sits `n - 1` beats after the start of its bar on the beat clock.
 */
export const DUCK_QUACK_BEATS: readonly number[] = [2, 4];

/** Distance from the centre of the `club_door` node within which the club prompt shows, in m. */
export const DOOR_PROMPT_RADIUS = 1.2;

/**
 * Visual tuning, not a spec value: how long a duck's bob lasts after a quack, in seconds. It
 * must stay shorter than one beat at STREET_BPM (60 / 84 ≈ 0.71 s), so one bob ends before the
 * next quack can start.
 */
export const DUCK_BOB_S = 0.25;

/**
 * Visual tuning, not a spec value: how far a duck dips at the peak of its bob, in metres. The
 * scene multiplies `duckBob` (0 to 1) by this.
 */
export const DUCK_BOB_DEPTH = 0.05;
