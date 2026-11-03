#!/usr/bin/env node
// kg.mjs: token-cheap, read-only queries over the understand-anything knowledge graph.
// Works from the main checkout or from any git worktree: it always reads the ONE graph
// in the main checkout (.ua/ or legacy .understand-anything/). It never writes.
//
//   node scripts/kg.mjs status                      graph commit vs HEAD, files that drifted
//   node scripts/kg.mjs find <regex> [--type file]  ranked nodes by name, path, tags, summary
//   node scripts/kg.mjs show <path|id>              one node: summary, layer, symbols inside
//   node scripts/kg.mjs deps <path|id>              what it uses and what uses it (file level)
//   node scripts/kg.mjs impact [files...] [--base <branch>] [--head <ref>] [--depth 2]
//                                                   upstream blast radius + tests to run
//   node scripts/kg.mjs pack <path|regex>...        markdown context pack for a task issue
//
// Options: --limit N (default 15), --full (untruncated summaries), UA_GRAPH=<path> to override.
// --base defaults to the repository's default branch (origin/HEAD, else .claude/ai-workflow.json).
// --head defaults to HEAD (then uncommitted and untracked files count too); e.g. a reviewer in the
// main checkout runs: impact --base feature/<feature> --head task/<ID>

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join, relative, isAbsolute } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv.shift();
const opts = { limit: 15, depth: 2, full: false, type: null, base: null, head: 'HEAD' };
const args = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--full') opts.full = true;
  else if (a === '--limit') opts.limit = Number(argv[++i]);
  else if (a === '--depth') opts.depth = Number(argv[++i]);
  else if (a === '--type') opts.type = argv[++i];
  else if (a === '--base') opts.base = argv[++i];
  else if (a === '--head') opts.head = argv[++i];
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

// Default branch: origin/HEAD first, then the value recorded at install time.
function defaultBranch() {
  const head = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  if (head) return head.replace(/^origin\//, '');
  try {
    const top = git('rev-parse', '--show-toplevel') || process.cwd();
    const cfg = JSON.parse(readFileSync(join(top, '.claude', 'ai-workflow.json'), 'utf8'));
    if (cfg.defaultBranch) return cfg.defaultBranch;
  } catch { /* no config */ }
  return 'master';
}

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
  const base = opts.base || defaultBranch();
  const head = opts.head;
  const mb = git('merge-base', base, head) || git('merge-base', `origin/${base}`, head);
  const set = new Set([
    ...(mb ? lines(git('diff', '--name-only', mb, head, '--', '.')) : []),
    ...(head === 'HEAD' ? lines(git('diff', '--name-only', 'HEAD', '--', '.')) : []),
    ...(head === 'HEAD' ? lines(git('ls-files', '--others', '--exclude-standard', '--', '.')) : []),
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
  const tracked = lines(git('ls-files', '--', '*.test.*', '*.spec.*', 'e2e', '*/e2e/*'));
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
  console.log('usage: node scripts/kg.mjs <status|find|show|deps|impact|pack> [args] [--limit N] [--depth N] [--type T] [--base B] [--head H] [--full]');
  process.exit(1);
}

({ status, find, show, deps, impact, pack }[cmd] || usage)();
