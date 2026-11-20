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

## T-004 - 2026-11-08

Test file: `apps/web/src/game/core/ac-lick-call.test.ts` (tester); dev's lick/call/best-bar/roster/data tests also pass (143 tests in `src/game/core`). Lint and type-check of web clean.
Lead rulings applied: AC-DUEL-008.1 averages Timing over all bar taps with a Miss as 0 and counts taps for the minimum of 3; every Shadow has the shadow palette flag.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-004.3 | ac-lick-call.test.ts (every character x level x turn: 4 bars, density, Lounge even steps only; callProblems negatives) | pass | 2026-11-08 |
| AC-DUEL-006.1 | ac-lick-call.test.ts (3-6 steps, odd step, unique; lickProblems rejects bad sets) | pass | 2026-11-08 |
| AC-DUEL-006.2 | ac-lick-call.test.ts (Duck + extra at 0, 90 ms Great boundary, other-bar taps ignored) | pass | 2026-11-08 |
| AC-DUEL-006.3 | ac-lick-call.test.ts (two extra taps) | pass | 2026-11-08 |
| AC-DUEL-006.4 | ac-lick-call.test.ts (OK at 120 ms and 91 ms) | pass | 2026-11-08 |
| AC-DUEL-006.5 | ac-lick-call.test.ts (more steps, fewer extras, learned order) | pass | 2026-11-08 |
| AC-DUEL-006.6 | ac-lick-call.test.ts (Duck x2 + Frog = 10; three licks = 10) | pass | 2026-11-08 |
| AC-DUEL-007.1-007.3 | ac-lick-call.test.ts (duel 1 composed; duel 2 phrase and inversion D,J,K -> K,F,D; no best bar composed) | pass | 2026-11-08 |
| AC-DUEL-008.1 | ac-lick-call.test.ts (Miss counts 0, 3-tap minimum, tie to earlier bar) | pass | 2026-11-08 |
| AC-DUEL-008.2 | ac-lick-call.test.ts (30 ms early/late snapped to step; offset applied) | pass | 2026-11-08 |
| AC-DUEL-008.3 | ac-lick-call.test.ts | pass | 2026-11-08 |
| AC-DUEL-012.1-012.3 | ac-lick-call.test.ts (all three choices, shadow flag on all clubs, unknown character throws) | pass | 2026-11-08 |

Gap: pure core, no UI; the equal-steps/fewer-extra-taps tie-break is tested through `pickQuote` with synthetic matches because no real tap set gives two equal-length licks different extra counts.

## T-007 - 2026-11-08

Test file: `apps/web/src/game/audio/ac-audio.test.ts` (tester, own fake of Web Audio); dev's tests in the same folder also pass. Web suite: 16 suites, 132 tests pass; lint and type-check clean.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-013.1 | ac-audio.test.ts (context created and `resume()` called before the first await, state running; reuse suspended; replace closed; webkit prefix; stuck, hanging and rejecting resume give a result, no throw) | pass | 2026-11-08 |
| AC-DUEL-013.2 | ac-audio.test.ts (no Web Audio and throwing constructor give `unsupported`, no throw) | pass | 2026-11-08 |
| AC-DUEL-013.5 | ac-audio.test.ts (each button starts at `currentTime`, 4 rising pitches, follows clock, rapid-fire; suspend and close reach the context) | pass | 2026-11-08 |

Gaps: the "message and back button" half of 013.2 is UI (T-010); the audio layer only returns `unsupported`. Real browser gesture policy and audible output are not testable in Jest (fake context). Needs `packages/shared` built before type-check. Graph has no entry for the new files, so regression was the whole web suite.

## T-008

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-015.7 | ContentSettingsForm.qa.test.tsx (off to on sends true; saved true off sends false; untouched keeps value; independent of Blog off) | pass | 2026-11-08 |
| AC-DUEL-015.7 | ContentSettingsForm.qa.test.tsx (design states: 404 warning when off, neutral note when on, loading, load error, saving) | pass | 2026-11-08 |

Verify: web build of deps, lint, type-check, jest (17 suites, 123 tests) green. Gaps: component test only, no browser e2e; the real PUT round trip is covered by other tasks (AC-DUEL-015.1 to 015.3).

## T-009 (spec 0.4) - 2026-11-08

