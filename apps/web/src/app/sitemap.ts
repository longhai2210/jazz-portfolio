import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getPublicPosts } from '@/lib/blog-data';
import { getSiteUrl } from '@/lib/site-url';

function getLanguageAlternates(base: string, path = '') {
  return {
    languages: {
      ...Object.fromEntries(routing.locales.map((loc) => [loc, `${base}/${loc}${path}`])),
      'x-default': `${base}/${routing.defaultLocale}${path}`,
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const routes: MetadataRoute.Sitemap = routing.locales.map((locale) => ({
    url: `${base}/${locale}`,
    changeFrequency: 'weekly' as const,
    priority: locale === routing.defaultLocale ? 1 : 0.8,
    alternates: getLanguageAlternates(base),
  }));

  const settings = await getPublicSettings();
  if (settings.isBlogEnabled) {
    // Add blog index page
    for (const locale of routing.locales) {
      routes.push({
        url: `${base}/${locale}/blog`,
        changeFrequency: 'daily' as const,
        priority: 0.9,
        alternates: getLanguageAlternates(base, '/blog'),
      });
    }

    // Add published posts
    const firstPage = await getPublicPosts(1, 100);
    if (firstPage?.items) {
      const posts = [...firstPage.items];
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const nextPage = await getPublicPosts(page, 100);
        if (nextPage?.items) posts.push(...nextPage.items);
      }

      for (const post of posts) {
        for (const locale of routing.locales) {
          routes.push({
            url: `${base}/${locale}/blog/${post.slug}`,
            ...(post.publishedAt ? { lastModified: new Date(post.publishedAt) } : {}),
            changeFrequency: 'weekly' as const,
            priority: 0.7,
            alternates: getLanguageAlternates(base, `/blog/${post.slug}`),
          });
        }
      }
    }
  }

  return routes;
}
