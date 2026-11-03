'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ProfileDto } from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import { useProfileAdmin } from '@/hooks/admin/useProfileAdmin';

export default function AdminProfilePage() {
  const {
    profile: cachedProfile,
    isLoading,
    queryError,
    mutationError,
    clearMutationError,
    saveProfile,
    uploadAvatar,
    setProfileCache,
  } = useProfileAdmin();

  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (cachedProfile) {
      setProfile(cachedProfile);
    }
  }, [cachedProfile]);

  const handleInputChange = (field: keyof ProfileDto, localeKey: string, value: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      [field]: {
        ...(profile[field] as Record<string, string>),
        [localeKey]: value,
      },
    });
  };

  const handleLinkChange = (field: 'socialLinks' | 'contactInfo', key: string, value: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      [field]: {
        ...(profile[field] as Record<string, string>),
        [key]: value,
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    clearMutationError();
    setSuccessMessage(null);

    try {
      const cloudfrontUrl = await uploadAvatar.mutateAsync({
        file,
        onProgress: (msg) => setSuccessMessage(msg),
      });
      const next = { ...profile, avatarUrl: cloudfrontUrl };
      setProfile(next);
      setProfileCache(next);
      setSuccessMessage('Avatar uploaded successfully!');
    } catch {
      setSuccessMessage(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    clearMutationError();
    setSuccessMessage(null);

    try {
      await saveProfile.mutateAsync(profile);
      setSuccessMessage('Profile updated successfully!');
    } catch {
      // surfaced via mutationError
    }
  };

  if (isLoading) {
    return (
      <div className="text-sm font-mono text-jazz-gold animate-pulse">
        Loading Profile Editor...
      </div>
    );
  }

  if (queryError || !profile) {
    return (
      <div className="text-sm font-mono text-red-400">
        {queryError || 'Failed to load profile record.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">Profile Editor</h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Update multilingual descriptions, upload avatars, and manage your contacts.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl border text-xs font-mono bg-jazz-gold/10 border-jazz-gold/30 text-jazz-gold">
          {successMessage}
        </div>
      )}
      <MutationErrorBanner
        message={mutationError}
        onDismiss={() => {
          clearMutationError();
          setSuccessMessage(null);
        }}
      />

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 rounded-full bg-jazz-charcoal overflow-hidden border border-jazz-slate flex items-center justify-center text-4xl">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt="Avatar preview"
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              '🤵'
            )}
          </div>
          <div>
            <h4 className="text-sm font-heading font-bold text-jazz-gold mb-2">
              Upload Profile Avatar
            </h4>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="text-xs text-jazz-text-dim file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-jazz-slate/40 file:text-jazz-text hover:file:bg-jazz-gold hover:file:text-jazz-black file:cursor-pointer transition-all"
            />
            <p className="text-[10px] text-jazz-text-dim mt-2 font-mono">
              Supported formats: JPEG, PNG, WEBP, AVIF (Max 5MB)
            </p>
          </div>
        </div>

        {['name', 'title', 'introduction', 'bio'].map((field) => (
          <div
            key={field}
            className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5"
          >
            <h3 className="text-sm font-heading font-bold text-jazz-gold uppercase tracking-wider border-b border-jazz-slate pb-2">
              {field} Translations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['en', 'vi', 'ja'].map((lang) => (
                <div key={lang}>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-jazz-text-dim mb-1">
                    {lang.toUpperCase()} Value
                  </label>
                  {field === 'bio' || field === 'introduction' ? (
                    <textarea
                      rows={3}
                      value={
                        (profile[field as keyof ProfileDto] as Record<string, string>)?.[lang] || ''
                      }
                      onChange={(e) =>
                        handleInputChange(field as keyof ProfileDto, lang, e.target.value)
                      }
                      className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl p-3.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
                    />
                  ) : (
                    <input
                      type="text"
                      value={
                        (profile[field as keyof ProfileDto] as Record<string, string>)?.[lang] || ''
                      }
                      onChange={(e) =>
                        handleInputChange(field as keyof ProfileDto, lang, e.target.value)
                      }
                      className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
              Social Links
            </h3>
            {['github', 'linkedin', 'twitter'].map((social) => (
              <div key={social}>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-jazz-text-dim mb-1">
                  {social}
                </label>
                <input
                  type="url"
                  value={profile.socialLinks?.[social] || ''}
                  onChange={(e) => handleLinkChange('socialLinks', social, e.target.value)}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
                  placeholder="https://..."
                />
              </div>
            ))}
          </div>

          <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
              Contact Info
            </h3>
            {['email', 'phone', 'location'].map((contact) => (
              <div key={contact}>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-jazz-text-dim mb-1">
                  {contact}
                </label>
                <input
                  type="text"
                  value={profile.contactInfo?.[contact] || ''}
                  onChange={(e) => handleLinkChange('contactInfo', contact, e.target.value)}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
                  placeholder={contact === 'email' ? 'contact@io.com' : ''}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-heading font-bold text-jazz-gold">Enable Music Player</h3>
            <p className="text-xs text-jazz-text-muted mt-1">
              Toggle this setting off to hide the background music player interface on the public
              site and save media streaming bandwidth.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={profile.isMusicEnabled ?? true}
              onChange={(e) => setProfile({ ...profile, isMusicEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
          </label>
        </div>

        <button
          type="submit"
          disabled={saveProfile.isPending}
          className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-3.5 px-8 rounded-xl transition-all w-fit shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 text-sm"
        >
          {saveProfile.isPending ? 'Saving changes...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
