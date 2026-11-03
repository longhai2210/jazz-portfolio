'use client';

import { useEffect, useState } from 'react';
import {
  CommentModerationMode,
  FeatureSettingsDto,
  FeatureSettingsStatusDto,
  UpdateFeatureSettingsDto,
} from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';

interface ContentSettingsFormProps {
  settings: FeatureSettingsDto | null;
  status: FeatureSettingsStatusDto | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  successMessage: string | null;
  loadError: string | null;
  onClearError: () => void;
  onSave: (settings: UpdateFeatureSettingsDto) => Promise<void>;
}

export default function ContentSettingsForm({
  settings: initialSettings,
  status,
  loading,
  saving,
  error,
  successMessage,
  loadError,
  onClearError,
  onSave,
}: ContentSettingsFormProps) {
  const [formData, setFormData] = useState<UpdateFeatureSettingsDto | null>(null);

  useEffect(() => {
    if (initialSettings) {
      setFormData({
        isBlogEnabled: initialSettings.isBlogEnabled,
        areCommentsEnabled: initialSettings.areCommentsEnabled,
        commentModerationMode: initialSettings.commentModerationMode,
        isCommentCaptchaEnabled: initialSettings.isCommentCaptchaEnabled,
        commentAutoCloseDays: initialSettings.commentAutoCloseDays,
        commentMaxPerPost: initialSettings.commentMaxPerPost,
        commentSpamThreshold: initialSettings.commentSpamThreshold,
        commentNotifyEmail: initialSettings.commentNotifyEmail,
      });
    }
  }, [initialSettings]);

  if (loading) {
    return (
      <div className="text-sm font-mono text-jazz-gold animate-pulse py-8">
        🎷 Fetching Content Feature Settings...
      </div>
    );
  }

  if (loadError || !formData) {
    return (
      <div className="text-sm text-red-400 font-mono">
        {loadError || 'Failed to display content feature settings.'}
      </div>
    );
  }

  const isBlogOn = formData.isBlogEnabled ?? false;
  const isCaptchaConfigured = status?.captchaConfigured ?? false;

  return (
    <div className="flex flex-col gap-6">
      {successMessage && (
        <div className="p-4 rounded-xl border text-xs font-mono bg-jazz-gold/10 border-jazz-gold/30 text-jazz-gold">
          {successMessage}
        </div>
      )}
      <MutationErrorBanner message={error} onDismiss={onClearError} />

      {status && status.pendingCommentCount > 0 && (
        <div className="p-4 rounded-xl border text-xs font-mono bg-amber-500/10 border-amber-500/30 text-amber-300 flex items-center justify-between">
          <span>💬 {status.pendingCommentCount} comment(s) currently awaiting review.</span>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(formData);
        }}
        className="flex flex-col gap-6"
      >
        {/* Toggle: Blog */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-heading font-bold text-jazz-gold">
                Enable Public Blog / Posts
              </h3>
              <p className="text-xs text-jazz-text-muted mt-1">
                When enabled, published blog posts are accessible at <code className="text-jazz-gold font-mono">/[locale]/blog</code>.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isBlogEnabled ?? false}
                onChange={(e) => {
                  const blogOn = e.target.checked;
                  setFormData({
                    ...formData,
                    isBlogEnabled: blogOn,
                    areCommentsEnabled: blogOn ? formData.areCommentsEnabled : false,
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
            </label>
          </div>
          {!isBlogOn && (
            <div className="text-[11px] font-mono text-amber-400/90 bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5">
              ⚠️ Note: Public blog routes will return 404 Not Found while Blog is disabled.
            </div>
          )}
        </div>

        {/* Toggle: Comments */}
        <div
          className={`bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-3 transition-opacity ${
            !isBlogOn ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-heading font-bold text-jazz-gold">
                Enable Public Comments
              </h3>
              <p className="text-xs text-jazz-text-muted mt-1">
                Allows visitors to post comments on published blog articles. Requires Blog to be enabled.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={!isBlogOn}
                checked={formData.areCommentsEnabled ?? false}
                onChange={(e) =>
                  setFormData({ ...formData, areCommentsEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
            </label>
          </div>
        </div>

        {/* Moderation & Security Settings */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
            Moderation & Anti-Abuse Controls
          </h3>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Comment Moderation Mode
            </label>
            <select
              value={formData.commentModerationMode ?? CommentModerationMode.ALL}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commentModerationMode: e.target.value as CommentModerationMode,
                })
              }
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono cursor-pointer"
            >
              <option value={CommentModerationMode.ALL}>
                Moderate All (All new comments queue for admin review - Recommended)
              </option>
              <option value={CommentModerationMode.SPAM_ONLY}>
                Spam Only (Auto-approve clean comments; queue flagged ones)
              </option>
              <option value={CommentModerationMode.CLOSED}>
                Closed (Reject all new comment submissions)
              </option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
                  Require Cloudflare Turnstile CAPTCHA
                </label>
                <p className="text-xs text-jazz-text-muted mt-0.5">
                  Protects comment submissions with Cloudflare Turnstile.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={!isCaptchaConfigured}
                  checked={formData.isCommentCaptchaEnabled ?? false}
                  onChange={(e) =>
                    setFormData({ ...formData, isCommentCaptchaEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
              </label>
            </div>
            {!isCaptchaConfigured && (
              <div className="text-[11px] font-mono text-yellow-400 bg-yellow-950/20 border border-yellow-500/30 rounded-lg p-2.5">
                ⚠ Cannot enable CAPTCHA: missing TURNSTILE_SECRET_KEY in server environment variables.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Spam Score Threshold (0 – 100): <span className="text-jazz-gold font-bold">{formData.commentSpamThreshold ?? 60}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={formData.commentSpamThreshold ?? 60}
              onChange={(e) =>
                setFormData({ ...formData, commentSpamThreshold: Number(e.target.value) })
              }
              className="w-full h-2 bg-jazz-charcoal rounded-lg appearance-none cursor-pointer accent-jazz-gold"
            />
            <p className="text-[11px] text-jazz-text-muted mt-1 font-mono">
              Comments scoring at or above this value are automatically classified as SPAM.
            </p>
          </div>
        </div>

        {/* Policy & Limits */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
            Limits & Notifications
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                Auto-Close Comments After Days (0 = never)
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={formData.commentAutoCloseDays ?? 0}
                onChange={(e) =>
                  setFormData({ ...formData, commentAutoCloseDays: Number(e.target.value) })
                }
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                Maximum Comments Per Post
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={formData.commentMaxPerPost ?? 500}
                onChange={(e) =>
                  setFormData({ ...formData, commentMaxPerPost: Number(e.target.value) })
                }
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
                Email Notification on New Comments
              </label>
              <p className="text-xs text-jazz-text-muted mt-0.5">
                Send batched email notifications when new comments arrive in the queue.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.commentNotifyEmail ?? true}
                onChange={(e) =>
                  setFormData({ ...formData, commentNotifyEmail: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-start mt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 text-sm cursor-pointer"
          >
            {saving ? 'Saving Configurations...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
