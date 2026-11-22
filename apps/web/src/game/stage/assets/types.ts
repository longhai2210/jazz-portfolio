/**
 * Types shared by the stage asset manifest and loader.
 *
 * The `*Like` interfaces list only the parts of `fetch` and `Response` the loader uses. The real
 * `fetch` satisfies them structurally, and so does the test fake in `testing/`, so tests pass a
 * fake in instead of patching the global.
 */

/** The parts of a `Response` the loader reads. */
export interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  /** The streamed body. Null when the platform does not stream, then `arrayBuffer()` is used. */
  readonly body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
}

export interface FetchInitLike {
  readonly signal?: AbortSignal;
}

/** `fetch` as the loader calls it: a URL and, optionally, an abort signal. */
export type FetchLike = (url: string, init?: FetchInitLike) => Promise<ResponseLike>;

/**
 * Why the 3D stage cannot run. Every reason leads to the same fallback, the grey-box duel
 * (AC-STAGE-001.2); the reason and `detail` are for the console, not for the player.
 *
 * - `manifest-unavailable`: no manifest, an HTTP error, a network error or JSON that does not parse.
 * - `manifest-invalid`: a required field is missing or has the wrong type, or `version` is not 1.
 * - `file-unavailable`: a file listed in the manifest failed (HTTP error, network or stream error).
 * - `aborted`: the caller's signal aborted the load, for example because the page unmounted.
 */
export type MissingAssetsReason =
  | 'manifest-unavailable'
  | 'manifest-invalid'
  | 'file-unavailable'
  | 'aborted';

export interface MissingAssets<R extends MissingAssetsReason = MissingAssetsReason> {
  readonly ok: false;
  readonly reason: R;
  readonly detail: string;
}
