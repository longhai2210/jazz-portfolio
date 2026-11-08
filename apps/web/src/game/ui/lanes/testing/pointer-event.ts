/**
 * jsdom has no `PointerEvent`, so `fireEvent.pointerDown` sends a bare `Event` without `button`
 * or `pointerType`. This installs a minimal one on top of `MouseEvent`. Test-only, jsdom only.
 *
 *   const restore = installPointerEvent();
 *   ...
 *   restore();
 */

/** Installs the stand-in when jsdom has none; returns a function that removes it again. */
export function installPointerEvent(): () => void {
  if ('PointerEvent' in window) return () => undefined;

  class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: TestPointerEvent,
  });
  return () => {
    Reflect.deleteProperty(window, 'PointerEvent');
  };
}