Test file: `apps/web/src/game/ui/ac-t009.test.tsx` (tester, 42 tests, own next-intl mock); dev's own lanes/input/lick-book tests also pass. Whole web suite: 35 suites, 354 tests green; lint and type-check clean (after building packages/shared).

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-007.4 | ac-t009.test.tsx (label only over player-built bars, none when composed, separate runs, none on player turn, empty call) | pass | 2026-11-08 |
| AC-DUEL-011.2 / spec 0.4 | same file (Late Set: no note markers or beat lines in either turn; Session hides player targets; taps still drawn) | pass | 2026-11-08 |
| AC-DUEL-013.3 | same file (DFJK, repeat ignored, re-press, Ctrl+F, input field, disabled, unmount) | pass | 2026-11-08 |
| AC-DUEL-013.4 | same file (4 pads in order, pointer-down not click, right button, disabled, pressed state) | pass | 2026-11-08 |
| AC-DUEL-013.8 | same file (3 licks x 8 dots, filled steps, off-beat marks, lit/unlit) | pass | 2026-11-08 |
| AC-DUEL-013.10 | same file (no motion classes either setting, transition none under reduce, text-only feedback, live region quotes/misses only) | pass | 2026-11-08 |
| AC-DUEL-013.11 | same file (4 distinct shapes and colors, K top to D bottom, markers and pads share shapes) | pass | 2026-11-08 |

Gaps: jsdom cannot check real colors, layout or touch hardware; no e2e tool. Real vi/ja strings are not tested (messages arrive in T-012; the mock returns keys).

## T-006 (spec 0.4) - 2026-11-08

Test file: `apps/web/src/game/core/ac-session.test.ts` (tester, 33 tests); dev's session/campaign tests also pass. Web scoped verify green: 30 suites, 337 tests. Lead rulings applied: 25 bars, no rest bars; in Echo/Answer a tap on an opponent bar may pair with the first or last note inside its OK window, and an unpaired tap on an opponent bar is never an extra tap.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-002.3 | ac-session.test.ts (same offset in both duels, restart, offset removed from taps, NaN rejected) | pass | 2026-11-08 |
| AC-DUEL-003.7 | ac-session.test.ts (opponent taps uncounted, no score change, edge pairing first/last note, stray not extra, Solo taps outside bars 21-24 dropped) | pass | 2026-11-08 |
| AC-DUEL-004.1 | ac-session.test.ts (turnLayout/barRole 25 bars, event order echo/answer/solo/end) | pass | 2026-11-08 |
| AC-DUEL-004.2 | ac-session.test.ts (composed calls for 3 characters x 3 levels, countIn calls) | pass | 2026-11-08 |
| AC-DUEL-006.7 | ac-session.test.ts (lickSound at first beat of next bar; none without quote) | pass | 2026-11-08 |
| AC-DUEL-006.8 | ac-session.test.ts (Duck shape in Echo/Answer: no sound, no quote) | pass | 2026-11-08 |
| AC-DUEL-012.4 | ac-session.test.ts (default Ren: Aki 84, Sayo 96; other characters) | pass | 2026-11-08 |
| AC-DUEL-014.2 | ac-session.test.ts (taps dropped, count-in, replay, Answer-turn pause keeps Echo) | pass | 2026-11-08 |

Note: a Solo tap up to ~160 ms before bar 21 step 0 snaps to that step and is judged (Miss), not dropped; only taps that snap outside bars 21-24 are dropped. Consistent with spec 0.4 wording. Gap: pure core, no e2e.

## T-010

