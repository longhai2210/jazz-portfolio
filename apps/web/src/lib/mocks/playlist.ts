import { TrackDto } from '@jazz-portfolio/shared';

/** Dev-only playlist when the music API returns empty. */
export const MOCK_PLAYLIST: TrackDto[] = [
  {
    id: 'mock-1',
    title: 'Blue In Green',
    artist: 'Miles Davis',
    cloudfrontUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    durationSeconds: 372,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'mock-2',
    title: 'Take Five',
    artist: 'Dave Brubeck',
    cloudfrontUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    durationSeconds: 325,
    sortOrder: 2,
    isActive: true,
  },
];

/** Dev-only playlist when the music API request fails. */
export const MOCK_PLAYLIST_ERROR_FALLBACK: TrackDto[] = [
  {
    id: 'mock-1',
    title: 'Blue In Green (Dev Fallback)',
    artist: 'Miles Davis',
    cloudfrontUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    durationSeconds: 372,
    sortOrder: 1,
    isActive: true,
  },
];
