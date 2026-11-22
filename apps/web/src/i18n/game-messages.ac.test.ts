import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/** Tester-owned check of AC-DUEL-016.1, written from the spec and design.md, not from the code. */
const SRC = resolve(__dirname, '..');
const REPO = resolve(SRC, '..', '..', '..');
const LOCALES = ['en', 'vi', 'ja'] as const;

function flatten(node: unknown, prefix = ''): Record<string, unknown> {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return { [prefix]: node };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

const game = Object.fromEntries(
  LOCALES.map((l) => {
    const json = JSON.parse(readFileSync(join(__dirname, 'messages', `${l}.json`), 'utf8')) as { game?: unknown };
    return [l, flatten(json.game)];
  }),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>;

// Design table rows: | key | en | vi | ja |
function tableRows(file: string, heading: string): string[][] {
  const text = readFileSync(join(REPO, 'specs', file, 'design.md'), 'utf8');
  const start = text.indexOf(heading);
  const rest = text.slice(start);
  const end = rest.indexOf('\n## ', heading.length);
  return (end === -1 ? rest : rest.slice(0, end))
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length === 4 && !/^(Key|Khóa)$/.test(cells[0]) && !/^-+$/.test(cells[0]));
}
// game-duel table (AC-DUEL-016.1) and game-stage table (AC-STAGE-009.1); no key may sit outside both.
const duelRows = tableRows('game-duel', '## i18n table');
const stageRows = tableRows('game-stage', '## Bảng chữ');
const rows = [...duelRows, ...stageRows];
const stageKeys = new Set(stageRows.map((r) => r[0]));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.includes(`screens${sep}testing`) && !p.includes(`stage${sep}testing`)) out.push(p);
  }
  return out;
}
const uiFiles = (): string[] => [...walk(join(SRC, 'game')), ...walk(join(SRC, 'app', '[locale]', 'game'))];

describe('game messages', () => {
  it('AC-DUEL-016.1: vi and ja have a non-empty string for every key of en', () => {
    const keys = Object.keys(game.en);
    expect(keys.length).toBeGreaterThan(80);
    for (const locale of LOCALES) {
      const bad = keys.filter((k) => typeof game[locale][k] !== 'string' || (game[locale][k] as string).trim() === '');
      expect({ locale, bad }).toEqual({ locale, bad: [] });
    }
  });

  it('AC-DUEL-016.1: vi and ja have no keys that en lacks', () => {
    const keys = Object.keys(game.en).sort();
    expect(Object.keys(game.vi).sort()).toEqual(keys);
    expect(Object.keys(game.ja).sort()).toEqual(keys);
  });

  it('AC-DUEL-016.1: every string matches the i18n table in design.md', () => {
    expect(rows.length).toBeGreaterThan(80);
    expect(stageRows.length).toBe(16);
    const mismatches: string[] = [];
    for (const [key, en, vi, ja] of rows) {
      if (game.en[key] !== en) mismatches.push(`en ${key}`);
      if (game.vi[key] !== vi) mismatches.push(`vi ${key}`);
      if (game.ja[key] !== ja) mismatches.push(`ja ${key}`);
    }
    expect(mismatches).toEqual([]);
    expect(Object.keys(game.en).sort()).toEqual(rows.map((r) => r[0]).sort());
  });

  it('AC-DUEL-016.1: placeholders agree across en, vi and ja', () => {
    const ph = (s: unknown) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(game.en)) {
      expect({ key, vi: ph(game.vi[key]) }).toEqual({ key, vi: ph(game.en[key]) });
      expect({ key, ja: ph(game.ja[key]) }).toEqual({ key, ja: ph(game.en[key]) });
    }
  });

  it('AC-DUEL-016.1: every key the game UI and /game route use exists in all three files', () => {
    const used = new Set<string>();
    const keyPattern =
      /['"]((?:title|home|start|error|unsupported|rotate|difficulty|calibration|hud|round|pause|pad|feedback|lickBook|lick|result|assist|summary|stage)(?:\.[A-Za-z]+)*)['"]/g;
    for (const file of uiFiles()) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes("useTranslations('game')")) continue;
      // A bare group word ('error', 'lick') is a state or prop value, not a message key.
      for (const m of text.matchAll(keyPattern)) if (m[1] === 'title' || m[1].includes('.')) used.add(m[1]);
    }
    // Families built with template strings in the UI.
    for (const d of ['lounge', 'session', 'lateSet']) for (const f of ['name', 'desc']) used.add(`difficulty.${d}.${f}`);
    for (const l of ['duck', 'frog', 'windChime']) used.add(`lick.${l}`);
    for (const r of ['echo', 'answer', 'solo']) used.add(`round.${r}`);
    expect(used.size).toBeGreaterThan(60);
    const missing: string[] = [];
    for (const key of used) {
      for (const locale of LOCALES) {
        const v = game[locale][key];
        if (typeof v !== 'string' || v.trim() === '') missing.push(`${locale}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('AC-DUEL-016.1: no dead strings, every key is referenced by the UI or is a known dynamic family', () => {
    const source = uiFiles().map((f) => readFileSync(f, 'utf8')).join('\n');
    const unused = Object.keys(game.en).filter((key) => {
      if (/^(difficulty\.[A-Za-z]+\.(name|desc)|lick\.[A-Za-z]+|round\.(echo|answer|solo))$/.test(key)) return false;
      return !source.includes(`'${key}'`);
    });
    expect(unused).toEqual([]);
  });

  it('AC-STAGE-009.1: en, vi and ja have a non-empty string for every game.stage key, and the game-duel table test accepts them', () => {
    expect(stageKeys.size).toBe(16);
    for (const key of stageKeys) expect(key.startsWith('stage.')).toBe(true);
    for (const locale of LOCALES) {
      const bad = [...stageKeys].filter((k) => typeof game[locale][k] !== 'string' || (game[locale][k] as string).trim() === '');
      expect({ locale, bad }).toEqual({ locale, bad: [] });
      const actual = Object.keys(game[locale]).filter((k) => k.startsWith('stage.'));
      expect(actual.sort()).toEqual([...stageKeys].sort());
    }
    // Every game.* key belongs to exactly one of the two design tables.
    const known = new Set(rows.map((r) => r[0]));
    expect(Object.keys(game.en).filter((k) => !known.has(k))).toEqual([]);
    expect(duelRows.some((r) => stageKeys.has(r[0]))).toBe(false);
  });
});
