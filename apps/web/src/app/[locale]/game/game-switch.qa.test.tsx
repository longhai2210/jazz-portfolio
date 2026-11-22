/**
 * @jest-environment jsdom
 */
import type { ReactElement } from 'react';

const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const getPublicSettings = jest.fn();

jest.mock('next/navigation', () => ({ notFound: () => notFound() }));
jest.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
jest.mock('next-intl/server', () => ({
  getTranslations: async () => (k: string) => k,
  setRequestLocale: jest.fn(),
}));
jest.mock('@/lib/portfolio-data', () => ({ getPublicSettings: () => getPublicSettings() }));
jest.mock('@/game/ui/DuelGame', () => ({ __esModule: true, default: () => 'DUEL_GAME' }));
jest.mock('./GameTheme', () => ({ __esModule: true, default: () => null }));

import GamePage, * as pageModule from './page';
import GameLayout from './layout';

beforeEach(() => {
  notFound.mockClear();
  getPublicSettings.mockReset();
});

describe('AC-DUEL-015.5 / AC-DUEL-015.6 game route', () => {
  it('AC-DUEL-015.5: page calls notFound when isGameEnabled is false', async () => {
    getPublicSettings.mockResolvedValue({ isGameEnabled: false });
    await expect(GamePage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.5: layout calls notFound when isGameEnabled is false', async () => {
    getPublicSettings.mockResolvedValue({ isGameEnabled: false });
    await expect(GameLayout({ children: 'x' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-015.5: missing flag (fallback settings) is treated as off in page and layout', async () => {
    getPublicSettings.mockResolvedValue({});
    await expect(GamePage()).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(GameLayout({ children: 'x' })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('AC-DUEL-015.5: page renders the game and layout renders children when enabled', async () => {
    getPublicSettings.mockResolvedValue({ isGameEnabled: true });
    const page = (await GamePage()) as ReactElement;
    expect(page).toBeTruthy();
    const layout = (await GameLayout({ children: 'CHILD' })) as ReactElement;
    expect(layout).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('AC-DUEL-015.6: metadata robots is noindex, nofollow', () => {
    expect(pageModule.metadata.robots).toEqual({ index: false, follow: false });
  });
});
