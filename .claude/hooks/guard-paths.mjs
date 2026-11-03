#!/usr/bin/env node
// PreToolUse(Edit|Write|NotebookEdit) hook for the tester and designer roles: blocks file writes
// outside the role's allowed paths. Paths are resolved against the checkout the agent works in,
// taken from the hook input's `cwd` (the worktree for isolated subagents). This process's own cwd
// and $CLAUDE_PROJECT_DIR point at the main checkout, so they are not used for the check.
// Allowed globs: roles.<role>.allow in .claude/ai-workflow.json (written by /ai-workflow init).
// Usage in an agent's frontmatter: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs" tester
// Limit: only Edit/Write/NotebookEdit reach this hook; scripts/scope-check.mjs catches Bash writes.
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { relative, isAbsolute, resolve, dirname, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULTS = {
  tester: ['**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', '**/__tests__/**', '**/__mocks__/**',
    '**/__snapshots__/**', '**/test/**', '**/tests/**', '**/e2e/**', 'specs/*/qa.md'],
  designer: ['specs/*/design.md', 'specs/*/mockups/**'],
};
const role = process.argv[2];
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const file = input.tool_input?.file_path || input.tool_input?.notebook_path;
if (!role || !file) process.exit(0);

let allow = DEFAULTS[role];
try {
  const cfgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'ai-workflow.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  if (Array.isArray(cfg.roles?.[role]?.allow) && cfg.roles[role].allow.length) allow = cfg.roles[role].allow;
} catch { /* defaults */ }
if (!allow) process.exit(0);

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
// Resolve symlinks on the longest existing prefix (e.g. /tmp -> /private/tmp on macOS).
function real(p) {
  let cur = p;
  const rest = [];
  while (!existsSync(cur) && dirname(cur) !== cur) { rest.unshift(basename(cur)); cur = dirname(cur); }
  try { cur = realpathSync(cur); } catch { /* keep */ }
  return rest.length ? join(cur, ...rest) : cur;
}
function block(msg) { process.stderr.write(msg); process.exit(2); }

const cwd = input.cwd || process.cwd();
let root = cwd;
try {
  root = execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch { /* not a git dir: use cwd */ }
const abs = real(isAbsolute(file) ? file : resolve(cwd, file));
const rel = relative(real(root), abs).split('\\').join('/');
if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
  block(`${abs} is outside the checkout you work in (${root}). Edit files inside your own worktree only.`);
}
if (allow.flatMap(globRe).some((re) => re.test(rel))) process.exit(0);
block(`The ${role} role may not edit ${rel}. Allowed: ${allow.join(', ')}. ` +
  'If the change is needed, report it to the Lead instead of making it.');
