/**
 * A `window.matchMedia` stub for jsdom, which has none. Test-only.
 *
 *   const restore = stubReducedMotion(true);
 *   ...
 *   restore();
 */

/** Makes `(prefers-reduced-motion: reduce)` match or not; returns a function that removes the stub. */
export function stubReducedMotion(reduce: boolean): () => void {
  function matchMedia(query: string): MediaQueryList {
    return {
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
  return () => {
    Reflect.deleteProperty(window, 'matchMedia');
  };
}
