/**
 * Types of the duel's audio layer.
 *
 * The `*Like` interfaces list only the parts of the Web Audio API this layer uses. A real
 * `AudioContext` satisfies them structurally, and so does the test fake in `testing/`, so no
 * code here depends on the full DOM type and tests need no casts.
 *
 * Units: points in time are seconds on the audio clock (`AudioContext.currentTime`).
 */

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
  exponentialRampToValueAtTime(value: number, endTime: number): unknown;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

/** A node that is started and stopped on the audio clock (oscillator, buffer source). */
export interface ScheduledSourceLike extends AudioNodeLike {
  start(when?: number): void;
  stop(when?: number): void;
}

export interface OscillatorNodeLike extends ScheduledSourceLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  readonly detune: AudioParamLike;
}

export interface AudioBufferLike {
  readonly length: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface AudioBufferSourceNodeLike extends ScheduledSourceLike {
  buffer: AudioBufferLike | null;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: AudioContextState;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

/** `AudioContext`, or Safari's prefixed `webkitAudioContext`. */
export type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContextLike;

/** Where the audio context constructor is looked up: `globalThis` in the browser. */
export interface AudioGlobalScope {
  readonly AudioContext?: AudioContextConstructor;
  readonly webkitAudioContext?: AudioContextConstructor;
}

/** The three volume channels: background music, the player's notes, and effects. */
export type AudioChannel = 'music' | 'player' | 'sfx';

/** Per-channel volume, 0 (silent) to 1 (full). */
export type ChannelVolumes = Readonly<Record<AudioChannel, number>>;

/** The voice of each Shadow, by the musician it belongs to. */
export type ShadowVoice = 'aki' | 'sayo' | 'ren';

/** The signature sound of each built-in lick: Vịt (duck), Ếch (frog), Chuông gió (wind chime). */
export type LickSound = 'duck' | 'frog' | 'windChime';

/** One drum of the placeholder kit. */
export type DrumHit = 'kick' | 'snare' | 'ride' | 'hat';

/** The sources one sound started, and the audio-clock time it falls silent. */
export interface Voice {
  readonly sources: readonly ScheduledSourceLike[];
  readonly end: number;
}
