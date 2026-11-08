/**
 * Placeholder synthesized sounds: pitched voices, drums, lick sounds and clicks. Each function
 * builds a short node graph into `destination`, starts it at `time` on the audio clock and
 * returns the sources it started, so a scheduler can stop them early.
 */
import { CLICK_ACCENT_HZ, CLICK_HZ, type ToneVoiceShape } from './config';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  DrumHit,
  LickSound,
  ScheduledSourceLike,
  Voice,
} from './types';

/** Gain used instead of 0 where an exponential ramp starts or ends (it cannot reach 0). */
const SILENT = 0.0001;

/** Sources stop a little after their envelope ends, so the tail is never cut. */
const STOP_PAD_S = 0.02;

/** Length of the shared white-noise buffer the drums play from. */
const NOISE_SECONDS = 1;

/** Shapes `param` as a gain envelope: silent, up to `peak` in `attack` s, back down in `decay` s. */
function envelope(
  param: AudioParamLike,
  time: number,
  attack: number,
  decay: number,
  peak: number,
): number {
  param.setValueAtTime(SILENT, time);
  param.linearRampToValueAtTime(Math.max(peak, SILENT), time + attack);
  param.exponentialRampToValueAtTime(SILENT, time + attack + decay);
  return time + attack + decay;
}

function voice(sources: readonly ScheduledSourceLike[], end: number): Voice {
  return { sources, end };
}

/** Plays a pitched note of voice `shape` at `frequency` Hz. `level` scales the voice's peak. */
export function playTone(
  context: AudioContextLike,
  destination: AudioNodeLike,
  shape: ToneVoiceShape,
  frequency: number,
  time: number,
  level = 1,
): Voice {
  const osc = context.createOscillator();
  osc.type = shape.wave;
  osc.frequency.setValueAtTime(frequency, time);
  if (shape.scoopCents !== 0) {
    osc.detune.setValueAtTime(shape.scoopCents, time);
    osc.detune.linearRampToValueAtTime(0, time + shape.attack);
  }
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(shape.filterHz, time);
  const amp = context.createGain();
  const end = envelope(amp.gain, time, shape.attack, shape.decay, shape.peak * level) + STOP_PAD_S;

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(destination);
  osc.start(time);
  osc.stop(end);
  return voice([osc], end);
}

const noiseBuffers = new WeakMap<AudioContextLike, AudioBufferLike>();

