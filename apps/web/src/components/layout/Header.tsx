'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import JazzIcon from '../common/JazzIcon';
import MobileNav from './MobileNav';

interface HeaderProps {
  isBlogEnabled?: boolean;
}

export default function Header({ isBlogEnabled = false }: HeaderProps) {
  const t = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    // Only track sections on the home page (where sections exist)
    if (pathname !== `/${locale}`) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHash(`#${entry.target.id}`);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    const sections = document.querySelectorAll('section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [pathname, locale]);

  const navLinks = [
    { href: `/${locale}#about`, label: t('about'), hash: '#about' },
    { href: `/${locale}#experience`, label: t('experience'), hash: '#experience' },
    { href: `/${locale}#skills`, label: t('skills'), hash: '#skills' },
    { href: `/${locale}#contact`, label: t('contact'), hash: '#contact' },
  ];

  if (isBlogEnabled) {
    navLinks.push({ href: `/${locale}/blog`, label: 'Journal 🎷', hash: '' });
  }

  const isLinkActive = (link: { href: string; hash: string }) => {
    if (link.href.includes('/blog')) {
      return pathname.includes('/blog');
    }
    return pathname === `/${locale}` && activeHash === link.hash;
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-40 bg-jazz-black/60 backdrop-blur-lg border-b border-jazz-slate/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="text-2xl font-heading font-bold text-jazz-gold tracking-wider hover:text-jazz-amber transition-colors duration-300 flex items-center gap-2 relative z-50"
          >
            <JazzIcon size={28} />
            <span>Jazzfolio</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors duration-300 relative group ${
                    isActive ? 'text-jazz-gold' : 'text-jazz-text-muted hover:text-jazz-gold'
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-0.5 bg-jazz-gold transition-all duration-300 ${
                      isActive ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Desktop Controls */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="md:hidden relative z-50 w-8 h-8 flex flex-col justify-center items-center gap-[6px] text-jazz-gold"
            aria-label="Toggle mobile menu"
          >
            <span
              className={`block w-6 h-[2px] bg-current transition-transform duration-300 ${
                isMobileNavOpen ? 'rotate-45 translate-y-[8px]' : ''
              }`}
            />
            <span
              className={`block w-6 h-[2px] bg-current transition-opacity duration-300 ${
                isMobileNavOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-6 h-[2px] bg-current transition-transform duration-300 ${
                isMobileNavOpen ? '-rotate-45 -translate-y-[8px]' : ''
              }`}
            />
          </button>
        </div>
      </header>

      <MobileNav
        navLinks={navLinks}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </>
  );
}
