#!/usr/bin/env node
// detect.mjs (ai-workflow-setup): read-only detection for /ai-workflow init and upgrade.
// Prints JSON { config, findings } on stdout. Writes nothing unless --config-out is given.
//   node detect.mjs [--root <repo>] [--gh] [--eslint] [--merge <existing config>] [--config-out <path>] [--summary]
//   --gh       also ask GitHub (gh auth status, labels); needs network
//   --eslint   also run each package's local eslint --print-config on one source file (rule severities)
//   --merge    keep the user's values from an existing .claude/ai-workflow.json (upgrade)
//   --summary  print a short human summary instead of JSON
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname, basename, relative } from 'node:path';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VERSION = (() => { try { return readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim(); } catch { return '0.0.0'; } })();

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 20000, cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  return { ok: r.status === 0, out: opts.raw ? (r.stdout || '') : (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status };
};
const startDir = resolve(val('--root') || '.');
const top = run('git', ['-C', startDir, 'rev-parse', '--show-toplevel']);
if (!top.ok) { console.error('detect: not a git repository'); process.exit(2); }
const ROOT = top.out;
const git = (...a) => { const r = run('git', ['-C', ROOT, ...a]); return r.ok ? r.out : null; };
const lines = (s) => (s ? s.split('\n').map((l) => l.trimEnd()).filter(Boolean) : []);
const exists = (p) => existsSync(join(ROOT, p));
const readText = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
const readJson = (p) => { const t = readText(p); if (t == null) return null; try { return JSON.parse(t); } catch { return JSON.parse(stripJsonComments(t)); } };
function stripJsonComments(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1');
}
const warnings = [];

