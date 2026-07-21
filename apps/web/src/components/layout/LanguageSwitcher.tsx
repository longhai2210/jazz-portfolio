'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { FiChevronDown } from 'react-icons/fi';

const UKFlag = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 rounded-full overflow-hidden shrink-0 shadow-sm">
    <circle cx="12" cy="12" r="12" fill="#00247d" />
    <path d="M0,0 L24,24 M24,0 L0,24" stroke="#ffffff" strokeWidth="3" />
    <path d="M0,0 L24,24 M24,0 L0,24" stroke="#cf142b" strokeWidth="1.5" />
    <path d="M12,0 L12,24 M0,12 L24,12" stroke="#ffffff" strokeWidth="5" />
    <path d="M12,0 L12,24 M0,12 L24,12" stroke="#cf142b" strokeWidth="3" />
  </svg>
);

const VietnamFlag = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 rounded-full overflow-hidden shrink-0 shadow-sm">
    <circle cx="12" cy="12" r="12" fill="#da251d" />
    <polygon points="12,7.5 13.35,11.5 17.5,11.5 14.15,14 15.5,18 12,15.5 8.5,18 9.85,14 6.5,11.5 10.65,11.5" fill="#ffde00" />
  </svg>
);

const JapanFlag = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-jazz-slate/40 shadow-sm">
    <circle cx="12" cy="12" r="12" fill="#ffffff" />
    <circle cx="12" cy="12" r="4.8" fill="#bc002d" />
  </svg>
);

const FLAG_MAP = {
  en: { label: 'English', shortLabel: 'EN', Flag: UKFlag },
  vi: { label: 'Tiếng Việt', shortLabel: 'VI', Flag: VietnamFlag },
  ja: { label: '日本語', shortLabel: 'JA', Flag: JapanFlag },
};

export default function LanguageSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (locale: string) => {
    const pathWithoutLocale = pathname.replace(new RegExp(`^/(${routing.locales.join('|')})`), '');
    const newPath = `/${locale}${pathWithoutLocale || '/'}`;
    router.push(newPath);
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentItem = FLAG_MAP[currentLocale as keyof typeof FLAG_MAP] || FLAG_MAP.en;
  const CurrentFlag = currentItem.Flag;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-jazz-charcoal/80 hover:bg-jazz-charcoal backdrop-blur-md px-3.5 py-2 rounded-full border border-jazz-slate hover:border-jazz-gold/60 text-jazz-text hover:text-jazz-gold transition-all duration-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-jazz-gold/50"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <CurrentFlag />
        <span className="text-sm font-medium">{currentItem.shortLabel}</span>
        <FiChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-jazz-gold' : 'text-jazz-text-muted'}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-jazz-dark/95 backdrop-blur-lg border border-jazz-slate rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {routing.locales.map((locale) => {
            const item = FLAG_MAP[locale as keyof typeof FLAG_MAP];
            if (!item) return null;
            const OptionFlag = item.Flag;
            const isActive = currentLocale === locale;

            return (
              <button
                key={locale}
                onClick={() => handleLanguageChange(locale)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:bg-jazz-slate/40 ${
                  isActive ? 'text-jazz-gold bg-jazz-slate/25 font-medium' : 'text-jazz-text-muted hover:text-jazz-text'
                }`}
                role="option"
                aria-selected={isActive}
              >
                <OptionFlag />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
