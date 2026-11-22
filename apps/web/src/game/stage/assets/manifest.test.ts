import { fetchManifest, MANIFEST_URL, parseManifest } from './manifest';
import { loadStageAssets } from './loader';
import { createFakeAssetServer, createFakeFetch, validManifestJson } from './testing/fake-asset-server';

/** The manifest with the field at `path` removed. */
function without(path: readonly string[]): Record<string, unknown> {
  const manifest = validManifestJson();
  let parent: Record<string, unknown> = manifest;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  delete parent[path[path.length - 1]];
  return manifest;
}

/** The manifest with the field at `path` set to `value`. */
function withField(path: readonly string[], value: unknown): Record<string, unknown> {
  const manifest = validManifestJson();
  let parent: Record<string, unknown> = manifest;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  parent[path[path.length - 1]] = value;
  return manifest;
}

const REQUIRED_FIELDS: readonly (readonly string[])[] = [
  ['version'],
  ['characters'],
  ['characters', 'player'],
  ['characters', 'player', 'vrm'],
  ['characters', 'player', 'shadowPalette'],
  ['characters', 'player', 'bytes'],
  ['stages'],
  ['stages', 'hoLangStreet'],
  ['stages', 'hoLangStreet', 'glb'],
  ['stages', 'hoLangStreet', 'bytes'],
  ['stages', 'hoLangClub'],
  ['stages', 'hoLangClub', 'glb'],
  ['stages', 'hoLangClub', 'bytes'],
  ['props'],
  ['props', 'duck'],
  ['props', 'duck', 'glb'],
  ['props', 'duck', 'bytes'],
  ['sprites'],
  ['sprites', 'drummer'],
  ['sprites', 'drummer', 'png'],
  ['sprites', 'drummer', 'bytes'],
];

const PATH_FIELDS = REQUIRED_FIELDS.filter((path) =>
  ['vrm', 'shadowPalette', 'glb', 'png'].includes(path[path.length - 1]),
);
const BYTES_FIELDS = REQUIRED_FIELDS.filter((path) => path[path.length - 1] === 'bytes');
const OBJECT_FIELDS = REQUIRED_FIELDS.filter(
  (path) => path.length < 3 && path[0] !== 'version',
);

describe('parseManifest', () => {
  it('AC-STAGE-001.3: accepts the manifest of assets.md and keeps every path and byte count', () => {
    const result = parseManifest(validManifestJson());

    expect(result).toEqual({ ok: true, manifest: validManifestJson() });
  });

  it('AC-STAGE-001.3: ignores unknown extra fields and leaves them out of the result', () => {
    const raw = withField(['stages', 'river'], { glb: 'stages/river.glb', bytes: 10 });
    raw.notes = 'extra';

    const result = parseManifest(raw);

    expect(result).toEqual({ ok: true, manifest: validManifestJson() });
  });

  it.each(REQUIRED_FIELDS.map((path) => [path.join('.'), path] as const))(
    'AC-STAGE-001.3: a manifest without %s counts as missing assets',
    (_name, path) => {
      const result = parseManifest(without(path));

      expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.any(String) });
    },
  );

  it.each([2, 0, '1', 1.5, null, true])(
    'AC-STAGE-001.3: version %p counts as missing assets; only the number 1 is read',
    (version) => {
      const result = parseManifest(withField(['version'], version));

      expect(result).toEqual({
        ok: false,
        reason: 'manifest-invalid',
        detail: expect.stringContaining('version'),
      });
    },
  );

  it.each(
    PATH_FIELDS.flatMap((path) =>
      ['', '   ', 42, null, ['a.glb'], {}].map((value) => [path.join('.'), value, path] as const),
    ),
  )('AC-STAGE-001.3: path %s set to %p counts as missing assets', (name, value, path) => {
    const result = parseManifest(withField(path, value));

    expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.stringContaining(name) });
  });

  it.each(
    BYTES_FIELDS.flatMap((path) =>
      [-1, 1.5, '300', null, Number.NaN, Number.POSITIVE_INFINITY].map(
        (value) => [path.join('.'), value, path] as const,
      ),
    ),
  )('AC-STAGE-001.3: %s set to %p counts as missing assets', (name, value, path) => {
    const result = parseManifest(withField(path, value));

    expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.stringContaining(name) });
  });

  it.each(
    OBJECT_FIELDS.flatMap((path) =>
      ['characters/player.vrm', 7, null, []].map((value) => [path.join('.'), value, path] as const),
    ),
  )('AC-STAGE-001.3: %s set to %p instead of an object counts as missing assets', (name, value, path) => {
    const result = parseManifest(withField(path, value));

    expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.stringContaining(name) });
  });

  it.each([null, undefined, 1, 'manifest', [], [validManifestJson()]])(
    'AC-STAGE-001.3: %p instead of a JSON object counts as missing assets',
    (raw) => {
      expect(parseManifest(raw)).toEqual({
        ok: false,
        reason: 'manifest-invalid',
        detail: expect.any(String),
      });
    },
  );
});

describe('fetchManifest', () => {
  it('reads /game-assets/manifest.json and validates it', async () => {
    const server = createFakeAssetServer();

    const result = await fetchManifest({ fetch: server.fetch });

    expect(server.requests).toEqual([MANIFEST_URL]);
    expect(MANIFEST_URL).toBe('/game-assets/manifest.json');
    expect(result).toEqual({ ok: true, manifest: validManifestJson() });
  });

  it('AC-STAGE-001.3: a served manifest with the wrong version counts as missing assets', async () => {
    const server = createFakeAssetServer({ manifest: withField(['version'], 2) });

    const result = await fetchManifest({ fetch: server.fetch });

    expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.stringContaining('version') });
  });

  it.each([
    ['no manifest (404)', { kind: 'status', status: 404 }],
    ['a server error', { kind: 'status', status: 500 }],
    ['a network error', { kind: 'network-error' }],
    ['a body that is not JSON', { kind: 'text', text: '{"version": 1,' }],
  ] as const)('gives manifest-unavailable for %s, without throwing', async (_name, route) => {
    const fake = createFakeFetch({ [MANIFEST_URL]: route });

    const result = await fetchManifest({ fetch: fake.fetch });

    expect(result).toEqual({ ok: false, reason: 'manifest-unavailable', detail: expect.stringContaining(MANIFEST_URL) });
  });
});

describe('loadStageAssets with a manifest that breaks the contract', () => {
  it.each([
    ['without characters.player.shadowPalette', without(['characters', 'player', 'shadowPalette'])],
    ['without stages.hoLangClub.bytes', without(['stages', 'hoLangClub', 'bytes'])],
    ['with version 2', withField(['version'], 2)],
  ])(
    'AC-STAGE-001.3: a manifest %s gives the same missing-assets result as a failed file, and no file is fetched',
    async (_name, manifest) => {
      const server = createFakeAssetServer({ manifest });
      const onProgress = jest.fn();

      const result = await loadStageAssets({ fetch: server.fetch, onProgress });

      expect(result).toEqual({ ok: false, reason: 'manifest-invalid', detail: expect.any(String) });
      expect(server.requests).toEqual([MANIFEST_URL]);
      expect(onProgress).not.toHaveBeenCalled();
    },
  );
});
