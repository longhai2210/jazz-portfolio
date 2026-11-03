#!/usr/bin/env node
// lint-probe.mjs (ai-workflow-setup): count how many violations a candidate ESLint rule would have
// today, without changing any config. Used by init to PROPOSE rules; it never enables anything.
//   node lint-probe.mjs --dir <package dir> --rule '<json, e.g. {"no-restricted-imports":["error",{"paths":["moment"]}]}>' [--glob <path inside dir>]
// Uses the package's own eslint (node_modules/.bin), so run the install first.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const dir = resolve(val('--dir') || '.');
const ruleJson = val('--rule');
if (!ruleJson) { console.error('lint-probe: pass --rule <json>'); process.exit(2); }
let rule;
try { rule = JSON.parse(ruleJson); } catch (e) { console.error(`lint-probe: --rule is not JSON: ${e.message}`); process.exit(2); }
const ids = Object.keys(rule);
const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8' }).stdout.trim() || dir;
const bin = [join(dir, 'node_modules', '.bin', 'eslint'), join(top, 'node_modules', '.bin', 'eslint')].find(existsSync);
if (!bin) { console.error('lint-probe: eslint is not installed for this package (run the install first)'); process.exit(2); }
const target = val('--glob') || '.';
// count only the project's own code: not this skill, not the files the installer generates
const manifest = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'manifest.json'), 'utf8'));
const own = ['.claude/**', ...manifest.files.map((f) => f.path).filter((p) => !p.startsWith('.claude/'))]
  .map((p) => relative(dir, join(top, p)).split('\\').join('/')).filter((p) => !p.startsWith('..'));
const r = spawnSync(bin, ['--format', 'json', '--no-warn-ignored', ...own.flatMap((p) => ['--ignore-pattern', p]), '--rule', ruleJson, target], { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 10 * 60 * 1000 });
let report;
try { report = JSON.parse(r.stdout); } catch { console.error(`lint-probe: eslint failed:\n${(r.stderr || r.stdout).slice(0, 2000)}`); process.exit(2); }
const perFile = report.map((f) => ({ file: relative(top, f.filePath).split('\\').join('/'), n: f.messages.filter((m) => ids.includes(m.ruleId)).length })).filter((f) => f.n);
const total = perFile.reduce((n, f) => n + f.n, 0);
console.log(JSON.stringify({ rule, dir: relative(top, dir) || '.', violations: total, files: perFile.length, top: perFile.sort((a, b) => b.n - a.n).slice(0, 5),
  proposal: total === 0 ? 'can be enabled now at "error" (verify will fail on new violations)' : 'tighten gradually: fix the files above first, or start at "warn" (warn does not fail verify unless lint runs with --max-warnings=0)' }, null, 2));
