/**
 * @jest-environment jsdom
 */
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { cleanup, render, screen } from '@testing-library/react';
import type { PublicSettingsDto } from '@jazz-portfolio/shared';
import { getPublicSettings } from '@/lib/portfolio-data';
import GameLayout from './layout';
import GameTheme from './GameTheme';

/** Stands in for the error `notFound()` throws, which Next turns into its not-found page. */
const mockNotFoundError = new Error('NEXT_HTTP_ERROR_FALLBACK;404');

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw mockNotFoundError;
  }),
}));
jest.mock('@/lib/portfolio-data', () => ({ getPublicSettings: jest.fn() }));

const getPublicSettingsMock = jest.mocked(getPublicSettings);
const notFoundMock = jest.mocked(notFound);

function settings(isGameEnabled: boolean): PublicSettingsDto {
  return {
    isContactFormEnabled: true,
    isBlogEnabled: true,
    isGameEnabled,
    areCommentsEnabled: false,
    isCommentCaptchaEnabled: false,
  };
}

/** The layout as the router renders it: an async Server Component, awaited, then mounted. */
async function renderLayout() {
  const element = (await GameLayout({ children: <p>game</p> })) as ReactElement;
  return render(element);
}

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('/{locale}/game layout', () => {
  it('AC-DUEL-015.5: calls notFound() and renders no children while isGameEnabled is off', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(false));

    await expect(GameLayout({ children: <p>game</p> })).rejects.toBe(mockNotFoundError);

    expect(getPublicSettingsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.5: renders its children while isGameEnabled is on', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(true));

    await renderLayout();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByText('game')).toBeInTheDocument();
  });

  it('gives the skip link of the locale layout its target', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(true));

    await renderLayout();

    expect(document.getElementById('main-content')).toContainElement(screen.getByText('game'));
  });

  it('switches the page to the dark theme while the game is mounted', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(true));
    document.documentElement.setAttribute('data-theme', 'light-jazz');

    const { unmount } = await renderLayout();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    unmount();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light-jazz');
  });
});

describe('GameTheme', () => {
  it('sets the dark theme on mount and restores the saved theme on unmount', () => {
    document.documentElement.setAttribute('data-theme', 'light-jazz');

    const { container, unmount } = render(<GameTheme />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(container).toBeEmptyDOMElement();

    unmount();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light-jazz');
  });

  it('leaves no data-theme behind when the page had none', () => {
    const { unmount } = render(<GameTheme />);
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    unmount();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});
