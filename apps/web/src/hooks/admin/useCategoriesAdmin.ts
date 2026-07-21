'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRoutes,
  CategoryDto,
  ReorderRequest,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export interface CategoryPayload {
  name: { en: string; vi: string; ja: string };
  slug: string;
  type: string;
}

export interface CategoryItemPayload {
  title: { en: string; vi: string; ja: string };
  description: { en: string; vi: string; ja: string };
  metadata: Record<string, unknown>;
}

export function useCategoriesAdmin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.categories(),
    queryFn: async () => {
      const res = await AdminApiClient.get<CategoryDto[]>(ApiRoutes.categories.adminAll());
      return res.data ?? [];
    },
    enabled: isAuthenticated,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.categories() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() }),
    ]);

  const saveCategory = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id?: string | null;
      payload: CategoryPayload;
    }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      if (id) {
        await AdminApiClient.put(ApiRoutes.categories.adminUpdate(id), payload);
      } else {
        await AdminApiClient.post(ApiRoutes.categories.adminCreate(), payload);
      }
    },
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.categories.adminDelete(id));
    },
    onSuccess: invalidate,
  });

  const reorderCategories = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const body: ReorderRequest = { ids };
      await AdminApiClient.patch(ApiRoutes.categories.adminReorder(), body);
    },
    onSuccess: invalidate,
  });

  const saveItem = useMutation({
    mutationFn: async ({
      categoryId,
      itemId,
      payload,
    }: {
      categoryId: string;
      itemId?: string | null;
      payload: CategoryItemPayload;
    }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      if (itemId) {
        await AdminApiClient.put(ApiRoutes.categories.adminUpdateItem(itemId), payload);
      } else {
        await AdminApiClient.post(ApiRoutes.categories.adminCreateItem(categoryId), payload);
      }
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.categories.adminDeleteItem(id));
    },
    onSuccess: invalidate,
  });

  const reorderItems = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const body: ReorderRequest = { ids };
      await AdminApiClient.patch(ApiRoutes.categories.adminReorderItems(), body);
    },
    onSuccess: invalidate,
  });

  const mutationError =
    getErrorMessage(saveCategory.error, '') ||
    getErrorMessage(deleteCategory.error, '') ||
    getErrorMessage(reorderCategories.error, '') ||
    getErrorMessage(saveItem.error, '') ||
    getErrorMessage(deleteItem.error, '') ||
    getErrorMessage(reorderItems.error, '') ||
    null;

  const clearMutationError = () => {
    saveCategory.reset();
    deleteCategory.reset();
    reorderCategories.reset();
    saveItem.reset();
    deleteItem.reset();
    reorderItems.reset();
  };

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    queryError: query.error ? getErrorMessage(query.error, 'Failed to load categories.') : null,
    mutationError: mutationError || null,
    clearMutationError,
    saveCategory,
    deleteCategory,
    reorderCategories,
    saveItem,
    deleteItem,
    reorderItems,
  };
}
