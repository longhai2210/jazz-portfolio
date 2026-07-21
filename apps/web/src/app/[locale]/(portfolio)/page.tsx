import { CategoryType } from '@jazz-portfolio/shared';
import Hero from '@/components/portfolio/Hero';
import About from '@/components/portfolio/About';
import Experience from '@/components/portfolio/Experience';
import Skills from '@/components/portfolio/Skills';
import Contact from '@/components/portfolio/Contact';
import {
  getProfile,
  getCategories,
  getPublicSettings,
} from '@/lib/portfolio-data';

export default async function HomePage() {
  const [profile, categories, settings] = await Promise.all([
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

  return (
    <main className="w-full">
      <Hero profile={profile} />
      <About profile={profile} />
      {experienceCategory && <Experience category={experienceCategory} />}
      {skillsCategory && <Skills category={skillsCategory} />}
      <Contact profile={profile} isContactFormEnabled={isContactFormEnabled} />
    </main>
  );
}
