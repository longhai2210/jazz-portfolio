/**
 * @jest-environment jsdom
 */
import type { ReactElement } from 'react';
import { notFound } from 'next/navigation';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PublicSettingsDto } from '@jazz-portfolio/shared';
import { setFakeLocale } from '@/game/ui/screens/testing/intl';
import { navigations } from '@/game/ui/screens/testing/link';
import { getPublicSettings } from '@/lib/portfolio-data';
import GameError from './error';
import GameLoading from './loading';
import GamePage, { metadata } from './page';

/** Stands in for the error `notFound()` throws, which Next turns into its not-found page. */
const mockNotFoundError = new Error('NEXT_HTTP_ERROR_FALLBACK;404');

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw mockNotFoundError;
  }),
}));
jest.mock('@/lib/portfolio-data', () => ({ getPublicSettings: jest.fn() }));
jest.mock('@/game/ui/DuelGame', () => ({
  __esModule: true,
  default: function FakeDuelGame() {
    return <div data-testid="duel-game" />;
  },
}));
jest.mock('next/link', () =>
  jest.requireActual<typeof import('@/game/ui/screens/testing/link')>(
    '@/game/ui/screens/testing/link',
  ),
);
/**
 * The game's fake `game` messages, plus the one `common` key the loading screen uses (copied from
 * `messages/en.json` and `vi.json`). A key missing here throws.
 */
jest.mock('next-intl', () => {
  const intl = jest.requireActual<typeof import('@/game/ui/screens/testing/intl')>(
    '@/game/ui/screens/testing/intl',
  );
  const common: Readonly<Record<'en' | 'vi', Readonly<Record<string, string>>>> = {
    en: { loading: 'Loading...' },
    vi: { loading: 'Đang tải...' },
  };
  return {
    useLocale: intl.nextIntlMock.useLocale,
    useTranslations:
      (namespace: string) =>
      (key: string, values?: Readonly<Record<string, string | number>>): string => {
        if (namespace !== 'common') return intl.translate(namespace, key, values);
        const message = common[intl.nextIntlMock.useLocale()][key];
        if (message === undefined) throw new Error(`common.${key} has no fake message`);
        return message;
      },
  };
});

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

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  navigations.length = 0;
  setFakeLocale('en');
});

describe('/{locale}/game page', () => {
  it('AC-DUEL-015.5: calls notFound() and renders no game while isGameEnabled is off', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(false));

    await expect(GamePage()).rejects.toBe(mockNotFoundError);

    expect(getPublicSettingsMock).toHaveBeenCalledTimes(1);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.5: calls notFound() when the settings fallback has the game off', async () => {
    // getPublicSettings falls back to isGameEnabled false when the API is down (AC-DUEL-015.4).
    getPublicSettingsMock.mockResolvedValue({ ...settings(false), isBlogEnabled: false });

    await expect(GamePage()).rejects.toBe(mockNotFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.6: sets robots to noindex, nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('AC-DUEL-015.6: renders the duel, with no inputs, while isGameEnabled is on', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(true));

    const page = (await GamePage()) as ReactElement<Record<string, unknown>>;
    render(page);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('duel-game')).toBeInTheDocument();
    // The route passes nothing, so the game asks for difficulty and calibration itself.
    expect(page.props).toEqual({});
  });
});

describe('/{locale}/game loading', () => {
  it('shows a busy status and the way back to the portfolio', () => {
    render(<GameLoading />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading...');
    expect(screen.getByRole('link', { name: /Back to portfolio/ })).toHaveAttribute('href', '/en');
  });

  it('uses the language in use', () => {
    setFakeLocale('vi');
    render(<GameLoading />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải...');
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/vi');
  });
});

describe('/{locale}/game error', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('shows an alert with a retry that calls reset, and logs the error', () => {
    const reset = jest.fn();
    const error = new Error('boom');
    render(<GameError error={error} reset={reset} />);

    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Midnight Session' })).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Game route error:', error);
  });

  it('leads back to the portfolio home in the language in use', () => {
    setFakeLocale('vi');
    render(<GameError error={new Error('boom')} reset={jest.fn()} />);

    const homeLinks = screen.getAllByRole('link', { name: /Về trang chủ/ });
    expect(homeLinks.length).toBeGreaterThan(0);
    fireEvent.click(homeLinks[homeLinks.length - 1]);
    expect(navigations).toEqual(['/vi']);
  });
});
