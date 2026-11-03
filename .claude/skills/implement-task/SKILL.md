---
name: implement-task
description: Developer procedure for one task: read the task and its context pack, build on a task branch, test by AC ID, pass verify, check impact, commit and report. Use when assigned a coding task.
---
# Implement a task

Inputs from the Lead: task ID, where the task lives (GitHub issue number or tasks/<ID>.md), feature branch.

1. Read the task (`gh issue view <n>` or `tasks/<ID>.md`), the ACs it covers in specs/<feature>/requirements.md, and design.md if the task is UI.
2. Branch: `git switch -c task/<ID>-<slug> <feature-branch>`.
3. Read the files in the context pack (source, not summaries). Use `node scripts/kg.mjs show|deps` only for gaps.
4. Follow CLAUDE.md: its recipes, conventions and forbidden list.
5. Unit or component tests next to the code you change, one per AC, titled `"AC-XXX-NNN.n: <behaviour>"`. Cover every UI state the AC implies (loading, empty, error).
6. Gate G3: run the project's verify script (see CLAUDE.md). Fix until green. Never disable a lint rule, skip a test or loosen a type to get there.
7. `node scripts/kg.mjs impact --base <feature-branch>` (no graph: the kg-query fallback); run every test it lists. If an upstream file outside your list must change, stop and report.
8. `node scripts/trace.mjs --check --quiet --ac <the task's ACs, comma separated>`.
9. Commit: `git commit -m "<ID>: <summary>" -m "Covers: AC-..."`.
10. Report in at most 15 lines.
