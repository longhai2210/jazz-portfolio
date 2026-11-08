import { createBeatClock, nearestStep, stepTime } from '../core/clock';
import { BUTTONS, DUEL_BPM } from '../core/config';
import type { BarNote, Button } from '../core/types';
import {
  BLUES_SCALE_SEMITONES,
  DEFAULT_VOLUMES,
  DRUM_PATTERN,
  PLAYER_VOICE,
  ROOT_FREQUENCY_HZ,
  SHADOW_VOICES,
} from './config';
import { AUDIO_CHANNELS, createGameAudio, type GameAudioOptions } from './engine';
import { buttonFrequency } from './pitch';
import {
  createManualTimer,
  FakeAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
  isRoutedTo,
  type FakeScheduledSource,
} from './testing/fake-audio-context';
import type { AudioNodeLike, LickSound, ShadowVoice } from './types';

function setup(options: GameAudioOptions = {}) {
  const context = new FakeAudioContext();
  context.state = 'running';
  const timer = createManualTimer();
  const audio = createGameAudio(context, { timer, ...options });
  return { context, timer, audio };
}

/** Everything scheduled is started at once, to inspect it without moving the clock. */
const START_ALL: GameAudioOptions = { lookahead: 1000 };

function gainOf(node: AudioNodeLike): number {
  if (!(node instanceof FakeGainNode)) throw new Error('expected a gain node');
  return node.gain.value;
}

/** The frequency an oscillator was set to when it started. */
function startFrequency(osc: FakeOscillatorNode): number {
  const set = osc.frequency.events.find((event) => event.method === 'setValueAtTime');
  if (!set) throw new Error('oscillator frequency was never set');
  return set.value;
}

function startedOscillators(context: FakeAudioContext): FakeOscillatorNode[] {
  return context.oscillators().filter((osc) => osc.startTime !== null);
}

function startTimes(sources: readonly FakeScheduledSource[]): number[] {
  return sources.map((source) => source.startTime ?? Number.NaN).sort((a, b) => a - b);
}

describe('player notes', () => {
  it('AC-DUEL-013.5: a tap plays its note at once, at currentTime, even between two grid steps', () => {
    const { context, audio } = setup();
    const clock = createBeatClock({ t0: 0, bpm: DUEL_BPM[1], difficulty: 'session' });
    audio.scheduleDrumBars(clock, 1, 1);
    context.currentTime = 0.5;
    expect(Math.abs(nearestStep(clock, 0.5).time - 0.5)).toBeGreaterThan(0.1);

    const playedAt = audio.playPlayerNote(2);

    // Started in the call itself: no timer tick, no waiting for the beat.
    const notes = startedOscillators(context);
    expect(notes).toHaveLength(1);
    expect(playedAt).toBe(0.5);
    expect(notes[0].startTime).toBe(0.5);
    expect(startFrequency(notes[0])).toBeCloseTo(buttonFrequency(2, PLAYER_VOICE.octave), 9);
    expect(isRoutedTo(notes[0], audio.channels.player)).toBe(true);
    expect(isRoutedTo(notes[0], audio.channels.music)).toBe(false);
    expect(isRoutedTo(notes[0], context.destination)).toBe(true);
  });

  it('AC-DUEL-013.5: every tap plays, also the same button twice in quick succession', () => {
    const { context, audio } = setup();

    context.currentTime = 1;
    audio.playPlayerNote(0);
    context.currentTime = 1.03;
    audio.playPlayerNote(0);

    const notes = startedOscillators(context);
    expect(notes.map((note) => note.startTime)).toEqual([1, 1.03]);
    expect(notes.map(startFrequency)).toEqual([buttonFrequency(0, 1), buttonFrequency(0, 1)]);
  });

  it('AC-DUEL-013.5: each button plays its own note: D, F, J, K ascend on the blues scale', () => {
    const { context, audio } = setup();

    for (const button of BUTTONS) audio.playPlayerNote(button);

    const frequencies = startedOscillators(context).map(startFrequency);
    expect(frequencies).toHaveLength(4);
    for (let i = 1; i < frequencies.length; i++) {
      expect(frequencies[i]).toBeGreaterThan(frequencies[i - 1]);
    }
    for (const hz of frequencies) {
      const semitones = Math.round(12 * Math.log2(hz / ROOT_FREQUENCY_HZ));
      expect(BLUES_SCALE_SEMITONES).toContain(((semitones % 12) + 12) % 12);
    }
  });

  it('plays nothing, and does not throw, once the audio is closed', async () => {
    const { context, audio } = setup();
    await audio.close();

    expect(() => audio.playPlayerNote(1)).not.toThrow();
    expect(startedOscillators(context)).toHaveLength(0);
  });
});

