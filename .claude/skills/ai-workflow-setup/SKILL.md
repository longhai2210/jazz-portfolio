---
name: ai-workflow-setup
description: Installer behind /ai-workflow init. Detects the stack and scaffolds CLAUDE.md, a verify script and test setup, spec templates, role subagents and skills, hooks, the graph and trace scripts, and CI gates into the current repo on a branch.
user-invocable: false
---
# Set up the AI workflow in this repository

Work on a branch, change nothing outside this list, and end with a short report. The user runs `/understand` (the knowledge graph) themselves; never run it.

## Phase 0: Preconditions
1. Must be a git repo with a clean working tree. If not clean, ask the user to commit or stash, then stop.
2. `git switch -c chore/ai-workflow`.
3. Note whether `.ua/knowledge-graph.json` (or `.understand-anything/`) exists. If not, continue: the workflow runs without it, and the report mentions /understand as optional.

## Phase 1: Detect (read files, don't guess)
Collect, from package.json, lockfiles, config files and the folder tree (two levels of `src/`):
- Package manager: `package-lock.json` npm, `pnpm-lock.yaml` pnpm, `yarn.lock` yarn, none (lockfile missing).
- Framework and build: Vite, Next.js, Create React App (`react-scripts`), Remix, other. Dev command and port.
- TypeScript: `tsconfig.json`; whether it uses project `references`.
- Lint and format: ESLint config, Prettier config, existing `lint` script.
- Tests: Vitest, Jest, `react-scripts test`, Testing Library, Playwright, Cypress, MSW. Existing test files count.
- App shape: router, state (Redux, Zustand, React Query…), UI library and design tokens location, i18n library and locale files, API client location, env var prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`).
- Repo: existing CLAUDE.md or AGENTS.md, `.github/workflows`, GitHub remote and whether `gh auth status` works, `.nvmrc`.
If a graph exists, write `scripts/kg.mjs` first (Phase 4 file) and use `node scripts/kg.mjs find` / `show` on the entry points to describe the architecture accurately.

## Phase 2: Confirm once
Show the user what you detected and these decisions with your default, in one message, and wait for the answer:
1. Task tracker: GitHub Issues (default when the remote is GitHub and `gh` works) or `tasks/*.md` files.
2. Install missing unit-test tooling now (default yes): Vitest + Testing Library for Vite, or the existing Jest / react-scripts setup.
3. Add Playwright end-to-end tests now (default no; can be added later).
4. Can written specs be committed to this repo (default yes)? If not, specs go in a private repo added as a submodule at `specs/`.

## Phase 3: Verify command and tests
Add or fix these `package.json` scripts, keeping any that already work:
- `lint`: existing, else `eslint .` if ESLint is configured.
- `typecheck`: `tsc -b` when tsconfig uses `references` (each referenced config must have `noEmit`), else `tsc --noEmit`. Skip without TypeScript.
- `test:ci`: Vitest `vitest run`; Jest `jest --ci`; CRA `react-scripts test --watchAll=false` (run with `CI=true`).
- `build`: existing.
- `verify`: `<pm> run lint && <pm> run typecheck && <pm> run test:ci && <pm> run build` (drop parts that don't exist).
- With Playwright: `e2e`: `playwright test`.

If unit-test tooling is missing and the user agreed:
- Vite: install dev deps `vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`, write `vitest.config.ts` and `src/test/setup.ts` (files below).
- CRA: nothing to install; `src/setupTests.ts` imports `@testing-library/jest-dom`.
- Next.js: Vitest the same way as Vite, with `@vitejs/plugin-react` in `vitest.config.ts`.
Write one smoke test `src/test/smoke.test.tsx` that renders a real leaf component (or App with the project's providers) and asserts something visible.
With Playwright: install `@playwright/test`, run `npx playwright install chromium`, write `playwright.config.ts` with `webServer` set to the dev command and port, and `e2e/smoke.spec.ts` that opens `/` and checks the page title or a heading.
Create `.nvmrc` with the current Node major version if missing. If no lockfile exists, run the install once so one is created.

## Phase 4: Write the files
Write every file in the **Files** section below, exactly as given, then adapt only what the notes say:
- Package manager other than npm: change `npm ci`, `cache: npm` and `npm run verify` in the workflow and settings (pnpm needs `pnpm/action-setup` before setup-node; yarn uses `yarn install --immutable`).
- Merge `.claude/settings.json` into an existing one instead of overwriting: union the permission lists and hook arrays.
- Existing CLAUDE.md: keep its content and add the missing sections. Fill every `<...>` from Phase 1; delete lines that don't apply. Keep it under about 150 lines.
- Task tracker `files`: create `tasks/` and skip `.github/ISSUE_TEMPLATE/task.yml`.
- `.gitignore`: the graph is a local, per-developer cache and is never committed. Add `.ua/*`, `!.ua/.understandignore`, `.understand-anything/*` and `!.understand-anything/.understandignore` (replace a plain `.ua/` line, which would block the negation), so only the ignore file is shared. Make sure `CLAUDE.md`, `specs/`, `.claude/agents/`, `.claude/skills/` are not. If `.env` is tracked, tell the user about `git update-index --skip-worktree .env`.
- If `.ua/.understandignore` exists, suggest (don't apply) adding `specs/`, `docs/`, `dist/`, `build/`, `coverage/`, `public/locales/`, `e2e/fixtures/`; test files stay in the graph.
- Run `chmod +x scripts/*.mjs .claude/hooks/*.mjs`.

## Phase 5: Validate
1. `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`.
2. `<pm> run verify`. If it fails because of problems that existed before (lint errors, type errors), do not mass-fix them: record the count and the top files as a baseline in the report, and ask whether to fix them in a separate task.
3. `node scripts/trace.mjs --check --quiet` (passes with no specs).
4. `node scripts/kg.mjs status` if a graph exists.
5. With Playwright: `<pm> run e2e` once.

## Phase 6: Commit
`git add` exactly the files you created or changed, and commit as `chore: scaffold AI workflow`. Ask before pushing or opening a PR.

## Phase 7: Report (under 20 lines)
What was detected, files created, the verify result and any baseline issues, what the user must do (optionally run /understand for faster context, review and merge the branch, enable branch protection that requires the `ai-gates` check), and the next command: `/ai-workflow spec <feature> "<request>"`.

## CLAUDE.md template
~~~~markdown
# <Project name>: <one sentence on what it does and for whom>

## Stack
<framework + build tool>, <language>, <state>, <router>, <UI library>, <i18n>, <API client>

## Commands
- Install: <pm> ci (or the pnpm/yarn equivalent)
- Dev server: <pm> run dev (http://localhost:<port>)
- Verify everything: <pm> run verify   (lint, types, tests, build; MUST be green before reporting done)
- Unit tests: <pm> run test:ci
- E2E: <pm> run e2e   (if present)

## Architecture: how a user action flows
<e.g. Page -> hook -> React Query -> api/client.ts -> REST API>
- Pages/routes: <path>   Shared components: <path>   Design tokens: <path>
- API client: <path>   State: <path>   i18n files: <paths>

## Conventions (the 5 to 10 that matter most)
- <e.g. data fetching only through hooks in src/api/, never fetch in components>
- <e.g. every user-visible string through t(); add keys to every locale file>
- <e.g. use components from src/components/ui before adding new ones>
- Every API call handles loading, empty and error states.

## Recipes
- Add a page: <steps>
- Add an API call: <steps>

## Forbidden
- Editing .env files or committing secrets; client env vars (<prefix>*) are public
- Disabling lint rules, skipping or weakening tests, `any` to silence types
- Guessing when a spec is unclear: ask instead

## AI workflow
- Task tracker: <github | files>
- Specs: specs/<feature>/ (see specs/README.md). Every AC is proven by a test titled with its ID.
- Roles: subagents in .claude/agents (designer, dev, tester, reviewer); the main session is the Lead via /ai-workflow.
- Knowledge graph (optional, local, never committed): query with `node scripts/kg.mjs`, never open .ua/ files; the user runs /understand to update it. Without a graph, use the architecture map above, then Glob/Grep.
- Keep the architecture map and conventions above current: update them in the PR of any feature that adds a page, module or convention.
- Gates: G0 spec approved, G1 tasks cover every AC, G2 design approved, G3 verify green, G4 ACs tested (`node scripts/trace.mjs`), G5 review approved, G6 demo accepted.
~~~~

## Vitest files (Vite or Next.js, when installing tests)
`vitest.config.ts`
~~~~ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }),
);
~~~~
For Next.js there is no vite.config: use `defineConfig({ plugins: [react()], test: {...} })` with `import react from '@vitejs/plugin-react'`.

`src/test/setup.ts`
~~~~ts
import '@testing-library/jest-dom/vitest';
~~~~
Tests import `describe`, `it`, `expect` from `vitest` explicitly.

# Files

### `scripts/kg.mjs`
~~~~js
#!/usr/bin/env node
// kg.mjs: token-cheap, read-only queries over the understand-anything knowledge graph.
// Works from the main checkout or from any git worktree: it always reads the ONE graph
// in the main checkout (.ua/ or legacy .understand-anything/). It never writes.
//
//   node scripts/kg.mjs status                      graph commit vs HEAD, files that drifted
//   node scripts/kg.mjs find <regex> [--type file]  ranked nodes by name, path, tags, summary
//   node scripts/kg.mjs show <path|id>              one node: summary, layer, symbols inside
//   node scripts/kg.mjs deps <path|id>              what it uses and what uses it (file level)
//   node scripts/kg.mjs impact [files...] [--base main] [--depth 2]
//                                                   upstream blast radius + tests to run
//   node scripts/kg.mjs pack <path|regex>...        markdown context pack for a task issue
//
// Options: --limit N (default 15), --full (untruncated summaries), UA_GRAPH=<path> to override.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const opts = { limit: 15, depth: 2, full: false, type: null, base: null };
const args = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--full') opts.full = true;
  else if (a === '--limit') opts.limit = Number(argv[++i]);
  else if (a === '--depth') opts.depth = Number(argv[++i]);
  else if (a === '--type') opts.type = argv[++i];
  else if (a === '--base') opts.base = argv[++i];
  else args.push(a);
}

const git = (...a) => {
  try {
    return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const lines = (s) => (s ? s.split('\n').filter(Boolean) : []);

// ---------- locate the graph (main checkout, even from a worktree) ----------
const topLevel = git('rev-parse', '--show-toplevel') || process.cwd();
function graphPath() {
  if (process.env.UA_GRAPH) return process.env.UA_GRAPH;
  const common = git('rev-parse', '--git-common-dir');
  const mainRoot = common ? dirname(resolve(process.cwd(), common)) : topLevel;
  const dir = existsSync(join(mainRoot, '.understand-anything')) ? '.understand-anything' : '.ua';
  return join(mainRoot, dir, 'knowledge-graph.json');
}
const GP = graphPath();
if (!existsSync(GP)) {
  console.error(`No knowledge graph at ${GP} (it is optional). Use the no-graph fallback in the kg-query skill: CLAUDE.md's architecture map, then Glob/Grep. The user can run /understand in the main checkout to add one.`);
  process.exit(2);
}
const g = JSON.parse(readFileSync(GP, 'utf8'));

// ---------- indexes ----------
const byId = new Map(g.nodes.map((n) => [n.id, n]));
const outE = new Map();
const inE = new Map();
const push = (m, k, v) => (m.has(k) ? m.get(k).push(v) : m.set(k, [v]));
for (const e of g.edges) {
  push(outE, e.source, e);
  push(inE, e.target, e);
}
const layerOf = new Map();
for (const l of g.layers || []) for (const id of l.nodeIds || []) layerOf.set(id, l.name);

const fileId = (n) => (n.filePath ? `file:${n.filePath}` : n.id);
const layer = (n) => layerOf.get(n.id) || layerOf.get(fileId(n)) || '-';
const isTest = (p) => /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(e2e|__tests__)\//.test(p || '');
const DEP_TYPES = new Set(['imports', 'calls', 'depends_on', 'extends', 'implements', 'uses', 'renders']);
const short = (s, n = 160) => (!s ? '' : opts.full || s.length <= n ? s : s.slice(0, n - 1) + '…');

const relPath = (p) => {
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  return relative(topLevel, abs).split('\\').join('/');
};
function resolveNode(arg) {
  if (byId.has(arg)) return byId.get(arg);
  const p = relPath(arg);
  if (byId.has(`file:${p}`)) return byId.get(`file:${p}`);
  return g.nodes.find((n) => n.filePath === p && n.type === 'file') || g.nodes.find((n) => n.filePath === p) || null;
}

// ---------- drift: files that changed since the graph was built ----------
const graphCommit = g.project?.gitCommitHash || null;
let driftCache = null;
function drift() {
  if (driftCache) return driftCache;
  const files = new Set();
  let known = false;
  if (graphCommit && git('rev-parse', '--verify', '--quiet', `${graphCommit}^{commit}`)) {
    known = true;
    for (const f of lines(git('diff', '--name-only', graphCommit, 'HEAD', '--', '.'))) files.add(f);
  }
  for (const f of lines(git('diff', '--name-only', 'HEAD', '--', '.'))) files.add(f);
  for (const f of lines(git('ls-files', '--others', '--exclude-standard', '--', '.'))) files.add(f);
  for (const f of [...files]) if (/^\.(ua|understand-anything)\//.test(f)) files.delete(f);
  driftCache = { known, files };
  return driftCache;
}
const staleTag = (p) => (p && drift().files.has(p) ? ' [changed since graph: read source]' : '');

// ---------- file-level neighbours ----------
function fileNeighbours(fid, dir) {
  const ids = [fid, ...(outE.get(fid) || []).filter((e) => e.type === 'contains').map((e) => e.target)];
  const res = new Map();
  for (const id of ids) {
    for (const e of (dir === 'out' ? outE : inE).get(id) || []) {
      if (!DEP_TYPES.has(e.type)) continue;
      const other = byId.get(dir === 'out' ? e.target : e.source);
      if (!other) continue;
      const of = fileId(other);
      if (of === fid) continue;
      if (!res.has(of)) res.set(of, new Set());
      res.get(of).add(e.type);
    }
  }
  return res;
}
const symbolsIn = (fid) =>
  (outE.get(fid) || [])
    .filter((e) => e.type === 'contains')
    .map((e) => byId.get(e.target))
    .filter(Boolean);

function rank(re) {
  const scored = [];
  for (const n of g.nodes) {
    if (opts.type && n.type !== opts.type) continue;
    let s = 0;
    if (re.test(n.name || '')) s += 4;
    if (re.test(n.filePath || '')) s += 3;
    if ((n.tags || []).some((t) => re.test(t))) s += 2;
    if (re.test(n.summary || '')) s += 1;
    if (s) scored.push([s + (n.type === 'file' ? 0.5 : 0), n]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, n]) => n);
}

// ---------- commands ----------
function status() {
  const d = drift();
  console.log(`graph:   ${GP}`);
  console.log(`built:   ${graphCommit || 'unknown commit'} at ${g.project?.analyzedAt || '?'}`);
  console.log(`size:    ${g.nodes.length} nodes, ${g.edges.length} edges, ${(g.layers || []).length} layers`);
  console.log(`HEAD:    ${git('rev-parse', '--short', 'HEAD') || '?'} (${git('rev-parse', '--abbrev-ref', 'HEAD') || '?'})`);
  if (!d.known) console.log('warning: graph commit is not in this repo history; drift covers uncommitted files only');
  const list = [...d.files];
  console.log(`drift:   ${list.length} file(s) changed since the graph was built${list.length ? ':' : ''}`);
  for (const f of list.slice(0, 40)) console.log(`  ${f}`);
  if (list.length > 40) console.log(`  ... ${list.length - 40} more`);
}

function find() {
  if (!args[0]) return usage();
  const hits = rank(new RegExp(args.join('|'), 'i')).slice(0, opts.limit);
  if (!hits.length) return console.log('no match; try a broader word or a path fragment');
  for (const n of hits) console.log(`${n.id} | ${layer(n)} | ${short(n.summary, 120)}${staleTag(n.filePath)}`);
}

function show() {
  const n = resolveNode(args[0] || '');
  if (!n) return console.log(`not in graph: ${args[0]} (new file, ignored path, or graph is stale)`);
  console.log(`${n.id}  [${n.type}, ${n.complexity || '?'} complexity, layer: ${layer(n)}]${staleTag(n.filePath)}`);
  console.log(short(n.summary, 600));
  if (n.tags?.length) console.log(`tags: ${n.tags.join(', ')}`);
  const syms = n.type === 'file' ? symbolsIn(n.id) : [];
  if (syms.length) {
    console.log(`symbols (${syms.length}):`);
    for (const s of syms.slice(0, opts.limit)) console.log(`  ${s.type} ${s.name}: ${short(s.summary, 100)}`);
  }
}

function deps() {
  const n = resolveNode(args[0] || '');
  if (!n) return console.log(`not in graph: ${args[0]}`);
  const fid = fileId(n);
  const print = (title, m) => {
    console.log(`${title} (${m.size}):`);
    for (const [id, types] of [...m].slice(0, opts.limit)) {
      const o = byId.get(id);
      console.log(`  ${id} [${[...types].join(',')}] ${short(o?.summary, 90)}${staleTag(o?.filePath)}`);
    }
  };
  print('uses', fileNeighbours(fid, 'out'));
  print('used by', fileNeighbours(fid, 'in'));
}

function changedFiles() {
  if (args.length) return args.map(relPath);
  const base = opts.base || 'main';
  const mb = git('merge-base', base, 'HEAD');
  const set = new Set([
    ...(mb ? lines(git('diff', '--name-only', mb, 'HEAD', '--', '.')) : []),
    ...lines(git('diff', '--name-only', 'HEAD', '--', '.')),
    ...lines(git('ls-files', '--others', '--exclude-standard', '--', '.')),
  ]);
  return [...set].filter((f) => !/^\.(ua|understand-anything)\//.test(f));
}

function impact() {
  const changed = changedFiles();
  if (!changed.length) return console.log('no changed files');
  const seen = new Map(); // fileId -> distance
  let frontier = [];
  const unknown = [];
  for (const f of changed) {
    const fid = `file:${f}`;
    if (byId.has(fid)) {
      seen.set(fid, 0);
      frontier.push(fid);
    } else unknown.push(f);
  }
  for (let d = 1; d <= opts.depth; d++) {
    const next = [];
    for (const fid of frontier)
      for (const up of fileNeighbours(fid, 'in').keys())
        if (!seen.has(up)) {
          seen.set(up, d);
          next.push(up);
        }
    frontier = next;
  }
  const affected = [...seen].filter(([, d]) => d > 0);
  const tests = new Set([...seen.keys()].map((id) => byId.get(id)?.filePath).filter(isTest));
  changed.filter(isTest).forEach((t) => tests.add(t));
  // Tests named after a changed or affected file (Foo.ts -> Foo.test.ts), even if the graph lacks them.
  const tracked = lines(git('ls-files', '--', '*.test.*', '*.spec.*', 'e2e'));
  const stems = new Set(
    [...changed, ...[...seen.keys()].map((id) => byId.get(id)?.filePath)]
      .filter((p) => p && !isTest(p))
      .map((p) => p.split('/').pop().replace(/\.[^.]+$/, '')),
  );
  for (const t of tracked) if (stems.has(t.split('/').pop().replace(/\.(test|spec)\.[^.]+$/, ''))) tests.add(t);
  const layers = new Set([...seen.keys()].map((id) => layer(byId.get(id) || { id })));
  console.log(`## Impact of ${changed.length} changed file(s), upstream depth ${opts.depth}`);
  console.log(`layers touched: ${[...layers].join(', ')}`);
  console.log(`\n### Changed`);
  for (const f of changed) {
    const n = byId.get(`file:${f}`);
    console.log(`- ${f}${n ? ` (${n.complexity || '?'}): ${short(n.summary, 100)}` : ' (not in graph: new or ignored)'}`);
  }
  console.log(`\n### Affected upstream (${affected.length})`);
  for (const [id, d] of affected.sort((a, b) => a[1] - b[1]).slice(0, opts.limit * 2)) {
    const n = byId.get(id);
    console.log(`- d${d} ${n?.filePath || id} (${n?.complexity || '?'})${staleTag(n?.filePath)}`);
  }
  console.log(`\n### Tests to run (${tests.size})`);
  for (const t of tests) console.log(`- ${t}`);
  if (!tests.size) console.log('- none found in graph: add tests for the changed logic');
  if (unknown.length) console.log(`\nnote: ${unknown.length} file(s) not in graph; review them from source.`);
}

function pack() {
  if (!args.length) return usage();
  const seeds = [];
  for (const a of args) {
    const n = resolveNode(a);
    if (n) seeds.push(fileId(n));
    else for (const h of rank(new RegExp(a, 'i')).filter((x) => x.type === 'file').slice(0, 5)) seeds.push(h.id);
  }
  const uniq = [...new Set(seeds)].slice(0, 8);
  if (!uniq.length) return console.log('no matching files');
  const tests = new Set();
  console.log('## Context pack (from .ua knowledge graph; trust code over summaries)');
  console.log(`Graph built at ${String(graphCommit).slice(0, 7)}. Read these files first; do not explore beyond them unless a query says so.\n`);
  for (const fid of uniq) {
    const n = byId.get(fid);
    console.log(`### ${n.filePath}${staleTag(n.filePath)}`);
    console.log(`${layer(n)} · ${n.complexity || '?'} · ${short(n.summary, 220)}`);
    const syms = symbolsIn(fid).map((s) => s.name);
    if (syms.length) console.log(`- symbols: ${syms.slice(0, 12).join(', ')}${syms.length > 12 ? ', …' : ''}`);
    const uses = [...fileNeighbours(fid, 'out').keys()].map((id) => byId.get(id)?.filePath).filter(Boolean);
    const usedBy = [...fileNeighbours(fid, 'in').keys()].map((id) => byId.get(id)?.filePath).filter(Boolean);
    if (uses.length) console.log(`- uses: ${uses.filter((p) => !isTest(p)).slice(0, 8).join(', ')}`);
    if (usedBy.length) console.log(`- used by: ${usedBy.filter((p) => !isTest(p)).slice(0, 8).join(', ')}`);
    usedBy.filter(isTest).forEach((t) => tests.add(t));
    console.log('');
  }
  console.log(`### Existing tests touching these files`);
  console.log(tests.size ? [...tests].map((t) => `- ${t}`).join('\n') : '- none: the task must add them');
  const stale = [...drift().files];
  if (stale.length) console.log(`\n### Changed since the graph was built (${stale.length}): read from source\n${stale.slice(0, 15).map((f) => `- ${f}`).join('\n')}`);
}

function usage() {
  console.log('usage: node scripts/kg.mjs <status|find|show|deps|impact|pack> [args] [--limit N] [--depth N] [--type T] [--base B] [--full]');
  process.exit(1);
}

({ status, find, show, deps, impact, pack }[cmd] || usage)();
~~~~

### `scripts/trace.mjs`
~~~~js
#!/usr/bin/env node
// trace.mjs: requirement -> test traceability for specs/<feature>/requirements.md.
//   node scripts/trace.mjs [feature]                 print the AC -> test matrix
//   node scripts/trace.mjs [feature] --write         also write specs/<feature>/trace.md
//   node scripts/trace.mjs --check                   fail if spec format is broken, or an AC of an
//                                                    implemented/verified spec has no test
//   node scripts/trace.mjs --check --ac AC-X-001.1,AC-X-001.2   fail if these ACs have no test (task gate G4)
//   node scripts/trace.mjs --check --ac-from-text "$PR_BODY"     same, ACs taken from free text
//   --quiet hides the matrix (useful in CI and for agents)
// A test "covers" an AC when the AC ID appears in a test file, normally as the test title prefix:
//   it("AC-BOOK-003.1: rejects overlapping periods", ...)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const feature = argv.find((a, i) => !a.startsWith('--') && !['--ac', '--ac-from-text'].includes(argv[i - 1]));
const AC_RE = /AC-[A-Z][A-Z0-9]*-\d{3}\.\d+/g;
const REQ_RE = /REQ-[A-Z][A-Z0-9]*-\d{3}/g;

const SPECS = 'specs';
if (!existsSync(SPECS)) { console.log('no specs/ folder yet'); process.exit(0); }
const features = readdirSync(SPECS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(SPECS, d.name, 'requirements.md')))
  .map((d) => d.name)
  .filter((f) => !feature || f === feature);

const errors = [];
const allAcs = new Map(); // id -> {feature, req, status}
const specs = [];
for (const f of features) {
  const text = readFileSync(join(SPECS, f, 'requirements.md'), 'utf8');
  const status = (text.match(/^status:\s*(\S+)/m) || [])[1] || 'draft';
  let req = null;
  const reqs = new Map();
  for (const line of text.split('\n')) {
    const h = line.match(/^#{2,4}\s+(REQ-[A-Z][A-Z0-9]*-\d{3})\b/);
    if (h) { req = h[1]; if (reqs.has(req)) errors.push(`${f}: duplicate ${req}`); reqs.set(req, []); continue; }
    const a = line.match(/^\s*[-*]\s+(AC-[A-Z][A-Z0-9]*-\d{3}\.\d+)\b/);
    if (a) {
      const id = a[1];
      if (!req) errors.push(`${f}: ${id} is not under a REQ heading`);
      else if (!id.startsWith(req.replace('REQ-', 'AC-') + '.')) errors.push(`${f}: ${id} sits under ${req} but its number does not match`);
      if (allAcs.has(id)) errors.push(`${f}: ${id} also defined in ${allAcs.get(id).feature}`);
      allAcs.set(id, { feature: f, req, status });
      if (req) reqs.get(req).push(id);
    }
  }
  if (status !== 'draft') for (const [r, acs] of reqs) if (!acs.length && !/dropped/i.test(r)) errors.push(`${f}: ${r} has no AC`);
  // An approved spec has no open questions left (bullets other than "none").
  const oq = text.match(/^##\s*Open questions\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  const openItems = oq ? oq[1].split('\n').filter((l) => /^\s*[-*]\s+\S/.test(l) && !/^\s*[-*]\s+\(?none\)?\s*$/i.test(l)) : [];
  if (status !== 'draft' && openItems.length) errors.push(`${f}: status ${status} but has ${openItems.length} open question(s)`);
  specs.push({ f, status, reqs });
}

// test files: tracked + untracked, typical test locations
let files = [];
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n');
} catch { files = []; }
const testFiles = files.filter((p) => /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(e2e|__tests__|tests?)\/.+\.[cm]?[jt]sx?$/.test(p));
const covered = new Map(); // ac -> [files]
for (const p of testFiles) {
  let t; try { t = readFileSync(p, 'utf8'); } catch { continue; }
  for (const id of new Set(t.match(AC_RE) || [])) (covered.get(id) || covered.set(id, []).get(id)).push(p);
}

// report
for (const s of specs) {
  const acs = [...s.reqs.values()].flat();
  const done = acs.filter((a) => covered.has(a)).length;
  const lines = [`## Trace: ${s.f} (status ${s.status}) ${done}/${acs.length} ACs have tests`, '', '| AC | REQ | Test files |', '| --- | --- | --- |'];
  for (const [r, list] of s.reqs) for (const a of list) lines.push(`| ${a} | ${r} | ${(covered.get(a) || ['**missing**']).join('<br>')} |`);
  const md = lines.join('\n');
  if (!flag('--quiet')) console.log(md + '\n');
  if (flag('--write')) writeFileSync(join(SPECS, s.f, 'trace.md'), `<!-- generated by scripts/trace.mjs; do not edit -->\n${md}\n`);
}

if (flag('--check')) {
  let wanted = [];
  if (val('--ac')) wanted = val('--ac').split(',').map((x) => x.trim()).filter(Boolean);
  if (val('--ac-from-text') !== null) wanted = [...new Set(val('--ac-from-text').match(AC_RE) || [])];
  if (wanted.length) {
    for (const a of wanted) {
      if (!allAcs.has(a)) errors.push(`${a} is cited but not defined in any spec`);
      else if (!covered.has(a)) errors.push(`${a} has no test`);
    }
  } else {
    for (const [a, m] of allAcs) if (['implemented', 'verified'].includes(m.status) && !covered.has(a)) errors.push(`${a} (${m.feature}, ${m.status}) has no test`);
  }
  for (const p of testFiles) {
    let t; try { t = readFileSync(p, 'utf8'); } catch { continue; }
    if (/\b(it|test|describe)\.(skip|only)\s*\(|\bx(it|describe)\s*\(/.test(t)) errors.push(`${p}: contains .skip/.only/xit; remove before merge`);
  }
  if (errors.length) { console.error('TRACE CHECK FAILED\n- ' + errors.join('\n- ')); process.exit(1); }
  console.log('trace check passed');
} else if (errors.length) {
  console.error('spec warnings:\n- ' + errors.join('\n- '));
}
~~~~

### `.claude/hooks/ua-sync-reminder.mjs`
~~~~js
#!/usr/bin/env node
// SessionStart + PostToolUse(Bash) hook. In the MAIN checkout only, tells the Lead when the
// knowledge graph is behind HEAD so it asks the user to run /understand after the merge round.
// Silent in worktrees (dev, tester, reviewer agents) and when the graph is current.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const git = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};

let payload = {};
try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { /* no stdin */ }
const event = payload.hook_event_name || 'SessionStart';

