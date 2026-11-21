import { cameraX, createCameraBounds } from './camera';
import { DOOR_PROMPT_RADIUS, DUCK_BOB_S, STREET_BPM, STREET_WALK_SPEED } from './config';
import { isNearDoor } from './door';
import { createStreetClock, duckBob, quackTime, quackTimesBetween, scheduleDuckQuacks } from './ducks';
import { createWalkBounds, stepWalk } from './movement';

const bounds = createWalkBounds(-10, 10);
const spb = 60 / STREET_BPM;

describe('AC-STAGE-003.2 walking stops at the street ends', () => {
  it('AC-STAGE-003.2: holding right at walk_max stays put', () => {
    const s = stepWalk(10, 1, 0.5, bounds);
    expect(s.x).toBe(10);
    expect(s.velocity).toBe(0);
  });
  it('AC-STAGE-003.2: holding left at walk_min stays put', () => {
    expect(stepWalk(-10, -1, 0.5, bounds).x).toBe(-10);
  });
  it('AC-STAGE-003.2: a big step never overshoots either end', () => {
    expect(stepWalk(9.9, 1, 100, bounds).x).toBe(10);
    expect(stepWalk(-9.9, -1, 100, bounds).x).toBe(-10);
  });
  it('AC-STAGE-003.2: walks normally inside the bounds at STREET_WALK_SPEED', () => {
    expect(stepWalk(0, 1, 1, bounds).x).toBeCloseTo(STREET_WALK_SPEED);
    expect(stepWalk(0, -1, 1, bounds).x).toBeCloseTo(-STREET_WALK_SPEED);
    expect(stepWalk(0, 0, 1, bounds).x).toBe(0);
  });
  it('AC-STAGE-003.2: a start outside the bounds ends inside them', () => {
    const x = stepWalk(50, 1, 1, bounds).x;
    expect(x).toBeLessThanOrEqual(10);
    expect(x).toBeGreaterThanOrEqual(-10);
  });
  it('AC-STAGE-003.2: inverted bounds are rejected', () => {
    expect(() => createWalkBounds(5, -5)).toThrow();
  });
});

describe('AC-STAGE-003.3 door prompt', () => {
  it('AC-STAGE-003.3: near inside the radius, either side', () => {
    expect(isNearDoor(4, 4)).toBe(true);
    expect(isNearDoor(4 + DOOR_PROMPT_RADIUS * 0.9, 4)).toBe(true);
    expect(isNearDoor(4 - DOOR_PROMPT_RADIUS * 0.9, 4)).toBe(true);
  });
  it('AC-STAGE-003.3: not near outside the radius', () => {
    expect(isNearDoor(4 + DOOR_PROMPT_RADIUS * 1.1, 4)).toBe(false);
    expect(isNearDoor(4 - DOOR_PROMPT_RADIUS * 1.1, 4)).toBe(false);
  });
  it('AC-STAGE-003.3: honours a custom radius', () => {
    expect(isNearDoor(0, 3, 5)).toBe(true);
    expect(isNearDoor(0, 3, 2)).toBe(false);
  });
});

describe('AC-STAGE-003.4 camera follows on X within cam_min/cam_max', () => {
  const cam = createCameraBounds(-4, 6);
  it('AC-STAGE-003.4: follows the character inside the range', () => {
    expect(cameraX(0, cam)).toBe(0);
    expect(cameraX(3.3, cam)).toBe(3.3);
  });
  it('AC-STAGE-003.4: clamps at both ends', () => {
    expect(cameraX(-100, cam)).toBe(-4);
    expect(cameraX(100, cam)).toBe(6);
  });
  it('AC-STAGE-003.4: exact bounds are kept', () => {
    expect(cameraX(-4, cam)).toBe(-4);
    expect(cameraX(6, cam)).toBe(6);
  });
  it('AC-STAGE-003.4: inverted bounds are rejected', () => {
    expect(() => createCameraBounds(6, -4)).toThrow();
  });
});

describe('AC-STAGE-004.1 quacks on beats 2 and 4', () => {
  const clock = createStreetClock(10);
  it('AC-STAGE-004.1: street clock uses STREET_BPM', () => {
    expect(clock.bpm).toBe(STREET_BPM);
  });
  it('AC-STAGE-004.1: quacks of bar 0 and 1 land on beats 2 and 4', () => {
    const times = quackTimesBetween(clock, 10, 10 + 8 * spb);
    expect(times).toHaveLength(4);
    [1, 3, 5, 7].forEach((b, i) => expect(times[i]).toBeCloseTo(10 + b * spb, 6));
  });
  it('AC-STAGE-004.1: no quack on beats 1 and 3, none before t0', () => {
    expect(quackTimesBetween(clock, 0, 10 + 0.5 * spb)).toEqual([]);
    expect(quackTimesBetween(clock, 10, 10 + spb)).toEqual([]);
  });
  it('AC-STAGE-004.1: empty or reversed window gives nothing', () => {
    expect(quackTimesBetween(clock, 12, 12)).toEqual([]);
    expect(quackTimesBetween(clock, 20, 12)).toEqual([]);
  });
  it('AC-STAGE-004.1: adjacent windows never duplicate or skip', () => {
    const all = quackTimesBetween(clock, 10, 40);
    const split = [
      ...quackTimesBetween(clock, 10, 13.3),
      ...quackTimesBetween(clock, 13.3, 21),
      ...quackTimesBetween(clock, 21, 40),
    ];
    expect(split).toEqual(all);
  });
  it('AC-STAGE-004.1: schedules each quack on the audio scheduler at its time', () => {
    const schedule = jest.fn();
    const play = jest.fn();
    const t = scheduleDuckQuacks({ schedule }, clock, 10, 10 + 4 * spb, play);
    expect(t).toHaveLength(2);
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(schedule.mock.calls.map((c) => c[0])).toEqual(t);
    expect(schedule.mock.calls[0][1]).toBe(play);
  });
  it('AC-STAGE-004.1: non-finite window is rejected', () => {
    expect(() => quackTimesBetween(clock, Number.NaN, 5)).toThrow();
  });
});

describe('AC-STAGE-004.2 duck bob follows audio time', () => {
  const clock = createStreetClock(10);
  const q = quackTime(clock, 0, 2);
  it('AC-STAGE-004.2: quackTime is beat 2 of the bar', () => {
    expect(q).toBeCloseTo(10 + spb, 6);
  });
  it('AC-STAGE-004.2: deepest exactly at the quack', () => {
    expect(duckBob(clock, q)).toBeCloseTo(1, 6);
  });
  it('AC-STAGE-004.2: rest before the first quack and just before a quack', () => {
    expect(duckBob(clock, 5)).toBe(0);
    expect(duckBob(clock, 10)).toBe(0);
    expect(duckBob(clock, q - 0.01)).toBe(0);
  });
  it('AC-STAGE-004.2: eases back to rest within DUCK_BOB_S, always in 0..1', () => {
    expect(duckBob(clock, q + DUCK_BOB_S)).toBe(0);
    expect(duckBob(clock, q + DUCK_BOB_S / 2)).toBeGreaterThan(0);
    for (let t = 9; t < 30; t += 0.013) {
      const v = duckBob(clock, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('AC-STAGE-004.2: bobs again on the next scheduled quack', () => {
    expect(duckBob(clock, quackTime(clock, 0, 4))).toBeCloseTo(1, 6);
    expect(duckBob(clock, quackTime(clock, 3, 2))).toBeCloseTo(1, 6);
  });
  it('AC-STAGE-004.2: rejects non-finite time', () => {
    expect(() => duckBob(clock, Number.NaN)).toThrow();
  });
});
