import { Mesh, Texture, type Material, type Object3D } from 'three';
import { MToonMaterial } from '@pixiv/three-vrm';
import type { SessionPhase } from '@/game/core/session';
import {
  advanceGait,
  beatDip,
  blinkWeight,
  breathing,
  characterPose,
  stepsPerSecond,
  type CharacterAction,
} from './animation';
import { WALK_STRIDE } from './config';
import { duelRoles } from './roles';
import { createShadow, shadowPaletteTexture } from './shadow';
import { buildFixtureVrm, fakeImage } from './testing/vrm-fixture';

const turn = 'opponent' as never;
const phase = (p: object): SessionPhase => p as SessionPhase;

describe('AC-STAGE-005.2: roles from the session phase', () => {
  it('AC-STAGE-005.2: opponent turn means shadow plays, player listens', () => {
    const r = duelRoles(phase({ kind: 'opponent', turn, bar: 1, index: 0 }));
    expect(r.shadow).toBe('play');
    expect(r.player).toBe('listen');
  });
  it('AC-STAGE-005.2: player turn is the reverse', () => {
    const r = duelRoles(phase({ kind: 'player', turn, bar: 5, index: 0 }));
    expect(r.player).toBe('play');
    expect(r.shadow).toBe('listen');
  });
  it('AC-STAGE-005.2: nobody plays outside the turns', () => {
    const phases = [
      null,
      phase({ kind: 'ready' }),
      phase({ kind: 'finished' }),
      phase({ kind: 'paused', turn }),
      phase({ kind: 'countIn', turn, bar: 0, beat: 1 }),
    ];
    for (const p of phases) {
      const r = duelRoles(p);
      expect(r.player).not.toBe('play');
      expect(r.shadow).not.toBe('play');
    }
  });
});

describe('AC-STAGE-007.1: walking cadence', () => {
  it.each([0.6, 1.2, 3, -1.8])('AC-STAGE-007.1: steps per second at v=%d is |v|/WALK_STRIDE', (v) => {
    expect(stepsPerSecond(v)).toBeCloseTo(Math.abs(v) / WALK_STRIDE, 9);
  });
  it('AC-STAGE-007.1: one stride of distance is exactly one step', () => {
    expect(advanceGait(0, 1.5, WALK_STRIDE / 1.5)).toBeCloseTo(1, 9);
  });
  it('AC-STAGE-007.1: speed 0 leaves the gait, bad dt changes nothing', () => {
    expect(advanceGait(2, 0, 1)).toBe(2);
    expect(advanceGait(2, 1, -1)).toBe(2);
    expect(advanceGait(2, 1, NaN)).toBe(2);
    expect(advanceGait(2, NaN, 1)).toBe(2);
  });
});

describe('AC-STAGE-007.2: breathing, blinking and beat bounce', () => {
  it('AC-STAGE-007.2: breathing varies and blink happens within 0..1', () => {
    const b = Array.from({ length: 40 }, (_, i) => breathing(i * 0.1));
    expect(Math.max(...b) - Math.min(...b)).toBeGreaterThan(0.5);
    let peak = 0;
    for (let t = 0; t < 4; t += 0.01) {
      const w = blinkWeight(t);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      peak = Math.max(peak, w);
    }
    expect(peak).toBeGreaterThan(0.9);
  });
  it('AC-STAGE-007.2: idle pose changes over time', () => {
    const a = characterPose({ character: 'sayo', action: 'idle', time: 0 });
    const b = characterPose({ character: 'sayo', action: 'idle', time: 1 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('AC-STAGE-007.2: bounce lowest on the beat, highest between beats', () => {
    expect(beatDip(3)).toBeCloseTo(1, 9);
    expect(beatDip(3.5)).toBeCloseTo(0, 9);
    for (const action of ['listen', 'play'] as CharacterAction[]) {
      const on = characterPose({ character: 'sayo', action, time: 0, beat: 4 });
      const off = characterPose({ character: 'sayo', action, time: 0, beat: 4.5 });
      expect(on.hipsY).toBeLessThan(off.hipsY);
    }
  });
});

describe('AC-STAGE-007.3: playing pose differs from listening', () => {
  it.each(['sayo', 'ren', 'aki'] as const)('AC-STAGE-007.3: %s play differs from listen', (character) => {
    const play = characterPose({ character, action: 'play', time: 0, beat: null });
    const listen = characterPose({ character, action: 'listen', time: 0, beat: null });
    expect(JSON.stringify(play.bones)).not.toBe(JSON.stringify(listen.bones));
  });
  it('AC-STAGE-007.3: sayo sings (mouth open), listening does not', () => {
    const play = characterPose({ character: 'sayo', action: 'play', time: 0, beat: 0 });
    const listen = characterPose({ character: 'sayo', action: 'listen', time: 0, beat: 0 });
    expect(play.expressions.aa).toBeGreaterThan(0);
    expect(listen.expressions.aa).toBe(0);
  });
});

describe('AC-STAGE-006.1: shadow is a clone with the shadow palette', () => {
  function materialsOf(root: Object3D): Material[] {
    const out: Material[] = [];
    root.traverse((n) => {
      if (n instanceof Mesh) out.push(...(Array.isArray(n.material) ? n.material : [n.material]));
    });
    return out;
  }
  it('AC-STAGE-006.1: clones without touching the source and uses the palette image', () => {
    const fx = buildFixtureVrm();
    const image = fakeImage('shadow');
    const palette = shadowPaletteTexture(image);
    const sourceBefore = materialsOf(fx.vrm.scene);
    const shadow = createShadow(fx.vrm, palette);

    expect(shadow).not.toBe(fx.vrm);
    expect(shadow.scene).not.toBe(fx.vrm.scene);
    expect(shadow.humanoid.getRawBoneNode('hips')).not.toBe(fx.vrm.humanoid.getRawBoneNode('hips'));
    expect(materialsOf(fx.vrm.scene)).toEqual(sourceBefore);
    expect(fx.palette.image).toBe(fx.paletteImage);

    const sm = materialsOf(shadow.scene);
    expect(sm.length).toBe(sourceBefore.length);
    for (const m of sm) expect(sourceBefore).not.toContain(m);
    const images = sm
      .flatMap((m) =>
        m instanceof MToonMaterial
          ? Object.values(m.uniforms).map((u) => u.value)
          : [(m as { map?: Texture }).map],
      )
      .filter((v): v is Texture => v instanceof Texture)
      .map((t) => t.image);
    expect(images).toContain(image);
    expect(images).not.toContain(fx.paletteImage);
  });
});
