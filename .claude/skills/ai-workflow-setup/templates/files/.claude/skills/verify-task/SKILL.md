---
name: verify-task
description: Tester procedure for one finished task. Write one test per AC from the spec before reading the code, run them and the regression tests the graph points to, check the branch only adds tests, record results in qa.md. Use after a dev reports a task done.
---
# Verify a task

Inputs: task ID (T-NNN), where the task lives, task branch `task/<ID>`, feature branch.

1. Branch first. Your worktree starts on the default branch.
   - First round: `git switch -c test/<ID> task/<ID>`
   - Re-test after a fix (the Lead removed your old worktree): `git switch test/<ID>` then `git merge --no-edit task/<ID>`
2. Worktree setup: `@@WORKTREE_SETUP_CMD@@` (no .env files; report if a test needs one).
3. Read the task's Covers list, those ACs, design.md for UI, and the rule files the task lists. Do NOT read the implementation diff yet.
4. Write tests from the ACs alone, in the style of the test examples CLAUDE.md lists for the task's package. Title each `"AC-XXX-NNN.n: <behaviour>"`. Include the edge cases the AC implies: boundaries, empty data, error responses, slow responses, permissions, keyboard use for UI.
   How to test in this repo:
   @@TEST_GUIDE@@
5. Run the task's scoped verify (or the package's test command from CLAUDE.md)@@E2E_RUN_HINT@@.
6. Regression: `node scripts/kg.mjs impact --base feature/<feature> --head task/<ID>` (no graph: the kg-query fallback); run every test it lists.
7. Only now read the diff, to write precise bug reports for failures.
8. `node scripts/scope-check.mjs --role tester --base task/<ID>`: your branch may only add tests, fixtures, mocks and qa.md.
9. Append to specs/<feature>/qa.md: AC | test | result | date. Commit on `test/<ID>`.
10. Report in at most 15 lines: pass/fail per AC, regressions run, bugs with AC ID, expected, actual and test file.