// ---------- git ----------
const tracked = lines(git('ls-files'));
const trackedSet = new Set(tracked);
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
// raw: porcelain lines start with a status column that may be a space (' M file'); trimming would shift the path
const statusLines = lines(run('git', ['-C', ROOT, 'status', '--porcelain=v1', '--untracked-files=all'], { raw: true }).out).slice(0, 2000);
const ALLOWED_DIRTY = [/^\.claude\/skills\/ai-workflow(-setup)?\//, /^\.ua\//, /^\.understand-anything\//, /^\.claude\/settings\.local\.json$/];
const dirty = statusLines.map((l) => ({ code: l.slice(0, 2), path: l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop() }));
const dirtyOther = dirty.filter((d) => !ALLOWED_DIRTY.some((re) => re.test(d.path)));
const ENV_RE = /(^|\/)\.env(\.[^/]*)?$/;
const isEnvSecret = (p) => ENV_RE.test(p) && !/\.env\.example$/.test(p);

function detectDefaultBranch() {
  const h = git('symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD');
  if (h) return { name: h.replace(/^origin\//, ''), source: 'origin/HEAD' };
  const remote = git('remote', 'get-url', 'origin');
  if (remote) {
    const r = run('git', ['-C', ROOT, 'ls-remote', '--symref', 'origin', 'HEAD'], { timeout: 8000 });
    const m = r.ok && r.out.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m);
    if (m) return { name: m[1], source: 'ls-remote origin HEAD (run: git remote set-head origin -a)' };
  }
  for (const b of ['main', 'master', 'develop', 'trunk']) if (git('rev-parse', '--verify', '--quiet', `refs/heads/${b}`)) return { name: b, source: `local branch ${b} (no origin/HEAD)` };
  return { name: branch || 'main', source: 'current branch (no remote)' };
}
const defaultBranch = detectDefaultBranch();
const remoteUrl = git('remote', 'get-url', 'origin');
const isGithub = !!remoteUrl && /github\.com[:/]/.test(remoteUrl);

// ---------- package manager ----------
const rootPkg = readJson('package.json') || {};
const pmField = typeof rootPkg.packageManager === 'string' ? rootPkg.packageManager : null;
let pm = 'npm';
if (pmField) pm = pmField.split('@')[0];
else if (exists('pnpm-lock.yaml') || exists('pnpm-workspace.yaml')) pm = 'pnpm';
else if (exists('yarn.lock')) pm = 'yarn';
else if (exists('bun.lockb') || exists('bun.lock')) pm = 'bun';
const lockfile = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock', bun: exists('bun.lock') ? 'bun.lock' : 'bun.lockb' }[pm];
const hasLock = exists(lockfile);
if (!hasLock) warnings.push(`no ${lockfile}: CI cannot do a frozen install until one is committed`);
const yarnBerry = pm === 'yarn' && (exists('.yarnrc.yml') || (pmField && !/^yarn@1\./.test(pmField)));
let pnpmVersion = null;
if (pm === 'pnpm' && !pmField) {
  warnings.push('no "packageManager" field in package.json: CI pins pnpm by lockfile version; add the field so local and CI use the same pnpm');
  const lv = ((readText('pnpm-lock.yaml') || '').match(/^lockfileVersion:\s*'?([\d.]+)/m) || [])[1];
  pnpmVersion = !lv ? '9' : Number(lv) >= 9 ? '9' : Number(lv) >= 6 ? '8' : '7';
}

// ---------- workspaces ----------
let wsGlobs = [];
const monoTools = [];
if (exists('pnpm-workspace.yaml')) {
  const t = readText('pnpm-workspace.yaml');
  const block = (t.match(/^packages:\s*\n((?:\s+-.*\n?)*)/m) || [])[1] || '';
  wsGlobs = block.split('\n').map((l) => l.replace(/^\s*-\s*/, '').replace(/^['"]|['"]$/g, '').trim()).filter(Boolean);
  monoTools.push('pnpm-workspaces');
}
if (rootPkg.workspaces) {
  const w = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages || [];
  wsGlobs.push(...w);
  monoTools.push(`${pm}-workspaces`);
}
if (exists('turbo.json')) monoTools.push('turbo');
if (exists('nx.json')) monoTools.push('nx');
if (exists('lerna.json')) monoTools.push('lerna');
function expandWorkspace(globs) {
  const dirs = new Set();
  const neg = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  for (const g of globs.filter((x) => !x.startsWith('!'))) {
    const parts = g.replace(/\/$/, '').split('/');
    let cur = [''];
    for (const part of parts) {
      const next = [];
      for (const base of cur) {
        const abs = join(ROOT, base);
        if (part === '**') {
          const all = [];
          const walk = (rel, depth) => {
            all.push(rel);
            if (depth > 4) return;
            let names = [];
            try { names = readdirSync(join(ROOT, rel)); } catch { return; }
            for (const n of names) if (!n.startsWith('.') && n !== 'node_modules' && statSync(join(ROOT, rel, n)).isDirectory()) walk(join(rel, n), depth + 1);
          };
          walk(base, 0);
          next.push(...all);
        } else if (part.includes('*')) {
          const re = new RegExp(`^${part.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
          let names = [];
          try { names = readdirSync(abs); } catch { continue; }
          for (const n of names) if (re.test(n) && n !== 'node_modules' && statSync(join(abs, n)).isDirectory()) next.push(join(base, n));
        } else next.push(join(base, part));
      }
      cur = next;
    }
    for (const d of cur) if (existsSync(join(ROOT, d, 'package.json'))) dirs.add(d.split('\\').join('/'));
  }
  return [...dirs].filter((d) => !neg.some((n) => d === n.replace(/\/$/, ''))).sort();
}
const pkgDirs = wsGlobs.length ? expandWorkspace(wsGlobs) : [];
const isMono = pkgDirs.length > 0;

// ---------- per package ----------
const FRONTEND = [['next', 'next'], ['react-scripts', 'cra'], ['@remix-run/react', 'remix'], ['astro', 'astro'], ['nuxt', 'nuxt'],
  ['@sveltejs/kit', 'sveltekit'], ['@angular/core', 'angular'], ['expo', 'expo'], ['react-native', 'react-native'], ['gatsby', 'gatsby'], ['vite', 'vite']];
const BACKEND = [['@nestjs/core', 'nestjs'], ['fastify', 'fastify'], ['express', 'express'], ['koa', 'koa'], ['hono', 'hono'], ['@hapi/hapi', 'hapi'], ['@adonisjs/core', 'adonis']];
const I18N = ['next-intl', 'next-i18next', 'react-i18next', 'i18next', 'react-intl', 'vue-i18n', '@lingui/core', 'nestjs-i18n', 'typesafe-i18n', '@ngx-translate/core'];
const CATS = {
  lint: ['lint'],
  typecheck: ['typecheck', 'type-check', 'check-types', 'types:check', 'typecheck:ci', 'tsc'],
  test: ['test:ci', 'test:unit', 'test'],
  build: ['build'],
  e2e: ['e2e', 'test:e2e'],
  codegen: ['codegen', 'generate', 'gen', 'prisma:generate', 'db:generate'],
};
const PLACEHOLDER_TEST = /no test specified|exit 1\s*$/;
function pickScript(scripts, cat) {
  for (const n of CATS[cat]) {
    const s = scripts?.[n];
    if (!s) continue;
    if (cat === 'test' && PLACEHOLDER_TEST.test(s)) continue;
    return n;
  }
  return null;
}
const TEST_RE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(e2e|__tests__|tests?)\/.+\.[cm]?[jt]sx?$/;
function analyzePackage(dir) {
  const pj = readJson(join(dir, 'package.json')) || {};
  const deps = { ...pj.dependencies, ...pj.devDependencies, ...pj.peerDependencies };
  const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
  const prefix = dir === '.' ? '' : `${dir}/`;
  const files = tracked.filter((f) => (prefix ? f.startsWith(prefix) : !pkgDirs.some((d) => f.startsWith(`${d}/`))));
  let fe = FRONTEND.find(([d]) => d !== 'vite' && has(d));
  if (!fe && has('vite') && ['react', 'vue', 'svelte', 'solid-js', 'preact', 'lit'].some(has)) fe = ['vite', 'vite'];
  const be = BACKEND.find(([d]) => has(d));
  let framework = 'library';
  let kind = 'library';
  if (be && (be[1] === 'nestjs' || !fe)) { framework = be[1]; kind = 'backend'; }
  else if (fe) {
    framework = fe[1] !== 'vite' ? fe[1] : has('react') ? 'vite-react' : has('vue') ? 'vite-vue' : has('svelte') ? 'vite-svelte' : 'vite';
    kind = ['expo', 'react-native'].includes(fe[1]) ? 'mobile' : 'frontend';
  }
  const testRunner = has('vitest') ? 'vitest' : has('jest') || has('ts-jest') || has('@swc/jest') ? 'jest' : has('react-scripts') ? 'jest (react-scripts)' : has('mocha') ? 'mocha' : /node --test/.test(pj.scripts?.test || '') ? 'node:test' : null;
  const tsconfig = readJson(join(dir, 'tsconfig.json'));
  const scripts = pj.scripts || {};
  const chosen = Object.fromEntries(Object.keys(CATS).map((c) => [c, pickScript(scripts, c)]));
  if (chosen.test && /--watch(?!All=false)/.test(scripts[chosen.test])) warnings.push(`${dir}: "${chosen.test}" runs in watch mode; add a non-watch test script (e.g. test:ci)`);
  // i18n
  const i18nLib = I18N.find(has) || null;
  const localeDirs = [...new Set(files.map((f) => (f.match(/^(.*?(?:^|\/)(?:locales?|messages|i18n|lang|translations))\/(?:[^/]+\/)?[^/]+\.(json|ya?ml|po|ts|js)$/) || [])[1]).filter(Boolean))].slice(0, 5);
  const i18n = i18nLib || localeDirs.length ? { lib: i18nLib, dirs: localeDirs } : null;
  // prisma
  const prismaSchema = pj.prisma?.schema ? join(dir, pj.prisma.schema).split('\\').join('/') : files.find((f) => /(^|\/)schema\.prisma$/.test(f)) || null;
  const usesPrisma = (has('prisma') || has('@prisma/client')) && !!prismaSchema;
  const postinstallGenerates = /prisma generate/.test(scripts.postinstall || '');
  // tests
  const testFiles = files.filter((f) => TEST_RE.test(f));
  const pickEx = (re) => testFiles.find((f) => re.test(f));
  const testExamples = [...new Set([pickEx(/\.(test|spec)\.tsx$/), pickEx(/\.(test|spec)\.[cm]?[jt]s$/), pickEx(/e2e/)].filter(Boolean))];
  const playwrightConfig = files.find((f) => new RegExp(`^${prefix.replace(/[.]/g, '\\.')}playwright\\.config\\.[cm]?[jt]s$`).test(f));
  const playwright = has('@playwright/test') && !!playwrightConfig;
  const mswDir = has('msw') ? (files.find((f) => /(^|\/)mocks\/(handlers|browser|server)\.[jt]sx?$/.test(f)) || '').replace(/\/[^/]+$/, '') || null : null;
  // tokens (frontend)
  const tokens = kind === 'frontend' ? files.filter((f) => /(^|\/)(tailwind\.config\.[cm]?[jt]s|tokens?\.(css|scss|json|ts|js)|theme\.(ts|js)|variables\.(css|scss)|globals?\.css)$/.test(f)).slice(0, 5) : [];
  // build output dirs
  // Build output dirs: always-generated names, or a dir with no tracked files (so it is not source).
  const outDirs = new Set();
  const norm = (d) => join(dir, d).split('\\').join('/').replace(/^\.\//, '');
  const noTracked = (d) => !tracked.some((f) => f.startsWith(`${d}/`));
  const addOut = (d) => { const n = norm(d.replace(/^\.?\//, '').replace(/\/$/, '')); if (/^(dist|\.next|\.nuxt|\.svelte-kit|out)$/.test(basename(n)) || noTracked(n)) outDirs.add(n); };
  if (tsconfig?.compilerOptions?.outDir) addOut(tsconfig.compilerOptions.outDir);
  for (const f of [pj.main, pj.types, pj.module]) {
    const m = typeof f === 'string' && f.match(/^\.?\/?(dist|build|lib|out)\//);
    if (m) addOut(m[1]);
  }
  if (framework === 'next') addOut('.next');
  if (framework.startsWith('vite') || framework === 'library' || framework === 'nestjs') addOut('dist');
  if (framework === 'cra') addOut('build');
  const anyCount = Number((run('git', ['-C', ROOT, 'grep', '-c', '-E', ':[[:space:]]*any([^A-Za-z0-9_]|$)|as any([^A-Za-z0-9_]|$)|<any>', '--', dir === '.' ? '.' : dir]).out || '')
    .split('\n').reduce((n, l) => n + (Number(l.split(':').pop()) || 0), 0));
  const builtMain = typeof (pj.main || pj.types) === 'string' && /^\.?\/?(dist|build|lib|out)\//.test(pj.main || pj.types);
  return {
    name: pj.name || (dir === '.' ? basename(ROOT) : basename(dir)), dir, kind, framework,
    language: tsconfig || files.some((f) => /\.tsx?$/.test(f)) ? 'ts' : 'js',
    testRunner, testingLibrary: has('@testing-library/react') || has('@testing-library/vue') || has('@testing-library/svelte') || has('@testing-library/react-native'),
    nestTesting: has('@nestjs/testing'), supertest: has('supertest'), msw: mswDir, playwright: playwright ? playwrightConfig : null,
    i18n, scripts: chosen, allScripts: Object.keys(scripts), usesPrisma, prismaSchema, postinstallGenerates,
    testExamples, testFileCount: testFiles.length, tokens, outDirs: [...outDirs], anyCount, builtMain,
    tsIncremental: !!(tsconfig?.compilerOptions?.incremental || tsconfig?.compilerOptions?.composite),
    tsReferences: Array.isArray(tsconfig?.references) && tsconfig.references.length > 0,
    eslint: has('eslint'), workspaceDeps: Object.entries(deps).filter(([, v]) => typeof v === 'string' && /^workspace:/.test(v)).map(([k]) => k),
    deps: Object.keys(deps),
  };
}
const packages = isMono ? pkgDirs.map(analyzePackage) : [analyzePackage('.')];
const byName = new Map(packages.map((p) => [p.name, p]));
// workspace deps declared with plain versions also count when the name matches a workspace package
for (const p of packages) p.workspaceDeps = [...new Set([...p.workspaceDeps, ...p.deps.filter((d) => byName.has(d) && d !== p.name)])];
const rootScripts = rootPkg.scripts || {};
const rootChosen = Object.fromEntries(Object.keys(CATS).map((c) => [c, pickScript(rootScripts, c)]));

// ---------- commands ----------
const pmRun = { npm: 'npm run', pnpm: 'pnpm run', yarn: 'yarn run', bun: 'bun run' }[pm];
const install = { npm: hasLock ? 'npm ci' : 'npm install', pnpm: 'pnpm install --frozen-lockfile', yarn: yarnBerry ? 'yarn install --immutable' : 'yarn install --frozen-lockfile', bun: 'bun install --frozen-lockfile' }[pm];
const q = (s) => (/[\s^"'&|<>]/.test(s) ? `"${s}"` : s);
function inPkg(p, script) {
  if (!isMono) return `${pmRun} ${script}`;
  return { npm: `npm run ${script} -w ${q(p.name)}`, pnpm: `pnpm --filter ${q(p.name)} run ${script}`, yarn: `yarn workspace ${q(p.name)} run ${script}`, bun: `bun run --filter ${q(p.name)} ${script}` }[pm];
}
function execInPkg(p, bin) {
  if (!isMono) return { npm: `npx ${bin}`, pnpm: `pnpm exec ${bin}`, yarn: `yarn ${bin}`, bun: `bunx ${bin}` }[pm];
  return { npm: `npm exec -w ${q(p.name)} -- ${bin}`, pnpm: `pnpm --filter ${q(p.name)} exec ${bin}`, yarn: yarnBerry ? `yarn workspace ${q(p.name)} exec ${bin}` : `yarn workspace ${q(p.name)} ${bin}`, bun: `bun --filter ${q(p.name)} x ${bin}` }[pm];
}
function groupRun(script, pkgs) {
  const names = pkgs.map((p) => q(p.name));
  switch (pm) {
    case 'pnpm': return `pnpm ${names.map((n) => `--filter ${n}`).join(' ')} run ${script}`;
    case 'npm': return `npm run ${script} ${names.map((n) => `-w ${n}`).join(' ')}`;
    case 'bun': return `bun run ${names.map((n) => `--filter ${n}`).join(' ')} ${script}`;
    default: return yarnBerry ? `yarn workspaces foreach -A -t ${names.map((n) => `--include ${n}`).join(' ')} run ${script}` : names.map((n) => `yarn workspace ${n} run ${script}`).join(' && ');
  }
}
const scriptsToAdd = [];
const verifySteps = [];
const needsBuildFirst = isMono && packages.some((p) => p.workspaceDeps.some((d) => byName.get(d)?.builtMain && byName.get(d)?.scripts.build));
if (!isMono) {
  const p = packages[0];
  const add = (name, cmd) => { scriptsToAdd.push({ dir: '.', name, cmd }); return name; };
  const lint = p.scripts.lint || (p.eslint ? add('lint', 'eslint .') : null);
  const typecheck = p.scripts.typecheck || (p.language === 'ts' ? add('typecheck', p.tsReferences ? 'tsc -b' : 'tsc --noEmit') : null);
  let test = p.scripts.test === 'test:ci' ? 'test:ci' : null;
  if (!test && p.testRunner) {
    const ci = p.testRunner === 'vitest' ? 'vitest run' : p.testRunner === 'jest' ? 'jest --ci' : p.testRunner === 'jest (react-scripts)' ? 'react-scripts test --watchAll=false' : null;
    test = ci && !rootScripts['test:ci'] ? add('test:ci', ci) : p.scripts.test;
  }
  if (!test) test = p.scripts.test;
  if (p.tsReferences && p.scripts.typecheck && /tsc --noEmit/.test(rootScripts[p.scripts.typecheck] || '')) warnings.push('tsconfig uses project references: tsc --noEmit checks nothing there; use tsc -b');
  for (const s of [lint, typecheck, test, p.scripts.build]) if (s) verifySteps.push(`${pmRun} ${s}`);
  if (!p.testRunner) warnings.push('no unit test runner: offer to install one (Vitest + Testing Library for Vite/Next)');
} else {
  const order = needsBuildFirst ? ['lint', 'build', 'typecheck', 'test'] : ['lint', 'typecheck', 'test', 'build'];
  const rootName = { lint: 'lint', typecheck: 'typecheck', test: 'test:ci', build: 'build' };
  for (const cat of order) {
    if (rootChosen[cat]) { verifySteps.push(`${pmRun} ${rootChosen[cat]}`); continue; }
    const groups = new Map();
    for (const p of packages) if (p.scripts[cat]) (groups.get(p.scripts[cat]) || groups.set(p.scripts[cat], []).get(p.scripts[cat])).push(p);
    if (!groups.size) continue;
    const cmd = [...groups].map(([s, ps]) => groupRun(s, ps)).join(' && ');
    scriptsToAdd.push({ dir: '.', name: rootName[cat], cmd });
    verifySteps.push(`${pmRun} ${rootName[cat]}`);
  }
}
if (!rootScripts.verify && verifySteps.length) scriptsToAdd.push({ dir: '.', name: 'verify', cmd: verifySteps.join(' && ') });
if (rootScripts.verify) warnings.push(`root already has a "verify" script; it is kept: ${rootScripts.verify}`);
// codegen
const codegen = [];
if (rootChosen.codegen) codegen.push(`${pmRun} ${rootChosen.codegen}`);
else for (const p of packages) {
  if (p.scripts.codegen) codegen.push(inPkg(p, p.scripts.codegen));
  else if (p.usesPrisma && !p.postinstallGenerates) codegen.push(execInPkg(p, 'prisma generate'));
}
const codegenCmd = codegen.join(' && ') || null;
// scoped verify per package
for (const p of packages) {
  const steps = [];
  if (isMono && p.workspaceDeps.some((d) => byName.get(d)?.builtMain && byName.get(d)?.scripts.build)) {
    const deps = p.workspaceDeps.map((d) => byName.get(d)).filter((d) => d?.builtMain && d.scripts.build);
    steps.push(pm === 'pnpm' ? `pnpm --filter "${p.name}^..." run build` : deps.map((d) => inPkg(d, d.scripts.build)).join(' && '));
  }
  const s = isMono ? p.scripts : { ...p.scripts, ...Object.fromEntries(scriptsToAdd.map((x) => [x.name === 'test:ci' ? 'test' : x.name, x.name])) };
  for (const cat of ['lint', 'typecheck', 'test']) if (s[cat]) steps.push(inPkg(p, s[cat]));
  p.scopedVerify = steps.join(' && ') || null;
}
// e2e
const e2ePkg = packages.find((p) => p.playwright);
const e2e = e2ePkg ? {
  cmd: e2ePkg.scripts.e2e ? inPkg(e2ePkg, e2ePkg.scripts.e2e) : execInPkg(e2ePkg, 'playwright test'),
  install: execInPkg(e2ePkg, 'playwright install --with-deps chromium'),
} : null;

// ---------- node version ----------
let nodeVersionFile = exists('.nvmrc') ? '.nvmrc' : exists('.node-version') ? '.node-version' : rootPkg.engines?.node || rootPkg.volta?.node ? 'package.json' : '.nvmrc';
const createNvmrc = nodeVersionFile === '.nvmrc' && !exists('.nvmrc') ? process.versions.node.split('.')[0] : null;

// ---------- CI workflows ----------
const workflows = [];
const ciEnv = {};
const ciSecretEnv = new Set();
for (const f of tracked.filter((x) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(x))) {
  const t = readText(f) || '';
  const tl = t.split('\n');
  const branches = new Set();
  tl.forEach((l, i) => {
    const m = l.match(/^(\s*)branches(?:-ignore)?:\s*(.*)$/);
    if (!m) return;
    if (/^\[/.test(m[2])) m[2].replace(/[[\]]/g, '').split(',').forEach((b) => branches.add(b.trim().replace(/^['"]|['"]$/g, '')));
    else for (let j = i + 1; j < tl.length; j++) {
      const it = tl[j].match(/^(\s*)-\s*(.+)$/);
      if (!it || it[1].length <= m[1].length) break;
      branches.add(it[2].trim().replace(/^['"]|['"]$/g, ''));
    }
  });
  const missing = [...branches].filter((b) => b && !/[*!]/.test(b) && !git('rev-parse', '--verify', '--quiet', `refs/heads/${b}`) && !git('rev-parse', '--verify', '--quiet', `refs/remotes/origin/${b}`));
  tl.forEach((l, i) => {
    const m = l.match(/^(\s*)env:\s*$/);
    if (!m) return;
    for (let j = i + 1; j < tl.length; j++) {
      const kv = tl[j].match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (!kv || kv[1].length <= m[1].length) { if (tl[j].trim() === '') continue; break; }
      const v = kv[3].trim().replace(/^['"]|['"]$/g, '');
      if (kv[2] === 'GITHUB_TOKEN') continue;
      if (/\$\{\{/.test(v)) { if (/secrets\./.test(v)) ciSecretEnv.add(kv[2]); continue; }
      if (!(kv[2] in ciEnv)) ciEnv[kv[2]] = v;
    }
  });
  const pnpmVersionInput = /pnpm\/action-setup/.test(t) && /^\s*version:\s*\S+/m.test(t);
  workflows.push({ file: f, branches: [...branches], missingBranches: missing, pnpmActionSetupVersion: pnpmVersionInput && !!pmField });
}

// ---------- repo hygiene ----------
const ARTIFACT_RE = /\.tsbuildinfo$|(^|\/)(dist|\.next|\.turbo|coverage|node_modules|\.nuxt|\.svelte-kit|storybook-static|\.vercel|\.output)\/|(^|\/)\.eslintcache$/;
const MAYBE_ARTIFACT_RE = /(^|\/)(build|out)\//;
const trackedArtifacts = tracked.filter((f) => ARTIFACT_RE.test(f));
const maybeArtifacts = tracked.filter((f) => !ARTIFACT_RE.test(f) && MAYBE_ARTIFACT_RE.test(f)).slice(0, 20);
const buildinfoRisk = trackedArtifacts.filter((f) => f.endsWith('.tsbuildinfo')).map((f) => {
  const dir = dirname(f);
  const ts = readJson(join(dir, 'tsconfig.json')) || readJson(join(dir, 'tsconfig.build.json')) || {};
  return { file: f, incremental: !!(ts.compilerOptions?.incremental || ts.compilerOptions?.composite) };
});
const envTracked = tracked.filter(isEnvSecret);
const ignored = (p) => run('git', ['-C', ROOT, 'check-ignore', '-q', '--no-index', p]).status === 0;
const mustNotBeIgnored = ['CLAUDE.md', 'specs/x/requirements.md', '.claude/agents/dev.md', '.claude/skills/x/SKILL.md', '.claude/ai-workflow.json', 'scripts/scope-check.mjs']
  .filter(ignored);
const claudeMd = readText('CLAUDE.md');
const nestedClaudeMd = tracked.filter((f) => /\/CLAUDE\.md$/.test(f));
// hot files: most changed in the last year, plus structural candidates
const counts = new Map();
for (const f of lines(git('log', '--since=12.months', '--name-only', '--format=', '-n', '2000'))) {
  if (!trackedSet.has(f) || /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$|\.(md|snap|lock)$|^\.github\//.test(f) || TEST_RE.test(f)) continue;
  counts.set(f, (counts.get(f) || 0) + 1);
}
const hotByChange = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([path, changes]) => ({ path, changes }));
const STRUCTURAL = /(^|\/)(src\/)?(router|routes|routing)\.[cm]?[jt]sx?$|(^|\/)(store|app\/store)\/index\.[jt]sx?$|(^|\/)app\.module\.ts$|(^|\/)schema\.prisma$|(^|\/)app\/layout\.[jt]sx$|(^|\/)src\/(main|App)\.[jt]sx?$|(^|\/)(api|services)\/index\.[jt]sx?$|^packages\/[^/]+\/src\/index\.[jt]sx?$|(^|\/)next\.config\.[cm]?[jt]s$|(^|\/)(locales?|messages)\/[^/]+\.json$/;
const hotStructural = tracked.filter((f) => STRUCTURAL.test(f)).slice(0, 20);

// ---------- optional: GitHub ----------
let gh = null;
if (flag('--gh')) {
  const auth = run('gh', ['auth', 'status'], { timeout: 10000, cwd: ROOT });
  const labels = auth.ok ? run('gh', ['label', 'list', '--limit', '500', '--json', 'name'], { timeout: 15000, cwd: ROOT }) : { ok: false };
  let names = [];
  try { names = labels.ok ? JSON.parse(labels.out).map((l) => l.name) : []; } catch { /* ignore */ }
  const runs = auth.ok ? run('gh', ['run', 'list', '--workflow', 'ai-gates.yml', '--limit', '1', '--json', 'status,conclusion,headBranch,url'], { timeout: 15000, cwd: ROOT }) : { ok: false };
  gh = { auth: auth.ok, labels: labels.ok ? names : null, hasTaskLabel: names.includes('task'), featureLabels: names.filter((n) => n.startsWith('feature:')), lastAiGates: runs.ok ? (JSON.parse(runs.out || '[]')[0] || null) : null };
}

// ---------- optional: eslint severities (needs installed node_modules) ----------
const WATCH_RULES = ['@typescript-eslint/no-explicit-any', 'no-console', 'react-hooks/exhaustive-deps', 'react-hooks/rules-of-hooks', 'no-restricted-imports', '@typescript-eslint/no-unused-vars', 'import/no-cycle'];
if (flag('--eslint')) {
  for (const p of packages.filter((x) => x.eslint)) {
    const bin = [join(ROOT, p.dir, 'node_modules', '.bin', 'eslint'), join(ROOT, 'node_modules', '.bin', 'eslint')].find(existsSync);
    const sample = tracked.find((f) => f.startsWith(p.dir === '.' ? '' : `${p.dir}/`) && /\/[^/]+\.(tsx?|jsx?)$/.test(f) && !TEST_RE.test(f) && !/\.d\.ts$/.test(f) && (p.dir !== '.' || !pkgDirs.some((d) => f.startsWith(`${d}/`))));
    if (!bin || !sample) { p.eslintRules = { error: bin ? 'no source file' : 'eslint not installed (run install first)' }; continue; }
    const r = run(bin, ['--print-config', relative(join(ROOT, p.dir), join(ROOT, sample))], { cwd: join(ROOT, p.dir), timeout: 60000 });
    try {
      const rules = JSON.parse(r.out).rules || {};
      const sev = (v) => { const s = Array.isArray(v) ? v[0] : v; return s === 2 || s === 'error' ? 'error' : s === 1 || s === 'warn' ? 'warn' : 'off'; };
      p.eslintRules = { sample, ...Object.fromEntries(WATCH_RULES.map((n) => [n, n in rules ? sev(rules[n]) : 'not configured'])) };
    } catch { p.eslintRules = { error: (r.err || r.out).slice(0, 300) }; }
  }
}

// ---------- roles and artifacts ----------
const testerAllow = ['**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}', '**/__tests__/**', '**/__mocks__/**', '**/__snapshots__/**',
  '**/__fixtures__/**', '**/test/**', '**/tests/**', '**/e2e/**', 'specs/*/qa.md'];
for (const p of packages) if (p.msw) testerAllow.push(`${p.msw}/**`);
const artifacts = ['**/*.tsbuildinfo', '**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/coverage/**',
  ...new Set(packages.flatMap((p) => p.outDirs.map((d) => `${d}/**`)))];

// ---------- config proposal ----------
const hasFrontend = packages.some((p) => p.kind === 'frontend' || p.kind === 'mobile');
const tracker = isGithub && (!gh || gh.auth) ? 'github' : 'files';
let config = {
  version: VERSION,
  project: rootPkg.name || basename(ROOT),
  defaultBranch: defaultBranch.name,
  packageManager: pm,
  packageManagerField: pmField,
  pnpmVersion,
  yarnBerry,
  nodeVersionFile,
  createNvmrc,
  monorepo: isMono ? { tools: [...new Set(monoTools)] } : null,
  tracker,
  hasFrontend,
  commands: {
    install,
    codegen: codegenCmd,
    worktreeSetup: [install, codegenCmd].filter(Boolean).join(' && '),
    verify: `${pmRun} verify`,
    e2e: e2e?.cmd || null,
    e2eInstall: e2e?.install || null,
  },
  scripts: scriptsToAdd,
  packages: packages.map((p) => ({
    name: p.name, dir: p.dir, kind: p.kind, framework: p.framework, language: p.language, testRunner: p.testRunner,
    testingLibrary: p.testingLibrary, nestTesting: p.nestTesting, supertest: p.supertest, msw: p.msw, playwright: p.playwright,
    i18n: p.i18n, scopedVerify: p.scopedVerify, testExamples: p.testExamples, tokens: p.tokens,
  })),
  rules: [],
  hotFiles: [],
  roles: { tester: { allow: testerAllow }, designer: { allow: ['specs/*/design.md', 'specs/*/mockups/**'] } },
  artifacts,
  ci: { env: ciEnv },
};

// ---------- merge with an existing config (Phase 3 refresh, upgrade) ----------
// The user's choices win (tracker, branch, commands, rules, hot files, roles, artifacts, ci, per-package
// scoped verify, examples, tokens, i18n, kind, framework) when set; detected facts (package manager,
// test runners, scripts to add) are refreshed. null, "" and [] count as not set.
const FACT_KEYS = new Set(['version', 'packageManager', 'packageManagerField', 'pnpmVersion', 'yarnBerry', 'monorepo', 'scripts']);
const PKG_FACTS = new Set(['name', 'language', 'testRunner', 'testingLibrary', 'nestTesting', 'supertest', 'msw', 'playwright']);
const isSet = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
const mergePath = val('--merge');
if (mergePath) {
  let user = null;
  try { user = JSON.parse(readFileSync(resolve(mergePath), 'utf8')); } catch (e) { warnings.push(`--merge: cannot read ${mergePath}: ${e.message}`); }
  if (user) {
    const merged = { ...config };
    for (const [k, v] of Object.entries(user)) {
      if (FACT_KEYS.has(k) || !isSet(v)) continue;
      if (k === 'packages' && Array.isArray(v)) {
        merged.packages = config.packages.map((p) => {
          const u = v.find((x) => x.dir === p.dir) || {};
          const out = { ...p };
          for (const [pk, pv] of Object.entries(u)) if (!PKG_FACTS.has(pk) && isSet(pv)) out[pk] = pv;
          return out;
        });
        for (const u of v) if (!merged.packages.some((p) => p.dir === u.dir)) warnings.push(`package ${u.dir} in your config no longer exists; dropped`);
      } else if (['commands', 'roles', 'ci'].includes(k) && v && typeof v === 'object' && !Array.isArray(v)) {
        merged[k] = { ...config[k] };
        for (const [ck, cv] of Object.entries(v)) if (isSet(cv)) merged[k][ck] = cv;
      } else merged[k] = v;
    }
    if (isSet(user.defaultBranch) && user.defaultBranch !== config.defaultBranch) {
      warnings.push(`your config says default branch ${user.defaultBranch}, detection found ${config.defaultBranch} (${defaultBranch.source}); kept yours`);
    }
    merged.version = VERSION;
    config = merged;
  }
}

const findings = {
  root: ROOT,
  git: {
    branch, defaultBranch: defaultBranch.name, defaultBranchSource: defaultBranch.source, remote: remoteUrl, github: isGithub,
    clean: dirtyOther.length === 0, dirtyCount: dirtyOther.length, dirtySample: dirtyOther.slice(0, 15).map((d) => `${d.code} ${d.path}`),
    dirtyEnvFiles: dirtyOther.filter((d) => isEnvSecret(d.path)).map((d) => d.path),
    skillFilesUntracked: dirty.some((d) => /^\.claude\/skills\/ai-workflow/.test(d.path)),
  },
  monorepo: isMono ? { tools: [...new Set(monoTools)], packages: packages.map((p) => `${p.dir} (${p.framework}, ${p.kind}, tests: ${p.testRunner || 'none'})`) } : null,
  packages: packages.map((p) => ({ dir: p.dir, scripts: p.scripts, testFileCount: p.testFileCount, anyCount: p.anyCount, tsIncremental: p.tsIncremental, workspaceDeps: p.workspaceDeps, eslintRules: p.eslintRules, prismaSchema: p.prismaSchema })),
  rootScripts: rootChosen,
  needsBuildFirst,
  trackedArtifacts,
  maybeArtifacts,
  buildinfoRisk,
  envTracked,
  workflows,
  ciSecretEnvNotCopied: [...ciSecretEnv],
  mustNotBeIgnored,
  claudeMd: claudeMd == null ? null : { lines: claudeMd.split('\n').length, hasBlock: /<!-- ai-workflow:begin/.test(claudeMd) },
  agentsMd: exists('AGENTS.md'),
  nestedClaudeMd,
  graph: exists('.ua/knowledge-graph.json') ? '.ua' : exists('.understand-anything/knowledge-graph.json') ? '.understand-anything' : null,
  lock: readJson('.claude/ai-workflow.lock.json')?.version || null,
  hotFileCandidates: { byChange: hotByChange, structural: hotStructural },
  gh,
  warnings,
};

if (val('--config-out')) writeFileSync(resolve(val('--config-out')), JSON.stringify(config, null, 2) + '\n');
if (flag('--summary')) {
  const s = [];
  s.push(`repo ${ROOT} on ${branch}; default branch ${defaultBranch.name} (${defaultBranch.source})`);
  s.push(`package manager ${pm}${pmField ? ` (${pmField})` : ''}${isMono ? `; monorepo: ${[...new Set(monoTools)].join(', ')}` : ''}`);
  for (const p of packages) s.push(`- ${p.dir}: ${p.framework} (${p.kind}), tests ${p.testRunner || 'none'} [${p.testFileCount}], scoped verify: ${p.scopedVerify || 'none'}`);
  s.push(`install: ${install}${codegenCmd ? `; codegen: ${codegenCmd}` : ''}`);
  s.push(`verify: ${verifySteps.join(' && ') || 'nothing to run'}${needsBuildFirst ? ' (build before typecheck: apps import built workspace packages)' : ''}`);
  if (!findings.git.clean) s.push(`working tree: ${dirtyOther.length} change(s) outside the skill folders`);
  if (trackedArtifacts.length) s.push(`tracked build output: ${trackedArtifacts.slice(0, 5).join(', ')}${trackedArtifacts.length > 5 ? ' …' : ''}`);
  for (const w of workflows.filter((x) => x.missingBranches.length)) s.push(`workflow ${w.file} triggers on missing branch(es): ${w.missingBranches.join(', ')}`);
  for (const w of warnings) s.push(`warning: ${w}`);
  console.log(s.join('\n'));
} else {
  console.log(JSON.stringify({ config, findings }, null, 2));
}
