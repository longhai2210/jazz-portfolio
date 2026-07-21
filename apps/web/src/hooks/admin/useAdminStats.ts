'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminStatsDto, ApiRoutes } from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export function useAdminStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const query = useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const res = await AdminApiClient.get<AdminStatsDto>(ApiRoutes.admin.stats());
      return (
        res.data ?? {
          categories: 0,
          items: 0,
          tracks: 0,
        }
      );
    },
    enabled: isAuthenticated,
  });

  return {
    stats: query.data ?? { categories: 0, items: 0, tracks: 0 },
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Failed to load dashboard stats.') : null,
  };
}
