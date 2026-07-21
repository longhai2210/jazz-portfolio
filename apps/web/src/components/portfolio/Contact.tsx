'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import ScrollReveal from '../animation/ScrollReveal';
import ContactForm from './ContactForm';
import { ProfileDto } from '@jazz-portfolio/shared';
import {
  JazzMarkCheck,
  JazzMarkGlobe,
  JazzMarkMail,
  JazzMarkPhone,
} from '../common/JazzMarks';

interface ContactProps {
  profile: ProfileDto;
  isContactFormEnabled?: boolean;
}

export default function Contact({ profile, isContactFormEnabled = true }: ContactProps) {
  const t = useTranslations('contact');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState<string | null>(null);

  const email = profile.contactInfo?.email || 'contact@example.com';
  const phone = profile.contactInfo?.phone || '+84 (0) 900 000 000';
  const address = profile.contactInfo?.location || 'Saigon, Vietnam';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const socialLinks = Object.entries(profile.socialLinks || {}).filter(([_, url]) => !!url);

  return (
    <section id="contact" className="py-24 px-6 max-w-5xl mx-auto text-center relative overflow-hidden">
      <div className="absolute bottom-[-100px] left-1/2 transform -translate-x-1/2 w-[350px] h-[350px] bg-jazz-gold/5 rounded-full blur-[100px] pointer-events-none" />

      <ScrollReveal>
        <div className="flex flex-col items-center gap-4 mb-16">
          <JazzMarkMail size={40} className="text-jazz-gold" />
          <h2 className="text-3xl md:text-5xl font-heading font-bold text-jazz-gold">
            {tCommon('contact')}
          </h2>
          <p className="text-sm md:text-base text-jazz-text-muted max-w-md leading-relaxed">
            {t('sectionSubtitle')}
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
        <ScrollReveal direction="up" delay={0.1}>
          <div className="bg-jazz-dark/70 border border-jazz-slate p-6 rounded-2xl flex flex-col items-center gap-3 relative group h-full">
            <JazzMarkMail
              size={28}
              className="text-jazz-gold transition-colors duration-300 group-hover:text-jazz-amber"
            />
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">{t('labelEmail')}</h3>
            <span className="text-sm font-mono text-jazz-text truncate max-w-full block select-all">{email}</span>
            <button
              onClick={() => copyToClipboard(email, 'email')}
              className="mt-2 text-xs font-mono text-jazz-gold hover:text-jazz-amber transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {copied === 'email' ? (
                <>
                  <JazzMarkCheck size={14} className="text-jazz-gold" />
                  Copied!
                </>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.2}>
          <div className="bg-jazz-dark/70 border border-jazz-slate p-6 rounded-2xl flex flex-col items-center gap-3 relative group h-full">
            <JazzMarkPhone
              size={28}
              className="text-jazz-gold transition-colors duration-300 group-hover:text-jazz-amber"
            />
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">Phone</h3>
            <span className="text-sm font-mono text-jazz-text truncate max-w-full block select-all">{phone}</span>
            <button
              onClick={() => copyToClipboard(phone, 'phone')}
              className="mt-2 text-xs font-mono text-jazz-gold hover:text-jazz-amber transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {copied === 'phone' ? (
                <>
                  <JazzMarkCheck size={14} className="text-jazz-gold" />
                  Copied!
                </>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={0.3}>
          <div className="bg-jazz-dark/70 border border-jazz-slate p-6 rounded-2xl flex flex-col items-center gap-3 relative group h-full">
            <JazzMarkGlobe
              size={28}
              className="text-jazz-gold transition-colors duration-300 group-hover:text-jazz-amber"
            />
            <h3 className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">Location</h3>
            <span className="text-sm font-mono text-jazz-text truncate max-w-full block">{address}</span>
            <span className="mt-2 text-xs font-mono text-jazz-text-dim cursor-default">Available Remote / Hybrid</span>
          </div>
        </ScrollReveal>
      </div>

      {isContactFormEnabled && (
        <ScrollReveal direction="up" delay={0.4}>
          <div className="mb-16">
            <ContactForm />
          </div>
        </ScrollReveal>
      )}

      {socialLinks.length > 0 && (
        <ScrollReveal direction="up" delay={0.5}>
          <div className="flex flex-col items-center gap-4 mt-6">
            <span className="text-xs font-mono tracking-widest text-jazz-text-dim uppercase">Let's connect:</span>
            <div className="flex gap-4">
              {socialLinks.map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 rounded-full bg-jazz-charcoal hover:bg-jazz-gold border border-jazz-slate hover:border-jazz-gold hover:text-jazz-black font-semibold text-xs transition-all duration-300 capitalize tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_15px_rgba(212,165,116,0.3)]"
                >
                  {platform}
                </a>
              ))}
            </div>
          </div>
        </ScrollReveal>
      )}
    </section>
  );
}
