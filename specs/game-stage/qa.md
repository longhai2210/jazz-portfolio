# QA: game-stage

## T-018

| AC | test | result | date |
|---|---|---|---|
| AC-STAGE-001.3 | apps/web/src/game/stage/assets/qa-t018.test.ts (+ dev manifest.test.ts) | pass | 2026-11-21 |
| AC-STAGE-001.4 | apps/web/src/game/stage/assets/qa-t018.test.ts (+ dev loader.test.ts) | pass | 2026-11-21 |

Gap: no browser e2e; webgl probe covered with fake canvas only. Fresh worktree needs packages/shared built before web type-check/test.

## T-019

| AC | Test | Result | Date |
|---|---|---|---|
| AC-STAGE-003.2 | `apps/web/src/game/stage/street/street.ac.test.ts` | pass | 2026-11-21 |
| AC-STAGE-003.3 | same (pure `isNearDoor`; the E/Enter key and tap-to-enter wiring belongs to T-021) | pass | 2026-11-21 |
| AC-STAGE-003.4 | same | pass | 2026-11-21 |
| AC-STAGE-004.1 | same | pass | 2026-11-21 |
| AC-STAGE-004.2 | same | pass | 2026-11-21 |

Regression: street folder is new and nothing imports it yet; web type-check and the street suites (56 tests) pass. The exact door-radius boundary is asserted in the developer's `door.test.ts` (lines 14-15): a distance of exactly 1.2 m counts as near, the agreed reading of "trong DOOR_PROMPT_RADIUS" (inclusive). `street.ac.test.ts` tests only clearly inside and clearly outside.

## T-020
| AC | test | result | date |
|---|---|---|---|
| AC-STAGE-005.2 | apps/web/src/game/stage/character/ac-stage.qa.test.ts | pass | 2026-11-21 |
| AC-STAGE-006.1 | same (fixture VRM, node env; no WebGL) | pass | 2026-11-21 |
| AC-STAGE-007.1 | same | pass | 2026-11-21 |
| AC-STAGE-007.2 | same (visual smoothness is G6, by eye) | pass | 2026-11-21 |
| AC-STAGE-007.3 | same | pass | 2026-11-21 |

## T-021

| AC | Test | Result | Date |
|---|---|---|---|
| AC-STAGE-001.1 | `apps/web/src/game/stage/stage-game.ac.test.tsx` | pass | 2026-11-21 |
| AC-STAGE-001.4 (scene half: real bytes, no bar at 0 bytes or before manifest) | same | pass | 2026-11-21 |
| AC-STAGE-003.1 (keys, touch halves, both held, blur, before Play) | same | pass | 2026-11-21 |
| AC-STAGE-003.3 (E, Enter, button, repeat, text field, away from door) | same | pass | 2026-11-21 |
| AC-STAGE-003.4 (smoothed camera stays in cam_min..cam_max; reduced motion hard follow) | same, real `createStreetStage` with fake renderer | pass | 2026-11-21 |
| AC-STAGE-004.1 (frames queue quacks on beats 2 and 4, no duplicates or gaps, pause skips gap) | same | pass | 2026-11-21 |
| AC-STAGE-008.1, 008.2 (StageGame level: unmount, abort, hidden tab) | same | pass | 2026-11-21 |
| AC-STAGE-001.2 (no manifest, network error, each of 6 files answering 500, vi note; role=status, grey-box DuelGame, 3D module not loaded) | same | pass | 2026-11-21 |
| AC-STAGE-002.1 (no webgl2: grey-box note, no fetch, 3D module never loaded) | same | pass | 2026-11-21 |

AC-STAGE-008.1 at scene level (release stops the loop, disposes geometry, textures and VRM, calls loseContext) is proven by the developer's `StageGame.test.tsx` line 998 (checked, not duplicated). Gaps: real GLB, VRM, WebGL drawing, GPU dispose and the 3D look cannot run in Jest; the Lead checks them in a browser (G6).
Regression: full web suite 80 suites, 973 tests pass; web type-check clean.

## T-022

| AC | Test | Result | Date |
|---|---|---|---|
| AC-STAGE-005.1 (Sayo, Shadows per REQ-DUEL-012, no second Play, one AudioContext, audio not closed by DuelGame, WebGL lost after Play skips Start) | `apps/web/src/game/stage/stage-club.ac.test.tsx`, `apps/web/src/game/ui/duel-game.stage-props.ac.test.tsx` | pass | 2026-11-22 |
| AC-STAGE-005.3 (win fades, loss does not, next match restores; result shows at once) | `stage-club.ac.test.tsx` | pass | 2026-11-22 |
| AC-STAGE-005.4 (door, lights by wins, from result and summary, same audio) | `stage-club.ac.test.tsx` | pass | 2026-11-22 |
| Done when: note under top bar and before HUD, not floating; touch pads kept on phone landscape with a note | `duel-game.stage-props.ac.test.tsx` | pass | 2026-11-22 |
| Done when: Leave club only in result and summary rows with the backdrop/endAction | both files | pass | 2026-11-22 |
| Done when: street layer inert under rotate hint | `stage-club.ac.test.tsx` | pass | 2026-11-22 |
| Done when: no new props renders as before | `duel-game.stage-props.ac.test.tsx` | pass | 2026-11-22 |

Gaps: real WebGL, camera framing, phone layout and pixel overlap (jsdom has no layout) are checked by the Lead in a browser. Regression: `src/game` 70 suites, 989 tests pass.

## T-023 (test/T-023)

| AC | test | result | date |
|---|---|---|---|
| AC-STAGE-009.1: en, vi, ja have a non-empty string for every game.stage key (16), and the game-duel table test accepts them | `apps/web/src/i18n/game-messages.ac.test.ts` | pass | 2026-11-22 |
| AC-DUEL-016.1 (retargeted): duel keys checked against specs/game-duel/design.md, stage keys against specs/game-stage/design.md "Bảng chữ", no key outside both tables | same file | pass | 2026-11-22 |

Regression: full web suite 86 suites, 1083 tests pass; lint and type-check clean. The dead-string check now covers game-duel keys only; stage keys are checked for presence and table equality, not UI usage.
