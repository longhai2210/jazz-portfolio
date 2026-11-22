import type { MetadataRoute } from 'next';
import type { PaginatedResponse, PostListItemDto, PublicSettingsDto } from '@jazz-portfolio/shared';
import { getPublicPosts } from '@/lib/blog-data';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getSiteUrl } from '@/lib/site-url';
import sitemap from './sitemap';

// `next-intl/routing` ships as ES modules Jest does not load; `site-url` reads the same routing.
jest.mock('@/i18n/routing', () => ({
  routing: { locales: ['en', 'vi', 'ja'], defaultLocale: 'en' },
}));
jest.mock('@/lib/portfolio-data', () => ({ getPublicSettings: jest.fn() }));
jest.mock('@/lib/blog-data', () => ({ getPublicPosts: jest.fn() }));

const getPublicSettingsMock = jest.mocked(getPublicSettings);
const getPublicPostsMock = jest.mocked(getPublicPosts);

const LOCALES = ['en', 'vi', 'ja'] as const;

function settings(overrides: Partial<PublicSettingsDto>): PublicSettingsDto {
  return {
    isContactFormEnabled: true,
    isBlogEnabled: false,
    isGameEnabled: true,
    areCommentsEnabled: false,
    isCommentCaptchaEnabled: false,
    ...overrides,
  };
}

function post(slug: string): PostListItemDto {
  const text = { en: slug, vi: slug, ja: slug };
  return {
    id: slug,
    slug,
    title: text,
    excerpt: text,
    coverImageUrl: null,
    tags: [],
    readingMinutes: 3,
    commentCount: 0,
    publishedAt: '2026-11-01T00:00:00.000Z',
  };
}

function postsPage(slugs: readonly string[]): PaginatedResponse<PostListItemDto> {
  return { items: slugs.map(post), total: slugs.length, page: 1, limit: 100, totalPages: 1 };
}

/** Every URL the sitemap names: each entry and each of its language alternates. */
function allUrls(entries: MetadataRoute.Sitemap): string[] {
  return entries.flatMap((entry) => [
    entry.url,
    ...Object.values(entry.alternates?.languages ?? {}).filter(
      (url): url is string => typeof url === 'string',
    ),
  ]);
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('sitemap.xml', () => {
  it('AC-DUEL-015.6: has no /game while isGameEnabled is on', async () => {
    getPublicSettingsMock.mockResolvedValue(settings({ isGameEnabled: true }));

    const urls = allUrls(await sitemap());

    // The portfolio home pages are listed, so the check below is not about an empty sitemap.
    for (const locale of LOCALES) expect(urls).toContain(`${getSiteUrl()}/${locale}`);
    expect(urls.filter((url) => url.includes('/game'))).toEqual([]);
    expect(getPublicPostsMock).not.toHaveBeenCalled();
  });

  it('AC-DUEL-015.6: has no /game with the blog and its posts listed too', async () => {
    getPublicSettingsMock.mockResolvedValue(settings({ isGameEnabled: true, isBlogEnabled: true }));
    getPublicPostsMock.mockResolvedValue(postsPage(['take-five', 'blue-in-green']));

    const urls = allUrls(await sitemap());

    for (const locale of LOCALES) {
      expect(urls).toContain(`${getSiteUrl()}/${locale}/blog`);
      expect(urls).toContain(`${getSiteUrl()}/${locale}/blog/take-five`);
    }
    expect(urls.filter((url) => url.includes('/game'))).toEqual([]);
  });
});
