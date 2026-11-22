/**
 * The Shadow of this slice (game-stage AC-STAGE-006.1): a clone of the player's loaded VRM drawn
 * with the Shadow palette of the manifest. The model is never downloaded or parsed a second time:
 * the clone shares every geometry with the player and owns everything that has to differ.
 *
 * What the clone owns:
 * - its node tree, with the transforms of the player's rest pose;
 * - a skeleton per skinned mesh, bound to its own bones, so posing one model never moves the other;
 * - a copy of every material, with the Shadow palette on `map` and, for MToon, on
 *   `shadeMultiplyTexture` too, its `shadeColorFactor` set to `SHADOW_SHADE_FACTOR`; changing a
 *   Shadow material (the fade after a win) never changes the player;
 * - a humanoid, expressions and spring bones rebuilt on its own nodes and materials.
 * Look-at and node constraints are not part of the asset contract and are not copied.
 *
 * Release a Shadow with `disposeShadow`, not `VRMUtils.deepDispose`: the geometries belong to the
 * player too.
 */
import {
  Bone,
  Group,
  Mesh,
  NearestFilter,
  Object3D,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  type Material,
} from 'three';
import {
  MToonMaterial,
  VRM,
  VRMExpression,
  VRMExpressionManager,
  VRMExpressionMaterialColorBind,
  VRMExpressionMorphTargetBind,
  VRMExpressionTextureTransformBind,
  VRMHumanoid,
  VRMHumanBoneList,
  VRMRequiredHumanBoneName,
  VRMSpringBoneCollider,
  VRMSpringBoneJoint,
  VRMSpringBoneManager,
  type VRMExpressionBind,
  type VRMHumanBones,
  type VRMSpringBoneColliderGroup,
} from '@pixiv/three-vrm';
import { SHADOW_SHADE_FACTOR } from './config';

/** Decodes an image file. The default is `createImageBitmap` with the options GLTFLoader uses. */
export type DecodeImage = (blob: Blob) => Promise<unknown>;

/** Decodes like GLTFLoader's `ImageBitmapLoader`, so both palettes read the same pixels. */
const decodeLikeGltfLoader: DecodeImage = (blob) =>
  createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });

/**
 * The texture of a decoded Shadow palette, sampled like the model's own palette: not flipped (glTF
 * UVs), nearest filtering so every 8×8 cell keeps one colour, and sRGB colours.
 */
export function shadowPaletteTexture(image: unknown): Texture {
  const texture = new Texture(image);
  texture.name = 'shadowPalette';
  texture.flipY = false;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The Shadow palette texture from the bytes the asset loader downloaded for `shadowPalette`
 * (`StageAssetFiles.playerShadowPalette`, a PNG).
 */
export async function decodeShadowPalette(
  bytes: ArrayBuffer,
  decode: DecodeImage = decodeLikeGltfLoader,
): Promise<Texture> {
  const image = await decode(new Blob([bytes], { type: 'image/png' }));
  return shadowPaletteTexture(image);
}

/** What a Shadow owns, so `disposeShadow` can release it without touching the player. */
interface ShadowResources {
  readonly materials: readonly Material[];
  readonly skeletons: readonly Skeleton[];
  readonly palette: Texture;
}

const shadowResources = new WeakMap<VRM, ShadowResources>();

type NodeMap = ReadonlyMap<Object3D, Object3D>;

/** The clone of `node`, checked to be of the same class. Throws when `node` was not cloned. */
function cloneOf<T extends Object3D>(
  nodes: NodeMap,
  node: Object3D,
  kind: abstract new (...args: never[]) => T,
): T {
  const clone = nodes.get(node);
  if (!(clone instanceof kind)) {
    throw new Error(`createShadow: node "${node.name}" is not part of the model's scene`);
  }
  return clone;
}

/** Nodes the VRM loader adds to the scene for its own use; the clone gets its own. */
function loaderNodes(source: VRM): (node: Object3D) => boolean {
  const helpers = new Set<Object3D>([source.humanoid.normalizedHumanBonesRoot]);
  return (node) =>
    helpers.has(node) || node instanceof VRMExpression || node instanceof VRMSpringBoneCollider;
}

/** Clones the tree under `root` node by node, leaving out `skip`. Meshes keep their geometry. */
function cloneTree(root: Group, skip: (node: Object3D) => boolean): { root: Group; nodes: NodeMap } {
  const nodes = new Map<Object3D, Object3D>();
  const copy = (node: Object3D): Object3D => {
    const clone = node.clone(false);
    // A spring bone centre keeps a live inverse-matrix cache in `userData`; `clone` copies it as
    // plain JSON, which would stop the Shadow's joints from making their own.
    delete clone.userData.inverseCacheProxy;
    nodes.set(node, clone);
    for (const child of node.children) {
      if (!skip(child)) clone.add(copy(child));
    }
    return clone;
  };
  copy(root);
  return { root: cloneOf(nodes, root, Group), nodes };
}

/** Puts the cloned human bones in the rest pose of the source, whatever pose the source is in. */
function restoreRestPose(source: VRM, nodes: NodeMap): void {
  const rest = source.humanoid.rawRestPose;
  for (const name of VRMHumanBoneList) {
    const sourceNode = source.humanoid.getRawBoneNode(name);
    const transform = rest[name];
    if (!sourceNode || !transform) continue;
    const node = cloneOf(nodes, sourceNode, Object3D);
    if (transform.position) node.position.fromArray(transform.position);
    if (transform.rotation) node.quaternion.fromArray(transform.rotation);
  }
}

/** Binds every cloned skinned mesh to a skeleton of cloned bones. */
function rebindSkins(root: Group, nodes: NodeMap): Skeleton[] {
  const skeletons = new Map<Skeleton, Skeleton>();
  root.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    const sourceSkeleton: Skeleton = node.skeleton;
    let skeleton = skeletons.get(sourceSkeleton);
    if (!skeleton) {
      skeleton = new Skeleton(
        sourceSkeleton.bones.map((bone) => cloneOf(nodes, bone, Bone)),
        sourceSkeleton.boneInverses.map((inverse) => inverse.clone()),
      );
      skeletons.set(sourceSkeleton, skeleton);
    }
    node.bind(skeleton, node.bindMatrix);
  });
  return [...skeletons.values()];
}

