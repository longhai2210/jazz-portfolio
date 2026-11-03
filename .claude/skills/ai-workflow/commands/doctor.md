# doctor [live]

Checks on this repo and machine what the skill cannot prove when it is packaged. Non-destructive: it creates only temporary rule files and worktrees, removes them, and never changes tracked files. Run it after the scaffold is merged, and again after a Claude Code update. With `live`, do only part 3.

## 1. Automatic checks
`node "<setup>/scripts/doctor.mjs" --gh`
Covers config and lock, the .env deny rules, script syntax, .gitignore, CLAUDE.md size, default branch vs origin/HEAD, a personal copy of this skill shadowing the project copy, tracked build output, rules-check, trace, drift from the templates, the rules fallback (`rules-check --for`), guard-paths in the main checkout and in a temporary worktree under `.claude/worktrees/`, guard-bash, the `task` label, and the last ai-gates runs on GitHub.

## 2. Worktree setup and verify, where agents run
`node "<setup>/scripts/validate-clean.mjs" --ref HEAD --in-repo`
Creates a checkout under `.claude/worktrees/` like a subagent's, runs the worktree setup command, verify, trace and rules-check, then removes it.

## 3. Live check with a real subagent
Path-scoped rules and agent hooks are applied by Claude Code itself, so only a real subagent shows what happens.
1. `node "<setup>/scripts/doctor.mjs" --live-rules write`. It prints three markers: A (rule with `paths: ["package.json"]`), B (`paths: ["**/package.json"]`), C (no paths, the control). Never put a marker in a prompt, and do not Read package.json yourself until step 4.
2. Spawn `tester` with exactly this prompt:
   "Doctor check, not a task: do not follow verify-task. Do these steps and report each result.
   1. Run `pwd` and `git rev-parse --show-toplevel`.
   2. Read package.json with the Read tool.
   3. List every string in your context that starts with AIWF-DOCTOR-, or say none. Do not search files, and do not open anything under .claude/rules.
   4. Use the Write tool to create doctor-probe.txt at the repository root. Report whether it was blocked, with the message.
   5. Use the Write tool to create specs/zz-doctor/qa.md containing the word doctor. Report whether it was allowed, then run `rm -r specs/zz-doctor`.
   6. Run `git status --porcelain` and report its output."
3. `node "<setup>/scripts/doctor.mjs" --live-rules remove`, whatever the result. Then worktree hygiene (SKILL.md) for the tester's worktree if `git worktree list` still shows it.
4. Interpret:
   - Isolation: the toplevel is under `.claude/worktrees/`: PASS. Otherwise FAIL: the tester did not run in a worktree.
   - Hook: doctor-probe.txt blocked and qa.md allowed: PASS (guard-paths works for a real agent in a worktree).
   - Control C missing: INCONCLUSIVE. Claude Code loads rule files when a session starts, so rules written mid-session may not reach agents. Offer to rerun as two steps: `--live-rules write`, then a new session with `/ai-workflow doctor live`, which spawns the tester and removes the rules.
   - C seen, A or B seen: path-scoped rules from the main checkout activate in subagent worktrees here, through the pattern whose marker appeared.
   - C seen, neither A nor B: path-scoped rules do not activate in subagent worktrees.
   - State the result in one plain sentence. Whenever path-scoped rules do not activate, or the result is inconclusive, confirm that the fallback carries the rules: CLAUDE.md's Rules map plus `rules-check --for`, which the role skills read directly (part 1, "rules fallback").

## 4. Report
One table (check, PASS/FAIL/WARN/SKIP/INFO, detail), then the fixes, most important first. Say what was not checked and why (for example no `gh`, or no subagent run). Nothing else was changed.
