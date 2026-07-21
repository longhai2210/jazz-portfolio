'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRoutes,
  ChangePasswordRequest,
  MailStatusDto,
  SiteSettingsDto,
  UpdateSiteSettingsDto,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export interface EmailSettingsBundle {
  settings: SiteSettingsDto;
  status: MailStatusDto;
}

export function useSettingsAdmin(options?: { enableEmailQuery?: boolean }) {
  const enableEmailQuery = options?.enableEmailQuery ?? true;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const emailQuery = useQuery({
    queryKey: adminKeys.settingsEmail(),
    queryFn: async () => {
      const res = await AdminApiClient.get<EmailSettingsBundle>(
        ApiRoutes.settings.adminEmail(),
      );
      if (!res.data) throw new Error('Failed to load email settings');
      return res.data;
    },
    enabled: isAuthenticated && enableEmailQuery,
  });

  const saveEmailSettings = useMutation({
    mutationFn: async (body: UpdateSiteSettingsDto) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.put<SiteSettingsDto>(
        ApiRoutes.settings.adminEmail(),
        body,
      );
      const statusRes = await AdminApiClient.get<EmailSettingsBundle>(
        ApiRoutes.settings.adminEmail(),
      );
      return {
        settings: res.data ?? statusRes.data?.settings,
        status: statusRes.data?.status,
      };
    },
    onSuccess: (data) => {
      if (data.settings && data.status) {
        queryClient.setQueryData(adminKeys.settingsEmail(), {
          settings: data.settings,
          status: data.status,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: adminKeys.settingsEmail() });
      }
    },
  });

  const sendTestEmail = useMutation({
    mutationFn: async () => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const res = await AdminApiClient.post<{ success: boolean; message: string }>(
        ApiRoutes.settings.adminEmailTest(),
        {},
      );
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Failed to dispatch test email.');
      }
      return res.data;
    },
  });

  const changePassword = useMutation({
    mutationFn: async (body: ChangePasswordRequest) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.put(ApiRoutes.profile.adminPassword(), body);
    },
  });

  return {
    emailBundle: emailQuery.data ?? null,
    isEmailLoading: emailQuery.isLoading,
    emailQueryError: emailQuery.error
      ? getErrorMessage(emailQuery.error, 'Failed to load email settings configuration.')
      : null,
    saveEmailSettings,
    sendTestEmail,
    changePassword,
    emailMutationError:
      getErrorMessage(saveEmailSettings.error, '') ||
      getErrorMessage(sendTestEmail.error, '') ||
      null,
    passwordMutationError: changePassword.error
      ? getErrorMessage(
          changePassword.error,
          'Failed to change password. Make sure current password is correct.',
        )
      : null,
    clearEmailMutationError: () => {
      saveEmailSettings.reset();
      sendTestEmail.reset();
    },
    clearPasswordMutationError: () => changePassword.reset(),
  };
}