describe('volume channels', () => {
  it('mixes music, your notes and effects into the speakers, at their default volumes', () => {
    const { context, audio } = setup();

    expect(audio.getVolumes()).toEqual(DEFAULT_VOLUMES);
    for (const channel of AUDIO_CHANNELS) {
      expect(isRoutedTo(audio.channels[channel], context.destination)).toBe(true);
      expect(gainOf(audio.channels[channel])).toBe(DEFAULT_VOLUMES[channel]);
    }
  });

  it('sets one channel without touching the others, clamped to 0..1', () => {
    const { audio } = setup();

    audio.setVolume('player', 0.25);
    expect(gainOf(audio.channels.player)).toBe(0.25);
    expect(audio.getVolume('music')).toBe(DEFAULT_VOLUMES.music);

    audio.setVolume('music', 1.5);
    audio.setVolume('sfx', -0.2);
    expect(audio.getVolumes()).toEqual({ music: 1, player: 0.25, sfx: 0 });
    expect(gainOf(audio.channels.music)).toBe(1);
    expect(gainOf(audio.channels.sfx)).toBe(0);
  });

  it('rejects a volume that is not a number', () => {
    const { audio } = setup();

    expect(() => audio.setVolume('music', Number.NaN)).toThrow(RangeError);
    expect(audio.getVolume('music')).toBe(DEFAULT_VOLUMES.music);
  });

  it('starts from the given volumes, so saved levels carry over to a new context', () => {
    const { audio } = setup({ volumes: { player: 0.3, sfx: 2 } });

    expect(audio.getVolumes()).toEqual({ music: DEFAULT_VOLUMES.music, player: 0.3, sfx: 1 });
    expect(gainOf(audio.channels.player)).toBe(0.3);
  });
});