/** A copy of `material` in the Shadow palette. */
function shadowMaterial(material: Material, palette: Texture): Material {
  const clone = material.clone();
  if (clone instanceof MToonMaterial) {
    clone.map = palette;
    clone.shadeMultiplyTexture = palette;
    clone.shadeColorFactor.setScalar(SHADOW_SHADE_FACTOR);
  } else if ('map' in clone && clone.map instanceof Texture) {
    clone.map = palette;
  }
  clone.needsUpdate = true;
  return clone;
}

/** Gives every cloned mesh its own Shadow materials; returns the copy of any source material. */
function recolour(root: Group, palette: Texture): (material: Material) => Material {
  const copies = new Map<Material, Material>();
  const copyOf = (material: Material): Material => {
    let copy = copies.get(material);
    if (!copy) {
      copy = shadowMaterial(material, palette);
      copies.set(material, copy);
    }
    return copy;
  };
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material: Material | Material[] = node.material;
    node.material = Array.isArray(material) ? material.map(copyOf) : copyOf(material);
  });
  return copyOf;
}

function hasRequiredBones(bones: Partial<VRMHumanBones>): bones is VRMHumanBones {
  return Object.values(VRMRequiredHumanBoneName).every((name) => bones[name] !== undefined);
}

function cloneHumanoid(source: VRMHumanoid, nodes: NodeMap): VRMHumanoid {
  const bones: Partial<VRMHumanBones> = {};
  for (const name of VRMHumanBoneList) {
    const node = source.getRawBoneNode(name);
    if (node) bones[name] = { node: cloneOf(nodes, node, Object3D) };
  }
  if (!hasRequiredBones(bones)) {
    throw new Error('createShadow: the model lacks a required humanoid bone');
  }
  return new VRMHumanoid(bones, { autoUpdateHumanBones: source.autoUpdateHumanBones });
}

function cloneBind(
  bind: VRMExpressionBind,
  nodes: NodeMap,
  materialCopy: (material: Material) => Material,
): VRMExpressionBind | null {
  if (bind instanceof VRMExpressionMorphTargetBind) {
    return new VRMExpressionMorphTargetBind({
      primitives: bind.primitives.map((mesh) => cloneOf(nodes, mesh, Mesh)),
      index: bind.index,
      weight: bind.weight,
    });
  }
  if (bind instanceof VRMExpressionMaterialColorBind) {
    return new VRMExpressionMaterialColorBind({
      material: materialCopy(bind.material),
      type: bind.type,
      targetValue: bind.targetValue,
      targetAlpha: bind.targetAlpha,
    });
  }
  if (bind instanceof VRMExpressionTextureTransformBind) {
    return new VRMExpressionTextureTransformBind({
      material: materialCopy(bind.material),
      scale: bind.scale,
      offset: bind.offset,
    });
  }
  return null;
}

function cloneExpressions(
  source: VRMExpressionManager,
  root: Group,
  nodes: NodeMap,
  materialCopy: (material: Material) => Material,
): VRMExpressionManager {
  const manager = new VRMExpressionManager();
  manager.blinkExpressionNames = [...source.blinkExpressionNames];
  manager.lookAtExpressionNames = [...source.lookAtExpressionNames];
  manager.mouthExpressionNames = [...source.mouthExpressionNames];
  for (const expression of source.expressions) {
    const copy = new VRMExpression(expression.expressionName);
    copy.isBinary = expression.isBinary;
    copy.overrideBlink = expression.overrideBlink;
    copy.overrideLookAt = expression.overrideLookAt;
    copy.overrideMouth = expression.overrideMouth;
    for (const bind of expression.binds) {
      const bindCopy = cloneBind(bind, nodes, materialCopy);
      if (bindCopy) copy.addBind(bindCopy);
    }
    // In the scene, as the loader does, so an AnimationMixer can drive `weight`.
    root.add(copy);
    manager.registerExpression(copy);
  }
  return manager;
}

