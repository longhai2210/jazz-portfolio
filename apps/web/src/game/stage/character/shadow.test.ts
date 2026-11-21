import {
  Bone,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Quaternion,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { MToonMaterial, VRM, VRMExpression, VRMHumanBoneList } from '@pixiv/three-vrm';
import { characterPose } from './animation';
import { applyPose } from './apply-pose';
import { SHADOW_SHADE_FACTOR } from './config';
import { createShadow, decodeShadowPalette, disposeShadow, shadowPaletteTexture } from './shadow';
import { buildFixtureVrm, fakeImage } from './testing/vrm-fixture';

function nodesOf(root: Object3D): Set<Object3D> {
  const nodes = new Set<Object3D>();
  root.traverse((node) => nodes.add(node));
  return nodes;
}

function meshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh) meshes.push(node);
  });
  return meshes;
}

function materialsOf(root: Object3D): Material[] {
  return meshesOf(root).flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
}

function textureImage(texture: Texture | null): unknown {
  return texture?.image;
}

function makeShadow() {
  const fixture = buildFixtureVrm();
  const shadowImage = fakeImage('shadow palette');
  const palette = shadowPaletteTexture(shadowImage);
  const shadow = createShadow(fixture.vrm, palette);
  return { ...fixture, shadow, palette, shadowImage };
}

