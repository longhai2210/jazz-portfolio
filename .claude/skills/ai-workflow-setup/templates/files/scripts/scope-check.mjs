#!/usr/bin/env node
// scope-check.mjs: fail when a branch changes files outside what its task or role allows.
//   node scripts/scope-check.mjs --task <T-ID|issue number|path/to/task.md> [--base <ref>] [--head <ref>]
//   node scripts/scope-check.mjs --role tester --base task/<ID> [--head test/<ID>]
// --base defaults to feature/<feature> named in the task, else the default branch. With --head HEAD
// (the default) uncommitted and untracked files count too. Build output always fails, even inside
// an allowed path. For --task, test files next to an allowed file (foo.ts -> foo.test.ts,
// __tests__/foo.*, __snapshots__) are allowed. Role allowlists come from .claude/ai-workflow.json.
// This is the real check behind "only the files the task lists": hooks only see Edit/Write, not Bash.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { return null; }
};
const git = (...a) => run('git', a);
const lines = (s) => (s ? s.split('\n').map((l) => l.trim()).filter(Boolean) : []);
const die = (msg) => { console.error(`scope-check: ${msg}`); process.exit(2); };

const root = (git('rev-parse', '--show-toplevel') || process.cwd()).trim();
process.chdir(root);
let cfg = {};
try { cfg = JSON.parse(readFileSync(join(root, '.claude', 'ai-workflow.json'), 'utf8')); } catch { /* defaults */ }

