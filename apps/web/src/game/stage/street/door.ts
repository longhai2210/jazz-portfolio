/**
 * The club door on the street. The character walks on the X axis only and the door stands on
 * the facade behind the road, so "near the door" is measured along X, from the X of the centre
 * of the `club_door` node; the depth of the node is ignored.
 * Pure TypeScript: no React, three.js or browser APIs.
 */
import { DOOR_PROMPT_RADIUS } from './config';
import { assertFinite } from './range';

/**
 * Whether a character at `x` is within `radius` (DOOR_PROMPT_RADIUS by default) of the door at
 * `doorX`, edge included. While it is, the scene shows the prompt to enter the club.
 */
export function isNearDoor(x: number, doorX: number, radius: number = DOOR_PROMPT_RADIUS): boolean {
  assertFinite('x', x);
  assertFinite('doorX', doorX);
  assertFinite('radius', radius);
  if (radius < 0) throw new RangeError(`radius must not be negative, got ${radius}`);
  return Math.abs(x - doorX) <= radius;
}
