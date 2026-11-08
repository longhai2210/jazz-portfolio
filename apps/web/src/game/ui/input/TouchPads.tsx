'use client';

import { useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { BUTTONS } from '../../core/config';
import type { Button, Tap } from '../../core/types';
import LaneShape from '../lanes/LaneShape';
import { LANE_IDENTITY, NO_TRANSITION } from '../lanes/lane-identity';
import { createTap, type AudioClock } from './tap-time';

/** Accessible name of each pad, from the `game` messages. */
const PAD_LABEL_KEYS: Readonly<Record<Button, string>> = {
  0: 'pad.d',
  1: 'pad.f',
  2: 'pad.j',
  3: 'pad.k',
};

export interface TouchPadsProps {
  /** The game audio, or anything with its `currentTime`: taps are timed on it. */
  readonly clock: AudioClock;
  /** Called once per pointer press on a pad. Play the button's note here (AC-DUEL-013.5). */
  readonly onTap: (tap: Tap) => void;
  /** Outside a match the pads stay on screen but do nothing. */
  readonly disabled?: boolean;
  /** Buttons held on the keyboard (see `useKeyboardTaps`), drawn pressed like a touched pad. */
  readonly held?: readonly Button[];
  /** Phone layout: four full-height zones that fill their container. */
  readonly compact?: boolean;
}

/**
 * The 4 touch zones, D F J K from left to right (AC-DUEL-013.4). A tap is the pointer going down,
 * not a click, so it lands as early as the finger does; any pointer works (touch, pen, mouse).
 */
export default function TouchPads({
  clock,
  onTap,
  disabled = false,
  held = [],
  compact = false,
}: TouchPadsProps) {
  const t = useTranslations('game');
  const [touched, setTouched] = useState<readonly Button[]>([]);

  function press(button: Button, event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    // Only the main button of a mouse; touch and pen report button 0 too.
    if (event.button > 0) return;
    onTap(createTap(clock, button, event.timeStamp));
    setTouched((current) => (current.includes(button) ? current : [...current, button]));
  }

  function release(button: Button) {
    setTouched((current) => current.filter((pressed) => pressed !== button));
  }

  return (
    <div
      className={`grid grid-cols-4 ${compact ? 'h-full gap-1.5' : 'gap-2'}`}
      data-testid="touch-pads"
    >
      {BUTTONS.map((button) => {
        const identity = LANE_IDENTITY[button];
        const pressed = !disabled && (touched.includes(button) || held.includes(button));
        return (
          <button
            key={button}
            type="button"
            aria-label={t(PAD_LABEL_KEYS[button])}
            disabled={disabled}
            data-button={identity.key}
            data-pressed={pressed}
            onPointerDown={(event) => press(button, event)}
            onPointerUp={() => release(button)}
            onPointerCancel={() => release(button)}
            onPointerLeave={() => release(button)}
            onContextMenu={(event) => event.preventDefault()}
            style={NO_TRANSITION}
            className={`flex touch-none select-none flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 font-mono text-[13px] text-jazz-text [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] ${
              compact ? 'h-full min-h-16' : 'min-h-16'
            } ${
              pressed ? 'border-jazz-gold bg-jazz-blue' : 'border-jazz-slate bg-jazz-charcoal'
            } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
          >
            <LaneShape button={button} className="h-3.5 w-3.5" />
            <span aria-hidden="true">{identity.key}</span>
          </button>
        );
      })}
    </div>
  );
}
