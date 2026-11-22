'use client';

/**
 * The 3D club of Hồ Làng (game-stage REQ-STAGE-005, 006): the club GLB, the player character at
 * `player_mark`, the Shadow at `rival_mark`, the drummer as a flat backlit sprite at
 * `drummer_mark`, and the camera at `cam_duel`. It is the backdrop `DuelGame` draws its screens
 * over (design.md section 4).
 *
 * `StageGame` imports this module on demand, with the street, so three.js never reaches the
 * portfolio pages.
 *
 * Like the street, the scene is plain three.js: `createClubStage` holds everything the club draws
 * and is driven with a renderer it is given, so Jest runs every frame of it with a fake renderer.
 * The `ClubScene` component makes the canvas and the renderer, parses the files and passes its
 * props on. The poses follow the duel in `stores/gameStore.ts`, read once a frame.
 */
import { useEffect, useRef } from 'react';
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MToonMaterial, VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { GameAudio } from '../../audio';
import { timeToBeat, type BeatClock } from '../../core/clock';
import type { Character } from '../../core/roster';
import type { SessionPhase } from '../../core/session';
import { useGameStore } from '@/stores/gameStore';
import { useStageLayout } from '../../ui/screens/ui';
import { ASSET_BASE_URL, type StageAssetFiles } from '../assets';
import { characterPose, type CharacterAction } from '../character/animation';
import { applyPose } from '../character/apply-pose';
import { duelRoles } from '../character/roles';
import {
  createShadow,
  decodeShadowPalette,
  disposeShadow,
  type DecodeImage,
} from '../character/shadow';
import type { StageNote } from '../StageGame';
import { clamp } from '../street/range';
import {
  disposeObjectTree,
  PHONE_POINTER_QUERY,
  releaseRenderer,
  stagePixelRatio,
  type StageRendererLike,
} from './StreetScene';

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

/** Seconds the Shadow takes to fade away after a win (spec "Giá trị khởi đầu", AC-STAGE-005.3). */
export const SHADOW_FADE_S = 1.5;

/**
 * The player character's code id. The Shadow reuses the player's model in this slice, so both
 * take the player's playing pose (singing), never the opponent's instrument.
 */
const PLAYER_CHARACTER: Character = 'sayo';

/** Seeds of the idle motion, so the two characters do not breathe or blink in step. */
const PLAYER_SEED = 0;
const SHADOW_SEED = 1;

/** Vertical field of view of `cam_duel` when its `fovDeg` extra is missing or invalid. */
export const DEFAULT_DUEL_FOV_DEG = 35;

/** The drummer sprite when `drummer_mark` has no `frames` or `spriteHeight` extra. */
export const DEFAULT_DRUMMER = Object.freeze({ frames: 1, spriteHeight: 1.5 });

/** Drum frames shown per beat while the band plays: one frame each eighth note. */
export const DRUMMER_FRAMES_PER_BEAT = 2;

/**
 * Where the characters must stand on screen: the part the DOM of the duel leaves uncovered
 * (design.md section 4, "Vùng an toàn cho cảnh"), as fractions of the canvas from its left and top
 * edges. On a computer, between the HUD and the lane board, left of the lick book; on a phone held
 * sideways, between the top bar and the lanes, across the whole width. Tuned by eye at the demo
 * (G6).
 */
export const CLUB_SAFE_AREA = Object.freeze({
  desktop: Object.freeze({ left: 0, right: 0.82, top: 0.12, bottom: 0.52 }),
  phone: Object.freeze({ left: 0, right: 1, top: 0.12, bottom: 0.46 }),
});

/** A phone held sideways, as `COMPACT_QUERY` of the duel: landscape and at most this tall. */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;

/** Room kept free inside the safe area on each side, as a fraction of its width and height. */
export const FRAME_MARGIN = 0.06;

/**
 * Headroom over the model's rest height: the playing and listening poses raise the arms and nod
 * the head, which the rest pose does not show.
 */
const SUBJECT_HEADROOM = 1.12;

/** The extent of a character whose model has no measurable meshes, in metres. */
const FALLBACK_EXTENT = Object.freeze({ height: 1.7, radius: 0.35 });