if (event === 'PostToolUse') {
  const cmd = payload.tool_input?.command || '';
  if (!/\bgit\s+(merge|pull|rebase|cherry-pick)\b|\bgh\s+pr\s+merge\b/.test(cmd)) process.exit(0);
}

// Main checkout only: git-dir equals git-common-dir.
const gitDir = git('rev-parse', '--git-dir');
const common = git('rev-parse', '--git-common-dir');
if (!gitDir || !common || resolve(gitDir) !== resolve(common)) process.exit(0);

const dir = existsSync('.understand-anything') ? '.understand-anything' : '.ua';
const metaPath = `${dir}/meta.json`;
if (!existsSync(metaPath)) process.exit(0);
let built;
try { built = JSON.parse(readFileSync(metaPath, 'utf8')).gitCommitHash; } catch { process.exit(0); }
const head = git('rev-parse', 'HEAD');
if (!built || built === head) process.exit(0);

const changed = (git('diff', '--name-only', built, 'HEAD', '--', '.') || '')
  .split('\n').filter((f) => f && !/^\.(ua|understand-anything)\//.test(f));
if (!changed.length) process.exit(0);

const msg = `[knowledge-graph] The graph in ${dir}/ is ${changed.length} file(s) behind HEAD. ` +
  'Lead: when the current merge round is finished, ask the user to run /understand (they run it themselves). ' +
  'Until then, treat graph summaries for those files as stale (node scripts/kg.mjs status lists them).';
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: msg } }));
~~~~

