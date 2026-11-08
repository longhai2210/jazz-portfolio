/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { Tap } from '../../core/types';
import { setFakeLocale } from '../lanes/testing/intl';
import { installPointerEvent } from '../lanes/testing/pointer-event';
import TouchPads from './TouchPads';

jest.mock(
  'next-intl',
  () =>
    jest.requireActual<typeof import('../lanes/testing/intl')>('../lanes/testing/intl')
      .nextIntlMock,
);

const PAD_NAMES = [
  'Button D, lowest note',
  'Button F, second note',
  'Button J, third note',
  'Button K, highest note',
];

function setup(props: { disabled?: boolean; held?: readonly (0 | 1 | 2 | 3)[] } = {}) {
  const clock = { currentTime: 3.25 };
  const taps: Tap[] = [];
  const view = render(<TouchPads clock={clock} onTap={(tap) => taps.push(tap)} {...props} />);
  return { clock, taps, ...view };
}

let removePointerEvent: () => void = () => undefined;

beforeAll(() => {
  removePointerEvent = installPointerEvent();
});

afterAll(() => {
  removePointerEvent();
});

afterEach(() => {
  setFakeLocale('en');
});

describe('TouchPads', () => {
  it('AC-DUEL-013.4: a touch on each of the 4 zones is one tap of its button, timed on the audio clock', () => {
    const { clock, taps } = setup();
    const pads = screen.getAllByRole('button');
    expect(pads.map((pad) => pad.getAttribute('aria-label'))).toEqual(PAD_NAMES);

    PAD_NAMES.forEach((name, index) => {
      clock.currentTime = 4 + index;
      fireEvent.pointerDown(screen.getByRole('button', { name }), { pointerType: 'touch' });
    });

    expect(taps).toEqual([
      { button: 0, time: 4 },
      { button: 1, time: 5 },
      { button: 2, time: 6 },
      { button: 3, time: 7 },
    ]);
  });

  it('AC-DUEL-013.4: the tap is the pointer going down; lifting it or the click that follows adds nothing', () => {
    const { taps } = setup();
    const pad = screen.getByRole('button', { name: 'Button J, third note' });

    fireEvent.pointerDown(pad, { pointerType: 'touch' });
    fireEvent.pointerUp(pad, { pointerType: 'touch' });
    fireEvent.click(pad);
    expect(taps).toEqual([{ button: 2, time: 3.25 }]);

    fireEvent.click(pad);
    expect(taps).toHaveLength(1);
  });

  it('AC-DUEL-013.4: two fingers on two zones at once give one tap each', () => {
    const { taps } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: PAD_NAMES[0] }), { pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole('button', { name: PAD_NAMES[3] }), { pointerId: 2 });
    expect(taps.map((tap) => tap.button)).toEqual([0, 3]);
  });

  it('shows a zone pressed while touched, or while its key is held', () => {
    const { rerender, clock } = setup();
    const pad = screen.getByRole('button', { name: PAD_NAMES[1] });
    expect(pad).toHaveAttribute('data-pressed', 'false');

    fireEvent.pointerDown(pad);
    expect(pad).toHaveAttribute('data-pressed', 'true');
    expect(pad.className).toContain('border-jazz-gold');
    expect(pad.className).toContain('bg-jazz-blue');
    expect(pad.style.transition).toBe('none');

    fireEvent.pointerCancel(pad);
    expect(pad).toHaveAttribute('data-pressed', 'false');

    fireEvent.pointerDown(pad);
    fireEvent.pointerLeave(pad);
    expect(pad).toHaveAttribute('data-pressed', 'false');

    rerender(<TouchPads clock={clock} onTap={() => undefined} held={[3]} />);
    expect(screen.getByRole('button', { name: PAD_NAMES[3] })).toHaveAttribute(
      'data-pressed',
      'true',
    );
  });

  it('ignores a secondary mouse button', () => {
    const { taps } = setup();
    fireEvent.pointerDown(screen.getByRole('button', { name: PAD_NAMES[0] }), {
      pointerType: 'mouse',
      button: 2,
    });
    expect(taps).toHaveLength(0);
  });

  it('does nothing outside a match', () => {
    const { taps } = setup({ disabled: true });
    for (const name of PAD_NAMES) {
      const pad = screen.getByRole('button', { name });
      expect(pad).toBeDisabled();
      fireEvent.pointerDown(pad);
      expect(pad).toHaveAttribute('data-pressed', 'false');
    }
    expect(taps).toHaveLength(0);
  });

  it('names the zones in the player language', () => {
    setFakeLocale('vi');
    setup();
    expect(screen.getByRole('button', { name: 'Nút D, nốt thấp nhất' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nút K, nốt cao nhất' })).toBeInTheDocument();
  });
});
