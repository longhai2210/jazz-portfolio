'use client';

import { useEffect } from 'react';
import { ApiRoutes, TrackDto } from '@jazz-portfolio/shared';
import { useAudioStore } from '@/stores/audioStore';
import { CACHE_TAGS, PublicApiClient } from '@/lib/api-public';

export default function PlaylistFetcher() {
  const setPlaylist = useAudioStore((state) => state.setPlaylist);

  useEffect(() => {
    let cancelled = false;

    PublicApiClient.get<TrackDto[]>(ApiRoutes.music.public(), {
      tags: [CACHE_TAGS.music],
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.data && res.data.length > 0) {
          setPlaylist(res.data);
          return;
        }
        if (process.env.NODE_ENV === 'development') {
          const { MOCK_PLAYLIST } = await import('@/lib/mocks/playlist');
          if (!cancelled) setPlaylist(MOCK_PLAYLIST);
        }
      })
      .catch(async () => {
        if (cancelled) return;
        if (process.env.NODE_ENV === 'development') {
          const { MOCK_PLAYLIST_ERROR_FALLBACK } = await import('@/lib/mocks/playlist');
          if (!cancelled) setPlaylist(MOCK_PLAYLIST_ERROR_FALLBACK);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setPlaylist]);

  return null;
}
