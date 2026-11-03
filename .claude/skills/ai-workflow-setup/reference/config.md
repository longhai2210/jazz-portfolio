# .claude/ai-workflow.json (committed; the single source for generated files)

Written by `detect.mjs --config-out`, reviewed with the user, read by `install.mjs`, the hooks and
the repo scripts. Change it and run `/ai-workflow upgrade` instead of editing generated files.

| Key | Meaning |
|---|---|
| `version` | skill version that wrote it |
| `defaultBranch` | from `origin/HEAD`; used by ai-gates, kg.mjs, specs |
| `packageManager`, `packageManagerField`, `pnpmVersion`, `yarnBerry` | CI setup; `pnpmVersion` only when there is no `packageManager` field |
| `nodeVersionFile`, `createNvmrc` | setup-node input; `.nvmrc` is created only when nothing pins Node |
| `monorepo` | `null` or `{ tools: [...] }` |
| `tracker` | `github` or `files` |
| `hasFrontend` | creates the designer role and design template |
| `commands.install` | frozen install (CI, worktrees) |
| `commands.codegen` | e.g. prisma generate; run after install in CI and worktrees |
| `commands.worktreeSetup` | install + codegen, first step of every dev/tester worktree |
| `commands.verify` | gate G3, always the root `verify` script |
| `commands.e2e`, `commands.e2eInstall` | only when Playwright is configured |
| `scripts[]` | `{dir, name, cmd}` added to package.json when missing; existing scripts are never overwritten |
| `packages[]` | per package: `dir`, `kind`, `framework`, `testRunner`, `scopedVerify`, `testExamples`, `i18n`, `msw`, `playwright`, `tokens` |
| `rules[]` | `{paths, file}` for each approved `.claude/rules` file |
| `hotFiles[]` | files most features touch; one wiring task owns them |
| `roles.tester.allow`, `roles.designer.allow` | globs the guard-paths hook and `scope-check --role` allow |
| `artifacts[]` | globs that scope-check always rejects (build output) |
| `ci.env` | literal env values copied from existing workflows (placeholders for build) |
