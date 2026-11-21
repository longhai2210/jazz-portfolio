import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StageGame from '@/game/stage/StageGame';
import { getPublicSettings } from '@/lib/portfolio-data';

export const revalidate = 300;

/**
 * The game is a side room of the portfolio: kept out of search results (AC-DUEL-015.6), and
 * `sitemap.ts` does not list it. The title is the game's name, the same in every locale (design
 * i18n table, `game.title`).
 */
export const metadata: Metadata = {
  title: 'Midnight Session',
  robots: { index: false, follow: false },
};

/**
 * `/{locale}/game`: not found while `isGameEnabled` is off (AC-DUEL-015.5), the game otherwise. The
 * game opens the 3D street when the browser has WebGL2 and the stage assets are there, and the
 * grey-box duel of `game-duel` when not (game-stage AC-STAGE-001.1, 001.2, 002.1). The route
 * passes no inputs.
 *
 * `StageGame` is a Client Component imported straight from this Server Component, because Next 15
 * rejects `dynamic(..., { ssr: false })` in a Server Component. The server renders only the loading
 * panel; the WebGL2 check, the downloads and the 3D module all run in the browser, and the
 * `AudioContext` is created on the Play press.
 */
export default async function GamePage() {
  const settings = await getPublicSettings();
  if (!settings.isGameEnabled) {
    notFound();
  }
  return <StageGame />;
}
