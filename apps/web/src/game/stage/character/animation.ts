/**
 * Character animation written in code (game-stage REQ-STAGE-007): pure functions from time and
 * state to a pose of the VRM 1.0 humanoid. Nothing here loads three.js at run time; `apply-pose.ts`
 * puts a pose on a loaded model.
 *
 * A pose is built in layers:
 * 1. the base pose of the action: standing, listening, playing (the character's own playing
 *    pose, singing for `sayo`) or a point of the walk cycle;
 * 2. breathing, while not walking;
 * 3. a bounce on every beat of the music, while not walking and a beat is given;
 * 4. blinking, always, and the mouth while singing.
 *
 * Every input is a number the caller owns (clock time, gait, beat), so the same input always gives
 * the same pose: nothing here reads a clock or a random source.
 */
import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type { Character } from '@/game/core/roster';
import {
  ARM_HANG,
  BLINK_DURATION_S,
  BLINK_INTERVAL_S,
  BOUNCE_DEPTH_M,
  BOUNCE_KNEE_BEND,
  BOUNCE_NOD,
  BREATH_ANGLE,
  BREATH_PERIOD_S,
  SING_MOUTH_OPEN,
  WALK_ARM_SWING,
  WALK_BOB_M,
  WALK_KNEE_BEND,
  WALK_LEG_SWING,
  WALK_STRIDE,
} from './config';

/**
 * What a character is doing. `listen` and `play` are the two sides of a duel (see `roles.ts`);
 * `idle` is standing still and `walk` is walking along the street.
 */
export type CharacterAction = 'idle' | 'walk' | 'listen' | 'play';

/** How a character plays music. */
export type PlayingStyle = 'sing' | 'sax' | 'bass';

/**
 * The playing pose of each character, from their instrument in design section 4: Sayo sings, Ren
 * plays the sax and Aki the double bass. The pose follows the model being drawn: in this slice the
 * Shadow reuses the player's model, so the scene passes the player's character for both.
 */
export const PLAYING_STYLE: Readonly<Record<Character, PlayingStyle>> = {
  sayo: 'sing',
  ren: 'sax',
  aki: 'bass',
};

/**
 * The bones a pose sets, by VRM 1.0 humanoid name: the required bones plus `neck`, which the asset
 * contract also requires. Optional bones such as `chest` are left at rest, so a model without
 * them looks the same.
 */
export const POSED_BONES = [
  'hips',
  'spine',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
] as const satisfies readonly VRMHumanBoneName[];

export type PosedBone = (typeof POSED_BONES)[number];

/**
 * A rotation of a normalized bone away from its rest pose, as Euler angles in radians in the
 * three.js default order (XYZ). With the model facing +Z: a positive `x` tips a bone forward for
 * the head and back for a leg, and a negative `z` lowers the left arm from the T-pose.
 */
export interface BoneRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The VRM expressions a pose sets: the asset contract requires all three. */
export const POSE_EXPRESSIONS = ['blink', 'happy', 'aa'] as const;

export type PoseExpression = (typeof POSE_EXPRESSIONS)[number];

export interface CharacterPose {
  /** Every posed bone; a bone not moved by any layer is at rest (all zero). */
  readonly bones: Readonly<Record<PosedBone, BoneRotation>>;
  /** Vertical offset of the hips from their rest height, in metres; negative is down. */
  readonly hipsY: number;
  /** Weight of each expression, 0 to 1. */
  readonly expressions: Readonly<Record<PoseExpression, number>>;
}

export interface PoseInput {
  /** Whose playing pose `play` uses (see `PLAYING_STYLE`). */
  readonly character: Character;
  readonly action: CharacterAction;
  /** Seconds on any steady clock. Drives breathing and blinking. */
  readonly time: number;
  /** Steps taken so far (see `advanceGait`). Read only while walking; 0 by default. */
  readonly gait?: number;
  /**
   * Fractional beat of the music on the audio clock, beat 0 being the start of bar 0, or null when
   * no music plays. While not walking, the character bounces with its lowest point on every whole
   * beat. Null by default.
   */
  readonly beat?: number | null;
  /** Shifts breathing and blinking so two characters do not move in step. 0 by default. */
  readonly seed?: number;
}

type Rotation = { x: number; y: number; z: number };
type PartialRotation = Partial<BoneRotation>;
type BasePose = Readonly<Partial<Record<PosedBone, PartialRotation>>>;

interface WorkingPose {
  bones: Record<PosedBone, Rotation>;
  hipsY: number;
  expressions: Record<PoseExpression, number>;
}

const TAU = 2 * Math.PI;

/** Standing relaxed: the arms hang by the sides, elbows a little bent. */
const STAND: BasePose = {
  leftUpperArm: { z: -ARM_HANG },
  leftLowerArm: { y: -0.15 },
  rightUpperArm: { z: ARM_HANG },
  rightLowerArm: { y: 0.15 },
};

