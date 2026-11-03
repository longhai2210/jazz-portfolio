'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import PostEditor from '@/components/admin/blog/PostEditor';
import { usePostAdminDetail, usePostsAdminMutations } from '@/hooks/admin/usePostsAdmin';
import { CreatePostRequest } from '@jazz-portfolio/shared';

export default function EditPostPage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = use(paramsPromise);
  const router = useRouter();

  const { data: post, isLoading, error: fetchError, refetch } = usePostAdminDetail(id);
  const { updatePost, mutationError, clearMutationError } = usePostsAdminMutations();

  const handleSave = async (data: CreatePostRequest) => {
    clearMutationError();
    try {
      await updatePost.mutateAsync({ id, body: data });
      router.push(`/${locale}/admin/posts`);
      return true;
    } catch {
      // Mutation error captured by usePostsAdminMutations state
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm font-mono text-jazz-gold animate-pulse py-12">
        🎷 Loading Post Editor...
      </div>
    );
  }

  if (fetchError || !post) {
    return (
      <div className="flex flex-col gap-4 py-8 max-w-md font-mono">
        <div className="text-sm text-red-400">Post not found or failed to load.</div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="px-3.5 py-1.5 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-xs cursor-pointer hover:bg-red-900/40"
          >
            🔄 Retry
          </button>
          <button
            onClick={() => router.push(`/${locale}/admin/posts`)}
            className="px-3.5 py-1.5 border border-jazz-slate text-jazz-text-muted rounded-lg text-xs cursor-pointer hover:text-jazz-text"
          >
            ← Back to Posts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <PostEditor
        initialPost={post}
        saving={updatePost.isPending}
        error={mutationError}
        onClearError={clearMutationError}
        onSave={handleSave}
        onCancel={() => router.push(`/${locale}/admin/posts`)}
      />
    </div>
  );
}