### `.claude/hooks/guard-paths.mjs`
~~~~js
#!/usr/bin/env node
// PreToolUse(Edit|Write) hook used from role files: blocks writes outside the role's allowed paths.
// Usage in an agent's frontmatter: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs" tester
import { readFileSync } from 'node:fs';
import { relative, isAbsolute, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ALLOW = {
  tester: [/^src\/test\//, /\.(test|spec)\.[cm]?[jt]sx?$/, /^e2e\//, /^src\/setupTests\.[jt]s$/, /^specs\/[^/]+\/qa\.md$/],
  designer: [/^specs\/[^/]+\/design\.md$/, /^specs\/[^/]+\/mockups\//],
};
const role = process.argv[2];
const rules = ALLOW[role];
if (!rules) process.exit(0);

let p = {};
try { p = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const file = p.tool_input?.file_path;
if (!file) process.exit(0);

let root = process.cwd();
try { root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch {}
const rel = relative(root, isAbsolute(file) ? file : resolve(root, file)).split('\\').join('/');
if (rules.some((r) => r.test(rel))) process.exit(0);

process.stderr.write(`The ${role} role may not edit ${rel}. Allowed: ${rules.map(String).join(', ')}. ` +
  'If the change is needed, report it to the Lead instead of making it.');
process.exit(2);
~~~~

### `.claude/settings.json`
~~~~json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "0"
  },
  "permissions": {
    "allow": [
      "Bash(node scripts/kg.mjs *)",
      "Bash(node scripts/trace.mjs *)",
      "Bash(npm run verify)",
      "Bash(npm run lint)",
      "Bash(npm run typecheck)",
      "Bash(npm run test:ci)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git show *)",
      "Bash(gh issue view *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.*.local)",
      "Read(./.env.production)",
      "Edit(./.env)",
      "Edit(./.env.local)",
      "Edit(./.env.*.local)",
      "Edit(./.env.production)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/ua-sync-reminder.mjs\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/ua-sync-reminder.mjs\""
          }
        ]
      }
    ]
  }
}
~~~~

