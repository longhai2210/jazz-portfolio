/**
 * A fake `/game-assets/` server for tests: a `FetchLike` that answers from a table of routes,
 * with streamed bodies cut into chunks of known sizes. Jest has no asset folder, so every stage
 * test runs against this fake. File contents are placeholder bytes, never real assets.
 */
import type { FetchInitLike, FetchLike, ResponseLike } from '../types';

/** Placeholder file contents: byte `i` is `i % 251`, so a reassembled file can be checked. */
export function fakeFileBytes(length: number, offset = 0): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (offset + i) % 251;
  return bytes;
}

/** Byte sizes of the test manifest's files. The player entry counts both of its files. */
export const FAKE_FILE_SIZES = {
  playerVrm: 250,
  playerShadowPalette: 50,
  hoLangStreet: 400,
  hoLangClub: 200,
  duck: 60,
  drummer: 40,
} as const;

/** The sum of the test manifest's `bytes` fields. */
export const FAKE_TOTAL_BYTES = 1000;

/** A valid manifest as raw JSON, fresh on every call so a test may break one field of it. */
export function validManifestJson(): Record<string, unknown> {
  return {
    version: 1,
    characters: {
      player: {
        vrm: 'characters/player.vrm',
        shadowPalette: 'characters/player_shadow.png',
        bytes: FAKE_FILE_SIZES.playerVrm + FAKE_FILE_SIZES.playerShadowPalette,
      },
    },
    stages: {
      hoLangStreet: { glb: 'stages/ho-lang-street.glb', bytes: FAKE_FILE_SIZES.hoLangStreet },
      hoLangClub: { glb: 'stages/ho-lang-club.glb', bytes: FAKE_FILE_SIZES.hoLangClub },
    },
    props: { duck: { glb: 'props/duck.glb', bytes: FAKE_FILE_SIZES.duck } },
    sprites: { drummer: { png: 'sprites/drummer.png', bytes: FAKE_FILE_SIZES.drummer } },
  };
}

/** The URL of every file in `validManifestJson()`, by file id. */
export const FAKE_FILE_URLS = {
  playerVrm: '/game-assets/characters/player.vrm',
  playerShadowPalette: '/game-assets/characters/player_shadow.png',
  hoLangStreet: '/game-assets/stages/ho-lang-street.glb',
  hoLangClub: '/game-assets/stages/ho-lang-club.glb',
  duck: '/game-assets/props/duck.glb',
  drummer: '/game-assets/sprites/drummer.png',
} as const;

export type FakeRoute =
  /** A JSON body (the manifest). */
  | { readonly kind: 'json'; readonly value: unknown }
  /** A body that is not valid JSON. */
  | { readonly kind: 'text'; readonly text: string }
  /** A file streamed in chunks of these sizes; the stream errors after `failAfter` chunks if set. */
  | {
      readonly kind: 'file';
      readonly chunks: readonly number[];
      readonly failAfter?: number;
      /** False gives `body: null`, as on a platform without streamed bodies. */
      readonly streamed?: boolean;
    }
  /** A body the test drives itself, for example from `createManualStream`. */
  | { readonly kind: 'stream'; readonly stream: ReadableStream<Uint8Array> }
  /** An HTTP error with an empty body. */
  | { readonly kind: 'status'; readonly status: number }
  /** `fetch` rejects, as on a network error. */
  | { readonly kind: 'network-error' };

function abortError(): Error {
  return new Error('The operation was aborted');
}

function chunkedStream(
  sizes: readonly number[],
  failAfter: number | undefined,
  signal: AbortSignal | undefined,
): ReadableStream<Uint8Array> {
  let index = 0;
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal?.aborted) {
        controller.error(abortError());
        return;
      }
      if (failAfter !== undefined && index === failAfter) {
        controller.error(new Error('connection reset'));
        return;
      }
      if (index === sizes.length) {
        controller.close();
        return;
      }
      const size = sizes[index];
      controller.enqueue(fakeFileBytes(size, offset));
      index += 1;
      offset += size;
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

