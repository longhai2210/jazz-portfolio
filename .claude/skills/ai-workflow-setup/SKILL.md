---
name: ai-workflow-setup
description: Installer behind /ai-workflow init and /ai-workflow upgrade. Detects the stack (single app or monorepo, frontend or backend), proposes a config, then writes CLAUDE.md, role agents and skills, hooks, check scripts, spec templates and CI gates from bundled templates on a branch, with a lock file for upgrades.
user-invocable: false
---
# Set up or upgrade the AI workflow: $ARGUMENTS

The first word of the arguments is the mode: `init` or `upgrade`. Work on a branch, change nothing beyond what the installer reports and the steps below name, and end with a short report. After a context compaction, invoke this skill again with the same mode and continue from the phase you were in.

Bundled tools, run from the repository root:
- `node "${CLAUDE_SKILL_DIR}/scripts/detect.mjs"`: read-only detection. Prints `{config, findings}` JSON; `--summary` for people; `--config-out <path>` writes the proposed config; `--merge <config>` keeps the user's choices.
- `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs"`: renders `${CLAUDE_SKILL_DIR}/templates/` with `.claude/ai-workflow.json`, writes the files and `.claude/ai-workflow.lock.json`, and reports. Never type a generated file yourself: change the config (keys in `${CLAUDE_SKILL_DIR}/reference/config.md`) or the template, then rerun.
- `node "${CLAUDE_SKILL_DIR}/scripts/validate-clean.mjs"`: the gates in a clean temporary LF checkout, with Turborepo and Nx caches bypassed.
- `node "${CLAUDE_SKILL_DIR}/scripts/doctor.mjs"`: checks the installed workflow on the real repo (hooks in a temporary worktree, settings, drift, hygiene).
- `node "${CLAUDE_SKILL_DIR}/scripts/lint-probe.mjs"`: violation count for a candidate ESLint rule.
- `${CLAUDE_SKILL_DIR}/reference/conventions.md` and `${CLAUDE_SKILL_DIR}/reference/lint-proposals.md`: Phase 5.

Rules in both modes:
- Never run /understand. Never read or edit .env files (`.env.example` is fine).
- Never enable a lint rule, mass-fix existing errors, edit an existing CI workflow, push, or merge without the user's yes.
- Keep existing scripts, test runners and configs; add only what is missing. Existing script names (`type-check`, `test:unit`) are reused, not duplicated.
- No hardcoded branch, package manager, path or stack: everything comes from detection and the user's answers in the config.

# init

