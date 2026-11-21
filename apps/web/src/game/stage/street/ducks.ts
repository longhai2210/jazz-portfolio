/**
 * The ducks of Hồ Làng: they quack on beats 2 and 4 of every bar of the street music, and bob at
 * the moment of each quack. Both read the one beat clock of `game/core/clock.ts`, set on the
 * audio clock (`AudioContext.currentTime`), so what is heard and what is seen cannot drift.
 * Pure TypeScript: no React, three.js or browser APIs.
 */
import type { AudioScheduler, PlaySound } from '../../audio/scheduler';
import { beatToTime, createBeatClock, timeToBeat, type BeatClock } from '../../core/clock';
import { BEATS_PER_BAR } from '../../core/config';
import { DUCK_BOB_S, DUCK_QUACK_BEATS, STREET_BPM } from './config';
import { assertFinite } from './range';

/**
 * Slack (seconds) when matching a time to a quack, so a caller that computes the quack time its
 * own way, with different floating-point rounding, still lands on the quack. Far below one
 * audio sample (about 21 µs at 48 kHz).
 */
const TIME_EPSILON_S = 1e-9;

/**
 * The beat clock of the street music: STREET_BPM, with beat 0 (the start of bar 0) at audio
 * time `t0`, when the street music starts. The street groove is straight; the clock's
 * difficulty only sets the swing of odd grid steps, which the ducks never use.
 */
export function createStreetClock(t0: number): BeatClock {
  return createBeatClock({ t0, bpm: STREET_BPM, difficulty: 'session' });
}

/** Audio-clock time of beat `beat` (counted from 1, as in DUCK_QUACK_BEATS) of bar `bar`. */
export function quackTime(clock: BeatClock, bar: number, beat: number): number {
  return beatToTime(clock, bar * BEATS_PER_BAR + (beat - 1));
}

/**
 * Audio-clock times of every quack in the half-open window `[from, to)`, earliest first. The
 * music starts at the clock's `t0`, so there is no quack before it. Adjacent windows
 * (`[a, b)` then `[b, c)`) never return the same quack twice and never skip one, so a caller can
 * schedule a few frames ahead each frame and move its cursor to `to`.
 */
export function quackTimesBetween(clock: BeatClock, from: number, to: number): number[] {
  assertFinite('from', from);
  assertFinite('to', to);
  if (to <= from) return [];

  // One bar of margin on both sides absorbs rounding in timeToBeat; the filter below decides.
  const firstBar = Math.max(0, Math.floor(timeToBeat(clock, from) / BEATS_PER_BAR) - 1);
  const lastBar = Math.floor(timeToBeat(clock, to) / BEATS_PER_BAR) + 1;
  const times: number[] = [];
  for (let bar = firstBar; bar <= lastBar; bar++) {
    for (const beat of DUCK_QUACK_BEATS) {
      const time = quackTime(clock, bar, beat);
      if (time >= from && time < to) times.push(time);
    }
  }
  return times.sort((a, b) => a - b);
}

/**
 * Queues every quack in `[from, to)` on the game's audio scheduler, each played by `play` at
 * its exact time on the audio clock. Returns the queued times.
 */
export function scheduleDuckQuacks(
  scheduler: Pick<AudioScheduler, 'schedule'>,
  clock: BeatClock,
  from: number,
  to: number,
  play: PlaySound,
): number[] {
  const times = quackTimesBetween(clock, from, to);
  for (const time of times) scheduler.schedule(time, play);
  return times;
}

/** The latest quack at or before `time`, or null before the first one. */
function lastQuackAtOrBefore(clock: BeatClock, time: number): number | null {
  const bar = Math.floor(timeToBeat(clock, time) / BEATS_PER_BAR);
  let last: number | null = null;
  for (let candidateBar = Math.max(0, bar - 1); candidateBar <= bar + 1; candidateBar++) {
    for (const beat of DUCK_QUACK_BEATS) {
      const quack = quackTime(clock, candidateBar, beat);
      if (quack <= time + TIME_EPSILON_S && (last === null || quack > last)) last = quack;
    }
  }
  return last;
}

/**
 * How far the ducks dip at audio time `time`, from 0 (at rest) to 1 (deepest). Each quack
 * starts a bob that is deepest exactly at the quack's time and eases back to rest over
 * DUCK_BOB_S, well before the next quack. The scene multiplies this by DUCK_BOB_DEPTH.
 */
export function duckBob(clock: BeatClock, time: number): number {
  assertFinite('time', time);
  const last = lastQuackAtOrBefore(clock, time);
  if (last === null) return 0;
  const since = Math.max(0, time - last);
  if (since >= DUCK_BOB_S) return 0;
  const rest = 1 - since / DUCK_BOB_S;
  return rest * rest;
}
