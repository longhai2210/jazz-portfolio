import Image from 'next/image';
import Link from 'next/link';
import { Locale, PostListItemDto } from '@jazz-portfolio/shared';
import PostMeta from './PostMeta';

interface PostCardProps {
  post: PostListItemDto;
  locale: string;
}

export default function PostCard({ post, locale }: PostCardProps) {
  const loc = locale as Locale;
  const title = post.title?.[loc] || post.title?.en || 'Untitled Post';
  const excerpt = post.excerpt?.[loc] || post.excerpt?.en || '';
  const postUrl = `/${locale}/blog/${post.slug}`;

  return (
    <article className="group relative bg-jazz-dark/60 border border-jazz-slate hover:border-jazz-gold/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_25px_rgba(212,165,116,0.1)] flex flex-col justify-between">
      {/* Full card clickable overlay */}
      <Link href={postUrl} aria-label={title} className="absolute inset-0 z-10" tabIndex={-1} />

      <div>
        {post.coverImageUrl && (
          <div className="relative w-full h-48 overflow-hidden bg-jazz-charcoal jazz-shimmer">
            <Image
              src={post.coverImageUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500 relative z-10"
            />
          </div>
        )}

        <div className="p-6 flex flex-col gap-3">
          <div className="relative z-20">
            <PostMeta
              locale={locale}
              publishedAt={post.publishedAt}
              readingMinutes={post.readingMinutes}
              tags={post.tags}
            />
          </div>

          <h2 className="text-xl font-heading font-bold text-jazz-gold group-hover:text-jazz-amber transition-colors line-clamp-2 relative z-20">
            <Link href={postUrl}>{title}</Link>
          </h2>

          {excerpt && (
            <p className="text-sm text-jazz-text-muted leading-relaxed line-clamp-3">{excerpt}</p>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-jazz-slate/30 text-xs font-mono relative z-20">
        <span className="text-jazz-text-dim flex items-center gap-1">
          <span aria-hidden="true">💬</span> {post.commentCount} comments
        </span>

        <Link
          href={postUrl}
          className="text-jazz-gold hover:text-jazz-amber font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform"
        >
          Read Article <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
