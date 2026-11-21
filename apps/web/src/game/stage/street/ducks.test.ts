import { createScheduler, type PlaySound } from '../../audio/scheduler';
import { createManualTimer, FakeScheduledSource } from '../../audio/testing/fake-audio-context';
import type { Voice } from '../../audio/types';
import { beatToTime, secondsPerBeat } from '../../core/clock';
import { DUCK_BOB_S, DUCK_QUACK_BEATS, STREET_BPM } from './config';
import {
  createStreetClock,
  duckBob,
  quackTime,
  quackTimesBetween,
  scheduleDuckQuacks,
} from './ducks';

/** Audio time the street music starts at; not 0, so code that ignores t0 fails. */
const T0 = 12.345;
const BAR_S = (4 * 60) / 84;

/** Expected quack times, written out from the spec: beats 2 and 4 of bars 0 to `bars - 1`. */
function expectedQuacks(bars: number): number[] {
  const times: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    times.push(T0 + ((4 * bar + 1) * 60) / 84, T0 + ((4 * bar + 3) * 60) / 84);
  }
  return times;
}

/**
 * The street as the scene will run it: an audio clock moved by hand, the game's lookahead
 * scheduler on it, and every frame the quacks of the next `ahead` seconds queued, the cursor
 * moving to the end of the window each time. Returns the times the quack sounds started.
 */
function runStreet(until: number, ahead = 0.2): number[] {
  const audio = { currentTime: T0 - 1 };
  const timer = createManualTimer();
  const scheduler = createScheduler(audio, { timer });
  const clock = createStreetClock(T0);
  const started: number[] = [];
  const quack: PlaySound = (time): Voice => {
    const source = new FakeScheduledSource();
    source.start(time);
    started.push(time);
    return { sources: [source], end: time + 0.3 };
  };

  scheduler.start();
  let cursor = audio.currentTime;
  while (audio.currentTime < until) {
    audio.currentTime += 1 / 60;
    scheduleDuckQuacks(scheduler, clock, cursor, audio.currentTime + ahead, quack);
    cursor = audio.currentTime + ahead;
    timer.fire();
  }
  return started;
}

