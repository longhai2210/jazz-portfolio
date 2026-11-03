import Image from 'next/image';
import { getTranslation } from '@/lib/i18n';
import ScrollRevealWrapper from '../animation/ScrollRevealWrapper';
import JazzIcon from '../common/JazzIcon';
import { JazzMarkAvatar } from '../common/JazzMarks';

import { ProfileDto } from '@jazz-portfolio/shared';

interface AboutProps {
  profile: ProfileDto;
  locale: string;
}

export default function About({ profile, locale }: AboutProps) {
  const bio = getTranslation(profile.bio, locale);
  const avatarUrl = profile.avatarUrl || '';

  const socialLinks = Object.entries(profile.socialLinks || {}).filter(([_, url]) => !!url);

  return (
    <section id="about" className="py-24 px-6 bg-jazz-dark/40 backdrop-blur-sm border-t border-jazz-slate/40">
      <div className="max-w-7xl mx-auto">
        <ScrollRevealWrapper>
          <div className="flex items-center gap-3 mb-12">
            <JazzIcon size={36} />
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-jazz-gold">About Me</h2>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-jazz-slate to-transparent" />
          </div>
        </ScrollRevealWrapper>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
          
          {/* Avatar Area */}
          <div className="md:col-span-4 flex justify-center">
            <ScrollRevealWrapper direction="scale" delay={0.2}>
              <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-2xl overflow-hidden border border-jazz-gold/30 p-2 bg-jazz-charcoal/80 group">
                <div className="w-full h-full relative rounded-xl overflow-hidden bg-jazz-black flex items-center justify-center text-5xl">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={getTranslation(profile.name, locale)}
                      fill
                      sizes="(max-width: 768px) 256px, 288px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <JazzMarkAvatar
                      size={72}
                      className="text-jazz-gold/80 animate-pulse"
                    />
                  )}
                </div>
                {/* Glowing frame overlay */}
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-jazz-gold/50 transition-colors duration-500 pointer-events-none" />
              </div>
            </ScrollRevealWrapper>
          </div>

          {/* Bio text & Social links */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <ScrollRevealWrapper direction="left" delay={0.3}>
              <div className="bg-jazz-charcoal/30 border border-jazz-slate p-8 rounded-2xl text-jazz-text-muted leading-relaxed text-base md:text-lg flex flex-col gap-4">
                {bio ? (
                  bio.split('\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))
                ) : (
                  <p>
                    I am a passionate Full Stack Developer with a deep love for both software engineering and the art of jazz. 
                    Just like in jazz, where structure meets free improvisation, I approach coding as a form of expression—combining robust 
                    architectures with creative, user-centric details.
                  </p>
                )}
              </div>
            </ScrollRevealWrapper>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <ScrollRevealWrapper direction="up" delay={0.4}>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <span className="text-xs font-mono tracking-widest text-jazz-text-dim uppercase">Find me on:</span>
                  {socialLinks.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-full border border-jazz-slate text-xs font-mono text-jazz-text-muted hover:text-jazz-gold hover:border-jazz-gold hover:bg-jazz-gold/10 transition-all duration-300 capitalize"
                    >
                      {platform}
                    </a>
                  ))}
                </div>
              </ScrollRevealWrapper>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
