'use client';

/**
 * The 3D street of Hồ Làng (game-stage REQ-STAGE-003, 004, 008): the street GLB, the ducks drawn
 * by instancing, the player character, a side-on camera, and the street music (drums and duck
 * quacks) on the game's audio clock.
 *
 * `StageGame` imports this module on demand, only on `/game`, only with WebGL2 and only once the
 * asset files have downloaded, so three.js never reaches the portfolio pages.
 *
 * The scene is plain three.js rather than a React renderer, so the code owns the render loop, the
 * disposal and the WebGL context: `createStreetStage` holds everything the scene draws and is
 * driven with a renderer it is given, which lets Jest run every frame of it with a fake renderer.
 * The `StreetScene` component only makes the canvas and the renderer, parses the files, and passes
 * its props on.
 */
import { useEffect, useRef } from 'react';
import {
  Color,
  DirectionalLight,
  Euler,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createScheduler, type GameAudio, type SchedulerTimer } from '../../audio';
import { playLickSound } from '../../audio/synth';
import { beatToTime, timeToBeat, type BeatClock } from '../../core/clock';
import { BEATS_PER_BAR } from '../../core/config';
import type { Character } from '../../core/roster';
import { ASSET_BASE_URL, type StageAssetFiles } from '../assets';
import { advanceGait, blendPoses, characterPose } from '../character/animation';
import { applyPose } from '../character/apply-pose';
import type { StageNote } from '../StageGame';
import { cameraX, createCameraBounds, type CameraBounds } from '../street/camera';
import { DUCK_BOB_DEPTH } from '../street/config';
import { isNearDoor } from '../street/door';
import { createStreetClock, duckBob, scheduleDuckQuacks } from '../street/ducks';
import { createWalkBounds, stepWalk, type WalkBounds, type WalkDirection } from '../street/movement';
import { clamp } from '../street/range';
import type { WebGL2ContextLike } from '../webgl';

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

/**
 * Highest device pixel ratio the stage draws at (spec "Giá trị khởi đầu", `MAX_DPR`): 1.5 on a
 * computer and 1.25 on a phone. A fixed cap in this slice, with no automatic quality levels.
 */
export const MAX_DPR = Object.freeze({ desktop: 1.5, phone: 1.25 });

/** A phone or tablet: the touch screen gets the lower pixel ratio cap. */
export const PHONE_POINTER_QUERY = '(pointer: coarse)';

/** The pixel ratio to draw at: the device's own, capped by `MAX_DPR`. */
export function stagePixelRatio(devicePixelRatio: number, isPhone: boolean): number {
  const cap = isPhone ? MAX_DPR.phone : MAX_DPR.desktop;
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, cap);
}

/** The player character's code id (design.md): it decides the playing pose, never used here. */
const PLAYER_CHARACTER: Character = 'sayo';

/**
 * The framing of the G2 reference still of the street, used when the street GLB has no extras on
 * `cam_min` (assets.md: vertical field of view in degrees, metres, pitch in degrees).
 */
export const REFERENCE_FRAMING: StreetFraming = Object.freeze({
  fovDeg: 30,
  distance: 20,
  height: 5,
  pitchDeg: -7,
});

/**
 * Design decision 8: the reference still shows the whole street, so the character is small. The
 * game camera sits this fraction of the reference distance and height away, on the same line of
 * sight. Tuned by eye at the demo (G6).
 */
export const STREET_CAMERA_CLOSER = 0.55;

/**
 * Room kept between the character and the side of the screen, in metres, when the character
 * walks to an end of the street while the camera is held at `cam_min` or `cam_max`. On a narrow
 * screen the camera backs away until this fits, so the character never walks out of the frame.
 */
export const STREET_EDGE_ROOM_M = 0.6;

/**
 * Seconds for the follow camera to close about two thirds of the gap to the character (smoothing,
 * design.md section 5). With reduced motion the camera follows rigidly instead.
 */
export const CAMERA_FOLLOW_TAU_S = 0.25;

/** Seconds for the character to turn about two thirds of the way to a new walking direction. */
const TURN_TAU_S = 0.06;

