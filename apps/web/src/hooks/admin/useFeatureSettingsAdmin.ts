'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRoutes,
  FeatureSettingsDto,
  FeatureSettingsStatusDto,
  UpdateFeatureSettingsDto,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export interface FeatureSettingsBundle {
  settings: FeatureSettingsDto;
  status: FeatureSettingsStatusDto;
}

export function useFeatureSettingsAdmin(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const featuresQuery = useQuery({
    queryKey: adminKeys.settingsFeatures(),
    queryFn: async () => {
      const res = await AdminApiClient.get<FeatureSettingsBundle>(
        ApiRoutes.settings.adminFeatures(),
      );
      if (!res.data) throw new Error('Failed to load feature settings');
      return res.data;
    },
    enabled: isAuthenticated && enabled,
  });

  const saveFeatureSettings = useMutation({
    mutationFn: async (body: UpdateFeatureSettingsDto) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.put<FeatureSettingsDto>(
        ApiRoutes.settings.adminFeatures(),
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.settingsFeatures() });
    },
  });

  return {
    featuresBundle: featuresQuery.data ?? null,
    isLoading: featuresQuery.isLoading,
    queryError: featuresQuery.error
      ? getErrorMessage(featuresQuery.error, 'Failed to load feature settings.')
      : null,
    saveFeatureSettings,
    mutationError: saveFeatureSettings.error
      ? getErrorMessage(saveFeatureSettings.error, 'Failed to save feature settings.')
      : null,
    clearMutationError: () => saveFeatureSettings.reset(),
  };
}
