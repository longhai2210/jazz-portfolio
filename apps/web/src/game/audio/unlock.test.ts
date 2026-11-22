/**
 * @jest-environment jsdom
 */
import { getAudioContextConstructor, isWebAudioSupported, unlockAudio, type AudioUnlockResult } from './unlock';
import {
  createFakeAudioScope,
  FakeAudioBufferSourceNode,
  FakeAudioContext,
} from './testing/fake-audio-context';
import type { AudioContextLike, AudioGlobalScope } from './types';

/** A Play button whose click handler calls `unlockAudio`, as the game's Play button does. */
function playButton(unlock: () => Promise<AudioUnlockResult>, duringClick: () => void = () => undefined) {
  const button = document.createElement('button');
  button.textContent = 'Play';
  let pending: Promise<AudioUnlockResult> | null = null;
  button.addEventListener('click', () => {
    pending = unlock();
    duringClick();
  });
  document.body.appendChild(button);
  return {
    click(): Promise<AudioUnlockResult> {
      button.click();
      if (!pending) throw new Error('the click handler did not run');
      return pending;
    },
  };
}

function resumeCalls(context: FakeAudioContext): number {
  return context.calls.filter((call) => call === 'resume').length;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('unlockAudio', () => {
  it('AC-DUEL-013.1: creates the AudioContext and calls resume() inside the click, then it is running', async () => {
    const { scope, contexts } = createFakeAudioScope();
    const seen = { created: 0, resumed: 0 };
    const button = playButton(
      () => unlockAudio({ scope }),
      () => {
        seen.created = contexts.length;
        seen.resumed = contexts[0] ? resumeCalls(contexts[0]) : 0;
      },
    );

    const result = await button.click();

    expect(seen).toEqual({ created: 1, resumed: 1 });
    expect(contexts[0].options).toEqual({ latencyHint: 'interactive' });
    expect(result).toEqual({ ok: true, context: contexts[0] });
    expect(contexts[0].state).toBe('running');
  });

  it.each(['suspended', 'interrupted'] as const)(
    'AC-DUEL-013.1: resumes an earlier context that is %s, inside the click, without creating another',
    async (state) => {
      const { scope, contexts } = createFakeAudioScope();
      const earlier = new FakeAudioContext();
      earlier.state = state;
      let resumedDuringClick = 0;
      const button = playButton(
        () => unlockAudio({ context: earlier, scope }),
        () => {
          resumedDuringClick = resumeCalls(earlier);
        },
      );

      const result = await button.click();

      expect(resumedDuringClick).toBe(1);
      expect(contexts).toHaveLength(0);
      expect(result).toEqual({ ok: true, context: earlier });
      expect(earlier.state).toBe('running');
    },
  );

  it('AC-DUEL-013.1: replaces a closed context, for a replay after leaving the game, with a new running one', async () => {
    const { scope, contexts } = createFakeAudioScope();
    const closed = new FakeAudioContext();
    closed.state = 'closed';
    let createdDuringClick = 0;
    const button = playButton(
      () => unlockAudio({ context: closed, scope }),
      () => {
        createdDuringClick = contexts.length;
      },
    );

    const result = await button.click();

    expect(createdDuringClick).toBe(1);
    expect(closed.calls).toEqual([]);
    expect(result).toEqual({ ok: true, context: contexts[0] });
    expect(contexts[0].state).toBe('running');
  });

  it('AC-DUEL-013.1: a context that already runs is returned as it is', async () => {
    const { scope, contexts } = createFakeAudioScope();
    const running = new FakeAudioContext();
    running.state = 'running';

    const result = await playButton(() => unlockAudio({ context: running, scope })).click();

    expect(result).toEqual({ ok: true, context: running });
    expect(running.calls).toEqual([]);
    expect(contexts).toHaveLength(0);
  });

  it('AC-DUEL-013.1: starts one silent frame inside the click, which older iOS Safari needs to open the output', async () => {
    const { scope, contexts } = createFakeAudioScope();
    let primedDuringClick = false;
    const button = playButton(
      () => unlockAudio({ scope }),
      () => {
        primedDuringClick = contexts[0].nodes.some(
          (node) =>
            node instanceof FakeAudioBufferSourceNode &&
            node.startTime !== null &&
            node.buffer?.length === 1 &&
            node.outputs.includes(contexts[0].destination),
        );
      },
    );

    await button.click();

    expect(primedDuringClick).toBe(true);
    expect(contexts[0].audibleSources()).toHaveLength(0);
  });

  it('AC-DUEL-013.1: falls back to the prefixed webkitAudioContext of older Safari', async () => {
    const { scope, contexts } = createFakeAudioScope({ prefixed: true });

    const result = await playButton(() => unlockAudio({ scope })).click();

    expect(scope.AudioContext).toBeUndefined();
    expect(isWebAudioSupported(scope)).toBe(true);
    expect(result).toEqual({ ok: true, context: contexts[0] });
    expect(contexts[0].state).toBe('running');
  });

  it('AC-DUEL-013.2: in a browser without Web Audio, unlock resolves "unsupported" instead of throwing', async () => {
    // jsdom has no Web Audio, like a browser without it.
    expect('AudioContext' in window).toBe(false);
    expect('webkitAudioContext' in window).toBe(false);
    expect(getAudioContextConstructor()).toBeNull();
    expect(isWebAudioSupported()).toBe(false);

    let pending: Promise<AudioUnlockResult> | null = null;
    expect(() => {
      pending = unlockAudio();
    }).not.toThrow();

    await expect(pending).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });

  it('AC-DUEL-013.2: a browser that refuses to create a context is reported as "unsupported"', async () => {
    const { scope, contexts } = createFakeAudioScope({ throwOnCreate: true });

    const result = await playButton(() => unlockAudio({ scope })).click();

    expect(result).toEqual({ ok: false, reason: 'unsupported' });
    expect(contexts).toHaveLength(0);
  });

  it('AC-DUEL-013.2: an empty scope, as on the server, is "unsupported"', async () => {
    const empty: AudioGlobalScope = {};

    await expect(unlockAudio({ scope: empty })).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });

  describe('when the browser does not start the audio', () => {
    it.each(['reject', 'stay'] as const)(
      'reports "blocked" with the context to retry, without throwing, when resume() does "%s"',
      async (behaviour) => {
        const { scope, contexts } = createFakeAudioScope({
          setup: (context) => {
            context.resumeBehaviour = behaviour;
          },
        });

        const result = await playButton(() => unlockAudio({ scope })).click();

        expect(result).toEqual({ ok: false, reason: 'blocked', context: contexts[0] });
        expect(contexts[0].state).toBe('suspended');
      },
    );

    it('reports "blocked" when resume() never settles, after the timeout', async () => {
      const { scope, contexts } = createFakeAudioScope({
        setup: (context) => {
          context.resumeBehaviour = 'hang';
        },
      });

      const result = await playButton(() => unlockAudio({ scope, timeoutMs: 5 })).click();

      expect(result).toEqual({ ok: false, reason: 'blocked', context: contexts[0] });
    });

    it('a later click retries with the blocked context and can succeed', async () => {
      const { scope, contexts } = createFakeAudioScope({
        setup: (context) => {
          context.resumeBehaviour = 'stay';
        },
      });
      const first = await playButton(() => unlockAudio({ scope })).click();
      expect(first.ok).toBe(false);
      const blocked: AudioContextLike | null = 'context' in first ? first.context : null;
      contexts[0].resumeBehaviour = 'run';

      const second = await playButton(() => unlockAudio({ context: blocked, scope })).click();

      expect(second).toEqual({ ok: true, context: contexts[0] });
      expect(contexts).toHaveLength(1);
    });
  });
});
