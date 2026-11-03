#!/usr/bin/env node
// install.mjs (ai-workflow-setup): writes the workflow files into a repo from ../templates.
//   node install.mjs --config .claude/ai-workflow.json [--root .] [--dry-run] [--json]     first install
//   node install.mjs --upgrade --config .claude/ai-workflow.json [--accept a,b] [--keep c,d] [--dry-run]  upgrade
//   node install.mjs --diff <path> --config ...     show the template's version of one file as a diff
//   node install.mjs --check --config ...           exit 1 when generated files drift from the templates
// Templates use @@VAR@@ and line blocks @@if:FLAG@@ / @@unless:FLAG@@ ... @@end@@.
// The lock file (.claude/ai-workflow.lock.json) records the skill version and a hash of every file
// written. On upgrade: files the user did not edit are updated; files the user edited are kept and
// reported as conflicts (see them with --diff, take the template with --accept, or keep yours with
// --keep, which records that you saw this template so the next upgrade asks only if it changes again).
// Without a lock entry, any difference from the template counts as a user edit. Taking an agent
// template always keeps the user's model/effort/color lines.
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TPL = join(HERE, '..', 'templates');
const VERSION = readFileSync(join(HERE, '..', 'VERSION'), 'utf8').trim();
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const die = (m, code = 1) => { console.error(`install: ${m}`); process.exit(code); };

const gitTop = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', cwd: resolve(val('--root') || '.') });
const ROOT = gitTop.status === 0 ? gitTop.stdout.trim() : resolve(val('--root') || '.');
const cfgPath = resolve(val('--config') || join(ROOT, '.claude', 'ai-workflow.json'));
if (!existsSync(cfgPath)) die(`config not found: ${cfgPath} (run detect.mjs --config-out first)`);
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const DRY = flag('--dry-run');
const UPGRADE = flag('--upgrade');
const ACCEPT = new Set((val('--accept') || '').split(',').map((s) => s.trim()).filter(Boolean));
const KEEP = new Set((val('--keep') || '').split(',').map((s) => s.trim()).filter(Boolean));
const LOCK_PATH = '.claude/ai-workflow.lock.json';
const BLOCK_KEY = 'CLAUDE.md#ai-workflow';

