import { STREET_WALK_SPEED } from './config';
import { createWalkBounds, stepWalk, type WalkDirection } from './movement';

/** One frame at 60 fps. */
const FRAME = 1 / 60;

/** A street about 40 m long, as in the asset contract. */
const BOUNDS = createWalkBounds(-19, 19);

/** Holds `direction` for `frames` frames from `x` and returns every step. */
function hold(x: number, direction: WalkDirection, frames: number) {
  const steps = [];
  let position = x;
  for (let i = 0; i < frames; i++) {
    const step = stepWalk(position, direction, FRAME, BOUNDS);
    steps.push(step);
    position = step.x;
  }
  return steps;
}

describe('street movement', () => {
  it('walks at STREET_WALK_SPEED (2.4 m/s) in the held direction and stops when nothing is held', () => {
    expect(STREET_WALK_SPEED).toBe(2.4);

    const right = stepWalk(0, 1, 0.5, BOUNDS);
    expect(right.x).toBeCloseTo(1.2, 9);
    expect(right.velocity).toBeCloseTo(2.4, 9);

    const left = stepWalk(0, -1, 0.5, BOUNDS);
    expect(left.x).toBeCloseTo(-1.2, 9);
    expect(left.velocity).toBeCloseTo(-2.4, 9);

    expect(stepWalk(3, 0, 0.5, BOUNDS)).toEqual({ x: 3, velocity: 0 });
  });

  it('AC-STAGE-003.2: held right at walk_max, the character stays at the edge, standing still', () => {
    const steps = hold(18.5, 1, 120);

    const reached = steps.findIndex((step) => step.x === BOUNDS.walkMax);
    expect(reached).toBeGreaterThan(0);
    for (const step of steps.slice(reached + 1)) {
      expect(step.x).toBe(BOUNDS.walkMax);
      expect(step.velocity).toBe(0);
    }
    for (const step of steps) expect(step.x).toBeLessThanOrEqual(BOUNDS.walkMax);
  });

  it('AC-STAGE-003.2: held left at walk_min, the character stays at the edge, standing still', () => {
    const steps = hold(-18.5, -1, 120);

    const reached = steps.findIndex((step) => step.x === BOUNDS.walkMin);
    expect(reached).toBeGreaterThan(0);
    for (const step of steps.slice(reached + 1)) {
      expect(step.x).toBe(BOUNDS.walkMin);
      expect(step.velocity).toBe(0);
    }
    for (const step of steps) expect(step.x).toBeGreaterThanOrEqual(BOUNDS.walkMin);
  });

  it('AC-STAGE-003.2: the step that reaches an edge stops on it, at a reduced speed', () => {
    const step = stepWalk(18.99, 1, FRAME, BOUNDS);

    expect(step.x).toBe(19);
    expect(step.velocity).toBeCloseTo(0.01 / FRAME, 9);
    expect(step.velocity).toBeLessThan(STREET_WALK_SPEED);
  });

  it('AC-STAGE-003.2: from an edge the character walks back into the street at full speed', () => {
    const fromMax = stepWalk(BOUNDS.walkMax, -1, 0.5, BOUNDS);
    expect(fromMax.x).toBeCloseTo(17.8, 9);
    expect(fromMax.velocity).toBeCloseTo(-STREET_WALK_SPEED, 9);

    const fromMin = stepWalk(BOUNDS.walkMin, 1, 0.5, BOUNDS);
    expect(fromMin.x).toBeCloseTo(-17.8, 9);
    expect(fromMin.velocity).toBeCloseTo(STREET_WALK_SPEED, 9);
  });

  it('AC-STAGE-003.2: a start outside the bounds is brought back to the nearest edge', () => {
    expect(stepWalk(25, 1, FRAME, BOUNDS)).toEqual({ x: 19, velocity: 0 });
    expect(stepWalk(-25, -1, FRAME, BOUNDS)).toEqual({ x: -19, velocity: 0 });
    expect(stepWalk(-25, 0, FRAME, BOUNDS).x).toBe(-19);
  });

  it('AC-STAGE-003.2: a long frame never carries the character past an edge', () => {
    expect(stepWalk(0, 1, 60, BOUNDS)).toEqual({ x: 19, velocity: 19 / 60 });
    expect(stepWalk(0, -1, 60, BOUNDS)).toEqual({ x: -19, velocity: -19 / 60 });
  });

  it('does not move in a zero-length frame', () => {
    expect(stepWalk(2, 1, 0, BOUNDS)).toEqual({ x: 2, velocity: 0 });
  });

  it('rejects bounds in the wrong order and non-finite or negative inputs', () => {
    expect(() => createWalkBounds(5, 1)).toThrow(RangeError);
    expect(() => createWalkBounds(Number.NaN, 1)).toThrow(RangeError);
    expect(() => stepWalk(Number.NaN, 1, FRAME, BOUNDS)).toThrow(RangeError);
    expect(() => stepWalk(0, 1, Number.POSITIVE_INFINITY, BOUNDS)).toThrow(RangeError);
    expect(() => stepWalk(0, 1, -FRAME, BOUNDS)).toThrow(RangeError);
    expect(() => stepWalk(0, 1, FRAME, BOUNDS, -1)).toThrow(RangeError);
    expect(() => stepWalk(0, 1, FRAME, { walkMin: 3, walkMax: -3 })).toThrow(RangeError);
  });

  it('accepts a street with no room to walk, keeping the character on its one point', () => {
    const point = createWalkBounds(4, 4);
    expect(stepWalk(0, 1, FRAME, point)).toEqual({ x: 4, velocity: 0 });
  });
});
