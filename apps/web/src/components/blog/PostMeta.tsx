import Link from 'next/link';

interface PostMetaProps {
  locale: string;
  publishedAt: string | null;
  readingMinutes: number;
  tags: string[];
}

export default function PostMeta({
  locale,
  publishedAt,
  readingMinutes,
  tags,
}: PostMetaProps) {
  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-jazz-text-muted">
      {formattedDate && (
        <span className="flex items-center gap-1 text-jazz-text-dim">
          🗓 {formattedDate}
        </span>
      )}
      <span className="text-jazz-slate">•</span>
      <span className="flex items-center gap-1 text-jazz-text-dim">
        ⏱ {readingMinutes} min read
      </span>
      {tags.length > 0 && (
        <>
          <span className="text-jazz-slate">•</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <Link
                key={t}
                href={`/${locale}/blog/tag/${t}`}
                className="px-2 py-0.5 rounded bg-jazz-charcoal/80 border border-jazz-slate/50 text-jazz-gold hover:border-jazz-gold transition-colors"
              >
                #{t}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
