import { loadStageAssets, type AssetLoadProgress, type FetchLike } from './index';

const manifest = {
  version: 1,
  characters: { player: { vrm: 'c/p.vrm', shadowPalette: 'c/s.png', bytes: 10 } },
  stages: {
    hoLangStreet: { glb: 's/a.glb', bytes: 20 },
    hoLangClub: { glb: 's/b.glb', bytes: 30 },
  },
  props: { duck: { glb: 'p/d.glb', bytes: 5 } },
  sprites: { drummer: { png: 'sp/d.png', bytes: 5 } },
};

const FILE_SIZE = 7;

function stream(size: number, chunk: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(c) {
      if (sent >= size) {
        c.close();
        return;
      }
      const n = Math.min(chunk, size - sent);
      sent += n;
      c.enqueue(new Uint8Array(n));
    },
  });
}

const empty = async () => new ArrayBuffer(0);

function makeFetch(m: unknown, failUrl?: string): FetchLike {
  return async (url) => {
    if (url.endsWith('manifest.json')) {
      if (m === null) return { ok: false, status: 404, body: null, arrayBuffer: empty, json: async () => ({}) };
      return { ok: true, status: 200, body: null, arrayBuffer: empty, json: async () => m };
    }
    if (failUrl && url.endsWith(failUrl)) {
      return { ok: false, status: 500, body: null, arrayBuffer: empty, json: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      body: stream(FILE_SIZE, 3),
      arrayBuffer: async () => new ArrayBuffer(FILE_SIZE),
      json: async () => ({}),
    };
  };
}

describe('T-018 spec-level checks', () => {
  it('AC-STAGE-001.4: progress is real bytes over the manifest total and never decreases', async () => {
    const seen: AssetLoadProgress[] = [];
    const r = await loadStageAssets({ fetch: makeFetch(manifest), onProgress: (p) => seen.push(p) });
    expect(r.ok).toBe(true);
    expect(seen[0].loadedBytes).toBe(0);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].loadedBytes).toBeGreaterThanOrEqual(seen[i - 1].loadedBytes);
      expect(seen[i].fraction).toBeGreaterThanOrEqual(seen[i - 1].fraction);
    }
    const last = seen[seen.length - 1];
    expect(last.totalBytes).toBe(70);
    expect(last.loadedBytes).toBe(FILE_SIZE * 6);
  });

  it.each([
    ['version 2', { ...manifest, version: 2 }],
    ['version missing', { ...manifest, version: undefined }],
    ['no stages', { ...manifest, stages: undefined }],
    ['no duck path', { ...manifest, props: { duck: { bytes: 1 } } }],
    ['an array', []],
  ])('AC-STAGE-001.3: manifest with %s gives a missing-assets result, no throw', async (_n, m) => {
    const r = await loadStageAssets({ fetch: makeFetch(m) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('manifest-invalid');
  });

  it('loader: a manifest that answers 404 gives a missing-assets result, no throw', async () => {
    const r = await loadStageAssets({ fetch: makeFetch(null) });
    expect(r.ok).toBe(false);
  });

  it('loader: a failing file gives a missing-assets result instead of throwing', async () => {
    const r = await loadStageAssets({ fetch: makeFetch(manifest, 's/b.glb') });
    expect(r.ok).toBe(false);
  });
});