/** Seconds to ease between standing and walking, so the legs do not snap. */
const WALK_BLEND_S = 0.15;

/** The longest frame the stage steps, in seconds: a stall never jumps the character far. */
const MAX_FRAME_S = 0.1;

/** The street music starts this long after the Play press, so the first beat is not cut. */
export const STREET_MUSIC_LEAD_S = 0.1;

/**
 * How far ahead of the audio clock the music is queued each frame, in seconds. Longer than a
 * slow frame plus the scheduler's lookahead, so no quack or drum is missed between two frames.
 */
export const STREET_MUSIC_AHEAD_S = 0.3;

/** Night lighting of the street. Tuned by eye at the demo (G6). */
const SKY_LIGHT = { sky: 0xb8c4ff, ground: 0x2a2a3e, intensity: 1.2 } as const;
const KEY_LIGHT = { color: 0xffe0b0, intensity: 1.6, position: [-6, 10, 8] } as const;
/** `jazz-black`, behind anything the street GLB does not cover. */
const BACKGROUND = 0x0a0a0f;

/** Yaw of a character facing +X (walking right) and −X (walking left); 0 faces the camera. */
const FACE_RIGHT = Math.PI / 2;
const FACE_LEFT = -Math.PI / 2;

// ---------------------------------------------------------------------------------------------
// Layout: the logic nodes of the street GLB
// ---------------------------------------------------------------------------------------------

/** The camera framing extras of `cam_min` (assets.md, "Quy ước khi dùng"). */
export interface StreetFraming {
  readonly fovDeg: number;
  readonly distance: number;
  readonly height: number;
  readonly pitchDeg: number;
}

/** Where things are on the street, read from the empty nodes of the street GLB. */
export interface StreetLayout {
  readonly walk: WalkBounds;
  readonly camera: CameraBounds;
  readonly framing: StreetFraming;
  readonly spawnX: number;
  /** Yaw of the `spawn` node: the way the character faces at first. */
  readonly spawnYaw: number;
  readonly doorX: number;
  /** Height of the ground on the walk line, and the walk line's depth (Z). */
  readonly groundY: number;
  readonly pathZ: number;
  /** World transforms of `duck_path_0` to `duck_path_4`, where the ducks float. */
  readonly duckSpots: readonly Matrix4[];
}

/** Node names of the street contract (assets.md). */
export const STREET_NODES = Object.freeze({
  spawn: 'spawn',
  walkMin: 'walk_min',
  walkMax: 'walk_max',
  camMin: 'cam_min',
  camMax: 'cam_max',
  door: 'club_door',
  duckPath: ['duck_path_0', 'duck_path_1', 'duck_path_2', 'duck_path_3', 'duck_path_4'],
});

/** Prefix of the lamp meshes the street lights up after a win (AC-STAGE-005.4). */
export const LAMP_PREFIX = 'lamp_';

function requireNode(root: Object3D, name: string): Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`the street has no node "${name}"`);
  return node;
}

function worldPosition(node: Object3D): Vector3 {
  return node.getWorldPosition(new Vector3());
}