/** Listening to the other side of the duel: hands a little forward, head tilted to one side. */
const LISTEN: BasePose = {
  ...STAND,
  leftLowerArm: { y: -0.4 },
  rightLowerArm: { y: 0.4 },
  head: { z: 0.06 },
};

/** Playing poses. Only `sing` has a model in this slice; `sax` and `bass` wait for theirs. */
const PLAYING_POSES: Readonly<Record<PlayingStyle, BasePose>> = {
  /** Singing: one hand raised toward the mouth, the other open at the side, head lifted. */
  sing: {
    spine: { x: -0.04 },
    head: { x: -0.12 },
    leftUpperArm: { z: -1.0 },
    leftLowerArm: { y: -0.45 },
    rightUpperArm: { y: 0.6, z: 0.75 },
    rightLowerArm: { y: 1.8 },
    rightHand: { z: 0.2 },
  },
  /** Sax: both hands together in front of the body, head bent toward them. */
  sax: {
    spine: { x: 0.05 },
    head: { x: 0.1 },
    leftUpperArm: { y: -0.5, z: -1.0 },
    leftLowerArm: { y: -1.3 },
    rightUpperArm: { y: 0.4, z: 1.1 },
    rightLowerArm: { y: 1.1 },
  },
  /** Double bass: one hand high at the side, the other low in front, head tilted toward them. */
  bass: {
    spine: { y: -0.1 },
    head: { z: 0.12 },
    leftUpperArm: { y: -0.3, z: -0.5 },
    leftLowerArm: { y: -1.5 },
    rightUpperArm: { y: 0.5, z: 1.0 },
    rightLowerArm: { y: 0.6 },
  },
};

const ZERO_EXPRESSIONS: Readonly<Record<PoseExpression, number>> = { blink: 0, happy: 0, aa: 0 };

