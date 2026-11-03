import { Suspense } from 'react';
import Image from 'next/image';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Locale } from '@jazz-portfolio/shared';
import { getPublicSettings } from '@/lib/portfolio-data';
import { getPublicPostBySlug } from '@/lib/blog-data';
import PostBody from '@/components/blog/PostBody';
import PostMeta from '@/components/blog/PostMeta';
import BlogComments from '@/components/blog/BlogComments';
import ReadingProgressBar from '@/components/blog/ReadingProgressBar';
import TableOfContents from '@/components/blog/TableOfContents';
import ShareBar from '@/components/blog/ShareBar';
import { extractHeadings } from '@/lib/extract-headings';
import { getLocalizedAlternates, getSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await paramsPromise;
  const post = await getPublicPostBySlug(slug);

  if (!post) return { title: 'Post Not Found' };

  const loc = locale as Locale;
  const title = post.title?.[loc] || post.title?.en || 'Blog Post';
  const excerpt = post.excerpt?.[loc] || post.excerpt?.en || '';
  const path = `/blog/${slug}`;
  const canonicalUrl = `${getSiteUrl()}/${locale}${path}`;

  return {
    title: `${title} | Journal`,
    description: excerpt,
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title,
      description: excerpt,
      publishedTime: post.publishedAt || undefined,
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : [],
    },
    twitter: {
      card: post.coverImageUrl ? 'summary_large_image' : 'summary',
      title,
      description: excerpt,
      images: post.coverImageUrl ? [post.coverImageUrl] : [],
    },
    alternates: getLocalizedAlternates(locale, path),
  };
}

export default async function BlogPostDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await paramsPromise;
  const [settings, post] = await Promise.all([
    getPublicSettings(),
    getPublicPostBySlug(slug),
  ]);

  if (!settings.isBlogEnabled) {
    notFound();
  }

  if (!post) {
    notFound();
  }

  const loc = locale as Locale;
  const title = post.title?.[loc] || post.title?.en || 'Untitled Post';
  const excerpt = post.excerpt?.[loc] || post.excerpt?.en || '';
  const content = post.content?.[loc] || post.content?.en || '';
  const headings = extractHeadings(content);
  const shareUrl = `${getSiteUrl()}/${locale}/blog/${slug}`;

  const isCommentsActive =
    settings.areCommentsEnabled && post.areCommentsEnabled && !post.commentsClosed;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: excerpt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    datePublished: post.publishedAt,
    inLanguage: locale,
    url: shareUrl,
    mainEntityOfPage: shareUrl,
    author: {
      '@type': 'Person',
      name: 'Jazz Portfolio Author',
    },
  };

  return (
    <>
      <ReadingProgressBar />
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">
        <article className="flex flex-col gap-8 min-w-0 lg:col-start-1 lg:row-start-1">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Back button */}
          <Link
            href={`/${locale}/blog`}
            className="text-xs font-mono text-jazz-gold hover:text-jazz-amber flex items-center gap-1 w-fit"
          >
            <span aria-hidden="true">←</span> Back to all posts
          </Link>

          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-jazz-slate/40 pb-6">
            <PostMeta
              locale={locale}
              publishedAt={post.publishedAt}
              readingMinutes={post.readingMinutes}
              tags={post.tags}
            />

            <h1 className="text-4xl md:text-5xl font-heading font-bold text-jazz-gold leading-tight">
              {title}
            </h1>

            {excerpt && (
              <p className="text-lg text-jazz-text-muted italic leading-relaxed">{excerpt}</p>
            )}

            <ShareBar url={shareUrl} title={title} />
          </div>

          {/* Cover Image */}
          {post.coverImageUrl && (
            <div className="relative w-full h-80 md:h-[420px] rounded-2xl overflow-hidden border border-jazz-slate bg-jazz-charcoal">
              <Image
                src={post.coverImageUrl}
                alt={title}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover"
              />
            </div>
          )}

          {/* Mobile TOC */}
          <TableOfContents headings={headings} variant="mobile" />

          {/* Markdown Body */}
          <div className="py-4">
            <PostBody content={content} />
          </div>

          {/* Discussion & Comments Section */}
          <Suspense
            fallback={
              <div className="border-t border-jazz-slate/40 pt-10 mt-10 text-xs font-mono text-jazz-gold animate-pulse">
                🎷 Loading discussion...
              </div>
            }
          >
            <BlogComments
              postId={post.id}
              postSlug={post.slug}
              areCommentsEnabled={isCommentsActive}
              isCaptchaEnabled={settings.isCommentCaptchaEnabled}
              locale={locale}
            />
          </Suspense>
        </article>

        <aside className="lg:col-start-2 lg:row-start-1">
          <TableOfContents headings={headings} variant="desktop" />
        </aside>
      </div>
    </>
  );
}