### `.claude/agents/designer.md`
~~~~markdown
---
name: designer
description: Designs the screens of a feature: writes specs/<feature>/design.md and static HTML mockups covering every state, reusing existing components and design tokens. Use for UI work before development starts.
tools: Read, Edit, Write, Grep, Glob, Bash
model: sonnet
skills:
  - kg-query
color: pink
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs" designer
---
You are the Designer.
1. Read the feature's requirements.md and the task.
2. Reuse before inventing: `node scripts/kg.mjs find "<component idea>" --type file`, then read the shared components and design tokens named in CLAUDE.md.
3. Write specs/<feature>/design.md: each screen, the components it uses, and every state (normal, empty, loading, error, validation, permission denied), with an i18n key and text for every string if the project is localized.
4. Write one static HTML mockup per screen in specs/<feature>/mockups/ using the project's tokens.
5. You may only write design.md and mockups/ (a hook enforces this). Final message: files written and open questions.
~~~~

### `.claude/agents/dev.md`
~~~~markdown
---
name: dev
description: Implements exactly one Ready task on its own branch in an isolated worktree, starting from the task's context pack. Use for every coding task the Lead assigns.
tools: Read, Edit, Write, Grep, Glob, Bash
isolation: worktree
model: sonnet
skills:
  - kg-query
  - implement-task
