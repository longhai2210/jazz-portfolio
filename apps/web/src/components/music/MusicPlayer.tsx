'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAudioStore } from '@/stores/audioStore';
import AudioVisualizer from './AudioVisualizer';
import PlaylistDrawer from './PlaylistDrawer';

export default function MusicPlayer() {
  const t = useTranslations('music');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  const {
    playlist,
    currentTrackIndex,
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    nextTrack,
    prevTrack,
    togglePlay,
    toggleMute,
    setVolume,
  } = useAudioStore();

  const [hasInteracted, setHasInteracted] = useState(false);

  const currentTrack = playlist[currentTrackIndex];

  // 1. Initialize audio element state listeners (re-bind when track src changes)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () =>
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => nextTrack();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    onTimeUpdate();
    onDurationChange();

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.cloudfrontUrl, setCurrentTime, setDuration, nextTrack]);

  // 2. Control play/pause states based on Zustand state updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let active = true;

    if (isPlaying) {
      audio.play().catch((err) => {
        if (!active) return;
        // Log playback errors (e.g., autoplay blocked)
        console.warn('Playback blocked by browser policy:', err);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
    return () => {
      active = false;
    };
  }, [isPlaying, currentTrackIndex, currentTrack?.cloudfrontUrl, setIsPlaying]);

  // 3. Sync volume and mute configurations
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted, currentTrack?.cloudfrontUrl]);

  // 4. Capture initial interaction to handle autoplay prompts
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  const formatTime = (time: number) => {
    if (!Number.isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const seekTime = Math.min(parseFloat(e.target.value), Number.isFinite(duration) ? duration : 0);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (vol > 0 && isMuted) {
      toggleMute();
    }
  };

  return (
    <>
      {/* Hidden Global Audio Element */}
      {currentTrack && <audio ref={audioRef} src={currentTrack.cloudfrontUrl} preload="metadata" />}

      {/* Floating Bottom Music Player */}
      <div className="fixed bottom-0 left-0 w-full z-40 bg-jazz-dark/95 backdrop-blur-xl border-t border-jazz-slate/60 h-24 flex items-center px-3 sm:px-6 shadow-[0_-5px_25px_rgba(0,0,0,0.5)] bg-smoky-grain">
        {/* Ambient Stage Glow Border */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-jazz-gold/45 to-transparent animate-glow-breathe z-10" />

        <div className="max-w-7xl mx-auto w-full grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:flex sm:justify-between sm:gap-4 z-10">
          {/* Column 1: Track Info, Mechanical Vinyl Record & Visualizer */}
          <div className="min-w-0 flex-1 md:w-1/4 md:min-w-[220px] flex items-center gap-2 sm:gap-4">
            {/* Vinyl Record Deck */}
            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
              {/* Record Plate Body (circular vinyl) */}
              <div
                className={`relative w-11 h-11 rounded-full border flex items-center justify-center overflow-hidden transition-all duration-1000 ${
                  isPlaying
                    ? 'animate-spin border-jazz-gold/60 shadow-[0_0_20px_rgba(212,165,116,0.45)] scale-102'
                    : 'border-jazz-gold/45 shadow-[0_4px_12px_rgba(0,0,0,0.5),_0_0_8px_rgba(212,165,116,0.15)]'
                }`}
                style={{
                  animationDuration: '3.5s',
                  animationTimingFunction: 'linear',
                  background: 'radial-gradient(circle, var(--color-jazz-slate) 5%, #09090b 100%)',
                }}
              >
                {/* Vinyl Grooves */}
                <div className="absolute inset-1 rounded-full border border-neutral-900/60" />
                <div className="absolute inset-2 rounded-full border border-neutral-900/40" />
                <div className="absolute inset-3 rounded-full border border-neutral-900/20" />

                {/* Conic Shimmer Reflection */}
                <div className="absolute inset-0 vinyl-reflection pointer-events-none" />

                {/* Center Record Label (Gold center) */}
                <div className="w-3.5 h-3.5 rounded-full bg-jazz-gold flex items-center justify-center z-10 border border-neutral-950 shadow-inner">
                  {/* Spindle hole */}
                  <div className="w-1 h-1 rounded-full bg-jazz-black" />
                </div>
              </div>

              {/* Mechanical Tonearm */}
              <div
                className="absolute top-1 right-1 w-5 h-8 transition-transform duration-500 ease-out z-20"
                style={{
                  transform: isPlaying ? 'rotate(22deg)' : 'rotate(0deg)',
                  transformOrigin: '80% 15%',
                }}
              >
                <svg
                  className="w-full h-full text-jazz-gold drop-shadow-md"
                  viewBox="0 0 20 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Pivot Base */}
                  <circle cx="16" cy="4" r="3" fill="#D4A574" stroke="#171717" strokeWidth="0.5" />
                  <circle cx="16" cy="4" r="1" fill="#171717" />

                  {/* Arm Shaft */}
                  <path
                    d="M16 4C14 12 11 18 6 25"
                    stroke="#D4A574"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />

                  {/* Needle Cartridge Head */}
                  <path
                    d="M7 23.5L4 27.5L3 27L5 23"
                    fill="#A78BFA"
                    stroke="#D4A574"
                    strokeWidth="0.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Title / Artist details */}
            <div className="overflow-hidden flex-1 text-left max-w-[150px] md:max-w-[200px]">
              <div className="relative h-5 overflow-hidden hover-pause-marquee">
                {currentTrack && currentTrack.title.length > 20 ? (
                  <div className="whitespace-nowrap animate-marquee inline-block pr-8">
                    <span className="text-sm font-heading font-bold text-jazz-gold">
                      {currentTrack.title}
                    </span>
                    <span className="mx-4 text-jazz-text-muted">•</span>
                    <span className="text-sm font-heading font-bold text-jazz-gold">
                      {currentTrack.title}
                    </span>
                  </div>
                ) : (
                  <h3
                    className="text-sm font-heading font-bold text-jazz-gold truncate"
                    title={currentTrack?.title}
                  >
                    {currentTrack ? currentTrack.title : 'No Track Selected'}
                  </h3>
                )}
              </div>
              <p
                className="text-xs text-jazz-text-muted truncate mt-0.5"
                title={currentTrack?.artist}
              >
                {currentTrack ? currentTrack.artist : 'Silence'}
              </p>
            </div>

            {/* Visualizer bars */}
            <div className="hidden md:block shrink-0">
              <AudioVisualizer isPlaying={isPlaying} />
            </div>
          </div>

          {/* Section Divider */}
          <div className="hidden md:block h-8 w-px bg-jazz-slate/30 shrink-0" />

          {/* Column 2: Centered Transport Controls & Progress Slider */}
          <div className="contents sm:flex sm:flex-1 sm:max-w-sm md:max-w-md sm:flex-col sm:items-center sm:gap-2">
            <div className="col-start-2 row-start-1 flex items-center justify-center gap-3 sm:gap-5">
              {/* Previous Track Button */}
              <button
                onClick={prevTrack}
                disabled={playlist.length <= 1}
                className="text-jazz-text-muted hover:text-jazz-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95 cursor-pointer ripple-active"
                aria-label="Previous track"
              >
                <svg
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              {/* Play / Pause Toggle Button */}
              <button
                onClick={togglePlay}
                disabled={!currentTrack}
                className="w-11 h-11 rounded-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(212,165,116,0.25)] hover:shadow-[0_0_20px_rgba(212,165,116,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer ripple-active"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg
                    className="w-5.5 h-5.5 fill-current"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-5.5 h-5.5 fill-current"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M9 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next Track Button */}
              <button
                onClick={nextTrack}
                disabled={playlist.length <= 1}
                className="text-jazz-text-muted hover:text-jazz-gold disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95 cursor-pointer ripple-active"
                aria-label="Next track"
              >
                <svg
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 18l8.5-6L6 6zm9-12v12h2V6z" />
                </svg>
              </button>
            </div>

            {/* Slider progress bar */}
            <div className="col-start-1 row-start-2 flex w-full min-w-0 items-center gap-2 sm:gap-3 text-[10px] font-mono tracking-wider text-jazz-text-muted select-none">
              <span className="w-8 text-right">{formatTime(currentTime)}</span>

              <div className="flex-1 relative py-1">
                {/* Custom progress rail */}
                <div className="w-full h-1 bg-jazz-charcoal rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-jazz-gold via-jazz-brass to-jazz-amber shadow-[0_0_8px_rgba(212,165,116,0.4)]"
                    style={{ width: `${Math.min(100, (currentTime / (duration || 100)) * 100)}%` }}
                  />
                </div>
                {/* Glowing playhead thumb dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-jazz-gold border-2 border-jazz-black shadow-[0_0_8px_rgba(212,165,116,0.8)] z-10 flex items-center justify-center pointer-events-none"
                  style={{
                    left: `calc(${Math.min(100, (currentTime / (duration || 100)) * 100)}% - 7px)`,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-jazz-black" />
                </div>

                {/* Native invisible range input */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={Math.min(currentTime, duration || 100)}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>

              <span className="w-8 text-left">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Section Divider */}
          <div className="hidden md:block h-8 w-px bg-jazz-slate/30 shrink-0" />

          {/* Column 3: Volume, Drawer Toggle & Autoplay Helper */}
          <div className="col-start-2 row-start-2 w-auto min-w-0 md:w-1/4 md:min-w-[200px] flex items-center justify-end gap-2 sm:gap-4">
            {/* Unmute Prompt Alert */}
            {isMuted && currentTrack && !hasInteracted && (
              <div className="hidden lg:flex items-center gap-2 bg-jazz-gold/10 border border-jazz-gold/30 px-3 py-1 rounded-full text-[10px] text-jazz-gold animate-pulse font-mono uppercase tracking-wider">
                <span>🎺</span>
                <span>{t('unmute')}</span>
              </div>
            )}

            {/* Mute toggle button */}
            <button
              onClick={toggleMute}
              disabled={!currentTrack}
              className="text-jazz-text-muted hover:text-jazz-gold transition-colors hover:scale-105 cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg
                  className="w-5 h-5 fill-current text-red-400"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Volume slider */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-12 sm:w-16 md:w-20 h-1 bg-jazz-charcoal rounded-lg appearance-none cursor-pointer accent-jazz-gold focus:outline-none"
            />

            {/* Playlist Drawer Button */}
            <button
              onClick={() => setIsPlaylistOpen(!isPlaylistOpen)}
              className={`p-2.5 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                isPlaylistOpen
                  ? 'border-jazz-gold bg-jazz-gold/15 text-jazz-gold shadow-[0_0_15px_rgba(212,165,116,0.25)]'
                  : 'border-jazz-slate/80 text-jazz-text-muted hover:text-jazz-gold hover:border-jazz-gold bg-jazz-charcoal/20'
              }`}
              aria-label="Toggle playlist"
            >
              <svg
                className="w-4 h-4 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zm17-4V3h2v9h-2zm-2 4h6v-2h-6v2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Playlist Drawer component */}
      <PlaylistDrawer isOpen={isPlaylistOpen} onClose={() => setIsPlaylistOpen(false)} />
    </>
  );
}
