/**
 * Lookahead scheduler on the audio clock. Sounds are queued with their time on
 * `AudioContext.currentTime`; a timer checks the queue every few ms and starts each sound a
 * little ahead of time, at its exact time, so a late or jittery timer never moves a note.
 *
 * It keeps the sources it started until they end, so `clear()` can also stop sounds that are
 * already started but not yet heard, for example when a turn restarts after a pause.
 */
import {
  SCHEDULE_LATE_TOLERANCE_S,
  SCHEDULE_LOOKAHEAD_S,
  SCHEDULER_INTERVAL_MS,
} from './config';
import type { AudioContextLike, Voice } from './types';

/** Starts the sound at `time` (seconds on the audio clock) and returns what it started. */
export type PlaySound = (time: number) => Voice;

/** Calls `tick` every `intervalMs` ms until the returned function is called. */
export interface SchedulerTimer {
  start(tick: () => void, intervalMs: number): () => void;
}

/** The browser's `setInterval`. */
export const intervalTimer: SchedulerTimer = {
  start(tick, intervalMs) {
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  },
};

export interface SchedulerOptions {
  /** Seconds ahead of `currentTime` a sound is started. */
  readonly lookahead?: number;
  readonly intervalMs?: number;
  /** A sound found later than this (seconds) is dropped instead of played late. */
  readonly lateTolerance?: number;
  readonly timer?: SchedulerTimer;
}

export interface AudioScheduler {
  /** Queues a sound at `time`. A sound inside the lookahead starts at once if the scheduler runs. */
  schedule(time: number, play: PlaySound): void;
  /** Starts every queued sound due within the lookahead. The timer calls this. */
  tick(): void;
  /** Starts the timer. */
  start(): void;
  /** Stops the timer; queued and started sounds are kept. */
  stop(): void;
  /** Drops every queued sound and stops every started one that has not ended. */
  clear(): void;
  readonly running: boolean;
  /** Number of queued sounds not started yet. */
  readonly pending: number;
}

interface QueuedSound {
  readonly time: number;
  readonly play: PlaySound;
}

export function createScheduler(
  context: Pick<AudioContextLike, 'currentTime'>,
  options: SchedulerOptions = {},
): AudioScheduler {
  const lookahead = options.lookahead ?? SCHEDULE_LOOKAHEAD_S;
  const intervalMs = options.intervalMs ?? SCHEDULER_INTERVAL_MS;
  const lateTolerance = options.lateTolerance ?? SCHEDULE_LATE_TOLERANCE_S;
  const timer = options.timer ?? intervalTimer;

  /** Sorted by time; sounds with the same time keep the order they were queued in. */
  let queue: QueuedSound[] = [];
  let started: Voice[] = [];
  let stopTimer: (() => void) | null = null;

  function insert(sound: QueuedSound): void {
    let index = queue.length;
    while (index > 0 && queue[index - 1].time > sound.time) index--;
    queue.splice(index, 0, sound);
  }

  function tick(): void {
    const now = context.currentTime;
    started = started.filter((voice) => voice.end > now);
    const horizon = now + lookahead;
    let due = 0;
    while (due < queue.length && queue[due].time < horizon) due++;
    for (const sound of queue.splice(0, due)) {
      if (sound.time < now - lateTolerance) continue;
      started.push(sound.play(Math.max(sound.time, now)));
    }
  }

  return {
    schedule(time, play) {
      if (!Number.isFinite(time)) {
        throw new RangeError(`time must be a finite number, got ${time}`);
      }
      insert({ time, play });
      if (stopTimer) tick();
    },
    tick,
    start() {
      if (stopTimer) return;
      stopTimer = timer.start(tick, intervalMs);
      tick();
    },
    stop() {
      stopTimer?.();
      stopTimer = null;
    },
    clear() {
      queue = [];
      for (const voice of started) {
        for (const source of voice.sources) {
          try {
            source.stop();
          } catch {
            // Already stopped by the browser: nothing left to silence.
          }
        }
      }
      started = [];
    },
    get running() {
      return stopTimer !== null;
    },
    get pending() {
      return queue.length;
    },
  };
}
