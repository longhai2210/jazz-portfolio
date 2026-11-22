import { PLAYER_VOICE, SHADOW_VOICES } from './config';
import { playClick, playDrum, playLickSound, playTone } from './synth';
import {
  FakeAudioBufferSourceNode,
  FakeAudioContext,
  FakeAudioNode,
  FakeGainNode,
  isRoutedTo,
} from './testing/fake-audio-context';
import type { DrumHit, LickSound, Voice } from './types';

function setup() {
  const context = new FakeAudioContext();
  const output = new FakeAudioNode();
  return { context, output };
}

/** Every source starts no earlier than `time`, stops by the voice's end, and reaches `output`. */
function expectVoice(context: FakeAudioContext, output: FakeAudioNode, played: Voice, time: number) {
  expect(played.sources.length).toBeGreaterThan(0);
  expect(played.end).toBeGreaterThan(time);
  for (const source of context.sources()) {
    expect(played.sources).toContain(source);
    expect(source.startTime).not.toBeNull();
    expect(source.startTime ?? Number.NaN).toBeGreaterThanOrEqual(time);
    expect(source.stopTime ?? Number.NaN).toBeLessThanOrEqual(played.end);
    expect(isRoutedTo(source, output)).toBe(true);
  }
}

/** Every gain envelope starts silent at or after `time` and fades back to near silence. */
function expectEnvelopes(context: FakeAudioContext, time: number) {
  const envelopes = context.nodes.filter((node): node is FakeGainNode => node instanceof FakeGainNode);
  expect(envelopes.length).toBeGreaterThan(0);
  for (const { gain } of envelopes) {
    expect(gain.events[0].method).toBe('setValueAtTime');
    expect(gain.events[0].time).toBeGreaterThanOrEqual(time);
    expect(gain.events[gain.events.length - 1].value).toBeLessThan(0.001);
  }
}

describe('placeholder synth', () => {
  it.each([['player', PLAYER_VOICE], ...Object.entries(SHADOW_VOICES)] as const)(
    'the %s voice plays one enveloped note from its time',
    (_name, shape) => {
      const { context, output } = setup();

      const played = playTone(context, output, shape, 440, 2);

      expectVoice(context, output, played, 2);
      expectEnvelopes(context, 2);
      expect(played.end).toBeCloseTo(2 + shape.attack + shape.decay, 1);
    },
  );

  const drums: DrumHit[] = ['kick', 'snare', 'ride', 'hat'];
  it.each(drums)('the %s drum plays from its time', (hit) => {
    const { context, output } = setup();

    const played = playDrum(context, output, hit, 1.5, 0.7);

    expectVoice(context, output, played, 1.5);
    expectEnvelopes(context, 1.5);
  });

  it('a silent level is still a valid envelope', () => {
    const { context, output } = setup();

    expect(() => playDrum(context, output, 'ride', 0, 0)).not.toThrow();
    expect(() => playTone(context, output, PLAYER_VOICE, 440, 0, 0)).not.toThrow();
  });

  it('the noise drums share one noise buffer per context', () => {
    const { context, output } = setup();
    const createBuffer = jest.spyOn(context, 'createBuffer');

    playDrum(context, output, 'snare', 0);
    playDrum(context, output, 'ride', 0.1);
    playDrum(context, output, 'hat', 0.2);

    expect(createBuffer).toHaveBeenCalledTimes(1);
    const buffers = context.nodes
      .filter((node): node is FakeAudioBufferSourceNode => node instanceof FakeAudioBufferSourceNode)
      .map((node) => node.buffer);
    expect(new Set(buffers).size).toBe(1);
    expect(buffers[0]?.length).toBe(context.sampleRate);
  });

  const lickSounds: LickSound[] = ['duck', 'frog', 'windChime'];
  it.each(lickSounds)('the %s lick sound plays from its time', (sound) => {
    const { context, output } = setup();

    const played = playLickSound(context, output, sound, 4);

    expectVoice(context, output, played, 4);
    expectEnvelopes(context, 4);
    expect(Math.min(...context.sources().map((source) => source.startTime ?? Number.NaN))).toBe(4);
  });

  it('the click is short and starts at its time', () => {
    const { context, output } = setup();

    const played = playClick(context, output, 0.25, true);

    expectVoice(context, output, played, 0.25);
    expect(played.end - 0.25).toBeLessThan(0.1);
  });
});
