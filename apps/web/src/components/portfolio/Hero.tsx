import { getTranslations } from 'next-intl/server';
import { getTranslation } from '@/lib/i18n';
import { ProfileDto } from '@jazz-portfolio/shared';
import {
  JazzMarkGlobe,
  JazzMarkMail,
  JazzMarkPhone,
  JazzMarkPin,
} from '../common/JazzMarks';
import HeroAnimations from './HeroAnimations';
import ScrollDownButton from './ScrollDownButton';

interface HeroProps {
  profile: ProfileDto;
  locale: string;
}

export default async function Hero({ profile, locale }: HeroProps) {
  const t = await getTranslations({ locale, namespace: 'hero' });

  const email = profile.contactInfo?.email || 'contact@example.com';
  const phone = profile.contactInfo?.phone || '+84 (0) 900 000 000';
  const location = profile.contactInfo?.location || 'Saigon, Vietnam';

  return (
    <section 
      id="hero"
      className="relative min-h-[calc(100vh-80px)] flex flex-col justify-center px-6 py-12 max-w-7xl mx-auto overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-jazz-gold/10 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Main Heading Column */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <HeroAnimations className="flex flex-col gap-2">
            <span className="text-jazz-gold font-mono tracking-widest text-xs uppercase">
              {t('greeting')}
            </span>
            <h1 className="text-5xl md:text-7xl font-heading font-bold text-jazz-text leading-tight tracking-wide">
              {getTranslation(profile.name, locale)}
            </h1>
            <h2 className="text-2xl md:text-3xl font-heading text-jazz-brass font-medium mt-2">
              {getTranslation(profile.title, locale)}
            </h2>
          </HeroAnimations>

          <HeroAnimations delay={0.2} className="text-base md:text-lg text-jazz-text-muted max-w-xl leading-relaxed">
            {getTranslation(profile.introduction, locale)}
          </HeroAnimations>

          {/* Action buttons */}
          <HeroAnimations delay={0.4} className="flex flex-wrap gap-4 mt-4">
            <a
              href="#contact"
              className="px-8 py-3 rounded-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold shadow-[0_0_15px_rgba(212,165,116,0.3)] hover:shadow-[0_0_25px_rgba(212,165,116,0.5)] transition-all duration-300"
            >
              Get In Touch
            </a>
            <a
              href="#about"
              className="px-8 py-3 rounded-full border border-jazz-slate text-jazz-text hover:text-jazz-gold hover:border-jazz-gold bg-jazz-charcoal/40 backdrop-blur-md transition-all duration-300"
            >
              Read Bio
            </a>
          </HeroAnimations>
        </div>

        {/* Contact Info Column (Displayed Prominently First) */}
        <div className="lg:col-span-5">
          <HeroAnimations delay={0.3} animationVariant="fadeScale" className="bg-jazz-dark/70 backdrop-blur-md border border-jazz-slate p-8 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] relative group overflow-hidden">
            {/* Glowing gold border element */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-jazz-gold to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

            <h3 className="text-lg font-heading font-bold text-jazz-gold mb-6 flex items-center gap-2">
              <JazzMarkPin size={22} className="text-jazz-gold" /> Quick Contacts
            </h3>

            <div className="flex flex-col gap-6">
              {/* Email */}
              <div className="flex gap-4 items-start">
                <JazzMarkMail size={26} className="text-jazz-gold mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs text-jazz-text-dim uppercase tracking-wider">Email</h4>
                  <a 
                    href={`mailto:${email}`}
                    className="text-base text-jazz-text hover:text-jazz-gold transition-colors duration-300 break-all font-mono"
                  >
                    {email}
                  </a>
                </div>
              </div>

              {/* Phone */}
              <div className="flex gap-4 items-start">
                <JazzMarkPhone size={26} className="text-jazz-gold mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs text-jazz-text-dim uppercase tracking-wider">Phone</h4>
                  <a 
                    href={`tel:${phone}`}
                    className="text-base text-jazz-text hover:text-jazz-gold transition-colors duration-300 font-mono"
                  >
                    {phone}
                  </a>
                </div>
              </div>

              {/* Location */}
              <div className="flex gap-4 items-start">
                <JazzMarkGlobe size={26} className="text-jazz-gold mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs text-jazz-text-dim uppercase tracking-wider">Location</h4>
                  <p className="text-base text-jazz-text font-mono">
                    {location}
                  </p>
                </div>
              </div>
            </div>
          </HeroAnimations>
        </div>
      </div>

      {/* Floating Scroll Down Indicator */}
      <ScrollDownButton label={t('scrollDown')} />
    </section>
  );
}
