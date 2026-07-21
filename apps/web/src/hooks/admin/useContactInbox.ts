'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRoutes,
  ContactSubmissionDto,
  ContactSubmissionListItemDto,
  PaginatedResponse,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

const DEFAULT_LIMIT = 20;

export function useContactInbox(page: number, limit = DEFAULT_LIMIT) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: adminKeys.contactList(page, limit),
    queryFn: async () => {
      const res = await AdminApiClient.get<PaginatedResponse<ContactSubmissionListItemDto>>(
        ApiRoutes.contact.adminList(page, limit),
      );
      if (!res.data) {
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        } satisfies PaginatedResponse<ContactSubmissionListItemDto>;
      }
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.patch<ContactSubmissionDto>(
        ApiRoutes.contact.adminMarkRead(id),
        {},
      );
      return res.data;
    },
    onSuccess: (updated, id) => {
      queryClient.setQueriesData<PaginatedResponse<ContactSubmissionListItemDto>>(
        { queryKey: [...adminKeys.contact(), 'list'] },
        (old) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id ? { ...item, isRead: true } : item,
            ),
          };
        },
      );
      if (updated) {
        queryClient.setQueryData(adminKeys.contactDetail(id), updated);
      } else {
        queryClient.invalidateQueries({ queryKey: adminKeys.contactDetail(id) });
      }
    },
  });

  return {
    page,
    limit,
    items: listQuery.data?.items ?? [],
    total: listQuery.data?.total ?? 0,
    totalPages: listQuery.data?.totalPages ?? 0,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    queryError: listQuery.error
      ? getErrorMessage(listQuery.error, 'Failed to load contact submissions.')
      : null,
    mutationError: markAsRead.error
      ? getErrorMessage(markAsRead.error, 'Failed to mark as read.')
      : null,
    clearMutationError: () => markAsRead.reset(),
    markAsRead,
    fetchDetail: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const cached = queryClient.getQueryData<ContactSubmissionDto>(
        adminKeys.contactDetail(id),
      );
      if (cached) return cached;

      const res = await AdminApiClient.get<ContactSubmissionDto>(
        ApiRoutes.contact.adminGet(id),
      );
      if (!res.data) throw new Error('Submission not found');
      queryClient.setQueryData(adminKeys.contactDetail(id), res.data);
      return res.data;
    },
  };
}

export { DEFAULT_LIMIT as CONTACT_INBOX_PAGE_SIZE };
