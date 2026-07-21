'use client';

import dynamic from 'next/dynamic';

const MusicPlayer = dynamic(() => import('./MusicPlayer'), {
  ssr: false,
});

const PlaylistFetcher = dynamic(() => import('./PlaylistFetcher'), {
  ssr: false,
});

export function LazyPlaylistFetcher() {
  return <PlaylistFetcher />;
}

export function LazyMusicPlayer() {
  return <MusicPlayer />;
}
