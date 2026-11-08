'use client';

import { useTranslations } from 'next-intl';
import type { LickId } from '../../core/data/licks';
import type { Grade } from '../../core/types';
import { NO_TRANSITION } from './lane-identity';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';

/** The last thing worth telling the player: a grade, a surplus tap, or a quote. */
export type FeedbackEvent =
  | { readonly kind: 'grade'; readonly grade: Grade }
  | { readonly kind: 'extra' }
  | { readonly kind: 'quote'; readonly lickId: LickId };

const GRADE_KEYS: Readonly<Record<Grade, string>> = {
  perfect: 'feedback.perfect',
  great: 'feedback.great',
  ok: 'feedback.ok',
  miss: 'feedback.miss',
};

interface FeedbackProps {
  readonly event: FeedbackEvent | null;
}

/**
 * One line of text over the board (AC-DUEL-013.10). It only ever changes its words: no shake, no
 * flash, no pulse, and with reduced motion not even the site's color transition.
 *
 * Screen readers hear quotes and misses only, so they are not read every tap.
 */
export default function Feedback({ event }: FeedbackProps) {
  const t = useTranslations('game');
  const reducedMotion = usePrefersReducedMotion();

  let line = '';
  let subLine = '';
  let announcement = '';
  if (event?.kind === 'grade') {
    line = t(GRADE_KEYS[event.grade]);
    if (event.grade === 'miss') announcement = line;
  } else if (event?.kind === 'extra') {
    line = t('feedback.extra');
  } else if (event?.kind === 'quote') {
    const lick = t(`lick.${event.lickId}`);
    line = t('feedback.quote', { lick });
    subLine = t('feedback.quoteSub', { lick });
    announcement = `${line} ${subLine}`;
  }

  return (
    <div
      className="min-h-10 text-center"
      style={reducedMotion ? NO_TRANSITION : undefined}
      data-testid="duel-feedback"
      data-reduced-motion={reducedMotion}
    >
      <p
        aria-hidden="true"
        className="font-heading text-[22px] leading-tight text-jazz-amber"
        style={reducedMotion ? NO_TRANSITION : undefined}
      >
        {line}
      </p>
      {subLine && (
        <p aria-hidden="true" className="font-mono text-[11px] text-jazz-text-muted">
          {subLine}
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
