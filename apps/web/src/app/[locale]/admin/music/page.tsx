'use client';

import { useState } from 'react';
import { buildReorderIds, TrackDto } from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import { useTracksAdmin } from '@/hooks/admin/useTracksAdmin';

export default function AdminMusicPage() {
  const {
    tracks,
    isLoading,
    queryError,
    mutationError,
    clearMutationError,
    uploadTrack,
    deleteTrack,
    toggleTrack,
    reorderTracks,
  } = useTracksAdmin();

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    clearMutationError();
    setUploadProgress(null);

    try {
      await uploadTrack.mutateAsync({
        title,
        artist,
        file,
        onProgress: setUploadProgress,
      });
      setTitle('');
      setArtist('');
      setFile(null);
      setUploadProgress('Success!');
      setTimeout(() => setUploadProgress(null), 3000);
    } catch {
      setUploadProgress(null);
    }
  };

  const handleTrackDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this track?')) return;
    clearMutationError();
    try {
      await deleteTrack.mutateAsync(id);
    } catch {
      // surfaced via mutationError
    }
  };

  const handleTrackToggle = async (track: TrackDto) => {
    clearMutationError();
    try {
      await toggleTrack.mutateAsync(track);
    } catch {
      // surfaced via mutationError
    }
  };

  const handleTrackReorder = async (_id: string, index: number, direction: 'up' | 'down') => {
    const ids = buildReorderIds(
      tracks.map((t) => t.id),
      index,
      direction,
    );
    if (!ids) return;
    clearMutationError();
    try {
      await reorderTracks.mutateAsync(ids);
    } catch {
      // surfaced via mutationError
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">Music & Playlist Manager</h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Manage your background music library. Direct-to-S3 uploading transfers tracks to Amazon S3
          via secure, client-side presigned PUT URLs.
        </p>
      </div>

      <MutationErrorBanner
        message={queryError || mutationError}
        onDismiss={clearMutationError}
      />

      {uploadProgress && (
        <div className="bg-jazz-gold/10 border border-jazz-gold/30 text-jazz-gold p-4 rounded-xl text-xs font-mono">
          {uploadProgress}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2 mb-4">
            Active Playlist Tracks
          </h3>

          {isLoading ? (
            <div className="text-xs font-mono text-jazz-text-dim py-6 animate-pulse">
              Fetching tracks...
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-xs font-mono text-jazz-text-dim py-6">No tracks uploaded yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {tracks.map((track, idx) => (
                <div
                  key={track.id}
                  className={`p-4 rounded-xl border border-jazz-slate flex items-center justify-between transition-all duration-300 ${
                    track.isActive ? 'bg-jazz-charcoal/50' : 'bg-jazz-charcoal/20 opacity-60'
                  }`}
                >
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-semibold text-jazz-text truncate">{track.title}</h4>
                    <p className="text-xs text-jazz-text-muted truncate">{track.artist}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleTrackToggle(track)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                        track.isActive
                          ? 'bg-jazz-gold/10 border-jazz-gold text-jazz-gold'
                          : 'border-jazz-slate text-jazz-text-dim'
                      }`}
                    >
                      {track.isActive ? 'Active' : 'Muted'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTrackReorder(track.id, idx, 'up')}
                      className="text-xs p-1 hover:text-jazz-gold"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrackReorder(track.id, idx, 'down')}
                      className="text-xs p-1 hover:text-jazz-gold"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrackDelete(track.id)}
                      className="text-xs p-1 text-red-400 hover:text-red-300"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
          <h3 className="text-xs font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2 mb-4 uppercase tracking-wider">
            Upload Audio Track
          </h3>
          <form onSubmit={handleFileUpload} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
                Track Title
              </label>
              <input
                type="text"
                required
                placeholder="Take Five"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
                Artist Name
              </label>
              <input
                type="text"
                required
                placeholder="Dave Brubeck"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
                Select MP3 Audio File
              </label>
              <input
                type="file"
                required
                accept="audio/mpeg,audio/wav,audio/ogg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-xs text-jazz-text-dim file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-jazz-slate/40 file:text-jazz-text hover:file:bg-jazz-gold hover:file:text-jazz-black file:cursor-pointer transition-all"
              />
              <p className="text-[10px] text-jazz-text-dim mt-2 font-mono">
                Supported formats: MP3, WAV, OGG, FLAC (Max 50MB)
              </p>
            </div>

            <button
              type="submit"
              disabled={uploadTrack.isPending || !file}
              className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 mt-2 text-xs w-full"
            >
              {uploadTrack.isPending ? 'Uploading Track...' : 'Upload Track'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
