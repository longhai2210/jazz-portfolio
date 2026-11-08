'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { CAMPAIGN_DUELS } from '../../core/campaign';
import type { DuelResult } from '../../core/session';
import type { DuelNumber } from '../../core/types';
import { CHARACTER_NAMES, LICK_ORDER } from './game-ids';
import QuoteTags, { countQuotes } from './QuoteTags';
import { Actions, GameButton, HomeLink, PanelTitle, ScreenShell, Stars } from './ui';

export interface SummaryScreenProps {
  /** The latest result of each duel played in this run. */
  readonly results: Readonly<Partial<Record<DuelNumber, DuelResult>>>;
  /** "Play again from the start" (AC-DUEL-013.7). */
  readonly onRestart: () => void;
}

/**
 * Screen 7, Summary (AC-DUEL-013.7): shown after the match 2 win, with one card per match and
 * every different lick quoted across both, then "Play again from the start" and the way home.
 */
export default function SummaryScreen({ results, onRestart }: SummaryScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  const played = CAMPAIGN_DUELS.flatMap((duel) => {
    const result = results[duel];
    return result === undefined ? [] : [result];
  });
  const quoted = new Set(countQuotes(played.flatMap((result) => result.quotes)).map((q) => q.lickId));
  const licks = LICK_ORDER.filter((id) => quoted.has(id)).map((lickId) => ({ lickId, count: 1 }));

  return (
    <ScreenShell wide labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('summary.title')}</PanelTitle>
      <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2">
        {played.map((result) => (
          <div
            key={result.duel}
            data-testid={`summary-match-${result.duel}`}
            className="flex flex-col items-center gap-1.5 rounded-[14px] border border-jazz-slate bg-jazz-charcoal p-3.5"
          >
            <b className="font-body text-sm text-jazz-text">
              {t('summary.match', { n: result.duel, name: CHARACTER_NAMES[result.character] })}
            </b>
            <Stars count={result.score.stars} small />
            <span className="font-mono text-[13px] text-jazz-text-muted">
              {t('summary.points', { points: Math.round(result.score.total) })}
            </span>
          </div>
        ))}
      </div>
      <QuoteTags licks={licks} />
      <Actions>
        <GameButton variant="primary" onClick={onRestart}>
          {t('summary.again')}
        </GameButton>
        <HomeLink variant="secondary" />
      </Actions>
    </ScreenShell>
  );
}
