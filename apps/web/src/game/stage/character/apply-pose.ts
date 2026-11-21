/**
 * Puts a pose from `animation.ts` on a loaded VRM, by VRM 1.0 bone and expression name. It writes
 * the normalized bones and the expression weights only; the scene's `vrm.update(delta)` then
 * carries them to the model, once a frame. A bone or expression the model lacks is skipped.
 */
import type { VRM } from '@pixiv/three-vrm';
import { POSE_EXPRESSIONS, POSED_BONES, type CharacterPose } from './animation';

/** The parts of a VRM a pose writes to. */
export type PoseTarget = Pick<VRM, 'humanoid' | 'expressionManager'>;

export function applyPose(vrm: PoseTarget, pose: CharacterPose): void {
  const { humanoid, expressionManager } = vrm;
  for (const bone of POSED_BONES) {
    const node = humanoid.getNormalizedBoneNode(bone);
    if (!node) continue;
    const { x, y, z } = pose.bones[bone];
    node.rotation.set(x, y, z);
  }

  const hips = humanoid.getNormalizedBoneNode('hips');
  const rest = humanoid.normalizedRestPose.hips?.position;
  if (hips && rest) hips.position.set(rest[0], rest[1] + pose.hipsY, rest[2]);

  for (const name of POSE_EXPRESSIONS) expressionManager?.setValue(name, pose.expressions[name]);
}
