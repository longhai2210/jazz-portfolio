/**
 * Licks of the grey-box duel ("Lick cài sẵn" in the game-duel spec), treated as already learned.
 * Steps are absolute positions on the 8-step grid of one bar; any button counts.
 *
 * The order is the learned order: when two licks match one bar equally well, the earlier one wins.
 */
import type { Lick } from '../types';

/** Lick ids, stable: the lick book and the UI messages key off them. */
export const LICK_IDS = {
  duck: 'duck',
  frog: 'frog',
  windChime: 'windChime',
} as const;

export type LickId = (typeof LICK_IDS)[keyof typeof LICK_IDS];

/** The grey-box licks in learned order: Vịt, Ếch, Chuông gió. */
export const LICKS: readonly Lick[] = [
  /** Vịt: `. . x x . . x .` */
  { id: LICK_IDS.duck, steps: [2, 3, 6] },
  /** Ếch: `x . . x . x . .` */
  { id: LICK_IDS.frog, steps: [0, 3, 5] },
  /** Chuông gió: `. x . . x . x x` */
  { id: LICK_IDS.windChime, steps: [1, 4, 6, 7] },
];
