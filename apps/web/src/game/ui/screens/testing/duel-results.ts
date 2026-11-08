/**
 * Real duel results for tests, played through the session core instead of written by hand.
 *
 * - No plan: no taps at all, a loss with 0 stars.
 * - `win`: every Echo target copied and every Answer target inverted, on time: Rhythm 1 and
 *   Direction 1 on both turns, a win with at least 2 stars even with an empty Solo.
 * - `soloBars`: notes played on time in the player's Solo bars, bar `i` being Solo bar `i + 1`.
 *   `[{0, D}, {2, J}, {5, K}]` in bar 1 makes that bar the best bar; steps 2, 3, 6 quote Duck.
 *
 * Test-only: production code never imports this file.
 */
import { invertButton } from '../../../core/call';
import { stepTime } from '../../../core/clock';
import {
  stepSession,
  turnLayout,
  turnTargets,
  type DuelResult,
  type SessionState,
} from '../../../core/session';
import type { BarNote, Tap } from '../../../core/types';

export interface TakePlan {
  readonly win?: boolean;
  readonly soloBars?: readonly (readonly BarNote[])[];
}

/** Solo bar 1 of a 3-star take: steps 0, 2 and 5 on D, J and K (AC-DUEL-007.2). */
export const BEST_BAR: readonly BarNote[] = [
  { step: 0, button: 0 },
  { step: 2, button: 2 },
  { step: 5, button: 3 },
];

/** The steps of Duck (2, 3, 6) on F, J and K. */
export const DUCK_BAR: readonly BarNote[] = [
  { step: 2, button: 1 },
  { step: 3, button: 2 },
  { step: 6, button: 3 },
];

/**
 * The taps of `plan`, as raw audio-clock times (the calibration offset added back), in time order.
 * The session must have started: its clock times the notes.
 */
export function planTaps(session: SessionState, plan: TakePlan): Tap[] {
  const { clock, config } = session;
  if (clock === null) throw new Error('start the session before planning its taps');
  const at = (bar: number, step: number) => stepTime(clock, bar, step) + config.offsetMs / 1000;
  const taps: Tap[] = [];
  if (plan.win) {
    for (const turn of ['echo', 'answer'] as const) {
      for (const note of turnTargets(session, turn)) {
        const button = turn === 'echo' ? note.button : invertButton(note.button);
        taps.push({ time: at(note.bar, note.step), button });
      }
    }
  }
  const { playerBars } = turnLayout('solo');
  plan.soloBars?.forEach((notes, index) => {
    for (const note of notes) taps.push({ time: at(playerBars[index], note.step), button: note.button });
  });
  return taps.sort((a, b) => a.time - b.time);
}

/** Plays a ready session to its end with the taps of `plan` and returns its result. */
export function playTake(session: SessionState, plan: TakePlan = {}): DuelResult {
  let state = stepSession(session, { type: 'start', time: 0 }).state;
  for (const tap of planTaps(state, plan)) state = stepSession(state, { type: 'tap', tap }).state;
  state = stepSession(state, { type: 'advance', time: 10_000 }).state;
  if (state.result === null) throw new Error('the take did not finish');
  return state.result;
}
