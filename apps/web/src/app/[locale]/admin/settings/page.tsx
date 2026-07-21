'use client';

import { useState } from 'react';
import { SiteSettingsDto } from '@jazz-portfolio/shared';
import { EmailSettingsForm, PasswordForm } from '@/components/admin/settings';
import { useSettingsAdmin } from '@/hooks/admin/useSettingsAdmin';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'security' | 'email'>('security');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const {
    emailBundle,
    isEmailLoading,
    emailQueryError,
    saveEmailSettings,
    sendTestEmail,
    changePassword,
    emailMutationError,
    passwordMutationError,
    clearEmailMutationError,
    clearPasswordMutationError,
  } = useSettingsAdmin({ enableEmailQuery: activeTab === 'email' });

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">System Settings</h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Manage system configurations, credentials security, and notification delivery options.
        </p>
      </div>

      <div className="flex border-b border-jazz-slate/40 gap-2">
        <button
          onClick={() => setActiveTab('security')}
          className={`px-5 py-3 text-xs font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'security'
              ? 'border-jazz-gold text-jazz-gold font-bold'
              : 'border-transparent text-jazz-text-dim hover:text-jazz-text'
          }`}
        >
          🔒 Security
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`px-5 py-3 text-xs font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            activeTab === 'email'
              ? 'border-jazz-gold text-jazz-gold font-bold'
              : 'border-transparent text-jazz-text-dim hover:text-jazz-text'
          }`}
        >
          ✉️ Email Settings
        </button>
      </div>

      {activeTab === 'security' && (
        <PasswordForm
          saving={changePassword.isPending}
          error={passwordMutationError}
          successMessage={passwordSuccess}
          onClearError={() => {
            clearPasswordMutationError();
            setPasswordSuccess(null);
          }}
          onSubmit={async ({ currentPassword, newPassword }) => {
            setPasswordSuccess(null);
            await changePassword.mutateAsync({ currentPassword, newPassword });
            setPasswordSuccess('Password changed successfully! Keep it secure.');
          }}
        />
      )}

      {activeTab === 'email' && (
        <EmailSettingsForm
          settings={emailBundle?.settings ?? null}
          mailStatus={emailBundle?.status ?? null}
          loading={isEmailLoading}
          saving={saveEmailSettings.isPending}
          testSending={sendTestEmail.isPending}
          error={emailMutationError}
          successMessage={emailSuccess}
          loadError={emailQueryError}
          onClearError={() => {
            clearEmailMutationError();
            setEmailSuccess(null);
          }}
          onSave={async (settings: SiteSettingsDto) => {
            setEmailSuccess(null);
            clearEmailMutationError();
            try {
              await saveEmailSettings.mutateAsync({
                isContactFormEnabled: settings.isContactFormEnabled,
                mailProvider: settings.mailProvider,
                mailFrom: settings.mailFrom,
                mailTo: settings.mailTo,
              });
              setEmailSuccess('Email settings saved successfully!');
            } catch {
              // surfaced via emailMutationError
            }
          }}
          onSendTest={async () => {
            setEmailSuccess(null);
            clearEmailMutationError();
            try {
              await sendTestEmail.mutateAsync();
              setEmailSuccess('Test email dispatched successfully! Verify your inbox.');
            } catch {
              // surfaced via emailMutationError
            }
          }}
        />
      )}
    </div>
  );
}
