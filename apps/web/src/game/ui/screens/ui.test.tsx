/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { setFakeLocale } from './testing/intl';
import { navigations } from './testing/link';
import { HomeLink, LeaveGameContext, type HomeLinkVariant } from './ui';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./testing/link')>('./testing/link'),
);

/** Renders the way home inside a game whose `leave` (closing the audio) is a spy. */
function renderHomeLink(variant: HomeLinkVariant = 'bar'): { leave: jest.Mock; link: HTMLElement } {
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

describe('HomeLink', () => {
  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])(
    'AC-DUEL-013.13: a %s-click opens the portfolio elsewhere and keeps the audio of this tab',
    (_key, modifiers) => {
      const { leave, link } = renderHomeLink();

      fireEvent.click(link, { button: 0, ...modifiers });

      expect(leave).not.toHaveBeenCalled();
    },
  );

  it('AC-DUEL-013.13: a middle click keeps the audio of this tab, as an auxclick or as a click', () => {
    const { leave, link } = renderHomeLink();

    // Browsers send `auxclick` for the middle button; older ones sent `click` with button 1.
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    fireEvent.click(link, { button: 1 });

    expect(leave).not.toHaveBeenCalled();
  });

  it('AC-DUEL-013.13: every variant keeps the audio on a Ctrl-click', () => {
    const variants: readonly HomeLinkVariant[] = ['bar', 'icon', 'primary', 'secondary', 'ghost'];
    for (const variant of variants) {
      const { leave, link } = renderHomeLink(variant);
      fireEvent.click(link, { button: 0, ctrlKey: true });
      expect(leave).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('AC-DUEL-013.13: a plain left click still releases the audio and leaves for the portfolio home', () => {
    const { leave, link } = renderHomeLink();

    fireEvent.click(link, { button: 0 });

    expect(leave).toHaveBeenCalledTimes(1);
    expect(navigations).toEqual(['/en']);
  });

  it('AC-DUEL-013.13: a plain left click leads home in the language in use', () => {
    setFakeLocale('vi');
    const leave = jest.fn();
    render(
      <LeaveGameContext.Provider value={leave}>
        <HomeLink />
      </LeaveGameContext.Provider>,
    );
    const link = screen.getByRole('link', { name: 'Về trang chủ' });

    expect(link).toHaveAttribute('href', '/vi');
    fireEvent.click(link);

    expect(leave).toHaveBeenCalledTimes(1);
    expect(navigations).toEqual(['/vi']);
  });
});
