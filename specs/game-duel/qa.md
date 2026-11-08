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

## T-005 (spec 0.3) - 2026-11-08

Test file: `apps/web/src/game/core/ac-score.test.ts` (tester); dev's own direction/feel/scoring/difficulty tests also pass. Whole web suite: 15 suites, 106 tests green.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-005.1 | ac-score.test.ts (same way, unmatched note is not correct) | pass | 2026-11-08 |
| AC-DUEL-005.2 | ac-score.test.ts (opposite correct; same way and repeated button wrong) | pass | 2026-11-08 |
| AC-DUEL-005.3 | ac-score.test.ts (repeat pair uncounted) | pass | 2026-11-08 |
| AC-DUEL-005.4 | ac-score.test.ts (2/3, empty and no counted pair = 1, unordered input) | pass | 2026-11-08 |
| AC-DUEL-009.1 | ac-score.test.ts (3, 2, 1 patterns, empty) | pass | 2026-11-08 |
| AC-DUEL-009.2 | ac-score.test.ts (0 and 3 yes; 0 and 2 no; 0 and 1 no; steady beats no; across bar line, unordered) | pass | 2026-11-08 |
| AC-DUEL-009.3 | ac-score.test.ts (75% = 0, exactly 60% = 1, quote bars excluded) | pass | 2026-11-08 |
| AC-DUEL-009.4 | ac-score.test.ts (under 3 taps = 0, mean of criteria) | pass | 2026-11-08 |
| AC-DUEL-010.1 | ac-score.test.ts (penalty, floor at 0) | pass | 2026-11-08 |
| AC-DUEL-010.2 | ac-score.test.ts (nearest step, offset, no taps = 0) | pass | 2026-11-08 |
| AC-DUEL-010.3 | ac-score.test.ts | pass | 2026-11-08 |
| AC-DUEL-010.4 | ac-score.test.ts (39/40/65/85 and just below) | pass | 2026-11-08 |
| AC-DUEL-010.5 | ac-score.test.ts (100 points, 3 stars, no float drift at 85) | pass | 2026-11-08 |
| AC-DUEL-011.2 | ac-score.test.ts (Lounge markers and lines on both sides, Session, Late Set, assist windows) | pass | 2026-11-08 |

Gaps: AC-DUEL-005.1 does not say whether a pair with an unmatched note is "wrong" or "uncounted"; the test only asserts it is not correct. Pure core, no UI.

## T-008

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-015.7 | ContentSettingsForm.qa.test.tsx (off to on sends true; saved true off sends false; untouched keeps value; independent of Blog off) | pass | 2026-11-08 |
| AC-DUEL-015.7 | ContentSettingsForm.qa.test.tsx (design states: 404 warning when off, neutral note when on, loading, load error, saving) | pass | 2026-11-08 |

Verify: web build of deps, lint, type-check, jest (17 suites, 123 tests) green. Gaps: component test only, no browser e2e; the real PUT round trip is covered by other tasks (AC-DUEL-015.1 to 015.3).
