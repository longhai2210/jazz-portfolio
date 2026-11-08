'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Actions, GameButton, HomeLink, PanelText, PanelTitle } from './ui';

export interface PauseOverlayProps {
  /** Resume (Esc does the same): a count-in bar, then the round again from the call. */
  readonly onResume: () => void;
}

const FOCUSABLE = 'button:not([disabled]), a[href]';

/**
 * Screen 8, Pause (REQ-DUEL-014): a modal dialog over the frozen board. Focus moves to Resume and
 * Tab stays inside. "Back to portfolio" releases the audio and leaves (AC-DUEL-014.3).
 */
export default function PauseOverlay({ onResume }: PauseOverlayProps) {
  const t = useTranslations('game');
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const resume = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resume.current?.focus();
  }, []);

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || dialog.current === null) return;
    const targets = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (targets.length === 0) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-jazz-black/80 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={keepFocusInside}
        className="flex w-full max-w-[560px] flex-col items-center gap-3.5 rounded-2xl border border-jazz-slate bg-jazz-dark px-6 py-7 text-center"
      >
        <PanelTitle id={titleId}>{t('pause.title')}</PanelTitle>
        <PanelText>{t('pause.body')}</PanelText>
        <Actions>
          <GameButton ref={resume} variant="primary" onClick={onResume}>
            {t('pause.resume')}
          </GameButton>
          <HomeLink variant="secondary" />
        </Actions>
      </div>
    </div>
  );
}
