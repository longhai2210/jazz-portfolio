import { cameraX, createCameraBounds } from './camera';
import { createWalkBounds, stepWalk } from './movement';

const WALK = createWalkBounds(-19, 19);
const CAMERA = createCameraBounds(-14, 14);

describe('street camera', () => {
  it('AC-STAGE-003.4: between cam_min and cam_max the camera sits at the character X', () => {
    expect(cameraX(0, CAMERA)).toBe(0);
    expect(cameraX(-7.25, CAMERA)).toBe(-7.25);
    expect(cameraX(13.9, CAMERA)).toBe(13.9);
    expect(cameraX(-14, CAMERA)).toBe(-14);
    expect(cameraX(14, CAMERA)).toBe(14);
  });

  it('AC-STAGE-003.4: past cam_min or cam_max the camera stops at the bound', () => {
    expect(cameraX(16, CAMERA)).toBe(14);
    expect(cameraX(19, CAMERA)).toBe(14);
    expect(cameraX(-16, CAMERA)).toBe(-14);
    expect(cameraX(-19, CAMERA)).toBe(-14);
  });

  it('AC-STAGE-003.4: walking the whole street and back, the camera follows on X and never leaves [cam_min, cam_max]', () => {
    const frame = 1 / 60;
    let x = WALK.walkMin;
    let camera = cameraX(x, CAMERA);
    let followed = 0;
    for (const direction of [1, -1] as const) {
      for (let i = 0; i < 1100; i++) {
        const step = stepWalk(x, direction, frame, WALK);
        const next = cameraX(step.x, CAMERA);

        expect(next).toBeGreaterThanOrEqual(CAMERA.camMin);
        expect(next).toBeLessThanOrEqual(CAMERA.camMax);
        const inside = (at: number) => at >= CAMERA.camMin && at <= CAMERA.camMax;
        if (inside(step.x)) {
          expect(next).toBe(step.x);
          // The camera moves exactly as far as the character only when the whole step is inside
          // the bounds; on the step in from outside, it moves only from the bound.
          if (inside(x)) {
            expect(next - camera).toBeCloseTo(step.x - x, 9);
            followed++;
          }
        }
        x = step.x;
        camera = next;
      }
    }

    expect(followed).toBeGreaterThan(0);
    expect(x).toBe(WALK.walkMin);
    expect(camera).toBe(CAMERA.camMin);
  });

  it('holds still on a street no wider than the view (cam_min equal to cam_max)', () => {
    const fixed = createCameraBounds(2, 2);
    expect(cameraX(-10, fixed)).toBe(2);
    expect(cameraX(10, fixed)).toBe(2);
  });

  it('rejects bounds in the wrong order and non-finite positions', () => {
    expect(() => createCameraBounds(14, -14)).toThrow(RangeError);
    expect(() => createCameraBounds(-14, Number.NaN)).toThrow(RangeError);
    expect(() => cameraX(Number.NaN, CAMERA)).toThrow(RangeError);
    expect(() => cameraX(0, { camMin: 1, camMax: -1 })).toThrow(RangeError);
  });
});
