import * as fc from 'fast-check';
import {
  assetFiles,
  assetLoadProgress,
  createProgressCounter,
  loadAssetFiles,
  loadStageAssets,
  totalManifestBytes,
  type AssetFileId,
  type AssetLoadProgress,
} from './loader';
import { parseManifest, type StageManifest } from './manifest';
import {
  createFakeAssetServer,
  createManualStream,
  FAKE_FILE_SIZES,
  FAKE_FILE_URLS,
  FAKE_TOTAL_BYTES,
  fakeFileBytes,
  validManifestJson,
} from './testing/fake-asset-server';

const FILE_IDS = Object.keys(FAKE_FILE_URLS) as AssetFileId[];

/** Lets pending promise callbacks and stream pulls run. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function manifestFrom(raw: unknown): StageManifest {
  const result = parseManifest(raw);
  if (!result.ok) throw new Error(`test manifest is invalid: ${result.detail}`);
  return result.manifest;
}

function recordProgress(): { readonly events: AssetLoadProgress[]; readonly onProgress: (p: AssetLoadProgress) => void } {
  const events: AssetLoadProgress[] = [];
  return { events, onProgress: (progress) => events.push(progress) };
}

function expectNeverDecreases(events: readonly AssetLoadProgress[]): void {
  for (let i = 1; i < events.length; i++) {
    expect(events[i].loadedBytes).toBeGreaterThanOrEqual(events[i - 1].loadedBytes);
    expect(events[i].fraction).toBeGreaterThanOrEqual(events[i - 1].fraction);
  }
}

describe('the files a manifest lists', () => {
  it('lists six files under /game-assets/, including the shadow palette', () => {
    const files = assetFiles(manifestFrom(validManifestJson()));

    expect(Object.fromEntries(FILE_IDS.map((id) => [id, files[id].url]))).toEqual(FAKE_FILE_URLS);
  });

  it('AC-STAGE-001.4: the progress total is the sum of the manifest bytes fields', () => {
    expect(totalManifestBytes(manifestFrom(validManifestJson()))).toBe(FAKE_TOTAL_BYTES);
  });
});

describe('progress in bytes', () => {
  it('AC-STAGE-001.4: the fraction is loaded bytes over total bytes, capped at 1', () => {
    expect(assetLoadProgress(0, 1000)).toEqual({ loadedBytes: 0, totalBytes: 1000, fraction: 0 });
    expect(assetLoadProgress(250, 1000)).toEqual({ loadedBytes: 250, totalBytes: 1000, fraction: 0.25 });
    expect(assetLoadProgress(1000, 1000)).toEqual({ loadedBytes: 1000, totalBytes: 1000, fraction: 1 });
    expect(assetLoadProgress(1200, 1000)).toEqual({ loadedBytes: 1200, totalBytes: 1000, fraction: 1 });
  });

  it('AC-STAGE-001.4: a manifest total of 0 reports a fraction of 0, never NaN or Infinity', () => {
    expect(assetLoadProgress(0, 0).fraction).toBe(0);
    expect(assetLoadProgress(500, 0).fraction).toBe(0);
  });

  it('AC-STAGE-001.4: for any chunk sizes and total, the fraction equals received over total and never decreases', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50_000_000 }),
        fc.array(fc.nat({ max: 1_000_000 }), { maxLength: 60 }),
        (totalBytes, chunks) => {
          const counter = createProgressCounter(totalBytes);
          let received = 0;
          let previous = counter.current();
          if (previous.loadedBytes !== 0 || previous.fraction !== 0) return false;
          for (const chunk of chunks) {
            received += chunk;
            const next = counter.add(chunk);
            const expected = totalBytes > 0 ? Math.min(1, received / totalBytes) : 0;
            if (next.loadedBytes !== received || next.totalBytes !== totalBytes) return false;
            if (next.fraction !== expected || next.fraction < previous.fraction) return false;
            if (next.fraction < 0 || next.fraction > 1) return false;
            previous = next;
          }
          return true;
        },
      ),
    );
  });
});

describe('loadStageAssets', () => {
  it('AC-STAGE-001.4: reports progress after every chunk read, as received bytes over the manifest total', async () => {
    const server = createFakeAssetServer({ chunkSize: 64 });
    const { events, onProgress } = recordProgress();

    const result = await loadStageAssets({ fetch: server.fetch, onProgress });

    expect(result.ok).toBe(true);
    // 250, 50, 400, 200, 60 and 40 bytes in chunks of at most 64: 4 + 1 + 7 + 4 + 1 + 1 chunks.
    expect(events).toHaveLength(1 + 18);
    expect(events[0]).toEqual({ loadedBytes: 0, totalBytes: FAKE_TOTAL_BYTES, fraction: 0 });
    for (let i = 1; i < events.length; i++) {
      const step = events[i].loadedBytes - events[i - 1].loadedBytes;
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(64);
      expect(events[i].totalBytes).toBe(FAKE_TOTAL_BYTES);
      expect(events[i].fraction).toBe(events[i].loadedBytes / FAKE_TOTAL_BYTES);
    }
    expect(events[events.length - 1]).toEqual({
      loadedBytes: FAKE_TOTAL_BYTES,
      totalBytes: FAKE_TOTAL_BYTES,
      fraction: 1,
    });
  });

  it('AC-STAGE-001.4: progress moves only when bytes arrive, by exactly the bytes received', async () => {
    const streams = Object.fromEntries(FILE_IDS.map((id) => [id, createManualStream()])) as Record<
      AssetFileId,
      ReturnType<typeof createManualStream>
    >;
    const server = createFakeAssetServer({
      routes: Object.fromEntries(
        FILE_IDS.map((id) => [FAKE_FILE_URLS[id], { kind: 'stream', stream: streams[id].stream }] as const),
      ),
    });
    const { events, onProgress } = recordProgress();

    const pending = loadStageAssets({ fetch: server.fetch, onProgress });
    await flush();
    await flush();
    expect(events).toEqual([{ loadedBytes: 0, totalBytes: 1000, fraction: 0 }]);

    streams.hoLangStreet.push(100);
    await flush();
    expect(events[events.length - 1]).toEqual({ loadedBytes: 100, totalBytes: 1000, fraction: 0.1 });

    streams.playerVrm.push(150);
    await flush();
    expect(events[events.length - 1]).toEqual({ loadedBytes: 250, totalBytes: 1000, fraction: 0.25 });

    const countBeforeWait = events.length;
    await flush();
    await flush();
    expect(events).toHaveLength(countBeforeWait);

    streams.hoLangStreet.push(300);
    streams.playerVrm.push(100);
    streams.playerShadowPalette.push(50);
    streams.hoLangClub.push(200);
    streams.duck.push(60);
    streams.drummer.push(40);
    for (const id of FILE_IDS) streams[id].close();
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(events[events.length - 1]).toEqual({ loadedBytes: 1000, totalBytes: 1000, fraction: 1 });
    expectNeverDecreases(events);
  });

  it('AC-STAGE-001.4: returns every file whole, byte for byte, with the parsed manifest', async () => {
    const server = createFakeAssetServer({ chunkSize: 17 });

    const result = await loadStageAssets({ fetch: server.fetch });

    if (!result.ok) throw new Error(`expected the assets to load: ${result.detail}`);
    expect(result.manifest).toEqual(validManifestJson());
    for (const id of FILE_IDS) {
      expect(new Uint8Array(result.files[id])).toEqual(fakeFileBytes(FAKE_FILE_SIZES[id]));
    }
  });

  it('AC-STAGE-001.4: a file larger than the manifest says keeps the fraction capped at 1, never decreasing', async () => {
    const raw = validManifestJson();
    const manifest = manifestFrom(raw);
    const understated = { ...manifest, props: { duck: { ...manifest.props.duck, bytes: 10 } } };
    const server = createFakeAssetServer({ manifest: understated, chunkSize: 32 });
    const { events, onProgress } = recordProgress();

    const result = await loadStageAssets({ fetch: server.fetch, onProgress });

    expect(result.ok).toBe(true);
    expect(events[0].totalBytes).toBe(950);
    expectNeverDecreases(events);
    expect(Math.max(...events.map((event) => event.fraction))).toBe(1);
    expect(events[events.length - 1]).toEqual({ loadedBytes: 1000, totalBytes: 950, fraction: 1 });
  });

  it('AC-STAGE-001.4: a manifest that overstates sizes never reports more than the bytes received', async () => {
    const manifest = manifestFrom(validManifestJson());
    const overstated = { ...manifest, stages: { ...manifest.stages, hoLangStreet: { ...manifest.stages.hoLangStreet, bytes: 1400 } } };
    const server = createFakeAssetServer({ manifest: overstated });
    const { events, onProgress } = recordProgress();

    const result = await loadStageAssets({ fetch: server.fetch, onProgress });

    expect(result.ok).toBe(true);
    expect(events[events.length - 1]).toEqual({ loadedBytes: 1000, totalBytes: 2000, fraction: 0.5 });
  });

  it('AC-STAGE-001.4: a body that does not stream is counted in full once it arrives', async () => {
    const server = createFakeAssetServer({
      chunkSize: 1000,
      routes: { [FAKE_FILE_URLS.hoLangStreet]: { kind: 'file', chunks: [150, 250], streamed: false } },
    });
    const { events, onProgress } = recordProgress();

    const result = await loadStageAssets({ fetch: server.fetch, onProgress });

    expect(result.ok).toBe(true);
    const steps = events.slice(1).map((event, i) => event.loadedBytes - events[i].loadedBytes);
    expect(steps.sort((a, b) => a - b)).toEqual([40, 50, 60, 200, 250, 400]);
    expect(events[events.length - 1].loadedBytes).toBe(1000);
  });
});

describe('a file that fails', () => {
  it.each([
    ['answers 404', { kind: 'status', status: 404 }],
    ['answers 500', { kind: 'status', status: 500 }],
    ['fails on the network', { kind: 'network-error' }],
    ['breaks off mid-stream', { kind: 'file', chunks: [64, 64, 64, 64, 64, 80], failAfter: 2 }],
  ] as const)('gives file-unavailable without throwing when one file %s', async (_name, route) => {
    const server = createFakeAssetServer({ routes: { [FAKE_FILE_URLS.hoLangStreet]: route } });

    const result = await loadStageAssets({ fetch: server.fetch });

    expect(result).toEqual({
      ok: false,
      reason: 'file-unavailable',
      detail: expect.stringContaining(FAKE_FILE_URLS.hoLangStreet),
    });
  });

  it('cancels the other downloads and stops reporting progress once a failure settles the result', async () => {
    const vrm = createManualStream();
    const server = createFakeAssetServer({
      routes: {
        [FAKE_FILE_URLS.playerVrm]: { kind: 'stream', stream: vrm.stream },
        [FAKE_FILE_URLS.duck]: { kind: 'status', status: 404 },
      },
    });
    const { events, onProgress } = recordProgress();

    const result = await loadStageAssets({ fetch: server.fetch, onProgress });
    const countAtResult = events.length;
    vrm.push(100);
    await flush();

    expect(result).toEqual({
      ok: false,
      reason: 'file-unavailable',
      detail: expect.stringContaining(FAKE_FILE_URLS.duck),
    });
    expect(vrm.cancelled()).toBe(true);
    expect(events).toHaveLength(countAtResult);
  });
});

describe('aborting', () => {
  it('gives aborted, cancels the downloads and reports no more progress when the signal aborts mid-download', async () => {
    const vrm = createManualStream();
    const server = createFakeAssetServer({
      routes: { [FAKE_FILE_URLS.playerVrm]: { kind: 'stream', stream: vrm.stream } },
    });
    const controller = new AbortController();
    const { events, onProgress } = recordProgress();

    const pending = loadStageAssets({ fetch: server.fetch, signal: controller.signal, onProgress });
    await flush();
    vrm.push(10);
    await flush();
    controller.abort();
    const result = await pending;
    const countAtResult = events.length;
    vrm.push(10);
    await flush();

    expect(result).toEqual({ ok: false, reason: 'aborted', detail: expect.any(String) });
    expect(vrm.cancelled()).toBe(true);
    expect(events[countAtResult - 1].loadedBytes).toBe(FAKE_TOTAL_BYTES - FAKE_FILE_SIZES.playerVrm + 10);
    expect(events).toHaveLength(countAtResult);
  });

  it('gives aborted without fetching when the signal has already aborted', async () => {
    const server = createFakeAssetServer();
    const controller = new AbortController();
    controller.abort();

    const result = await loadStageAssets({ fetch: server.fetch, signal: controller.signal });

    expect(result).toEqual({ ok: false, reason: 'aborted', detail: expect.any(String) });
  });

  it('loadAssetFiles gives aborted before any request when the signal has already aborted', async () => {
    const server = createFakeAssetServer();
    const controller = new AbortController();
    controller.abort();

    const result = await loadAssetFiles(manifestFrom(validManifestJson()), {
      fetch: server.fetch,
      signal: controller.signal,
    });

    expect(result).toEqual({ ok: false, reason: 'aborted', detail: expect.any(String) });
    expect(server.requests).toEqual([]);
  });
});
