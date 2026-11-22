/**
 * Street models built by hand for tests, laid out by the asset contract (assets.md): the empty
 * logic nodes of the street GLB, two lamp meshes sharing one glowing material, a facade mesh with
 * a texture, and a one-mesh duck. Placeholder boxes only, never the real art. Test-only.
 */
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Texture,
  type BufferGeometry,
} from 'three';
import { buildFixtureVrm, type FixtureVrm } from '../character/testing/vrm-fixture';
import type { StreetModels } from '../scenes/StreetScene';

/** X positions of the fake street's nodes, in metres. Not the real street's numbers. */
export const FAKE_STREET = Object.freeze({
  spawnX: 10,
  walkMin: 0,
  walkMax: 40,
  camMin: 4,
  camMax: 36,
  doorX: 30,
  /** The walk line's depth and the ground's height. */
  pathZ: 1,
  groundY: 0.2,
});

/** The camera extras of `cam_min` and `cam_max` in the fake street. */
export const FAKE_FRAMING = Object.freeze({ fovDeg: 40, distance: 16, height: 4, pitchDeg: -10 });

/** Lit intensity of the fake lamp material, as exported. */
export const FAKE_LAMP_INTENSITY = 2.5;

export interface FakeStreetOptions {
  /** Leave out the node of this name, to break the contract. */
  readonly omit?: string;
  /** Leave the framing extras off `cam_min` and `cam_max`. */
  readonly noFraming?: boolean;
}

export interface FakeStreet {
  readonly street: Group;
  readonly lampMaterial: MeshStandardMaterial;
  readonly facade: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly facadeTexture: Texture;
}

function emptyNode(parent: Object3D, name: string, x: number, y: number, z: number): Object3D {
  const node = new Object3D();
  node.name = name;
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

export function buildFakeStreet(options: FakeStreetOptions = {}): FakeStreet {
  const street = new Group();
  street.name = 'fake-street';
  const { pathZ: z, groundY: y } = FAKE_STREET;
  const add = (name: string, x: number, nodeY: number = y, nodeZ: number = z): Object3D | null =>
    name === options.omit ? null : emptyNode(street, name, x, nodeY, nodeZ);

  const spawn = add('spawn', FAKE_STREET.spawnX);
  // Facing +X, like a character that walks right.
  spawn?.rotation.set(0, Math.PI / 2, 0);
  add('walk_min', FAKE_STREET.walkMin);
  add('walk_max', FAKE_STREET.walkMax);
  const camMin = add('cam_min', FAKE_STREET.camMin);
  const camMax = add('cam_max', FAKE_STREET.camMax);
  if (!options.noFraming) {
    if (camMin) camMin.userData = { ...FAKE_FRAMING };
    if (camMax) camMax.userData = { ...FAKE_FRAMING };
  }
  const door = add('club_door', FAKE_STREET.doorX);
  if (door) door.userData = { doorSetBackM: 2 };
  [12, 14, 16, 15, 13].forEach((x, index) => add(`duck_path_${index}`, x, y - 0.3, z - 5 - index));

  const lampMaterial = new MeshStandardMaterial({ name: 'lamp_glow' });
  lampMaterial.emissiveIntensity = FAKE_LAMP_INTENSITY;
  for (const [name, x] of [
    ['lamp_0', 4],
    ['lamp_1', 20],
  ] as const) {
    const lamp = new Mesh(new BoxGeometry(0.2, 0.3, 0.2), lampMaterial);
    lamp.name = name;
    lamp.position.set(x, 2.4, z - 1);
    street.add(lamp);
  }

  const facadeTexture = new Texture();
  const facade = new Mesh(
    new BoxGeometry(40, 6, 1),
    new MeshStandardMaterial({ name: 'street_palette', map: facadeTexture }),
  );
  facade.name = 'street_mid';
  facade.position.set(20, 3, z - 4);
  street.add(facade);

  return { street, lampMaterial, facade, facadeTexture };
}

export interface FakeDuck {
  readonly duck: Group;
  readonly body: Mesh<BufferGeometry, MeshStandardMaterial>;
}

export function buildFakeDuck(): FakeDuck {
  const duck = new Group();
  duck.name = 'fake-duck';
  const body = new Mesh(new BoxGeometry(0.4, 0.3, 0.6), new MeshStandardMaterial({ name: 'duck' }));
  body.name = 'duck';
  duck.add(body);
  return { duck, body };
}

export interface FakeStreetModels extends FakeStreet, FakeDuck {
  readonly models: StreetModels;
  readonly player: FixtureVrm;
}

/** A complete set of street models: the fake street, the fake duck and the fixture VRM. */
export function buildFakeStreetModels(options: FakeStreetOptions = {}): FakeStreetModels {
  const street = buildFakeStreet(options);
  const duck = buildFakeDuck();
  const player = buildFixtureVrm();
  return {
    ...street,
    ...duck,
    player,
    models: { street: street.street, duck: duck.duck, player: player.vrm },
  };
}
