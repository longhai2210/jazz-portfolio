'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * How long the controls hint stays while the character stands still, in ms. A starting value
 * (design.md, decision 4), tuned by eye at the demo without changing any AC.
 */
export const CONTROLS_HINT_MS = 6000;

export interface ControlsHintProps {
  /** The player has walked since the street was shown: the hint goes at once. */
  readonly walked: boolean;
}

/**
 * The controls hint of the street (design.md section 3): one line in a solid chip, never text on
 * the 3D pixels. It goes once the player starts walking, or after `CONTROLS_HINT_MS` of standing
 * still, and stays gone. Coming back from the club mounts the street, and the hint, afresh.
 */
export default function ControlsHint({ walked }: ControlsHintProps) {
  const t = useTranslations('game');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), CONTROLS_HINT_MS);
    return () => clearTimeout(id);
  }, []);

  if (walked || timedOut) return null;
  return (
    <p
      data-testid="street-controls-hint"
      className="pointer-events-none max-w-[min(92vw,560px)] rounded-xl border border-jazz-slate bg-jazz-dark/90 px-3.5 py-2 text-center font-body text-[13px] text-jazz-text"
    >
      {t('stage.street.controls')}
    </p>
  );
}
