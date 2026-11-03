import type { Metadata } from 'next';
import { CategoryType, Locale } from '@jazz-portfolio/shared';
import Hero from '@/components/portfolio/Hero';
import About from '@/components/portfolio/About';
import Experience from '@/components/portfolio/Experience';
import Skills from '@/components/portfolio/Skills';
import Contact from '@/components/portfolio/Contact';
import { getProfile, getCategories, getPublicSettings } from '@/lib/portfolio-data';
import { getLocalizedAlternates, getSiteUrl } from '@/lib/site-url';
import { routing } from '@/i18n/routing';

export const revalidate = 60;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const [{ locale }, profile] = await Promise.all([paramsPromise, getProfile()]);
  if (!profile) return { title: 'Portfolio' };

  const loc = locale as Locale;
  const name = profile.name?.[loc] || profile.name?.en || 'Jazz Portfolio';
  const title = profile.title?.[loc] || profile.title?.en || 'Developer';
  const intro = profile.introduction?.[loc] || profile.introduction?.en || '';

  const siteUrl = getSiteUrl();

  return {
    title: `${name} — ${title}`,
    description: intro,
    openGraph: {
      title: `${name} — ${title}`,
      description: intro,
      type: 'website',
      url: `${siteUrl}/${locale}`,
      ...(profile.avatarUrl ? { images: [{ url: profile.avatarUrl }] } : {}),
    },
    twitter: {
      card: profile.avatarUrl ? 'summary_large_image' : 'summary',
      title: `${name} — ${title}`,
      description: intro,
      ...(profile.avatarUrl ? { images: [profile.avatarUrl] } : {}),
    },
    alternates: getLocalizedAlternates(locale),
  };
}

export default async function HomePage({
  params: paramsPromise,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, profile, categories, settings] = await Promise.all([
    paramsPromise,
    getProfile(),
    getCategories(),
    getPublicSettings(),
  ]);

  if (!profile) {
    return (
      <main className="w-full px-6 py-24 text-center text-jazz-text-muted">
        Portfolio content is temporarily unavailable.
      </main>
    );
  }

  const isContactFormEnabled = settings.isContactFormEnabled;
  const experienceCategory = categories.find((cat) => cat.type === CategoryType.EXPERIENCE);
  const skillsCategory = categories.find((cat) => cat.type === CategoryType.SKILL);

  const loc = locale as Locale;
  const siteUrl = getSiteUrl();
  const name = profile.name?.[loc] || profile.name?.en || 'Portfolio Owner';
  const title = profile.title?.[loc] || profile.title?.en || 'Developer';
  const intro = profile.introduction?.[loc] || profile.introduction?.en || '';
  const socialLinksList = profile.socialLinks
    ? Object.values(profile.socialLinks).filter((url): url is string => Boolean(url))
    : [];

  const personJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: title,
    description: intro,
    url: `${siteUrl}/${locale}`,
    ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    ...(socialLinksList.length > 0 ? { sameAs: socialLinksList } : {}),
  };

  return (
    <main id="main-content" className="w-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <Hero profile={profile} locale={locale} />
      <About profile={profile} locale={locale} />
      {experienceCategory && <Experience category={experienceCategory} locale={locale} />}
      {skillsCategory && <Skills category={skillsCategory} locale={locale} />}
      <Contact profile={profile} isContactFormEnabled={isContactFormEnabled} />
    </main>
  );
}
