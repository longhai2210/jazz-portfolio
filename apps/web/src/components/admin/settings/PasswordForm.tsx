'use client';

import { useState } from 'react';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';

interface PasswordFormProps {
  saving: boolean;
  error: string | null;
  successMessage: string | null;
  onClearError: () => void;
  onSubmit: (values: { currentPassword: string; newPassword: string }) => Promise<void>;
}

export default function PasswordForm({
  saving,
  error,
  successMessage,
  onClearError,
  onSubmit,
}: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearError();

    if (newPassword !== confirmPassword) {
      setLocalError('New passwords do not match.');
      return;
    }

    try {
      await onSubmit({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // Parent surfaces mutation error; keep form values for retry.
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {successMessage && (
        <div className="p-4 rounded-xl border text-xs font-mono bg-jazz-gold/10 border-jazz-gold/30 text-jazz-gold">
          {successMessage}
        </div>
      )}
      <MutationErrorBanner
        message={localError || error}
        onDismiss={() => {
          setLocalError(null);
          onClearError();
        }}
      />

      <div className="bg-jazz-dark/50 border border-jazz-slate p-6 md:p-8 rounded-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 text-sm mt-2 w-fit cursor-pointer"
          >
            {saving ? 'Changing password...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