// ---------- helpers ----------
const norm = (s) => s.replace(/\r\n/g, '\n');
const hash = (s) => createHash('sha256').update(norm(s)).digest('hex').slice(0, 16);
const LOOSE_KEYS = /^(model|effort|color):.*$/gm;
const looseOf = (s) => hash(norm(s).replace(/^---\n[\s\S]*?\n---/, (fm) => fm.replace(LOOSE_KEYS, '')));
const readRepo = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);
function writeRepo(p, content, exec) {
  if (DRY) return;
  const abs = join(ROOT, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  if (exec) try { chmodSync(abs, 0o755); } catch { /* windows */ }
}
const md = (s) => String(s ?? '').replace(/\|/g, '\\|');
// settings.json is compared as data (key order and formatting do not count as edits)
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const sameJson = (a, b) => { try { return JSON.stringify(canon(JSON.parse(a))) === JSON.stringify(canon(JSON.parse(b))); } catch { return false; } };

// ---------- context ----------
const pm = cfg.packageManager || 'npm';
const pkgs = cfg.packages || [];
const c = cfg.commands || {};
function testGuide() {
  const out = [];
  for (const p of pkgs) {
    const where = p.dir === '.' ? 'the app' : `\`${p.dir}\``;
    const runner = p.testRunner ? `${p.testRunner}` : 'no test runner yet (report it)';
    const ex = p.testExamples?.length ? ` Copy the style of ${p.testExamples.map((e) => `\`${e}\``).join(', ')}.` : '';
    if (p.kind === 'frontend' || p.kind === 'mobile') {
      let s = `- ${where} (${p.framework}, ${runner}): `;
      s += p.testingLibrary ? 'render components with Testing Library and assert what the user sees (roles, labels, text). ' : 'test components through their public props and rendered output. ';
      s += p.msw ? `Mock the network with the MSW handlers in \`${p.msw}\`.` : 'Mock the network at the API-client module with the runner\'s module mocks.';
      if (p.playwright) s += ` User flows: Playwright (\`${p.playwright}\`) with the API mocked by route interception.`;
      else s += ' No browser e2e tool is installed: cover flows with component tests and note the gap in qa.md.';
      out.push(s + ex);
    } else if (p.kind === 'backend') {
      let s = `- ${where} (${p.framework}, ${runner}): `;
      if (p.framework === 'nestjs' && p.nestTesting) s += 'unit-test services with `Test.createTestingModule` and mocked providers; test controllers through the module. ';
      else s += 'unit-test handlers and services with their dependencies mocked. ';
      s += p.supertest ? 'HTTP behaviour (status codes, validation errors) with supertest against the app.' : 'Assert status codes and validation errors through the handler, since no HTTP test client is installed.';
      out.push(s + ex);
    } else out.push(`- ${where} (library, ${runner}): table tests over inputs and boundaries; no mocks unless the module does I/O.${ex}`);
  }
  return out.join('\n') || '- no packages detected: follow the existing tests';
}
function packagesTable() {
  const rows = ['| Package | Stack | Scoped verify | Test examples | i18n |', '|---|---|---|---|---|'];
  for (const p of pkgs) {
    rows.push(`| \`${p.dir}\` | ${p.framework && p.framework !== p.kind ? `${md(p.framework)} (${p.kind})` : p.kind}, ${md(p.testRunner || 'no tests')} | ${p.scopedVerify ? `\`${md(p.scopedVerify)}\`` : '-'} | ${(p.testExamples || []).map((e) => `\`${e}\``).join('<br>') || '-'} | ${p.i18n ? md([p.i18n.lib, ...(p.i18n.dirs || []).map((d) => `\`${d}\``)].filter(Boolean).join(', ')) : 'no'} |`);
  }
  const tokens = pkgs.flatMap((p) => p.tokens || []);
  if (tokens.length) rows.push('', `Design tokens: ${tokens.map((t) => `\`${t}\``).join(', ')}`);
  return rows.join('\n');
}
function rulesTable() {
  if (!cfg.rules?.length) return '- No rule files yet: conventions live in this file.';
  return ['| Paths | Rule file |', '|---|---|', ...cfg.rules.map((r) => `| ${(r.paths || []).map((x) => `\`${x}\``).join(', ')} | \`${r.file}\` |`)].join('\n');
}
const vars = {
  DEFAULT_BRANCH: cfg.defaultBranch || 'main',
  INSTALL_CMD: c.install || `${pm} install`,
  CODEGEN_CMD: c.codegen || '',
  WORKTREE_SETUP_CMD: c.worktreeSetup || c.install || `${pm} install`,
  VERIFY_CMD: c.verify || `${pm} run verify`,
  E2E_CMD: c.e2e || '',
  E2E_INSTALL_CMD: c.e2eInstall || '',
  E2E_RUN_HINT: c.e2e ? `, and \`${c.e2e}\` for user flows` : '',
  NODE_VERSION_FILE: cfg.nodeVersionFile || '.nvmrc',
  PNPM_VERSION: cfg.pnpmVersion || '9',
  NODE_CACHE_NAME: pm,
  CI_ENV: Object.entries(cfg.ci?.env || {}).map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`).join('\n'),
  TRACKER_LINE: cfg.tracker === 'github' ? 'GitHub Issues with the `task` label, plus `feature:<feature>`.' : '`tasks/T-NNN.md` files (see tasks/README.md).',
  PACKAGES_TABLE: packagesTable(),
  RULES_TABLE: rulesTable(),
  HOT_FILES: (cfg.hotFiles || []).length ? cfg.hotFiles.map((h) => `- \`${h}\``).join('\n') : '- none recorded yet (the Lead adds them in plan)',
  ROLES_LINE: cfg.hasFrontend ? 'designer, dev, tester, reviewer' : 'dev, tester, reviewer; no designer because the repo has no frontend',
  TEST_GUIDE: testGuide(),
};
const flags = {
  HAS_FRONTEND: !!cfg.hasFrontend,
  GITHUB_TRACKER: cfg.tracker === 'github',
  FILES_TRACKER: cfg.tracker !== 'github',
  PNPM: pm === 'pnpm',
  BUN: pm === 'bun',
  YARN_BERRY: pm === 'yarn' && !!cfg.yarnBerry,
  PNPM_SETUP_VERSION: pm === 'pnpm' && !cfg.packageManagerField,
  NODE_CACHE: ['npm', 'pnpm', 'yarn'].includes(pm),
  HAS_CODEGEN: !!c.codegen,
  HAS_E2E: !!c.e2e,
  HAS_CI_ENV: Object.keys(cfg.ci?.env || {}).length > 0,
};

