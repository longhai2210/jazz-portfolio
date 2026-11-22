'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { GRID_STEPS } from '../../core/config';
import { LICKS, type LickId } from '../../core/data/licks';
import { NO_TRANSITION } from '../lanes/lane-identity';
import { usePrefersReducedMotion } from '../lanes/use-prefers-reduced-motion';

export interface LickBookProps {
  /** The lick just quoted: lit until the next bar, when the caller clears it. */
  readonly justQuoted?: LickId | null;
  readonly className?: string;
}

const STEPS = Array.from({ length: GRID_STEPS }, (_, step) => step);

/**
 * The lick book (AC-DUEL-013.8): the 3 grey-box licks in learned order, each as a row of 8 dots
 * where a filled dot is a step of the lick and a square dot is an off-beat step. The lick just
 * quoted gets an amber border, a star and a "Just quoted" label; nothing pulses or blinks.
 */
export default function LickBook({ justQuoted = null, className = '' }: LickBookProps) {
  const t = useTranslations('game');
  const reducedMotion = usePrefersReducedMotion();
  const headingId = useId();
  const motionStyle = reducedMotion ? NO_TRANSITION : undefined;

  return (
    <aside
      aria-labelledby={headingId}
      className={`flex flex-col gap-2.5 bg-jazz-black p-3 ${className}`}
      data-testid="lick-book"
    >
      <h3 id={headingId} className="font-heading text-sm text-jazz-gold">
        {t('lickBook.title')}
      </h3>
      <ul className="flex flex-col gap-2.5">
        {LICKS.map((lick) => {
          const lit = lick.id === justQuoted;
          return (
            <li
              key={lick.id}
              data-lick={lick.id}
              data-lit={lit}
              style={motionStyle}
              className={`rounded-[10px] border p-2 ${
                lit ? 'border-jazz-amber bg-jazz-blue' : 'border-jazz-slate bg-jazz-dark'
              }`}
            >
              <p className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-semibold text-jazz-text">
                <span>
                  {t(`lick.${lick.id}`)}
                  {lit && (
                    <span aria-hidden="true" className="text-jazz-amber">
                      {' ★'}
                    </span>
                  )}
                </span>
                {lit && (
                  <span className="font-mono text-[10px] font-normal text-jazz-amber">
                    {t('lickBook.justQuoted')}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-8 gap-[3px]" aria-hidden="true">
                {STEPS.map((step) => {
                  const on = lick.steps.includes(step);
                  const offbeat = step % 2 === 1;
                  return (
                    <span
                      key={step}
                      data-step={step}
                      data-on={on}
                      data-offbeat={offbeat}
                      style={motionStyle}
                      className={`block aspect-square border ${
                        offbeat ? 'rounded-[2px]' : 'rounded-full'
                      } ${on ? 'border-jazz-gold bg-jazz-gold' : 'border-jazz-steel'}`}
                    />
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-[10px] leading-snug text-jazz-text-dim">{t('lickBook.note')}</p>
    </aside>
  );
}
