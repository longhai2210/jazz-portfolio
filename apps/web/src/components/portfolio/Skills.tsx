'use client';

import { useLocale } from 'next-intl';
import Image from 'next/image';
import { getTranslation } from '@/lib/i18n';
import ScrollReveal from '../animation/ScrollReveal';
import JazzIcon from '../common/JazzIcon';

import { CategoryDto } from '@jazz-portfolio/shared';
import { JazzMarkToolkit } from '../common/JazzMarks';

interface SkillsProps {
  category: CategoryDto;
}

export default function Skills({ category }: SkillsProps) {
  const locale = useLocale();

  const items = category.items || [];

  // Group items by subcategory metadata (e.g. 'Languages', 'Frameworks', 'Tools')
  const groupedSkills: Record<string, typeof items> = {};
  items.forEach((item) => {
    const groupName = (item.metadata as any)?.group || 'Other';
    if (!groupedSkills[groupName]) {
      groupedSkills[groupName] = [];
    }
    groupedSkills[groupName].push(item);
  });

  return (
    <section id="skills" className="py-24 px-6 bg-jazz-dark/20 border-t border-b border-jazz-slate/30">
      <div className="max-w-7xl mx-auto">
        
        <ScrollReveal>
          <div className="flex items-center gap-3 mb-16">
            <JazzMarkToolkit size={34} className="text-jazz-gold" />
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-jazz-gold">
              {getTranslation(category.name, locale)}
            </h2>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-jazz-slate to-transparent" />
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Object.entries(groupedSkills).map(([group, skills], groupIdx) => (
            <ScrollReveal key={group} direction="up" delay={groupIdx * 0.15}>
              <div className="bg-jazz-dark/70 backdrop-blur-md border border-jazz-slate p-6 md:p-8 rounded-2xl h-full flex flex-col gap-6 shadow-[0_4px_20px_rgba(0,0,0,0.15)] relative overflow-hidden group">
                {/* Glowing glow accent on corner */}
                <div className="absolute top-0 right-0 w-[80px] h-[80px] bg-jazz-gold/5 rounded-full blur-2xl group-hover:bg-jazz-gold/15 transition-colors duration-500" />
                
                <h3 className="text-lg font-heading font-bold text-jazz-gold border-b border-jazz-slate/60 pb-3 flex items-center gap-2">
                  <JazzIcon size={28} /> {group}
                </h3>

                <div className="flex flex-wrap gap-2.5">
                  {skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="px-3.5 py-2 rounded-xl bg-jazz-charcoal/80 border border-jazz-slate/50 text-sm text-jazz-text-muted hover:text-jazz-gold hover:border-jazz-gold hover:bg-jazz-gold/5 transition-all duration-300 flex items-center gap-2 cursor-default font-mono"
                    >
                      {skill.imageUrl && (
                        <Image
                          src={skill.imageUrl}
                          alt={getTranslation(skill.title, locale)}
                          width={16}
                          height={16}
                          className="object-contain"
                        />
                      )}
                      <span>{getTranslation(skill.title, locale)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
