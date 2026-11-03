#!/usr/bin/env node
// doctor.mjs (ai-workflow-setup): non-destructive checks behind /ai-workflow doctor.
//   node doctor.mjs [--gh] [--json] [--keep]   automatic checks; prints PASS/FAIL/WARN/SKIP/INFO per check
//   node doctor.mjs --live-rules write          write 3 temporary marker rules for the live subagent check
//   node doctor.mjs --live-rules remove         remove them (and .claude/rules if it is then empty)
// The hook checks run the repo's own hooks on synthetic payloads, from the main checkout and from a
// temporary detached worktree under .claude/worktrees/, which is removed afterwards (--keep keeps it).
// Nothing tracked is changed.
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, rmSync, rmdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, relative } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = readFileSync(join(HERE, '..', 'VERSION'), 'utf8').trim();
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 60000, cwd: opts.cwd, input: opts.input, env: opts.env || process.env });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const top = run('git', ['rev-parse', '--show-toplevel']);
if (top.code !== 0) { console.error('doctor: not a git repository'); process.exit(2); }
const ROOT = realpathSync(top.out);
const git = (...a) => run('git', a, { cwd: ROOT });
const readJson = (p) => { try { return JSON.parse(readFileSync(join(ROOT, p), 'utf8')); } catch { return null; } };

// ---------- temporary marker rules for the live check ----------
const RULES_DIR = join(ROOT, '.claude', 'rules');
const LIVE = [
  { key: 'A', file: 'zz-aiwf-doctor-a.md', paths: '["package.json"]', note: 'paths: package.json (project-root pattern)' },
  { key: 'B', file: 'zz-aiwf-doctor-b.md', paths: '["**/package.json"]', note: 'paths: **/package.json (any depth, includes .claude/worktrees/)' },
  { key: 'C', file: 'zz-aiwf-doctor-c.md', paths: null, note: 'no paths: always loaded (control)' },
];
if (val('--live-rules') === 'write') {
  mkdirSync(RULES_DIR, { recursive: true });
  const out = [];
  for (const r of LIVE) {
    const p = join(RULES_DIR, r.file);
    let marker = existsSync(p) ? (readFileSync(p, 'utf8').match(/AIWF-DOCTOR-[0-9a-f]+-[ABC]/) || [])[0] : null;
    if (!marker) {
      marker = `AIWF-DOCTOR-${randomBytes(4).toString('hex')}-${r.key}`;
      writeFileSync(p, `${r.paths ? `---\npaths: ${r.paths}\n---\n` : ''}Temporary ai-workflow doctor rule (${r.note}). Doctor marker: ${marker}\n`);
    }
    out.push(`${r.key}  ${marker}  .claude/rules/${r.file}  ${r.note}`);
  }
  console.log(`Temporary marker rules (never put these markers in a prompt):\n${out.join('\n')}\nRemove with: node <setup>/scripts/doctor.mjs --live-rules remove`);
  process.exit(0);
}
if (val('--live-rules') === 'remove') {
  let n = 0;
  for (const r of LIVE) { const p = join(RULES_DIR, r.file); if (existsSync(p)) { rmSync(p); n++; } }
  if (existsSync(RULES_DIR) && readdirSync(RULES_DIR).length === 0) rmdirSync(RULES_DIR);
  console.log(`removed ${n} temporary rule file(s)`);
  process.exit(0);
}

// ---------- automatic checks ----------
const results = [];
const add = (status, name, detail = '') => results.push({ status, name, detail });
const cmpVer = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

const cfg = readJson('.claude/ai-workflow.json');
if (cfg) add('PASS', 'config', '.claude/ai-workflow.json parses');
else add('FAIL', 'config', existsSync(join(ROOT, '.claude/ai-workflow.json')) ? '.claude/ai-workflow.json is not valid JSON' : 'no .claude/ai-workflow.json: run /ai-workflow init (or upgrade for a 1.x scaffold)');

