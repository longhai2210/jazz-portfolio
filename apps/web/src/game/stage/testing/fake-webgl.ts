/**
 * WebGL stand-ins for jsdom, which draws nothing: a canvas `getContext` that can or cannot give a
 * `webgl2` context, a recording context with `WEBGL_lose_context`, and a fake renderer that drives
 * the street stage frame by frame. Test-only.
 */
import type { Camera, Object3D } from 'three';
import type { StageContextLike, StageRendererLike } from '../scenes/StreetScene';
import type { LoseContextExtensionLike } from '../webgl';

/** A WebGL context that only knows how to be lost, and counts `loseContext()` calls. */
export class FakeWebGLContext implements StageContextLike {
  lost = false;
  loseContextCalls = 0;
  private readonly loseContextExtension: LoseContextExtensionLike = {
    loseContext: () => {
      this.loseContextCalls += 1;
      this.lost = true;
    },
  };

  isContextLost(): boolean {
    return this.lost;
  }

  getExtension(name: 'WEBGL_lose_context'): LoseContextExtensionLike | null {
    return name === 'WEBGL_lose_context' ? this.loseContextExtension : null;
  }
}

export interface InstalledWebGL2 {
  /** Every `webgl2` context handed out, in order. */
  readonly contexts: readonly FakeWebGLContext[];
  /** Every context id asked for, in order. */
  readonly requests: readonly string[];
  readonly restore: () => void;
}

/**
 * Makes `canvas.getContext('webgl2')` give a fake context (`supported`) or null; any other
 * context id gives null. `restore()` puts jsdom's own method back.
 */
export function installWebGL2(supported: boolean): InstalledWebGL2 {
  const contexts: FakeWebGLContext[] = [];
  const requests: string[] = [];
  const original = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value(contextId: string) {
      requests.push(contextId);
      if (contextId !== 'webgl2' || !supported) return null;
      const context = new FakeWebGLContext();
      contexts.push(context);
      return context;
    },
  });
  return {
    contexts,
    requests,
    restore: () => {
      if (original) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', original);
    },
  };
}

/**
 * A renderer for `createStreetStage` that draws nothing and records what it was asked: the render
 * loop it holds, frames rendered, size, disposal. `tick(ms)` runs the loop as an animation frame.
 */
export class FakeRenderer implements StageRendererLike {
  readonly context = new FakeWebGLContext();
  loop: ((time: number) => void) | null = null;
  /** Every `setAnimationLoop` call: a loop started, or null to stop it. */
  readonly loopCalls: ('start' | 'stop')[] = [];
  renders = 0;
  disposeCalls = 0;
  lastScene: Object3D | null = null;
  lastCamera: Camera | null = null;
  pixelRatio = 1;
  size: { width: number; height: number } | null = null;

  setAnimationLoop(callback: ((time: number) => void) | null): void {
    this.loop = callback;
    this.loopCalls.push(callback === null ? 'stop' : 'start');
  }

  render(scene: Object3D, camera: Camera): void {
    this.renders += 1;
    this.lastScene = scene;
    this.lastCamera = camera;
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
  }

  setSize(width: number, height: number): void {
    this.size = { width, height };
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  getContext(): FakeWebGLContext {
    return this.context;
  }

  /** Runs the render loop once, at `timeMs`, if one is set. Returns whether it ran. */
  tick(timeMs: number): boolean {
    if (this.loop === null) return false;
    this.loop(timeMs);
    return true;
  }
}
