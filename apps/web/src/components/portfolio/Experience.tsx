import { getTranslation } from '@/lib/i18n';
import ScrollRevealWrapper from '../animation/ScrollRevealWrapper';
import { CategoryDto } from '@jazz-portfolio/shared';
import { JazzMarkBriefcase } from '../common/JazzMarks';

interface ExperienceProps {
  category: CategoryDto;
  locale: string;
}

export default function Experience({ category, locale }: ExperienceProps) {
  const items = category.items || [];

  return (
    <section id="experience" className="py-24 px-6 max-w-7xl mx-auto">
      <ScrollRevealWrapper>
        <div className="flex items-center gap-3 mb-16">
          <JazzMarkBriefcase size={34} className="text-jazz-gold" />
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-jazz-gold">
            {getTranslation(category.name, locale)}
          </h2>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-jazz-slate to-transparent" />
        </div>
      </ScrollRevealWrapper>

      <div className="relative border-l border-jazz-slate ml-4 md:ml-8 flex flex-col gap-12">
        {items.map((item, idx) => {
          const title = getTranslation(item.title, locale);
          const desc = getTranslation(item.description, locale);
          
          // Pull keys from metadata
          const company = (item.metadata as any)?.company || 'Company';
          const period = (item.metadata as any)?.period || 'Period';
          const tags = (item.metadata as any)?.tags || [];

          return (
            <div key={item.id} className="relative pl-8 md:pl-12 group">
              {/* Timeline marker */}
              <div className="absolute left-[-5px] top-1.5 w-[10px] h-[10px] rounded-full bg-jazz-slate group-hover:bg-jazz-gold group-hover:scale-125 transition-all duration-300 shadow-[0_0_10px_rgba(212,165,116,0)] group-hover:shadow-[0_0_15px_rgba(212,165,116,0.8)]" />

              <ScrollRevealWrapper direction="left" delay={idx * 0.15}>
                <div className="bg-jazz-dark/60 backdrop-blur-md border border-jazz-slate hover:border-jazz-gold/50 p-6 md:p-8 rounded-2xl transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                  {/* Header details */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-lg md:text-xl font-heading font-bold text-jazz-text group-hover:text-jazz-gold transition-colors duration-300">
                        {title}
                      </h3>
                      <p className="text-sm text-jazz-brass font-medium">{company}</p>
                    </div>
                    <span className="text-xs font-mono bg-jazz-charcoal px-3.5 py-1.5 rounded-full border border-jazz-slate text-jazz-text-muted w-fit">
                      {period}
                    </span>
                  </div>

                  {/* Body description */}
                  <p className="text-sm md:text-base text-jazz-text-muted leading-relaxed mb-6 whitespace-pre-line">
                    {desc}
                  </p>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-2 py-1 rounded bg-jazz-charcoal text-jazz-text-dim border border-jazz-slate/40"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollRevealWrapper>
            </div>
          );
        })}
      </div>
    </section>
  );
}