describe('the Shadow', () => {
  it('AC-STAGE-006.1: the Shadow is a clone of the loaded model: same meshes and geometry, its own nodes and skeleton', () => {
    const { vrm, shadow } = makeShadow();
    const playerNodes = nodesOf(vrm.scene);
    const shadowNodes = nodesOf(shadow.scene);

    expect(shadow).toBeInstanceOf(VRM);
    expect(shadow.scene).toBeInstanceOf(Group);
    expect([...shadowNodes].filter((node) => playerNodes.has(node))).toEqual([]);

    const playerMeshes = meshesOf(vrm.scene);
    const shadowMeshes = meshesOf(shadow.scene);
    expect(shadowMeshes.map((mesh) => mesh.name)).toEqual(playerMeshes.map((mesh) => mesh.name));
    shadowMeshes.forEach((mesh, i) => expect(mesh.geometry).toBe(playerMeshes[i].geometry));

    for (const mesh of shadowMeshes) {
      if (!(mesh instanceof SkinnedMesh)) continue;
      expect(mesh.skeleton.bones.length).toBeGreaterThan(0);
      for (const bone of mesh.skeleton.bones) {
        expect(shadowNodes.has(bone)).toBe(true);
        expect(playerNodes.has(bone)).toBe(false);
      }
    }
  });

  it('AC-STAGE-006.1: the Shadow has its own humanoid and expressions, and none of the player’s', () => {
    const { vrm, shadow } = makeShadow();
    const shadowNodes = nodesOf(shadow.scene);

    for (const name of VRMHumanBoneList) {
      const playerBone = vrm.humanoid.getRawBoneNode(name);
      const shadowBone = shadow.humanoid.getRawBoneNode(name);
      expect(shadowBone === null).toBe(playerBone === null);
      if (shadowBone) expect(shadowNodes.has(shadowBone)).toBe(true);
      const normalized = shadow.humanoid.getNormalizedBoneNode(name);
      if (normalized) expect(shadowNodes.has(normalized)).toBe(true);
    }
    const rigs = [...shadowNodes].filter((node) => node.name === 'VRMHumanoidRig');
    expect(rigs).toEqual([shadow.humanoid.normalizedHumanBonesRoot]);

    const expressions = shadow.expressionManager?.expressions ?? [];
    expect(expressions.map((expression) => expression.expressionName)).toEqual(['blink', 'aa', 'happy']);
    const inScene = [...shadowNodes].filter((node) => node instanceof VRMExpression);
    expect(inScene).toEqual(expressions);
    for (const expression of vrm.expressionManager?.expressions ?? []) {
      expect(shadowNodes.has(expression)).toBe(false);
    }
  });

  it('AC-STAGE-006.1: the Shadow uses the Shadow palette on map and shadeMultiplyTexture, and the player keeps its own', () => {
    const { vrm, shadow, palette, shadowImage, paletteImage, shadeImage, surface, outline, plain } = makeShadow();
    const shadowMaterials = materialsOf(shadow.scene);
    const playerMaterials = new Set(materialsOf(vrm.scene));

    expect(shadowMaterials).toHaveLength(3);
    for (const material of shadowMaterials) {
      expect(playerMaterials.has(material)).toBe(false);
      if (material instanceof MToonMaterial) {
        expect(material.map?.source).toBe(palette.source);
        expect(material.shadeMultiplyTexture?.source).toBe(palette.source);
        expect(material.shadeColorFactor.toArray()).toEqual([
          SHADOW_SHADE_FACTOR,
          SHADOW_SHADE_FACTOR,
          SHADOW_SHADE_FACTOR,
        ]);
      } else if (material instanceof MeshBasicMaterial) {
        expect(material.map).toBe(palette);
      } else {
        throw new Error(`unexpected material ${material.type}`);
      }
    }
    expect(textureImage(palette)).toBe(shadowImage);
    expect(new Set(shadow.materials)).toEqual(new Set(shadowMaterials));

    for (const material of [surface, outline]) {
      expect(textureImage(material.map)).toBe(paletteImage);
      expect(textureImage(material.shadeMultiplyTexture)).toBe(shadeImage);
      expect(material.shadeColorFactor.toArray()).toEqual(outline === material ? [0, 0, 0] : [1, 1, 1]);
    }
    expect(textureImage(plain.map)).toBe(paletteImage);
  });

  it('AC-STAGE-006.1: the Shadow palette is sampled like the model palette: not flipped, nearest, sRGB', () => {
    const palette = shadowPaletteTexture(fakeImage('shadow palette'));

    expect(palette.flipY).toBe(false);
    expect(palette.minFilter).toBe(NearestFilter);
    expect(palette.magFilter).toBe(NearestFilter);
    expect(palette.colorSpace).toBe(SRGBColorSpace);
  });

  it('AC-STAGE-006.1: making the Shadow does not load the model a second time', () => {
    const fetchSpy = jest.fn();
    const realFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy;
    try {
      const { vrm, shadow } = makeShadow();

      expect(shadow).toBeInstanceOf(VRM);
      expect(fetchSpy).not.toHaveBeenCalled();
      const playerGeometries = new Set(meshesOf(vrm.scene).map((mesh) => mesh.geometry));
      for (const mesh of meshesOf(shadow.scene)) expect(playerGeometries.has(mesh.geometry)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('AC-STAGE-006.1: the Shadow palette comes from the downloaded bytes, decoded once like the model textures', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]).buffer;
    const image = fakeImage('decoded');
    const decode = jest.fn(async (blob: Blob) => {
      expect(blob.type).toBe('image/png');
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(bytes));
      return image;
    });

    const palette = await decodeShadowPalette(bytes, decode);

    expect(decode).toHaveBeenCalledTimes(1);
    expect(palette.image).toBe(image);
    expect(palette.flipY).toBe(false);
    expect(palette.magFilter).toBe(NearestFilter);
  });

  it('posing the Shadow, changing its expressions or fading it never changes the player', () => {
    const { vrm, shadow, body, surface, outline } = makeShadow();
    const shadowBody = meshesOf(shadow.scene).find((mesh) => mesh.name === 'body');
    if (!shadowBody) throw new Error('no body mesh in the Shadow');
    const playerArm = vrm.humanoid.getRawBoneNode('leftUpperArm');
    const shadowArm = shadow.humanoid.getRawBoneNode('leftUpperArm');
    const playerArmBefore = playerArm?.quaternion.clone();

    applyPose(shadow, characterPose({ character: 'sayo', action: 'play', time: 1, beat: 2 }));
    shadow.expressionManager?.setValue('blink', 1);
    shadow.expressionManager?.setValue('happy', 1);
    shadow.update(1 / 60);
    vrm.update(1 / 60);

    expect(shadowArm?.quaternion.equals(new Quaternion())).toBe(false);
    expect(playerArm?.quaternion.equals(playerArmBefore ?? new Quaternion())).toBe(true);
    expect(shadowBody.morphTargetInfluences?.[0]).toBe(1);
    expect(body.morphTargetInfluences?.[0]).toBe(0);

    const shadowSurface = materialsOf(shadow.scene).find((material) => material.name === 'surface');
    if (!(shadowSurface instanceof MToonMaterial)) throw new Error('no MToon surface in the Shadow');
    // `happy` tints the Shadow's surface only.
    expect(shadowSurface.color.toArray()).not.toEqual(surface.color.toArray());
    // Fading: the Shadow's own material list uploads its opacity. (The outline has no colour bind;
    // a `color` bind of an expression resets `opacity` on every expression update.)
    const shadowOutline = materialsOf(shadow.scene).find((material) => material.name === 'outline');
    if (!(shadowOutline instanceof MToonMaterial)) throw new Error('no MToon outline in the Shadow');
    shadowOutline.opacity = 0.25;
    shadow.update(1 / 60);
    vrm.update(1 / 60);
    expect(shadowOutline.uniforms.opacity.value).toBe(0.25);
    expect(outline.uniforms.opacity.value).toBe(1);
    expect(materialsOf(vrm.scene).every((material) => material.opacity === 1)).toBe(true);
  });

  it('starts in the rest pose at the origin even when the player is posed and moved', () => {
    const { vrm } = buildFixtureVrm();
    const rest = vrm.humanoid.rawRestPose;
    vrm.scene.position.set(3, 0, -2);
    vrm.scene.rotation.y = Math.PI / 2;
    applyPose(vrm, characterPose({ character: 'sayo', action: 'walk', time: 1, gait: 0.4 }));
    vrm.expressionManager?.setValue('blink', 1);
    for (let i = 0; i < 30; i++) vrm.update(1 / 60);

    const shadow = createShadow(vrm, shadowPaletteTexture(fakeImage('shadow palette')));

    expect(shadow.scene.position.toArray()).toEqual([0, 0, 0]);
    expect(shadow.scene.quaternion.equals(new Quaternion())).toBe(true);
    for (const name of VRMHumanBoneList) {
      const node = shadow.humanoid.getRawBoneNode(name);
      const transform = rest[name];
      if (!node || !transform?.rotation || !transform.position) continue;
      expect(node.quaternion.angleTo(new Quaternion().fromArray(transform.rotation))).toBeLessThan(1e-9);
      expect(node.position.distanceTo(new Vector3().fromArray(transform.position))).toBeLessThan(1e-9);
    }
    const shadowBody = meshesOf(shadow.scene).find((mesh) => mesh.name === 'body');
    expect(shadowBody?.morphTargetInfluences?.[0]).toBe(0);
  });

  it('rebuilds the spring bones and their collider on the Shadow, centred on its own rig root', () => {
    const { vrm, shadow, springBones, collider } = makeShadow();
    const shadowNodes = nodesOf(shadow.scene);
    const joints = [...(shadow.springBoneManager?.joints ?? [])];

    expect(joints).toHaveLength(springBones.length - 1);
    for (const joint of joints) {
      expect(joint.bone).toBeInstanceOf(Bone);
      expect(shadowNodes.has(joint.bone)).toBe(true);
      expect(joint.child && shadowNodes.has(joint.child)).toBe(true);
      expect(joint.center?.name).toBe('rig_root');
      expect(joint.center && shadowNodes.has(joint.center)).toBe(true);
      for (const group of joint.colliderGroups) {
        for (const each of group.colliders) {
          expect(each).not.toBe(collider);
          expect(shadowNodes.has(each)).toBe(true);
          expect(each.parent?.name).toBe('head');
        }
      }
    }

    const playerSpring = springBones[0].quaternion.clone();
    shadow.humanoid.getNormalizedBoneNode('head')?.rotation.set(0.8, 0.4, 0);
    for (let i = 0; i < 30; i++) shadow.update(1 / 60);
    expect(springBones[0].quaternion.equals(playerSpring)).toBe(true);
    vrm.update(1 / 60);
  });

  it('disposeShadow frees the Shadow materials, palette and skeletons, never the shared geometry or the player', () => {
    const { vrm, shadow, palette } = makeShadow();
    const parent = new Group();
    parent.add(shadow.scene);
    const disposed: unknown[] = [];
    const watch = (target: { addEventListener(type: 'dispose', listener: () => void): void }) =>
      target.addEventListener('dispose', () => disposed.push(target));
    const geometries = meshesOf(vrm.scene).map((mesh) => mesh.geometry);
    geometries.forEach(watch);
    materialsOf(vrm.scene).forEach(watch);
    const shadowMaterials = materialsOf(shadow.scene);
    shadowMaterials.forEach(watch);
    watch(palette);

    disposeShadow(shadow);

    expect(shadow.scene.parent).toBeNull();
    for (const material of shadowMaterials) expect(disposed).toContain(material);
    expect(disposed).toContain(palette);
    for (const geometry of geometries) expect(disposed).not.toContain(geometry);
    for (const material of materialsOf(vrm.scene)) expect(disposed).not.toContain(material);

    const count = disposed.length;
    disposeShadow(shadow);
    disposeShadow(vrm);
    expect(disposed).toHaveLength(count);
  });
});
