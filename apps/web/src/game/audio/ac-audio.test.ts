/**
 * Tester's acceptance tests for T-007 (AC-DUEL-013.1, 013.2, 013.5), written from the spec with
 * an independent fake of the Web Audio API.
 */
import { createGameAudio, unlockAudio, isWebAudioSupported } from './index';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextConstructor,
  AudioContextLike,
  AudioGlobalScope,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from './types';

class Param implements AudioParamLike {
  constructor(public value = 1) {}
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
}
class Node implements AudioNodeLike {
  connect(d: AudioNodeLike) { return d; }
  disconnect() {}
}
class GainN extends Node implements GainNodeLike {
  readonly gain = new Param(1);
}
class FilterN extends Node implements BiquadFilterNodeLike {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new Param();
  readonly Q = new Param();
}
class Source extends Node implements OscillatorNodeLike, AudioBufferSourceNodeLike {
  starts: (number | undefined)[] = [];
  stop() {}
  start(when?: number) { this.starts.push(when); }
  buffer: AudioBufferLike | null = null;
  type: OscillatorType = 'sine';
  readonly frequency = new Param(440);
  readonly detune = new Param(0);
}

class Ctx implements AudioContextLike {
  static instances: Ctx[] = [];
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'suspended';
  destination = new Node();
  sources: Source[] = [];
  calls: string[] = [];
  constructor() { Ctx.instances.push(this); }
  createGain() { return new GainN(); }
  createOscillator() { const s = new Source(); this.sources.push(s); return s; }
  createBiquadFilter() { return new FilterN(); }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { length, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() { const s = new Source(); this.sources.push(s); return s; }
  async resume() { this.calls.push('resume'); this.state = 'running'; }
  async suspend() { this.calls.push('suspend'); this.state = 'suspended'; }
  async close() { this.calls.push('close'); this.state = 'closed'; }
}
const asScope = (c: AudioContextConstructor): AudioGlobalScope => ({ AudioContext: c });

beforeEach(() => { Ctx.instances = []; });

describe('AC-DUEL-013.1: unlock creates/resumes the context inside the gesture', () => {
  it('AC-DUEL-013.1: creates a context and resumes it synchronously, state running', async () => {
    const p = unlockAudio({ scope: asScope(Ctx) });
    // before any await: already created and resume called
    expect(Ctx.instances).toHaveLength(1);
    expect(Ctx.instances[0].calls).toEqual(['resume']);
    const r = await p;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.context.state).toBe('running');
  });

  it('AC-DUEL-013.1: resumes an existing suspended context instead of creating another', async () => {
    const ctx = new Ctx();
    const r = await unlockAudio({ scope: asScope(Ctx), context: ctx });
    expect(Ctx.instances).toHaveLength(1);
    expect(ctx.calls).toContain('resume');
    expect(r.ok).toBe(true);
  });

  it('AC-DUEL-013.1: replaces a closed context with a new running one', async () => {
    const ctx = new Ctx();
    ctx.state = 'closed';
    const r = await unlockAudio({ scope: asScope(Ctx), context: ctx });
    expect(Ctx.instances).toHaveLength(2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.context).not.toBe(ctx);
  });

  it('AC-DUEL-013.1: works with the prefixed webkitAudioContext', async () => {
    const r = await unlockAudio({ scope: { webkitAudioContext: Ctx } });
    expect(r.ok).toBe(true);
  });

  it('AC-DUEL-013.1: a context that stays suspended is not reported as running', async () => {
    class Stuck extends Ctx { async resume() { this.calls.push('resume'); } }
    const r = await unlockAudio({ scope: asScope(Stuck) });
    expect(r.ok).toBe(false);
  });

  it('AC-DUEL-013.1: a hanging or rejecting resume does not hang or throw', async () => {
    class Hang extends Ctx { resume() { return new Promise<void>(() => undefined); } }
    class Rej extends Ctx { resume() { return Promise.reject(new Error('NotAllowed')); } }
    await expect(unlockAudio({ scope: asScope(Hang), timeoutMs: 20 })).resolves.toMatchObject({ ok: false });
    await expect(unlockAudio({ scope: asScope(Rej) })).resolves.toMatchObject({ ok: false });
  });
});

describe('AC-DUEL-013.2: no Web Audio', () => {
  it('AC-DUEL-013.2: reports unsupported without throwing', async () => {
    expect(isWebAudioSupported({})).toBe(false);
    await expect(unlockAudio({ scope: {} })).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });

  it('AC-DUEL-013.2: a constructor that throws is also unsupported', async () => {
    class Boom extends Ctx { constructor() { super(); throw new Error("NotSupportedError"); } }
    await expect(unlockAudio({ scope: asScope(Boom) })).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('AC-DUEL-013.5: player note plays immediately', () => {
  function make() {
    const ctx = new Ctx();
    ctx.state = 'running';
    ctx.currentTime = 12.34;
    const audio = createGameAudio(ctx, { timer: { start: () => () => undefined } });
    return { ctx, audio };
  }

  it('AC-DUEL-013.5: each button starts a sound at currentTime, not at a beat', () => {
    const { ctx, audio } = make();
    for (const b of [0, 1, 2, 3] as const) {
      const before = ctx.sources.length;
      const t = audio.playPlayerNote(b);
      expect(t).toBeCloseTo(12.34, 6);
      const started = ctx.sources.slice(before).filter((s) => s.starts.length > 0);
      expect(started.length).toBeGreaterThan(0);
      for (const s of started) expect(s.starts[0]).toBe(12.34);
    }
  });

  it('AC-DUEL-013.5: the four buttons rise in pitch', () => {
    const { ctx, audio } = make();
    const freqs: number[] = [];
    for (const b of [0, 1, 2, 3] as const) {
      const before = ctx.sources.length;
      audio.playPlayerNote(b);
      const osc = ctx.sources.slice(before).find((s) => s.starts.length > 0);
      expect(osc).toBeDefined();
      freqs.push(osc?.frequency.value ?? 0);
    }
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b));
    expect(new Set(freqs).size).toBe(4);
  });

  it('AC-DUEL-013.5: follows the audio clock when it advances, and works rapid-fire', () => {
    const { ctx, audio } = make();
    ctx.currentTime = 50;
    expect(audio.playPlayerNote(1)).toBe(50);
    expect(() => { for (let i = 0; i < 50; i++) audio.playPlayerNote(2); }).not.toThrow();
  });

  it('suspend and close reach the context (used by T-010)', async () => {
    const { ctx, audio } = make();
    await audio.suspend();
    await audio.close();
    expect(ctx.calls).toEqual(['suspend', 'close']);
  });
});
