import * as fc from 'fast-check';
import { CHARACTERS, type Character } from '@/game/core/roster';
import type { SessionPhase } from '@/game/core/session';
import {
  advanceGait,
  beatDip,
  blendPoses,
  blinkWeight,
  characterPose,
  leadingLeg,
  PLAYING_STYLE,
  POSE_EXPRESSIONS,
  POSED_BONES,
  stepsPerSecond,
  type CharacterAction,
  type CharacterPose,
} from './animation';
import {
  BLINK_DURATION_S,
  BLINK_INTERVAL_S,
  BOUNCE_DEPTH_M,
  BREATH_ANGLE,
  BREATH_PERIOD_S,
  SING_MOUTH_OPEN,
  WALK_STRIDE,
} from './config';
import { duelRoles } from './roles';

/** Street walking speed of the game-stage spec (`STREET_WALK_SPEED`, m/s). */
const STREET_WALK_SPEED = 2.4;

/** The largest difference between two poses over every bone angle, in radians. */
function boneDistance(a: CharacterPose, b: CharacterPose): number {
  let max = 0;
  for (const bone of POSED_BONES) {
    for (const axis of ['x', 'y', 'z'] as const) {
      max = Math.max(max, Math.abs(a.bones[bone][axis] - b.bones[bone][axis]));
    }
  }
  return max;
}

/** Which leg the walk pose puts forward: 1 for the left leg (a negative x swings a leg forward). */
function poseLead(pose: CharacterPose): number {
  return Math.sign(pose.bones.rightUpperLeg.x - pose.bones.leftUpperLeg.x);
}

/** Walks frame by frame at `speed` and returns the gait reached and the changes of leading leg. */
function walk(
  speed: number,
  frames: readonly number[],
  reducedMotion = false,
): { gait: number; leadChanges: number } {
  let gait = 0;
  let lead = poseLead(characterPose({ character: 'sayo', action: 'walk', time: 0, gait, reducedMotion }));
  let leadChanges = 0;
  let time = 0;
  for (const dt of frames) {
    gait = advanceGait(gait, speed, dt);
    time += dt;
    const next = poseLead(characterPose({ character: 'sayo', action: 'walk', time, gait, reducedMotion }));
    if (next !== 0 && next !== lead) {
      leadChanges += 1;
      lead = next;
    }
  }
  return { gait, leadChanges };
}

const SIXTY_FPS_FOR_10_S: readonly number[] = Array<number>(600).fill(1 / 60);

describe('walking', () => {
  it('AC-STAGE-007.1: steps per second is the speed over WALK_STRIDE (0.6 m), in either direction', () => {
    expect(WALK_STRIDE).toBe(0.6);
    expect(stepsPerSecond(STREET_WALK_SPEED)).toBeCloseTo(4, 12);
    expect(stepsPerSecond(-STREET_WALK_SPEED)).toBeCloseTo(4, 12);
    fc.assert(
      fc.property(fc.double({ min: -10, max: 10, noNaN: true }), (speed) => {
        expect(stepsPerSecond(speed)).toBeCloseTo(Math.abs(speed) / WALK_STRIDE, 9);
      }),
    );
  });

  it('AC-STAGE-007.1: at the street speed the legs change lead 4 times a second, one step per 0.6 m', () => {
    const { gait, leadChanges } = walk(STREET_WALK_SPEED, SIXTY_FPS_FOR_10_S);

    expect(leadChanges).toBe(40);
    expect(gait).toBeCloseTo(40, 9);
    expect((STREET_WALK_SPEED * 10) / leadChanges).toBeCloseTo(WALK_STRIDE, 9);
  });

  it('AC-STAGE-007.1: for any speed v and any frame times, the walk takes v / WALK_STRIDE steps a second, so the feet do not slide', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.2, max: 6, noNaN: true }),
        fc.array(fc.double({ min: 1 / 240, max: 1 / 20, noNaN: true }), { minLength: 20, maxLength: 400 }),
        (speed, frames) => {
          const duration = frames.reduce((sum, dt) => sum + dt, 0);
          const expectedSteps = (speed * duration) / WALK_STRIDE;
          const { gait, leadChanges } = walk(speed, frames);

          expect(gait).toBeCloseTo(expectedSteps, 6);
          // The lead changes half way between two landings: round(steps), give or take the rounding.
          expect(Math.abs(leadChanges - expectedSteps)).toBeLessThanOrEqual(0.5 + 1e-6);
          // Metres per step, the stride, whatever the speed.
          expect((speed * duration) / gait).toBeCloseTo(WALK_STRIDE, 6);
        },
      ),
    );
  });

  it('AC-STAGE-007.1: held at the edge of the street (v = 0), the gait and the legs stay still', () => {
    const gait = 3.3;
    expect(advanceGait(gait, 0, 1 / 60)).toBe(gait);
    expect(walk(0, SIXTY_FPS_FOR_10_S)).toEqual({ gait: 0, leadChanges: 0 });

    const before = characterPose({ character: 'sayo', action: 'walk', time: 1, gait });
    const after = characterPose({ character: 'sayo', action: 'walk', time: 2, gait: advanceGait(gait, 0, 1) });
    expect(boneDistance(before, after)).toBe(0);
    expect(after.hipsY).toBe(before.hipsY);
  });

  it('AC-STAGE-007.1: the leading leg follows the gait, one step per unit', () => {
    expect(leadingLeg(0)).toBeCloseTo(1, 12);
    expect(leadingLeg(1)).toBeCloseTo(-1, 12);
    expect(leadingLeg(2)).toBeCloseTo(1, 12);
    const left = characterPose({ character: 'sayo', action: 'walk', time: 0, gait: 0 });
    const right = characterPose({ character: 'sayo', action: 'walk', time: 0, gait: 1 });
    expect(left.bones.leftUpperLeg.x).toBeLessThan(0);
    expect(right.bones.rightUpperLeg.x).toBeLessThan(0);
  });

  it('a negative or broken frame time leaves the gait as it is', () => {
    expect(advanceGait(1, 2.4, -0.1)).toBe(1);
    expect(advanceGait(1, 2.4, Number.NaN)).toBe(1);
    expect(advanceGait(1, Number.POSITIVE_INFINITY, 0.1)).toBe(1);
  });
});

