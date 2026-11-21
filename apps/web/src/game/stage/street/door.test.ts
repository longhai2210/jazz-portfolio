import { DOOR_PROMPT_RADIUS } from './config';
import { isNearDoor } from './door';
import { createWalkBounds, stepWalk } from './movement';

describe('club door', () => {
  it('AC-STAGE-003.3: DOOR_PROMPT_RADIUS is 1.2 m', () => {
    expect(DOOR_PROMPT_RADIUS).toBe(1.2);
  });

  it('AC-STAGE-003.3: within DOOR_PROMPT_RADIUS of the club_door centre, on either side, the character is near the door', () => {
    expect(isNearDoor(0, 0)).toBe(true);
    expect(isNearDoor(0.5, 0)).toBe(true);
    expect(isNearDoor(-0.5, 0)).toBe(true);
    expect(isNearDoor(1.2, 0)).toBe(true);
    expect(isNearDoor(-1.2, 0)).toBe(true);
  });

  it('AC-STAGE-003.3: just outside DOOR_PROMPT_RADIUS, on either side, the character is not near the door', () => {
    expect(isNearDoor(1.21, 0)).toBe(false);
    expect(isNearDoor(-1.21, 0)).toBe(false);
    expect(isNearDoor(15, 0)).toBe(false);
  });

  it('AC-STAGE-003.3: walking past the door, the prompt shows only while the character is within the radius', () => {
    const doorX = 9.5;
    const bounds = createWalkBounds(-19, 19);
    const frame = 1 / 60;
    const nearAt: number[] = [];
    let x = 5;
    while (x < 15) {
      x = stepWalk(x, 1, frame, bounds).x;
      if (isNearDoor(x, doorX)) nearAt.push(x);
    }

    expect(nearAt.length).toBeGreaterThan(0);
    // The prompt shows from 1.2 m before the door to 1.2 m after it, one frame of walking at most late.
    const stride = 2.4 * frame;
    expect(nearAt[0]).toBeGreaterThanOrEqual(doorX - DOOR_PROMPT_RADIUS);
    expect(nearAt[0]).toBeLessThan(doorX - DOOR_PROMPT_RADIUS + stride);
    expect(nearAt[nearAt.length - 1]).toBeLessThanOrEqual(doorX + DOOR_PROMPT_RADIUS);
    expect(nearAt[nearAt.length - 1]).toBeGreaterThan(doorX + DOOR_PROMPT_RADIUS - stride);
    // One unbroken stretch: the prompt does not flicker on the way past.
    for (let i = 1; i < nearAt.length; i++) {
      expect(nearAt[i] - nearAt[i - 1]).toBeCloseTo(stride, 9);
    }
  });

  it('measures along the street only, from the X of the door node', () => {
    expect(isNearDoor(10.6, 9.5)).toBe(true);
    expect(isNearDoor(8.4, 9.5)).toBe(true);
    expect(isNearDoor(11, 9.5)).toBe(false);
  });

  it('accepts a custom radius and rejects a negative or non-finite one', () => {
    expect(isNearDoor(2, 0, 2.5)).toBe(true);
    expect(isNearDoor(2, 0, 1)).toBe(false);
    expect(() => isNearDoor(0, 0, -1)).toThrow(RangeError);
    expect(() => isNearDoor(Number.NaN, 0)).toThrow(RangeError);
    expect(() => isNearDoor(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