color: blue
---
You are a developer on this project. Follow the preloaded implement-task procedure step by step. Project rules are in CLAUDE.md.

Hard rules:
- One task only, and only the files the task lists. If you need another file, stop and report why.
- Use the knowledge graph only through `node scripts/kg.mjs`. Never open .ua/ files, never run /understand.
- Never edit .env files, specs/, or tests written by the tester. Never weaken or skip a test.
- A gap or contradiction in the spec is a question in your report, not a guess.
- Commit on your task branch before you finish; the worktree may be removed, the branch stays.
- Final message at most 15 lines: branch, commits, ACs covered, verify result, impact summary, open questions.
~~~~

### `.claude/agents/tester.md`
~~~~markdown
---
name: tester
description: Proves a finished task's acceptance criteria. Writes one test per AC from the spec before reading the implementation, runs them plus the regression tests the graph points to, and records results. Use after a dev reports a task done.
tools: Read, Edit, Write, Grep, Glob, Bash
isolation: worktree
model: sonnet
skills:
  - kg-query
  - verify-task
color: green
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs" tester
---
You are the Tester. You check the product against the spec, not against the code.
- Read the ACs and write the tests BEFORE you read the implementation diff.
- You may only write test files, e2e/, src/test/ and specs/<feature>/qa.md (a hook enforces this). Never change product code to make a test pass.
- A failing test becomes a bug report: AC ID, steps, expected, actual.
- Graph only through `node scripts/kg.mjs`. Never run /understand.
- Final message at most 15 lines: test branch, pass/fail per AC, regressions run, bugs.
~~~~

