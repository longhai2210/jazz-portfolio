/**
 * Downloads the stage assets listed in the manifest, reporting progress in real bytes.
 *
 * Every file is fetched once, as a stream, into an `ArrayBuffer`; the 3D modules parse those
 * buffers later (GLB, VRM, PNG), so nothing here depends on three.js. Progress counts the bytes
 * actually read from the streams against the total `bytes` declared in the manifest, so the
 * loading screen never shows invented progress (AC-STAGE-001.4).
 *
 * Loading never throws: a missing or invalid manifest, a failed file or an abort is a
 * `MissingAssets` result, and the game falls back to the grey-box duel (AC-STAGE-001.2, 001.3).
 *
 * Nothing here touches `window` at import time, so the module is safe to import on the server.
 */
import { ASSET_BASE_URL, describeError, fetchManifest, type StageManifest } from './manifest';
import type { FetchLike, MissingAssets, ResponseLike } from './types';

/** One downloadable file per id. The player entry of the manifest has two files. */
export type AssetFileId =
  | 'playerVrm'
  | 'playerShadowPalette'
  | 'hoLangStreet'
  | 'hoLangClub'
  | 'duck'
  | 'drummer';

export interface AssetFile {
  readonly id: AssetFileId;
  /** As written in the manifest, relative to `ASSET_BASE_URL`. */
  readonly path: string;
  readonly url: string;
}

/** The raw contents of every asset file, by id. */
export type StageAssetFiles = Readonly<Record<AssetFileId, ArrayBuffer>>;

/**
 * Download progress. `loadedBytes` only grows, `totalBytes` is fixed by the manifest, and
 * `fraction` is `loadedBytes / totalBytes` capped at 1, so it never decreases either.
 */
export interface AssetLoadProgress {
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly fraction: number;
}

export interface LoadAssetFilesOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Aborting it stops every download and gives an `aborted` result. */
  readonly signal?: AbortSignal;
  /** Called once with 0 bytes when downloads start, then after every chunk read. */
  readonly onProgress?: (progress: AssetLoadProgress) => void;
}

export type AssetFilesResult =
  | { readonly ok: true; readonly files: StageAssetFiles }
  | MissingAssets<'file-unavailable' | 'aborted'>;

export type StageAssetsResult =
  | { readonly ok: true; readonly manifest: StageManifest; readonly files: StageAssetFiles }
  | MissingAssets;

function assetFile(id: AssetFileId, path: string): AssetFile {
  return { id, path, url: `${ASSET_BASE_URL}${path}` };
}

/** Every file the manifest lists, by id. */
export function assetFiles(manifest: StageManifest): Readonly<Record<AssetFileId, AssetFile>> {
  const { characters, stages, props, sprites } = manifest;
  return {
    playerVrm: assetFile('playerVrm', characters.player.vrm),
    playerShadowPalette: assetFile('playerShadowPalette', characters.player.shadowPalette),
    hoLangStreet: assetFile('hoLangStreet', stages.hoLangStreet.glb),
    hoLangClub: assetFile('hoLangClub', stages.hoLangClub.glb),
    duck: assetFile('duck', props.duck.glb),
    drummer: assetFile('drummer', sprites.drummer.png),
  };
}

/** The sum of every `bytes` field in the manifest: the denominator of the progress fraction. */
export function totalManifestBytes(manifest: StageManifest): number {
  const { characters, stages, props, sprites } = manifest;
  return (
    characters.player.bytes +
    stages.hoLangStreet.bytes +
    stages.hoLangClub.bytes +
    props.duck.bytes +
    sprites.drummer.bytes
  );
}

/** The progress after `loadedBytes` of `totalBytes`. A total of 0 reports a fraction of 0. */
export function assetLoadProgress(loadedBytes: number, totalBytes: number): AssetLoadProgress {
  const fraction = totalBytes > 0 ? Math.min(1, loadedBytes / totalBytes) : 0;
  return { loadedBytes, totalBytes, fraction };
}

/** Counts received bytes. Chunk sizes are never negative, so the count and fraction only grow. */
export function createProgressCounter(totalBytes: number): {
  readonly current: () => AssetLoadProgress;
  readonly add: (chunkBytes: number) => AssetLoadProgress;
} {
  let loadedBytes = 0;
  return {
    current: () => assetLoadProgress(loadedBytes, totalBytes),
    add: (chunkBytes) => {
      loadedBytes += Math.max(0, chunkBytes);
      return assetLoadProgress(loadedBytes, totalBytes);
    },
  };
}

