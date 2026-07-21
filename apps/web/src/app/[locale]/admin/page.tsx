'use client';

import JazzIcon from '@/components/common/JazzIcon';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import { useAdminStats } from '@/hooks/admin/useAdminStats';

export default function AdminDashboardPage() {
  const { stats, isLoading, error } = useAdminStats();

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome banner */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">Welcome to your Dashboard</h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Manage your portfolio content, adjust skills, add career timelines, and maintain your
          background music playlist.
        </p>
      </div>

      <MutationErrorBanner message={error} />

      {/* Stats row */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-jazz-dark border border-jazz-slate rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl relative overflow-hidden group">
            <span className="text-4xl absolute right-4 bottom-4 opacity-10">📁</span>
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
              Categories
            </h3>
            <p className="text-4xl font-heading font-bold text-jazz-gold mt-4">{stats.categories}</p>
            <p className="text-xs text-jazz-text-muted mt-2">Active portfolio sections</p>
          </div>

          <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl relative overflow-hidden group">
            <span className="text-4xl absolute right-4 bottom-4 opacity-10">💼</span>
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
              Portfolio Items
            </h3>
            <p className="text-4xl font-heading font-bold text-jazz-gold mt-4">{stats.items}</p>
            <p className="text-xs text-jazz-text-muted mt-2">Skills tags and work histories</p>
          </div>

          <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl relative overflow-hidden group">
            <span className="text-4xl absolute right-4 bottom-4 opacity-10">🎵</span>
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">Tracks</h3>
            <p className="text-4xl font-heading font-bold text-jazz-gold mt-4">{stats.tracks}</p>
            <p className="text-xs text-jazz-text-muted mt-2">Background playlist items</p>
          </div>
        </div>
      )}

      {/* Guide details */}
      <div className="bg-jazz-dark/30 border border-jazz-slate p-8 rounded-2xl">
        <h3 className="text-lg font-heading font-bold text-jazz-gold mb-4 flex items-center gap-2">
          <JazzIcon size={24} /> Quick Tips for Administrators
        </h3>
        <ul className="list-disc list-inside space-y-3 text-sm text-jazz-text-muted">
          <li>
            Use the <strong className="text-jazz-brass">Profile Editor</strong> to update your hero
            headline and contact information immediately.
          </li>
          <li>
            Dynamic layout sections are created via the{' '}
            <strong className="text-jazz-brass">Categories Manager</strong>. You can soft-delete
            elements or drag them to reorder their layout positions.
          </li>
          <li>
            Upload new audio tracks in the <strong className="text-jazz-brass">Music Manager</strong>
            . Direct S3 uploads utilize presigned PUT URLs, bypassing the application server.
          </li>
          <li>
            Set long passwords and update them inside{' '}
            <strong className="text-jazz-brass">Security Settings</strong> periodically.
          </li>
        </ul>
      </div>
    </div>
  );
}
