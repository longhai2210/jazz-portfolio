/**
 * Pitch of each button: the 4 buttons play 4 ascending notes of the blues scale, so no note is
 * ever wrong in pitch, only in time.
 */
import type { Button } from '../core/types';
import { BLUES_SCALE_SEMITONES, BUTTON_SCALE_DEGREES, ROOT_FREQUENCY_HZ } from './config';

/** Semitones above the root that button `button` plays. */
export function buttonSemitones(button: Button): number {
  return BLUES_SCALE_SEMITONES[BUTTON_SCALE_DEGREES[button]];
}

/** Frequency of a note `semitones` above the root (equal temperament). */
export function semitonesToHz(semitones: number): number {
  return ROOT_FREQUENCY_HZ * 2 ** (semitones / 12);
}

/** Frequency of button `button`, shifted by `octave` octaves. */
export function buttonFrequency(button: Button, octave = 0): number {
  return semitonesToHz(buttonSemitones(button) + 12 * octave);
}
