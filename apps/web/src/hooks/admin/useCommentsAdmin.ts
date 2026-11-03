'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminCommentDto,
  ApiRoutes,
  CommentBlocklistDto,
  CommentStatus,
  CreateBlocklistItemRequest,
  PaginatedResponse,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export function useCommentsAdminList(
  page = 1,
  limit = 20,
  status = 'PENDING',
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: adminKeys.commentList(page, limit, status),
    queryFn: async () => {
      const res = await AdminApiClient.get<PaginatedResponse<AdminCommentDto>>(
        ApiRoutes.comments.adminList({ page, limit, status }),
      );
      if (!res.data) throw new Error('Failed to load comments list');
      return res.data;
    },
    enabled: isAuthenticated,
  });
}

export function useBlocklistAdmin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: adminKeys.blocklist(),
    queryFn: async () => {
      const res = await AdminApiClient.get<CommentBlocklistDto[]>(
        ApiRoutes.comments.adminBlocklist(),
      );
      if (!res.data) throw new Error('Failed to load blocklist');
      return res.data;
    },
    enabled: isAuthenticated,
  });
}

export function useCommentsAdminMutations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.comments() });
    queryClient.invalidateQueries({ queryKey: adminKeys.blocklist() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
  };

  const moderateComment = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CommentStatus }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.patch<AdminCommentDto>(
        ApiRoutes.comments.adminModerate(id),
        { status },
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const bulkModerate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: CommentStatus }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.post<{ updatedCount: number }>(
        ApiRoutes.comments.adminBulkModerate(),
        { ids, status },
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.comments.adminDelete(id));
    },
    onSuccess: invalidateAll,
  });

  const createBlocklistItem = useMutation({
    mutationFn: async (body: CreateBlocklistItemRequest) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.post<CommentBlocklistDto>(
        ApiRoutes.comments.adminBlocklist(),
        body,
      );
      return res.data;
    },
    onSuccess: invalidateAll,
  });

  const deleteBlocklistItem = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.comments.adminBlocklistDelete(id));
    },
    onSuccess: invalidateAll,
  });

  const mutationError =
    getErrorMessage(moderateComment.error, '') ||
    getErrorMessage(bulkModerate.error, '') ||
    getErrorMessage(deleteComment.error, '') ||
    getErrorMessage(createBlocklistItem.error, '') ||
    getErrorMessage(deleteBlocklistItem.error, '') ||
    null;

  return {
    moderateComment,
    bulkModerate,
    deleteComment,
    createBlocklistItem,
    deleteBlocklistItem,
    mutationError,
    clearMutationError: () => {
      moderateComment.reset();
      bulkModerate.reset();
      deleteComment.reset();
      createBlocklistItem.reset();
      deleteBlocklistItem.reset();
    },
  };
}
