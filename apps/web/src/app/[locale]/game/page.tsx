import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DuelGame from '@/game/ui/DuelGame';
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
 * `/{locale}/game`: not found while `isGameEnabled` is off (AC-DUEL-015.5), the duel otherwise. The
 * route passes no inputs, so the game shows its own difficulty and calibration steps (REQ-DUEL-017).
 *
 * `DuelGame` is a Client Component imported straight from this Server Component, because Next 15
 * rejects `dynamic(..., { ssr: false })` in a Server Component. The server renders only the Start
 * screen; the `AudioContext` is created in the browser, on the Play press.
 */
export default async function GamePage() {
  const settings = await getPublicSettings();
  if (!settings.isGameEnabled) {
    notFound();
  }
  return <DuelGame />;
}