function concatChunks(chunks: readonly Uint8Array[], length: number): ArrayBuffer {
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/**
 * Reads a body chunk by chunk, calling `onChunk` with each chunk's size. Aborting `signal` cancels
 * the stream, which ends a pending read, so the download stops even if the platform's `fetch`
 * does not abort the body itself.
 */
async function readBody(
  response: ResponseLike,
  signal: AbortSignal,
  onChunk: (chunkBytes: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (signal.aborted) throw new Error('aborted');
    onChunk(buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const cancel = () => {
    reader.cancel().catch(() => undefined);
  };
  if (signal.aborted) cancel();
  signal.addEventListener('abort', cancel);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('aborted');
      if (done) break;
      chunks.push(value);
      length += value.byteLength;
      onChunk(value.byteLength);
    }
  } finally {
    signal.removeEventListener('abort', cancel);
  }
  return concatChunks(chunks, length);
}

async function downloadFile(
  doFetch: FetchLike,
  file: AssetFile,
  signal: AbortSignal,
  onChunk: (chunkBytes: number) => void,
): Promise<ArrayBuffer> {
  try {
    const response = await doFetch(file.url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await readBody(response, signal, onChunk);
  } catch (error) {
    throw new Error(`${file.url}: ${describeError(error)}`);
  }
}

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

/** Rejects once `signal` aborts, so a download that ignores the signal cannot hold up the result. */
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new Error('aborted'));
    if (signal.aborted) fail();
    else signal.addEventListener('abort', fail, { once: true });
  });
}

/**
 * Downloads every file of a validated manifest in parallel. The first failure aborts the other
 * downloads and gives `file-unavailable`; no progress is reported after the result settles.
 */
export async function loadAssetFiles(
  manifest: StageManifest,
  options: LoadAssetFilesOptions = {},
): Promise<AssetFilesResult> {
  const { fetch: doFetch = defaultFetch, signal, onProgress } = options;
  if (signal?.aborted) return { ok: false, reason: 'aborted', detail: 'aborted before loading' };

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  const counter = createProgressCounter(totalManifestBytes(manifest));
  let settled = false;
  const report = (progress: AssetLoadProgress) => {
    if (!settled) onProgress?.(progress);
  };

  const files = assetFiles(manifest);
  const download = (file: AssetFile) =>
    downloadFile(doFetch, file, controller.signal, (chunkBytes) => report(counter.add(chunkBytes)));

  try {
    report(counter.current());
    const [playerVrm, playerShadowPalette, hoLangStreet, hoLangClub, duck, drummer] =
      await Promise.race([
        Promise.all([
          download(files.playerVrm),
          download(files.playerShadowPalette),
          download(files.hoLangStreet),
          download(files.hoLangClub),
          download(files.duck),
          download(files.drummer),
        ]),
        whenAborted(controller.signal),
      ]);
    return {
      ok: true,
      files: { playerVrm, playerShadowPalette, hoLangStreet, hoLangClub, duck, drummer },
    };
  } catch (error) {
    if (signal?.aborted) return { ok: false, reason: 'aborted', detail: 'aborted while loading' };
    return { ok: false, reason: 'file-unavailable', detail: describeError(error) };
  } finally {
    settled = true;
    signal?.removeEventListener('abort', abort);
    // Stops the downloads still running after a failure; a no-op once all have finished.
    controller.abort();
  }
}

/**
 * Reads the manifest, then downloads every file it lists. Never throws; any problem is a
 * `MissingAssets` result, the signal for the grey-box fallback (AC-STAGE-001.2, 001.3).
 */
export async function loadStageAssets(
  options: LoadAssetFilesOptions = {},
): Promise<StageAssetsResult> {
  const { fetch: doFetch, signal } = options;
  const manifestResult = await fetchManifest({ fetch: doFetch, signal });
  if (signal?.aborted) return { ok: false, reason: 'aborted', detail: 'aborted while reading the manifest' };
  if (!manifestResult.ok) return manifestResult;

  const { manifest } = manifestResult;
  const filesResult = await loadAssetFiles(manifest, options);
  if (!filesResult.ok) return filesResult;
  return { ok: true, manifest, files: filesResult.files };
}
