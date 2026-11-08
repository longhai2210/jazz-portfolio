'use client';

import { useTranslations } from 'next-intl';
import type { LickId } from '../../core/data/licks';
import type { LickMatch } from '../../core/lick';
import { lickIdOf } from './game-ids';

/** How often each grey-box lick was quoted, in the order the licks were first quoted. */
export function countQuotes(
  quotes: readonly Pick<LickMatch, 'lick'>[],
): { readonly lickId: LickId; readonly count: number }[] {
  const counts = new Map<LickId, number>();
  for (const quote of quotes) {
    const id = lickIdOf(quote.lick);
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Array.from(counts, ([lickId, count]) => ({ lickId, count }));
}

export interface QuoteTagsProps {
  /** Each lick with how often it was quoted; a count of 1 shows the name alone. */
  readonly licks: readonly { readonly lickId: LickId; readonly count: number }[];
}

/** "Licks quoted": gold-outline tags, "Duck x2" for a lick quoted twice, or a quiet empty line. */
export default function QuoteTags({ licks }: QuoteTagsProps) {
  const t = useTranslations('game');
  return (
    <div className="w-full text-left" data-testid="quote-tags">
      <h3 className="mb-1.5 font-heading text-sm text-jazz-text">{t('result.quotesTitle')}</h3>
      {licks.length === 0 ? (
        <p className="font-body text-[13px] text-jazz-text-muted">{t('result.quotesNone')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {licks.map(({ lickId, count }) => {
            const lick = t(`lick.${lickId}`);
            return (
              <li
                key={lickId}
                data-lick={lickId}
                className="rounded-full border border-jazz-amber px-3 py-1 font-body text-xs text-jazz-amber"
              >
                {count > 1 ? t('result.quoteCount', { lick, count }) : lick}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