describe('ducks of Hồ Làng', () => {
  it('AC-STAGE-004.1: the street clock runs at STREET_BPM (84) and the ducks quack on beats 2 and 4', () => {
    expect(STREET_BPM).toBe(84);
    expect(DUCK_QUACK_BEATS).toEqual([2, 4]);

    const clock = createStreetClock(T0);
    expect(clock.bpm).toBe(84);
    expect(clock.t0).toBe(T0);
    expect(quackTime(clock, 0, 2)).toBeCloseTo(T0 + 60 / 84, 9);
    expect(quackTime(clock, 0, 4)).toBeCloseTo(T0 + 180 / 84, 9);
  });

  it('AC-STAGE-004.1: over 8 bars there is one quack on beat 2 and one on beat 4 of every bar, and none on 1 or 3', () => {
    const clock = createStreetClock(T0);

    const times = quackTimesBetween(clock, T0, T0 + 8 * BAR_S);

    const expected = expectedQuacks(8);
    expect(times).toHaveLength(expected.length);
    times.forEach((time, i) => expect(time).toBeCloseTo(expected[i], 9));
    for (let bar = 0; bar < 8; bar++) {
      for (const offBeat of [0, 2]) {
        const beatTime = beatToTime(clock, 4 * bar + offBeat);
        expect(times.some((time) => Math.abs(time - beatTime) < 0.05)).toBe(false);
      }
    }
  });

  it('AC-STAGE-004.1: quacks are scheduled through the audio scheduler and start at their exact audio time', () => {
    const started = runStreet(T0 + 6 * BAR_S);

    const expected = expectedQuacks(6);
    expect(started).toHaveLength(expected.length);
    started.forEach((time, i) => expect(time).toBeCloseTo(expected[i], 9));
  });

  it('AC-STAGE-004.1: scheduling frame after frame never queues a quack twice nor skips one', () => {
    const clock = createStreetClock(T0);
    const windows = [T0 - 3, T0 + 0.5, T0 + 60 / 84, T0 + 1.9, T0 + 2.5, T0 + 3 * BAR_S];
    const rolled: number[] = [];
    for (let i = 1; i < windows.length; i++) {
      rolled.push(...quackTimesBetween(clock, windows[i - 1], windows[i]));
    }

    expect(rolled).toEqual(quackTimesBetween(clock, windows[0], windows[windows.length - 1]));
    expect(new Set(rolled).size).toBe(rolled.length);
    expect(rolled).toHaveLength(6);
    // A window starting exactly on a quack includes it; the window ending there does not.
    expect(quackTimesBetween(clock, T0 + 0.5, T0 + 60 / 84)).toEqual([]);
    expect(quackTimesBetween(clock, T0 + 60 / 84, T0 + 1)).toHaveLength(1);
  });

  it('AC-STAGE-004.1: there is no quack before the street music starts at t0', () => {
    const clock = createStreetClock(T0);

    expect(quackTimesBetween(clock, T0 - 10, T0)).toEqual([]);
    expect(quackTimesBetween(clock, 0, T0 + 1)).toHaveLength(1);
    expect(quackTimesBetween(clock, T0 + 1, T0 + 1)).toEqual([]);
    expect(quackTimesBetween(clock, T0 + 2, T0 + 1)).toEqual([]);
    expect(() => quackTimesBetween(clock, Number.NaN, T0)).toThrow(RangeError);
  });

  it('AC-STAGE-004.2: the ducks are deepest in their bob exactly at the time of each scheduled quack', () => {
    const clock = createStreetClock(T0);
    const started = runStreet(T0 + 4 * BAR_S);

    expect(started.length).toBeGreaterThan(0);
    for (const time of started) {
      expect(duckBob(clock, time)).toBeCloseTo(1, 9);
    }
    // Times computed another way, with other rounding, still land on the quack.
    for (const time of expectedQuacks(4)) {
      expect(duckBob(clock, time)).toBeCloseTo(1, 6);
    }
  });

  it('AC-STAGE-004.2: the ducks rest just before each quack and are back at rest within DUCK_BOB_S', () => {
    const clock = createStreetClock(T0);

    for (const time of quackTimesBetween(clock, T0, T0 + 4 * BAR_S)) {
      expect(duckBob(clock, time - 0.001)).toBe(0);
      const halfway = duckBob(clock, time + DUCK_BOB_S / 2);
      expect(halfway).toBeGreaterThan(0);
      expect(halfway).toBeLessThan(1);
      // At DUCK_BOB_S itself, up to floating-point noise in time + DUCK_BOB_S - time.
      expect(duckBob(clock, time + DUCK_BOB_S)).toBeCloseTo(0, 12);
      expect(duckBob(clock, time + DUCK_BOB_S + 0.001)).toBe(0);
    }
  });

  it('AC-STAGE-004.2: the bob eases back to rest without bouncing, and one bob ends before the next quack', () => {
    const clock = createStreetClock(T0);
    const quack = quackTime(clock, 2, 4);

    let previous = duckBob(clock, quack);
    for (let t = 0.01; t <= DUCK_BOB_S + 0.01; t += 0.01) {
      const value = duckBob(clock, quack + t);
      expect(value).toBeLessThanOrEqual(previous);
      expect(value).toBeGreaterThanOrEqual(0);
      previous = value;
    }
    expect(DUCK_BOB_S).toBeLessThan(secondsPerBeat(STREET_BPM));
  });

  it('AC-STAGE-004.2: the ducks do not bob on beats 1 and 3, nor before the music starts', () => {
    const clock = createStreetClock(T0);

    for (let bar = 0; bar < 4; bar++) {
      expect(duckBob(clock, beatToTime(clock, 4 * bar))).toBe(0);
      expect(duckBob(clock, beatToTime(clock, 4 * bar + 2))).toBe(0);
    }
    expect(duckBob(clock, T0 - 5)).toBe(0);
    expect(duckBob(clock, T0)).toBe(0);
    expect(() => duckBob(clock, Number.NaN)).toThrow(RangeError);
  });
});
