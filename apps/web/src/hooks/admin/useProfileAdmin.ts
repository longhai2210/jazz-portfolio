'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRoutes, PresignUploadResponse, ProfileDto } from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export function useProfileAdmin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.profile(),
    queryFn: async () => {
      const res = await AdminApiClient.get<ProfileDto>(ApiRoutes.profile.public());
      if (!res.data) throw new Error('Profile not found');
      return res.data;
    },
    enabled: isAuthenticated,
  });

  const saveProfile = useMutation({
    mutationFn: async (profile: ProfileDto) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.put(ApiRoutes.profile.adminUpdate(), profile);
      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(adminKeys.profile(), profile);
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (message: string) => void;
    }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');

      onProgress?.('Obtaining presigned upload target...');
      const presignRes = await AdminApiClient.post<PresignUploadResponse>(
        ApiRoutes.media.adminPresign(),
        {
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          context: 'PROFILE',
        },
      );

      const { uploadUrl, cloudfrontUrl } = presignRes.data;

      onProgress?.('Uploading file directly to S3...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('S3 upload rejected.');
      }

      return cloudfrontUrl;
    },
  });

  const mutationError =
    getErrorMessage(saveProfile.error, '') ||
    getErrorMessage(uploadAvatar.error, '') ||
    null;

  const clearMutationError = () => {
    saveProfile.reset();
    uploadAvatar.reset();
  };

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    queryError: query.error ? getErrorMessage(query.error, 'Failed to load profile.') : null,
    mutationError: mutationError || null,
    clearMutationError,
    saveProfile,
    uploadAvatar,
    setProfileCache: (profile: ProfileDto) => {
      queryClient.setQueryData(adminKeys.profile(), profile);
    },
  };
}
