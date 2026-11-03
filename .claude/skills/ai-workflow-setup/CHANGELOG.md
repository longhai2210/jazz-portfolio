# Changelog

## 2.0.0

Packaging
- The zip holds two skill folders at the top level; unzip into `.claude/skills/`.
- Generated files are real templates under `templates/`, rendered by `scripts/install.mjs`. SKILL.md keeps only the procedure.
- `.claude/ai-workflow.json` (committed) is the single source for generated files; `.claude/ai-workflow.lock.json` records the version and a hash per generated file.
- New `/ai-workflow upgrade`: updates untouched files, keeps edited ones and asks (`--diff`, `--accept`, `--keep`). Without a lock every difference counts as an edit. Agent `model`, `effort` and `color` are never overwritten.
- New `/ai-workflow doctor`: non-destructive checks on the real repo, including a live subagent check of path-scoped rules and hooks in worktrees.

Init
- Monorepos (pnpm, npm, yarn, bun workspaces; Turborepo, Nx, Lerna) with framework, kind and test runner per package; backends such as NestJS are handled. Existing script names are kept; root aggregate scripts are added when missing.
- Default branch from `origin/HEAD`, used by ai-gates, kg.mjs, specs and skills.
- ai-gates matches the repo: package manager, no pnpm `version` when `packageManager` is set, codegen step, placeholder env copied from existing workflows. Existing workflows are reported, never edited.
- Settings deny reading and editing `.env*` at any depth, except `.env.example`.
- Hygiene report: tracked build output (stale `*.tsbuildinfo`), tracked `.env`, `.claude/worktrees/` ignored.
- Validation in a clean LF checkout (`validate-clean.mjs`); the report says whether ai-gates ran on GitHub. A committed file that a step rewrites (`next-env.d.ts`, `*.tsbuildinfo`, build output) fails with what to propose. Turborepo and Nx caches are bypassed, since Turborepo shares its local cache with git worktrees.
- `doctor.mjs` runs in init too; it warns when ESLint or the test runner reaches into `.claude/worktrees/`.
- Conventions from the code: path-scoped rule files with real examples, a contradiction check against lint and code, user approval before writing; lint rules are only proposed, with violation counts.

Workflow
- Worktree setup (install + codegen) is the first step of implement-task and verify-task.
- `guard-paths` resolves paths from the hook input's `cwd`, with allowlists from the config; `scope-check.mjs` enforces each task's file list, including writes made through Bash.
- One branch name, `task/<ID>`; worktree hygiene frees a branch before a fix round.
- Roles read rule files directly (CLAUDE.md Rules map, `rules-check --for`), since path-scoped rules may not load in worktrees; `rules-check` fails CI when an example file disappears.
- Tasks carry Stack, Scoped verify and Rules; plan orders tasks along the data contract with one owner per shared package; hot files come from the repo.
- Tester guidance per stack from the repo's own tests; reviewer Bash is read-only through `guard-bash`; designer only for repos with a frontend.
- signoff requires a green ai-gates run on the PR.
