/**
 * Puts a tap on the audio clock, the one clock the judge reads (REQ-DUEL-001).
 *
 * The time is `currentTime` of the game audio when the handler runs, moved back by how long the
 * event waited before the handler ran (`event.timeStamp` and `performance.now()` share one time
 * origin), so a busy frame does not make a tap late. The calibration offset is not applied here:
 * the judge subtracts it (AC-DUEL-001.4).
 */
import type { GameAudio } from '../../audio';
import type { Button, Tap } from '../../core/types';

/** The part of the game audio the input and the lane board read: its clock, in seconds. */
export type AudioClock = Pick<GameAudio, 'currentTime'>;

/**
 * Longest wait (seconds) between an event and its handler that is trusted. A longer or negative
 * wait means the two timestamps do not share an origin, so the handler's time is used as is.
 */
export const MAX_INPUT_DELAY_S = 0.25;

/** Audio-clock time of an input event (seconds), from its `timeStamp` (ms, when known). */
export function tapTime(
  clock: AudioClock,
  eventTimeStamp?: number,
  now: number = performance.now(),
): number {
  const audioNow = clock.currentTime;
  if (eventTimeStamp === undefined || !Number.isFinite(eventTimeStamp)) return audioNow;
  const delay = (now - eventTimeStamp) / 1000;
  if (!(delay > 0 && delay <= MAX_INPUT_DELAY_S)) return audioNow;
  return audioNow - delay;
}

/** The tap of `button` for an input event. */
export function createTap(clock: AudioClock, button: Button, eventTimeStamp?: number): Tap {
  return { time: tapTime(clock, eventTimeStamp), button };
}
