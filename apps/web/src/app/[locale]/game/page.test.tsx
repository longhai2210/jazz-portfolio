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
jest.mock('@/game/stage/StageGame', () => ({
  __esModule: true,
  default: function FakeStageGame() {
    return <div data-testid="stage-game" />;
  },
}));
jest.mock('next/link', () =>
  jest.requireActual<typeof import('@/game/ui/screens/testing/link')>(
    '@/game/ui/screens/testing/link',
  ),
);
/**
 * The real `messages/en.json` and `vi.json`: the route's loading and error screens use keys of
 * `common` and `game` (`error.*` included), so these tests also check those keys exist. A key
 * missing from the messages, or a `{x}` without its value, throws. The locale comes from the
 * game's `setFakeLocale`, which `HomeLink` reads through `useLocale`.
 */
jest.mock('next-intl', () => {
  const intl = jest.requireActual<typeof import('@/game/ui/screens/testing/intl')>(
    '@/game/ui/screens/testing/intl',
  );
  type Messages = Readonly<Record<string, unknown>>;
  const messages: Readonly<Record<'en' | 'vi', Messages>> = {
    en: jest.requireActual<Messages>('@/i18n/messages/en.json'),
    vi: jest.requireActual<Messages>('@/i18n/messages/vi.json'),
  };
  const lookup = (path: string): unknown =>
    path
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          typeof node === 'object' && node !== null
            ? (node as Readonly<Record<string, unknown>>)[part]
            : undefined,
        messages[intl.nextIntlMock.useLocale()],
      );
  return {
    useLocale: intl.nextIntlMock.useLocale,
    useTranslations:
      (namespace: string) =>
      (key: string, values: Readonly<Record<string, string | number>> = {}): string => {
        const message = lookup(`${namespace}.${key}`);
        if (typeof message !== 'string') throw new Error(`${namespace}.${key} has no message`);
        return message.replace(/\{(\w+)\}/g, (_, name: string) => {
          const value = values[name];
          if (value === undefined) {
            throw new Error(`${namespace}.${key} needs a value for {${name}}`);
          }
          return String(value);
        });
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

  it('AC-DUEL-015.5: calls notFound() while the game is off, with the Blog switch off too', async () => {
    // The Game switch alone decides: the test above has Blog on, this one has it off.
    getPublicSettingsMock.mockResolvedValue({ ...settings(false), isBlogEnabled: false });

    await expect(GamePage()).rejects.toBe(mockNotFoundError);
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.6: sets robots to noindex, nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('AC-STAGE-001.1: renders the stage game, with no inputs, while isGameEnabled is on', async () => {
    getPublicSettingsMock.mockResolvedValue(settings(true));

    const page = (await GamePage()) as ReactElement<Record<string, unknown>>;
    render(page);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('stage-game')).toBeInTheDocument();
    // The route passes nothing: the game picks the 3D street or the grey box itself, and asks
    // for difficulty and calibration itself.
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

    const alert = screen.getByRole('alert', { name: 'Something went wrong' });
    expect(
      within(alert).getByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      'The game hit an unexpected error. Your portfolio is unaffected.',
    );

    fireEvent.click(within(alert).getByRole('button', { name: 'Reload the game' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Game route error:', error);
  });

  it('leads back to the portfolio home in the language in use', () => {
    setFakeLocale('vi');
    render(<GameError error={new Error('boom')} reset={jest.fn()} />);

    const alert = screen.getByRole('alert', { name: 'Đã có lỗi xảy ra' });
    expect(alert).toHaveTextContent(
      'Game gặp lỗi không mong muốn. Portfolio của bạn không bị ảnh hưởng.',
    );
    expect(within(alert).getByRole('button', { name: 'Tải lại game' })).toBeInTheDocument();
    const homeLinks = screen.getAllByRole('link', { name: /Về trang chủ/ });
    expect(homeLinks.length).toBeGreaterThan(0);
    fireEvent.click(homeLinks[homeLinks.length - 1]);
    expect(navigations).toEqual(['/vi']);
  });
});