describe('scheduled sounds', () => {
  it('queues sounds ahead on the audio clock and starts them at their exact time', () => {
    const { context, timer, audio } = setup();

    audio.scheduleClick(1.04);
    expect(context.audibleSources()).toHaveLength(0);

    context.currentTime = 0.9;
    timer.fire();
    expect(context.audibleSources()).toHaveLength(0);

    context.currentTime = 0.97;
    timer.fire();
    expect(startTimes(context.audibleSources())).toEqual([1.04]);
  });

  it('plays the swing groove on the grid of the clock, swung at Late Set, on the music channel', () => {
    const { context, audio } = setup(START_ALL);
    const clock = createBeatClock({ t0: 2, bpm: DUEL_BPM[2], difficulty: 'lateSet' });

    audio.scheduleDrumBars(clock, 3, 2);

    const expected = [3, 4]
      .flatMap((bar) => DRUM_PATTERN.map(({ step }) => stepTime(clock, bar, step)))
      .sort((a, b) => a - b);
    const sources = context.audibleSources();
    expect(startTimes(sources)).toEqual(expected);
    for (const source of sources) expect(isRoutedTo(source, audio.channels.music)).toBe(true);
  });

  it("plays a Shadow's call bar by bar on the clock, in that Shadow's voice", () => {
    const { context, audio } = setup(START_ALL);
    const clock = createBeatClock({ t0: 0, bpm: DUEL_BPM[1], difficulty: 'session' });
    const bars: { notes: BarNote[] }[] = [
      { notes: [{ step: 0, button: 0 }, { step: 3, button: 3 }] },
      { notes: [{ step: 2, button: 1 }] },
    ];
    const buttons: Button[] = [0, 3, 1];

    audio.scheduleCall(clock, 'aki', 4, bars);

    const notes = startedOscillators(context);
    expect(notes.map((note) => note.startTime)).toEqual([
      stepTime(clock, 4, 0),
      stepTime(clock, 4, 3),
      stepTime(clock, 5, 2),
    ]);
    expect(notes.map(startFrequency)).toEqual(
      buttons.map((button) => buttonFrequency(button, SHADOW_VOICES.aki.octave)),
    );
    for (const note of notes) {
      expect(note.type).toBe(SHADOW_VOICES.aki.wave);
      expect(isRoutedTo(note, audio.channels.music)).toBe(true);
    }
  });

  it('gives each Shadow its own voice, unlike the player', () => {
    const shadows: ShadowVoice[] = ['aki', 'sayo', 'ren'];
    const voices = shadows.map((shadow) => {
      const { context, audio } = setup(START_ALL);
      audio.scheduleShadowNote(shadow, 1, 0.5);
      const [note] = startedOscillators(context);
      return `${note.type}@${startFrequency(note).toFixed(2)}`;
    });
    const { context, audio } = setup();
    audio.playPlayerNote(1);
    const [player] = startedOscillators(context);

    expect(new Set([...voices, `${player.type}@${startFrequency(player).toFixed(2)}`]).size).toBe(4);
  });

  const lickSounds: LickSound[] = ['duck', 'frog', 'windChime'];
  it.each(lickSounds)(
    'plays the %s lick sound at its time on the effects channel',
    (sound) => {
      const { context, audio } = setup(START_ALL);

      audio.scheduleLickSound(sound, 3);

      const sources = context.audibleSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(Math.min(...startTimes(sources))).toBe(3);
      for (const source of sources) {
        expect(isRoutedTo(source, audio.channels.sfx)).toBe(true);
        expect(isRoutedTo(source, audio.channels.music)).toBe(false);
      }
    },
  );

  it('accents the first click of a count with a higher pitch', () => {
    const { context, audio } = setup(START_ALL);

    audio.scheduleClick(1, true);
    audio.scheduleClick(1.5);

    const [accent, plain] = startedOscillators(context);
    expect(startFrequency(accent)).toBeGreaterThan(startFrequency(plain));
    expect(isRoutedTo(plain, audio.channels.music)).toBe(true);
  });

  it('clearScheduled drops queued sounds and silences started ones that have not played yet', () => {
    const { context, timer, audio } = setup({ lookahead: 0.5 });
    const clock = createBeatClock({ t0: 0.3, bpm: DUEL_BPM[1], difficulty: 'session' });
    audio.scheduleDrumBars(clock, 0, 2);
    const started = context.audibleSources();
    expect(started.length).toBeGreaterThan(0);
    for (const source of started) expect(source.startTime).toBeGreaterThan(context.currentTime);

    audio.clearScheduled();
    context.currentTime = 3;
    timer.fire();

    for (const source of started) expect(source.stopCalls).toBe(2);
    expect(context.audibleSources()).toHaveLength(started.length);
  });
});

describe('suspend, resume and close', () => {
  it('suspend() pauses the audio clock and the scheduler; resume() restarts both', async () => {
    const { context, timer, audio } = setup();

    await audio.suspend();
    expect(context.calls).toEqual(['suspend']);
    expect(context.state).toBe('suspended');
    expect(timer.active).toBe(false);

    await audio.resume();
    expect(context.calls).toEqual(['suspend', 'resume']);
    expect(context.state).toBe('running');
    expect(timer.active).toBe(true);
  });

  it('close() releases the context once, stops the scheduler, and later calls do nothing', async () => {
    const { context, timer, audio } = setup();
    audio.scheduleClick(5);

    await audio.close();
    await audio.close();
    await audio.suspend();
    await audio.resume();
    audio.scheduleClick(0.01);
    audio.scheduleLickSound('duck', 0.01);
    context.currentTime = 5;
    timer.fire();

    expect(context.calls).toEqual(['close']);
    expect(context.state).toBe('closed');
    expect(timer.active).toBe(false);
    expect(context.audibleSources()).toHaveLength(0);
  });
});
