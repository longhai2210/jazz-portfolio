<!-- ai-workflow:begin (generated from .claude/ai-workflow.json; change that file and run /ai-workflow upgrade instead of editing this block) -->
## AI workflow

- Default branch `@@DEFAULT_BRANCH@@`. Branches: `feature/<feature>`, then `task/<ID>` (dev) and `test/<ID>` (tester).
- Tracker: @@TRACKER_LINE@@
- Install (CI and every new worktree): `@@INSTALL_CMD@@`
- Worktree setup, first command in a new worktree: `@@WORKTREE_SETUP_CMD@@`
- Verify everything (gate G3, green before reporting done): `@@VERIFY_CMD@@`
@@if:HAS_E2E@@
- E2E: `@@E2E_CMD@@`
@@end@@

### Packages
@@PACKAGES_TABLE@@

### Rules map
Read the rule file for a path before changing or reviewing it (`node scripts/rules-check.mjs --for <files>` prints them).
@@RULES_TABLE@@

### Hot files
Shared files every feature touches; one wiring task per plan owns them, scheduled last.
@@HOT_FILES@@

- Specs: `specs/<feature>/` (see specs/README.md). Every AC is proven by a test titled with its ID.
- Roles: subagents in `.claude/agents` (@@ROLES_LINE@@); the main session is the Lead via `/ai-workflow`.
- Knowledge graph (optional, local, never committed): `node scripts/kg.mjs`. Without it, use the architecture map, then Glob/Grep.
- Checks: `node scripts/trace.mjs --check`, `node scripts/rules-check.mjs`, `node scripts/scope-check.mjs --task <ID>`.
- Gates: G0 spec approved (user), G1 tasks cover every AC, G2 design approved (user, UI only), G3 verify green, G4 ACs tested, G5 review approved, G6 demo accepted (user).
<!-- ai-workflow:end -->
