'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { DuelResult } from '../../core/session';
import { CHARACTER_NAMES } from './game-ids';
import QuoteTags, { countQuotes } from './QuoteTags';
import { Actions, GameButton, PanelTitle, ScreenShell, Stars } from './ui';

export interface ResultScreenProps {
  /** The take that just ended. */
  readonly result: DuelResult;
  /** It won a duel that has a next one: "On to match 2" (AC-DUEL-013.7). */
  readonly canAdvance: boolean;
  /** It won the last duel: "See summary" (AC-DUEL-013.7, decision 2). */
  readonly runComplete: boolean;
  /** Offer wider windows: the second loss in a row on this duel (AC-DUEL-011.3). */
  readonly offerAssist: boolean;
  readonly onNext: () => void;
  /** "Replay this take": the same duel again (AC-DUEL-013.6). */
  readonly onReplay: () => void;
  readonly onSummary: () => void;
  readonly onAcceptAssist: () => void;
  readonly onDeclineAssist: () => void;
  /**
   * One more action at the end of the button row (the stage's Leave the club, design.md section 4,
   * a secondary button). Without it the screen is the game-duel result, unchanged.
   */
  readonly extraAction?: ReactNode;
}

/** A 0 to 1 score as a whole percentage. */
function percent(fraction: number): number {
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100);
}

function ScoreRow({ label, value, fill }: { label: string; value: string; fill: number }) {
  return (
    <div
      className="grid grid-cols-[110px_1fr_56px] items-center gap-2.5 font-body text-[13px] text-jazz-text-muted"
      data-testid="score-row"
    >
      <span>{label}</span>
      <div
        aria-hidden="true"
        className="h-2 overflow-hidden rounded border border-jazz-slate bg-jazz-charcoal"
      >
        <i className="block h-full bg-jazz-gold" style={{ width: `${fill}%` }} />
      </div>
      <output className="text-right font-mono text-jazz-text">{value}</output>
    </div>
  );
}

/**
 * Screen 6, Result (AC-DUEL-013.6, 013.7, 011.3, 011.4): the title, the stars, Rhythm, Direction
 * and Feel, the quote bonus and the total, the licks quoted, and what comes next. A second loss in
 * a row offers wider windows inline, so Replay stays reachable; a take played with them says so.
 */
export default function ResultScreen({
  result,
  canAdvance,
  runComplete,
  offerAssist,
  onNext,
  onReplay,
  onSummary,
  onAcceptAssist,
  onDeclineAssist,
  extraAction = null,
}: ResultScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  const offerId = useId();
  const { score } = result;

  return (
    <ScreenShell labelledBy={titleId}>
      <PanelTitle id={titleId}>
        {score.won
          ? t('result.winTitle', { name: CHARACTER_NAMES[result.character] })
          : t('result.loseTitle')}
      </PanelTitle>
      <Stars count={score.stars} />

      <div className="grid w-full gap-2 text-left">
        <ScoreRow
          label={t('result.rhythm')}
          value={`${percent(score.timing)}%`}
          fill={percent(score.timing)}
        />
        <ScoreRow
          label={t('result.direction')}
          value={`${percent(score.direction)}%`}
          fill={percent(score.direction)}
        />
        <ScoreRow
          label={t('result.feel')}
          value={`${percent(score.feel)}%`}
          fill={percent(score.feel)}
        />
        {score.quoteBonus > 0 && (
          <ScoreRow label={t('result.quoteBonus')} value={`+${score.quoteBonus}`} fill={100} />
        )}
        <div className="flex justify-between border-t border-jazz-slate pt-2 font-mono text-sm text-jazz-text">
          <span>{t('result.total')}</span>
          <span data-testid="result-total">{Math.round(score.total)}</span>
        </div>
      </div>

      {result.assisted && (
        <div
          role="note"
          className="w-full rounded-xl border border-jazz-slate bg-jazz-charcoal px-3.5 py-3 font-body text-[13px] text-jazz-text-muted"
        >
          {t('assist.note')}
        </div>
      )}

      <QuoteTags licks={countQuotes(result.quotes)} />

      {offerAssist && (
        <div
          role="group"
          aria-labelledby={offerId}
          className="w-full rounded-xl border border-jazz-slate bg-jazz-charcoal px-3.5 py-3 text-left font-body text-[13px] text-jazz-text-muted"
        >
          <b id={offerId} className="block text-jazz-gold">
            {t('assist.title')}
          </b>
          <p>{t('assist.body')}</p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            <GameButton variant="primary" onClick={onAcceptAssist}>
              {t('assist.accept')}
            </GameButton>
            <GameButton variant="ghost" onClick={onDeclineAssist}>
              {t('assist.decline')}
            </GameButton>
          </div>
        </div>
      )}

      <Actions>
        {score.won && canAdvance && (
          <GameButton variant="primary" onClick={onNext}>
            {t('result.next')}
          </GameButton>
        )}
        {score.won && runComplete && (
          <GameButton variant="primary" onClick={onSummary}>
            {t('result.summary')}
          </GameButton>
        )}
        <GameButton variant={score.won ? 'secondary' : 'primary'} onClick={onReplay}>
          {t('result.replay')}
        </GameButton>
        {extraAction}
      </Actions>
    </ScreenShell>
  );
}
