/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import type { Tap } from '../../core/types';
import { useKeyboardTaps } from './use-keyboard-taps';

function setup(enabled = true) {
  const clock = { currentTime: 1.5 };
  const taps: Tap[] = [];
  const hook = renderHook(
    ({ on }: { on: boolean }) =>
      useKeyboardTaps({ clock, onTap: (tap) => taps.push(tap), enabled: on }),
    { initialProps: { on: enabled } },
  );
  return { clock, taps, hook };
}

function press(init: KeyboardEventInit, target: Element | Window = window): boolean {
  let notPrevented = true;
  act(() => {
    notPrevented = fireEvent.keyDown(target, init);
  });
  return notPrevented;
}

function release(init: KeyboardEventInit) {
  act(() => {
    fireEvent.keyUp(window, init);
  });
}

describe('useKeyboardTaps', () => {
  it('AC-DUEL-013.3: each press of D, F, J or K is one tap of its button, timed on the audio clock', () => {
    const { clock, taps } = setup();
    const keys = [
      { code: 'KeyD', key: 'd' },
      { code: 'KeyF', key: 'f' },
      { code: 'KeyJ', key: 'j' },
      { code: 'KeyK', key: 'k' },
    ];
    keys.forEach((key, index) => {
      clock.currentTime = 2 + index * 0.25;
      press(key);
      release(key);
    });

    expect(taps).toEqual([
      { button: 0, time: 2 },
      { button: 1, time: 2.25 },
      { button: 2, time: 2.5 },
      { button: 3, time: 2.75 },
    ]);
  });

  it('AC-DUEL-013.3: holding a key gives one tap; its repeat events add none until it is pressed again', () => {
    const { taps, hook } = setup();
    press({ code: 'KeyJ', key: 'j' });
    expect(hook.result.current).toEqual([2]);
    press({ code: 'KeyJ', key: 'j', repeat: true });
    press({ code: 'KeyJ', key: 'j', repeat: true });
    press({ code: 'KeyJ', key: 'j', repeat: true });
    expect(taps.map((tap) => tap.button)).toEqual([2]);

    release({ code: 'KeyJ', key: 'j' });
    expect(hook.result.current).toEqual([]);
    press({ code: 'KeyJ', key: 'j' });
    expect(taps.map((tap) => tap.button)).toEqual([2, 2]);
  });

  it('AC-DUEL-013.3: keys are matched by position, so Caps Lock, other layouts and input methods still play', () => {
    const { taps } = setup();
    press({ code: 'KeyD', key: 'D' });
    press({ code: 'KeyF', key: 'Process' });
    // No code reported (some virtual keyboards): the key name decides.
    press({ code: '', key: 'K' });
    expect(taps.map((tap) => tap.button)).toEqual([0, 1, 3]);
  });

  it('AC-DUEL-013.3: other keys, shortcuts and typing in a field are no taps', () => {
    const { taps } = setup();
    press({ code: 'KeyA', key: 'a' });
    press({ code: 'Space', key: ' ' });
    press({ code: 'Escape', key: 'Escape' });
    // Ctrl+F still opens the browser's find bar.
    expect(press({ code: 'KeyF', key: 'f', ctrlKey: true })).toBe(true);
    press({ code: 'KeyD', key: 'd', metaKey: true });
    press({ code: 'KeyD', key: 'd', altKey: true });
    press({ code: 'KeyD', key: 'd', isComposing: true });

    const { getByRole } = render(<input aria-label="name" />);
    press({ code: 'KeyK', key: 'k' }, getByRole('textbox'));
    expect(taps).toHaveLength(0);

    // A game key does not reach the page (find-as-you-type), held or not.
    expect(press({ code: 'KeyD', key: 'd' })).toBe(false);
    expect(press({ code: 'KeyD', key: 'd', repeat: true })).toBe(false);
    expect(taps).toHaveLength(1);
  });

  it('listens only while enabled, and stops when unmounted', () => {
    const { taps, hook } = setup(false);
    press({ code: 'KeyD', key: 'd' });
    expect(taps).toHaveLength(0);

    hook.rerender({ on: true });
    press({ code: 'KeyD', key: 'd' });
    expect(taps).toHaveLength(1);
    expect(hook.result.current).toEqual([0]);

    hook.rerender({ on: false });
    expect(hook.result.current).toEqual([]);
    press({ code: 'KeyF', key: 'f' });
    expect(taps).toHaveLength(1);

    hook.rerender({ on: true });
    hook.unmount();
    press({ code: 'KeyF', key: 'f' });
    expect(taps).toHaveLength(1);
  });

  it('forgets held keys when the window loses focus', () => {
    const { hook } = setup();
    press({ code: 'KeyD', key: 'd' });
    press({ code: 'KeyK', key: 'k' });
    expect(hook.result.current).toEqual([0, 3]);
    act(() => {
      fireEvent.blur(window);
    });
    expect(hook.result.current).toEqual([]);
  });

  it('times each tap on the clock passed at the latest render', () => {
    const taps: Tap[] = [];
    const first = { currentTime: 1 };
    const second = { currentTime: 8 };
    const hook = renderHook(
      ({ clock }: { clock: { currentTime: number } }) =>
        useKeyboardTaps({ clock, onTap: (tap) => taps.push(tap) }),
      { initialProps: { clock: first } },
    );
    press({ code: 'KeyD', key: 'd' });
    hook.rerender({ clock: second });
    press({ code: 'KeyF', key: 'f' });
    expect(taps).toEqual([
      { button: 0, time: 1 },
      { button: 1, time: 8 },
    ]);
  });
});