describe('standing still', () => {
  it('AC-STAGE-007.2: standing still, the character breathes: the spine moves with the breath, once every BREATH_PERIOD_S', () => {
    const spineAt = (time: number) => characterPose({ character: 'sayo', action: 'idle', time }).bones.spine.x;
    const samples = Array.from({ length: 401 }, (_, i) => spineAt((i / 400) * BREATH_PERIOD_S));

    expect(Math.max(...samples) - Math.min(...samples)).toBeCloseTo(2 * BREATH_ANGLE, 3);
    for (const time of [0.3, 1.7, 2.9]) {
      const now = characterPose({ character: 'sayo', action: 'idle', time });
      const nextBreath = characterPose({ character: 'sayo', action: 'idle', time: time + BREATH_PERIOD_S });
      expect(boneDistance(now, nextBreath)).toBeLessThan(1e-9);
      // Breathing moves the body, not the hips height.
      expect(now.hipsY).toBe(0);
    }
  });

  it('AC-STAGE-007.2: standing still, the character blinks once in every BLINK_INTERVAL_S, eyes open the rest of the time', () => {
    const rate = 120;
    const duration = 60;
    let blinks = 0;
    let closed = false;
    let openSamples = 0;
    for (let i = 0; i <= duration * rate; i++) {
      const weight = characterPose({ character: 'sayo', action: 'idle', time: i / rate }).expressions.blink;
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
      if (weight === 0) openSamples += 1;
      if (!closed && weight > 0.5) blinks += 1;
      closed = weight > 0.5;
    }

    expect(blinks).toBe(duration / BLINK_INTERVAL_S);
    expect(openSamples / (duration * rate)).toBeGreaterThan(1 - (2 * BLINK_DURATION_S) / BLINK_INTERVAL_S);
  });

  it('AC-STAGE-007.2: each blink closes the eyes fully, and two characters do not blink together', () => {
    const blinkPeaks = (seed: number) =>
      Array.from({ length: 10 }, (_, window) => {
        let best = { time: 0, weight: 0 };
        for (let i = 0; i <= 4000; i++) {
          const time = window * BLINK_INTERVAL_S + (i / 4000) * BLINK_INTERVAL_S;
          const weight = blinkWeight(time, seed);
          if (weight > best.weight) best = { time, weight };
        }
        return best;
      });
    const player = blinkPeaks(0);
    const shadow = blinkPeaks(1);

    for (const peak of [...player, ...shadow]) expect(peak.weight).toBeGreaterThan(0.99);
    expect(player.map((peak) => peak.time)).not.toEqual(shadow.map((peak) => peak.time));
  });

  it('AC-STAGE-007.2: in the club, both characters bounce on the beat, lowest exactly on each whole beat', () => {
    const duelPhases: SessionPhase[] = [
      { kind: 'countIn', turn: 'echo', bar: 0, beat: 2 },
      { kind: 'opponent', turn: 'answer', bar: 10, index: 1 },
      { kind: 'player', turn: 'solo', bar: 22, index: 1 },
    ];
    const sides = (phase: SessionPhase) => {
      const roles = duelRoles(phase);
      expect(roles.onBeat).toBe(true);
      return [
        { action: roles.player, seed: 0 },
        { action: roles.shadow, seed: 1 },
      ];
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...duelPhases),
        fc.constantFrom(...CHARACTERS),
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (phase, character, beat, offset, time) => {
          for (const { action, seed } of sides(phase)) {
            const hipsAt = (b: number) => characterPose({ character, action, time, beat: b, seed }).hipsY;
            expect(hipsAt(beat)).toBeCloseTo(-BOUNCE_DEPTH_M, 12);
            expect(hipsAt(beat)).toBeLessThan(hipsAt(beat + offset));
            expect(hipsAt(beat)).toBeLessThan(hipsAt(beat - offset));
          }
        },
      ),
    );
    expect(beatDip(0)).toBe(1);
    expect(beatDip(0.5)).toBeCloseTo(0, 12);
  });

  it('AC-STAGE-007.2: the bounce follows the beat of the audio clock only, never the frame time', () => {
    for (const action of ['idle', 'listen', 'play'] as const) {
      const early = characterPose({ character: 'sayo', action, time: 1, beat: 7.25 });
      const late = characterPose({ character: 'sayo', action, time: 93.4, beat: 7.25 });
      expect(late.hipsY).toBe(early.hipsY);
    }
  });

  it('AC-STAGE-007.2: with no beat (before the start or paused), nobody bounces', () => {
    for (const action of ['idle', 'listen', 'play'] as const) {
      for (const time of [0, 1.234, 50]) {
        expect(characterPose({ character: 'sayo', action, time, beat: null }).hipsY).toBe(0);
      }
    }
  });
});

