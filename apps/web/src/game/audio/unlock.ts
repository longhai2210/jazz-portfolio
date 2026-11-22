/**
 * Unlocking audio. Browsers keep an `AudioContext` silent until the page creates or resumes it
 * inside a user gesture, so `unlockAudio` must be called straight from the player's click (the
 * Play button), and does both before its first `await`.
 *
 * Nothing here touches `window` at import time, so the module is safe to import on the server.
 */
import { UNLOCK_TIMEOUT_MS } from './config';
import type { AudioContextConstructor, AudioContextLike, AudioGlobalScope } from './types';

/**
 * - `ok: true`: the context is `running`.
 * - `unsupported`: the browser has no Web Audio, or refused to create a context. The game cannot
 *   be played; the UI shows a message and a way back to the portfolio.
 * - `blocked`: the context exists but did not start (the browser did not accept the gesture). A
 *   later click can retry with the same `context`.
 */
export type AudioUnlockResult =
  | { readonly ok: true; readonly context: AudioContextLike }
  | { readonly ok: false; readonly reason: 'unsupported' }
  | { readonly ok: false; readonly reason: 'blocked'; readonly context: AudioContextLike };

export interface UnlockOptions {
  /** A context from an earlier unlock: resumed if suspended, replaced if closed. */
  readonly context?: AudioContextLike | null;
  /** Where to look up `AudioContext`; defaults to `globalThis`. */
  readonly scope?: AudioGlobalScope;
  /** How long to wait for `resume()` before reporting `blocked`, in ms. */
  readonly timeoutMs?: number;
}

/** The audio context constructor of `scope`, or null when the browser has no Web Audio. */
export function getAudioContextConstructor(
  scope: AudioGlobalScope = globalThis,
): AudioContextConstructor | null {
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/** Whether the browser has Web Audio at all. */
export function isWebAudioSupported(scope: AudioGlobalScope = globalThis): boolean {
  return getAudioContextConstructor(scope) !== null;
}

/**
 * Creates the audio context, or resumes `options.context`, inside the current user gesture.
 * Never throws: every failure is a result the UI can show.
 */
export function unlockAudio(options: UnlockOptions = {}): Promise<AudioUnlockResult> {
  const { scope = globalThis, timeoutMs = UNLOCK_TIMEOUT_MS } = options;

  let context: AudioContextLike;
  if (options.context && options.context.state !== 'closed') {
    context = options.context;
  } else {
    const AudioContextClass = getAudioContextConstructor(scope);
    if (!AudioContextClass) return Promise.resolve({ ok: false, reason: 'unsupported' });
    try {
      context = new AudioContextClass({ latencyHint: 'interactive' });
    } catch {
      return Promise.resolve({ ok: false, reason: 'unsupported' });
    }
  }

  if (context.state === 'running') return Promise.resolve({ ok: true, context });

  // Both calls below must run synchronously, inside the gesture.
  let resumed: Promise<void>;
  try {
    resumed = context.resume();
  } catch (error) {
    resumed = Promise.reject(error);
  }
  primeOutput(context);
  return settle(context, resumed, timeoutMs);
}

/**
 * Plays one silent frame. Older iOS Safari only opens the audio output once a sound has started
 * inside the gesture, even after `resume()`.
 */
function primeOutput(context: AudioContextLike): void {
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start(0);
  } catch {
    // Priming is best effort; `resume()` decides whether audio runs.
  }
}

async function settle(
  context: AudioContextLike,
  resumed: Promise<void>,
  timeoutMs: number,
): Promise<AudioUnlockResult> {
  try {
    await withTimeout(resumed, timeoutMs);
  } catch {
    // A rejected resume leaves the context suspended, which is reported below.
  }
  return context.state === 'running'
    ? { ok: true, context }
    : { ok: false, reason: 'blocked', context };
}

/** Settles when `promise` does, or resolves after `ms` ms if it has not settled by then. */
function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(id);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}
