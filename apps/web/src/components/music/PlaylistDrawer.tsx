'use client';

import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore } from '@/stores/audioStore';

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlaylistDrawer({ isOpen, onClose }: PlaylistDrawerProps) {
  const t = useTranslations('music');
  const { playlist, currentTrackIndex, playTrack, isPlaying } = useAudioStore();

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-jazz-black z-30 pointer-events-auto"
          />

          {/* Slide-Up Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-24 left-0 right-0 z-30 max-w-lg mx-auto bg-jazz-dark border border-jazz-slate rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-jazz-slate bg-jazz-charcoal/50">
              <h3 className="font-heading font-bold text-jazz-gold flex items-center gap-2">
                <span>🎵</span> {t('playlist')} ({playlist.length})
              </h3>
              <button
                onClick={onClose}
                className="text-jazz-text-muted hover:text-jazz-gold text-lg transition-colors"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>

            {/* Track List */}
            <div className="max-h-[300px] overflow-y-auto divide-y divide-jazz-slate/40">
              {playlist.length > 0 ? (
                playlist.map((track, index) => {
                  const isCurrent = currentTrackIndex === index;
                  
                  return (
                    <button
                      key={track.id}
                      onClick={() => {
                        playTrack(index);
                      }}
                      className={`w-full flex items-center justify-between px-6 py-4 transition-all duration-300 text-left ${
                        isCurrent
                          ? 'bg-jazz-gold/10 hover:bg-jazz-gold/15'
                          : 'hover:bg-jazz-charcoal/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xs font-mono text-jazz-text-dim w-4">
                          {isCurrent && isPlaying ? '🔊' : index + 1}
                        </span>
                        <div className="overflow-hidden">
                          <h4 className={`text-sm truncate ${isCurrent ? 'text-jazz-gold font-semibold' : 'text-jazz-text'}`}>
                            {track.title}
                          </h4>
                          <p className="text-xs text-jazz-text-muted truncate">
                            {track.artist}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-jazz-text-dim ml-4">
                        {formatDuration(track.durationSeconds)}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 text-sm text-jazz-text-dim font-mono">
                  Playlist is empty.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
