import { Quaternion } from 'three';
import { characterPose, POSE_EXPRESSIONS, POSED_BONES } from './animation';
import { applyPose } from './apply-pose';
import { buildFixtureVrm } from './testing/vrm-fixture';

describe('putting a pose on a model', () => {
  it('sets every posed bone by its VRM 1.0 name, the hips height and the expressions', () => {
    const { vrm } = buildFixtureVrm();
    const pose = characterPose({ character: 'sayo', action: 'play', time: 1.3, beat: 2 });

    applyPose(vrm, pose);

    for (const bone of POSED_BONES) {
      const node = vrm.humanoid.getNormalizedBoneNode(bone);
      if (!node) throw new Error(`the fixture has no ${bone}`);
      expect(node.rotation.toArray().slice(0, 3)).toEqual([pose.bones[bone].x, pose.bones[bone].y, pose.bones[bone].z]);
    }
    const restHips = vrm.humanoid.normalizedRestPose.hips?.position;
    expect(vrm.humanoid.getNormalizedBoneNode('hips')?.position.y).toBeCloseTo((restHips?.[1] ?? NaN) + pose.hipsY, 12);
    for (const name of POSE_EXPRESSIONS) {
      expect(vrm.expressionManager?.getValue(name)).toBeCloseTo(pose.expressions[name], 12);
    }
  });

  it('moves the model once the VRM updates', () => {
    const { vrm } = buildFixtureVrm();
    const arm = vrm.humanoid.getRawBoneNode('rightLowerArm');
    const before = arm?.quaternion.clone() ?? new Quaternion();

    applyPose(vrm, characterPose({ character: 'sayo', action: 'play', time: 0, beat: 0 }));
    vrm.update(1 / 60);

    expect(arm?.quaternion.angleTo(before)).toBeGreaterThan(1);
  });

  it('poses a model without expressions', () => {
    const { vrm } = buildFixtureVrm();
    const pose = characterPose({ character: 'sayo', action: 'listen', time: 0, beat: 1 });

    applyPose({ humanoid: vrm.humanoid, expressionManager: undefined }, pose);

    expect(vrm.humanoid.getNormalizedBoneNode('head')?.rotation.x).toBe(pose.bones.head.x);
  });
});