function respond(route: FakeRoute, init: FetchInitLike | undefined): ResponseLike {
  const signal = init?.signal;
  switch (route.kind) {
    case 'json':
    case 'text': {
      const text = route.kind === 'json' ? JSON.stringify(route.value) : route.text;
      return {
        ok: true,
        status: 200,
        body: null,
        arrayBuffer: async () => new TextEncoder().encode(text).buffer,
        json: async () => JSON.parse(text) as unknown,
      };
    }
    case 'file': {
      const body = chunkedStream(route.chunks, route.failAfter, signal);
      return {
        ok: true,
        status: 200,
        body: route.streamed === false ? null : body,
        arrayBuffer: async () => (await readAll(body)).buffer,
        json: async () => JSON.parse(new TextDecoder().decode(await readAll(body))) as unknown,
      };
    }
    case 'stream':
      return {
        ok: true,
        status: 200,
        body: route.stream,
        arrayBuffer: async () => (await readAll(route.stream)).buffer,
        json: async () => JSON.parse(new TextDecoder().decode(await readAll(route.stream))) as unknown,
      };
    case 'status':
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        body: null,
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      };
    case 'network-error':
      throw new TypeError('Failed to fetch');
  }
}

export interface FakeAssetServer {
  readonly fetch: FetchLike;
  /** Every URL requested, in order. */
  readonly requests: readonly string[];
}

/** A fetch that answers from `routes`; any other URL is a 404. */
export function createFakeFetch(routes: Readonly<Record<string, FakeRoute>>): FakeAssetServer {
  const requests: string[] = [];
  const fakeFetch: FetchLike = async (url, init) => {
    requests.push(url);
    if (init?.signal?.aborted) throw abortError();
    return respond(routes[url] ?? { kind: 'status', status: 404 }, init);
  };
  return { fetch: fakeFetch, requests };
}

export interface FakeAssetServerOptions {
  /** The manifest to serve; defaults to `validManifestJson()`. */
  readonly manifest?: unknown;
  /** Each file is cut into chunks of at most this many bytes. Defaults to 64. */
  readonly chunkSize?: number;
  /** Routes that replace or add to the defaults, by URL. */
  readonly routes?: Readonly<Record<string, FakeRoute>>;
}

function chunkSizes(total: number, chunkSize: number): number[] {
  const sizes: number[] = [];
  for (let left = total; left > 0; left -= chunkSize) sizes.push(Math.min(chunkSize, left));
  return sizes;
}

/** A complete asset folder: the test manifest and every file it lists, streamed in chunks. */
export function createFakeAssetServer(options: FakeAssetServerOptions = {}): FakeAssetServer {
  const { manifest = validManifestJson(), chunkSize = 64, routes = {} } = options;
  const files: Record<string, FakeRoute> = {};
  for (const id of Object.keys(FAKE_FILE_URLS) as (keyof typeof FAKE_FILE_URLS)[]) {
    files[FAKE_FILE_URLS[id]] = { kind: 'file', chunks: chunkSizes(FAKE_FILE_SIZES[id], chunkSize) };
  }
  return createFakeFetch({
    '/game-assets/manifest.json': { kind: 'json', value: manifest },
    ...files,
    ...routes,
  });
}

/**
 * A stream the test feeds by hand, to check progress before, between and after chunks. Once the
 * reader cancels it (the loader does on abort or failure), `cancelled` is true and pushes are
 * ignored.
 */
export function createManualStream(): {
  readonly stream: ReadableStream<Uint8Array>;
  readonly push: (bytes: number) => void;
  readonly close: () => void;
  readonly fail: (error: Error) => void;
  readonly cancelled: () => boolean;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let cancelled = false;
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      cancelled = true;
    },
  });
  const get = (): ReadableStreamDefaultController<Uint8Array> | null => {
    if (!controller) throw new Error('the stream has not started');
    return cancelled ? null : controller;
  };
  return {
    stream,
    push: (bytes) => {
      get()?.enqueue(fakeFileBytes(bytes, offset));
      offset += bytes;
    },
    close: () => get()?.close(),
    fail: (error) => get()?.error(error),
    cancelled: () => cancelled,
  };
}