const lock = readJson('.claude/ai-workflow.lock.json');
if (!lock) add('FAIL', 'lock file', 'no .claude/ai-workflow.lock.json: run /ai-workflow upgrade');
else if (cmpVer(lock.version, VERSION) < 0) add('WARN', 'lock file', `scaffolded with ${lock.version}, this skill is ${VERSION}: /ai-workflow upgrade`);
else add('PASS', 'lock file', `version ${lock.version}`);

const settings = readJson('.claude/settings.json');
if (!settings) add('FAIL', 'settings', '.claude/settings.json is missing or not valid JSON');
else {
  const deny = settings.permissions?.deny || [];
  const missing = ['Read(.env*)', 'Edit(.env*)'].filter((r) => !deny.includes(r));
  const neg = deny.map((r, i) => [r, i]).filter(([r]) => /^\w+\(!/.test(r));
  const lastPos = Math.max(-1, ...deny.map((r, i) => (/^\w+\(!/.test(r) ? -1 : i)));
  if (missing.length) add('WARN', 'settings: .env deny', `missing deny rule(s): ${missing.join(', ')}`);
  else if (neg.some(([, i]) => i < lastPos)) add('WARN', 'settings: .env deny', 'a negation rule (e.g. Read(!.env.example)) comes before other deny rules; negations only carve out of rules listed before them');
  else add('PASS', 'settings: .env deny', `.env* denied for Read and Edit${neg.length ? `, except ${neg.map(([r]) => r).join(', ')}` : ''}`);
}

const scripts = ['scripts', '.claude/hooks'].flatMap((d) => (existsSync(join(ROOT, d)) ? readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.mjs')).map((f) => `${d}/${f}`) : []));
const bad = scripts.filter((f) => run(process.execPath, ['--check', join(ROOT, f)]).code !== 0);
add(bad.length ? 'FAIL' : 'PASS', 'script syntax', bad.length ? `node --check failed: ${bad.join(', ')}` : `${scripts.length} script(s) pass node --check`);

const ignored = (p) => git('check-ignore', '-q', '--no-index', p).code === 0;
const mustIgnore = ['.claude/worktrees/x', '.ua/knowledge-graph.json', '.claude/settings.local.json'].filter((p) => !ignored(p));
const mustNot = ['CLAUDE.md', 'specs/README.md', '.claude/agents/dev.md', '.claude/skills/implement-task/SKILL.md', '.claude/ai-workflow.json', '.claude/ai-workflow.lock.json', 'scripts/scope-check.mjs', '.ua/.understandignore'].filter(ignored);
if (mustIgnore.length || mustNot.length) add('FAIL', '.gitignore', [mustIgnore.length && `should be ignored: ${mustIgnore.join(', ')}`, mustNot.length && `must not be ignored: ${mustNot.join(', ')}`].filter(Boolean).join('; '));
else add('PASS', '.gitignore', '.claude/worktrees/, the graph and settings.local.json are ignored; workflow files are not');

const claudeMd = existsSync(join(ROOT, 'CLAUDE.md')) ? readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8') : null;
if (claudeMd === null) add('FAIL', 'CLAUDE.md', 'missing');
else {
  const n = claudeMd.replace(/\n$/, '').split('\n').length;
  add(n < 200 ? 'PASS' : 'WARN', 'CLAUDE.md size', `${n} lines${n < 200 ? '' : ' (Claude Code advises under 200: move package rules to .claude/rules)'}`);
  if (!/<!-- ai-workflow:begin/.test(claudeMd)) add('WARN', 'CLAUDE.md block', 'no AI workflow block: run /ai-workflow upgrade');
}

const originHead = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
if (originHead.code !== 0) add('SKIP', 'default branch', 'no origin/HEAD (run git remote set-head origin --auto)');
else {
  const b = originHead.out.replace(/^origin\//, '');
  if (!cfg) add('SKIP', 'default branch', 'no config');
  else if (cfg.defaultBranch !== b) add('FAIL', 'default branch', `config says ${cfg.defaultBranch}, origin/HEAD is ${b}: fix defaultBranch in .claude/ai-workflow.json and run /ai-workflow upgrade`);
  else {
    const gates = existsSync(join(ROOT, '.github/workflows/ai-gates.yml')) ? readFileSync(join(ROOT, '.github/workflows/ai-gates.yml'), 'utf8') : '';
    const ok = !gates || new RegExp(`branches:\\s*\\[\\s*${b.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*\\]`).test(gates);
    add(ok ? 'PASS' : 'FAIL', 'default branch', ok ? `${b} (origin/HEAD) everywhere` : `ai-gates.yml does not trigger on ${b}`);
  }
}

for (const name of ['ai-workflow', 'ai-workflow-setup']) {
  const personal = join(homedir(), '.claude', 'skills', name, 'SKILL.md');
  const project = join(ROOT, '.claude', 'skills', name, 'SKILL.md');
  if (existsSync(personal) && existsSync(project)) add('WARN', `skill copy: ${name}`, `~/.claude/skills/${name} overrides the project copy (personal skills win); keep one`);
}

function expandBraces(p) {
  const m = p.match(/\{([^{}]*)\}/);
  if (!m) return [p];
  return m[1].split(',').flatMap((alt) => expandBraces(p.slice(0, m.index) + alt + p.slice(m.index + m[0].length)));
}
function globRe(glob) { // same semantics as scripts/scope-check.mjs
  return expandBraces(String(glob).trim().replace(/^\.?\//, '')).map((g) => {
    if (g.endsWith('/')) g += '**';
    let re = '';
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === '*' && g[i + 1] === '*') { if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; } }
      else if (c === '*') re += '[^/]*';
      else if (c === '?') re += '[^/]';
      else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
}
const artifactRe = (cfg?.artifacts || ['**/*.tsbuildinfo', '**/dist/**', '**/.next/**']).flatMap(globRe);
const trackedArtifacts = git('ls-files').out.split('\n').filter((f) => f && artifactRe.some((re) => re.test(f)));
add(trackedArtifacts.length ? 'FAIL' : 'PASS', 'tracked build output', trackedArtifacts.length ? `${trackedArtifacts.slice(0, 8).join(', ')}${trackedArtifacts.length > 8 ? ' …' : ''}: propose git rm --cached (stale *.tsbuildinfo makes tsc skip emitting on CI)` : 'none');

const step = (name, file, args) => {
  if (!existsSync(join(ROOT, file))) return add('FAIL', name, `${file} missing`);
  const r = run(process.execPath, [join(ROOT, file), ...args], { cwd: ROOT, timeout: 120000 });
  add(r.code === 0 ? 'PASS' : 'FAIL', name, r.code === 0 ? (r.out.split('\n').pop() || 'ok') : (r.err || r.out).split('\n').slice(0, 6).join(' | '));
};
step('rules-check', 'scripts/rules-check.mjs', []);
step('trace', 'scripts/trace.mjs', ['--check', '--quiet']);

const drift = run(process.execPath, [join(HERE, 'install.mjs'), '--check', '--root', ROOT], { cwd: ROOT });
add(drift.code === 0 ? 'PASS' : 'INFO', 'drift from templates', drift.code === 0 ? `generated files match the ${VERSION} templates` : `${drift.out.split('\n').filter((l) => l.startsWith('drift')).map((l) => l.slice(7)).join(', ')} (your edits or an older version; /ai-workflow upgrade shows the diff)`);

// rules fallback (D3): rules-check --for must print each rule for a file under its paths
const rulesFallback = [];
for (const r of cfg?.rules || []) {
  const glob = (r.paths || [])[0];
  if (!glob) continue;
  const prefix = glob.split(/[*?{]/)[0].replace(/\/$/, '');
  const sample = git('ls-files', '--', prefix || '.').out.split('\n').find((f) => f && f.startsWith(prefix));
  if (!sample) { rulesFallback.push(`${r.file}: no tracked file under ${glob}`); continue; }
  const out = run(process.execPath, [join(ROOT, 'scripts/rules-check.mjs'), '--for', sample], { cwd: ROOT }).out;
  if (!out.includes(r.file)) rulesFallback.push(`${r.file} not printed for ${sample}`);
}
if (!cfg?.rules?.length) add('SKIP', 'rules fallback', 'no .claude/rules files recorded in the config (conventions live in CLAUDE.md)');
else add(rulesFallback.length ? 'FAIL' : 'PASS', 'rules fallback', rulesFallback.length ? rulesFallback.join('; ') : `rules-check --for maps files to all ${cfg.rules.length} rule file(s); roles read them directly`);

// ---------- hooks, from the main checkout and from a temporary worktree ----------
const hookPaths = join(ROOT, '.claude/hooks/guard-paths.mjs');
const hookBash = join(ROOT, '.claude/hooks/guard-bash.mjs');
const tracked = git('ls-files').out.split('\n').filter(Boolean);
const TEST_RE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(^|\/)(__tests__|__mocks__|test|tests|e2e)\//;
const pkgDirs = (cfg?.packages || []).map((p) => p.dir).filter(Boolean);
const product = tracked.find((f) => /\.[cm]?[jt]sx?$/.test(f) && !TEST_RE.test(f) && !/\.d\.ts$/.test(f) && !/^(scripts|\.claude|\.github)\//.test(f) && !/(^|\/)[^/]*\.config\.[^/]+$/.test(f)
  && (pkgDirs.length === 0 || pkgDirs.some((d) => d === '.' || f.startsWith(`${d}/`)))) || 'package.json';
const firstPkg = pkgDirs.find((d) => d !== '.') || '.';
const testFile = `${firstPkg === '.' ? '' : `${firstPkg}/`}src/zz-aiwf-doctor.test.ts`;
const hasDesigner = existsSync(join(ROOT, '.claude/agents/designer.md'));

function hook(script, role, cwd, filePath) {
  const payload = { session_id: 'aiwf-doctor', hook_event_name: 'PreToolUse', cwd, tool_name: 'Write', tool_input: { file_path: filePath, content: 'x' } };
  return run(process.execPath, [script, role], { cwd: ROOT, input: JSON.stringify(payload), env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } }).code;
}
function hookCases(where, base) {
  const cases = [
    ['tester', 'specs/zz-doctor/qa.md', 0], ['tester', testFile, 0], ['tester', product, 2],
    ['tester', join(tmpdir(), 'zz-aiwf-doctor.txt'), 2, true],
  ];
  if (hasDesigner) cases.push(['designer', 'specs/zz-doctor/design.md', 0], ['designer', 'specs/zz-doctor/mockups/a.html', 0], ['designer', product, 2]);
  const fails = [];
  for (const [role, p, want, absolute] of cases) {
    const got = hook(hookPaths, role, base, absolute ? p : join(base, p));
    if (got !== want) fails.push(`${role} ${absolute ? p : p} -> exit ${got}, expected ${want}`);
  }
  // relative path, resolved against the agent's cwd
  const rel = hook(hookPaths, 'tester', base, 'specs/zz-doctor/qa.md');
  if (rel !== 0) fails.push(`tester relative specs/zz-doctor/qa.md -> exit ${rel}, expected 0`);
  return { fails, n: cases.length + 1, where };
}
// ESLint flat config and Vitest/Jest defaults do not skip dot-directories: run from the main checkout,
// they also read the agents' unfinished work under .claude/worktrees/ and turn verify red.
function toolProbe(wt) {
  const found = [];
  let probed = 0;
  for (const p of cfg?.packages || []) {
    const dir = join(ROOT, p.dir);
    const bin = (name) => [join(dir, 'node_modules', '.bin', name), join(ROOT, 'node_modules', '.bin', name)].find(existsSync);
    const inPkg = (f) => (p.dir === '.' ? !pkgDirs.some((d) => d !== '.' && f.startsWith(`${d}/`)) : f.startsWith(`${p.dir}/`));
    const sample = tracked.find((f) => inPkg(f) && /\.[cm]?[jt]sx?$/.test(f) && !/\.d\.ts$/.test(f) && !/^(\.claude|scripts)\//.test(f));
    const eslint = bin('eslint');
    if (eslint && sample) {
      probed++;
      const r = run(eslint, ['--no-warn-ignored', '--format', 'json', join(wt, sample)], { cwd: dir, timeout: 120000 });
      let res = [];
      try { res = JSON.parse(r.out || '[]'); } catch { /* ESLint 8 (eslintrc) ignores dot-directories anyway */ }
      if (res.length) found.push(`eslint in ${p.dir} lints .claude/worktrees/: add ".claude/**" to its ignores`);
    }
    if (p.testRunner === 'vitest' && bin('vitest')) {
      probed++;
      if (run(bin('vitest'), ['list', '--filesOnly'], { cwd: dir, timeout: 180000 }).out.includes('.claude/worktrees/')) found.push(`vitest in ${p.dir} collects tests from .claude/worktrees/: add ".claude/**" to test.exclude (keep configDefaults.exclude)`);
    }
    if (p.testRunner === 'jest' && bin('jest')) {
      probed++;
      if (run(bin('jest'), ['--listTests'], { cwd: dir, timeout: 180000 }).out.includes('.claude/worktrees/')) found.push(`jest in ${p.dir} collects tests from .claude/worktrees/: add "<rootDir>/.claude/" to testPathIgnorePatterns and modulePathIgnorePatterns`);
    }
  }
  if (!probed) add('SKIP', 'lint/tests ignore worktrees', 'no installed eslint, vitest or jest to probe (install dependencies first)');
  else add(found.length ? 'WARN' : 'PASS', 'lint/tests ignore worktrees', found.length ? `${found.join('; ')}. Propose the change to the user; until then a verify in the main checkout can fail on other agents' work` : `${probed} probe(s): lint and test runs in the main checkout skip .claude/worktrees/`);
}

if (!existsSync(hookPaths)) add('FAIL', 'guard-paths', '.claude/hooks/guard-paths.mjs missing');
else {
  const main = hookCases('main checkout', ROOT);
  add(main.fails.length ? 'FAIL' : 'PASS', 'guard-paths (main checkout)', main.fails.length ? main.fails.join('; ') : `${main.n} cases as expected (qa.md and tests allowed, ${product} and outside paths blocked)`);
  const wtParent = join(ROOT, '.claude', 'worktrees');
  mkdirSync(wtParent, { recursive: true });
  const wt = mkdtempSync(join(wtParent, 'aiwf-doctor-'));
  rmSync(wt, { recursive: true, force: true });
  const addWt = git('worktree', 'add', '--detach', wt, 'HEAD');
  if (addWt.code !== 0) add('FAIL', 'guard-paths (worktree)', `git worktree add failed: ${addWt.err}`);
  else {
    try {
      const w = hookCases('worktree', wt);
      // a worktree agent must not write into the main checkout either
      const cross = hook(hookPaths, 'tester', wt, join(ROOT, 'specs/zz-doctor/qa.md'));
      if (cross !== 2) w.fails.push(`tester in the worktree writing the main checkout -> exit ${cross}, expected 2`);
      add(w.fails.length ? 'FAIL' : 'PASS', 'guard-paths (worktree)', w.fails.length ? w.fails.join('; ') : `${w.n + 1} cases as expected with cwd ${relative(ROOT, wt)} (paths resolved from the hook input's cwd)`);
      toolProbe(wt);
    } finally {
      if (!flag('--keep')) { git('worktree', 'remove', wt); git('worktree', 'prune'); }
    }
  }
}
if (!existsSync(hookBash)) add('SKIP', 'guard-bash', '.claude/hooks/guard-bash.mjs missing');
else {
  const cases = [
    ['git diff feature/x...task/T-001 --stat', 0], ['node scripts/rules-check.mjs --for-diff feature/x --head task/T-001', 0],
    ['git log --oneline -5 | head -3', 0], ['gh pr view 12 --json title', 0], ['grep -rn "a|b" src', 0],
    ['git commit -m x', 2], ['echo hi > x.txt', 2], ['rm -rf node_modules', 2], ['find . -name "*.ts" -delete', 2],
    ['git -c diff.external=sh diff', 2], ['git branch -a -D main', 2], ['node scripts/trace.mjs f --check --write', 2],
    ['cat $(echo package.json)', 2], ['gh pr review 1 --approve', 2],
  ];
  const fails = cases.filter(([c, want]) => run(process.execPath, [hookBash, 'reviewer'], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: c } }) }).code !== want).map(([c, want]) => `"${c}" expected exit ${want}`);
  add(fails.length ? 'FAIL' : 'PASS', 'guard-bash (reviewer)', fails.length ? fails.join('; ') : `${cases.length} commands judged as expected (reads allowed; writes, git -c, substitution, redirection blocked)`);
}

// ---------- worktrees left on disk ----------
const wts = git('worktree', 'list', '--porcelain').out.split('\n\n').map((b) => ({ path: (b.match(/^worktree (.*)$/m) || [])[1], branch: (b.match(/^branch refs\/heads\/(.*)$/m) || [])[1], locked: /^locked/m.test(b) })).filter((w) => w.path && w.path !== ROOT);
if (wts.length) add('INFO', 'worktrees on disk', wts.map((w) => `${relative(ROOT, w.path) || w.path} [${w.branch || 'detached'}${w.locked ? ', locked' : ''}]`).join('; '));

// ---------- GitHub ----------
if (flag('--gh')) {
  const auth = run('gh', ['auth', 'status'], { cwd: ROOT, timeout: 15000 });
  if (auth.code !== 0) add('SKIP', 'ai-gates on GitHub', 'gh is not installed or not signed in');
  else {
    const runs = run('gh', ['run', 'list', '--workflow', 'ai-gates.yml', '--limit', '5', '--json', 'status,conclusion,headBranch,event,url,createdAt'], { cwd: ROOT, timeout: 30000 });
    let list = [];
    try { list = JSON.parse(runs.out || '[]'); } catch { /* ignore */ }
    if (runs.code !== 0) add('SKIP', 'ai-gates on GitHub', `cannot list runs: ${runs.err.split('\n')[0]} (is ai-gates.yml on the default branch yet?)`);
    else if (!list.length) add('INFO', 'ai-gates on GitHub', 'never ran: push a branch or open a PR; local green is not CI green');
    else {
      const last = list[0];
      const done = last.status === 'completed';
      add(!done ? 'INFO' : last.conclusion === 'success' ? 'PASS' : 'FAIL', 'ai-gates on GitHub', `last run ${done ? last.conclusion : last.status} on ${last.headBranch} (${last.event}, ${last.createdAt}) ${last.url}`);
    }
    if (cfg?.tracker === 'github') {
      const labels = run('gh', ['label', 'list', '--limit', '500', '--json', 'name', '--jq', '.[].name'], { cwd: ROOT, timeout: 30000 });
      const names = labels.out.split('\n');
      add(labels.code !== 0 ? 'SKIP' : names.includes('task') ? 'PASS' : 'WARN', 'label task', labels.code !== 0 ? 'cannot list labels' : names.includes('task') ? 'exists' : 'missing: gh label create task --description "AI workflow task"');
    }
  }
} else add('SKIP', 'ai-gates on GitHub', 'run with --gh to check the last runs');

if (flag('--json')) console.log(JSON.stringify({ version: VERSION, root: ROOT, results }, null, 2));
else {
  const w = Math.max(...results.map((r) => r.name.length));
  console.log(`ai-workflow doctor ${VERSION} on ${ROOT}`);
  for (const r of results) console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(w)}  ${r.detail}`);
}
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