### `.claude/agents/reviewer.md`
~~~~markdown
---
name: reviewer
description: Read-only review of a task branch against its ACs, the project rules in CLAUDE.md and its blast radius from the knowledge graph. Use after the tester has passed a task.
tools: Read, Grep, Glob, Bash
model: opus
skills:
  - kg-query
  - review-task
color: orange
---
You are the Reviewer. You read and judge; you never change files, commit or push. Use Bash only for git diff/show/log, gh, `node scripts/kg.mjs` and `node scripts/trace.mjs`.
Follow the preloaded review-task procedure. Every blocker cites file:line and the rule or AC it breaks. Verdict: APPROVE or CHANGES REQUIRED.
~~~~

### `.claude/skills/kg-query/SKILL.md`
~~~~markdown
---
name: kg-query
description: How to get code context cheaply, from the .ua knowledge graph with scripts/kg.mjs or, without a graph, from CLAUDE.md and Grep. Use before searching or reading code.
---
# Querying the knowledge graph

The graph in the main checkout's `.ua/` maps files, functions, imports and calls. It is large: never open, cat or grep `.ua/knowledge-graph.json`. Query it with `scripts/kg.mjs`, which works from any worktree and prints a few dozen lines.

| Need | Command |
|---|---|
| Is the graph current? | `node scripts/kg.mjs status` |
| Where is X? | `node scripts/kg.mjs find "<regex>" --type file` |
| What is this file, what's inside? | `node scripts/kg.mjs show <path>` |
| What does it use, who uses it? | `node scripts/kg.mjs deps <path>` |
| What could my change break, which tests to run? | `node scripts/kg.mjs impact --base <branch>` or `impact <files...>` |
| Context for a task | `node scripts/kg.mjs pack <paths or keywords>` |

