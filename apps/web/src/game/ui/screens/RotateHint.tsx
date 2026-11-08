'use client';

import { useTranslations } from 'next-intl';
import { TopBar } from './ui';

/**
 * Full-screen hint for a phone held upright (design "Phone", decision 4): the match does not start
 * in portrait, and one in progress pauses until the phone is turned sideways again.
 */
export default function RotateHint() {
  const t = useTranslations('game');
  return (
    <div className="flex min-h-full flex-col" data-testid="rotate-hint">
      <TopBar compact />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span aria-hidden="true" className="font-heading text-5xl text-jazz-gold">
          &#8635;
        </span>
        <p role="status" className="font-heading text-xl text-jazz-text">
          {t('rotate.hint')}
        </p>
      </main>
    </div>
  );
}