/** The smallest horizontal radius kept around a character's centre line, in metres. */
const MIN_RADIUS_M = 0.2;

/** Near plane of the club camera, in metres. */
const CAMERA_NEAR = 0.05;

/** The farthest the camera backs off from `cam_duel` to fit both characters, in metres. */
const MAX_DOLLY_M = 200;

/** The longest frame the stage steps, in seconds. */
const MAX_FRAME_S = 0.1;

/** Lighting of the club: a dim room and a warm light on the stage. Tuned by eye at G6. */
const ROOM_LIGHT = { sky: 0x8a7cc0, ground: 0x1a1426, intensity: 0.9 } as const;
const STAGE_LIGHT = { color: 0xffd9a0, intensity: 1.8, position: [2, 6, 8] } as const;
/** `jazz-black`, behind anything the club GLB does not cover. */
const BACKGROUND = 0x0a0a0f;

// ---------------------------------------------------------------------------------------------
// Layout: the logic nodes of the club GLB
// ---------------------------------------------------------------------------------------------

/** Node names of the club contract (assets.md). */
export const CLUB_NODES = Object.freeze({
  player: 'player_mark',
  rival: 'rival_mark',
  drummer: 'drummer_mark',
  camera: 'cam_duel',
});

/** A world position and orientation read from a node. */
export interface ClubMark {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

/** The camera node: it looks along its −Z with +Y up (assets.md). */
export interface ClubView extends ClubMark {
  readonly fovDeg: number;
}

export interface DrummerMark extends ClubMark {
  /** Equal frames side by side in the sprite sheet. */
  readonly frames: number;
  /** Height of the sprite in the scene, in metres; its bottom middle sits on the node. */
  readonly spriteHeight: number;
}

/** Where things are in the club, read from the empty nodes of the club GLB. */
export interface ClubLayout {
  /** Where the player character stands; it faces the node's +Z. */
  readonly player: ClubMark;
  /** Where the Shadow stands; it faces the node's +Z. */
  readonly rival: ClubMark;
  readonly drummer: DrummerMark;
  readonly camera: ClubView;
}

function requireNode(root: Object3D, name: string): Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error(`the club has no node "${name}"`);
  return node;
}

function readMark(node: Object3D): ClubMark {
  return {
    position: node.getWorldPosition(new Vector3()),
    quaternion: node.getWorldQuaternion(new Quaternion()),
  };
}

