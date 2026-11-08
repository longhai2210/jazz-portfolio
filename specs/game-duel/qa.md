# QA log: game-duel

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-015.1 | apps/api/src/settings/settings.game-flag.qa.spec.ts (update true, cache invalidated, public true, purge settings; toggle off) | pass | 2026-11-07 |
| AC-DUEL-015.2 | same file (DTO validation rejects "yes", 1, "true", {}; accepts true/false). The 400 itself comes from the global ValidationPipe, not exercised without an HTTP client | pass | 2026-11-07 |
| AC-DUEL-015.3 | same file (update without the field omits it from Prisma data and keeps the value; blog-off does not touch it) | pass | 2026-11-07 |
| AC-DUEL-015.4 | apps/web/src/lib/portfolio-data.qa.test.ts (rejected call, empty data, real true passes through) | pass | 2026-11-07 |

Gaps: no HTTP-level test of the 400 response and no database-level test of the migration (no Postgres in the worktree).

## T-003 (spec 0.2) - 2026-11-07

Test file: `apps/web/src/game/core/ac-clock.test.ts` (tester); dev's own tests in clock/calibration/judge.test.ts also pass.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-001.1 | ac-clock.test.ts | pass | 2026-11-07 |
| AC-DUEL-001.2 | ac-clock.test.ts | pass | 2026-11-07 |
| AC-DUEL-001.3 | ac-clock.test.ts | pass | 2026-11-07 |
| AC-DUEL-001.4 | ac-clock.test.ts | pass | 2026-11-07 |
| AC-DUEL-002.1 | ac-clock.test.ts (incl. +300 ms at 90 BPM, unordered taps, 250/251 boundary) | pass | 2026-11-07 |
| AC-DUEL-002.2 | ac-clock.test.ts | pass | 2026-11-07 |
| AC-DUEL-003.1-003.6 | ac-clock.test.ts (boundaries, Lounge/Late Set, assist, pairing) | pass | 2026-11-07 |

Gap: pure core, no UI; no e2e tool. Web needed `packages/shared` built before type-check.

## T-007 - 2026-11-08

Test file: `apps/web/src/game/audio/ac-audio.test.ts` (tester, own fake of Web Audio); dev's tests in the same folder also pass. Web suite: 16 suites, 132 tests pass; lint and type-check clean.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-013.1 | ac-audio.test.ts (context created and `resume()` called before the first await, state running; reuse suspended; replace closed; webkit prefix; stuck, hanging and rejecting resume give a result, no throw) | pass | 2026-11-08 |
| AC-DUEL-013.2 | ac-audio.test.ts (no Web Audio and throwing constructor give `unsupported`, no throw) | pass | 2026-11-08 |
| AC-DUEL-013.5 | ac-audio.test.ts (each button starts at `currentTime`, 4 rising pitches, follows clock, rapid-fire; suspend and close reach the context) | pass | 2026-11-08 |

Gaps: the "message and back button" half of 013.2 is UI (T-010); the audio layer only returns `unsupported`. Real browser gesture policy and audible output are not testable in Jest (fake context). Needs `packages/shared` built before type-check. Graph has no entry for the new files, so regression was the whole web suite.
