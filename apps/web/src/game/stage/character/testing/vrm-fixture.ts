/**
 * A small VRM built by hand for tests: no file, no WebGL. It is set up the way the VRM loader sets
 * up a parsed model: a humanoid skeleton under a rig root, one skinned mesh with two morph targets
 * and an MToon surface and outline material, one plain mesh, the `blink`, `happy` and `aa`
 * expressions added to the scene, the normalized rig in the scene, and one spring chain with a
 * collider, centred on the rig root.
 */
import {
  Bone,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
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
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneJoint,
  VRMSpringBoneManager,
  type VRMHumanBones,
} from '@pixiv/three-vrm';

export interface FixtureVrm {
  readonly vrm: VRM;
  readonly rigRoot: Object3D;
  readonly body: SkinnedMesh;
  readonly prop: Mesh;
  readonly surface: MToonMaterial;
  readonly outline: MToonMaterial;
  readonly plain: MeshBasicMaterial;
  /** The model's own palette and shade palette textures, and their images. */
  readonly palette: Texture;
  readonly shade: Texture;
  readonly paletteImage: object;
  readonly shadeImage: object;
  /** The bones of the spring chain, root first. */
  readonly springBones: readonly Bone[];
  readonly collider: VRMSpringBoneCollider;
}

/** A stand-in for a decoded 64×64 image: three.js never reads it without WebGL. */
export function fakeImage(label: string): object {
  return { label, width: 64, height: 64 };
}