function readNumber(extras: Readonly<Record<string, unknown>>, key: string, fallback: number): number {
  const value = extras[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The framing extras of `node`, each missing or invalid value taken from the reference still. */
export function readFraming(node: Object3D): StreetFraming {
  const extras: Readonly<Record<string, unknown>> = node.userData;
  const fovDeg = readNumber(extras, 'fovDeg', REFERENCE_FRAMING.fovDeg);
  const distance = readNumber(extras, 'distance', REFERENCE_FRAMING.distance);
  return {
    fovDeg: fovDeg > 1 && fovDeg < 150 ? fovDeg : REFERENCE_FRAMING.fovDeg,
    distance: distance > 0 ? distance : REFERENCE_FRAMING.distance,
    height: readNumber(extras, 'height', REFERENCE_FRAMING.height),
    pitchDeg: readNumber(extras, 'pitchDeg', REFERENCE_FRAMING.pitchDeg),
  };
}

/**
 * Reads the layout of a parsed street GLB. Throws when a required node is missing or the bounds
 * are inverted: such a file breaks the asset contract, and the game falls back to the grey box.
 */
export function readStreetLayout(street: Object3D): StreetLayout {
  street.updateMatrixWorld(true);
  const spawn = requireNode(street, STREET_NODES.spawn);
  const walkMin = worldPosition(requireNode(street, STREET_NODES.walkMin));
  const walkMax = worldPosition(requireNode(street, STREET_NODES.walkMax));
  const camMinNode = requireNode(street, STREET_NODES.camMin);
  const camMax = worldPosition(requireNode(street, STREET_NODES.camMax));
  const door = worldPosition(requireNode(street, STREET_NODES.door));
  const duckSpots = STREET_NODES.duckPath.map((name) =>
    requireNode(street, name).matrixWorld.clone(),
  );

  const spawnPosition = worldPosition(spawn);
  const spawnYaw = new Euler().setFromQuaternion(
    spawn.getWorldQuaternion(new Quaternion()),
    'YXZ',
  ).y;

  return {
    walk: createWalkBounds(walkMin.x, walkMax.x),
    camera: createCameraBounds(worldPosition(camMinNode).x, camMax.x),
    framing: readFraming(camMinNode),
    spawnX: spawnPosition.x,
    spawnYaw,
    doorX: door.x,
    groundY: spawnPosition.y,
    pathZ: spawnPosition.z,
    duckSpots,
  };
}

// ---------------------------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------------------------

/**
 * The follow camera's X after `dt` seconds (AC-STAGE-003.4): it eases towards `cameraX` of the
 * character, and the eased value is clamped again, so it never passes `cam_min` or `cam_max`. With
 * reduced motion it sits exactly on `cameraX`, with no lag (design.md section 5).
 */
export function followCamera(
  current: number,
  characterX: number,
  dt: number,
  bounds: CameraBounds,
  reducedMotion: boolean,
): number {
  const target = cameraX(characterX, bounds);
  if (reducedMotion) return target;
  const start = Number.isFinite(current) ? current : target;
  const ease = dt > 0 ? 1 - Math.exp(-dt / CAMERA_FOLLOW_TAU_S) : 0;
  return clamp(start + (target - start) * ease, bounds.camMin, bounds.camMax);
}

/**
 * How far the camera stands from the walk line, in metres (design decision 8): the reference
 * distance times `STREET_CAMERA_CLOSER`, or further on a screen too narrow to keep the character in
 * frame at the ends of the street while the camera is held at its bounds.
 */
export function streetCameraDistance(layout: StreetLayout, aspect: number): number {
  const closer = layout.framing.distance * STREET_CAMERA_CLOSER;
  if (!(aspect > 0)) return closer;
  const overhang = Math.max(
    layout.camera.camMin - layout.walk.walkMin,
    layout.walk.walkMax - layout.camera.camMax,
    0,
  );
  const halfWidthPerMetre = Math.tan(MathUtils.degToRad(layout.framing.fovDeg) / 2) * aspect;
  return Math.max(closer, (overhang + STREET_EDGE_ROOM_M) / halfWidthPerMetre);
}

// ---------------------------------------------------------------------------------------------
// Music: drums and duck quacks on the audio clock
// ---------------------------------------------------------------------------------------------

export interface StreetMusic {
  /** The beat clock of the street music, at `STREET_BPM`; the duck bob reads it too. */
  readonly clock: BeatClock;
  /**
   * Queues the music up to `now + STREET_MUSIC_AHEAD_S` on the audio clock: the drums bar by bar,
   * and every duck quack in the window from where the last call stopped (AC-STAGE-004.1). Returns
   * the quack times this call queued.
   */
  pump(now: number): readonly number[];
  /** Stops starting queued quacks (hidden tab); the audio clock is paused with it. */
  pause(): void;
  resume(): void;
  /** Drops every queued sound and silences those started. The music cannot restart. */
  release(): void;
}

export interface StreetMusicOptions {
  /** Timer of the quack scheduler; the browser's `setInterval` by default. */
  readonly timer?: SchedulerTimer;
}

/**
 * The street music on `audio`: the drum groove on the game audio's own scheduler, and the ducks
 * on a lookahead scheduler of their own on the same context, each quack played as the duck lick
 * sound on the effects channel. Both follow one street clock, set a little after now.
 */
export function createStreetMusic(audio: GameAudio, options: StreetMusicOptions = {}): StreetMusic {
  const clock = createStreetClock(audio.currentTime + STREET_MUSIC_LEAD_S);
  const quacks = createScheduler(audio.context, { timer: options.timer });
  const playQuack = (at: number) => playLickSound(audio.context, audio.channels.sfx, 'duck', at);
  quacks.start();

  let cursor = clock.t0;
  let nextBar = 0;
  let released = false;

  return {
    clock,
    pump(now) {
      if (released) return [];
      const to = now + STREET_MUSIC_AHEAD_S;
      // After a stall, what fell behind `now` is skipped rather than played late.
      const from = Math.max(cursor, now);
      const queued = to > from ? scheduleDuckQuacks(quacks, clock, from, to, playQuack) : [];
      cursor = Math.max(cursor, to);

      const currentBar = Math.floor(timeToBeat(clock, now) / BEATS_PER_BAR);
      nextBar = Math.max(nextBar, currentBar);
      while (beatToTime(clock, nextBar * BEATS_PER_BAR) < to) {
        audio.scheduleDrumBars(clock, nextBar, 1);
        nextBar += 1;
      }
      return queued;
    },
    pause() {
      quacks.stop();
    },
    resume() {
      if (!released) quacks.start();
    },
    release() {
      if (released) return;
      released = true;
      quacks.stop();
      quacks.clear();
      audio.clearScheduled();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Models: parsing and disposal
// ---------------------------------------------------------------------------------------------

/** The parsed models the street draws. */
export interface StreetModels {
  /** The scene of the street GLB. */
  readonly street: Object3D;
  /** The scene of the duck GLB: one duck, drawn several times by instancing. */
  readonly duck: Object3D;
  /** The player character. */
  readonly player: VRM;
}

/** Where the character stands when the street opens: the `spawn` node, or at the club door. */
export type StreetStart = 'spawn' | 'door';

function isMesh(node: Object3D): node is Mesh {
  return (node as Partial<Mesh>).isMesh === true;
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Frees every geometry, material and texture under `root` (AC-STAGE-008.1). Each is disposed
 * once, however many meshes share it. Not for a VRM: use `VRMUtils.deepDispose`, which also frees
 * its skeletons.
 */
export function disposeObjectTree(root: Object3D): void {
  const geometries = new Set<{ dispose(): void }>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    if (!isMesh(node)) return;
    geometries.add(node.geometry);
    for (const material of materialsOf(node)) materials.add(material);
  });
  const textures = new Set<Texture>();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) textures.add(value);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

/** Frees parsed models that never reached a stage. */
export function disposeStreetModels(models: StreetModels): void {
  VRMUtils.deepDispose(models.player.scene);
  disposeObjectTree(models.street);
  disposeObjectTree(models.duck);
}

/**
 * Parses the downloaded street, duck and player files into three.js objects. Rejects when a file
 * is not a valid GLB or VRM, after freeing whatever did parse; the game then falls back to the
 * grey box with the missing-assets note (AC-STAGE-001.2).
 */
export async function parseStreetModels(
  files: Pick<StageAssetFiles, 'hoLangStreet' | 'duck' | 'playerVrm'>,
): Promise<StreetModels> {
  const gltfLoader = new GLTFLoader();
  const vrmLoader = new GLTFLoader();
  vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

  const [street, duck, avatar] = await Promise.allSettled([
    gltfLoader.parseAsync(files.hoLangStreet, ASSET_BASE_URL),
    gltfLoader.parseAsync(files.duck, ASSET_BASE_URL),
    vrmLoader.parseAsync(files.playerVrm, ASSET_BASE_URL),
  ]);
  const vrm: unknown = avatar.status === 'fulfilled' ? avatar.value.userData.vrm : null;
  if (street.status === 'fulfilled' && duck.status === 'fulfilled' && vrm instanceof VRM) {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // A posed skinned mesh can leave its rest bounds; never cull the character by them.
    vrm.scene.traverse((node) => {
      node.frustumCulled = false;
    });
    return { street: street.value.scene, duck: duck.value.scene, player: vrm };
  }

  if (street.status === 'fulfilled') disposeObjectTree(street.value.scene);
  if (duck.status === 'fulfilled') disposeObjectTree(duck.value.scene);
  if (avatar.status === 'fulfilled') VRMUtils.deepDispose(avatar.value.scene);
  const failed = [street, duck, avatar].find((result) => result.status === 'rejected');
  throw failed?.status === 'rejected' ? failed.reason : new Error('the player file is not a VRM');
}

// ---------------------------------------------------------------------------------------------
// Ducks and lamps
// ---------------------------------------------------------------------------------------------

interface DuckFlock {
  readonly meshes: readonly InstancedMesh[];
  /** Moves every duck `dy` metres up from where it floats (negative dips). */
  setOffset(dy: number): void;
  dispose(): void;
}

/** One instanced mesh per mesh of the duck model, with one instance on each duck path node. */
function buildDucks(duck: Object3D, spots: readonly Matrix4[]): DuckFlock {
  duck.updateMatrixWorld(true);
  const parts: { mesh: InstancedMesh; bases: Matrix4[] }[] = [];
  duck.traverse((node) => {
    if (!isMesh(node)) return;
    const mesh = new InstancedMesh(node.geometry, node.material, spots.length);
    mesh.name = `ducks:${node.name}`;
    // Five small instances; their bounds would go stale with every bob.
    mesh.frustumCulled = false;
    const bases = spots.map((spot) => spot.clone().multiply(node.matrixWorld));
    bases.forEach((base, index) => mesh.setMatrixAt(index, base));
    parts.push({ mesh, bases });
  });

  let offset = 0;
  const matrix = new Matrix4();
  return {
    meshes: parts.map((part) => part.mesh),
    setOffset(dy) {
      if (dy === offset) return;
      offset = dy;
      for (const { mesh, bases } of parts) {
        bases.forEach((base, index) => {
          matrix.copy(base);
          // Element 13 is the Y translation: the dip is straight down, in world space.
          matrix.elements[13] += dy;
          mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      for (const { mesh } of parts) mesh.dispose();
    },
  };
}

type GlowMaterial = Material & { emissiveIntensity: number };

function isGlowMaterial(material: Material): material is GlowMaterial {
  return typeof (material as Partial<GlowMaterial>).emissiveIntensity === 'number';
}

/** The glowing materials of the `lamp_*` meshes, with the intensity the file lights them at. */
function findLamps(street: Object3D): Map<GlowMaterial, number> {
  const lamps = new Map<GlowMaterial, number>();
  street.traverse((node) => {
    if (!node.name.startsWith(LAMP_PREFIX)) return;
    node.traverse((part) => {
      if (!isMesh(part)) return;
      for (const material of materialsOf(part)) {
        if (isGlowMaterial(material) && !lamps.has(material)) {
          lamps.set(material, material.emissiveIntensity);
        }
      }
    });
  });
  return lamps;
}

// ---------------------------------------------------------------------------------------------
// The stage: everything the street draws, frame by frame
// ---------------------------------------------------------------------------------------------

/** The parts of a WebGL context the stage releases. */
export interface StageContextLike extends WebGL2ContextLike {
  isContextLost(): boolean;
}

/** The parts of three's `WebGLRenderer` the stage uses; tests pass a fake. */
export interface StageRendererLike {
  setAnimationLoop(callback: ((time: number) => void) | null): void;
  render(scene: Object3D, camera: Camera): void;
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  dispose(): void;
  getContext(): StageContextLike;
}

export interface StreetStageOptions {
  readonly renderer: StageRendererLike;
  readonly models: StreetModels;
  /** Read once a frame: the direction the player holds. */
  readonly getDirection: () => WalkDirection;
  /** Called with the first door state, then whenever the character enters or leaves the door radius. */
  readonly onNearDoorChange: (near: boolean) => void;
  readonly startAt?: StreetStart;
  readonly reducedMotion?: boolean;
  readonly lightsOn?: boolean;
  /** Start with the render loop stopped (hidden tab). */
  readonly paused?: boolean;
  /** Timer of the duck scheduler; tests pass a manual one. */
  readonly schedulerTimer?: SchedulerTimer;
}

export interface StreetStage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly layout: StreetLayout;
  /** The character's X on the street and its speed over the last frame, in m/s. */
  readonly playerX: number;
  readonly playerVelocity: number;
  /** Steps the character has taken (`advanceGait`): it grows at |v| / `WALK_STRIDE` a second. */
  readonly gait: number;
  /** The duck instances, for inspection. */
  readonly ducks: readonly InstancedMesh[];
  /** The street music, while audio is set. */
  readonly music: StreetMusic | null;
  /** Whether the render loop runs. */
  readonly running: boolean;
  /** Steps everything by `dt` seconds and draws one frame. The render loop calls it. */
  frame(dt: number): void;
  /** Starts the street music on `audio`, or stops it with null. */
  setAudio(audio: GameAudio | null): void;
  /** Stops or restarts the render loop and the duck scheduler (AC-STAGE-008.2). */
  setPaused(paused: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  /** Lights or darkens the `lamp_*` meshes (AC-STAGE-005.4). */
  setLightsOn(on: boolean): void;
  /** Fits the drawing to a size in CSS pixels at a pixel ratio. */
  resize(width: number, height: number, pixelRatio: number): void;
  /**
   * Stops the render loop and the music, frees every geometry, material and texture, the VRM and
   * the renderer, and gives the WebGL context back through `WEBGL_lose_context` (AC-STAGE-008.1).
   * Safe to call twice.
   */
  release(): void;
}

/** `angle` moved towards `target` by the shortest way, easing with time constant `tau`. */
function dampAngle(angle: number, target: number, dt: number, tau: number): number {
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + delta * (1 - Math.exp(-dt / tau));
}

/** Frees the renderer and gives its WebGL context back, unless it is already lost. */
export function releaseRenderer(renderer: StageRendererLike): void {
  renderer.setAnimationLoop(null);
  renderer.dispose();
  const context = renderer.getContext();
  if (!context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext();
}

/**
 * Builds the street from parsed models and starts drawing it. Throws when the street breaks the
 * asset contract (see `readStreetLayout`); the models are then the caller's to free.
 */
export function createStreetStage(options: StreetStageOptions): StreetStage {
  const { renderer, models, getDirection, onNearDoorChange, schedulerTimer } = options;
  const layout = readStreetLayout(models.street);
  let reducedMotion = options.reducedMotion ?? false;

  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  scene.add(models.street);
  const sky = new HemisphereLight(SKY_LIGHT.sky, SKY_LIGHT.ground, SKY_LIGHT.intensity);
  const key = new DirectionalLight(KEY_LIGHT.color, KEY_LIGHT.intensity);
  key.position.set(...KEY_LIGHT.position);
  scene.add(sky, key);

  const ducks = buildDucks(models.duck, layout.duckSpots);
  scene.add(...ducks.meshes);

  const lamps = findLamps(models.street);
  function setLightsOn(on: boolean) {
    for (const [material, lit] of lamps) material.emissiveIntensity = on ? lit : 0;
  }
  setLightsOn(options.lightsOn ?? false);

  const { player } = models;
  scene.add(player.scene);
  const startAtDoor = options.startAt === 'door';
  let x = clamp(startAtDoor ? layout.doorX : layout.spawnX, layout.walk.walkMin, layout.walk.walkMax);
  let velocity = 0;
  // Out of the club door the character faces the street (the camera); at spawn, the node's way.
  let yaw = startAtDoor ? 0 : layout.spawnYaw;
  let targetYaw = yaw;
  let gait = 0;
  let walkWeight = 0;
  let elapsed = 0;

  const camera = new PerspectiveCamera(layout.framing.fovDeg, 16 / 9, 0.1, 400);
  camera.rotation.set(MathUtils.degToRad(layout.framing.pitchDeg), 0, 0);
  let camX = cameraX(x, layout.camera);
  function placeCamera() {
    const distance = streetCameraDistance(layout, camera.aspect);
    const height = layout.framing.height * (distance / layout.framing.distance);
    camera.position.set(camX, layout.groundY + height, layout.pathZ + distance);
  }
  placeCamera();

  let near = isNearDoor(x, layout.doorX);
  onNearDoorChange(near);

  let audio: GameAudio | null = null;
  let music: StreetMusic | null = null;
  let paused = options.paused ?? false;
  let running = false;
  let lastTime: number | null = null;
  let released = false;

  function poseCharacter(dt: number) {
    elapsed += dt;
    gait = advanceGait(gait, velocity, dt);
    const walking = velocity !== 0;
    walkWeight = clamp(walkWeight + (walking ? dt : -dt) / WALK_BLEND_S, 0, 1);
    const base = { character: PLAYER_CHARACTER, time: elapsed, seed: 0, reducedMotion };
    const idle = characterPose({ ...base, action: 'idle' });
    const pose =
      walkWeight > 0
        ? blendPoses(idle, characterPose({ ...base, action: 'walk', gait }), walkWeight)
        : idle;
    applyPose(player, pose);

    if (walking) targetYaw = velocity > 0 ? FACE_RIGHT : FACE_LEFT;
    yaw = dt > 0 ? dampAngle(yaw, targetYaw, dt, TURN_TAU_S) : yaw;
    player.scene.position.set(x, layout.groundY, layout.pathZ);
    player.scene.rotation.set(0, yaw, 0);
    player.update(dt);
  }

  function frame(dt: number) {
    if (released) return;
    const step = stepWalk(x, getDirection(), Math.max(0, dt), layout.walk);
    x = step.x;
    velocity = step.velocity;
    poseCharacter(Math.max(0, dt));

    const nowNear = isNearDoor(x, layout.doorX);
    if (nowNear !== near) {
      near = nowNear;
      onNearDoorChange(near);
    }

    camX = followCamera(camX, x, dt, layout.camera, reducedMotion);
    placeCamera();

    let dip = 0;
    if (audio !== null && music !== null) {
      const now = audio.currentTime;
      music.pump(now);
      // Reduced motion: the bob is still computed, but the scene gets an amplitude of 0.
      dip = reducedMotion ? 0 : duckBob(music.clock, now) * DUCK_BOB_DEPTH;
    }
    ducks.setOffset(-dip);

    renderer.render(scene, camera);
  }

  function loop(time: number) {
    const dt = lastTime === null ? 0 : Math.min(MAX_FRAME_S, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    frame(dt);
  }

  function setRunning(run: boolean) {
    if (run === running) return;
    running = run;
    lastTime = null;
    renderer.setAnimationLoop(run ? loop : null);
    if (run) music?.resume();
    else music?.pause();
  }

  setRunning(!paused);

  return {
    scene,
    camera,
    layout,
    get playerX() {
      return x;
    },
    get playerVelocity() {
      return velocity;
    },
    get gait() {
      return gait;
    },
    ducks: ducks.meshes,
    get music() {
      return music;
    },
    get running() {
      return running;
    },
    frame,
    setAudio(next) {
      if (released || next === audio) return;
      music?.release();
      audio = next;
      music = next === null ? null : createStreetMusic(next, { timer: schedulerTimer });
      if (music !== null && !running) music.pause();
    },
    setPaused(next) {
      if (released) return;
      paused = next;
      setRunning(!paused);
    },
    setReducedMotion(next) {
      reducedMotion = next;
    },
    setLightsOn(on) {
      if (!released) setLightsOn(on);
    },
    resize(width, height, pixelRatio) {
      if (released || !(width > 0) || !(height > 0)) return;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      placeCamera();
      if (!running) renderer.render(scene, camera);
    },
    release() {
      if (released) return;
      released = true;
      renderer.setAnimationLoop(null);
      running = false;
      music?.release();
      music = null;
      audio = null;
      scene.clear();
      // The street has no Shadow; the club scene frees its Shadow before the player it clones.
      VRMUtils.deepDispose(player.scene);
      ducks.dispose();
      disposeObjectTree(models.duck);
      disposeObjectTree(models.street);
      releaseRenderer(renderer);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The React component
// ---------------------------------------------------------------------------------------------

export interface StreetSceneProps {
  /** The downloaded asset files; the scene parses the street, the duck and the player model. */
  readonly files: StageAssetFiles;
  /** The game audio once the Play gate unlocked it, null before: the street music runs while set. */
  readonly audio: GameAudio | null;
  /** Read once a frame: the walk direction the player holds. */
  readonly getDirection: () => WalkDirection;
  /** Hidden tab or portrait phone: the render loop and the duck scheduler stop (AC-STAGE-008.2). */
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** The street lamps are lit (AC-STAGE-005.4). Off by default. */
  readonly lightsOn?: boolean;
  /** Where the character stands when the street opens; read once, when the scene is built. */
  readonly startAt?: StreetStart;
  /** Accessible name of the scene, which is an image to assistive technology. */
  readonly label: string;
  /** The street is parsed and drawn: the loading panel can go. */
  readonly onReady: () => void;
  /**
   * The stage cannot run: a file did not parse (`missing`), or WebGL failed to start or was lost
   * (`noWebgl`, design decision 3). The game falls back to the grey-box duel with that note.
   */
  readonly onFallback: (note: StageNote) => void;
  /** Called with the first door state, then whenever the character enters or leaves the door radius. */
  readonly onNearDoorChange: (near: boolean) => void;
}

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_POINTER_QUERY).matches;
}

/**
 * The street canvas, filling its container. It parses the files and builds the stage once; every
 * other prop is passed on to the running stage. Unmounting releases the stage, the renderer and
 * the WebGL context (AC-STAGE-008.1). A fresh canvas is made each time, so a remount never meets
 * a context that was already given back.
 */
export default function StreetScene(props: StreetSceneProps) {
  const { files, audio, paused, reducedMotion, lightsOn = false, label } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<StreetStage | null>(null);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full';
    host.appendChild(canvas);

    let cancelled = false;
    let stage: StreetStage | null = null;
    let observer: ResizeObserver | null = null;
    const fallBack = (note: StageNote) => {
      if (!cancelled) latest.current.onFallback(note);
    };
    // A loss the page did not ask for (design decision 3). Removed before the stage gives the
    // context back on unmount, so that loss is not mistaken for one.
    const onContextLost = () => fallBack('noWebgl');
    canvas.addEventListener('webglcontextlost', onContextLost);

    let renderer: WebGLRenderer | null = null;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      fallBack('noWebgl');
    }

    const resize = () => {
      stage?.resize(
        host.clientWidth,
        host.clientHeight,
        stagePixelRatio(window.devicePixelRatio, isPhone()),
      );
    };

    if (renderer !== null) {
      const ownRenderer = renderer;
      parseStreetModels(files).then(
        (models) => {
          if (cancelled) {
            disposeStreetModels(models);
            return;
          }
          const current = latest.current;
          try {
            stage = createStreetStage({
              renderer: ownRenderer,
              models,
              getDirection: () => latest.current.getDirection(),
              onNearDoorChange: (near) => latest.current.onNearDoorChange(near),
              startAt: current.startAt,
              reducedMotion: current.reducedMotion,
              lightsOn: current.lightsOn,
              paused: current.paused,
            });
          } catch {
            disposeStreetModels(models);
            fallBack('missing');
            return;
          }
          stageRef.current = stage;
          stage.setAudio(current.audio);
          resize();
          observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
          observer?.observe(host);
          current.onReady();
        },
        () => fallBack('missing'),
      );
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      stageRef.current = null;
      if (stage !== null) stage.release();
      else if (renderer !== null) releaseRenderer(renderer);
      canvas.remove();
    };
  }, [files]);

  useEffect(() => {
    stageRef.current?.setAudio(audio);
  }, [audio]);

  useEffect(() => {
    stageRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    stageRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    stageRef.current?.setLightsOn(lightsOn);
  }, [lightsOn]);

  return <div ref={hostRef} role="img" aria-label={label} className="absolute inset-0" />;
}
