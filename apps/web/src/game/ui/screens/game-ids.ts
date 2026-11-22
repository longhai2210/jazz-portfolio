/**
 * Ids shared by the duel core and the audio layer, mapped once. The audio layer names its own
 * sounds (`ShadowVoice`, `LickSound`); the core names characters (`core/roster.ts`) and licks
 * (`core/data/licks.ts`). Today the strings match, but each side may rename on its own, so every
 * id goes through these tables and the type checker catches a drift.
 */
import type { LickSound, ShadowVoice } from '../../audio';
import { LICKS, type LickId } from '../../core/data/licks';
import type { Character } from '../../core/roster';
import type { Lick } from '../../core/types';

/** Display names; the names of the band are never translated. */
export const CHARACTER_NAMES: Readonly<Record<Character, string>> = {
  aki: 'Aki',
  sayo: 'Sayo',
  ren: 'Ren',
};

/** The voice a Shadow plays its call with. */
export const SHADOW_VOICES: Readonly<Record<Character, ShadowVoice>> = {
  aki: 'aki',
  sayo: 'sayo',
  ren: 'ren',
};

/** The signature sound of each grey-box lick. */
export const LICK_SOUNDS: Readonly<Record<LickId, LickSound>> = {
  duck: 'duck',
  frog: 'frog',
  windChime: 'windChime',
};

/** Whether `id` is one of the grey-box lick ids. */
export function isLickId(id: string): id is LickId {
  return Object.prototype.hasOwnProperty.call(LICK_SOUNDS, id);
}

/** The id of a lick when it is one of the grey-box licks; null for any other lick. */
export function lickIdOf(lick: Pick<Lick, 'id'>): LickId | null {
  return isLickId(lick.id) ? lick.id : null;
}

/** Grey-box lick ids in learned order, the order the lick book and the summary use. */
export const LICK_ORDER: readonly LickId[] = LICKS.map(lickIdOf).filter(
  (id): id is LickId => id !== null,
);
