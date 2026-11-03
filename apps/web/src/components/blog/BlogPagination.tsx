import Link from 'next/link';

interface BlogPaginationProps {
  page: number;
  totalPages: number;
  locale: string;
  tag?: string;
}

export default function BlogPagination({
  page,
  totalPages,
  locale,
  tag,
}: BlogPaginationProps) {
  if (totalPages <= 1) return null;

  const basePath = tag
    ? `/${locale}/blog/tag/${tag}`
    : `/${locale}/blog`;

  return (
    <nav className="flex items-center justify-between border-t border-jazz-slate/40 pt-6 text-xs font-mono text-jazz-text-muted">
      <span>
        Page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-3">
        {page > 1 && (
          <Link
            href={`${basePath}?page=${page - 1}`}
            className="px-4 py-2 border border-jazz-slate hover:border-jazz-gold text-jazz-text hover:text-jazz-gold rounded-xl transition-colors"
          >
            ← Previous Page
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={`${basePath}?page=${page + 1}`}
            className="px-4 py-2 border border-jazz-slate hover:border-jazz-gold text-jazz-text hover:text-jazz-gold rounded-xl transition-colors"
          >
            Next Page →
          </Link>
        )}
      </div>
    </nav>
  );
}
