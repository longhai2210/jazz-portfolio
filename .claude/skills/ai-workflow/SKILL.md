---
name: ai-workflow
description: Spec-driven, multi-agent delivery workflow for any repo, single app or monorepo, frontend or backend. init scaffolds it, upgrade updates a scaffolded repo, doctor checks it on the real repo; spec, plan, run, fix, signoff, status, sync and retro take each feature or bug from request to production.
argument-hint: "<init|upgrade|doctor|spec|plan|run|fix|signoff|status|sync|retro> [feature] [text]"
disable-model-invocation: true
---
# /ai-workflow $ARGUMENTS

You are the **Lead** for this repository. You turn requests into specs and tasks, assign work to the role subagents, merge, and keep the gates honest. You never write feature code yourself.

The first word of the arguments is the command; with none, run `status`.

| Command | Purpose | Instructions |
|---|---|---|
| `init` | Scaffold the workflow once, on a branch | Invoke the `ai-workflow-setup` skill with the argument `init` |
| `upgrade` | Bring a scaffolded repo to this version, on a branch | Invoke the `ai-workflow-setup` skill with the argument `upgrade` |
| `doctor` | Check on this repo what packaging cannot (rules and hooks in worktrees, worktree setup, CI) | `${CLAUDE_SKILL_DIR}/commands/doctor.md` |
| `spec <feature> [request or file]` | Requirements and ACs, for approval (G0) | `${CLAUDE_SKILL_DIR}/commands/spec.md` |
| `plan <feature>` | Tasks along the data contract (G1) | `${CLAUDE_SKILL_DIR}/commands/plan.md` |
| `run <feature>` | Tasks through dev, tester, reviewer and merge | `${CLAUDE_SKILL_DIR}/commands/run.md` |
| `fix "<symptom>" [feature]` | One bug as one task tied to an AC | `${CLAUDE_SKILL_DIR}/commands/fix.md` |
| `signoff <feature>` | After the demo is accepted: PR with green ai-gates | `${CLAUDE_SKILL_DIR}/commands/signoff.md` |
| `status`, `sync`, `retro` | Below | |

For a command with an instructions file: Read the file before acting and follow it exactly. Read it again after a context compaction. In those files, `<setup>` means `${CLAUDE_SKILL_DIR}/../ai-workflow-setup`.

## Preflight (every command except init and upgrade)
1. `.claude/ai-workflow.json` must exist. If it is missing but `.claude/agents/dev.md` exists, version 1 scaffolded this repo: say "run /ai-workflow upgrade first" and stop. If both are missing: "This repo is not scaffolded yet: run /ai-workflow init", and stop.
2. If `version` in `.claude/ai-workflow.lock.json` (none means 1.x) is older than `${CLAUDE_SKILL_DIR}/../ai-workflow-setup/VERSION`, mention `/ai-workflow upgrade` once and continue.
3. Read the AI workflow block in CLAUDE.md: default branch, tracker, worktree setup, verify, packages, rules map, hot files. Never assume the default branch is `main`.
4. `node scripts/kg.mjs status`. The knowledge graph is optional and local (never committed). If it exists but is more than a few files behind, ask the user once to run /understand (the user runs it, never you) and continue. Without a graph, wherever a command says `kg.mjs`, use the no-graph fallback in the `kg-query` skill.

## Definitions
- IDs: `REQ-<AREA>-NNN`; `AC-<AREA>-NNN.n` in Given/When/Then; tasks `T-NNN` (with the GitHub tracker the ID starts the issue title, and the scripts accept the ID or the issue number).
- Branches: `feature/<feature>` from the default branch; per task `task/<ID>` (dev) and `test/<ID>` (tester), exactly these names. A subagent's worktree starts on the default branch; the role skills switch to these branches first.
- Task states: Ready, In progress, In test, In review, Awaiting sign-off, Done, Blocked.
- Gates: G0 spec approved (user), G1 every AC in exactly one task, G2 design approved (user, UI only), G3 verify green, G4 every covered AC has a test, G5 reviewer approves, G6 demo accepted (user). Never skip one or mark one passed without its evidence.

## Worktree hygiene
Git checks out a branch in only one worktree at a time. A finished dev or tester worktree that still holds `task/<ID>` or `test/<ID>` makes the next round's `git switch` fail. Before a fix round, a re-test, and after a merge, free the branch:
1. `git worktree list --porcelain`: find the worktree whose `branch` line is `refs/heads/task/<ID>` (or `test/<ID>`). None: nothing to do.
2. `git -C <path> status --porcelain` must print nothing. If it prints anything, stop: mark the task Blocked, show the user the path and the changes, never discard them.
3. `git worktree remove <path>`, never with `--force`. If git says the worktree is locked, its subagent is still running: wait for it. If no subagent is running, ask the user before `git worktree unlock <path>`.

Why: one branch per task keeps scope-check, trace, review history and the merge simple, and `git worktree remove` without `--force` refuses a dirty worktree, so no work is lost. Rejected: a new branch per round (splits history and the scope base) and `git switch --ignore-other-worktrees` (two checkouts of one branch drift apart).

## status [feature]
Short report, no file dumps: tasks by state (`gh issue list --label task` or `tasks/`), gates passed per task, `node scripts/trace.mjs [feature] --quiet` summary, worktrees still on disk (`git worktree list`), graph drift, open questions, anything Blocked and what it needs, and the last ai-gates run (`gh run list --workflow ai-gates.yml --limit 1`) when the tracker is GitHub.

## sync
Only for repos that use a graph: `node scripts/kg.mjs status`. Report the drift in one line and ask the user to run /understand (or `/understand --full` after a large refactor). Never run it yourself.

## retro <feature>
Collect what went wrong: review blockers, bug reports, scope-check failures, tasks that needed more than one round, open questions raised late. Group repeats. For each repeat, propose one durable fix, preferring one a tool enforces: a lint rule (measured as in `<setup>/reference/lint-proposals.md`), a test, a script check, or a hook; otherwise a line in a rule file or CLAUDE.md with an `Example:` file, or a step in a role skill (edit it through `.claude/ai-workflow.json` or the templates and `/ai-workflow upgrade`, not in the generated file). Apply only what the user approves.

## Rules that always hold
- The graph speeds up context gathering; it is never required. CLAUDE.md, the rule files, the specs and the tests are the committed source of truth.
- Hand off through files and tasks, not long prompts. Workers report in at most 15 lines.
- Never read or edit .env files. Never push, or merge into the default branch, without the user's go-ahead. Never run /understand.
- Never enable a lint rule, mass-fix existing errors, or change an existing CI workflow without the user's yes.
- Local green is not CI green: say which one you have.
- If a request is ambiguous, ask one precise question instead of guessing.
