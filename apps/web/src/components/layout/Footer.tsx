import { getTranslations } from 'next-intl/server';
import JazzIcon from '../common/JazzIcon';

interface FooterProps {
  locale: string;
}

export default async function Footer({ locale }: FooterProps) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-jazz-dark border-t border-jazz-slate/50 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Branding */}
        <div className="text-center md:text-left">
          <h2 className="text-lg font-heading text-jazz-gold font-bold flex items-center gap-2">
            <JazzIcon size={24} /> Jazzfolio
          </h2>
          <p className="text-xs text-jazz-text-dim mt-1">Improvising code, composing experiences.</p>
        </div>

        {/* Links */}
        <div className="flex gap-6 text-sm text-jazz-text-muted">
          <a href="#about" className="hover:text-jazz-gold transition-colors duration-300">About</a>
          <a href="#experience" className="hover:text-jazz-gold transition-colors duration-300">Experience</a>
          <a href="#skills" className="hover:text-jazz-gold transition-colors duration-300">Skills</a>
        </div>

        {/* Copyright */}
        <div className="text-xs text-jazz-text-dim">
          {t('copyright', { year: currentYear })}
        </div>
      </div>
    </footer>
  );
}