// ---------- template engine ----------
function render(text, file) {
  const out = [];
  const stack = [];
  for (const line of norm(text).split('\n')) {
    const cond = line.match(/^\s*@@(if|unless):([A-Z0-9_]+)@@\s*$/);
    if (cond) {
      if (!(cond[2] in flags)) throw new Error(`${file}: unknown flag ${cond[2]}`);
      stack.push(cond[1] === 'if' ? flags[cond[2]] : !flags[cond[2]]);
      continue;
    }
    if (/^\s*@@end@@\s*$/.test(line)) { if (!stack.length) throw new Error(`${file}: @@end@@ without @@if@@`); stack.pop(); continue; }
    if (stack.includes(false)) continue;
    const whole = line.match(/^(\s*)@@([A-Z0-9_]+)@@\s*$/);
    if (whole) {
      if (!(whole[2] in vars)) throw new Error(`${file}: unknown variable ${whole[2]}`);
      const v = String(vars[whole[2]]);
      if (v === '') continue;
      out.push(...v.split('\n').map((l) => (l ? whole[1] + l : l)));
      continue;
    }
    out.push(line.replace(/@@([A-Z0-9_]+)@@/g, (_, k) => {
      if (!(k in vars)) throw new Error(`${file}: unknown variable ${k}`);
      return vars[k];
    }));
  }
  if (stack.length) throw new Error(`${file}: unclosed @@if@@`);
  const res = out.join('\n');
  const left = res.match(/@@[A-Za-z0-9_:]+@@/);
  if (left) throw new Error(`${file}: unreplaced ${left[0]}`);
  return res;
}

