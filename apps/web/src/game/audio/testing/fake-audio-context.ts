/**
 * A recording fake of the Web Audio API for Jest, which has none. It implements the `*Like`
 * interfaces of `../types`: nodes remember their connections, params their automation, sources
 * their start and stop times. `currentTime` and `state` are plain fields a test sets directly.
 *
 * Test-only: production code never imports this file.
 */
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioGlobalScope,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
  ScheduledSourceLike,
} from '../types';
import type { SchedulerTimer } from '../scheduler';

export interface ParamEvent {
  readonly method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime';
  readonly value: number;
  readonly time: number;
}

export class FakeAudioParam implements AudioParamLike {
  readonly events: ParamEvent[] = [];

  constructor(public value: number) {}

  setValueAtTime(value: number, time: number): this {
    this.events.push({ method: 'setValueAtTime', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ method: 'linearRampToValueAtTime', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    if (value <= 0) throw new RangeError('exponential ramp target must be positive');
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time });
    return this;
  }
}

export class FakeAudioNode implements AudioNodeLike {
  readonly outputs: AudioNodeLike[] = [];

  connect(destination: AudioNodeLike): AudioNodeLike {
    this.outputs.push(destination);
    return destination;
  }

  disconnect(): void {
    this.outputs.length = 0;
  }
}

export class FakeGainNode extends FakeAudioNode implements GainNodeLike {
  readonly gain = new FakeAudioParam(1);
}

export class FakeBiquadFilterNode extends FakeAudioNode implements BiquadFilterNodeLike {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeAudioParam(350);
  readonly Q = new FakeAudioParam(1);
}

export class FakeScheduledSource extends FakeAudioNode implements ScheduledSourceLike {
  startTime: number | null = null;
  stopTime: number | null = null;
  /** Times `stop()` was called. */
  stopCalls = 0;

  start(when = 0): void {
    if (this.startTime !== null) throw new Error('InvalidStateError: start() called twice');
    this.startTime = when;
  }

  stop(when = 0): void {
    if (this.startTime === null) throw new Error('InvalidStateError: stop() before start()');
    this.stopCalls++;
    this.stopTime = when;
  }
}

export class FakeOscillatorNode extends FakeScheduledSource implements OscillatorNodeLike {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam(440);
  readonly detune = new FakeAudioParam(0);
}

export class FakeAudioBuffer implements AudioBufferLike {
  private readonly channels: Float32Array[];

  constructor(
    numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

export class FakeAudioBufferSourceNode
  extends FakeScheduledSource
  implements AudioBufferSourceNodeLike
{
  buffer: AudioBufferLike | null = null;
}

/** What `resume()` does: start running, reject, resolve but stay suspended, or never settle. */
export type ResumeBehaviour = 'run' | 'reject' | 'stay' | 'hang';

export class FakeAudioContext implements AudioContextLike {
  currentTime = 0;
  sampleRate = 48000;
  state: AudioContextState = 'suspended';
  readonly destination = new FakeAudioNode();
  /** Every node created, in order. */
  readonly nodes: FakeAudioNode[] = [];
  /** `resume`, `suspend` and `close` calls, in order. */
  readonly calls: ('resume' | 'suspend' | 'close')[] = [];
  resumeBehaviour: ResumeBehaviour = 'run';

  constructor(readonly options?: AudioContextOptions) {}

  createGain(): FakeGainNode {
    return this.track(new FakeGainNode());
  }

  createOscillator(): FakeOscillatorNode {
    return this.track(new FakeOscillatorNode());
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return this.track(new FakeBiquadFilterNode());
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource(): FakeAudioBufferSourceNode {
    return this.track(new FakeAudioBufferSourceNode());
  }

  resume(): Promise<void> {
    this.calls.push('resume');
    if (this.state === 'closed') return Promise.reject(new Error('InvalidStateError: closed'));
    switch (this.resumeBehaviour) {
      case 'run':
        this.state = 'running';
        return Promise.resolve();
      case 'reject':
        return Promise.reject(new Error('NotAllowedError'));
      case 'stay':
        return Promise.resolve();
      case 'hang':
        return new Promise<void>(() => undefined);
    }
  }

  suspend(): Promise<void> {
    this.calls.push('suspend');
    if (this.state === 'closed') return Promise.reject(new Error('InvalidStateError: closed'));
    this.state = 'suspended';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.calls.push('close');
    if (this.state === 'closed') return Promise.reject(new Error('InvalidStateError: closed'));
    this.state = 'closed';
    return Promise.resolve();
  }

  /** Oscillators created, in order. */
  oscillators(): FakeOscillatorNode[] {
    return this.nodes.filter((node): node is FakeOscillatorNode => node instanceof FakeOscillatorNode);
  }

  /** Oscillators and buffer sources created, in order. */
  sources(): FakeScheduledSource[] {
    return this.nodes.filter((node): node is FakeScheduledSource => node instanceof FakeScheduledSource);
  }

  /** Sources started, apart from silent one-frame buffers (the unlock primes output with one). */
  audibleSources(): FakeScheduledSource[] {
    return this.sources().filter(
      (node) =>
        node.startTime !== null &&
        !(node instanceof FakeAudioBufferSourceNode && node.buffer !== null && node.buffer.length <= 1),
    );
  }

  private track<T extends FakeAudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}

/** Whether `from` reaches `to` by following connections. */
export function isRoutedTo(from: AudioNodeLike, to: AudioNodeLike): boolean {
  const seen = new Set<AudioNodeLike>();
  const stack: AudioNodeLike[] = [from];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || seen.has(node)) continue;
    if (node === to) return true;
    seen.add(node);
    if (node instanceof FakeAudioNode) stack.push(...node.outputs);
  }
  return false;
}

/**
 * A global scope whose `AudioContext` (or `webkitAudioContext`) builds fakes and records them.
 * `setup` runs on every new context, for example to choose its resume behaviour.
 */
export function createFakeAudioScope(
  options: {
    readonly prefixed?: boolean;
    readonly setup?: (context: FakeAudioContext) => void;
    readonly throwOnCreate?: boolean;
  } = {},
): { scope: AudioGlobalScope; contexts: FakeAudioContext[] } {
  const contexts: FakeAudioContext[] = [];
  class RecordedAudioContext extends FakeAudioContext {
    constructor(contextOptions?: AudioContextOptions) {
      if (options.throwOnCreate) throw new Error('NotSupportedError');
      super(contextOptions);
      contexts.push(this);
      options.setup?.(this);
    }
  }
  const scope: AudioGlobalScope = options.prefixed
    ? { webkitAudioContext: RecordedAudioContext }
    : { AudioContext: RecordedAudioContext };
  return { scope, contexts };
}

/** A scheduler timer that only ticks when the test calls `fire()`. */
export function createManualTimer(): SchedulerTimer & {
  fire(): void;
  readonly active: boolean;
} {
  let tick: (() => void) | null = null;
  return {
    start(callback) {
      tick = callback;
      return () => {
        tick = null;
      };
    },
    fire() {
      tick?.();
    },
    get active() {
      return tick !== null;
    },
  };
}