// ---------- globs (anchored at the repo root; ** any depth, * one segment, {a,b}) ----------
function expandBraces(p) {
  const m = p.match(/\{([^{}]*)\}/);
  if (!m) return [p];
  return m[1].split(',').flatMap((alt) => expandBraces(p.slice(0, m.index) + alt + p.slice(m.index + m[0].length)));
}
function globRe(glob) {
  return expandBraces(String(glob).trim().replace(/^\.?\//, '')).map((g) => {
    if (g.endsWith('/')) g += '**';
    let re = '';
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === '*' && g[i + 1] === '*') {
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
      } else if (c === '*') re += '[^/]*';
      else if (c === '?') re += '[^/]';
      else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
}
const matcher = (globs) => { const res = globs.flatMap(globRe); return (p) => res.some((r) => r.test(p)); };

const ARTIFACTS = cfg.artifacts?.length ? cfg.artifacts : [
  '**/*.tsbuildinfo', '**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/coverage/**', '**/dist/**',
];
const isArtifact = matcher(ARTIFACTS);

// ---------- task ----------
function defaultBranch() {
  const h = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  return h ? h.trim().replace(/^origin\//, '') : cfg.defaultBranch || null;
}
function loadTask(ref) {
  const id = ref.replace(/^#/, '');
  const candidates = [ref, join('tasks', `${ref}.md`), join('tasks', `${id}.md`)];
  for (const c of candidates) if (existsSync(c) && c.endsWith('.md')) return { text: readFileSync(c, 'utf8'), source: c };
  if (/^\d+$/.test(id)) {
    const out = run('gh', ['issue', 'view', id, '--json', 'title,body']);
    if (out) { const j = JSON.parse(out); return { text: `# ${j.title}\n\n${j.body}`, source: `issue #${id}` }; }
    die(`cannot read issue #${id} (is gh installed and signed in?)`);
  }
  if (/^T-\d+$/i.test(id) && cfg.tracker === 'github') {
    // GitHub tracker: the task ID starts the issue title
    const out = run('gh', ['issue', 'list', '--state', 'all', '--label', 'task', '--search', `${id} in:title`, '--json', 'number,title,body', '--limit', '100']);
    const hit = out ? JSON.parse(out).find((i) => new RegExp(`^${id}\\b`, 'i').test(i.title.trim())) : null;
    if (hit) return { text: `# ${hit.title}\n\n${hit.body}`, source: `issue #${hit.number}` };
    die(`no issue titled "${id} ..." with the task label (or gh is not signed in); pass the issue number`);
  }
  die(`task ${ref} not found (looked for ${candidates.join(', ')})`);
}
function parseTask(text) {
  text = text.replace(/\r\n/g, '\n');
  const feature = ((text.match(/^\s*[-*]?\s*\**Feature\**:\s*\**\s*([\w./-]+)/im)
    || text.match(/^#{2,4}\s*Feature\s*\n+\s*([\w./-]+)/im) || [])[1]) || null;
  // "## Files it may touch" or "### Files it may touch" (issue forms) or "- Files it may touch:" with an indented list
  let block = (text.match(/^#{2,4}\s*Files it may touch\s*\n([\s\S]*?)(?=^#{1,4}\s|(?![\s\S]))/im) || [])[1];
  if (!block) block = (text.match(/^\s*[-*]\s*Files it may touch:?\s*\n((?:\s{2,}[-*].*\n?)*)/im) || [])[1] || '';
  const files = block.split('\n')
    .map((l) => l.replace(/^\s*(?:[-*]|\d+\.)\s*/, '').replace(/`/g, '').replace(/\s+[-–(].*$/, '').trim())
    .filter((l) => l && !/^(_?no response_?|none|path\/or\/glob|path\/to\/file\.ts)$/i.test(l) && !l.startsWith('<'));
  return { feature, files };
}
function siblingTests(path) {
  const m = path.match(/^(.*\/)?([^/]+?)\.([cm]?[jt]sx?)$/);
  if (!m) return [];
  const dir = (m[1] || '').replace(/[.+^$()|[\]\\]/g, '\\$&');
  const stem = m[2].replace(/[.+^$()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`^${dir}(?:__tests__/)?${stem}\\.(?:test|spec)\\.[cm]?[jt]sx?$`),
    new RegExp(`^${dir}__tests__/${stem}\\.[cm]?[jt]sx?$`),
    new RegExp(`^${dir}(?:__tests__/)?__snapshots__/${stem}\\..+\\.snap$`),
  ];
}

// ---------- changed files ----------
const taskRef = val('--task');
const role = val('--role');
if (!taskRef && !role) die('pass --task <ID> or --role <role>');
let allowed;
let label;
let base = val('--base');
const head = val('--head') || 'HEAD';
if (taskRef) {
  const task = loadTask(taskRef);
  const { feature, files } = parseTask(task.text);
  if (!files.length) die(`${task.source} has no "Files it may touch" list`);
  const exact = matcher(files);
  const tests = files.filter((f) => !/[*?{]/.test(f)).flatMap(siblingTests);
  allowed = (p) => exact(p) || tests.some((r) => r.test(p));
  label = `task ${taskRef} (${files.length} allowed path(s))`;
  if (!base && feature && git('rev-parse', '--verify', '--quiet', `feature/${feature}`)) base = `feature/${feature}`;
} else {
  const globs = cfg.roles?.[role]?.allow;
  if (!globs?.length) die(`no allowlist for role "${role}" in .claude/ai-workflow.json`);
  allowed = matcher(globs);
  label = `role ${role}`;
}
if (!base) base = defaultBranch();
if (!base || !git('rev-parse', '--verify', '--quiet', base)) die(`base ref ${base} not found; pass --base`);
const changed = new Set(lines(git('diff', '--name-only', `${base}...${head}`)));
if (head === 'HEAD') {
  for (const f of lines(git('diff', '--name-only', 'HEAD'))) changed.add(f);
  for (const f of lines(git('ls-files', '--others', '--exclude-standard'))) changed.add(f);
}

const outside = [];
const artifacts = [];
for (const f of changed) {
  if (isArtifact(f)) artifacts.push(f);
  else if (!allowed(f)) outside.push(f);
}
if (outside.length || artifacts.length) {
  console.error(`SCOPE CHECK FAILED for ${label}, ${base}...${head}`);
  for (const f of outside) console.error(`- outside scope: ${f}`);
  for (const f of artifacts) console.error(`- build output: ${f} (never commit it; untrack with git rm --cached if it is tracked)`);
  console.error('Revert these files, or ask the Lead to change the task. Do not edit the task to pass this check.');
  process.exit(1);
}
console.log(`scope check passed for ${label}: ${changed.size} changed file(s) within scope`);
