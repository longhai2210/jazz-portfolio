/**
 * A closed range on the street's X axis, read from two empty nodes of the street GLB
 * (`walk_min`/`walk_max` or `cam_min`/`cam_max`). Positions arrive as numbers; nothing here
 * reads a file.
 */

/** Throws a `RangeError` unless `value` is a finite number. */
export function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${value}`);
  }
}

/** Throws a `RangeError` unless `min` and `max` are finite and `min <= max`. */
export function assertRange(minName: string, min: number, maxName: string, max: number): void {
  assertFinite(minName, min);
  assertFinite(maxName, max);
  if (min > max) {
    throw new RangeError(`${minName} (${min}) must not be greater than ${maxName} (${max})`);
  }
}

/** `value` limited to `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
