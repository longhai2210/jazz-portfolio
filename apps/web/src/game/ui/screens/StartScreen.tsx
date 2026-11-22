'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { GameButton, PanelText, PanelTitle, ScreenShell } from './ui';

/**
 * Why the last Play press did not start the match (AC-DUEL-013.12): the browser kept the sound
 * off (`blocked`), or setting up the audio or the match threw (`error`).
 */
export type StartProblem = 'blocked' | 'error';

export interface StartScreenProps {
  /** The audio unlock is pending: Play is disabled until it settles. */
  readonly unlocking: boolean;
  /** The Play click, and the Try again click. It must unlock audio before any `await` (AC-DUEL-013.1). */
  readonly onPlay: () => void;
  /** Shown with a Try again button until a press starts the match; null when nothing failed. */
  readonly problem?: StartProblem | null;
}

const PROBLEM_KEYS: Readonly<Record<StartProblem, 'start.blocked' | 'start.error'>> = {
  blocked: 'start.blocked',
  error: 'start.error',
};

/**
 * Screen 1, Start: the title, one line of instructions and the Play button. After a failed start
 * it also says what went wrong, with a Try again button; Play stays usable (AC-DUEL-013.12).
 */
export default function StartScreen({ unlocking, onPlay, problem = null }: StartScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  return (
    <ScreenShell labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('title')}</PanelTitle>
      <PanelText>{t('start.intro')}</PanelText>
      {problem !== null && (
        <div className="flex w-full flex-col items-center gap-2.5 rounded-xl border border-jazz-copper bg-jazz-charcoal px-3.5 py-3">
          <p role="alert" className="font-body text-[13px] text-jazz-amber">
            {t(PROBLEM_KEYS[problem])}
          </p>
          <GameButton disabled={unlocking} aria-busy={unlocking} onClick={onPlay}>
            {t('start.retry')}
          </GameButton>
        </div>
      )}
      <GameButton variant="primary" disabled={unlocking} aria-busy={unlocking} onClick={onPlay}>
        {t('start.play')}
      </GameButton>
    </ScreenShell>
  );
}
