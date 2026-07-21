'use client';

import { useEffect, useState } from 'react';
import { MailStatusDto, SiteSettingsDto } from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';

interface EmailSettingsFormProps {
  settings: SiteSettingsDto | null;
  mailStatus: MailStatusDto | null;
  loading: boolean;
  saving: boolean;
  testSending: boolean;
  error: string | null;
  successMessage: string | null;
  loadError: string | null;
  onClearError: () => void;
  onSave: (settings: SiteSettingsDto) => Promise<void>;
  onSendTest: () => Promise<void>;
}

export default function EmailSettingsForm({
  settings: initialSettings,
  mailStatus,
  loading,
  saving,
  testSending,
  error,
  successMessage,
  loadError,
  onClearError,
  onSave,
  onSendTest,
}: EmailSettingsFormProps) {
  const [settings, setSettings] = useState<SiteSettingsDto | null>(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  if (loading) {
    return (
      <div className="text-sm font-mono text-jazz-gold animate-pulse py-8">
        🎺 Fetching Email Configurations...
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="text-sm text-red-400 font-mono">
        {loadError || 'Failed to display configurations.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {successMessage && (
        <div className="p-4 rounded-xl border text-xs font-mono bg-jazz-gold/10 border-jazz-gold/30 text-jazz-gold">
          {successMessage}
        </div>
      )}
      <MutationErrorBanner message={error} onDismiss={onClearError} />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await onSave(settings);
        }}
        className="flex flex-col gap-6"
      >
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-heading font-bold text-jazz-gold">
              Enable Public Contact Form
            </h3>
            <p className="text-xs text-jazz-text-muted mt-1">
              When enabled, visitors can fill out and submit the contact form on your public landing
              page.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.isContactFormEnabled}
              onChange={(e) =>
                setSettings({ ...settings, isContactFormEnabled: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
          </label>
        </div>

        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
            Mail Delivery Provider
          </h3>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Active Delivery Provider
            </label>
            <select
              value={settings.mailProvider}
              onChange={(e) => setSettings({ ...settings, mailProvider: e.target.value })}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono cursor-pointer"
            >
              <option value="resend">Resend SDK (Recommended)</option>
              <option value="smtp">Custom SMTP Server (Nodemailer)</option>
            </select>
          </div>

          <div className="mt-2">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-jazz-text-dim mb-1">
              Environment Credentials Status
            </label>
            {settings.mailProvider === 'resend' ? (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
                  mailStatus?.hasApiKey
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-yellow-950/20 border-yellow-500/30 text-yellow-400'
                }`}
              >
                {mailStatus?.hasApiKey
                  ? '✔ Resend API key is configured in env (RESEND_API_KEY)'
                  : '⚠ Missing RESEND_API_KEY in server environment variables'}
              </div>
            ) : (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
                  mailStatus?.hasSmtpCredentials
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-yellow-950/20 border-yellow-500/30 text-yellow-400'
                }`}
              >
                {mailStatus?.hasSmtpCredentials
                  ? '✔ SMTP Credentials configured (SMTP_HOST, USER, PASS)'
                  : '⚠ Missing SMTP environment configurations on server'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
            Routing Configurations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                Sender Email (From)
              </label>
              <input
                type="email"
                required
                value={settings.mailFrom}
                onChange={(e) => setSettings({ ...settings, mailFrom: e.target.value })}
                placeholder="notifications@yourdomain.com"
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                Recipient Email (To)
              </label>
              <input
                type="email"
                required
                value={settings.mailTo}
                onChange={(e) => setSettings({ ...settings, mailTo: e.target.value })}
                placeholder="contact@yourdomain.com"
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 text-sm cursor-pointer"
          >
            {saving ? 'Saving Configurations...' : 'Save Settings'}
          </button>

          <button
            type="button"
            onClick={() => onSendTest()}
            disabled={testSending || !mailStatus?.isConfigured}
            className="px-6 py-3.5 border border-jazz-slate text-jazz-text hover:border-jazz-gold hover:text-jazz-gold rounded-xl transition-all font-mono text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={
              !mailStatus?.isConfigured
                ? 'Save a valid configuration first to send test emails'
                : ''
            }
          >
            {testSending ? 'Sending Test...' : '⚡ Send Test Email'}
          </button>
        </div>
      </form>
    </div>
  );
}
