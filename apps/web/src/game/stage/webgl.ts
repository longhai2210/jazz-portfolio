/**
 * WebGL2 detection. The 3D stage needs a `webgl2` context; without one the game runs the
 * grey-box duel and never loads the 3D modules, so this file must stay free of three.js.
 *
 * Nothing here touches `document` at import time, so the module is safe to import on the server,
 * where it reports no support.
 */

/** The parts of the `WEBGL_lose_context` extension the probe uses. */
export interface LoseContextExtensionLike {
  loseContext(): void;
}

/** The parts of a WebGL2 context the probe uses. */
export interface WebGL2ContextLike {
  getExtension(name: 'WEBGL_lose_context'): LoseContextExtensionLike | null;
}

/** The parts of a canvas the probe uses. */
export interface ProbeCanvasLike {
  getContext(contextId: 'webgl2'): WebGL2ContextLike | null;
}

export interface WebGL2ProbeOptions {
  /** Makes the throwaway canvas. Defaults to a `<canvas>` from `document`, or null without one. */
  readonly createCanvas?: () => ProbeCanvasLike | null;
}

function createDocumentCanvas(): ProbeCanvasLike | null {
  return typeof document === 'undefined' ? null : document.createElement('canvas');
}

/**
 * Whether the browser can create a `webgl2` context. Never throws: no canvas, a null context or
 * an exception all mean no. A context it did create is released straight away through
 * `WEBGL_lose_context`, because browsers cap how many live contexts a page may hold.
 */
export function isWebGL2Supported(options: WebGL2ProbeOptions = {}): boolean {
  const { createCanvas = createDocumentCanvas } = options;
  let context: WebGL2ContextLike | null;
  try {
    const canvas = createCanvas();
    context = canvas ? canvas.getContext('webgl2') : null;
  } catch {
    return false;
  }
  if (!context) return false;

  try {
    context.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // Releasing the probe context is best effort; the context itself was created.
  }
  return true;
}
