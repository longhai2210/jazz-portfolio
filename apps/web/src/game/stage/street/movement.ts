/**
 * Walking along the street: the player character moves on the X axis only, at a fixed speed in
 * the held direction, and stops at the ends of the walkable stretch (`walk_min`, `walk_max`).
 * Pure TypeScript: no React, three.js or browser APIs.
 */
import { STREET_WALK_SPEED } from './config';
import { assertFinite, assertRange, clamp } from './range';

/** Held direction: -1 left, 0 none, 1 right. */
export type WalkDirection = -1 | 0 | 1;

/** X positions of the `walk_min` and `walk_max` nodes of the street GLB. */
export interface WalkBounds {
  readonly walkMin: number;
  readonly walkMax: number;
}

/** Where the character is after one step, and how fast it actually moved. */
export interface WalkStep {
  readonly x: number;
  /**
   * Speed actually applied over the step, in m/s, signed like X: 0 when no direction is held
   * or when the character is held at an end of the street. Animation reads it for the stride.
   */
  readonly velocity: number;
}

/** Checks the two node positions and returns them as bounds. */
export function createWalkBounds(walkMin: number, walkMax: number): WalkBounds {
  assertRange('walkMin', walkMin, 'walkMax', walkMax);
  return Object.freeze({ walkMin, walkMax });
}

/**
 * Moves the character from `x` for `dt` seconds in `direction` at `speed` (STREET_WALK_SPEED
 * by default), never past `walk_min` or `walk_max`. A start outside the bounds is first brought
 * back inside, so the result is always within them.
 */
export function stepWalk(
  x: number,
  direction: WalkDirection,
  dt: number,
  bounds: WalkBounds,
  speed: number = STREET_WALK_SPEED,
): WalkStep {
  assertFinite('x', x);
  assertFinite('dt', dt);
  if (dt < 0) throw new RangeError(`dt must not be negative, got ${dt}`);
  assertFinite('speed', speed);
  if (speed < 0) throw new RangeError(`speed must not be negative, got ${speed}`);
  assertRange('walkMin', bounds.walkMin, 'walkMax', bounds.walkMax);

  const start = clamp(x, bounds.walkMin, bounds.walkMax);
  const next = clamp(start + direction * speed * dt, bounds.walkMin, bounds.walkMax);
  return { x: next, velocity: dt > 0 ? (next - start) / dt : 0 };
}
