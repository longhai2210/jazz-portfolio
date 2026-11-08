import { SCHEDULE_LATE_TOLERANCE_S, SCHEDULE_LOOKAHEAD_S } from './config';
import { createScheduler, type PlaySound } from './scheduler';
import { createManualTimer, FakeScheduledSource } from './testing/fake-audio-context';
import type { Voice } from './types';

/** A clock the test moves by hand, and a sound that records when it was started. */
function setup() {
  const clock = { currentTime: 0 };
  const timer = createManualTimer();
  const scheduler = createScheduler(clock, { timer });
  const played: { label: string; time: number; source: FakeScheduledSource }[] = [];
  const sound =
    (label: string, length = 0.2): PlaySound =>
    (time): Voice => {
      const source = new FakeScheduledSource();
      source.start(time);
      source.stop(time + length);
      played.push({ label, time, source });
      return { sources: [source], end: time + length };
    };
  return { clock, timer, scheduler, played, sound };
}

describe('audio scheduler', () => {
  it('starts a sound only once it is inside the lookahead, at its exact time', () => {
    const { clock, scheduler, played, sound } = setup();
    scheduler.start();

    scheduler.schedule(1, sound('a'));
    clock.currentTime = 1 - SCHEDULE_LOOKAHEAD_S - 0.01;
    scheduler.tick();
    expect(played).toHaveLength(0);

    clock.currentTime = 1 - SCHEDULE_LOOKAHEAD_S + 0.01;
    scheduler.tick();
    expect(played.map(({ label, time }) => [label, time])).toEqual([['a', 1]]);
    expect(scheduler.pending).toBe(0);
  });

  it('starts a sound inside the lookahead at once when it is queued', () => {
    const { clock, scheduler, played, sound } = setup();
    scheduler.start();
    clock.currentTime = 2;

    scheduler.schedule(2.05, sound('a'));

    expect(played.map(({ time }) => time)).toEqual([2.05]);
  });

  it('keeps time order, and queue order for sounds at the same time', () => {
    const { scheduler, played, sound } = setup();

    scheduler.schedule(0.06, sound('late'));
    scheduler.schedule(0.02, sound('first'));
    scheduler.schedule(0.02, sound('second'));
    scheduler.tick();

    expect(played.map(({ label }) => label)).toEqual(['first', 'second', 'late']);
  });

  it('plays a slightly late sound at once, and drops one later than the tolerance', () => {
    const { clock, scheduler, played, sound } = setup();
    clock.currentTime = 5;

    scheduler.schedule(5 - SCHEDULE_LATE_TOLERANCE_S / 2, sound('slightly late'));
    scheduler.schedule(5 - SCHEDULE_LATE_TOLERANCE_S * 2, sound('too late'));
    scheduler.tick();

    expect(played.map(({ label, time }) => [label, time])).toEqual([['slightly late', 5]]);
    expect(scheduler.pending).toBe(0);
  });

  it('only ticks while started; stop() keeps the queue', () => {
    const { clock, timer, scheduler, played, sound } = setup();

    scheduler.schedule(1, sound('a'));
    expect(scheduler.running).toBe(false);
    clock.currentTime = 0.95;
    timer.fire();
    expect(played).toHaveLength(0);

    scheduler.start();
    expect(scheduler.running).toBe(true);
    expect(played).toHaveLength(1);

    scheduler.schedule(2, sound('b'));
    scheduler.stop();
    clock.currentTime = 1.95;
    timer.fire();
    expect(scheduler.running).toBe(false);
    expect(scheduler.pending).toBe(1);
  });

  it('clear() drops the queue and stops started sounds that have not ended', () => {
    const { clock, scheduler, played, sound } = setup();
    scheduler.schedule(0, sound('ended', 0.1));
    scheduler.tick();
    clock.currentTime = 0.5;
    scheduler.schedule(0.55, sound('future'));
    scheduler.schedule(3, sound('queued'));
    scheduler.tick();

    scheduler.clear();
    clock.currentTime = 3;
    scheduler.tick();

    const byLabel = Object.fromEntries(played.map((entry) => [entry.label, entry.source]));
    expect(Object.keys(byLabel)).toEqual(['ended', 'future']);
    expect(byLabel.future.stopCalls).toBe(2);
    expect(byLabel.ended.stopCalls).toBe(1);
    expect(scheduler.pending).toBe(0);
  });

  it('clear() survives a source the browser has already released', () => {
    const { scheduler } = setup();
    const released = new FakeScheduledSource();
    released.start(0);
    released.stop = () => {
      throw new Error('InvalidStateError');
    };
    scheduler.schedule(0, () => ({ sources: [released], end: 10 }));
    scheduler.tick();

    expect(() => scheduler.clear()).not.toThrow();
  });

  it('rejects a time that is not a number', () => {
    const { scheduler, sound } = setup();

    expect(() => scheduler.schedule(Number.NaN, sound('a'))).toThrow(RangeError);
    expect(scheduler.pending).toBe(0);
  });
});
