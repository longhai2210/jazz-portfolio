/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setFakeLocale } from './testing/intl';
import { navigations } from './testing/link';
import { HomeLink, LeaveGameContext } from './ui';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./testing/link')>('./testing/link'),
);

function setup(variant: 'bar' | 'icon' | 'primary' = 'bar') {
  const leave = jest.fn();
  render(
    <LeaveGameContext.Provider value={leave}>
      <HomeLink variant={variant} />
    </LeaveGameContext.Provider>,
  );
  return { leave, link: screen.getByRole('link', { name: 'Back to portfolio' }) };
}

afterEach(() => {
  cleanup();
  navigations.length = 0;
  setFakeLocale('en');
});

describe('T-015 back-to-portfolio link', () => {
  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['ctrl+shift', { ctrlKey: true, shiftKey: true }],
    ['middle button', { button: 1 }],
  ])('AC-DUEL-013.13: %s click does not close the audio', (_n, init) => {
    for (const variant of ['bar', 'icon', 'primary'] as const) {
      const { leave, link } = setup(variant);
      fireEvent.click(link, init);
      expect(leave).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('AC-DUEL-013.13: a middle click sent as auxclick does not close the audio', () => {
    const { leave, link } = setup();
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(leave).not.toHaveBeenCalled();
  });

  it('AC-DUEL-013.13: the link still points at the locale home so a new tab lands there', () => {
    const { link } = setup();
    expect(link).toHaveAttribute('href', '/en');
  });

  it('AC-DUEL-014.3: a plain left click closes the audio once and leaves', () => {
    const { leave, link } = setup();
    fireEvent.click(link, { button: 0 });
    expect(leave).toHaveBeenCalledTimes(1);
    expect(navigations).toEqual(['/en']);
  });
});
