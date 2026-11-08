/**
 * The duel's audio: one `AudioContext`, three volume channels and the placeholder sounds, all on
 * the one audio clock the judge reads.
 *
 * - The player's notes play at once, at `currentTime`, never waiting for the beat.
 * - Everything else (drums, the Shadow's call, lick sounds, clicks) is queued ahead of time on
 *   the audio clock through the lookahead scheduler.
 *
 * Mix: `music` (drums, the Shadow's call, clicks), `player` (your notes) and `sfx` (lick sounds)
 * each have a gain, and all three feed a master gain into the speakers.
 */
import { stepTime, type BeatClock } from '../core/clock';
import type { BarNote, Button } from '../core/types';
import {
  DEFAULT_VOLUMES,
  DRUM_PATTERN,
  MASTER_GAIN,
  PLAYER_VOICE,
  SHADOW_VOICES,
} from './config';
import { buttonFrequency } from './pitch';
import { createScheduler, type SchedulerOptions } from './scheduler';
import { playClick, playDrum, playLickSound, playTone } from './synth';
import type {
  AudioChannel,
  AudioContextLike,
  AudioNodeLike,
  ChannelVolumes,
  DrumHit,
  GainNodeLike,
  LickSound,
  ShadowVoice,
} from './types';

export const AUDIO_CHANNELS: readonly AudioChannel[] = ['music', 'player', 'sfx'];

export interface GameAudioOptions extends SchedulerOptions {
  /** Starting volumes, for example the player's saved levels when a new context is unlocked. */
  readonly volumes?: Partial<ChannelVolumes>;
}

export interface GameAudio {
  readonly context: AudioContextLike;
  /** The audio clock, in seconds. Taps and notes are timed against it. */
  readonly currentTime: number;
  /** The output node of each channel, for example to attach an analyser. Set volumes with `setVolume`. */
  readonly channels: Readonly<Record<AudioChannel, AudioNodeLike>>;

  getVolume(channel: AudioChannel): number;
  /** Sets a channel's volume; values outside 0 to 1 are clamped. */
  setVolume(channel: AudioChannel, volume: number): void;
  getVolumes(): ChannelVolumes;

  /** Plays the note of `button` now, at `currentTime`, on the player channel. Returns that time. */
  playPlayerNote(button: Button): number;

  /** Queues one drum hit at `time`. */
  scheduleDrum(hit: DrumHit, time: number, level?: number): void;
  /** Queues the swing groove for `count` bars from bar `fromBar` of `clock`. */
  scheduleDrumBars(clock: BeatClock, fromBar: number, count: number): void;
  /** Queues one note of a Shadow at `time`, on the button's pitch in the Shadow's voice. */
  scheduleShadowNote(shadow: ShadowVoice, button: Button, time: number): void;
  /** Queues a Shadow's call: bar `i` of `bars` is played as bar `firstBar + i` of `clock`. */
  scheduleCall(
    clock: BeatClock,
    shadow: ShadowVoice,
    firstBar: number,
    bars: readonly { readonly notes: readonly BarNote[] }[],
  ): void;
  /** Queues the signature sound of a lick at `time`, on the effects channel. */
  scheduleLickSound(sound: LickSound, time: number): void;
  /** Queues a calibration or count-in click at `time`. */
  scheduleClick(time: number, accent?: boolean): void;
  /** Drops every queued sound and silences the ones already started. */
  clearScheduled(): void;

  /** Pauses the audio clock (`AudioContext.suspend()`). Never throws. */
  suspend(): Promise<void>;
  /** Restarts the audio clock (`AudioContext.resume()`). Never throws. */
  resume(): Promise<void>;
  /** Releases the context for good (`AudioContext.close()`). Safe to call twice; never throws. */
  close(): Promise<void>;
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    throw new RangeError(`volume must be a finite number, got ${volume}`);
  }
  return Math.min(1, Math.max(0, volume));
}

export function createGameAudio(
  context: AudioContextLike,
  options: GameAudioOptions = {},
): GameAudio {
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);

  const volumes: Record<AudioChannel, number> = { ...DEFAULT_VOLUMES };
  function createChannel(channel: AudioChannel): GainNodeLike {
    volumes[channel] = clampVolume(options.volumes?.[channel] ?? DEFAULT_VOLUMES[channel]);
    const gain = context.createGain();
    gain.gain.value = volumes[channel];
    gain.connect(master);
    return gain;
  }
  const channels: Readonly<Record<AudioChannel, GainNodeLike>> = {
    music: createChannel('music'),
    player: createChannel('player'),
    sfx: createChannel('sfx'),
  };

  const scheduler = createScheduler(context, options);
  scheduler.start();

  function isClosed(): boolean {
    return context.state === 'closed';
  }

  function scheduleShadowNote(shadow: ShadowVoice, button: Button, time: number): void {
    if (isClosed()) return;
    const shape = SHADOW_VOICES[shadow];
    scheduler.schedule(time, (at) =>
      playTone(context, channels.music, shape, buttonFrequency(button, shape.octave), at),
    );
  }

  function scheduleDrum(hit: DrumHit, time: number, level = 1): void {
    if (isClosed()) return;
    scheduler.schedule(time, (at) => playDrum(context, channels.music, hit, at, level));
  }

  return {
    context,
    get currentTime() {
      return context.currentTime;
    },
    channels,

    getVolume(channel) {
      return volumes[channel];
    },
    setVolume(channel, volume) {
      volumes[channel] = clampVolume(volume);
      channels[channel].gain.value = volumes[channel];
    },
    getVolumes() {
      return { ...volumes };
    },

    playPlayerNote(button) {
      const now = context.currentTime;
      if (isClosed()) return now;
      playTone(
        context,
        channels.player,
        PLAYER_VOICE,
        buttonFrequency(button, PLAYER_VOICE.octave),
        now,
      );
      return now;
    },

    scheduleDrum,
    scheduleDrumBars(clock, fromBar, count) {
      for (let bar = fromBar; bar < fromBar + count; bar++) {
        for (const { step, hit, level } of DRUM_PATTERN) {
          scheduleDrum(hit, stepTime(clock, bar, step), level);
        }
      }
    },
    scheduleShadowNote,
    scheduleCall(clock, shadow, firstBar, bars) {
      bars.forEach((bar, i) => {
        for (const note of bar.notes) {
          scheduleShadowNote(shadow, note.button, stepTime(clock, firstBar + i, note.step));
        }
      });
    },
    scheduleLickSound(sound, time) {
      if (isClosed()) return;
      scheduler.schedule(time, (at) => playLickSound(context, channels.sfx, sound, at));
    },
    scheduleClick(time, accent = false) {
      if (isClosed()) return;
      scheduler.schedule(time, (at) => playClick(context, channels.music, at, accent));
    },
    clearScheduled() {
      scheduler.clear();
    },

    async suspend() {
      scheduler.stop();
      if (isClosed()) return;
      try {
        await context.suspend();
      } catch {
        // Already closing: there is nothing left to pause.
      }
    },
    async resume() {
      if (isClosed()) return;
      try {
        await context.resume();
      } catch {
        // The browser refused; the context stays suspended and the caller can read its state.
      }
      scheduler.start();
    },
    async close() {
      scheduler.stop();
      scheduler.clear();
      if (isClosed()) return;
      try {
        await context.close();
      } catch {
        // Closing twice, or a browser that already released it: either way it is gone.
      }
    },
  };
}
