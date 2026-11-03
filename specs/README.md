# Specs

One folder per feature: `specs/<feature>/` with `requirements.md`, optional `api.md`, `design.md` + `mockups/` (UI only), `plan.md`, `qa.md`, and the generated `trace.md`. Templates are in `_templates/`.

- IDs: `REQ-<AREA>-NNN` for a requirement, `AC-<AREA>-NNN.n` for its acceptance criteria. Never reuse or renumber; a dropped requirement keeps its ID and says "dropped".
- Status in front matter: `draft` -> `approved` (only a human sets this) -> `implemented` -> `verified`.
- After approval, any change bumps `version`, adds a line to the change log, and reopens the affected tasks.
- Every AC is proven by a test whose title starts with its ID. `node scripts/trace.mjs <feature>` shows the matrix.
- Branches: `feature/<feature>` from `master`, then `task/<ID>` (dev) and `test/<ID>` (tester) per task.
- Task status: Ready, In progress, In test, In review, Awaiting sign-off, Done, Blocked.
