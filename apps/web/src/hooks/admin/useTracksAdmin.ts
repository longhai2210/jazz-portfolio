'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiRoutes,
  CreateTrackRequest,
  PresignUploadResponse,
  ReorderRequest,
  TrackDto,
  UpdateTrackRequest,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import { useAuthStore } from '@/stores/authStore';
import { adminKeys } from './query-keys';
import { getErrorMessage } from './get-error-message';

export function useTracksAdmin() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: adminKeys.tracks(),
    queryFn: async () => {
      const res = await AdminApiClient.get<TrackDto[]>(ApiRoutes.music.adminAll());
      return res.data ?? [];
    },
    enabled: isAuthenticated,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.tracks() }),
      queryClient.invalidateQueries({ queryKey: adminKeys.stats() }),
    ]);

  const uploadTrack = useMutation({
    mutationFn: async ({
      title,
      artist,
      file,
      onProgress,
    }: {
      title: string;
      artist: string;
      file: File;
      onProgress?: (message: string) => void;
    }) => {
      if (!isAuthenticated) throw new Error('Not authenticated');

      onProgress?.('Requesting presigned upload target...');
      const presignRes = await AdminApiClient.post<PresignUploadResponse>(
        ApiRoutes.media.adminPresign(),
        {
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          context: 'TRACK',
        },
      );

      const { uploadUrl, cloudfrontUrl, s3Key } = presignRes.data;

      onProgress?.('Uploading track to S3...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error('S3 rejected upload.');
      }

      onProgress?.('Logging track meta in database...');
      const createBody: CreateTrackRequest = {
        title,
        artist,
        s3Key,
        cloudfrontUrl,
        durationSeconds: 180,
      };
      await AdminApiClient.post(ApiRoutes.music.adminCreate(), createBody);
    },
    onSuccess: invalidate,
  });

  const deleteTrack = useMutation({
    mutationFn: async (id: string) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      await AdminApiClient.delete(ApiRoutes.music.adminDelete(id));
    },
    onSuccess: invalidate,
  });

  const toggleTrack = useMutation({
    mutationFn: async (track: TrackDto) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const body: UpdateTrackRequest = { isActive: !track.isActive };
      await AdminApiClient.put(ApiRoutes.music.adminUpdate(track.id), body);
    },
    onSuccess: invalidate,
  });

  const reorderTracks = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!isAuthenticated) throw new Error('Not authenticated');
      const body: ReorderRequest = { ids };
      await AdminApiClient.patch(ApiRoutes.music.adminReorder(), body);
    },
    onSuccess: invalidate,
  });

  const mutationError =
    getErrorMessage(uploadTrack.error, '') ||
    getErrorMessage(deleteTrack.error, '') ||
    getErrorMessage(toggleTrack.error, '') ||
    getErrorMessage(reorderTracks.error, '') ||
    null;

  const clearMutationError = () => {
    uploadTrack.reset();
    deleteTrack.reset();
    toggleTrack.reset();
    reorderTracks.reset();
  };

  return {
    tracks: query.data ?? [],
    isLoading: query.isLoading,
    queryError: query.error ? getErrorMessage(query.error, 'Failed to load tracks.') : null,
    mutationError: mutationError || null,
    clearMutationError,
    uploadTrack,
    deleteTrack,
    toggleTrack,
    reorderTracks,
  };
}
