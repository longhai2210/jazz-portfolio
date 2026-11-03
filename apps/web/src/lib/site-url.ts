import { routing } from '@/i18n/routing';

const LOCAL_SITE_URL = 'http://localhost:3000';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || LOCAL_SITE_URL).replace(/\/$/, '');
}

export function getLocalizedAlternates(locale: string, path = '') {
  const base = getSiteUrl();
  return {
    canonical: `${base}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(
        routing.locales.map((supportedLocale) => [
          supportedLocale,
          `${base}/${supportedLocale}${path}`,
        ]),
      ),
      'x-default': `${base}/${routing.defaultLocale}${path}`,
    },
  };
}
