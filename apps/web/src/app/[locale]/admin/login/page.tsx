'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ApiRoutes, AuthResponseDto } from '@jazz-portfolio/shared';
import { useAuthStore } from '@/stores/authStore';
import { AdminApiClient } from '@/lib/api-admin';
import { setAdminSessionMarker } from '@/lib/admin-session-cookie';
import JazzIcon from '@/components/common/JazzIcon';

export default function AdminLoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const { setSession, isAuthenticated, hydrated } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace(`/${locale}/admin`);
    }
  }, [hydrated, isAuthenticated, router, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await AdminApiClient.post<AuthResponseDto>(ApiRoutes.auth.login(), {
        username,
        password,
      });

      if (res.data?.username) {
        setSession(res.data.username);
        setAdminSessionMarker();
        router.push(`/${locale}/admin`);
      } else {
        setError('Login succeeded but no session identity was returned.');
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jazz-black flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background visual effects */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-jazz-gold/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-jazz-dark border border-jazz-slate p-8 md:p-10 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-10 relative group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-jazz-gold to-transparent" />

        {/* Branding header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-jazz-gold flex items-center justify-center gap-2">
            <JazzIcon size={24} /> Admin Login
          </h1>
          <p className="text-xs text-jazz-text-dim mt-2 uppercase tracking-widest">
            Jazzfolio CMS Management
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-xs px-4 py-3 rounded-lg font-mono">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-muted mb-2">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-muted mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold py-3.5 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 mt-2 text-sm"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
