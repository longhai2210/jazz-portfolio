/**
 * Public API of the duel's audio layer. Typical use, from the Play button's click handler:
 *
 *   const result = await unlockAudio({ context: previous });
 *   if (!result.ok && result.reason === 'unsupported') showCannotPlay();
 *   else if (result.ok) audio = createGameAudio(result.context, { volumes });
 *
 * Call `unlockAudio` directly in the handler, not after another `await`, so the gesture counts.
 */
export {
  AUDIO_CHANNELS,
  createGameAudio,
  type GameAudio,
  type GameAudioOptions,
} from './engine';
export {
  getAudioContextConstructor,
  isWebAudioSupported,
  unlockAudio,
  type AudioUnlockResult,
  type UnlockOptions,
} from './unlock';
export { buttonFrequency, buttonSemitones } from './pitch';
export {
  createScheduler,
  intervalTimer,
  type AudioScheduler,
  type PlaySound,
  type SchedulerOptions,
  type SchedulerTimer,
} from './scheduler';
export type {
  AudioChannel,
  AudioContextLike,
  ChannelVolumes,
  DrumHit,
  LickSound,
  ShadowVoice,
} from './types';
