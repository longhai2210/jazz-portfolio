# QA: game-stage

## T-019

| AC | Test | Result | Date |
|---|---|---|---|
| AC-STAGE-003.2 | `apps/web/src/game/stage/street/street.ac.test.ts` | pass | 2026-11-21 |
| AC-STAGE-003.3 | same (pure `isNearDoor`; the E/Enter key and tap-to-enter wiring belongs to T-021) | pass | 2026-11-21 |
| AC-STAGE-003.4 | same | pass | 2026-11-21 |
| AC-STAGE-004.1 | same | pass | 2026-11-21 |
| AC-STAGE-004.2 | same | pass | 2026-11-21 |

Regression: street folder is new and nothing imports it yet; web type-check and the street suites (56 tests) pass. The exact door-radius boundary is asserted in the developer's `door.test.ts` (lines 14-15): a distance of exactly 1.2 m counts as near, the agreed reading of "trong DOOR_PROMPT_RADIUS" (inclusive). `street.ac.test.ts` tests only clearly inside and clearly outside.
