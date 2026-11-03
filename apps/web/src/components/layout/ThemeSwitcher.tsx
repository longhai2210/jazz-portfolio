'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!mounted) {
    return (
      <div className="w-18 h-9 rounded-full bg-jazz-charcoal/50 border border-jazz-slate/40" />
    );
  }

  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative w-18 h-9 rounded-full bg-jazz-charcoal/80 border border-jazz-slate hover:border-jazz-gold/60 flex items-center justify-between px-2 cursor-pointer transition-colors duration-300 select-none"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-pressed={!isDark}
    >
      <span className={isDark ? 'text-jazz-gold' : 'text-jazz-text-dim'}>
        <MoonIcon />
      </span>
      <span className={!isDark ? 'text-jazz-gold' : 'text-jazz-text-dim'}>
        <SunIcon />
      </span>
      <span
        aria-hidden="true"
        className={`absolute left-1 w-6 h-6 rounded-full bg-jazz-black border border-jazz-gold/50 shadow-md transition-transform duration-300 ${isDark ? 'translate-x-0' : 'translate-x-9'}`}
      >
        <span className="absolute inset-1 rounded-full border border-jazz-slate/20" />
        <span className="absolute inset-[9px] rounded-full bg-jazz-gold" />
      </span>
    </button>
  );
}
