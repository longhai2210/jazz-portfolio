/**
 * @jest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { setFakeLocale } from './testing/intl';
import { navigations } from './testing/link';
import {
  Chip,
  HomeLink,
  LeaveGameContext,
  ScreenShell,
  StageLayoutContext,
  TopBar,
  type HomeLinkVariant,
  type StageLayout,
} from './ui';

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

describe('the shared pieces inside the 3D stage (game-stage design.md sections 2 and 4)', () => {
  const HEADER_CLASS =
    'flex items-center justify-between gap-3 border-b border-jazz-slate px-4 py-2.5 text-[13px]';

  function stage(layout: Partial<StageLayout>): StageLayout {
    return {
      backdrop: false,
      note: null,
      sceneWindow: null,
      setSceneWindow: () => undefined,
      ...layout,
    };
  }

  function renderIn(layout: StageLayout | null, children: ReactNode) {
    return render(<StageLayoutContext.Provider value={layout}>{children}</StageLayoutContext.Provider>);
  }

  function header(): HTMLElement {
    const found = document.querySelector('header');
    if (found === null) throw new Error('no top bar');
    return found;
  }

  it('outside the stage the top bar, panel and chips are drawn as in game-duel', () => {
    renderIn(
      null,
      <ScreenShell labelledBy="title">
        <Chip>Session</Chip>
      </ScreenShell>,
    );
    expect(header()).toHaveClass(HEADER_CLASS, { exact: true });
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
    expect(document.querySelector('section')).toHaveClass('bg-jazz-dark');
    expect(screen.getByText('Session')).not.toHaveClass('bg-jazz-dark');
  });

  it('a stage note follows the top bar in the page flow, on a plain bar when there is no scene', () => {
    renderIn(stage({ note: <p data-testid="note">No stage here.</p> }), <TopBar />);
    const slot = screen.getByTestId('duel-note');
    expect(slot.previousElementSibling).toBe(header());
    expect(slot).toContainElement(screen.getByTestId('note'));
    expect(header()).toHaveClass(HEADER_CLASS, { exact: true });
  });

  it('over a scene the top bar sits on a solid strip, the panel is 90% solid and outline chips are filled', () => {
    renderIn(
      stage({ backdrop: true }),
      <ScreenShell labelledBy="title">
        <Chip>Session</Chip>
        <Chip on>Echo</Chip>
      </ScreenShell>,
    );
    expect(header()).toHaveClass('bg-jazz-dark/90', 'border-jazz-slate');
    expect(document.querySelector('section')).toHaveClass('bg-jazz-dark/90');
    expect(document.querySelector('section')).not.toHaveClass('bg-jazz-dark');
    expect(screen.getByText('Session')).toHaveClass('bg-jazz-dark');
    expect(screen.getByText('Echo')).toHaveClass('bg-jazz-gold');
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
  });
});
