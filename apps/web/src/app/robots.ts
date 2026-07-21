import type { MetadataRoute } from 'next';

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/*/admin', '/*/admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
