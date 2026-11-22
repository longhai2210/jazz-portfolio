/**
 * Tunable constants of the duel's placeholder audio. Playtests change these numbers, never the
 * code that reads them. Every sound is synthesized; the real instrument samples come later.
 *
 * Units: times in seconds, frequencies in Hz, intervals in semitones, levels as gain 0 to 1.
 */
import type { ChannelVolumes, DrumHit, ShadowVoice } from './types';

/** How far ahead of `currentTime` the scheduler starts sounds. */
export const SCHEDULE_LOOKAHEAD_S = 0.1;

/** How often the scheduler checks for sounds to start, in ms. Must stay well under the lookahead. */
export const SCHEDULER_INTERVAL_MS = 25;

/**
 * A scheduled sound found at most this late still plays, at once; a later one is dropped, so a
 * stalled timer never makes the band play out of time.
 */
export const SCHEDULE_LATE_TOLERANCE_S = 0.05;

/** How long the unlock waits for `resume()` before it reports the audio as blocked, in ms. */
export const UNLOCK_TIMEOUT_MS = 2000;

/** Volume of each channel before the player changes it. */
export const DEFAULT_VOLUMES: ChannelVolumes = { music: 0.8, player: 0.9, sfx: 0.8 };

/** Headroom on the sum of the channels, to keep the mix from clipping. */
export const MASTER_GAIN = 0.8;

/** Root of the tune's key: A3. */
export const ROOT_FREQUENCY_HZ = 220;

/** The blues scale, as semitones above the root: 1, b3, 4, b5, 5, b7. */
export const BLUES_SCALE_SEMITONES: readonly number[] = [0, 3, 5, 6, 7, 10];

/**
 * Blues scale degree (index into BLUES_SCALE_SEMITONES) of each button, lowest to highest:
 * D, F, J, K play the root, b3, 4 and 5. Shadows play the same degrees in their own octave.
 */
export const BUTTON_SCALE_DEGREES: readonly number[] = [0, 1, 2, 4];

/** Shape of a pitched placeholder voice. */
export interface ToneVoiceShape {
  readonly wave: OscillatorType;
  /** Octaves above (positive) or below (negative) the button's pitch. */
  readonly octave: number;
  /** Seconds from silence to the peak. */
  readonly attack: number;
  /** Seconds from the peak to silence. */
  readonly decay: number;
  readonly peak: number;
  /** Cutoff of the low-pass filter that shapes the tone. */
  readonly filterHz: number;
  /** Pitch the note starts at, in cents from its target, gliding there during the attack. */
  readonly scoopCents: number;
}

/** The player's notes: a soft vibraphone-like tone, distinct from every Shadow. */
export const PLAYER_VOICE: ToneVoiceShape = {
  wave: 'triangle',
  octave: 1,
  attack: 0.004,
  decay: 0.32,
  peak: 0.55,
  filterHz: 3200,
  scoopCents: 0,
};

/** The voice of each Shadow: Aki plucks a bass, Sayo scats, Ren plays a reedy sax. */
export const SHADOW_VOICES: Readonly<Record<ShadowVoice, ToneVoiceShape>> = {
  aki: {
    wave: 'triangle',
    octave: -1,
    attack: 0.006,
    decay: 0.34,
    peak: 0.8,
    filterHz: 900,
    scoopCents: 0,
  },
  sayo: {
    wave: 'sine',
    octave: 1,
    attack: 0.03,
    decay: 0.26,
    peak: 0.5,
    filterHz: 2400,
    scoopCents: -40,
  },
  ren: {
    wave: 'sawtooth',
    octave: 0,
    attack: 0.02,
    decay: 0.28,
    peak: 0.32,
    filterHz: 1600,
    scoopCents: -25,
  },
};

/** One hit of the drum groove: a grid step of the bar, the drum and its level. */
export interface DrumPatternHit {
  readonly step: number;
  readonly hit: DrumHit;
  readonly level: number;
}

/**
 * A one-bar swing groove on the 8-step grid: ride on every beat with the skip note before beats
 * 2 and 4, hi-hat on 2 and 4, a feathered kick on 1 and 3. The skip notes follow the clock's
 * swing, so they sit where the player's odd steps sit.
 */
export const DRUM_PATTERN: readonly DrumPatternHit[] = [
  { step: 0, hit: 'kick', level: 0.5 },
  { step: 0, hit: 'ride', level: 0.55 },
  { step: 2, hit: 'ride', level: 0.7 },
  { step: 2, hit: 'hat', level: 0.5 },
  { step: 3, hit: 'ride', level: 0.4 },
  { step: 4, hit: 'kick', level: 0.4 },
  { step: 4, hit: 'ride', level: 0.55 },
  { step: 6, hit: 'ride', level: 0.7 },
  { step: 6, hit: 'hat', level: 0.5 },
  { step: 7, hit: 'ride', level: 0.4 },
];

/** Pitch of a calibration or count-in click, and of the accented first click. */
export const CLICK_HZ = 1500;
export const CLICK_ACCENT_HZ = 2000;
