'use client';

import { useTranslations } from 'next-intl';
import { ScreenShell } from '@/game/ui/screens/ui';

/**
 * Shown while `/{locale}/game` checks the Game switch: the frame of the Start panel with the top
 * bar, so the way back to the portfolio is there from the first paint (AC-DUEL-013.9).
 */
export default function GameLoading() {
  const t = useTranslations('common');
  return (
    <div className="relative flex min-h-dvh flex-col bg-jazz-black font-body text-jazz-text">
      <ScreenShell>
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex w-full flex-col items-center gap-3.5"
        >
          <div aria-hidden="true" className="h-8 w-56 rounded-xl jazz-shimmer" />
          <div aria-hidden="true" className="h-4 w-full max-w-sm rounded jazz-shimmer" />
          <div aria-hidden="true" className="h-4 w-3/4 max-w-xs rounded jazz-shimmer" />
          <div aria-hidden="true" className="mt-1.5 h-11 w-28 rounded-xl jazz-shimmer" />
          <p className="font-mono text-xs text-jazz-text-muted">{t('loading')}</p>
        </div>
      </ScreenShell>
    </div>
  );
}