describe('playing music', () => {
  const at = (character: Character, action: CharacterAction, beat: number | null = 4) =>
    characterPose({ character, action, time: 2.5, beat });

  it('AC-STAGE-007.3: playing, sayo takes the singing pose, clearly different from the listening pose', () => {
    expect(PLAYING_STYLE.sayo).toBe('sing');
    const sing = at('sayo', 'play');
    const listen = at('sayo', 'listen');

    expect(boneDistance(sing, listen)).toBeGreaterThan(1);
    // One hand comes up: the forearm bends far more than when listening.
    expect(Math.abs(sing.bones.rightLowerArm.y - listen.bones.rightLowerArm.y)).toBeGreaterThan(1);
    // The head lifts (a negative x tips it back).
    expect(sing.bones.head.x).toBeLessThan(listen.bones.head.x);
    expect(sing.expressions.aa).toBeGreaterThan(0);
    expect(listen.expressions.aa).toBe(0);
  });

  it('AC-STAGE-007.3: singing, the mouth opens on every eighth note and closes in between', () => {
    expect(at('sayo', 'play', 4).expressions.aa).toBeCloseTo(SING_MOUTH_OPEN, 12);
    expect(at('sayo', 'play', 4.5).expressions.aa).toBeCloseTo(SING_MOUTH_OPEN, 12);
    expect(at('sayo', 'play', 4.25).expressions.aa).toBeCloseTo(0, 12);
    for (const beat of [4, 4.25, 4.5, null]) expect(at('sayo', 'listen', beat).expressions.aa).toBe(0);
  });

  it('AC-STAGE-007.3: every character has a playing pose of its own, different from listening and standing', () => {
    const plays = CHARACTERS.map((character) => at(character, 'play'));
    CHARACTERS.forEach((character, i) => {
      expect(boneDistance(plays[i], at(character, 'listen'))).toBeGreaterThan(0.5);
      expect(boneDistance(plays[i], at(character, 'idle'))).toBeGreaterThan(0.5);
    });
    expect(new Set(Object.values(PLAYING_STYLE)).size).toBe(CHARACTERS.length);
    expect(boneDistance(plays[0], plays[1])).toBeGreaterThan(0.3);
    expect(boneDistance(plays[1], plays[2])).toBeGreaterThan(0.3);
    expect(boneDistance(plays[0], plays[2])).toBeGreaterThan(0.3);
  });
});

