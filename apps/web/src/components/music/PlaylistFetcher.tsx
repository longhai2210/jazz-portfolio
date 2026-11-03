'use client';

import { useEffect } from 'react';
import { ApiRoutes, TrackDto } from '@jazz-portfolio/shared';
import { useAudioStore } from '@/stores/audioStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function PlaylistFetcher() {
  const setPlaylist = useAudioStore((state) => state.setPlaylist);

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}${ApiRoutes.music.public()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch public tracks');
        const json = (await response.json()) as { data: TrackDto[] };
        if (json.data.length > 0) {
          setPlaylist(json.data);
        } else if (process.env.NODE_ENV === 'development') {
          const { MOCK_PLAYLIST } = await import('@/lib/mocks/playlist');
          if (!controller.signal.aborted) setPlaylist(MOCK_PLAYLIST);
        }
      } catch {
        if (process.env.NODE_ENV === 'development' && !controller.signal.aborted) {
          const { MOCK_PLAYLIST_ERROR_FALLBACK } = await import('@/lib/mocks/playlist');
          if (!controller.signal.aborted) setPlaylist(MOCK_PLAYLIST_ERROR_FALLBACK);
        }
      }
    };

    const timer = window.setTimeout(() => void loadData(), 800);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [setPlaylist]);

  return null;
}
