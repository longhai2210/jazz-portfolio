/**
 * The club stage (scenes/ClubScene.tsx), driven frame by frame with a fake renderer. The club is a
 * placeholder built by hand to the asset contract (assets.md): the four logic nodes, a floor with
 * a texture, the fixture VRM as the player, and stand-in textures for the Shadow palette and the
 * drummer sheet. Never the real art.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Texture,
  Vector3,
  type Material,
} from 'three';
import { MToonMaterial } from '@pixiv/three-vrm';
import { createGameAudio, type GameAudio } from '../../audio';
import { createManualTimer, FakeAudioContext } from '../../audio/testing/fake-audio-context';
import { createBeatClock, type BeatClock } from '../../core/clock';
import type { SessionPhase } from '../../core/session';
import { BOUNCE_DEPTH_M } from '../character/config';
import { buildFixtureVrm, fakeImage, type FixtureVrm } from '../character/testing/vrm-fixture';
import { FakeRenderer } from '../testing/fake-webgl';
import {
  CLUB_SAFE_AREA,
  clubSafeArea,
  createClubStage,
  DEFAULT_DRUMMER,
  DEFAULT_DUEL_FOV_DEG,
  drummerFrame,
  frameSubject,
  readClubLayout,
  SHADOW_FADE_S,
  shadowFadeOpacity,
  type ClubStage,
  type ClubStageOptions,
  type DuelView,
} from './ClubScene';

// GLTFLoader ships as an ES module Jest does not load; no test here parses a file.
jest.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {} }));

/** Where the fake club's nodes stand, in metres. Not the real club's numbers. */
const MARKS = Object.freeze({
  player: new Vector3(-1.2, 0.3, 0),
  rival: new Vector3(1.2, 0.3, 0),
  drummer: new Vector3(0, 0.3, -2.5),
  camera: new Vector3(0, 1.5, 5),
});
const FAKE_FOV_DEG = 30;
const FAKE_DRUMMER = Object.freeze({ frames: 4, spriteHeight: 1.4 });
/** The drummer sheet stand-in: four frames of 128 × 256 side by side. */
const SHEET_SIZE = Object.freeze({ width: 512, height: 256 });

interface FakeClubOptions {
  /** Leave out the node of this name, to break the contract. */
  readonly omit?: string;
  /** Extras for `drummer_mark` and `cam_duel` instead of the fake ones. */
  readonly drummerExtras?: Record<string, unknown>;
  readonly cameraExtras?: Record<string, unknown>;
}

interface FakeClub {
  readonly club: Group;
  readonly floor: Mesh<BoxGeometry, MeshStandardMaterial>;
  readonly floorTexture: Texture;
}

function buildFakeClub(options: FakeClubOptions = {}): FakeClub {
  const club = new Group();
  club.name = 'fake-club';
  const add = (name: string, position: Vector3, yaw = 0): Object3D | null => {
    if (name === options.omit) return null;
    const node = new Object3D();
    node.name = name;
    node.position.copy(position);
    node.rotation.set(0, yaw, 0);
    club.add(node);
    return node;
  };
  add('player_mark', MARKS.player, 0.5);
  add('rival_mark', MARKS.rival, -0.5);
  const drummer = add('drummer_mark', MARKS.drummer);
  const camera = add('cam_duel', MARKS.camera);
  if (drummer) drummer.userData = options.drummerExtras ?? { ...FAKE_DRUMMER };
  if (camera) camera.userData = options.cameraExtras ?? { fovDeg: FAKE_FOV_DEG };

  const floorTexture = new Texture();
  const floor = new Mesh(
    new BoxGeometry(8, 0.3, 4),
    new MeshStandardMaterial({ name: 'stage_floor', map: floorTexture }),
  );
  floor.name = 'stage_floor';
  floor.position.set(0, 0.15, 0);
  club.add(floor);
  return { club, floor, floorTexture };
}

interface Rig {
  readonly stage: ClubStage;
  readonly renderer: FakeRenderer;
  readonly club: FakeClub;
  readonly player: FixtureVrm;
  readonly palette: Texture;
  readonly sheet: Texture;
  /** Sets what the duel shows. */
  setDuel(next: DuelView): void;
  /** Steps the stage `count` frames of `dt` seconds. */
  run(count: number, dt?: number): void;
}

const NO_DUEL: DuelView = { phase: null, clock: null };

