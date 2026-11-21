import { isWebGL2Supported, type ProbeCanvasLike, type WebGL2ContextLike } from './webgl';

/** A canvas whose `webgl2` context is `context`, recording the calls the probe makes. */
function fakeCanvas(context: WebGL2ContextLike | null | (() => never)) {
  const calls: string[] = [];
  const canvas: ProbeCanvasLike = {
    getContext(contextId) {
      calls.push(`getContext:${contextId}`);
      return typeof context === 'function' ? context() : context;
    },
  };
  return { canvas, calls };
}

/** A WebGL2 context with the `WEBGL_lose_context` extension, unless `withExtension` is false. */
function fakeContext(withExtension = true) {
  const calls: string[] = [];
  const context: WebGL2ContextLike = {
    getExtension(name) {
      calls.push(`getExtension:${name}`);
      return withExtension ? { loseContext: () => void calls.push('loseContext') } : null;
    },
  };
  return { context, calls };
}

describe('isWebGL2Supported', () => {
  it('is true when the canvas gives a webgl2 context, and releases that context straight away', () => {
    const gl = fakeContext();
    const { canvas, calls } = fakeCanvas(gl.context);

    expect(isWebGL2Supported({ createCanvas: () => canvas })).toBe(true);
    expect(calls).toEqual(['getContext:webgl2']);
    expect(gl.calls).toEqual(['getExtension:WEBGL_lose_context', 'loseContext']);
  });

  it('is still true when the context has no WEBGL_lose_context extension', () => {
    const gl = fakeContext(false);
    const { canvas } = fakeCanvas(gl.context);

    expect(isWebGL2Supported({ createCanvas: () => canvas })).toBe(true);
  });

  it('is still true when releasing the probe context throws', () => {
    const context: WebGL2ContextLike = {
      getExtension: () => ({
        loseContext: () => {
          throw new Error('context already lost');
        },
      }),
    };

    expect(isWebGL2Supported({ createCanvas: () => fakeCanvas(context).canvas })).toBe(true);
  });

  it('is false when the canvas gives no webgl2 context', () => {
    const { canvas, calls } = fakeCanvas(null);

    expect(isWebGL2Supported({ createCanvas: () => canvas })).toBe(false);
    expect(calls).toEqual(['getContext:webgl2']);
  });

  it('is false, without throwing, when getContext throws', () => {
    const { canvas } = fakeCanvas(() => {
      throw new Error('GPU process crashed');
    });

    expect(isWebGL2Supported({ createCanvas: () => canvas })).toBe(false);
  });

  it('is false, without throwing, when no canvas can be made', () => {
    expect(isWebGL2Supported({ createCanvas: () => null })).toBe(false);
    expect(
      isWebGL2Supported({
        createCanvas: () => {
          throw new Error('no DOM');
        },
      }),
    ).toBe(false);
  });

  it('is false on the server, where there is no document', () => {
    expect(typeof document).toBe('undefined');
    expect(isWebGL2Supported()).toBe(false);
  });
});
