# plan <feature>

1. Stop unless the spec is `approved` and has no open questions: `node scripts/trace.mjs <feature> --check --quiet` must pass.
2. Map the area once: `node scripts/kg.mjs find` with the spec's terms, then `deps` along the request flow (screen, state, API client, controller, service, repository, schema). Without a graph, start from CLAUDE.md's architecture map and Packages table and Grep imports along the same flow. Note the files each REQ touches and their package.
3. Split into tasks. Each covers named ACs and lists the exact files (or tight globs) it may touch; no two parallel tasks share a file. Order along the data contract:
   1. schema, migrations and generated clients;
   2. shared packages: one owner task per shared package change, and every task that consumes it depends on it;
   3. backend, then frontend;
   4. the hot files listed in CLAUDE.md: one wiring task, last.
   UI work without an approved design.md gets a designer task first, only when `.claude/agents/designer.md` exists.
4. Fill each task:
   - Stack: package dir, framework and test runner, from the Packages table.
   - Scoped verify: that package's command from the Packages table.
   - Rules: the output of `node scripts/rules-check.mjs --for <its files>`.
   - Context pack: `node scripts/kg.mjs pack <its files>`. Without a graph, write it by hand in the same shape: each file with its role, what it imports, what imports it, and its tests.
5. Create the tasks, numbering after the highest existing T-NNN:
   - GitHub tracker: list labels once (`gh label list --limit 500 --json name --jq '.[].name'`). If `task` or `feature:<feature>` is missing, create it (`gh label create "feature:<feature>" --description "<feature title>"`) and say so in the report. Then per task `gh issue create --title "T-NNN <title>" --label task --label "feature:<feature>" --body-file <file>`, the body being `specs/_templates/task.md` filled in, without its title line.
   - Files tracker: `tasks/T-NNN.md` from `specs/_templates/task.md`.
6. Write `specs/<feature>/plan.md`. Check that every AC appears in exactly one task (G1).
7. `git switch -c feature/<feature> <default branch>`; if the branch already exists, ask the user. Commit the spec, plan and (files tracker) task files there.
8. Report in under 15 lines: tasks in order with package and dependencies, labels created, anything that needs the user.
