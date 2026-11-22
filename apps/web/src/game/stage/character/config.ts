/**
 * Constants of the characters on the stage. `WALK_STRIDE` comes from the game-stage spec ("Giá
 * trị khởi đầu"); the rest are animation tuning, changed by eye at the demo (G6), never by
 * changing the code that reads them.
 *
 * Units: metres, seconds and radians. Angles rotate the normalized VRM 1.0 bones, whose rest pose
 * is the T-pose with the model facing +Z, +Y up and its left side along +X.
 */

/** Metres covered by one step. Steps per second = speed / stride, so the feet do not slide. */
export const WALK_STRIDE = 0.6;

/** Seconds of one breath, in and out. */
export const BREATH_PERIOD_S = 4;

/** How far the spine leans back and forth with a breath, in radians either way. */
export const BREATH_ANGLE = 0.025;

/** One blink falls somewhere in every window of this many seconds. */
export const BLINK_INTERVAL_S = 4;

/** Seconds a blink takes, closing then opening. */
export const BLINK_DURATION_S = 0.16;

/** How far the hips sink at the bottom of a bounce on the beat, in metres. */
export const BOUNCE_DEPTH_M = 0.025;

/** How far the knees bend at the bottom of a bounce, in radians. */
export const BOUNCE_KNEE_BEND = 0.14;

/** How far the head nods at the bottom of a bounce, in radians. */
export const BOUNCE_NOD = 0.07;

/** How far the arms hang down from the T-pose when relaxed, in radians. */
export const ARM_HANG = 1.25;

/** Forward and back swing of each leg while walking, in radians either way. */
export const WALK_LEG_SWING = 0.45;

/** Knee bend of the leg swinging through, in radians. */
export const WALK_KNEE_BEND = 0.65;

/** Forward and back swing of each arm while walking, opposite to its leg, in radians either way. */
export const WALK_ARM_SWING = 0.3;

/** How far the hips drop when a foot lands, in metres. */
export const WALK_BOB_M = 0.03;

/** How wide the mouth opens on a sung note, 0 to 1 (the `aa` expression). */
export const SING_MOUTH_OPEN = 0.7;

/**
 * Grey level of the MToon `shadeColorFactor` on the Shadow, 0 to 1. The Shadow palette also goes
 * on `shadeMultiplyTexture`, so this factor is what keeps the shaded side darker than the lit one.
 */
export const SHADOW_SHADE_FACTOR = 0.7;