/** A pseudo-random number in [0, 1) from two numbers: the same input always gives the same output. */
function hash01(a: number, b: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function restPose(): WorkingPose {
  const bones = {} as Record<PosedBone, Rotation>;
  for (const bone of POSED_BONES) bones[bone] = { x: 0, y: 0, z: 0 };
  return { bones, hipsY: 0, expressions: { ...ZERO_EXPRESSIONS } };
}

function addRotation(pose: WorkingPose, bone: PosedBone, rotation: PartialRotation): void {
  const target = pose.bones[bone];
  target.x += rotation.x ?? 0;
  target.y += rotation.y ?? 0;
  target.z += rotation.z ?? 0;
}

function addBase(pose: WorkingPose, base: BasePose): void {
  for (const bone of POSED_BONES) {
    const rotation = base[bone];
    if (rotation) addRotation(pose, bone, rotation);
  }
}

/** Steps per second while walking at `speed` m/s (either direction): |speed| / `WALK_STRIDE`. */
export function stepsPerSecond(speed: number): number {
  return Math.abs(speed) / WALK_STRIDE;
}

/**
 * The gait after `dt` more seconds at `speed` m/s. The gait counts steps taken, so it grows by one
 * every `WALK_STRIDE` metres walked; a speed of 0 (stopped, or held at the edge of the street)
 * leaves it where it is. Adding up frame by frame, rather than computing rate × time, keeps the
 * legs from jumping when the speed changes. A negative or non-finite `dt` or speed changes nothing.
 */
export function advanceGait(gait: number, speed: number, dt: number): number {
  if (!(dt > 0) || !Number.isFinite(speed) || !Number.isFinite(dt)) return gait;
  return gait + stepsPerSecond(speed) * dt;
}

/**
 * Which leg leads at `gait`: 1 when the left leg is forward, -1 when the right is, between the two
 * mid-stride. It changes sign once per step, half way between two landings.
 */
export function leadingLeg(gait: number): number {
  return Math.cos(Math.PI * gait);
}

/**
 * Depth of the bounce at fractional beat `beat`, 0 to 1: 1 exactly on every whole beat, 0 half way
 * between two beats, smooth in between.
 */
export function beatDip(beat: number): number {
  const c = 0.5 + 0.5 * Math.cos(TAU * beat);
  return c * c;
}

/**
 * Weight of the `blink` expression at `time`, 0 to 1. Every window of `BLINK_INTERVAL_S` seconds
 * holds exactly one blink of `BLINK_DURATION_S`, at a place in the window that varies from window
 * to window and with `seed`; the eyes are fully closed at the middle of the blink.
 */
export function blinkWeight(time: number, seed = 0): number {
  const window = Math.floor(time / BLINK_INTERVAL_S);
  const start = window * BLINK_INTERVAL_S + hash01(window, seed) * (BLINK_INTERVAL_S - BLINK_DURATION_S);
  const u = (time - start) / BLINK_DURATION_S;
  if (u <= 0 || u >= 1) return 0;
  return 1 - Math.abs(2 * u - 1);
}

/** Breathing at `time`, -1 (out) to 1 (in), one cycle every `BREATH_PERIOD_S` seconds. */
export function breathing(time: number, seed = 0): number {
  return Math.sin(TAU * (time / BREATH_PERIOD_S + hash01(seed, 1)));
}

function addWalk(pose: WorkingPose, gait: number): void {
  const lead = leadingLeg(gait);
  const swing = Math.sin(Math.PI * gait);
  addBase(pose, STAND);
  // A negative x swings a leg forward: the left leg leads when `lead` is 1.
  addRotation(pose, 'leftUpperLeg', { x: -WALK_LEG_SWING * lead });
  addRotation(pose, 'rightUpperLeg', { x: WALK_LEG_SWING * lead });
  // The leg swinging through bends its knee: the right one on the way from gait 0 to 1.
  addRotation(pose, 'leftLowerLeg', { x: WALK_KNEE_BEND * Math.max(0, -swing) });
  addRotation(pose, 'rightLowerLeg', { x: WALK_KNEE_BEND * Math.max(0, swing) });
  // Each arm swings against its own leg; a positive x swings a hanging arm back.
  addRotation(pose, 'leftUpperArm', { x: WALK_ARM_SWING * lead });
  addRotation(pose, 'rightUpperArm', { x: -WALK_ARM_SWING * lead });
  addRotation(pose, 'spine', { y: 0.06 * lead });
  addRotation(pose, 'hips', { y: -0.06 * lead });
  // Lowest when a foot lands, on every whole gait.
  pose.hipsY -= WALK_BOB_M * (0.5 + 0.5 * Math.cos(TAU * gait));
}

function addBreath(pose: WorkingPose, time: number, seed: number): void {
  const breath = breathing(time, seed);
  addRotation(pose, 'spine', { x: -BREATH_ANGLE * breath });
  addRotation(pose, 'head', { x: BREATH_ANGLE * breath });
}

function addBounce(pose: WorkingPose, beat: number): void {
  const dip = beatDip(beat);
  pose.hipsY -= BOUNCE_DEPTH_M * dip;
  for (const side of ['left', 'right'] as const) {
    addRotation(pose, `${side}UpperLeg`, { x: (-BOUNCE_KNEE_BEND / 2) * dip });
    addRotation(pose, `${side}LowerLeg`, { x: BOUNCE_KNEE_BEND * dip });
    addRotation(pose, `${side}Foot`, { x: (-BOUNCE_KNEE_BEND / 2) * dip });
  }
  addRotation(pose, 'head', { x: BOUNCE_NOD * dip });
}

/** Mouth while singing: a syllable on every eighth note, wide open on the beat and the off-beat. */
function singingMouth(beat: number | null): number {
  if (beat === null) return SING_MOUTH_OPEN / 2;
  return SING_MOUTH_OPEN * (0.5 + 0.5 * Math.cos(TAU * 2 * beat));
}

/** The pose of a character at one moment. */
export function characterPose(input: PoseInput): CharacterPose {
  const { character, action, time, gait = 0, beat = null, seed = 0 } = input;
  const pose = restPose();

  switch (action) {
    case 'walk':
      addWalk(pose, gait);
      break;
    case 'idle':
      addBase(pose, STAND);
      break;
    case 'listen':
      addBase(pose, LISTEN);
      break;
    case 'play': {
      const style = PLAYING_STYLE[character];
      addBase(pose, PLAYING_POSES[style]);
      if (style === 'sing') {
        pose.expressions.aa = singingMouth(beat);
        pose.expressions.happy = 0.3;
      }
      break;
    }
  }

  if (action !== 'walk') {
    addBreath(pose, time, seed);
    if (beat !== null) addBounce(pose, beat);
  }
  pose.expressions.blink = blinkWeight(time, seed);
  return pose;
}

/** Exact at both ends: a weight of 0 gives `a` and a weight of 1 gives `b`. */
function lerp(a: number, b: number, weight: number): number {
  return a * (1 - weight) + b * weight;
}

/**
 * A pose `weight` of the way from `from` to `to` (0 gives `from`, 1 gives `to`), for easing from
 * one action into the next instead of snapping. The weight is clamped to 0 to 1.
 */
export function blendPoses(from: CharacterPose, to: CharacterPose, weight: number): CharacterPose {
  const w = Math.min(1, Math.max(0, weight));
  const pose = restPose();
  for (const bone of POSED_BONES) {
    const a = from.bones[bone];
    const b = to.bones[bone];
    pose.bones[bone] = { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: lerp(a.z, b.z, w) };
  }
  pose.hipsY = lerp(from.hipsY, to.hipsY, w);
  for (const name of POSE_EXPRESSIONS) {
    pose.expressions[name] = lerp(from.expressions[name], to.expressions[name], w);
  }
  return pose;
}
