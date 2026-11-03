'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminPostDto,
  ApiRoutes,
  CreatePostRequest,
  PaginatedResponse,
  UpdatePostRequest,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export function usePostsAdminList(
  page = 1,
  limit = 20,
  status = 'ALL',
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: adminKeys.postList(page, limit, status),
    queryFn: async () => {
      const res = await AdminApiClient.get<PaginatedResponse<AdminPostDto>>(
        ApiRoutes.blog.adminList({ page, limit, status }),
      );
      if (!res.data) throw new Error('Failed to load posts list');
      return res.data;
    },
    enabled: isAuthenticated,
  });
}

export function usePostAdminDetail(id?: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: adminKeys.postDetail(id || ''),
    queryFn: async () => {
      if (!id) throw new Error('Post ID is required');
      const res = await AdminApiClient.get<AdminPostDto>(
        ApiRoutes.blog.adminGet(id),
      );
      if (!res.data) throw new Error('Failed to load post detail');
      return res.data;
    },
    enabled: isAuthenticated && !!id,
  });
}

export function usePostsAdminMutations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.posts() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  };

  const createPost = useMutation({
    mutationFn: async (body: CreatePostRequest) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.post<AdminPostDto>(
        ApiRoutes.blog.adminCreate(),
        body,
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdatePostRequest }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.put<AdminPostDto>(
        ApiRoutes.blog.adminUpdate(id),
        body,
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const publishPost = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.patch<AdminPostDto>(
        ApiRoutes.blog.adminPublish(id),
        {},
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const unpublishPost = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.patch<AdminPostDto>(
        ApiRoutes.blog.adminUnpublish(id),
        {},
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.blog.adminDelete(id));
    },
    onSuccess: invalidateAll,
  });

  const mutationError =
    getErrorMessage(createPost.error, '') ||
    getErrorMessage(updatePost.error, '') ||
    getErrorMessage(publishPost.error, '') ||
    getErrorMessage(unpublishPost.error, '') ||
    getErrorMessage(deletePost.error, '') ||
    null;

  return {
    createPost,
    updatePost,
    publishPost,
    unpublishPost,
    deletePost,
    mutationError,
    clearMutationError: () => {
      createPost.reset();
      updatePost.reset();
      publishPost.reset();
      unpublishPost.reset();
      deletePost.reset();
    },
  };
}
