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
