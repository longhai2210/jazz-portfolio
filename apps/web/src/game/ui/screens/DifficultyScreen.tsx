'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { DIFFICULTIES, DIFFICULTY_MULT } from '../../core/config';
import type { Difficulty } from '../../core/types';
import { NO_TRANSITION } from '../lanes/lane-identity';
import { GameButton, PanelTitle, ScreenShell } from './ui';

export interface DifficultyScreenProps {
  /** The difficulty selected now; Lounge when the screen first opens (AC-DUEL-011.1). */
  readonly selected: Difficulty;
  readonly onSelect: (difficulty: Difficulty) => void;
  /** "Continue": confirms the selection. */
  readonly onContinue: () => void;
}

/** Arrow keys that move the choice, and which way. */
const ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Screen 3, Difficulty (AC-DUEL-011.1): Lounge, Session and Late Set as a radio group. The
 * selected card has a gold border and `aria-checked`, so color is not the only signal; arrow keys
 * move the choice and Continue confirms it.
 */
export default function DifficultyScreen({ selected, onSelect, onContinue }: DifficultyScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  const cards = useRef<Partial<Record<Difficulty, HTMLButtonElement | null>>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = DIFFICULTIES.indexOf(selected);
    const next = DIFFICULTIES[(index + step + DIFFICULTIES.length) % DIFFICULTIES.length];
    onSelect(next);
    cards.current[next]?.focus();
  }

  return (
    <ScreenShell wide labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('difficulty.title')}</PanelTitle>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {DIFFICULTIES.map((difficulty) => {
          const checked = difficulty === selected;
          return (
            <button
              key={difficulty}
              ref={(element) => {
                cards.current[difficulty] = element;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-difficulty={difficulty}
              onClick={() => onSelect(difficulty)}
              style={NO_TRANSITION}
              className={`flex min-h-[120px] flex-col gap-1.5 rounded-[14px] border-2 p-3.5 text-left ${
                checked ? 'border-jazz-gold bg-jazz-blue' : 'border-jazz-slate bg-jazz-charcoal'
              }`}
            >
              <b className="font-heading text-[17px] text-jazz-gold">
                {t(`difficulty.${difficulty}.name`)}
              </b>
              <span className="font-body text-xs leading-snug text-jazz-text-muted">
                {t(`difficulty.${difficulty}.desc`)}
              </span>
              <small className="mt-auto font-mono text-[11px] text-jazz-text-muted">
                {t('difficulty.timing', { mult: DIFFICULTY_MULT[difficulty].toFixed(1) })}
              </small>
            </button>
          );
        })}
      </div>
      <GameButton variant="primary" onClick={onContinue}>
        {t('difficulty.continue')}
      </GameButton>
    </ScreenShell>
  );
}
