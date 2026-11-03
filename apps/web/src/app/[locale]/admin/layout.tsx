'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ApiRoutes, AuthUserDto } from '@jazz-portfolio/shared';
import { useAuthStore } from '@/stores/authStore';
import { AdminApiClient } from '@/lib/api-admin';
import {
  clearAdminSessionMarker,
  setAdminSessionMarker,
} from '@/lib/admin-session-cookie';
import JazzIcon from '@/components/common/JazzIcon';
import AdminQueryProvider from '@/providers/AdminQueryProvider';
import { useAdminStats } from '@/hooks/admin/useAdminStats';

interface AdminLayoutProps {
  children: React.ReactNode;
}

function SidebarNav({
  pathname,
  locale,
}: {
  pathname: string;
  locale: string;
}) {
  const { stats } = useAdminStats();

  const menuItems = [
    { href: `/${locale}/admin`, label: 'Dashboard', icon: '📊' },
    { href: `/${locale}/admin/contact`, label: 'Inbox', icon: '📬' },
    { href: `/${locale}/admin/posts`, label: 'Blog Posts', icon: '📝' },
    {
      href: `/${locale}/admin/comments`,
      label: 'Comments',
      icon: '💬',
      badge: stats.pendingComments && stats.pendingComments > 0 ? stats.pendingComments : undefined,
    },
    { href: `/${locale}/admin/profile`, label: 'Profile Editor', icon: '🤵' },
    { href: `/${locale}/admin/categories`, label: 'Categories', icon: '📁' },
    { href: `/${locale}/admin/music`, label: 'Music Manager', icon: '🎵' },
    { href: `/${locale}/admin/settings`, label: 'System Settings', icon: '⚙️' },
  ];

  return (
    <nav className="p-4 flex flex-col gap-1.5">
      {menuItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== `/${locale}/admin` && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-jazz-gold/10 text-jazz-gold border border-jazz-gold/20'
                : 'text-jazz-text-muted hover:text-jazz-gold hover:bg-jazz-charcoal/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </div>

            {item.badge !== undefined && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const { isAuthenticated, username, hydrated, setSession, clearSession } = useAuthStore();
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname.endsWith('/admin/login');

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const res = await AdminApiClient.get<AuthUserDto>(ApiRoutes.auth.me());
        if (cancelled) return;
        if (res.data?.username) {
          setSession(res.data.username);
          setAdminSessionMarker();
          if (isLoginPage) {
            router.replace(`/${locale}/admin`);
          }
        } else {
          clearSession();
          clearAdminSessionMarker();
          if (!isLoginPage) {
            router.replace(`/${locale}/admin/login`);
          }
        }
      } catch {
        if (cancelled) return;
        clearSession();
        clearAdminSessionMarker();
        if (!isLoginPage) {
          router.replace(`/${locale}/admin/login`);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [isLoginPage, locale, router, setSession, clearSession]);

  const handleLogout = async () => {
    try {
      await AdminApiClient.post(ApiRoutes.auth.logout());
    } catch {
      // Still clear local session if the API call fails
    }
    clearSession();
    clearAdminSessionMarker();
    router.push(`/${locale}/admin/login`);
  };

  if (checking || !hydrated) {
    return (
      <div className="min-h-screen bg-jazz-black flex items-center justify-center text-jazz-gold font-mono text-sm">
        🔒 Securing session...
      </div>
    );
  }

  if (isLoginPage) {
    return <AdminQueryProvider>{children}</AdminQueryProvider>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-jazz-black flex items-center justify-center text-jazz-gold font-mono text-sm">
        🔒 Securing session...
      </div>
    );
  }

  return (
    <AdminQueryProvider>
      <div className="min-h-screen bg-jazz-black flex text-jazz-text">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-jazz-dark border-r border-jazz-slate flex flex-col justify-between shrink-0">
          <div>
            {/* Header branding */}
            <div className="px-6 py-6 border-b border-jazz-slate/50">
              <Link
                href={`/${locale}`}
                className="text-xl font-heading font-bold text-jazz-gold tracking-wider flex items-center gap-2"
              >
                <JazzIcon size={24} /> Jazzfolio CMS
              </Link>
              <p className="text-[10px] text-jazz-text-dim mt-1 font-mono uppercase">
                Logged in as: <span className="text-jazz-brass">{username}</span>
              </p>
            </div>

            {/* Menu links list with badges */}
            <SidebarNav pathname={pathname} locale={locale} />
          </div>

          {/* Sidebar Footer (Logout) */}
          <div className="p-4 border-t border-jazz-slate/40 bg-jazz-charcoal/10">
            <button
              onClick={() => {
                void handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 cursor-pointer"
            >
              <span>🚪</span> Log Out
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-16 border-b border-jazz-slate/30 px-8 flex items-center justify-between bg-jazz-dark/40 backdrop-blur-md">
            <h2 className="text-sm font-mono uppercase tracking-widest text-jazz-text-dim">
              Control Center
            </h2>
            <Link
              href={`/${locale}`}
              className="text-xs font-mono text-jazz-gold hover:text-jazz-amber border border-jazz-gold/30 hover:border-jazz-gold px-3.5 py-1.5 rounded-full transition-all"
            >
              ← View Portfolio Site
            </Link>
          </header>

          <div className="flex-1 overflow-y-auto p-8 max-w-5xl w-full mx-auto">{children}</div>
        </main>
      </div>
    </AdminQueryProvider>
  );
}
