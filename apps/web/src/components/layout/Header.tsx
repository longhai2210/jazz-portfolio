'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import JazzIcon from '../common/JazzIcon';


export default function Header() {
  const t = useTranslations('common');
  const locale = useLocale();

  const navLinks = [
    { href: `#about`, label: t('about') },
    { href: `#experience`, label: t('experience') },
    { href: `#skills`, label: t('skills') },
    { href: `#contact`, label: t('contact') },
  ];

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-jazz-black/60 backdrop-blur-lg border-b border-jazz-slate/50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link 
          href={`/${locale}`}
          className="text-2xl font-heading font-bold text-jazz-gold tracking-wider hover:text-jazz-amber transition-colors duration-300 flex items-center gap-2"
        >
          <JazzIcon size={28} />
          <span>Jazzfolio</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-jazz-text-muted hover:text-jazz-gold transition-colors duration-300 relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-jazz-gold transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
