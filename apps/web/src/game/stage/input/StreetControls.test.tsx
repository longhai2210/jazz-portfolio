/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installPointerEvent } from '../../ui/lanes/testing/pointer-event';
import StreetControls from './StreetControls';
import { walkDirection, type HeldSides } from './street-keys';

let restorePointerEvent: () => void = () => undefined;
let latest: HeldSides = { left: false, right: false };

beforeEach(() => {
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  restorePointerEvent();
  latest = { left: false, right: false };
});

function renderZones(props: { readonly showArrows?: boolean; readonly disabled?: boolean } = {}) {
  const view = render(
    <StreetControls
      onChange={(held) => {
        latest = held;
      }}
      showArrows={props.showArrows ?? true}
      disabled={props.disabled}
    />,
  );
  const half = (side: 'left' | 'right'): HTMLElement => {
    const element = screen.getByTestId('street-touch-zones').querySelector<HTMLElement>(
      `[data-side="${side}"]`,
    );
    if (element === null) throw new Error(`no ${side} half`);
    return element;
  };
  return { view, left: half('left'), right: half('right') };
}

describe('StreetControls', () => {
  it('AC-STAGE-003.1: holding the left half walks left and letting go stops', () => {
    const { left } = renderZones();
    fireEvent.pointerDown(left, { pointerId: 1, button: 0, pointerType: 'touch' });
    expect(walkDirection(latest)).toBe(-1);
    expect(left).toHaveAttribute('data-held', 'true');
    fireEvent.pointerUp(left, { pointerId: 1 });
    expect(walkDirection(latest)).toBe(0);
    expect(left).toHaveAttribute('data-held', 'false');
  });

  it('AC-STAGE-003.1: holding the right half walks right, and a cancelled touch stops', () => {
    const { right } = renderZones();
    fireEvent.pointerDown(right, { pointerId: 4, button: 0, pointerType: 'touch' });
    expect(walkDirection(latest)).toBe(1);
    fireEvent.pointerCancel(right, { pointerId: 4 });
    expect(walkDirection(latest)).toBe(0);
  });

  it('AC-STAGE-003.1: a finger on each half cancels out', () => {
    const { left, right } = renderZones();
    fireEvent.pointerDown(left, { pointerId: 1, button: 0, pointerType: 'touch' });
    fireEvent.pointerDown(right, { pointerId: 2, button: 0, pointerType: 'touch' });
    expect(walkDirection(latest)).toBe(0);
    fireEvent.pointerUp(right, { pointerId: 2 });
    expect(walkDirection(latest)).toBe(-1);
  });

  it('AC-STAGE-003.1: a finger keeps its half until it lifts, even when it ends elsewhere', () => {
    const { left, right } = renderZones();
    fireEvent.pointerDown(left, { pointerId: 7, button: 0, pointerType: 'touch' });
    // Captured: the up arrives at the half it started on, wherever the finger is.
    fireEvent.pointerUp(right, { pointerId: 9 });
    expect(walkDirection(latest)).toBe(-1);
    fireEvent.lostPointerCapture(left, { pointerId: 7 });
    expect(walkDirection(latest)).toBe(0);
  });

  it('works with a mouse too, but only its main button', () => {
    const { left } = renderZones({ showArrows: false });
    fireEvent.pointerDown(left, { pointerId: 1, button: 2, pointerType: 'mouse' });
    expect(walkDirection(latest)).toBe(0);
    fireEvent.pointerDown(left, { pointerId: 1, button: 0, pointerType: 'mouse' });
    expect(walkDirection(latest)).toBe(-1);
  });

  it('is hidden from assistive technology and draws the arrows only on a touch screen', () => {
    const { view } = renderZones({ showArrows: true });
    expect(screen.getByTestId('street-touch-zones')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('street-arrow-left')).toBeInTheDocument();
    expect(screen.getByTestId('street-arrow-right')).toBeInTheDocument();
    view.unmount();

    renderZones({ showArrows: false });
    expect(screen.queryByTestId('street-arrow-left')).not.toBeInTheDocument();
  });

  it('while disabled ignores presses, and disabling lets go', () => {
    const { left, view } = renderZones();
    fireEvent.pointerDown(left, { pointerId: 1, button: 0, pointerType: 'touch' });
    view.rerender(<StreetControls onChange={(held) => (latest = held)} showArrows disabled />);
    expect(walkDirection(latest)).toBe(0);
    fireEvent.pointerDown(left, { pointerId: 2, button: 0, pointerType: 'touch' });
    expect(walkDirection(latest)).toBe(0);
  });
});