/** One second of white noise, made once per context. */
function noiseBuffer(context: AudioContextLike): AudioBufferLike {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;
  const length = Math.ceil(context.sampleRate * NOISE_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(context, buffer);
  return buffer;
}

interface NoiseShape {
  readonly filter: BiquadFilterType;
  readonly hz: number;
  readonly q: number;
  readonly decay: number;
  readonly peak: number;
}

/** Brushed snare, ride cymbal and hi-hat foot "chick": filtered noise of different colours. */
const NOISE_DRUMS: Readonly<Record<Exclude<DrumHit, 'kick'>, NoiseShape>> = {
  snare: { filter: 'bandpass', hz: 1800, q: 0.7, decay: 0.16, peak: 0.5 },
  ride: { filter: 'highpass', hz: 6500, q: 0.7, decay: 0.32, peak: 0.25 },
  hat: { filter: 'highpass', hz: 8000, q: 0.9, decay: 0.05, peak: 0.3 },
};

function playNoise(
  context: AudioContextLike,
  destination: AudioNodeLike,
  shape: NoiseShape,
  time: number,
  level: number,
): Voice {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = shape.filter;
  filter.frequency.setValueAtTime(shape.hz, time);
  filter.Q.setValueAtTime(shape.q, time);
  const amp = context.createGain();
  const end = envelope(amp.gain, time, 0.001, shape.decay, shape.peak * level) + STOP_PAD_S;

  source.connect(filter);
  filter.connect(amp);
  amp.connect(destination);
  source.start(time);
  source.stop(end);
  return voice([source], end);
}

/** A soft kick: a sine dropping from 130 Hz to 45 Hz. */
function playKick(
  context: AudioContextLike,
  destination: AudioNodeLike,
  time: number,
  level: number,
): Voice {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(130, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
  const amp = context.createGain();
  const end = envelope(amp.gain, time, 0.002, 0.3, 0.9 * level) + STOP_PAD_S;

  osc.connect(amp);
  amp.connect(destination);
  osc.start(time);
  osc.stop(end);
  return voice([osc], end);
}

/** Plays drum `hit` at `time`; `level` (0 to 1) is how hard it is struck. */
export function playDrum(
  context: AudioContextLike,
  destination: AudioNodeLike,
  hit: DrumHit,
  time: number,
  level = 1,
): Voice {
  if (hit === 'kick') return playKick(context, destination, time, level);
  return playNoise(context, destination, NOISE_DRUMS[hit], time, level);
}

/** A nasal quack: a sawtooth falling in pitch through a narrow band-pass. */
function quack(
  context: AudioContextLike,
  destination: AudioNodeLike,
  time: number,
): { source: ScheduledSourceLike; end: number } {
  const osc = context.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(520, time);
  osc.frequency.exponentialRampToValueAtTime(340, time + 0.11);
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1100, time);
  filter.Q.setValueAtTime(3, time);
  const amp = context.createGain();
  const end = envelope(amp.gain, time, 0.005, 0.11, 0.5) + STOP_PAD_S;

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(destination);
  osc.start(time);
  osc.stop(end);
  return { source: osc, end };
}

/** Vịt: quack-quack. */
function playDuck(context: AudioContextLike, destination: AudioNodeLike, time: number): Voice {
  const first = quack(context, destination, time);
  const second = quack(context, destination, time + 0.13);
  return voice([first.source, second.source], Math.max(first.end, second.end));
}

/** Ếch: a low, rising "ribbit" of three pulses. */
function playFrog(context: AudioContextLike, destination: AudioNodeLike, time: number): Voice {
  const pulses = 3;
  const spacing = 0.09;
  const osc = context.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(95, time);
  osc.frequency.linearRampToValueAtTime(130, time + pulses * spacing);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, time);
  const amp = context.createGain();
  let end = time;
  for (let i = 0; i < pulses; i++) {
    end = envelope(amp.gain, time + i * spacing, 0.01, 0.06, 0.45);
  }
  end += STOP_PAD_S;

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(destination);
  osc.start(time);
  osc.stop(end);
  return voice([osc], end);
}

/** Bells of the wind chime, in Hz: A6, C7, D7 and E7, from the tune's blues scale. */
const CHIME_HZ: readonly number[] = [1760, 2093, 2349.3, 2637];

/** Chuông gió: four bells struck one after another, ringing out. */
function playWindChime(
  context: AudioContextLike,
  destination: AudioNodeLike,
  time: number,
): Voice {
  const sources: ScheduledSourceLike[] = [];
  let end = time;
  CHIME_HZ.forEach((hz, i) => {
    const start = time + i * 0.07;
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, start);
    const amp = context.createGain();
    const stop = envelope(amp.gain, start, 0.002, 1.2, 0.18) + STOP_PAD_S;
    osc.connect(amp);
    amp.connect(destination);
    osc.start(start);
    osc.stop(stop);
    sources.push(osc);
    end = Math.max(end, stop);
  });
  return voice(sources, end);
}

/** Plays the signature sound of a lick at `time`. */
export function playLickSound(
  context: AudioContextLike,
  destination: AudioNodeLike,
  sound: LickSound,
  time: number,
): Voice {
  switch (sound) {
    case 'duck':
      return playDuck(context, destination, time);
    case 'frog':
      return playFrog(context, destination, time);
    case 'windChime':
      return playWindChime(context, destination, time);
  }
}

/** A short stick click for calibration and count-ins; `accent` marks the first beat. */
export function playClick(
  context: AudioContextLike,
  destination: AudioNodeLike,
  time: number,
  accent = false,
): Voice {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(accent ? CLICK_ACCENT_HZ : CLICK_HZ, time);
  const amp = context.createGain();
  const end = envelope(amp.gain, time, 0.001, 0.05, accent ? 0.8 : 0.6) + STOP_PAD_S;

  osc.connect(amp);
  amp.connect(destination);
  osc.start(time);
  osc.stop(end);
  return voice([osc], end);
}