Cheapest first: (1) the task's context pack, (2) `show`/`deps` for what it misses, (3) read the source, (4) only then grep, and only in folders the graph pointed to.

Rules:
- The graph says WHERE; the code says WHAT. Summaries can lag behind small edits; never cite a summary as evidence.
- `[changed since graph: read source]` means the summary predates the latest change. `not in graph` means a new or ignored file.
- Never run /understand; the user updates the graph.

## No graph (kg.mjs says "No knowledge graph")
The graph is optional; the workflow works without it. Same questions, other tools:

| Need | Without a graph |
|---|---|
| Where is X? | CLAUDE.md's architecture map, then Glob on file names, then Grep inside those folders |
| What does it use, who uses it? | Read its imports; Grep `from ['"].*<file stem>` for importers |
| What could my change break, which tests to run? | Grep importers of each changed file, then their importers; run the tests next to all of them, then the full test command |
| Context for a task | The context pack the Lead wrote by hand in the task |

Workers never ask for /understand; the Lead decides.
~~~~

### `.claude/skills/implement-task/SKILL.md`
~~~~markdown
---
name: implement-task
description: Developer procedure for one task: read the task and its context pack, build on a task branch, test by AC ID, pass verify, check impact, commit and report. Use when assigned a coding task.
---
# Implement a task

Inputs from the Lead: task ID, where the task lives (GitHub issue number or tasks/<ID>.md), feature branch.

1. Read the task (`gh issue view <n>` or `tasks/<ID>.md`), the ACs it covers in specs/<feature>/requirements.md, and design.md if the task is UI.
2. Branch: `git switch -c task/<ID>-<slug> <feature-branch>`.
3. Read the files in the context pack (source, not summaries). Use `node scripts/kg.mjs show|deps` only for gaps.
4. Follow CLAUDE.md: its recipes, conventions and forbidden list.
5. Unit or component tests next to the code you change, one per AC, titled `"AC-XXX-NNN.n: <behaviour>"`. Cover every UI state the AC implies (loading, empty, error).
6. Gate G3: run the project's verify script (see CLAUDE.md). Fix until green. Never disable a lint rule, skip a test or loosen a type to get there.
7. `node scripts/kg.mjs impact --base <feature-branch>` (no graph: the kg-query fallback); run every test it lists. If an upstream file outside your list must change, stop and report.
8. `node scripts/trace.mjs --check --quiet --ac <the task's ACs, comma separated>`.
9. Commit: `git commit -m "<ID>: <summary>" -m "Covers: AC-..."`.
10. Report in at most 15 lines.
~~~~

### `.claude/skills/verify-task/SKILL.md`
~~~~markdown
---
name: verify-task
description: Tester procedure for one finished task: write one test per AC from the spec before reading the code, run them and the regression tests the graph points to, record results in qa.md. Use after a dev reports a task done.
---
# Verify a task

Inputs: task ID, task branch, feature branch.

1. Read the task's Covers list and those ACs (and design.md for UI). Do NOT read the diff yet.
2. `git switch -c test/<ID> <task-branch>`.
3. Write tests from the ACs alone. Logic and components: `*.test.ts(x)` next to the code. User flows: `e2e/` with the API mocked (Playwright route interception or MSW). Title each `"AC-XXX-NNN.n: <behaviour>"`. Include the edge cases the AC implies: boundaries, empty data, API errors, slow responses, keyboard use.
4. Run the project's test command and the e2e command if present (see CLAUDE.md).
5. Regression: `node scripts/kg.mjs impact $(git diff --name-only <feature-branch>...<task-branch>)` (no graph: the kg-query fallback); run every test it lists.
6. Only now read the diff, to write precise bug reports for failures.
7. Append to specs/<feature>/qa.md: AC | test | result | date. Commit on test/<ID>.
8. Report in at most 15 lines: pass/fail per AC, regressions run, bugs with AC ID, expected and actual.
~~~~

### `.claude/skills/review-task/SKILL.md`
~~~~markdown
---
name: review-task
description: Reviewer procedure: check a task branch against its ACs, the rules in CLAUDE.md and its knowledge-graph blast radius, then give a verdict. Use after the tester has passed a task.
---
# Review a task

Inputs: task ID, feature branch, task branch, test branch.

