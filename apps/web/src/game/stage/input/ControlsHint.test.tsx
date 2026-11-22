/**
 * @jest-environment jsdom
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import ControlsHint, { CONTROLS_HINT_MS } from './ControlsHint';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('../testing/intl')>('../testing/intl').nextIntlMock,
);

const HINT = 'Walk: A and D or the arrow keys. Touch the left or right half of the screen.';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('ControlsHint', () => {
  it('shows the controls, then hides them after 6 s of standing still', () => {
    render(<ControlsHint walked={false} />);
    expect(screen.getByText(HINT)).toBeInTheDocument();
    expect(CONTROLS_HINT_MS).toBe(6000);

    act(() => {
      jest.advanceTimersByTime(CONTROLS_HINT_MS - 1);
    });
    expect(screen.getByText(HINT)).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it('hides the controls as soon as the player walks', () => {
    const view = render(<ControlsHint walked={false} />);
    view.rerender(<ControlsHint walked />);
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