Test file: `apps/web/src/game/ui/ac-t010.test.tsx` (tester, 21 tests, jsdom; next-intl and next/link mocked with the dev's `screens/testing` helpers, fake `AudioContext` installed as `window.AudioContext`, fake timers). Every test unmounts and the harness asserts every created context was closed and no `setInterval` (the audio scheduler tick) stays live. Dev's `DuelGame.test.tsx` also passes. `src/game`: 36 suites, 463 tests green.

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-011.1 | ac-t010 (3 radios, Lounge preselected, each choosable, Continue uses the choice; passed difficulty skips the screen) | pass | 2026-11-08 |
| AC-DUEL-011.3 | ac-t010 (no offer after 1 loss, offer on the 2nd, decline keeps windows, no re-offer on a 3rd) | pass | 2026-11-08 |
| AC-DUEL-011.4 | ac-t010 (accept: note on later results, carried into match 2, cleared by Play again from the start) | pass | 2026-11-08 |
| AC-DUEL-013.2 | ac-t010 (no Web Audio and a throwing constructor: alert with way home, no context) | pass | 2026-11-08 |
| AC-DUEL-013.6 | ac-t010 (stars, Rhythm/Direction/Feel, empty quotes, Replay restarts same match, match 2 too) | pass | 2026-11-08 |
| AC-DUEL-013.7 | ac-t010 (loss in match 1 and 2: Replay only; summary with Play again; assist carried into match 2) | pass | 2026-11-08 |
| AC-DUEL-013.9 | ac-t010 (vi locale: start, difficulty, calibration, calibration fail, duel, result all link to /vi) | pass | 2026-11-08 |
| AC-DUEL-014.1 | ac-t010 (hidden tab once, keys ignored while paused, visible does not resume, Esc in count-in, pause button, Resume count-in) | pass | 2026-11-08 |
| AC-DUEL-014.3 | ac-t010 (pause overlay link closes once and goes to /vi; unmount while paused closes once) | pass | 2026-11-08 |
| AC-DUEL-017.1 | ac-t010 (offset 0 and Late Set not treated as missing; offset kept in match 2; character mapping) | pass | 2026-11-08 |
| AC-DUEL-017.2 | ac-t010 (startDuel 2 with best bar: bar 1 as played, bar 2 mirrored K F D; without: all composed) | pass | 2026-11-08 |
| AC-DUEL-017.3 | ac-t010 (win report with best bar; match 2 loss reported once, not again on re-render) | pass | 2026-11-08 |

Gaps: no browser e2e, so real autoplay policy and real Web Audio timing are unproven. `jest.getTimerCount()` is unusable here (React leaves one pending timer after an async act, even on the unsupported screen), so leak checks track `setInterval` and `close()`. Full `apps/web` run: 4 suites fail only with "Cannot find module '@jazz-portfolio/shared'" (shared not built in this worktree; admin/settings and portfolio-data tests, unrelated).

## T-011

| AC | Test | Result | Date |
|---|---|---|---|
| AC-DUEL-015.5 | `apps/web/src/app/[locale]/game/game-switch.qa.test.tsx` (page and layout call notFound when off or flag missing; render when on) | pass | 2026-11-20 |
| AC-DUEL-015.6 | same file (metadata robots index:false, follow:false); `apps/web/src/app/sitemap.qa.test.ts` (no /game URL or alternate, flag on and off) | pass | 2026-11-20 |

Notes: next-intl, next/navigation notFound and getPublicSettings are mocked. Gap: no browser e2e, so the real HTTP 404 status is not tested. Under full-suite load, `DuelGame.test.tsx` and `ac-t010.test.tsx` time out (4 tests); they pass in isolation and are outside T-011. `packages/shared` must be built before the web suite.

## T-014

Test file: `apps/web/src/game/ui/ac-t014.test.tsx` (tester, 5 tests, jsdom, same harness as ac-t010; `resume()` on the fake context is held on a deferred promise so the tab can be hidden while Resume waits on the audio). Dev's `duel-controller.test.ts` also passes. `src/game`: 38 suites, 473 tests; green apart from one load timeout (below).

| AC | test | result | date |
|---|---|---|---|
| AC-DUEL-014.1 | ac-t014 (hidden while Resume waits: dialog stays, no count-in, context suspended, suspend called again) | pass | 2026-11-20 |
| AC-DUEL-014.1 | ac-t014 (hidden then visible before audio wakes: still paused and suspended) | pass | 2026-11-20 |
| AC-DUEL-014.1 | ac-t014 (Resume while tab already hidden: stays paused, suspended) | pass | 2026-11-20 |
| AC-DUEL-014.1 | ac-t014 (visible throughout: held Resume completes into a count-in) | pass | 2026-11-20 |
| AC-DUEL-014.1 | ac-t014 (after an interrupted resume, a second Resume works) | pass | 2026-11-20 |

Regression: ac-t010, ac-t014 and duel-controller suites pass together (31 tests). Flaky, not counted against T-014: in the full `src/game` run, ac-t010 "AC-DUEL-017.1 passed offset" timed out at 5 s under parallel load (same family as the known AC-DUEL-013.7 timeouts); it passes when rerun. Gap: no browser e2e, so real tab-visibility and autoplay behaviour are unproven.

## T-013

Tests: `apps/web/src/game/ui/ac-t013.test.tsx` (written from the AC; the dev's `DuelGame.start.test.tsx` also passes). Date: 2026-11-20.

| AC | Test | Result |
|---|---|---|
| AC-DUEL-013.12 | blocked unlock shows the blocked message, Try again, and an enabled Play | pass |
| AC-DUEL-013.12 | the unlock (`resume`) runs synchronously inside the click, on Play and on Try again | pass |
| AC-DUEL-013.12 | Try again after the browser allows sound starts the match, alert gone | pass |
| AC-DUEL-013.12 | rejected resume: message shown, no unhandled rejection, Play pressable again | pass |
| AC-DUEL-013.12 | start that throws: error shown, Play and Try again enabled, store back to `start`, next press starts | pass |
| AC-DUEL-013.12 | three failing presses in a row: never stuck, no repeating timer left, no unhandled rejection | pass |
| AC-DUEL-013.12 | successful start shows no alert | pass |
| AC-DUEL-013.12 | blocked and error messages in vi | pass |

Notes:
- ja is not covered: the fake `next-intl` in `screens/testing/intl.ts` only has en and vi. The real `i18n/messages/*.json` hold no `game` namespace on this branch, so the shipped ja strings could not be checked here.
- Regression: `pnpm exec jest src/game` (38 suites). `DuelGame.test.tsx` and `ac-t010.test.tsx` time out under load (AC-DUEL-013.7, AC-DUEL-017.3, AC-DUEL-017.1; AC-DUEL-013.6 once as a knock-on). `DuelGame.test.tsx` passes 24/24 with `--testTimeout=60000`. Known flaky, outside T-013.
- Web lint and type-check pass. No browser e2e tool: real autoplay-policy behaviour is not covered.
