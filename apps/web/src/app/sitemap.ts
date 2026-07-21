import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  return routing.locales.map((locale) => ({
    url: `${base}/${locale}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: locale === routing.defaultLocale ? 1 : 0.8,
  }));
}
