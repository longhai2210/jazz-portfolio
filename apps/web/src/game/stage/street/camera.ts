/**
 * The side-on street camera: it follows the character along the X axis only and never goes
 * past `cam_min` or `cam_max`, so it never shows the empty space beyond the ends of the street.
 * Pure TypeScript: no React, three.js or browser APIs.
 */
import { assertFinite, assertRange, clamp } from './range';

/** X positions of the `cam_min` and `cam_max` nodes of the street GLB. */
export interface CameraBounds {
  readonly camMin: number;
  readonly camMax: number;
}

/** Checks the two node positions and returns them as bounds. */
export function createCameraBounds(camMin: number, camMax: number): CameraBounds {
  assertRange('camMin', camMin, 'camMax', camMax);
  return Object.freeze({ camMin, camMax });
}

/** The camera's X for a character at `characterX`: the same X, held within `[cam_min, cam_max]`. */
export function cameraX(characterX: number, bounds: CameraBounds): number {
  assertFinite('characterX', characterX);
  assertRange('camMin', bounds.camMin, 'camMax', bounds.camMax);
  return clamp(characterX, bounds.camMin, bounds.camMax);
}
