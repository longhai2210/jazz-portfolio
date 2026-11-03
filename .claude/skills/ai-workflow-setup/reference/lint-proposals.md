# Lint proposals (init step D5): propose, never enable

Measure each candidate with `node <setup skill dir>/scripts/lint-probe.mjs --dir <pkg> --rule '<json>'`
(needs installed node_modules). Present two groups and let the user decide:

1. **0 violations: can be enabled now** at `"error"`. New violations then fail verify (G3).
2. **Has violations: tighten gradually.** Show count and top files. Options: fix first then enable at
   `"error"`; or start at `"warn"`. Say it plainly: `warn` never makes verify red. Blocking needs `"error"`,
   or running lint with `--max-warnings=0` (which also turns every existing warning into a failure).

Never edit the ESLint config without the user's yes, and never mass-fix existing violations in init.

## Candidates (offer only those that fit what you found)
- **Deprecated module or wrong layer**: `no-restricted-imports` with `paths`/`patterns`, e.g. block `moment`
  when the code uses `date-fns`, block `apps/web` importing from `apps/api/src`, block deep imports into a
  shared package (`@acme/shared/src/*`). Rule JSON:
  `{"no-restricted-imports":["error",{"patterns":[{"group":["@acme/shared/src/*"],"message":"Import from @acme/shared"}]}]}`
- **Server-only code in Next.js**: modules that read secrets or the database start with `import 'server-only'`
  (package `server-only`), so a client import fails the build. Count candidates with Grep
  (`process.env.` without `NEXT_PUBLIC_` in files under `app/` or `lib/` that client components import).
- **i18n completeness**: a test that loads every locale file per namespace and asserts the same key set
  (only for packages with i18n). Count today's missing keys by diffing key sets before proposing it.
- **`any`**: `@typescript-eslint/no-explicit-any` at error (probe first; usually "tighten gradually").
- **Hooks**: `react-hooks/exhaustive-deps` at error when it is only `warn` today.
- **Floating promises** (backend): `@typescript-eslint/no-floating-promises` (needs typed linting).
