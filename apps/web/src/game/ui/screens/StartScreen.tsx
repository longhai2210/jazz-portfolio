'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { GameButton, PanelText, PanelTitle, ScreenShell } from './ui';

export interface StartScreenProps {
  /** The audio unlock is pending: Play is disabled until it settles. */
  readonly unlocking: boolean;
  /** The Play click. It must unlock audio before any `await` (AC-DUEL-013.1). */
  readonly onPlay: () => void;
}

/** Screen 1, Start: the title, one line of instructions and the Play button. */
export default function StartScreen({ unlocking, onPlay }: StartScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  return (
    <ScreenShell labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('title')}</PanelTitle>
      <PanelText>{t('start.intro')}</PanelText>
      <GameButton variant="primary" disabled={unlocking} aria-busy={unlocking} onClick={onPlay}>
        {t('start.play')}
      </GameButton>
    </ScreenShell>
  );
}
