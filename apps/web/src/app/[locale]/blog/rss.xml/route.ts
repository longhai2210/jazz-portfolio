import { NextRequest, NextResponse } from 'next/server';
import { Locale } from '@jazz-portfolio/shared';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getPublicPosts } from '@/lib/blog-data';
import { getSiteUrl } from '@/lib/site-url';

function escapeCdata(str: string): string {
  return str.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ locale: string }> },
) {
  const settings = await getPublicSettings();
  if (!settings.isBlogEnabled) {
    return new NextResponse('Blog feature is disabled', { status: 404 });
  }

  const { locale } = await paramsPromise;
  const loc = locale as Locale;
  const siteUrl = getSiteUrl();

  const postsData = await getPublicPosts(1, 20);
  const posts = postsData?.items || [];

  const itemsXml = posts
    .map((post) => {
      const title = escapeCdata(post.title?.[loc] || post.title?.en || 'Untitled');
      const excerpt = escapeCdata(post.excerpt?.[loc] || post.excerpt?.en || '');
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date().toUTCString();
      const link = `${siteUrl}/${locale}/blog/${post.slug}`;

      return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${excerpt}]]></description>
    </item>`;
    })
    .join('');

  const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Jazz Portfolio Journal (${locale.toUpperCase()})</title>
    <link>${siteUrl}/${locale}/blog</link>
    <description>Articles on software engineering, jazz performance, and system architecture.</description>
    <language>${locale}</language>
    <atom:link href="${siteUrl}/${locale}/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
