import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getPublicPosts, getPublicTags } from '@/lib/blog-data';
import PostList from '@/components/blog/PostList';
import BlogPagination from '@/components/blog/BlogPagination';
import { getLocalizedAlternates } from '@/lib/site-url';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await params;
  return {
    title: `#${tag} | Journal`,
    description: `Journal articles filed under ${tag}.`,
    alternates: getLocalizedAlternates(locale, `/blog/tag/${encodeURIComponent(tag)}`),
  };
}

export default async function TagFilteredBlogPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ locale: string; tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [settings, { locale, tag }, searchParams] = await Promise.all([
    getPublicSettings(),
    paramsPromise,
    searchParamsPromise,
  ]);
  if (!settings.isBlogEnabled) {
    notFound();
  }

  const parsedPage = parseInt(searchParams.page || '1', 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const [paginatedData, tags] = await Promise.all([getPublicPosts(page, 10, tag), getPublicTags()]);

  const posts = paginatedData?.items || [];
  const totalPages = paginatedData?.totalPages || 1;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-jazz-slate/40 pb-8">
        <div className="flex items-center gap-3 text-xs font-mono text-jazz-gold">
          <Link href={`/${locale}/blog`} className="hover:underline">
            ← All Posts
          </Link>
          <span>/</span>
          <span>Topic</span>
        </div>
        <h1 className="text-4xl font-heading font-bold text-jazz-gold tracking-tight">#{tag}</h1>

        {/* Tag pills */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs font-mono text-jazz-text-dim mr-1">Other topics:</span>
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={`/${locale}/blog/tag/${t.tag}`}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                  t.tag === tag
                    ? 'bg-jazz-gold text-jazz-black font-bold'
                    : 'bg-jazz-charcoal border border-jazz-slate/60 text-jazz-gold hover:border-jazz-gold'
                }`}
              >
                #{t.tag} <span className="text-[10px]">({t.count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Main post grid */}
      <PostList posts={posts} locale={locale} />

      {/* Pagination */}
      <BlogPagination page={page} totalPages={totalPages} locale={locale} tag={tag} />
    </div>
  );
}
