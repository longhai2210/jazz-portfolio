import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getPublicSettings } from '@/lib/portfolio-data';
import GameTheme from './GameTheme';

/**
 * Shell of `/{locale}/game`, outside `(portfolio)`: no site header and no music player.
 *
 * The Game switch is checked here as well as in the page (AC-DUEL-015.5). The layout sits outside the
 * Suspense boundary of `loading.tsx`, so `notFound()` lands before the response starts and the route
 * answers a real HTTP 404; from the page alone it would stream after a 200 status.
 */
export default async function GameLayout({ children }: { readonly children: ReactNode }) {
  const settings = await getPublicSettings();
  if (!settings.isGameEnabled) {
    notFound();
  }

  return (
    <div id="main-content">
      <GameTheme />
      {children}
    </div>
  );
}