describe('reduced motion', () => {
  const duelPhases: SessionPhase[] = [
    { kind: 'countIn', turn: 'echo', bar: 0, beat: 2 },
    { kind: 'opponent', turn: 'answer', bar: 10, index: 1 },
    { kind: 'player', turn: 'solo', bar: 22, index: 1 },
  ];

  it('AC-STAGE-007.2: with reduced motion, standing still stops breathing but keeps blinking', () => {
    const still = (time: number) => characterPose({ character: 'sayo', action: 'idle', time, reducedMotion: true });
    const first = still(0);

    for (let i = 1; i <= 80; i++) {
      const time = (i / 80) * 2 * BREATH_PERIOD_S;
      const pose = still(time);
      expect(boneDistance(pose, first)).toBe(0);
      expect(pose.hipsY).toBe(0);
      expect(pose.expressions.blink).toBe(characterPose({ character: 'sayo', action: 'idle', time }).expressions.blink);
    }
    const blinks = Array.from({ length: 2400 }, (_, i) => still(i / 40).expressions.blink);
    expect(Math.max(...blinks)).toBeGreaterThan(0.5);
  });

  it('AC-STAGE-007.2: with reduced motion, neither character bounces in the club: listening and playing poses are held', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...duelPhases),
        fc.constantFrom(...CHARACTERS),
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (phase, character, beat, time) => {
          const roles = duelRoles(phase);
          for (const [action, seed] of [[roles.player, 0], [roles.shadow, 1]] as const) {
            const held = characterPose({ character, action, time, beat, seed, reducedMotion: true });
            const onTheBeat = characterPose({ character, action, time: 0, beat: 0, seed, reducedMotion: true });
            expect(held.hipsY).toBe(0);
            expect(boneDistance(held, onTheBeat)).toBe(0);
          }
        },
      ),
    );
    const sing = characterPose({ character: 'sayo', action: 'play', time: 1, beat: 3, reducedMotion: true });
    const listen = characterPose({ character: 'sayo', action: 'listen', time: 1, beat: 3, reducedMotion: true });
    expect(boneDistance(sing, listen)).toBeGreaterThan(1);
  });

  it('AC-STAGE-007.2: with reduced motion, the walk cycle stays, still v / WALK_STRIDE steps a second', () => {
    expect(walk(STREET_WALK_SPEED, SIXTY_FPS_FOR_10_S, true)).toEqual(walk(STREET_WALK_SPEED, SIXTY_FPS_FOR_10_S));
    expect(walk(STREET_WALK_SPEED, SIXTY_FPS_FOR_10_S, true).leadChanges).toBe(40);
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (gait, time) => {
          const normal = characterPose({ character: 'sayo', action: 'walk', time, gait });
          expect(characterPose({ character: 'sayo', action: 'walk', time, gait, reducedMotion: true })).toEqual(normal);
        },
      ),
    );
  });

  it('AC-STAGE-007.2: without the reduced-motion flag, poses are as before', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHARACTERS),
        fc.constantFrom<CharacterAction>('idle', 'walk', 'listen', 'play'),
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 400, noNaN: true })),
        (character, action, time, beat) => {
          expect(characterPose({ character, action, time, beat, reducedMotion: false })).toEqual(
            characterPose({ character, action, time, beat }),
          );
        },
      ),
    );
  });
});

describe('poses', () => {
  it('give every posed bone and expression a finite value', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CHARACTERS),
        fc.constantFrom<CharacterAction>('idle', 'walk', 'listen', 'play'),
        fc.double({ min: 0, max: 3600, noNaN: true }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 500, noNaN: true })),
        (character, action, time, gait, beat) => {
          const pose = characterPose({ character, action, time, gait, beat });
          for (const bone of POSED_BONES) {
            expect(Object.values(pose.bones[bone]).every(Number.isFinite)).toBe(true);
          }
          expect(Number.isFinite(pose.hipsY)).toBe(true);
          for (const name of POSE_EXPRESSIONS) {
            expect(pose.expressions[name]).toBeGreaterThanOrEqual(0);
            expect(pose.expressions[name]).toBeLessThanOrEqual(1);
          }
        },
      ),
    );
  });

  it('blend from one pose to the next, clamping the weight', () => {
    const from = characterPose({ character: 'sayo', action: 'listen', time: 1, beat: 3 });
    const to = characterPose({ character: 'sayo', action: 'play', time: 1, beat: 3 });

    expect(blendPoses(from, to, 0)).toEqual(from);
    expect(blendPoses(from, to, 1)).toEqual(to);
    expect(blendPoses(from, to, -2)).toEqual(from);
    expect(blendPoses(from, to, 5)).toEqual(to);
    const half = blendPoses(from, to, 0.5);
    expect(half.bones.rightLowerArm.y).toBeCloseTo((from.bones.rightLowerArm.y + to.bones.rightLowerArm.y) / 2, 12);
    expect(half.expressions.aa).toBeCloseTo((from.expressions.aa + to.expressions.aa) / 2, 12);
    expect(half.hipsY).toBeCloseTo((from.hipsY + to.hipsY) / 2, 12);
  });
});