function cloneSpringBones(source: VRMSpringBoneManager, nodes: NodeMap): VRMSpringBoneManager {
  const colliders = new Map<VRMSpringBoneCollider, VRMSpringBoneCollider>();
  for (const collider of source.colliders) {
    if (!collider.parent) continue;
    const copy = new VRMSpringBoneCollider(collider.shape);
    copy.name = collider.name;
    copy.position.copy(collider.position);
    copy.quaternion.copy(collider.quaternion);
    copy.scale.copy(collider.scale);
    cloneOf(nodes, collider.parent, Object3D).add(copy);
    colliders.set(collider, copy);
  }

  const groups = new Map<VRMSpringBoneColliderGroup, VRMSpringBoneColliderGroup>();
  for (const group of source.colliderGroups) {
    groups.set(group, {
      name: group.name,
      colliders: group.colliders.flatMap((collider) => colliders.get(collider) ?? []),
    });
  }

  const manager = new VRMSpringBoneManager();
  for (const joint of source.joints) {
    const copy = new VRMSpringBoneJoint(
      cloneOf(nodes, joint.bone, Object3D),
      joint.child ? cloneOf(nodes, joint.child, Object3D) : null,
      joint.settings,
      joint.colliderGroups.flatMap((group) => groups.get(group) ?? []),
    );
    if (joint.center) copy.center = cloneOf(nodes, joint.center, Object3D);
    manager.addJoint(copy);
  }
  manager.setInitState();
  return manager;
}

/**
 * The Shadow: a clone of `source`, the player's loaded VRM, drawn with `palette` (from
 * `decodeShadowPalette`). Synchronous, and it fetches and parses nothing.
 *
 * The clone starts in the rest pose at the origin, whatever the source is doing. To read the rest
 * state, the source's spring bones are reset and its applied expression weights cleared; its next
 * `update` applies its expressions again.
 */
export function createShadow(source: VRM, palette: Texture): VRM {
  source.springBoneManager?.reset();
  source.expressionManager?.expressions.forEach((expression) => expression.clearAppliedWeight());

  const { root, nodes } = cloneTree(source.scene, loaderNodes(source));
  root.name = `${source.scene.name}_shadow`;
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.set(1, 1, 1);
  restoreRestPose(source, nodes);
  root.updateMatrixWorld(true);

  const skeletons = rebindSkins(root, nodes);
  const materialCopy = recolour(root, palette);
  const humanoid = cloneHumanoid(source.humanoid, nodes);
  root.add(humanoid.normalizedHumanBonesRoot);
  const expressionManager = source.expressionManager
    ? cloneExpressions(source.expressionManager, root, nodes, materialCopy)
    : undefined;
  const springBoneManager = source.springBoneManager
    ? cloneSpringBones(source.springBoneManager, nodes)
    : undefined;

  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material: Material | Material[] = node.material;
    for (const each of Array.isArray(material) ? material : [material]) materials.add(each);
  });

  const shadow = new VRM({
    scene: root,
    meta: source.meta,
    humanoid,
    expressionManager,
    springBoneManager,
    materials: [...materials],
  });
  shadowResources.set(shadow, { materials: [...materials], skeletons, palette });
  return shadow;
}

/** Every texture of `material` drawn from the palette's image: the palette and copies of it. */
function paletteTextures(material: Material, palette: Texture): Texture[] {
  const values =
    material instanceof MToonMaterial
      ? Object.values(material.uniforms).map((uniform) => uniform.value)
      : ['map' in material ? material.map : null];
  return values.filter(
    (value): value is Texture => value instanceof Texture && value.source === palette.source,
  );
}

/**
 * Removes a Shadow from its parent and frees what it owns: its materials, the palette textures and
 * its skeletons. The geometries are shared with the player and stay. Does nothing for a VRM that
 * `createShadow` did not make, or one already disposed.
 */
export function disposeShadow(shadow: VRM): void {
  const owned = shadowResources.get(shadow);
  if (!owned) return;
  shadowResources.delete(shadow);
  shadow.scene.removeFromParent();

  const textures = new Set<Texture>([owned.palette]);
  for (const material of owned.materials) {
    for (const texture of paletteTextures(material, owned.palette)) textures.add(texture);
    material.dispose();
  }
  textures.forEach((texture) => texture.dispose());
  owned.skeletons.forEach((skeleton) => skeleton.dispose());
}
