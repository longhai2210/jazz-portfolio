---
name: implement-task
description: Developer procedure for one task. Switch to the task branch, set up the worktree, read the task, its rule files and context pack, build with tests titled by AC ID, pass scoped then full verify, check impact and scope, commit and report. Use when assigned a coding task.
---
# Implement a task

Inputs from the Lead: task ID (T-NNN), where the task lives (GitHub issue number or tasks/<ID>.md), feature branch.

1. Branch first. Your worktree starts on the default branch, not on the feature branch.
   - New task: `git switch -c task/<ID> feature/<feature>`
   - Fix round (the branch exists; the Lead removed the worktree that held it): `git switch task/<ID>`
2. Worktree setup, because a fresh worktree has no dependencies or generated code: `@@WORKTREE_SETUP_CMD@@`
   Never copy or create .env files. If a test needs one, stop and report it.
3. Read the task (`gh issue view <n>` or `tasks/<ID>.md`): Covers, Stack, Files it may touch, Scoped verify, Rules. Read those ACs in specs/<feature>/requirements.md, and design.md for UI work.
4. Read every rule file the task lists and every file `node scripts/rules-check.mjs --for <files you will touch>` prints. Follow the example file each rule names.
5. Read the files in the context pack (source, not summaries). Use `node scripts/kg.mjs show|deps` only for gaps.
6. Tests next to the code you change, one per AC, titled `"AC-XXX-NNN.n: <behaviour>"`, in the style of the test examples CLAUDE.md lists for your package. Cover the states the AC implies (loading, empty, error, validation, permission).
7. While working, run the task's scoped verify. Before reporting done, run the full verify: `@@VERIFY_CMD@@` (gate G3). Never disable a lint rule, skip a test or loosen a type to get green.
8. `node scripts/kg.mjs impact --base feature/<feature>` (no graph: the kg-query fallback); run every test it lists. If an upstream file outside your list must change, stop and report.
9. `node scripts/trace.mjs --check --quiet --ac <the task's ACs, comma separated>` (gate G4) and `node scripts/scope-check.mjs --task <ID or issue number>`. Fix a scope finding by reverting the extra file, never by editing the task.
10. `git status`: nothing from dist, .next, coverage, *.tsbuildinfo or generated code may be staged. Commit: `git commit -m "<ID>: <summary>" -m "Covers: AC-..."`.
11. Report in at most 15 lines.

In a fix round, the Lead's bug report names the failing AC and the tester's test file. To reproduce it, write your own failing test for that AC first, then fix the code.