function readNumber(node: Object3D, key: string): number | null {
  const extras: Readonly<Record<string, unknown>> = node.userData;
  const value = extras[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Reads the layout of a parsed club GLB. Throws when a required node is missing: such a file
 * breaks the asset contract, and the club falls back to the duel without a scene. An invalid
 * extra falls back to its default.
 */
export function readClubLayout(club: Object3D): ClubLayout {
  club.updateMatrixWorld(true);
  const player = requireNode(club, CLUB_NODES.player);
  const rival = requireNode(club, CLUB_NODES.rival);
  const drummer = requireNode(club, CLUB_NODES.drummer);
  const camera = requireNode(club, CLUB_NODES.camera);

  const fovDeg = readNumber(camera, 'fovDeg');
  const frames = readNumber(drummer, 'frames');
  const spriteHeight = readNumber(drummer, 'spriteHeight');
  return {
    player: readMark(player),
    rival: readMark(rival),
    drummer: {
      ...readMark(drummer),
      frames: frames !== null && frames >= 1 ? Math.floor(frames) : DEFAULT_DRUMMER.frames,
      spriteHeight:
        spriteHeight !== null && spriteHeight > 0 ? spriteHeight : DEFAULT_DRUMMER.spriteHeight,
    },
    camera: {
      ...readMark(camera),
      fovDeg: fovDeg !== null && fovDeg > 1 && fovDeg < 150 ? fovDeg : DEFAULT_DUEL_FOV_DEG,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Camera: both characters inside the part of the screen the DOM leaves uncovered
// ---------------------------------------------------------------------------------------------

/** A rectangle of the canvas, as fractions from its left and top edges. */
export interface SafeArea {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * The safe area of a canvas `width` by `height` CSS pixels before the duel board has been measured
 * (the setup panels come first): the phone one when held sideways.
 */
export function clubSafeArea(width: number, height: number): SafeArea {
  const phoneLandscape = width > height && height <= PHONE_LANDSCAPE_MAX_HEIGHT;
  return phoneLandscape ? CLUB_SAFE_AREA.phone : CLUB_SAFE_AREA.desktop;
}

/** The parts of a `DOMRect` a window is measured with. */
export interface RectLike {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

/** The smallest window, as a fraction of the canvas, the camera frames into. */
const MIN_WINDOW_FRACTION = 0.02;

/**
 * Where the scene window of the duel board (the free band between the HUD and the lanes) lies on
 * the canvas, as fractions of it; null when either has no size or the window is off the canvas.
 */
export function windowArea(sceneWindow: RectLike, canvas: RectLike): SafeArea | null {
  if (!(canvas.width > 0) || !(canvas.height > 0)) return null;
  const left = clamp((sceneWindow.left - canvas.left) / canvas.width, 0, 1);
  const right = clamp((sceneWindow.right - canvas.left) / canvas.width, 0, 1);
  const top = clamp((sceneWindow.top - canvas.top) / canvas.height, 0, 1);
  const bottom = clamp((sceneWindow.bottom - canvas.top) / canvas.height, 0, 1);
  if (right - left < MIN_WINDOW_FRACTION || bottom - top < MIN_WINDOW_FRACTION) return null;
  return { left, right, top, bottom };
}

/** How tall a character is and how far it reaches from its centre line, in metres. */
export interface CharacterExtent {
  readonly height: number;
  readonly radius: number;
}

/** The extent of a model standing at the origin in its rest pose. */
export function characterExtent(model: Object3D): CharacterExtent {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  if (box.isEmpty() || !(box.max.y > 0.1)) return FALLBACK_EXTENT;
  const radius = Math.max(
    Math.abs(box.min.x),
    Math.abs(box.max.x),
    Math.abs(box.min.z),
    Math.abs(box.max.z),
    MIN_RADIUS_M,
  );
  return { height: box.max.y, radius };
}

/**
 * The points a character standing at `mark` must keep on screen: the corners of a box around it,
 * from the floor to above its head.
 */
export function subjectPoints(mark: ClubMark, extent: CharacterExtent): Vector3[] {
  const top = extent.height * SUBJECT_HEADROOM;
  const points: Vector3[] = [];
  for (const dx of [-extent.radius, extent.radius]) {
    for (const dz of [-extent.radius, extent.radius]) {
      for (const dy of [0, top]) points.push(mark.position.clone().add(new Vector3(dx, dy, dz)));
    }
  }
  return points;
}

/**
 * How the camera frames the subject: `dolly` metres back from `cam_duel` along its line of sight,
 * then the picture shifted by `shiftX` and `shiftY` (in normalized device units, +Y up) without
 * turning the camera, like a lens shift.
 */
export interface ClubFraming {
  readonly dolly: number;
  readonly shiftX: number;
  readonly shiftY: number;
}

interface Spread {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}

/**
 * The framing that puts every point of the subject inside `area` of a canvas of `aspect` (width
 * over height), seen from `view` (design decision 7). The camera keeps the orientation and the
 * field of view of `cam_duel`; it backs off along its line of sight only as far as needed for the
 * subject to fit the area (never closer than `cam_duel`), then the picture is shifted to centre
 * the subject in the area.
 */
export function frameSubject(
  points: readonly Vector3[],
  view: ClubView,
  aspect: number,
  area: SafeArea,
): ClubFraming {
  const toCamera = view.quaternion.clone().invert();
  const local = points.map((point) => point.clone().sub(view.position).applyQuaternion(toCamera));
  const tan = Math.tan(MathUtils.degToRad(view.fovDeg) / 2);
  const ratio = aspect > 0 ? aspect : 16 / 9;

  // The area in normalized device units (−1 to 1, +Y up), less the margin.
  const marginU = (area.right - area.left) * FRAME_MARGIN * 2;
  const marginV = (area.bottom - area.top) * FRAME_MARGIN * 2;
  const left = 2 * area.left - 1 + marginU;
  const right = 2 * area.right - 1 - marginU;
  const top = 1 - 2 * area.top - marginV;
  const bottom = 1 - 2 * area.bottom + marginV;

  // A point's depth is −z in camera space; backing off by `s` adds `s` to every depth.
  const nearest = Math.min(...local.map((point) => -point.z));
  const minDolly = Math.max(0, CAMERA_NEAR * 2 - nearest);

  function spread(dolly: number): Spread {
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const point of local) {
      const depth = -point.z + dolly;
      const u = point.x / (depth * tan * ratio);
      const v = point.y / (depth * tan);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    return { minU, maxU, minV, maxV };
  }

  function fits(dolly: number): boolean {
    const { minU, maxU, minV, maxV } = spread(dolly);
    return maxU - minU <= right - left && maxV - minV <= top - bottom;
  }

  let dolly = minDolly;
  if (!fits(dolly)) {
    let low = dolly;
    let high = Math.max(1, dolly * 2);
    while (!fits(high) && high < MAX_DOLLY_M) high = Math.min(MAX_DOLLY_M, high * 2);
    for (let i = 0; i < 40; i++) {
      const middle = (low + high) / 2;
      if (fits(middle)) high = middle;
      else low = middle;
    }
    dolly = high;
  }

  const { minU, maxU, minV, maxV } = spread(dolly);
  return {
    dolly,
    shiftX: (left + right) / 2 - (minU + maxU) / 2,
    shiftY: (top + bottom) / 2 - (minV + maxV) / 2,
  };
}

/** Puts `camera` at `view`, backed off and shifted by `framing`, for a canvas `width` by `height`. */
export function applyFraming(
  camera: PerspectiveCamera,
  view: ClubView,
  framing: ClubFraming,
  width: number,
  height: number,
): void {
  camera.fov = view.fovDeg;
  camera.quaternion.copy(view.quaternion);
  const back = new Vector3(0, 0, 1).applyQuaternion(view.quaternion).multiplyScalar(framing.dolly);
  camera.position.copy(view.position).add(back);
  // The whole picture moves by the shift: right by shiftX, up by shiftY (half a canvas per unit).
  camera.setViewOffset(
    width,
    height,
    (-framing.shiftX * width) / 2,
    (framing.shiftY * height) / 2,
    width,
    height,
  );
  camera.updateMatrixWorld(true);
}

// ---------------------------------------------------------------------------------------------
// Pure helpers of the frame
// ---------------------------------------------------------------------------------------------

/**
 * Opacity of the Shadow `elapsed` seconds into its fade after a win (AC-STAGE-005.3): from 1 down
 * to 0 over `SHADOW_FADE_S`, then 0. Reduced motion keeps the same fade (design decision 2): it
 * only changes how see-through the Shadow is, it never moves.
 */
export function shadowFadeOpacity(elapsed: number): number {
  if (!(elapsed > 0)) return 1;
  return clamp(1 - elapsed / SHADOW_FADE_S, 0, 1);
}

/**
 * The frame of the drummer sprite sheet at `beat`: one frame each eighth note while the band
 * plays, frame 0 when it does not (null beat) or with reduced motion.
 */
export function drummerFrame(beat: number | null, frames: number, reducedMotion: boolean): number {
  if (beat === null || reducedMotion || frames <= 1 || !Number.isFinite(beat)) return 0;
  const step = Math.floor(beat * DRUMMER_FRAMES_PER_BEAT);
  return ((step % frames) + frames) % frames;
}

// ---------------------------------------------------------------------------------------------
// Models: parsing and disposal
// ---------------------------------------------------------------------------------------------

/** The parsed models the club draws. */
export interface ClubModels {
  /** The scene of the club GLB. */
  readonly club: Object3D;
  /** The player character, parsed from the downloaded file (the street frees its own copy). */
  readonly player: VRM;
  /** The Shadow palette; the Shadow owns it once the stage has made the Shadow. */
  readonly shadowPalette: Texture;
  /** The drummer's sprite sheet: equal frames side by side. */
  readonly drummer: Texture;
}

/** Decodes like the Shadow palette: straight alpha, no colour conversion. */
const decodeSpriteImage: DecodeImage = (blob) =>
  createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });

/**
 * The drummer's sprite sheet from the downloaded PNG. Not flipped on upload (an image bitmap
 * cannot be); the stage flips it in its UV transform instead.
 */
export async function decodeSpriteSheet(
  bytes: ArrayBuffer,
  decode: DecodeImage = decodeSpriteImage,
): Promise<Texture> {
  const image = await decode(new Blob([bytes], { type: 'image/png' }));
  const texture = new Texture(image);
  texture.name = 'drummer';
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Frees parsed models that never reached a stage. */
export function disposeClubModels(models: ClubModels): void {
  VRMUtils.deepDispose(models.player.scene);
  disposeObjectTree(models.club);
  models.shadowPalette.dispose();
  models.drummer.dispose();
}

/**
 * Parses the downloaded club, player, Shadow palette and drummer files. Rejects when a file does
 * not parse, after freeing whatever did; the club then shows the duel with the missing-assets
 * note.
 */
export async function parseClubModels(
  files: Pick<StageAssetFiles, 'hoLangClub' | 'playerVrm' | 'playerShadowPalette' | 'drummer'>,
): Promise<ClubModels> {
  const gltfLoader = new GLTFLoader();
  const vrmLoader = new GLTFLoader();
  vrmLoader.register((parser) => new VRMLoaderPlugin(parser));

  const [club, avatar, palette, drummer] = await Promise.allSettled([
    gltfLoader.parseAsync(files.hoLangClub, ASSET_BASE_URL),
    vrmLoader.parseAsync(files.playerVrm, ASSET_BASE_URL),
    decodeShadowPalette(files.playerShadowPalette),
    decodeSpriteSheet(files.drummer),
  ]);
  const vrm: unknown = avatar.status === 'fulfilled' ? avatar.value.userData.vrm : null;
  if (
    club.status === 'fulfilled' &&
    vrm instanceof VRM &&
    palette.status === 'fulfilled' &&
    drummer.status === 'fulfilled'
  ) {
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.combineSkeletons(vrm.scene);
    // A posed skinned mesh can leave its rest bounds; never cull the character by them.
    vrm.scene.traverse((node) => {
      node.frustumCulled = false;
    });
    return {
      club: club.value.scene,
      player: vrm,
      shadowPalette: palette.value,
      drummer: drummer.value,
    };
  }

  if (club.status === 'fulfilled') disposeObjectTree(club.value.scene);
  if (avatar.status === 'fulfilled') VRMUtils.deepDispose(avatar.value.scene);
  if (palette.status === 'fulfilled') palette.value.dispose();
  if (drummer.status === 'fulfilled') drummer.value.dispose();
  const failed = [club, avatar, palette, drummer].find((result) => result.status === 'rejected');
  throw failed?.status === 'rejected' ? failed.reason : new Error('the player file is not a VRM');
}

// ---------------------------------------------------------------------------------------------
// The stage: everything the club draws, frame by frame
// ---------------------------------------------------------------------------------------------

/** What the club reads of the duel each frame. */
export interface DuelView {
  readonly phase: SessionPhase | null;
  /** The beat clock of the take, null before it starts. */
  readonly clock: BeatClock | null;
}

/** The duel as `stores/gameStore.ts` holds it now. */
export function duelFromStore(): DuelView {
  const state = useGameStore.getState();
  return { phase: state.phase, clock: state.session?.clock ?? null };
}

export interface ClubStageOptions {
  readonly renderer: StageRendererLike;
  readonly models: ClubModels;
  /** Read once a frame: the phase and the beat clock of the duel. */
  readonly getDuel: () => DuelView;
  readonly reducedMotion?: boolean;
  /** Start with the render loop stopped (hidden tab). */
  readonly paused?: boolean;
  /** The take was won: the Shadow fades away (AC-STAGE-005.3). */
  readonly shadowFaded?: boolean;
}

export interface ClubStage {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly layout: ClubLayout;
  readonly player: VRM;
  /** The Shadow, made from the player model on entering the club (AC-STAGE-006.1). */
  readonly shadow: VRM;
  readonly drummer: Sprite;
  /** The points the camera keeps in the safe area: both characters, floor to head. */
  readonly subject: readonly Vector3[];
  /** How see-through the Shadow is now: 1 solid, 0 gone. */
  readonly shadowOpacity: number;
  /** The frame of the drummer sheet shown now. */
  readonly drummerFrame: number;
  /** What each character did in the last frame. */
  readonly actions: { readonly player: CharacterAction; readonly shadow: CharacterAction };
  /** Whether the render loop runs. */
  readonly running: boolean;
  /** Steps everything by `dt` seconds and draws one frame. The render loop calls it. */
  frame(dt: number): void;
  /** The audio whose clock the characters bounce to, or null. */
  setAudio(audio: GameAudio | null): void;
  /** Stops or restarts the render loop (AC-STAGE-008.2). */
  setPaused(paused: boolean): void;
  setReducedMotion(reducedMotion: boolean): void;
  /** Starts the Shadow's fade after a win, or brings it back solid for the next take. */
  setShadowFaded(faded: boolean): void;
  /**
   * Frames both characters inside `area` of the canvas: the window the duel board leaves for the
   * scene, as measured (see `windowArea`). Before the first one, the design table is used.
   */
  setSafeArea(area: SafeArea): void;
  /** Fits the drawing and the framing to a size in CSS pixels at a pixel ratio. */
  resize(width: number, height: number, pixelRatio: number): void;
  /**
   * Stops the render loop and frees the Shadow (first: it shares the player's geometry), the
   * player, the club, the drummer and the renderer, giving the WebGL context back (AC-STAGE-008.1).
   * Safe to call twice.
   */
  release(): void;
}

/** The canvas size the camera is framed for until the first `resize`. */
const INITIAL_SIZE = Object.freeze({ width: 1280, height: 720 });

function materialsOf(model: Object3D): Material[] {
  const found = new Set<Material>();
  model.traverse((node) => {
    const { material } = node as Partial<{ material: Material | Material[] }>;
    if (material === undefined) return;
    for (const each of Array.isArray(material) ? material : [material]) found.add(each);
  });
  return [...found];
}

function imageSize(image: unknown): { width: number; height: number } | null {
  if (typeof image !== 'object' || image === null) return null;
  const { width, height } = image as Partial<Record<'width' | 'height', unknown>>;
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0
    ? { width, height }
    : null;
}

/**
 * Builds the club from parsed models, makes the Shadow and starts drawing. Throws, before making
 * the Shadow, when the club breaks the asset contract (see `readClubLayout`); the models are then
 * the caller's to free with `disposeClubModels`.
 */
export function createClubStage(options: ClubStageOptions): ClubStage {
  const { renderer, models, getDuel } = options;
  const layout = readClubLayout(models.club);
  let reducedMotion = options.reducedMotion ?? false;

  const { player } = models;
  const extent = characterExtent(player.scene);
  // Made here, on entering the club: it resets the player's spring bones and expression weights.
  const shadow = createShadow(player, models.shadowPalette);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND);
  scene.add(models.club);
  const room = new HemisphereLight(ROOM_LIGHT.sky, ROOM_LIGHT.ground, ROOM_LIGHT.intensity);
  const stageLight = new DirectionalLight(STAGE_LIGHT.color, STAGE_LIGHT.intensity);
  stageLight.position.set(...STAGE_LIGHT.position);
  scene.add(room, stageLight);

  for (const [model, mark] of [
    [player, layout.player],
    [shadow, layout.rival],
  ] as const) {
    model.scene.position.copy(mark.position);
    model.scene.quaternion.copy(mark.quaternion);
    scene.add(model.scene);
  }

  // The drummer: a flat sheet facing the camera, anchored at the middle of its bottom edge. The
  // sheet is not flipped on upload, so its V axis is flipped here.
  const sheet = models.drummer;
  const frames = layout.drummer.frames;
  sheet.repeat.set(1 / frames, -1);
  sheet.offset.set(0, 1);
  const drummerMaterial = new SpriteMaterial({ map: sheet, transparent: true });
  const drummer = new Sprite(drummerMaterial);
  drummer.name = 'drummer';
  drummer.center.set(0.5, 0);
  drummer.position.copy(layout.drummer.position);
  const size = imageSize(sheet.image);
  const frameAspect = size === null ? 1 : size.width / frames / size.height;
  drummer.scale.set(layout.drummer.spriteHeight * frameAspect, layout.drummer.spriteHeight, 1);
  scene.add(drummer);
  let frame = 0;

  const subject = [...subjectPoints(layout.player, extent), ...subjectPoints(layout.rival, extent)];
  const camera = new PerspectiveCamera(layout.camera.fovDeg, 16 / 9, CAMERA_NEAR, 400);
  let viewSize: { width: number; height: number } = INITIAL_SIZE;
  /** The window the duel board leaves for the scene, once measured; the design table until then. */
  let measuredArea: SafeArea | null = null;
  function frameCamera() {
    const { width, height } = viewSize;
    const area = measuredArea ?? clubSafeArea(width, height);
    const framing = frameSubject(subject, layout.camera, width / height, area);
    applyFraming(camera, layout.camera, framing, width, height);
  }
  frameCamera();

  // The Shadow's own materials, with the transparency and opacity they were made with.
  const shadowMaterials = new Map(
    materialsOf(shadow.scene).map((material) => [
      material,
      { transparent: material.transparent, opacity: material.opacity },
    ]),
  );
  let fading = options.shadowFaded ?? false;
  let fadeTime = 0;
  let opacity = 1;
  function showShadowAt(next: number) {
    opacity = next;
    for (const [material, base] of shadowMaterials) {
      const transparent = base.transparent || next < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = base.opacity * next;
      // MToon copies `opacity` to its uniform only in `update`, which already ran this frame.
      if (material instanceof MToonMaterial) material.uniforms.opacity.value = material.opacity;
    }
    shadow.scene.visible = next > 0;
  }

  let actions: ClubStage['actions'] = { player: 'idle', shadow: 'idle' };
  let elapsed = 0;
  let audio: GameAudio | null = null;
  let paused = options.paused ?? false;
  let running = false;
  let lastTime: number | null = null;
  let released = false;

  function pose(
    model: VRM,
    action: CharacterAction,
    seed: number,
    beat: number | null,
    dt: number,
  ) {
    applyPose(
      model,
      characterPose({
        character: PLAYER_CHARACTER,
        action,
        time: elapsed,
        beat,
        seed,
        reducedMotion,
      }),
    );
    model.update(dt);
  }

  function step(dt: number) {
    if (released) return;
    const delta = Math.max(0, dt);
    elapsed += delta;

    const { phase, clock } = getDuel();
    const roles = duelRoles(phase);
    const now = audio === null ? null : audio.currentTime;
    // Both bounce on the beat of the take's clock, only while the band plays.
    const beat = roles.onBeat && clock !== null && now !== null ? timeToBeat(clock, now) : null;
    pose(player, roles.player, PLAYER_SEED, beat, delta);
    pose(shadow, roles.shadow, SHADOW_SEED, beat, delta);
    actions = { player: roles.player, shadow: roles.shadow };

    // After `update`, which may write material properties through expression binds.
    if (fading) fadeTime += delta;
    showShadowAt(fading ? shadowFadeOpacity(fadeTime) : 1);

    frame = drummerFrame(beat, frames, reducedMotion);
    sheet.offset.x = frame / frames;

    renderer.render(scene, camera);
  }

  function loop(time: number) {
    const dt = lastTime === null ? 0 : Math.min(MAX_FRAME_S, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    step(dt);
  }

  function setRunning(run: boolean) {
    if (run === running) return;
    running = run;
    lastTime = null;
    renderer.setAnimationLoop(run ? loop : null);
  }

  setRunning(!paused);

  return {
    scene,
    camera,
    layout,
    player,
    shadow,
    drummer,
    subject,
    get shadowOpacity() {
      return opacity;
    },
    get drummerFrame() {
      return frame;
    },
    get actions() {
      return actions;
    },
    get running() {
      return running;
    },
    frame: step,
    setAudio(next) {
      if (!released) audio = next;
    },
    setPaused(next) {
      if (released) return;
      paused = next;
      setRunning(!paused);
    },
    setReducedMotion(next) {
      reducedMotion = next;
    },
    setShadowFaded(next) {
      if (released || next === fading) return;
      fading = next;
      fadeTime = 0;
      // Replay and match 2 bring the Shadow back solid at once.
      if (!next) showShadowAt(1);
    },
    setSafeArea(area) {
      if (released) return;
      measuredArea = area;
      frameCamera();
      if (!running) renderer.render(scene, camera);
    },
    resize(width, height, pixelRatio) {
      if (released || !(width > 0) || !(height > 0)) return;
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      viewSize = { width, height };
      frameCamera();
      if (!running) renderer.render(scene, camera);
    },
    release() {
      if (released) return;
      released = true;
      renderer.setAnimationLoop(null);
      running = false;
      audio = null;
      scene.clear();
      // The Shadow first: it shares every geometry with the player.
      disposeShadow(shadow);
      VRMUtils.deepDispose(player.scene);
      disposeObjectTree(models.club);
      drummerMaterial.dispose();
      sheet.dispose();
      releaseRenderer(renderer);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The React component
// ---------------------------------------------------------------------------------------------

export interface ClubSceneProps {
  /** The downloaded asset files; the scene parses the club, the player, the palette and the drummer. */
  readonly files: StageAssetFiles;
  /** The game audio: the characters bounce to the beat of the take on its clock. */
  readonly audio: GameAudio | null;
  /** Hidden tab or portrait phone: the render loop stops (AC-STAGE-008.2). */
  readonly paused: boolean;
  readonly reducedMotion: boolean;
  /** The take was won: the Shadow fades away over `SHADOW_FADE_S` (AC-STAGE-005.3). */
  readonly shadowFaded: boolean;
  /** Accessible name of the scene, which is an image to assistive technology. */
  readonly label: string;
  /**
   * The club cannot be drawn: a file did not parse (`missing`), or WebGL failed to start or was
   * lost (`noWebgl`, design decision 3). The duel goes on without the scene, with that note.
   */
  readonly onFallback: (note: StageNote) => void;
}

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_POINTER_QUERY).matches;
}

/**
 * The club canvas, filling its container. It parses the files and builds the stage once; every
 * other prop is passed on to the running stage. Unmounting releases the stage, the renderer and
 * the WebGL context (AC-STAGE-008.1).
 */
export default function ClubScene(props: ClubSceneProps) {
  const { files, audio, paused, reducedMotion, shadowFaded, label } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<ClubStage | null>(null);
  /** The last measured scene window, kept for a stage built after the measure. */
  const areaRef = useRef<SafeArea | null>(null);
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
    let stage: ClubStage | null = null;
    let observer: ResizeObserver | null = null;
    const fallBack = (note: StageNote) => {
      if (!cancelled) latest.current.onFallback(note);
    };
    // A loss the page did not ask for (design decision 3); removed before the stage gives the
    // context back on unmount.
    const onContextLost = () => fallBack('noWebgl');
    canvas.addEventListener('webglcontextlost', onContextLost);

    let renderer: WebGLRenderer | null = null;
    try {
      renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
      });
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
      parseClubModels(files).then(
        (models) => {
          if (cancelled) {
            disposeClubModels(models);
            return;
          }
          const current = latest.current;
          try {
            stage = createClubStage({
              renderer: ownRenderer,
              models,
              getDuel: duelFromStore,
              reducedMotion: current.reducedMotion,
              paused: current.paused,
              shadowFaded: current.shadowFaded,
            });
          } catch {
            disposeClubModels(models);
            fallBack('missing');
            return;
          }
          stageRef.current = stage;
          stage.setAudio(current.audio);
          if (areaRef.current !== null) stage.setSafeArea(areaRef.current);
          resize();
          observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
          observer?.observe(host);
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

  // The duel board's scene window (design decision 7): the characters are framed inside it,
  // measured again whenever it or the canvas changes size. When the board goes (the result after a
  // take), the last framing stays, so the Shadow fades where it stood.
  const sceneWindow = useStageLayout()?.sceneWindow ?? null;
  useEffect(() => {
    const host = hostRef.current;
    if (sceneWindow === null || host === null) return;
    const measure = () => {
      const area = windowArea(sceneWindow.getBoundingClientRect(), host.getBoundingClientRect());
      if (area === null) return;
      areaRef.current = area;
      stageRef.current?.setSafeArea(area);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(sceneWindow);
    observer?.observe(host);
    return () => observer?.disconnect();
  }, [sceneWindow]);

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
    stageRef.current?.setShadowFaded(shadowFaded);
  }, [shadowFaded]);

  return <div ref={hostRef} role="img" aria-label={label} className="absolute inset-0" />;
}
