---
name: verify-task
description: Tester procedure for one finished task: write one test per AC from the spec before reading the code, run them and the regression tests the graph points to, record results in qa.md. Use after a dev reports a task done.
---
# Verify a task

Inputs: task ID, task branch, feature branch.

1. Read the task's Covers list and those ACs (and design.md for UI). Do NOT read the diff yet.
2. `git switch -c test/<ID> <task-branch>`.
3. Write tests from the ACs alone. Logic and components: `*.test.ts(x)` next to the code. User flows: `e2e/` with the API mocked (Playwright route interception or MSW). Title each `"AC-XXX-NNN.n: <behaviour>"`. Include the edge cases the AC implies: boundaries, empty data, API errors, slow responses, keyboard use.
4. Run the project's test command and the e2e command if present (see CLAUDE.md).
5. Regression: `node scripts/kg.mjs impact $(git diff --name-only <feature-branch>...<task-branch>)` (no graph: the kg-query fallback); run every test it lists.
6. Only now read the diff, to write precise bug reports for failures.
7. Append to specs/<feature>/qa.md: AC | test | result | date. Commit on test/<ID>.
8. Report in at most 15 lines: pass/fail per AC, regressions run, bugs with AC ID, expected and actual.