function buildRig(options: Partial<ClubStageOptions> = {}): Rig {
  const renderer = new FakeRenderer();
  const club = buildFakeClub();
  const player = buildFixtureVrm();
  const palette = new Texture(fakeImage('shadow-palette'));
  const sheet = new Texture({ ...SHEET_SIZE });
  let duel = NO_DUEL;
  const stage = createClubStage({
    renderer,
    models: { club: club.club, player: player.vrm, shadowPalette: palette, drummer: sheet },
    getDuel: () => duel,
    ...options,
  });
  return {
    stage,
    renderer,
    club,
    player,
    palette,
    sheet,
    setDuel: (next) => {
      duel = next;
    },
    run: (count, dt = 1 / 60) => {
      for (let i = 0; i < count; i++) stage.frame(dt);
    },
  };
}

function materialsOf(root: Object3D): Material[] {
  const found = new Set<Material>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const material: Material | Material[] = node.material;
    for (const each of Array.isArray(material) ? material : [material]) found.add(each);
  });
  return [...found];
}

function runningAudio(): { context: FakeAudioContext; audio: GameAudio } {
  const context = new FakeAudioContext();
  context.state = 'running';
  return { context, audio: createGameAudio(context, { timer: createManualTimer() }) };
}

const CLOCK: BeatClock = createBeatClock({ t0: 10, bpm: 120, difficulty: 'lounge' });
const COUNT_IN: SessionPhase = { kind: 'countIn', turn: 'echo', bar: 0, beat: 0 };
const OPPONENT: SessionPhase = { kind: 'opponent', turn: 'echo', bar: 1, index: 0 };
const PLAYER_TURN: SessionPhase = { kind: 'player', turn: 'echo', bar: 5, index: 0 };

/** Where `point` lands on a canvas, as fractions from its left and top edges. */
function onScreen(point: Vector3, stage: ClubStage): { x: number; y: number } {
  const ndc = point.clone().project(stage.camera);
  return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 };
}

