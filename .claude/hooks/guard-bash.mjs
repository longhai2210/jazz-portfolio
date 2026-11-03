#!/usr/bin/env node
// PreToolUse(Bash) hook for read-only roles (reviewer, designer). Lets through only commands from a
// read-only allowlist and blocks redirections, command substitution and everything else.
// Usage in an agent's frontmatter: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-bash.mjs" reviewer
// Limits: it judges the command text, so an allowlisted repo script (node scripts/*.mjs) is trusted,
// and a command it cannot parse is refused rather than guessed.
import { readFileSync } from 'node:fs';

const role = process.argv[2] || 'read-only role';
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const raw = String(input.tool_input?.command || '').trim();
if (!raw) process.exit(0);

const ALLOW = [
  /^git (diff|show|log|status|rev-parse|merge-base|ls-files|ls-tree|blame|grep|cat-file|describe|shortlog|worktree list|branch (--list|-a|-r|--show-current|--contains))\b/,
  /^git branch$/,
  /^gh (pr (view|diff|checks|list)|issue (view|list)|run (list|view)|label list|repo view)\b/,
  /^node scripts\/(kg|trace|scope-check|rules-check)\.mjs\b/,
  /^(cat|head|tail|wc|ls|pwd|grep|rg|sort|uniq|cut|diff|stat|file|tree|jq|basename|dirname|realpath|echo|true)\b/,
  /^find\b/,
  /^cd\s+\S+$/,
];
const DENY_IN_SEGMENT = [
  /\bfind\b.*\s-(delete|exec|execdir|ok|okdir|fprint|fprintf|fls)\b/,
  /\bgit\b.*\s(--output|--open-files-in-pager|-O)(=|\s|$)/,
  /\bgh\b.*\s(--web|-w)\b/,
  /\brg\b.*\s--pre(=|\s)/,
  /\bsort\b.*\s(-o|--output)(=|\s)/,
  /\btree\b.*\s-o\s/,
  /\buniq\b(\s+-\S+)*\s+[^-\s]/,
  /\bgit branch\b.*\s(-d|-D|--delete|-m|-M|--move|-c|-C|--copy|-f|--force|-u|--set-upstream-to|--unset-upstream|--edit-description|-t|--track)(=|\s|$)/,
  /\btrace\.mjs\b.*\s--write\b/,
];

function block(msg) {
  process.stderr.write(`The ${role} role is read-only: ${msg} ` +
    'Allowed: git diff/show/log/status, gh pr view/diff/checks, gh issue view, node scripts/{kg,trace,scope-check,rules-check}.mjs, ' +
    'cat/head/tail/grep/rg/ls/find (no -exec/-delete), joined with && or |. Split or simplify the command.');
  process.exit(2);
}

// Harmless redirections are dropped before checking; any other redirection is refused.
const cmd = raw.replace(/\s2>\s*\/dev\/null/g, '').replace(/\s2>&1/g, '').replace(/\s>\s*\/dev\/null/g, '');
if (/[`]|\$\(|<\(|>\(/.test(cmd)) block('command substitution is not allowed.');
// Quoted text is masked (same length) so that | ; > inside quotes neither split nor block.
const masked = cmd.replace(/"[^"]*"|'[^']*'/g, (m) => `${m[0]}${'x'.repeat(m.length - 2)}${m[0]}`);
if (/>|(^|[^<])<(?!<)/.test(masked)) block('redirection is not allowed.');
const segments = masked.split(/\s*(?:&&|\|\||;|\||\n)\s*/).filter(Boolean);
for (let seg of segments) {
  if (/(^|\s)&(\s|$)/.test(seg)) block('background jobs are not allowed.');
  // git -c can point diff.external, core.fsmonitor or a pager at any program: refuse it.
  if (/^git\s+(?:(?:-C\s+\S+|--no-pager)\s+)*-c\s/.test(seg)) block('git -c is not allowed.');
  seg = seg.replace(/^git\s+(?:-C\s+\S+\s+|--no-pager\s+)+/, 'git ');
  if (!ALLOW.some((re) => re.test(seg))) block(`"${seg}" is not on the read-only allowlist.`);
  if (DENY_IN_SEGMENT.some((re) => re.test(seg))) block(`"${seg}" can write files.`);
}
process.exit(0);
