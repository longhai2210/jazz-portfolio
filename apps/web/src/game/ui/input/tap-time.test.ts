import { buttonForKey } from './keys';
import { MAX_INPUT_DELAY_S, createTap, tapTime } from './tap-time';

describe('tap time', () => {
  const clock = { currentTime: 10 };

  it('takes the audio clock, moved back by how long the event waited for its handler', () => {
    // The event happened 20 ms before the handler ran.
    expect(tapTime(clock, 1000, 1020)).toBeCloseTo(9.98, 12);
  });

  it('uses the audio clock as is when the event time is unknown or not comparable', () => {
    expect(tapTime(clock)).toBe(10);
    expect(tapTime(clock, Number.NaN, 1000)).toBe(10);
    // An event "after" the handler, or older than MAX_INPUT_DELAY_S: another time origin.
    expect(tapTime(clock, 1050, 1000)).toBe(10);
    expect(tapTime(clock, 1000, 1000 + MAX_INPUT_DELAY_S * 1000 + 1)).toBe(10);
    expect(tapTime(clock, 1000, 1000)).toBe(10);
  });

  it('builds the tap of a button, before any calibration offset', () => {
    expect(createTap(clock, 3)).toEqual({ time: 10, button: 3 });
  });

  it('maps D F J K to buttons 0 to 3 by physical key', () => {
    expect(['KeyD', 'KeyF', 'KeyJ', 'KeyK'].map((code) => buttonForKey({ code, key: '' }))).toEqual(
      [0, 1, 2, 3],
    );
    expect(buttonForKey({ code: 'KeyH', key: 'd' })).toBeNull();
    expect(buttonForKey({ code: 'Unidentified', key: 'J' })).toBe(2);
    expect(buttonForKey({ code: '', key: 'x' })).toBeNull();
  });
});
