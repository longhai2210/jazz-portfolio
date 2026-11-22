/**
 * @jest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type HeldSides } from './street-keys';
import { useStreetKeys, type StreetKeysOptions } from './use-street-keys';

let held: HeldSides = { left: false, right: false };

function Probe(props: StreetKeysOptions & { readonly withButton?: boolean }) {
  held = useStreetKeys(props);
  return props.withButton ? <button type="button">Somewhere</button> : null;
}

function renderKeys(options: Partial<StreetKeysOptions> & { readonly withButton?: boolean } = {}) {
  const onEnter = jest.fn();
  const props = { enabled: true, canEnter: false, onEnter, ...options };
  const view = render(<Probe {...props} />);
  return {
    onEnter,
    rerender: (next: Partial<StreetKeysOptions>) => view.rerender(<Probe {...props} {...next} />),
  };
}

const D = { code: 'KeyD', key: 'd' };
const A = { code: 'KeyA', key: 'a' };
const LEFT = { code: 'ArrowLeft', key: 'ArrowLeft' };
const E = { code: 'KeyE', key: 'e' };
const ENTER = { code: 'Enter', key: 'Enter' };

afterEach(() => {
  cleanup();
  held = { left: false, right: false };
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useStreetKeys', () => {
  it('AC-STAGE-003.1: a held key walks until it is let go', () => {
    renderKeys();
    fireEvent.keyDown(window, D);
    expect(held).toEqual({ left: false, right: true });
    // A held key repeats key-downs: still one held key.
    fireEvent.keyDown(window, { ...D, repeat: true });
    fireEvent.keyUp(window, D);
    expect(held).toEqual({ left: false, right: false });
  });

  it('AC-STAGE-003.1: A and the left arrow both held need both let go', () => {
    renderKeys();
    fireEvent.keyDown(window, A);
    fireEvent.keyDown(window, LEFT);
    fireEvent.keyUp(window, A);
    expect(held.left).toBe(true);
    fireEvent.keyUp(window, LEFT);
    expect(held.left).toBe(false);
  });

  it('AC-STAGE-003.1: ignores shortcuts with Ctrl, Alt or Meta and typing in a field', () => {
    renderKeys();
    fireEvent.keyDown(window, { ...D, ctrlKey: true });
    fireEvent.keyDown(window, { ...A, metaKey: true });
    fireEvent.keyDown(window, { ...D, altKey: true });
    expect(held).toEqual({ left: false, right: false });

    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, D);
    expect(held.right).toBe(false);
    field.remove();
  });

  it('AC-STAGE-003.1: losing focus or hiding the tab lets go of every key', () => {
    renderKeys();
    fireEvent.keyDown(window, D);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(held.right).toBe(false);

    fireEvent.keyDown(window, A);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(held.left).toBe(false);
  });

  it('AC-STAGE-003.1: while disabled no key walks, and disabling lets go of held keys', () => {
    const { rerender } = renderKeys();
    fireEvent.keyDown(window, D);
    rerender({ enabled: false });
    expect(held.right).toBe(false);
    fireEvent.keyDown(window, A);
    expect(held.left).toBe(false);
  });

  it('AC-STAGE-003.3: E and Enter enter the club only by the door, once per press', () => {
    const { onEnter, rerender } = renderKeys({ canEnter: false });
    fireEvent.keyDown(window, E);
    fireEvent.keyDown(window, ENTER);
    expect(onEnter).not.toHaveBeenCalled();

    rerender({ canEnter: true });
    fireEvent.keyDown(window, E);
    fireEvent.keyDown(window, { ...E, repeat: true });
    expect(onEnter).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, ENTER);
    expect(onEnter).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { ...E, ctrlKey: true });
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it('AC-STAGE-003.3: Enter on a focused button is the button\'s; E still enters', () => {
    const { onEnter } = renderKeys({ canEnter: true, withButton: true });
    const button = screen.getByRole('button', { name: 'Somewhere' });
    fireEvent.keyDown(button, ENTER);
    expect(onEnter).not.toHaveBeenCalled();
    fireEvent.keyDown(button, E);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
