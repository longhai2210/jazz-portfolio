/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { setFakeLocale } from '../testing/intl';
import DoorPrompt from './DoorPrompt';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('../testing/intl')>('../testing/intl').nextIntlMock,
);

afterEach(() => {
  cleanup();
  setFakeLocale('en');
});

describe('DoorPrompt', () => {
  it('AC-STAGE-003.3: away from the door shows nothing', () => {
    render(<DoorPrompt near={false} onEnter={jest.fn()} showKeys />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('AC-STAGE-003.3: by the door shows Enter the club with its keys, and a tap enters', () => {
    const onEnter = jest.fn();
    render(<DoorPrompt near onEnter={onEnter} showKeys />);
    const button = screen.getByRole('button', { name: 'Enter the club' });
    expect(within(button).getByText('E or Enter')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('You are at the club door.');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(button);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('AC-STAGE-003.3: on a touch screen the key label is left out', () => {
    render(<DoorPrompt near onEnter={jest.fn()} showKeys={false} />);
    expect(screen.getByRole('button', { name: 'Enter the club' })).toBeInTheDocument();
    expect(screen.queryByText('E or Enter')).not.toBeInTheDocument();
  });

  it('speaks the language in use', () => {
    setFakeLocale('vi');
    render(<DoorPrompt near onEnter={jest.fn()} showKeys />);
    expect(screen.getByRole('button', { name: 'Vào club' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Bạn đang ở cửa club.');
  });
});