## Phase 0: Preconditions
1. `node "${CLAUDE_SKILL_DIR}/scripts/detect.mjs" --summary`. If `.claude/ai-workflow.lock.json` exists, stop and tell the user to run `/ai-workflow upgrade` (install.mjs refuses too).
2. The working tree must be clean (detect ignores this skill's own folders, `.ua/`, `.understand-anything/` and `.claude/settings.local.json`). If it is not, stop and give the user these steps, filled in:
   ```
   git switch -c wip/<topic>
   git add -A -- . ':!.claude/skills/ai-workflow' ':!.claude/skills/ai-workflow-setup' ':!.ua' ':!.understand-anything'
   git commit -m "wip: <topic>"
   git switch <default branch>
   ```
   Warn them: `git stash -u` also stashes the untracked `.claude/skills/ai-workflow*` folders, which removes this skill while it runs. To stash instead: `git stash push -u -m wip -- . ':!.claude/skills/ai-workflow' ':!.claude/skills/ai-workflow-setup' ':!.ua' ':!.understand-anything'`. If `findings.git.dirtyEnvFiles` lists files, tell them never to commit those.
3. `git switch -c chore/ai-workflow <default branch>`. The default branch comes from `origin/HEAD` (`findings.git.defaultBranchSource` says when it fell back to a local guess; then ask).

## Phase 1: Detect (read, don't guess)
1. `node "${CLAUDE_SKILL_DIR}/scripts/detect.mjs" --gh --eslint --config-out .claude/ai-workflow.json`. `--gh` needs a signed-in `gh`; `--eslint` needs installed dependencies (otherwise drop it now and run lint checks in Phase 5).
2. Read the findings: per package `framework`, `kind` (frontend, backend, mobile, library), test runner, scripts, test examples, i18n, tokens; the default branch and its source; package manager and `packageManager` field; codegen (for example `prisma generate`); existing workflows (missing branches, env values copied, secrets not copied); tracked build output and `buildinfoRisk`; tracked env files; CLAUDE.md and AGENTS.md; hot-file candidates; labels; warnings.
3. Read what JSON cannot tell, two levels deep in each package's `src/` or `app/`: entry points and how a request flows, state, router, UI library, API client, ORM, module layout. With a graph, `node "${CLAUDE_SKILL_DIR}/templates/files/scripts/kg.mjs" find|show|deps` answers this cheaply.

## Phase 2: Confirm once
Show the user, in one message, the summary per package and these decisions with your default, then wait:
1. Tracker: GitHub Issues (default when the remote is GitHub and `gh` works) or `tasks/*.md`. GitHub without a `task` label: offer `gh label create task --description "AI workflow task"`.
2. Test tooling, only for packages without a runner, matching their stack (Phase 3). Packages with a runner keep it. Default yes.
3. Playwright end-to-end tests now (default no; can be added later).
4. CI: `ci.env` holds literal placeholder values copied from existing workflows (needed at build time). Secrets those workflows use are not copied: list them and ask whether ai-gates needs them (as repository secrets, never in the file).
5. CLAUDE.md, `specs/`, `.claude/agents` and `.claude/skills` are committed (default yes). Real `.env` files are never copied into worktrees; a `.worktreeinclude` entry only for a file a test needs, with the user's yes.
6. Where conventions go: CLAUDE.md for a small single app; `.claude/rules/<scope>.md` for a monorepo or when CLAUDE.md would pass about 150 lines.
Write the answers into `.claude/ai-workflow.json`.

## Phase 3: Test tooling (only what the user agreed to)
Install into the package only (`pnpm --filter <name> add -D`, `npm i -D -w <dir>`, `yarn workspace <name> add -D`, or plain for a single app).
- Vite or Next.js without tests: `vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom` (Next.js also `@vitejs/plugin-react`). Config from `${CLAUDE_SKILL_DIR}/templates/optional/vitest.config.ts` (Next.js: `defineConfig({ plugins: [react()], test: {...} })` instead of merging vite.config) and the setup file from `${CLAUDE_SKILL_DIR}/templates/optional/vitest.setup.ts` at the path the config names. Script `test:ci`: `vitest run`.
- NestJS without tests: `jest ts-jest @types/jest @nestjs/testing` (and `supertest @types/supertest` for HTTP tests); Jest config as Nest generates it (`rootDir: src`, `testRegex: .*\.spec\.ts$`, ts-jest transform). Script `test:ci`: `jest --ci`.
- Each new setup gets one smoke test against real code: render a real leaf component, or compile a real module with `Test.createTestingModule`.
- Playwright, if agreed: `@playwright/test`, `playwright.config.ts` with `webServer` set to the dev command and port, `e2e/smoke.spec.ts`.
- No lockfile yet: run the install once so CI can do a frozen install.
Then refresh the config, keeping the answers: `node "${CLAUDE_SKILL_DIR}/scripts/detect.mjs" --merge .claude/ai-workflow.json --config-out .claude/ai-workflow.json`.

## Phase 4: Write the files
1. `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --dry-run`, then without `--dry-run`. It writes the agents, role skills, hooks, scripts, spec templates, ai-gates and settings (merged into an existing one), appends the AI workflow block to CLAUDE.md (or writes a skeleton), adds missing package.json scripts (root aggregates in a monorepo), updates .gitignore (`.ua/*` instead of `.ua/`, `.claude/worktrees/`), and writes the lock. A conflict in init is an existing file that differs: show it (`--diff <path>`) and take the template only with the user's yes (`--accept <path>`).
2. CLAUDE.md is yours to fill; the block between the `ai-workflow` markers is generated. Fill every `<...>` from Phase 1 with real paths; for an existing CLAUDE.md add only the missing sections. Conventions and Forbidden go through Phase 5's contradiction check. Keep the file under 200 lines.
3. Hot files: from `findings.hotFileCandidates`, keep the shared files most features must touch (route registry, root module, store root, i18n index, API client registry, navigation config), confirmed by reading each. Put them in `hotFiles`.
4. `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --upgrade` refreshes the block (it rewrites only what it wrote and nobody edited).

## Phase 5: Conventions from the code, and lint proposals
Follow `${CLAUDE_SKILL_DIR}/reference/conventions.md`:
1. Small single app: conventions stay in CLAUDE.md. Otherwise one `.claude/rules/<scope>.md` per package or layer from `${CLAUDE_SKILL_DIR}/templates/rule.md`, with `paths`.
2. Read 3 to 5 representative files per layer. Keep only patterns the code follows consistently, each with `Example: \`<real file>\``. Never write framework best practice the code does not follow.
3. Contradiction check for every rule and every Forbidden line against the lint config (`findings.packages[].eslintRules`), tsconfig and the code (for example `anyCount`). A rule that no tool enforces and the code often breaks is not written as followed: present it as a conflict (keep as a goal under Known gaps, enforce gradually, or drop) and ask.
4. Show the proposed rules per scope with their examples, the conflicts and the files to write. Write only after the user approves. Record each rule file in `rules` in the config, rerun `install.mjs --upgrade` (Rules map), and `node scripts/rules-check.mjs` must pass.
5. Add the repo's own "Contracts to review" to CLAUDE.md (and to the rule files): DTOs vs the API client, cache invalidation, every locale has the keys, migrations with schema changes. Only those that apply.
6. Lint (`${CLAUDE_SKILL_DIR}/reference/lint-proposals.md`): measure candidates with `lint-probe.mjs` and propose two groups: 0 violations (can be enabled at `error` now) and with violations (tighten gradually). Say that `warn` never fails verify; blocking needs `error` or `--max-warnings=0`. Change no ESLint config without the user's yes.

## Phase 6: Hygiene report (propose, don't apply)
- Tracked build output (`findings.trackedArtifacts`): propose `git rm -r --cached <paths>` with .gitignore lines, in its own commit. With `buildinfoRisk`, explain: a committed `*.tsbuildinfo` with `incremental: true` makes `tsc` on a fresh CI checkout think its outputs are current and skip emitting (`dist/index.js`, `dist/index.d.ts` missing), while local builds stay green.
- Existing workflows that trigger on missing branches (`findings.workflows[].missingBranches`), or pass `version` to `pnpm/action-setup` while package.json has `packageManager`: report only.
- Tracked .env files (`findings.envTracked`): propose `git rm --cached`, a .gitignore line, and rotating the secrets.
- `findings.mustNotBeIgnored`: un-ignore CLAUDE.md, specs/, .claude/agents, .claude/skills.
- `.ua/.understandignore` exists: suggest adding `specs/`, `dist/`, `build/`, `coverage/`, locale folders, `e2e/fixtures/`.

## Phase 7: Validate locally
1. Parse `.claude/settings.json`, `.claude/ai-workflow.json` and the lock; `node --check` every `scripts/*.mjs` and `.claude/hooks/*.mjs`; `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --check` reports no drift.
2. Run the verify command, `node scripts/trace.mjs --check --quiet` and `node scripts/rules-check.mjs`. Problems that existed before (lint or type errors) are not mass-fixed: record the count and top files as a baseline and ask whether to fix them as separate tasks. If lint or a format check fails only on generated files, propose ignore entries for them: reformatting would turn each one into a user edit for every later upgrade.
3. `node "${CLAUDE_SKILL_DIR}/scripts/doctor.mjs"`. FAILs already in the Phase 6 report stay until the user applies them. When it warns that ESLint or the test runner reaches into `.claude/worktrees/` (other agents' unfinished work would fail the Lead's verify), propose the ignore entry it prints; change that config only with a yes.

## Phase 8: Commit, then validate in a clean checkout
1. `git add` exactly: what install.mjs reported (created, updated, scripts, .gitignore, .nvmrc), the config and lock, CLAUDE.md, approved rule files, Phase 3 files and lockfile, and `.claude/skills/ai-workflow/` plus `.claude/skills/ai-workflow-setup/` so teammates get the same commands. Never `git add -A`. Commit `chore: scaffold AI workflow (ai-workflow <version from ${CLAUDE_SKILL_DIR}/VERSION>)`.
2. `node "${CLAUDE_SKILL_DIR}/scripts/validate-clean.mjs" --ref chore/ai-workflow`: install, codegen, verify, trace and rules-check in a fresh LF checkout, as CI runs them. It catches what only exists locally (ignored or untracked files, stale build info, CRLF). Fix real gaps (a missing codegen step, an untracked file the build needs), commit, and rerun until green, or report what stays red and why. A FAIL in "tracked files untouched" means a step rewrote a committed file (`next-env.d.ts`, `*.tsbuildinfo`, build output); each line says what to propose. Apply it only with a yes, in its own commit.
3. Ask before pushing or opening a PR.

## Phase 9: Report (at most 25 lines)
Stack per package; files created, updated, kept and in conflict; scripts added and existing ones reused; verify in this checkout and in the clean checkout; baseline issues; hygiene and lint proposals; and the line "ai-gates on GitHub: not run yet (it runs when the branch is pushed)". Next steps for the user: review and merge `chore/ai-workflow`, require the `ai-gates` check in branch protection, run `/ai-workflow doctor` after the merge, optionally `/understand`, then `/ai-workflow spec <feature> "<request>"`.

# upgrade

1. Clean tree (Phase 0, step 2), then `git switch -c chore/ai-workflow-<new version> <default branch>`.
2. Read `.claude/ai-workflow.lock.json`. Without it (scaffolded by 1.x), every generated file that differs from the new template counts as the user's edit: nothing is overwritten without a yes.
3. Config:
   - It exists: `node "${CLAUDE_SKILL_DIR}/scripts/detect.mjs" --merge .claude/ai-workflow.json --config-out .claude/ai-workflow.json`, then show `git diff .claude/ai-workflow.json`. The user's choices are kept; facts (package manager, test runners, scripts) are refreshed; new keys get defaults.
   - It is missing (1.x): run init's Phases 1 and 2 to create it, carrying over what CLAUDE.md already says (tracker, verify, conventions).
4. `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --upgrade --dry-run` and show the report.
5. For each conflict, show `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --diff <path>` (`--diff CLAUDE.md` for the block) and ask: take the template (`--accept <path>`; agent files keep the user's `model`, `effort` and `color`), or keep theirs (`--keep <path>`; the next upgrade asks again only if that template changes). "Kept, edited by you" files had no template change and need no question. Files the user deleted stay deleted unless they ask.
6. `node "${CLAUDE_SKILL_DIR}/scripts/install.mjs" --upgrade --accept <a,b> --keep <c,d>` with their answers.
7. From 1.x: CLAUDE.md still has the old "## AI workflow" section next to the new block. Show it and propose removing it; remove only with a yes. List any 1.x files that are no longer generated; leave them in place.
8. Phase 7 and Phase 8 (commit `chore: upgrade AI workflow to <version>`, then the clean checkout), and report: updated, kept, conflicts and the decisions taken, config changes, validation results, and that ai-gates on GitHub has not run yet. Suggest `/ai-workflow doctor` after the merge.
