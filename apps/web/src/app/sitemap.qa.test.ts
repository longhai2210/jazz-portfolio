jest.mock('next-intl', () => ({}));
jest.mock('next-intl/server', () => ({}));
jest.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'vi', 'ja'], defaultLocale: 'en' },
}));
const getPublicSettings = jest.fn();
jest.mock('@/lib/portfolio-data', () => ({ getPublicSettings: () => getPublicSettings() }));
jest.mock('@/lib/blog-data', () => ({
  getPublicPosts: async () => ({ items: [{ slug: 'p1', publishedAt: null }], totalPages: 1 }),
}));
jest.mock('@/lib/site-url', () => ({ getSiteUrl: () => 'https://example.test' }));

import sitemap from './sitemap';

describe('AC-DUEL-015.6 sitemap', () => {
  it.each([true, false])(
    'AC-DUEL-015.6: sitemap never lists /game (isGameEnabled=%s)',
    async (flag) => {
      getPublicSettings.mockResolvedValue({ isGameEnabled: flag, isBlogEnabled: true });
      const entries = await sitemap();
      expect(entries.length).toBeGreaterThan(0);
      for (const e of entries) {
        expect(e.url).not.toMatch(/\/game(\/|$)/);
        for (const alt of Object.values(e.alternates?.languages ?? {})) {
          expect(String(alt)).not.toMatch(/\/game(\/|$)/);
        }
      }
    },
  );
});
