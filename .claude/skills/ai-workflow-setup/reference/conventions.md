# Conventions from the code (init step D)

Goal: rules an agent can follow and a reviewer can check, taken from what this repo already does.
Never write framework best practice the code does not follow.

## Where rules go
- Single app and CLAUDE.md under ~150 lines: a `## Conventions` section in CLAUDE.md.
- Monorepo, or CLAUDE.md would pass ~150 lines (Claude Code advises under 200): one file per scope in
  `.claude/rules/<scope>.md` with `paths:` front matter (template: `<setup skill dir>/templates/rule.md`).
  Scope = a package (`apps/web/**`) or a layer inside one (`apps/api/src/**/dto/**`). Keep repo-wide rules in CLAUDE.md.
- Record each rule file in `.claude/ai-workflow.json` under `rules` (`{ "paths": [...], "file": ".claude/rules/web.md" }`)
  so the CLAUDE.md Rules map lists it. Agents read rule files directly through that map and
  `node scripts/rules-check.mjs --for <files>`: path-scoped rules do not auto-load in subagent worktrees
  (Claude Code docs, worktrees page) or from `git diff`.

## Extracting
1. Per package and layer (pages/routes, components, hooks/state, API client; controllers, services, DTOs,
   repositories, migrations; shared types), pick 3 to 5 representative files: the most imported
   (`node scripts/kg.mjs deps`, or Grep import counts) and the most recently changed (`git log -n 50 --name-only`).
2. Read them and list candidate patterns: file layout and naming, how data is fetched and errors handled,
   validation, state, styling, test style. A pattern is a rule only if it holds in nearly all sampled files
   AND in a quick Grep over the package (count matches vs. counter-examples).
3. Each rule is one line plus `Example: \`path\`` naming a real file that follows it best.
   `node scripts/rules-check.mjs` fails CI when that file disappears, so pick stable files.

## Contradiction check (before writing anything, including the Forbidden list)
For each candidate rule and each Forbidden item, compare with tools and code:
- Lint: `findings.packages[].eslintRules` from `detect.mjs --eslint` (or `npx eslint --print-config <file>`).
- Types: tsconfig `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`.
- Code: Grep for counter-examples (e.g. `findings.packages[].anyCount` for `any`).
If a rule is not enforced and the code breaks it often (example: "no `any`" while
`@typescript-eslint/no-explicit-any` is off and the package has 140 `any`), do NOT write it as a rule.
List it to the user as a conflict: "keep as goal (add to Known gaps), enforce gradually (lint proposal), or drop".
Only consistent, true statements become rules. Known gaps go under a `## Known gaps` heading so nobody
mistakes them for followed rules.

## Approval
Show the user, per scope: rules with examples, conflicts, and the files you would write. Write nothing
until they approve. Then fill `rules` in the config and rerun `install.mjs` so the Rules map updates.

## Contracts to review
From the same reading, list cross-boundary checks that are specific to this repo, for CLAUDE.md
"Contracts to review" (and a rule file's own section). Examples of the kind, only if they apply:
API DTOs in the backend match the client types or shared package; a mutation invalidates the queries
that read the same data; every locale file gets the new keys; a migration ships with the schema change;
server-only modules are never imported by client components.