describe('club stage', () => {
  let rig: Rig | null = null;

  afterEach(() => {
    rig?.stage.release();
    rig = null;
  });

  function useRig(options: Partial<ClubStageOptions> = {}): Rig {
    rig = buildRig(options);
    return rig;
  }

  it('reads the logic nodes and the extras of the club', () => {
    const layout = readClubLayout(buildFakeClub().club);
    expect(layout.player.position.toArray()).toEqual(MARKS.player.toArray());
    expect(layout.rival.position.toArray()).toEqual(MARKS.rival.toArray());
    expect(layout.drummer.position.toArray()).toEqual(MARKS.drummer.toArray());
    expect(layout.camera.position.toArray()).toEqual(MARKS.camera.toArray());
    expect(layout.camera.fovDeg).toBe(FAKE_FOV_DEG);
    expect(layout.drummer).toMatchObject(FAKE_DRUMMER);
    // Each mark keeps its orientation: the characters face the node's +Z.
    const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5);
    expect(layout.player.quaternion.angleTo(yaw)).toBeCloseTo(0, 6);

    const bare = readClubLayout(
      buildFakeClub({
        drummerExtras: { frames: 0, spriteHeight: 'tall' },
        cameraExtras: { fovDeg: 400 },
      }).club,
    );
    expect(bare.camera.fovDeg).toBe(DEFAULT_DUEL_FOV_DEG);
    expect(bare.drummer).toMatchObject(DEFAULT_DRUMMER);
  });

  it('a club without a required node breaks the asset contract', () => {
    for (const name of ['player_mark', 'rival_mark', 'drummer_mark', 'cam_duel']) {
      expect(() => readClubLayout(buildFakeClub({ omit: name }).club)).toThrow(name);
    }
  });

  it('stands the player at player_mark and the Shadow, made from the same model on entering the club, at rival_mark', () => {
    const { stage, player, palette } = useRig();
    expect(stage.player).toBe(player.vrm);
    expect(stage.shadow).not.toBe(player.vrm);
    expect(stage.player.scene.position.toArray()).toEqual(MARKS.player.toArray());
    expect(stage.shadow.scene.position.toArray()).toEqual(MARKS.rival.toArray());
    expect(stage.scene.children).toEqual(
      expect.arrayContaining([stage.player.scene, stage.shadow.scene, stage.drummer]),
    );
    // A clone drawn with the Shadow palette: same geometry, its own materials.
    const shadowBody = stage.shadow.scene.getObjectByName('body');
    if (!(shadowBody instanceof Mesh)) throw new Error('the Shadow has no body');
    expect(shadowBody.geometry).toBe(player.body.geometry);
    const [surface] = materialsOf(stage.shadow.scene).filter((m) => m instanceof MToonMaterial);
    expect(surface).not.toBe(player.surface);
    expect((surface as MToonMaterial).map?.source).toBe(palette.source);
  });

  it('the drummer is a sheet anchored at the middle of its bottom edge on drummer_mark, one frame wide', () => {
    const { stage, sheet } = useRig();
    expect(stage.drummer.position.toArray()).toEqual(MARKS.drummer.toArray());
    expect(stage.drummer.center.toArray()).toEqual([0.5, 0]);
    const frameAspect = SHEET_SIZE.width / FAKE_DRUMMER.frames / SHEET_SIZE.height;
    expect(stage.drummer.scale.y).toBeCloseTo(FAKE_DRUMMER.spriteHeight);
    expect(stage.drummer.scale.x).toBeCloseTo(FAKE_DRUMMER.spriteHeight * frameAspect);
    expect(sheet.repeat.x).toBeCloseTo(1 / FAKE_DRUMMER.frames);

    expect(drummerFrame(null, 4, false)).toBe(0);
    expect(drummerFrame(1.5, 4, true)).toBe(0);
    expect(drummerFrame(1.5, 1, false)).toBe(0);
    expect([0, 0.5, 1, 1.5, 2].map((beat) => drummerFrame(beat, 4, false))).toEqual([0, 1, 2, 3, 0]);
    expect(drummerFrame(-0.5, 4, false)).toBe(3);
  });

  it('the poses follow the duel: the Shadow plays on its turn while the player listens, and the other way round', () => {
    const { stage, setDuel, run } = useRig();
    run(1);
    expect(stage.actions).toEqual({ player: 'idle', shadow: 'idle' });
    setDuel({ phase: OPPONENT, clock: CLOCK });
    run(1);
    expect(stage.actions).toEqual({ player: 'listen', shadow: 'play' });
    setDuel({ phase: PLAYER_TURN, clock: CLOCK });
    run(1);
    expect(stage.actions).toEqual({ player: 'play', shadow: 'listen' });
    setDuel({ phase: COUNT_IN, clock: CLOCK });
    run(1);
    expect(stage.actions).toEqual({ player: 'listen', shadow: 'listen' });
  });

  it('both characters bounce on the beat of the take on the audio clock, and stand still with reduced motion', () => {
    const { context, audio } = runningAudio();

    function hipsDrop(reducedMotion: boolean, beat: number): { player: number; shadow: number } {
      const local = buildRig({ reducedMotion });
      local.stage.setAudio(audio);
      local.setDuel({ phase: COUNT_IN, clock: CLOCK });
      context.currentTime = CLOCK.t0 + beat * (60 / CLOCK.bpm);
      local.run(1);
      const drop = (stage: ClubStage, which: 'player' | 'shadow') => {
        const vrm = stage[which];
        const hips = vrm.humanoid.getNormalizedBoneNode('hips');
        const rest = vrm.humanoid.normalizedRestPose.hips?.position;
        if (!hips || !rest) throw new Error('no hips');
        return rest[1] - hips.position.y;
      };
      const result = { player: drop(local.stage, 'player'), shadow: drop(local.stage, 'shadow') };
      local.stage.release();
      return result;
    }

    // At a whole beat both sit at the bottom of the bounce; half a beat later both are up.
    const onBeat = hipsDrop(false, 4);
    expect(onBeat.player).toBeCloseTo(BOUNCE_DEPTH_M, 6);
    expect(onBeat.shadow).toBeCloseTo(BOUNCE_DEPTH_M, 6);
    const offBeat = hipsDrop(false, 4.5);
    expect(offBeat.player).toBeCloseTo(0, 6);
    expect(hipsDrop(true, 4)).toEqual({ player: 0, shadow: 0 });
  });

  it('the drummer plays on the beat while the band plays, and holds still otherwise', () => {
    const { context, audio } = runningAudio();
    const { stage, setDuel, run } = useRig();
    stage.setAudio(audio);
    setDuel({ phase: OPPONENT, clock: CLOCK });
    context.currentTime = CLOCK.t0 + 0.5 * (60 / CLOCK.bpm);
    run(1);
    expect(stage.drummerFrame).toBe(1);
    setDuel({ phase: { kind: 'paused', turn: 'echo' }, clock: CLOCK });
    run(1);
    expect(stage.drummerFrame).toBe(0);
  });

  it('AC-STAGE-005.3: shadowFadeOpacity falls from 1 to 0 over SHADOW_FADE_S and stays at 0', () => {
    expect(SHADOW_FADE_S).toBe(1.5);
    expect(shadowFadeOpacity(0)).toBe(1);
    expect(shadowFadeOpacity(-1)).toBe(1);
    expect(shadowFadeOpacity(SHADOW_FADE_S / 2)).toBeCloseTo(0.5);
    expect(shadowFadeOpacity(SHADOW_FADE_S)).toBe(0);
    expect(shadowFadeOpacity(SHADOW_FADE_S * 3)).toBe(0);
    for (let t = 0; t < SHADOW_FADE_S; t += 0.05) {
      expect(shadowFadeOpacity(t + 0.05)).toBeLessThanOrEqual(shadowFadeOpacity(t));
    }
  });

  it('AC-STAGE-005.3: after a win the Shadow fades away in SHADOW_FADE_S, then is gone; the player stays solid', () => {
    const { stage, player, run } = useRig();
    run(10);
    expect(stage.shadowOpacity).toBe(1);
    expect(stage.shadow.scene.visible).toBe(true);

    stage.setShadowFaded(true);
    run(45);
    // Halfway: half see-through, every Shadow material blended, MToon's uniform too.
    expect(stage.shadowOpacity).toBeCloseTo(0.5, 6);
    const shadowMaterials = materialsOf(stage.shadow.scene);
    for (const material of shadowMaterials) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeCloseTo(0.5, 6);
      if (material instanceof MToonMaterial) {
        expect(material.uniforms.opacity.value).toBeCloseTo(0.5, 6);
      }
    }
    expect(stage.shadow.scene.visible).toBe(true);

    // One frame past SHADOW_FADE_S (90 frames of 1/60 s add up to just under 1.5 in floats).
    run(46);
    expect(stage.shadowOpacity).toBe(0);
    expect(stage.shadow.scene.visible).toBe(false);
    run(60);
    expect(stage.shadowOpacity).toBe(0);
    for (const material of [player.surface, player.outline, player.plain]) {
      expect(material.opacity).toBe(1);
      expect(material.transparent).toBe(false);
    }
  });

  it('AC-STAGE-005.3: with reduced motion the Shadow still fades over the same SHADOW_FADE_S', () => {
    const { stage, run } = useRig({ reducedMotion: true });
    stage.setShadowFaded(true);
    run(10, 0.1);
    expect(stage.shadowOpacity).toBeCloseTo(1 - 1 / SHADOW_FADE_S, 6);
    run(5, 0.1);
    expect(stage.shadowOpacity).toBe(0);
    expect(stage.shadow.scene.visible).toBe(false);
  });

  it('AC-STAGE-005.3: a lost take leaves the Shadow solid, and Replay or match 2 bring a faded Shadow back solid', () => {
    const { stage, run } = useRig();
    stage.setShadowFaded(false);
    run(120);
    expect(stage.shadowOpacity).toBe(1);

    stage.setShadowFaded(true);
    run(120);
    expect(stage.shadow.scene.visible).toBe(false);
    stage.setShadowFaded(false);
    expect(stage.shadowOpacity).toBe(1);
    expect(stage.shadow.scene.visible).toBe(true);
    for (const material of materialsOf(stage.shadow.scene)) {
      expect(material.opacity).toBe(1);
      expect(material.transparent).toBe(false);
    }
    // A second win fades from the start again.
    stage.setShadowFaded(true);
    run(45);
    expect(stage.shadowOpacity).toBeCloseTo(0.5, 6);
  });

  it('a paused stage does not run the fade on', () => {
    const { stage, renderer } = useRig();
    stage.setShadowFaded(true);
    stage.setPaused(true);
    expect(renderer.tick(0)).toBe(false);
    expect(stage.shadowOpacity).toBe(1);
  });

  it.each([
    ['a phone held sideways', 844, 390, CLUB_SAFE_AREA.phone],
    ['a computer', 1280, 720, CLUB_SAFE_AREA.desktop],
  ])(
    'frames both characters inside the part of the screen the duel leaves uncovered on %s (design decision 7)',
    (_name, width, height, area) => {
      expect(clubSafeArea(width, height)).toBe(area);
      const { stage } = useRig();
      stage.resize(width, height, 1);

      // Every corner of both characters, floor to above the head.
      expect(stage.subject.length).toBeGreaterThanOrEqual(16);
      for (const point of stage.subject) {
        const { x, y } = onScreen(point, stage);
        expect(y).toBeGreaterThanOrEqual(area.top);
        expect(y).toBeLessThanOrEqual(area.bottom);
        expect(x).toBeGreaterThanOrEqual(area.left);
        expect(x).toBeLessThanOrEqual(area.right);
      }
      // The feet and the head at both marks, as a reader would check them.
      for (const mark of [MARKS.player, MARKS.rival]) {
        for (const point of [mark, mark.clone().add(new Vector3(0, 1.6, 0))]) {
          const { x, y } = onScreen(point, stage);
          expect(y).toBeGreaterThan(area.top);
          expect(y).toBeLessThan(area.bottom);
          expect(x).toBeGreaterThan(area.left);
          expect(x).toBeLessThan(area.right);
        }
      }
      // The camera keeps the look of cam_duel: same direction and field of view, only further
      // back along its line of sight.
      expect(stage.camera.fov).toBe(FAKE_FOV_DEG);
      expect(stage.camera.quaternion.angleTo(stage.layout.camera.quaternion)).toBeCloseTo(0, 6);
      expect(stage.camera.position.x).toBeCloseTo(MARKS.camera.x, 6);
      expect(stage.camera.position.y).toBeCloseTo(MARKS.camera.y, 6);
      expect(stage.camera.position.z).toBeGreaterThanOrEqual(MARKS.camera.z);
      expect(stage.camera.aspect).toBeCloseTo(width / height);
    },
  );

  it('never frames closer than cam_duel: a subject that already fits keeps the camera on the node', () => {
    const { layout } = useRig().stage;
    const near = [new Vector3(0, 1.5, 0), new Vector3(0.1, 1.6, 0)];
    const framing = frameSubject(near, layout.camera, 16 / 9, CLUB_SAFE_AREA.desktop);
    expect(framing.dolly).toBe(0);
  });

  it('a phone held upright or a short computer window uses the computer area unless it is a sideways phone', () => {
    expect(clubSafeArea(390, 844)).toBe(CLUB_SAFE_AREA.desktop);
    expect(clubSafeArea(1280, 501)).toBe(CLUB_SAFE_AREA.desktop);
    expect(clubSafeArea(1280, 500)).toBe(CLUB_SAFE_AREA.phone);
  });

  it('AC-STAGE-008.2: pausing stops the render loop, and resuming restarts it without a jump', () => {
    const { stage, renderer } = useRig();
    expect(stage.running).toBe(true);
    expect(renderer.tick(0)).toBe(true);
    expect(renderer.tick(16)).toBe(true);
    expect(renderer.renders).toBe(2);

    stage.setPaused(true);
    expect(stage.running).toBe(false);
    expect(renderer.tick(32)).toBe(false);
    expect(renderer.renders).toBe(2);

    stage.setShadowFaded(true);
    stage.setPaused(false);
    expect(renderer.tick(10_000)).toBe(true);
    // The first frame after a pause steps 0 s.
    expect(stage.shadowOpacity).toBe(1);
  });

  it('AC-STAGE-008.1: release frees the Shadow before the player it shares geometry with, then the club, the drummer and the renderer', () => {
    const { stage, renderer, club, player, sheet } = useRig();
    stage.frame(1 / 60);
    const order: string[] = [];
    const watch = (label: string, target: { addEventListener(type: 'dispose', listener: () => void): void }) =>
      target.addEventListener('dispose', () => order.push(label));
    for (const material of materialsOf(stage.shadow.scene)) watch('shadow', material);
    for (const material of [player.surface, player.outline, player.plain]) watch('player', material);
    watch('player-geometry', player.body.geometry);
    watch('club', club.floor.geometry);
    watch('club', club.floor.material);
    watch('club', club.floorTexture);
    watch('drummer', stage.drummer.material);
    watch('drummer', sheet);

    stage.release();
    expect(order.lastIndexOf('shadow')).toBeLessThan(order.indexOf('player'));
    expect(order.filter((label) => label === 'player-geometry')).toHaveLength(1);
    expect(order).toEqual(expect.arrayContaining(['club', 'drummer']));
    expect(order.filter((label) => label === 'club')).toHaveLength(3);
    expect(order.filter((label) => label === 'drummer')).toHaveLength(2);
    expect(stage.running).toBe(false);
    expect(renderer.tick(100)).toBe(false);
    expect(stage.scene.children).toHaveLength(0);
    expect(renderer.disposeCalls).toBe(1);
    expect(renderer.context.loseContextCalls).toBe(1);

    stage.release();
    expect(renderer.context.loseContextCalls).toBe(1);
    rig = null;
  });
});
