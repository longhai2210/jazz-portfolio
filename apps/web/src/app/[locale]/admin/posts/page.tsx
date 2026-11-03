'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { PostStatus } from '@jazz-portfolio/shared';
import { usePostsAdminList, usePostsAdminMutations } from '@/hooks/admin/usePostsAdmin';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';

export default function AdminPostsPage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(paramsPromise);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const { data, isLoading, error: queryError, refetch } = usePostsAdminList(page, 15, statusFilter);

  const {
    publishPost,
    unpublishPost,
    deletePost,
    mutationError,
    clearMutationError,
  } = usePostsAdminMutations();

  const handleTogglePublish = async (id: string, currentStatus: PostStatus) => {
    clearMutationError();
    setMutatingId(id);
    try {
      if (currentStatus === PostStatus.PUBLISHED) {
        await unpublishPost.mutateAsync(id);
      } else {
        await publishPost.mutateAsync(id);
      }
    } catch {
      // Handled by mutationError banner
    } finally {
      setMutatingId(null);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete post "${title}"?`)) {
      clearMutationError();
      setMutatingId(id);
      try {
        await deletePost.mutateAsync(id);
      } catch {
        // Handled by mutationError banner
      } finally {
        setMutatingId(null);
      }
    }
  };


  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-jazz-gold">Blog Posts</h1>
          <p className="text-sm text-jazz-text-muted mt-2">
            Create, manage, and publish multilingual journal articles.
          </p>
        </div>

        <Link
          href={`/${locale}/admin/posts/new`}
          className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] text-xs font-mono"
        >
          + Write New Post
        </Link>
      </div>

      <MutationErrorBanner message={mutationError} onDismiss={clearMutationError} />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-jazz-slate/40 pb-3">
        {['ALL', PostStatus.PUBLISHED, PostStatus.DRAFT, PostStatus.ARCHIVED].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
              statusFilter === st
                ? 'bg-jazz-gold text-jazz-black'
                : 'bg-jazz-charcoal border border-jazz-slate text-jazz-text-muted hover:text-jazz-text'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm font-mono text-jazz-gold animate-pulse py-12">
          🎷 Fetching Blog Posts...
        </div>
      ) : queryError ? (
        <div className="flex items-center gap-4 text-sm text-red-400 font-mono py-6">
          <span>Failed to load posts list.</span>
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-300 rounded-lg text-xs cursor-pointer"
          >
            🔄 Retry
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl p-12 text-center text-jazz-text-muted text-sm font-mono">
          No posts found. Click &quot;Write New Post&quot; to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-jazz-charcoal border-b border-jazz-slate text-jazz-text-dim uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Title & Slug</th>
                  <th className="px-4 py-4">Locales</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Comments</th>
                  <th className="px-4 py-4">Published</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jazz-slate/40 text-jazz-text">
                {data.items.map((post) => {
                  const enTitle = post.title?.en || 'Untitled';
                  const hasEn = !!post.title?.en;
                  const hasVi = !!post.title?.vi;
                  const hasJa = !!post.title?.ja;
                  const isRowMutating = mutatingId === post.id;

                  return (
                    <tr key={post.id} className="hover:bg-jazz-charcoal/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-jazz-text text-sm">{enTitle}</div>
                        <div className="text-[11px] text-jazz-text-muted mt-0.5">/{post.slug}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className={hasEn ? 'text-emerald-400 font-bold' : 'text-jazz-text-dim opacity-40'}>EN</span>
                          <span className={hasVi ? 'text-emerald-400 font-bold' : 'text-jazz-text-dim opacity-40'}>VI</span>
                          <span className={hasJa ? 'text-emerald-400 font-bold' : 'text-jazz-text-dim opacity-40'}>JA</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            post.status === PostStatus.PUBLISHED
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                              : post.status === PostStatus.DRAFT
                              ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-jazz-text-muted">
                        💬 {post.commentCount}
                      </td>
                      <td className="px-4 py-4 text-jazz-text-muted text-[11px]">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            disabled={isRowMutating}
                            onClick={() => handleTogglePublish(post.id, post.status)}
                            className="px-2.5 py-1 border border-jazz-slate hover:border-jazz-gold rounded-lg text-[11px] text-jazz-text hover:text-jazz-gold transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {isRowMutating
                              ? 'Saving...'
                              : post.status === PostStatus.PUBLISHED
                              ? 'Unpublish'
                              : 'Publish'}
                          </button>
                          <Link
                            href={`/${locale}/admin/posts/${post.id}`}
                            className="px-2.5 py-1 bg-jazz-charcoal border border-jazz-slate hover:border-jazz-gold text-jazz-gold rounded-lg text-[11px] transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            disabled={isRowMutating}
                            onClick={() => handleDelete(post.id, enTitle)}
                            className="px-2.5 py-1 border border-red-500/30 text-red-400 hover:bg-red-950/30 rounded-lg text-[11px] transition-colors cursor-pointer disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-mono text-jazz-text-muted pt-2">
              <span>
                Page {data.page} of {data.totalPages} ({data.total} total posts)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-jazz-slate rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  ← Prev
                </button>
                <button
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-jazz-slate rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
