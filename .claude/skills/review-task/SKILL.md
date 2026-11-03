---
name: review-task
description: Reviewer procedure: check a task branch against its ACs, the rules in CLAUDE.md and its knowledge-graph blast radius, then give a verdict. Use after the tester has passed a task.
---
# Review a task

Inputs: task ID, feature branch, task branch, test branch.

1. Scope: the task's Covers and file list; `git diff <feature-branch>...<task-branch> --stat`, then the full diff, then the test branch diff.
2. Blast radius: `node scripts/kg.mjs impact $(git diff --name-only <feature-branch>...<task-branch>)` (no graph: the kg-query fallback). Check every affected caller still works; spend most time on `complex` files.
3. Checklist, each pass or blocker:
   - Does what its ACs say and nothing more; only listed files touched
   - Every AC has a passing test titled with its ID (`node scripts/trace.mjs --check --quiet --ac ...`)
   - Every project rule in CLAUDE.md (conventions, recipes, forbidden list)
   - UI: all states handled (loading, empty, error); accessible names, labels and keyboard use; no layout shift from async data
   - Data: every API error path handled; no unhandled promise; no secrets or tokens in client env vars or logs
   - Text goes through i18n if the project is localized
   - No test skipped or weakened; no lint rule disabled
4. Read the source for every claim; never rely on graph summaries.
5. Output: verdict (APPROVE or CHANGES REQUIRED), blockers with file:line and the rule or AC, then at most 5 nits. If a PR exists, post with `gh pr review`.
