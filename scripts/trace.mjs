#!/usr/bin/env node
// trace.mjs: requirement -> test traceability for specs/<feature>/requirements.md.
//   node scripts/trace.mjs [feature]                 print the AC -> test matrix
//   node scripts/trace.mjs [feature] --write         also write specs/<feature>/trace.md
//   node scripts/trace.mjs --check                   fail if spec format is broken, or an AC of an
//                                                    implemented/verified spec has no test
//   node scripts/trace.mjs --check --ac AC-X-001.1,AC-X-001.2   fail if these ACs have no test (task gate G4)
//   node scripts/trace.mjs --check --ac-from-text "$PR_BODY"     same, ACs taken from free text
//   --changed-since <ref>  also reject .skip/.only/xit in test files changed since <ref>
//   --quiet hides the matrix (useful in CI and for agents)
// A test "covers" an AC when the AC ID appears in a test file, normally as the test title prefix:
//   it("AC-BOOK-003.1: rejects overlapping periods", ...)
// .skip/.only/xit fail the check in test files that prove an AC (and in changed test files with
// --changed-since). Legacy test files are left alone so old skips don't block adoption.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const VALUE_FLAGS = ['--ac', '--ac-from-text', '--changed-since'];
const feature = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(argv[i - 1]));
const AC_RE = /AC-[A-Z][A-Z0-9]*-\d{3}\.\d+/g;
const git = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};

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
  const text = readFileSync(join(SPECS, f, 'requirements.md'), 'utf8').replace(/\r\n/g, '\n');
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

// test files: tracked + untracked, typical test locations (any package of a monorepo)
const files = (git('ls-files', '--cached', '--others', '--exclude-standard') || '').split('\n');
const TEST_RE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)(e2e|__tests__|tests?)\/.+\.[cm]?[jt]sx?$/;
const testFiles = files.filter((p) => TEST_RE.test(p));
const covered = new Map(); // ac -> [files]
const acFiles = new Set();
for (const p of testFiles) {
  let t; try { t = readFileSync(p, 'utf8'); } catch { continue; }
  const ids = new Set(t.match(AC_RE) || []);
  if (ids.size) acFiles.add(p);
  for (const id of ids) (covered.get(id) || covered.set(id, []).get(id)).push(p);
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
  const skipScope = new Set(acFiles);
  const since = val('--changed-since');
  if (since) {
    const changed = git('diff', '--name-only', `${since}...HEAD`);
    if (changed === null) errors.push(`--changed-since ${since}: ref not found (fetch it first)`);
    else for (const p of changed.split('\n')) if (TEST_RE.test(p) && existsSync(p)) skipScope.add(p);
  }
  for (const p of skipScope) {
    let t; try { t = readFileSync(p, 'utf8'); } catch { continue; }
    if (/\b(it|test|describe)\.(skip|only)\s*\(|\bx(it|describe)\s*\(/.test(t)) errors.push(`${p}: contains .skip/.only/xit; remove before merge`);
  }
  if (errors.length) { console.error('TRACE CHECK FAILED\n- ' + errors.join('\n- ')); process.exit(1); }
  console.log('trace check passed');
} else if (errors.length) {
  console.error('spec warnings:\n- ' + errors.join('\n- '));
}
