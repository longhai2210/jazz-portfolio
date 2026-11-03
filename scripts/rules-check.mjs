#!/usr/bin/env node
// rules-check.mjs: keep convention rules honest and find the ones that apply.
//   node scripts/rules-check.mjs                 fail if a rule's example file is gone, or CLAUDE.md
//                                                names a rule file that does not exist; warn when a
//                                                rule's paths match no tracked file
//   node scripts/rules-check.mjs --for <files>   print the rule files that apply to these files
//   node scripts/rules-check.mjs --for-diff <base> [--head <ref>]   same, for files changed in
//                                                <base>...<head> (head HEAD adds uncommitted files)
// Rule files: .claude/rules/**/*.md with optional `paths:` front matter (no paths = applies everywhere).
// Examples are written as  Example: `path/to/file.ts`  (several: Examples: `a.ts`, `b.ts`).
// Roles read the printed files themselves: path-scoped rules do not load in subagent worktrees
// or from `git diff`, so auto-loading is never relied on.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';

const argv = process.argv.slice(2);
const git = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};
const lines = (s) => (s ? s.split('\n').map((l) => l.trim()).filter(Boolean) : []);
const root = (git('rev-parse', '--show-toplevel') || process.cwd()).trim();
process.chdir(root);

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

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
  });
}
function parseRule(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  let paths = [];
  if (fm) {
    const inline = fm[1].match(/^paths:\s*\[(.*)\]\s*$/m);
    const single = fm[1].match(/^paths:\s*["']?([^"'\n[\]]+)["']?\s*$/m);
    const list = fm[1].match(/^paths:\s*\n((?:\s+-\s*.*\n?)*)/m);
    if (inline) paths = inline[1].split(',');
    else if (list) paths = list[1].split('\n').map((l) => l.replace(/^\s*-\s*/, ''));
    else if (single) paths = [single[1]];
    paths = paths.map((p) => p.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return { file: relative(root, file).split('\\').join('/'), text, paths };
}
const rules = walk(join(root, '.claude', 'rules')).map(parseRule);

function applying(files) {
  const out = new Set();
  for (const r of rules) {
    if (!r.paths.length) { out.add(r.file); continue; }
    const res = r.paths.flatMap(globRe);
    if (files.some((f) => res.some((re) => re.test(f)))) out.add(r.file);
  }
  return [...out];
}

const forIdx = argv.indexOf('--for');
const diffIdx = argv.indexOf('--for-diff');
if (forIdx >= 0 || diffIdx >= 0) {
  let files = [];
  if (forIdx >= 0) for (const a of argv.slice(forIdx + 1)) { if (a.startsWith('--')) break; files.push(a); }
  if (diffIdx >= 0) {
    const base = argv[diffIdx + 1];
    const headIdx = argv.indexOf('--head');
    const head = headIdx >= 0 ? argv[headIdx + 1] : 'HEAD';
    files = [...new Set([
      ...lines(git('diff', '--name-only', `${base}...${head}`)),
      ...(head === 'HEAD' ? lines(git('diff', '--name-only', 'HEAD')) : []),
      ...(head === 'HEAD' ? lines(git('ls-files', '--others', '--exclude-standard')) : []),
    ])];
  }
  files = files.map((f) => relative(root, join(root, f)).split('\\').join('/'));
  const list = applying(files);
  console.log('Read before changing or reviewing these files:');
  console.log('- CLAUDE.md (repo-wide rules, Rules map, Contracts to review)');
  for (const f of list) console.log(`- ${f}`);
  if (!list.length) console.log('- no path-scoped rule matches; CLAUDE.md conventions apply');
  process.exit(0);
}

// ---------- check ----------
const errors = [];
const warnings = [];
const tracked = lines(git('ls-files'));
const EXAMPLE_RE = /\bExamples?:\s*((?:`[^`\n]+`[\s,;]*(?:and\s+)?)+)/gi;
function checkExamples(file, text) {
  for (const m of text.matchAll(EXAMPLE_RE)) {
    for (const t of m[1].matchAll(/`([^`\n]+)`/g)) {
      const p = t[1].trim().replace(/:\d+(?:-\d+)?$/, '').replace(/^\.\//, '');
      if (/^<.*>$/.test(p)) { errors.push(`${file}: unfilled placeholder Example: \`${p}\``); continue; }
      if (/[*?{}\s]/.test(p)) continue; // a glob or a command, not a file reference
      if (!existsSync(join(root, p))) errors.push(`${file}: example ${p} does not exist (update the rule or pick a new example)`);
    }
  }
}
for (const r of rules) {
  checkExamples(r.file, r.text);
  if (r.paths.length && tracked.length) {
    const res = r.paths.flatMap(globRe);
    if (!tracked.some((f) => res.some((re) => re.test(f)))) warnings.push(`${r.file}: paths ${r.paths.join(', ')} match no tracked file`);
  }
}
if (existsSync('CLAUDE.md')) {
  const text = readFileSync('CLAUDE.md', 'utf8');
  checkExamples('CLAUDE.md', text);
  for (const m of text.matchAll(/`(\.claude\/rules\/[^`\s]+\.md)`/g)) {
    if (!existsSync(join(root, m[1]))) errors.push(`CLAUDE.md: rule file ${m[1]} does not exist`);
  }
}
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) { console.error('RULES CHECK FAILED\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`rules check passed: ${rules.length} rule file(s)`);
