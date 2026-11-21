/**
 * The stage asset manifest, `/game-assets/manifest.json`, as `specs/game-stage/assets.md` defines it.
 *
 * The asset folder exists only on the project owner's machine: CI, a clean checkout and the deployed
 * site have no manifest. So reading it never throws; a missing, unreadable or invalid manifest is a
 * `MissingAssets` result, and the game falls back to the grey-box duel (AC-STAGE-001.2, 001.3).
 *
 * Nothing here touches `window` at import time, so the module is safe to import on the server.
 */
import type { FetchLike, MissingAssets } from './types';

/** Every path in the manifest is relative to this URL. */
export const ASSET_BASE_URL = '/game-assets/';
export const MANIFEST_URL = `${ASSET_BASE_URL}manifest.json`;
/** The only manifest version this code reads. */
export const MANIFEST_VERSION = 1;

/**
 * A validated manifest. Paths are relative to `ASSET_BASE_URL`; `bytes` is the real size of the
 * entry's files, used to report download progress in bytes (AC-STAGE-001.4).
 */
export interface StageManifest {
  readonly version: typeof MANIFEST_VERSION;
  readonly characters: {
    readonly player: {
      readonly vrm: string;
      readonly shadowPalette: string;
      readonly bytes: number;
    };
  };
  readonly stages: {
    readonly hoLangStreet: { readonly glb: string; readonly bytes: number };
    readonly hoLangClub: { readonly glb: string; readonly bytes: number };
  };
  readonly props: {
    readonly duck: { readonly glb: string; readonly bytes: number };
  };
  readonly sprites: {
    readonly drummer: { readonly png: string; readonly bytes: number };
  };
}

export type ManifestResult =
  | { readonly ok: true; readonly manifest: StageManifest }
  | MissingAssets<'manifest-unavailable' | 'manifest-invalid'>;

export interface FetchManifestOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  readonly signal?: AbortSignal;
  /** Defaults to `MANIFEST_URL`. */
  readonly url?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(
  parent: Readonly<Record<string, unknown>>,
  key: string,
  at: string,
): Readonly<Record<string, unknown>> {
  const value = parent[key];
  if (!isRecord(value)) throw new Error(`${at}${key} is missing or not an object`);
  return value;
}

function readPath(parent: Readonly<Record<string, unknown>>, key: string, at: string): string {
  const value = parent[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${at}${key} is missing or not a non-empty string`);
  }
  return value;
}

function readBytes(parent: Readonly<Record<string, unknown>>, at: string): number {
  const value = parent.bytes;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${at}bytes is missing or not a non-negative integer`);
  }
  return value;
}

function readManifest(raw: unknown): StageManifest {
  if (!isRecord(raw)) throw new Error('the manifest is not a JSON object');
  if (raw.version !== MANIFEST_VERSION) {
    throw new Error(`version is ${JSON.stringify(raw.version)}, expected ${MANIFEST_VERSION}`);
  }

  const characters = readRecord(raw, 'characters', '');
  const player = readRecord(characters, 'player', 'characters.');
  const stages = readRecord(raw, 'stages', '');
  const street = readRecord(stages, 'hoLangStreet', 'stages.');
  const club = readRecord(stages, 'hoLangClub', 'stages.');
  const props = readRecord(raw, 'props', '');
  const duck = readRecord(props, 'duck', 'props.');
  const sprites = readRecord(raw, 'sprites', '');
  const drummer = readRecord(sprites, 'drummer', 'sprites.');

  return {
    version: MANIFEST_VERSION,
    characters: {
      player: {
        vrm: readPath(player, 'vrm', 'characters.player.'),
        shadowPalette: readPath(player, 'shadowPalette', 'characters.player.'),
        bytes: readBytes(player, 'characters.player.'),
      },
    },
    stages: {
      hoLangStreet: {
        glb: readPath(street, 'glb', 'stages.hoLangStreet.'),
        bytes: readBytes(street, 'stages.hoLangStreet.'),
      },
      hoLangClub: {
        glb: readPath(club, 'glb', 'stages.hoLangClub.'),
        bytes: readBytes(club, 'stages.hoLangClub.'),
      },
    },
    props: {
      duck: { glb: readPath(duck, 'glb', 'props.duck.'), bytes: readBytes(duck, 'props.duck.') },
    },
    sprites: {
      drummer: {
        png: readPath(drummer, 'png', 'sprites.drummer.'),
        bytes: readBytes(drummer, 'sprites.drummer.'),
      },
    },
  };
}

/**
 * Validates parsed manifest JSON. A missing required field, a field of the wrong type, or a
 * `version` other than the number 1 gives `manifest-invalid` (AC-STAGE-001.3). Unknown extra
 * fields are ignored and not copied into the result.
 */
export function parseManifest(raw: unknown): ManifestResult {
  try {
    return { ok: true, manifest: readManifest(raw) };
  } catch (error) {
    return { ok: false, reason: 'manifest-invalid', detail: describeError(error) };
  }
}

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

/** A readable message for any thrown value. */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetches and validates the manifest. Never throws: an HTTP error, a network error or JSON that
 * does not parse gives `manifest-unavailable`; a manifest that parses but breaks the contract
 * gives `manifest-invalid`.
 */
export async function fetchManifest(options: FetchManifestOptions = {}): Promise<ManifestResult> {
  const { fetch: doFetch = defaultFetch, signal, url = MANIFEST_URL } = options;

  let raw: unknown;
  try {
    const response = await doFetch(url, { signal });
    if (!response.ok) {
      return { ok: false, reason: 'manifest-unavailable', detail: `${url}: HTTP ${response.status}` };
    }
    raw = await response.json();
  } catch (error) {
    return { ok: false, reason: 'manifest-unavailable', detail: `${url}: ${describeError(error)}` };
  }
  return parseManifest(raw);
}