1. Scope: the task's Covers and file list; `git diff <feature-branch>...<task-branch> --stat`, then the full diff, then the test branch diff.
2. Blast radius: `node scripts/kg.mjs impact $(git diff --name-only <feature-branch>...<task-branch>)` (no graph: the kg-query fallback). Check every affected caller still works; spend most time on `complex` files.
3. Checklist, each pass or blocker:
   - Does what its ACs say and nothing more; only listed files touched
   - Every AC has a passing test titled with its ID (`node scripts/trace.mjs --check --quiet --ac ...`)
   - Every project rule in CLAUDE.md (conventions, recipes, forbidden list)
   - UI: all states handled (loading, empty, error); accessible names, labels and keyboard use; no layout shift from async data
   - Data: every API error path handled; no unhandled promise; no secrets or tokens in client env vars or logs
   - Text goes through i18n if the project is localized
   - No test skipped or weakened; no lint rule disabled
4. Read the source for every claim; never rely on graph summaries.
5. Output: verdict (APPROVE or CHANGES REQUIRED), blockers with file:line and the rule or AC, then at most 5 nits. If a PR exists, post with `gh pr review`.
~~~~

### `specs/README.md`
~~~~markdown
# Specs

One folder per feature: `specs/<feature>/` with `requirements.md`, optional `api.md`, `design.md` + `mockups/`, `plan.md`, `qa.md`, and the generated `trace.md`. Templates are in `_templates/`.

- IDs: `REQ-<AREA>-NNN` for a requirement, `AC-<AREA>-NNN.n` for its acceptance criteria. Never reuse or renumber; a dropped requirement keeps its ID and says "dropped".
- Status in front matter: `draft` -> `approved` (only a human sets this) -> `implemented` -> `verified`.
- After approval, any change bumps `version`, adds a line to the change log, and reopens the affected tasks.
- Every AC is proven by a test whose title starts with its ID. `node scripts/trace.mjs <feature>` shows the matrix.
~~~~

### `specs/_templates/requirements.md`
~~~~markdown
---
id: AREA
title: Feature name
status: draft
version: 0.1
owner: name
---

# Feature name

## Goal
One or two sentences: who gets what, and why.

## Scope
- In:
- Out (non-goals):

## Requirements

### REQ-AREA-001 Short statement of the rule
Source: client request <date or link>

- AC-AREA-001.1 Given <state>, when <action>, then <observable result>.
- AC-AREA-001.2 Given <state>, when <action>, then <observable result>.

## Open questions
- none

## Change log
- 0.1 draft
~~~~

### `specs/_templates/design.md`
~~~~markdown
# Design: Feature name

## Screens
| Screen | Route | Components reused | New components |
|---|---|---|---|

## States (every screen)
| Screen | Normal | Empty | Loading | Error | Validation | No permission |
|---|---|---|---|---|---|---|

## Text
| i18n key | Text (each language) | Where |
|---|---|---|

Mockups: `mockups/<screen>.html`
~~~~

### `specs/_templates/plan.md`
~~~~markdown
# Plan: Feature name

Feature branch: `feature/<name>`

| Task | Covers (ACs) | Files it may touch | Depends on | Lane |
|---|---|---|---|---|

Parallel lanes: tasks in the same lane run one after another; different lanes run in parallel.
Shared hot files (router config, store root, i18n files, API client registry) belong to one wiring task, scheduled last.
~~~~

### `specs/_templates/qa.md`
~~~~markdown
# QA: Feature name

| AC | Test | Result | Date | Notes |
|---|---|---|---|---|

## Manual cases (only for ACs that cannot be automated)
~~~~

### `specs/_templates/task.md`
~~~~markdown
# T-000 Title

- Feature: <feature>
- Covers: AC-AREA-001.1, AC-AREA-001.2
- Role: dev | designer
- Files it may touch:
- Depends on:
- Status: Ready | In progress | In test | In review | Awaiting sign-off | Done | Blocked
- Done when: verify green (G3), every covered AC has a passing test (G4), review approved (G5)

## Context pack
<output of: node scripts/kg.mjs pack <files>>

## Log
~~~~

### `.github/workflows/ai-gates.yml`
~~~~yaml
name: ai-gates
on:
  pull_request:
  push:
    branches: [main]
jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - name: G3 verify (lint, types, tests, build)
        run: npm run verify
      - name: G4 trace (spec format, covered ACs have tests, no skipped tests)
        env:
          PR_BODY: ${{ github.event.pull_request.body }}
        run: |
          if [ -n "$PR_BODY" ]; then node scripts/trace.mjs --check --quiet --ac-from-text "$PR_BODY"; else node scripts/trace.mjs --check --quiet; fi
      - name: E2E (only when e2e/ exists)
        if: hashFiles('e2e/**') != ''
        run: npx playwright install --with-deps chromium && npm run e2e
~~~~

### `.github/pull_request_template.md`
~~~~markdown
## What
<!-- one or two sentences -->

## Covers
Covers: AC-XXX-NNN.n, AC-XXX-NNN.n

## Task
T-000

## Checks
- [ ] verify green
- [ ] every covered AC has a test titled with its ID
- [ ] reviewer verdict: APPROVE
~~~~

### `.github/ISSUE_TEMPLATE/task.yml`
~~~~yaml
name: Task
description: One unit of work for the AI workflow, linked to acceptance criteria
title: "T-000 "
labels: ["task"]
body:
  - type: input
    id: feature
    attributes: { label: Feature, placeholder: "booking" }
    validations: { required: true }
  - type: input
    id: covers
    attributes: { label: Covers, description: "AC IDs, comma separated", placeholder: "AC-BOOK-001.1, AC-BOOK-001.2" }
    validations: { required: true }
  - type: dropdown
    id: role
    attributes: { label: Role, options: [dev, designer] }
  - type: textarea
    id: files
    attributes: { label: Files it may touch }
    validations: { required: true }
  - type: input
    id: depends
    attributes: { label: Depends on }
  - type: textarea
    id: pack
    attributes: { label: Context pack, description: "Output of node scripts/kg.mjs pack <files>", render: markdown }
~~~~