// ---------- settings merge ----------
function mergeSettings(cur, tpl) {
  const out = JSON.parse(JSON.stringify(cur || {}));
  out.env = { ...(tpl.env || {}), ...(out.env || {}) };
  out.permissions = out.permissions || {};
  for (const k of ['allow', 'deny', 'ask']) {
    const list = [...(out.permissions[k] || [])];
    for (const r of tpl.permissions?.[k] || []) if (!list.includes(r)) list.push(r);
    // gitignore-style negations only carve out of rules listed before them: keep them last
    if (list.length) out.permissions[k] = [...list.filter((r) => !/^\w+\(!/.test(r)), ...list.filter((r) => /^\w+\(!/.test(r))];
  }
  out.hooks = out.hooks || {};
  for (const [event, groups] of Object.entries(tpl.hooks || {})) {
    const have = out.hooks[event] || [];
    const cmds = new Set(have.flatMap((g) => (g.hooks || []).map((h) => h.command)));
    for (const g of groups) if (!(g.hooks || []).every((h) => cmds.has(h.command))) have.push(g);
    out.hooks[event] = have;
  }
  return JSON.stringify(out, null, 2) + '\n';
}
// keep the user's model/effort/color lines when taking a new agent template
function keepFrontmatter(next, cur) {
  const fm = (s) => (norm(s).match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  const userKeys = Object.fromEntries([...fm(cur).matchAll(/^(model|effort|color):\s*(.*)$/gm)].map((m) => [m[1], m[2]]));
  return norm(next).replace(/^---\n[\s\S]*?\n---/, (block) => {
    let b = block;
    for (const [k, v] of Object.entries(userKeys)) {
      b = new RegExp(`^${k}:`, 'm').test(b) ? b.replace(new RegExp(`^${k}:.*$`, 'm'), `${k}: ${v}`) : b.replace(/\n---$/, `\n${k}: ${v}\n---`);
    }
    return b;
  });
}

// ---------- plan ----------
const manifest = JSON.parse(readFileSync(join(TPL, 'manifest.json'), 'utf8'));
const lockText = readRepo(LOCK_PATH);
const lock = lockText ? JSON.parse(lockText) : null;
if (!UPGRADE && !flag('--diff') && !flag('--check') && lock) die(`already scaffolded with ai-workflow ${lock.version}; run /ai-workflow upgrade`, 3);
const newer = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
if (lock && newer(lock.version, VERSION) && !flag('--diff') && !flag('--check')) die(`this repo was scaffolded with ai-workflow ${lock.version}, newer than this skill (${VERSION}); install the newer skill instead`, 3);
const newLock = { skill: 'ai-workflow', version: VERSION, updatedAt: new Date().toISOString(), files: { ...(lock?.files || {}) } };
const report = { version: VERSION, from: lock?.version || null, mode: UPGRADE ? 'upgrade' : 'init', created: [], updated: [], unchanged: [], keptUserEdit: [], keptByChoice: [], conflicts: [], skipped: [], notApplicable: [], deleted: [], scripts: [], gitignore: [], notes: [] };

function renderEntry(e) {
  const tplText = readFileSync(join(TPL, 'files', e.path), 'utf8');
  return render(tplText, e.path);
}
const entries = manifest.files.filter((e) => {
  const ok = !e.when || flags[e.when];
  if (!ok && newLock.files[e.path]) report.notApplicable.push(e.path);
  return ok;
});

// the managed block, without trailing whitespace, exactly as BLOCK_RE matches it in CLAUDE.md
const renderBlock = () => render(readFileSync(join(TPL, 'claude-block.md'), 'utf8'), 'claude-block.md').replace(/\s+$/, '');

// --diff and --check
const BLOCK_RE = /<!-- ai-workflow:begin[\s\S]*?<!-- ai-workflow:end -->/;
if (flag('--diff') || flag('--check')) {
  const blockEntry = { path: 'CLAUDE.md', block: true };
  const all = [...entries, blockEntry];
  const targets = flag('--diff') ? all.filter((e) => e.path === val('--diff')) : all;
  if (flag('--diff') && !targets.length) die(`no template for ${val('--diff')}`);
  let drift = 0;
  for (const e of targets) {
    if (e.block) {
      const doc = readRepo('CLAUDE.md');
      const cur = doc && BLOCK_RE.test(doc) ? doc.match(BLOCK_RE)[0] : null;
      const next = renderBlock();
      if (cur !== null && hash(cur) === hash(next)) continue;
      drift++;
      if (flag('--diff')) {
        const dir = mkdtempSync(join(tmpdir(), 'aiwf-diff-'));
        writeFileSync(join(dir, 'template'), next);
        writeFileSync(join(dir, 'current'), cur ?? '');
        const r = spawnSync('git', ['diff', '--no-index', '--no-color', join(dir, 'current'), join(dir, 'template')], { encoding: 'utf8' });
        console.log(`--- CLAUDE.md AI workflow block (yours)\n+++ template ${VERSION}\n${r.stdout.split('\n').slice(4).join('\n')}`);
        rmSync(dir, { recursive: true, force: true });
      } else console.log(`drift: CLAUDE.md AI workflow block${cur === null ? ' (missing)' : ''}`);
      continue;
    }
    const cur = readRepo(e.path);
    if (e.mode === 'if-absent' && cur !== null && !lock?.files?.[e.path]) continue; // the user's own file
    let next = renderEntry(e);
    if (e.mode === 'merge-settings') next = mergeSettings(cur ? JSON.parse(cur) : {}, JSON.parse(next));
    if (e.loose && cur) next = keepFrontmatter(next, cur);
    if (cur !== null && (hash(cur) === hash(next) || (e.mode === 'merge-settings' && sameJson(cur, next)))) continue;
    drift++;
    if (flag('--diff')) {
      const dir = mkdtempSync(join(tmpdir(), 'aiwf-diff-'));
      writeFileSync(join(dir, 'template'), next);
      if (cur !== null) writeFileSync(join(dir, 'current'), cur);
      const r = spawnSync('git', ['diff', '--no-index', '--no-color', cur !== null ? join(dir, 'current') : '/dev/null', join(dir, 'template')], { encoding: 'utf8' });
      console.log(`--- ${e.path} (yours)\n+++ ${e.path} (template ${VERSION})\n${r.stdout.split('\n').slice(4).join('\n')}`);
      rmSync(dir, { recursive: true, force: true });
    } else console.log(`drift: ${e.path}${cur === null ? ' (missing)' : ''}`);
  }
  if (flag('--check')) console.log(drift ? `${drift} generated file(s) differ from the ${VERSION} templates` : `all generated files match the ${VERSION} templates`);
  process.exit(flag('--check') && drift ? 1 : 0);
}

for (const e of entries) {
  const cur = readRepo(e.path);
  let next = renderEntry(e);
  const base = lock?.files?.[e.path] || null;
  if (e.mode === 'if-absent' && !base) { // never replace the user's own file; once we created it, it upgrades like the rest
    if (cur === null) { writeRepo(e.path, next); report.created.push(e.path); newLock.files[e.path] = { hash: hash(next) }; }
    else report.skipped.push(`${e.path} (you have your own; kept)`);
    continue;
  }
  if (e.mode === 'merge-settings') {
    const merged = mergeSettings(cur ? JSON.parse(cur) : {}, JSON.parse(next));
    if (cur !== null && (hash(cur) === hash(merged) || sameJson(cur, merged))) { report.unchanged.push(e.path); newLock.files[e.path] = { hash: hash(cur) }; continue; }
    if (cur === null || !UPGRADE || (base && hash(cur) === base.hash) || ACCEPT.has(e.path)) {
      writeRepo(e.path, merged);
      (cur === null ? report.created : report.updated).push(cur === null ? e.path : `${e.path} (merged: your entries kept, missing ones added)`);
      newLock.files[e.path] = { hash: hash(merged) };
    } else { report.conflicts.push(e.path); }
    continue;
  }
  const tplHash = hash(next);
  const entryLock = e.loose ? { hash: tplHash, loose: looseOf(next) } : { hash: tplHash };
  if (cur === null) {
    if (base && !ACCEPT.has(e.path)) { report.deleted.push(e.path); continue; }
    writeRepo(e.path, next, e.exec); report.created.push(e.path); newLock.files[e.path] = entryLock; continue;
  }
  if (hash(cur) === tplHash) { report.unchanged.push(e.path); newLock.files[e.path] = entryLock; if (e.exec && !DRY) try { chmodSync(join(ROOT, e.path), 0o755); } catch { /* windows */ } continue; }
  if (ACCEPT.has(e.path)) {
    const out = e.loose ? keepFrontmatter(next, cur) : next;
    writeRepo(e.path, out, e.exec); report.updated.push(`${e.path} (accepted template${out !== next ? ', kept your model/effort/color' : ''})`); newLock.files[e.path] = entryLock; continue;
  }
  if (base && hash(cur) === base.hash) { writeRepo(e.path, next, e.exec); report.updated.push(e.path); newLock.files[e.path] = entryLock; continue; }
  if (base && tplHash === base.hash) { report.keptUserEdit.push(e.path); continue; }
  if (KEEP.has(e.path)) { report.keptByChoice.push(e.path); newLock.files[e.path] = entryLock; continue; }
  // user edit (or no lock entry) and a different template: keep the file, show the diff, ask
  report.conflicts.push(e.path);
  if (e.loose && ((base?.loose && looseOf(cur) === base.loose) || looseOf(cur) === looseOf(next))) {
    report.notes.push(`${e.path}: only your model/effort/color lines differ; --accept takes the new template and keeps them`);
  }
}

// ---------- CLAUDE.md managed block ----------
{
  const block = renderBlock();
  const cur = readRepo('CLAUDE.md');
  const re = /<!-- ai-workflow:begin[\s\S]*?<!-- ai-workflow:end -->/;
  const base = lock?.files?.[BLOCK_KEY] || null;
  if (cur === null) {
    let skeleton = render(readFileSync(join(TPL, 'CLAUDE.md'), 'utf8'), 'CLAUDE.md');
    if (existsSync(join(ROOT, 'AGENTS.md'))) skeleton = `@AGENTS.md\n\n${skeleton}`;
    writeRepo('CLAUDE.md', `${skeleton}\n\n${block}\n`);
    report.created.push('CLAUDE.md (skeleton: fill the <...> sections)');
    newLock.files[BLOCK_KEY] = { hash: hash(block) };
  } else if (!re.test(cur)) {
    writeRepo('CLAUDE.md', `${cur.replace(/\s*$/, '')}\n\n${block}\n`);
    report.updated.push('CLAUDE.md (AI workflow block appended; your content kept)');
    newLock.files[BLOCK_KEY] = { hash: hash(block) };
  } else {
    const curBlock = cur.match(re)[0];
    if (hash(curBlock) === hash(block)) { report.unchanged.push('CLAUDE.md block'); newLock.files[BLOCK_KEY] = { hash: hash(block) }; }
    else if ((base && hash(curBlock) === base.hash) || ACCEPT.has('CLAUDE.md')) {
      writeRepo('CLAUDE.md', cur.replace(re, () => block)); report.updated.push('CLAUDE.md block'); newLock.files[BLOCK_KEY] = { hash: hash(block) };
    } else if (base && hash(block) === base.hash) report.keptUserEdit.push('CLAUDE.md block');
    else if (KEEP.has('CLAUDE.md')) { report.keptByChoice.push('CLAUDE.md block'); newLock.files[BLOCK_KEY] = { hash: hash(block) }; }
    else {
      report.conflicts.push('CLAUDE.md');
      report.notes.push('CLAUDE.md: the AI workflow block was edited by hand; change .claude/ai-workflow.json instead, then --accept CLAUDE.md');
    }
  }
}

// ---------- .gitignore ----------
{
  const cur = readRepo('.gitignore') ?? '';
  let text = norm(cur);
  const plain = { '.ua': '.ua/*', '.ua/': '.ua/*', '/.ua': '.ua/*', '/.ua/': '.ua/*', '.understand-anything': '.understand-anything/*', '.understand-anything/': '.understand-anything/*' };
  text = text.split('\n').map((l) => (plain[l.trim()] ? (report.gitignore.push(`${l.trim()} -> ${plain[l.trim()]}`), plain[l.trim()]) : l)).join('\n');
  const have = new Set(text.split('\n').map((l) => l.trim()));
  const missing = manifest.gitignore.filter((l) => !have.has(l));
  if (missing.length) { text = `${text.replace(/\s*$/, '')}${text.trim() ? '\n\n' : ''}# ai-workflow\n${missing.join('\n')}\n`; report.gitignore.push(...missing.map((m) => `+ ${m}`)); }
  if (text !== norm(cur)) writeRepo('.gitignore', text);
}

// ---------- package.json scripts ----------
for (const s of cfg.scripts || []) {
  const p = join(s.dir || '.', 'package.json');
  const t = readRepo(p);
  if (t === null) { report.notes.push(`${p} not found for script ${s.name}`); continue; }
  const pj = JSON.parse(t);
  pj.scripts = pj.scripts || {};
  if (pj.scripts[s.name] === s.cmd) continue;
  if (pj.scripts[s.name]) { report.notes.push(`${p}: kept your "${s.name}" script (template: ${s.cmd})`); continue; }
  pj.scripts[s.name] = s.cmd;
  const indent = (t.match(/^([ \t]+)"/m) || [null, '  '])[1];
  writeRepo(p, JSON.stringify(pj, null, indent) + (t.endsWith('\n') ? '\n' : ''));
  report.scripts.push(`${p}: ${s.name} = ${s.cmd}`);
}
if (cfg.createNvmrc && !readRepo('.nvmrc') && cfg.nodeVersionFile === '.nvmrc') { writeRepo('.nvmrc', `${cfg.createNvmrc}\n`); report.created.push('.nvmrc'); }

// ---------- lock ----------
for (const k of Object.keys(newLock.files)) if (!existsSync(join(ROOT, k.split('#')[0])) && !report.deleted.includes(k) && !DRY) delete newLock.files[k];
writeRepo(LOCK_PATH, JSON.stringify(newLock, null, 2) + '\n');
report.lock = `${LOCK_PATH} (${VERSION})`;

if (flag('--json')) console.log(JSON.stringify(report, null, 2));
else {
  const out = [`ai-workflow ${report.mode} ${report.from ? `${report.from} -> ` : ''}${VERSION}${DRY ? ' (dry run: nothing written)' : ''}`];
  const sec = (name, list) => { if (list.length) out.push(`${name} (${list.length}):`, ...list.map((x) => `  ${x}`)); };
  sec('created', report.created); sec('updated', report.updated); sec('kept, edited by you (template unchanged)', report.keptUserEdit);
  sec('CONFLICTS kept as they are (edited by you and changed in the template; review with --diff <path>, then --accept <path> or --keep <path>)', report.conflicts);
  sec('kept by your choice (--keep)', report.keptByChoice);
  sec('deleted by you, not recreated (take with --accept <path>)', report.deleted); sec('skipped', report.skipped);
  sec('no longer applies, left in place', report.notApplicable); sec('package.json scripts added', report.scripts);
  sec('.gitignore', report.gitignore); sec('notes', report.notes);
  out.push(`unchanged: ${report.unchanged.length} file(s); lock: ${report.lock}`);
  console.log(out.join('\n'));
}
