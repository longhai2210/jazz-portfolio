'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

interface MobileNavProps {
  navLinks: Array<{ href: string; label: string }>;
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNav({ navLinks, isOpen, onClose }: MobileNavProps) {
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close mobile menu"
        className="fixed inset-0 z-40 bg-jazz-black/60 backdrop-blur-sm animate-fade-in"
      />
      <div className="fixed top-0 right-0 h-full w-[280px] sm:w-[320px] max-w-full z-50 bg-jazz-black/95 border-l border-jazz-gold/20 shadow-2xl flex flex-col pt-24 px-8 pb-8 animate-mobile-nav-in">
        <nav className="flex-1 flex flex-col gap-6" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="text-2xl font-medium text-jazz-gold hover:text-jazz-amber transition-colors duration-300 block"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-6 pt-8 border-t border-jazz-gold/20">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}
