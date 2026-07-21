import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrackDto } from '@jazz-portfolio/shared';

interface AudioState {
  playlist: TrackDto[];
  currentTrackIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0 to 1
  currentTime: number;
  duration: number;
  
  // Actions
  setPlaylist: (playlist: TrackDto[]) => void;
  playTrack: (index: number) => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      playlist: [],
      currentTrackIndex: 0,
      isPlaying: false,
      isMuted: true, // Default to true due to browser autoplay policies
      volume: 0.5,
      currentTime: 0,
      duration: 0,

      setPlaylist: (playlist) => set({ playlist }),
      
      playTrack: (index) => {
        const { playlist } = get();
        if (index >= 0 && index < playlist.length) {
          set({ currentTrackIndex: index, isPlaying: true });
        }
      },

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      
      setIsPlaying: (isPlaying) => set({ isPlaying }),

      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),

      setVolume: (volume) => set({ volume }),

      setCurrentTime: (currentTime) => set({ currentTime }),

      setDuration: (duration) => set({ duration }),

      nextTrack: () => {
        const { playlist, currentTrackIndex } = get();
        if (playlist.length === 0) return;
        const nextIndex = (currentTrackIndex + 1) % playlist.length;
        set({ currentTrackIndex: nextIndex, isPlaying: true });
      },

      prevTrack: () => {
        const { playlist, currentTrackIndex } = get();
        if (playlist.length === 0) return;
        const prevIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        set({ currentTrackIndex: prevIndex, isPlaying: true });
      },
    }),
    {
      name: 'jazz-audio-storage',
      // Persist only UI state (volume, mute status) and not active dynamic playback states
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        currentTrackIndex: state.currentTrackIndex,
      }),
    },
  ),
);
