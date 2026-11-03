# run <feature>

Drive Ready tasks to "Awaiting sign-off", from the main checkout on `feature/<feature>`. Loop until every task is Done or Blocked:

1. Pick Ready tasks whose dependencies are Done and whose files don't overlap; at most 3 at a time.
2. Designer tasks: spawn `designer`. Then stop and ask the user to approve design.md (gate G2) before dependent dev tasks start.
3. Dev tasks: spawn one `dev` subagent per task in the background. Prompt: task ID, where the task lives (issue number or `tasks/<ID>.md`), feature branch, "follow implement-task and the task's context pack". Nothing else; the task holds the details. Set it In progress.
4. When a dev reports done: `node scripts/scope-check.mjs --task <ID> --base feature/<feature> --head task/<ID>`. A failure is a fix round (step 6); never widen the task's file list without the user's agreement. Then spawn `tester` (task ID, where it lives, task branch, feature branch) and set In test.
5. When the tester passes: spawn `reviewer` (task ID, where it lives, feature, task and test branches) and set In review.
6. Fix round, on a failing AC, a scope failure or CHANGES REQUIRED:
   - Write the findings onto the task (issue comment or the task's Log).
   - Worktree hygiene (SKILL.md) for `task/<ID>`, and for `test/<ID>` before the re-test.
   - Spawn a new `dev`: task ID, where it lives, feature branch, "fix round: <findings>". It switches to the existing `task/<ID>`. Then tester (re-test) and reviewer again.
   - After 2 failed rounds on one task, mark it Blocked and ask the user.
7. On APPROVE, in the main checkout on `feature/<feature>`:
   1. Both must pass: `node scripts/scope-check.mjs --task <ID> --base feature/<feature> --head task/<ID>` and `node scripts/scope-check.mjs --role tester --base task/<ID> --head test/<ID>`.
   2. `git merge --no-ff task/<ID>`, then `git merge --no-ff test/<ID>`. On a conflict, `git merge --abort`, mark the task Blocked and tell the user.
   3. The verify command from CLAUDE.md (G3 on the merged result). If it fails only on files under `.claude/worktrees/`, that is other agents' unfinished work picked up by a linter or test runner that does not ignore `.claude/**` (doctor warns about it): judge the merge with `node "<setup>/scripts/validate-clean.mjs" --ref feature/<feature>` instead, and propose the ignore entry to the user.
   4. Worktree hygiene for both branches, then mark the task Done (close the issue with a comment, or update the file).
8. After each merge round, if a graph exists and `kg.mjs status` shows drift, ask the user to run /understand before the next `plan` (running tasks can continue).
9. When all tasks are Done:
   1. Set the spec to `implemented`, run `node scripts/trace.mjs <feature> --check --write`, and commit.
   2. `node "<setup>/scripts/validate-clean.mjs" --ref feature/<feature>`: the gates in a clean LF checkout, the way CI runs them. Anything red is fixed (a task for product code) or reported.
   3. Start the dev server if CLAUDE.md names one, and give the user a sign-off summary: ACs and their tests, review verdicts, scope checks, the clean-checkout result, anything Blocked, how to try it. Say that ai-gates on GitHub has not run yet. Stop here: gate G6 belongs to the user.
