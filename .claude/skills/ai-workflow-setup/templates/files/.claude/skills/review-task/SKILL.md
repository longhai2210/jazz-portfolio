---
name: review-task
description: Reviewer procedure. Read the rule files for the changed paths, check scope and AC evidence, the contracts in CLAUDE.md and the blast radius across packages, then give a verdict. Use after the tester has passed a task.
---
# Review a task

Inputs: task ID, where the task lives, feature branch, task branch `task/<ID>`, test branch `test/<ID>`.

1. Rules first: `node scripts/rules-check.mjs --for-diff feature/<feature> --head task/<ID>`. Read every file it prints, in full, before judging. Path-scoped rules do not load from `git diff`, so never assume you have seen them.
2. Scope: the task's Covers and file list; `git diff feature/<feature>...task/<ID> --stat`, then the full diff, then `git diff task/<ID>...test/<ID>`.
3. Evidence, each a blocker when it fails:
   - `node scripts/scope-check.mjs --task <ID or issue number> --base feature/<feature> --head task/<ID>`
   - `node scripts/scope-check.mjs --role tester --base task/<ID> --head test/<ID>`
   - `node scripts/trace.mjs --check --quiet --ac <the task's ACs>`
4. Blast radius: `node scripts/kg.mjs impact --base feature/<feature> --head task/<ID>` (no graph: the kg-query fallback). Check every affected caller still works, across packages; spend most time on `complex` files and shared packages.
5. Checklist, each pass or blocker:
   - Does what its ACs say and nothing more
   - Every rule in the rule files from step 1 and in CLAUDE.md; cite the rule and its example file
   - Every item under "Contracts to review" in CLAUDE.md that the diff touches (for example API types on both sides, cache invalidation, all locales)
   - UI changes: all states handled (loading, empty, error); accessible names, labels and keyboard use; text through i18n where that package is localized
   - Data: every API error path handled; no unhandled promise; no secrets or tokens in client env vars or logs
   - No test skipped or weakened; no lint rule disabled; no build output or generated code committed
6. Read the source for every claim; never rely on graph summaries.
7. Output to the Lead (you post nothing to GitHub): verdict (APPROVE or CHANGES REQUIRED), blockers with file:line and the rule, contract or AC, then at most 5 nits.
