import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Locale } from '@jazz-portfolio/shared';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getPublicPosts, getPublicTags } from '@/lib/blog-data';
import PostList from '@/components/blog/PostList';
import BlogPagination from '@/components/blog/BlogPagination';
import { getLocalizedAlternates, getSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await paramsPromise;
  const siteUrl = getSiteUrl();

  return {
    title: 'Journal & Notes | Jazz Portfolio',
    description:
      'Thoughts on software engineering, jazz performance, system architecture, and creative technology.',
    openGraph: {
      title: 'Journal & Notes | Jazz Portfolio',
      description:
        'Thoughts on software engineering, jazz performance, system architecture, and creative technology.',
      type: 'website',
      url: `${siteUrl}/${locale}/blog`,
    },
    alternates: getLocalizedAlternates(locale, '/blog'),
  };
}

export default async function BlogIndexPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [settings, { locale }, searchParams] = await Promise.all([
    getPublicSettings(),
    paramsPromise,
    searchParamsPromise,
  ]);
  if (!settings.isBlogEnabled) {
    notFound();
  }

  const parsedPage = parseInt(searchParams.page || '1', 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const [paginatedData, tags] = await Promise.all([getPublicPosts(page, 10), getPublicTags()]);

  const posts = paginatedData?.items || [];
  const totalPages = paginatedData?.totalPages || 1;

  const siteUrl = getSiteUrl();
  const loc = locale as Locale;
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Journal & Notes',
    description:
      'Thoughts on software engineering, jazz performance, system architecture, and creative technology.',
    url: `${siteUrl}/${locale}/blog`,
    hasPart: posts.map((post) => {
      const postTitle = post.title?.[loc] || post.title?.en || 'Post';
      return {
        '@type': 'BlogPosting',
        headline: postTitle,
        url: `${siteUrl}/${locale}/blog/${post.slug}`,
        ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
      };
    }),
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-jazz-slate/40 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-heading font-bold text-jazz-gold tracking-tight">
            Journal & Notes 🎷
          </h1>
          <a
            href={`/${locale}/blog/rss.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-jazz-gold hover:text-jazz-amber border border-jazz-gold/30 hover:border-jazz-gold px-3.5 py-1.5 rounded-full transition-all"
          >
            📡 RSS Feed
          </a>
        </div>
        <p className="text-sm text-jazz-text-muted max-w-2xl leading-relaxed">
          Thoughts on software engineering, jazz performance, system architecture, and creative
          technology.
        </p>

        {/* Tag pills */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-mono text-jazz-text-dim mr-1">Topics:</span>
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={`/${locale}/blog/tag/${t.tag}`}
                className="px-3 py-1 rounded-full bg-jazz-charcoal border border-jazz-slate/60 text-jazz-gold hover:border-jazz-gold text-xs font-mono transition-colors"
              >
                #{t.tag} <span className="text-[10px] text-jazz-text-muted">({t.count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Main post grid */}
      <PostList posts={posts} locale={locale} />

      {/* Pagination */}
      <BlogPagination page={page} totalPages={totalPages} locale={locale} />
    </div>
  );
}
