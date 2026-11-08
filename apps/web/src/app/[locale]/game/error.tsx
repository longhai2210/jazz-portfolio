'use client';

import { useEffect, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Actions, GameButton, HomeLink, PanelTitle, ScreenShell } from '@/game/ui/screens/ui';

/**
 * Error boundary of `/{locale}/game`: a dark panel that never leaves the page blank, with a retry
 * and the way back to the portfolio (AC-DUEL-013.9). It renders inside the game layout, so the dark
 * theme still applies.
 */
export default function GameError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  const t = useTranslations('game');
  const titleId = useId();

  useEffect(() => {
    console.error('Game route error:', error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-jazz-black font-body text-jazz-text">
      <ScreenShell role="alert" labelledBy={titleId}>
        <PanelTitle id={titleId}>{t('title')}</PanelTitle>
        <Actions>
          <GameButton variant="primary" onClick={reset}>
            {t('calibration.retry')}
          </GameButton>
          <HomeLink variant="secondary" />
        </Actions>
      </ScreenShell>
    </div>
  );
}