function paletteTexture(image: object, name: string): Texture {
  const texture = new Texture(image);
  texture.name = name;
  texture.flipY = false;
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function bone(name: string, parent: Object3D, x: number, y: number, z = 0): Bone {
  const node = new Bone();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

export function buildFixtureVrm(): FixtureVrm {
  const scene = new Group();
  scene.name = 'fixture';
  const rigRoot = new Object3D();
  rigRoot.name = 'rig_root';
  scene.add(rigRoot);

  const hips = bone('hips', rigRoot, 0, 0.9);
  const spine = bone('spine', hips, 0, 0.1);
  const chest = bone('chest', spine, 0, 0.15);
  const neck = bone('neck', chest, 0, 0.2);
  const head = bone('head', neck, 0, 0.1);
  const leftUpperArm = bone('upper_arm.L', chest, 0.15, 0.15);
  const leftLowerArm = bone('lower_arm.L', leftUpperArm, 0.25, 0);
  const leftHand = bone('hand.L', leftLowerArm, 0.25, 0);
  const rightUpperArm = bone('upper_arm.R', chest, -0.15, 0.15);
  const rightLowerArm = bone('lower_arm.R', rightUpperArm, -0.25, 0);
  const rightHand = bone('hand.R', rightLowerArm, -0.25, 0);
  const leftUpperLeg = bone('upper_leg.L', hips, 0.1, -0.05);
  const leftLowerLeg = bone('lower_leg.L', leftUpperLeg, 0, -0.4);
  const leftFoot = bone('foot.L', leftLowerLeg, 0, -0.4);
  const rightUpperLeg = bone('upper_leg.R', hips, -0.1, -0.05);
  const rightLowerLeg = bone('lower_leg.R', rightUpperLeg, 0, -0.4);
  const rightFoot = bone('foot.R', rightLowerLeg, 0, -0.4);
  const spring0 = bone('spring_0', head, 0, 0.1, -0.05);
  const spring1 = bone('spring_1', spring0, 0, -0.1);
  const spring2 = bone('spring_2', spring1, 0, -0.1);
  const springBones = [spring0, spring1, spring2];

  const humanBones: VRMHumanBones = {
    hips: { node: hips },
    spine: { node: spine },
    chest: { node: chest },
    neck: { node: neck },
    head: { node: head },
    leftUpperArm: { node: leftUpperArm },
    leftLowerArm: { node: leftLowerArm },
    leftHand: { node: leftHand },
    rightUpperArm: { node: rightUpperArm },
    rightLowerArm: { node: rightLowerArm },
    rightHand: { node: rightHand },
    leftUpperLeg: { node: leftUpperLeg },
    leftLowerLeg: { node: leftLowerLeg },
    leftFoot: { node: leftFoot },
    rightUpperLeg: { node: rightUpperLeg },
    rightLowerLeg: { node: rightLowerLeg },
    rightFoot: { node: rightFoot },
  };

  const paletteImage = fakeImage('palette');
  const shadeImage = fakeImage('shade');
  const palette = paletteTexture(paletteImage, 'palette');
  const shade = paletteTexture(shadeImage, 'shade');

  const surface = new MToonMaterial();
  surface.name = 'surface';
  surface.map = palette;
  surface.shadeMultiplyTexture = shade;
  surface.shadeColorFactor.setScalar(1);
  const outline = new MToonMaterial();
  outline.name = 'outline';
  outline.isOutline = true;
  outline.map = palette;
  outline.shadeMultiplyTexture = shade;
  const plain = new MeshBasicMaterial({ map: palette });
  plain.name = 'plain';

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 1, 0, 0.1, 1, 0, 0, 1.6, 0, 0.1, 0.5, 0], 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 11, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.morphAttributes.position = [
    new Float32BufferAttribute([0, -0.01, 0, 0, -0.01, 0, 0, 0, 0, 0, 0, 0], 3),
    new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, -0.02, 0, 0, 0, 0], 3),
  ];
  geometry.addGroup(0, Infinity, 0);
  geometry.addGroup(0, Infinity, 1);
  const body = new SkinnedMesh(geometry, [surface, outline]);
  body.name = 'body';
  body.updateMorphTargets();
  scene.add(body);

  const prop = new Mesh(new BufferGeometry(), plain);
  prop.name = 'prop';
  head.add(prop);

  scene.updateMatrixWorld(true);
  body.bind(new Skeleton([hips, spine, chest, neck, head, leftUpperArm, leftLowerArm, leftHand, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, rightUpperLeg, rightLowerLeg, rightFoot, ...springBones]));

  const humanoid = new VRMHumanoid(humanBones);
  scene.add(humanoid.normalizedHumanBonesRoot);

  const expressionManager = new VRMExpressionManager();
  const blink = new VRMExpression('blink');
  blink.addBind(new VRMExpressionMorphTargetBind({ primitives: [body], index: 0, weight: 1 }));
  const aa = new VRMExpression('aa');
  aa.addBind(new VRMExpressionMorphTargetBind({ primitives: [body], index: 1, weight: 1 }));
  const happy = new VRMExpression('happy');
  happy.addBind(
    new VRMExpressionMaterialColorBind({ material: surface, type: 'color', targetValue: new Color(1, 0.5, 0.5) }),
  );
  happy.addBind(
    new VRMExpressionTextureTransformBind({ material: surface, scale: new Vector2(1, 1), offset: new Vector2(0.125, 0) }),
  );
  for (const expression of [blink, aa, happy]) {
    scene.add(expression);
    expressionManager.registerExpression(expression);
  }

  const collider = new VRMSpringBoneCollider(
    new VRMSpringBoneColliderShapeSphere({ radius: 0.08, offset: new Vector3(0, 0.05, 0) }),
  );
  collider.name = 'head_collider';
  head.add(collider);
  const colliderGroup = { name: 'head', colliders: [collider] };
  const springBoneManager = new VRMSpringBoneManager();
  for (let i = 0; i < springBones.length - 1; i++) {
    const joint = new VRMSpringBoneJoint(
      springBones[i],
      springBones[i + 1],
      { stiffness: 0.5, dragForce: 0.3, gravityPower: 1, hitRadius: 0.02 },
      [colliderGroup],
    );
    joint.center = rigRoot;
    springBoneManager.addJoint(joint);
  }
  scene.updateMatrixWorld(true);
  springBoneManager.setInitState();

  const vrm = new VRM({
    scene,
    meta: { metaVersion: '1', name: 'fixture', authors: ['tests'], licenseUrl: 'https://vrm.dev/licenses/1.0/' },
    humanoid,
    expressionManager,
    springBoneManager,
    materials: [surface, outline, plain],
  });

  return {
    vrm,
    rigRoot,
    body,
    prop,
    surface,
    outline,
    plain,
    palette,
    shade,
    paletteImage,
    shadeImage,
    springBones,
    collider,
  };
}
