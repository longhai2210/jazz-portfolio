'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import PostEditor from '@/components/admin/blog/PostEditor';
import { usePostsAdminMutations } from '@/hooks/admin/usePostsAdmin';
import { CreatePostRequest } from '@jazz-portfolio/shared';

export default function NewPostPage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(paramsPromise);
  const router = useRouter();

  const { createPost, mutationError, clearMutationError } = usePostsAdminMutations();

  const handleSave = async (data: CreatePostRequest) => {
    clearMutationError();
    try {
      await createPost.mutateAsync(data);
      router.push(`/${locale}/admin/posts`);
      return true;
    } catch {
      // Mutation error captured by usePostsAdminMutations state
      return false;
    }
  };

  return (
    <div className="max-w-4xl">
      <PostEditor
        saving={createPost.isPending}
        error={mutationError}
        onClearError={clearMutationError}
        onSave={handleSave}
        onCancel={() => router.push(`/${locale}/admin/posts`)}
      />
    </div>
  );
}
