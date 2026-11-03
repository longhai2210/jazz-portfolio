#!/usr/bin/env node
// PreToolUse(Edit|Write) hook used from role files: blocks writes outside the role's allowed paths.
// Usage in an agent's frontmatter: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs" tester
import { readFileSync } from 'node:fs';
import { relative, isAbsolute, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ALLOW = {
  tester: [/^(?:apps|packages)\/[^/]+\/src\/test\//, /\.(test|spec)\.[cm]?[jt]sx?$/, /^(?:apps\/[^/]+\/)?e2e\//, /^specs\/[^/]+\/qa\.md$/],
  designer: [/^specs\/[^/]+\/design\.md$/, /^specs\/[^/]+\/mockups\//],
};
const role = process.argv[2];
const rules = ALLOW[role];
if (!rules) process.exit(0);

let p = {};
try { p = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const file = p.tool_input?.file_path;
if (!file) process.exit(0);

let root = process.cwd();
try { root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch {}
const rel = relative(root, isAbsolute(file) ? file : resolve(root, file)).split('\\').join('/');
if (rules.some((r) => r.test(rel))) process.exit(0);

process.stderr.write(`The ${role} role may not edit ${rel}. Allowed: ${rules.map(String).join(', ')}. ` +
  'If the change is needed, report it to the Lead instead of making it.');
process.exit(2);
