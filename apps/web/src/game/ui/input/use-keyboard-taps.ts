'use client';

import { useEffect, useRef, useState } from 'react';
import type { Button, Tap } from '../../core/types';
import { buttonForKey, isGameKeyEvent, isTapKeyDown } from './keys';
import { createTap, type AudioClock } from './tap-time';

export interface KeyboardTapsOptions {
  /** The game audio, or anything with its `currentTime`: taps are timed on it. */
  readonly clock: AudioClock;
  /** Called once per key press of D, F, J or K. Play the button's note here (AC-DUEL-013.5). */
  readonly onTap: (tap: Tap) => void;
  /** Listen only while a match runs; D F J K do nothing elsewhere. Default true. */
  readonly enabled?: boolean;
}

/**
 * Turns D, F, J and K into taps (AC-DUEL-013.3): one tap per press, none for the repeats a held
 * key sends. Returns the buttons held down now, so the pads can show them pressed.
 */
export function useKeyboardTaps({
  clock,
  onTap,
  enabled = true,
}: KeyboardTapsOptions): readonly Button[] {
  const [held, setHeld] = useState<readonly Button[]>([]);
  const onTapRef = useRef(onTap);
  const clockRef = useRef(clock);

  useEffect(() => {
    onTapRef.current = onTap;
    clockRef.current = clock;
  });

  useEffect(() => {
    if (!enabled) {
      setHeld([]);
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const button = buttonForKey(event);
      if (button === null || !isGameKeyEvent(event)) return;
      // The key belongs to the game, held or not: keep it from starting find-as-you-type.
      event.preventDefault();
      if (!isTapKeyDown(event)) return;
      onTapRef.current(createTap(clockRef.current, button, event.timeStamp));
      setHeld((current) => (current.includes(button) ? current : [...current, button]));
    }

    function handleKeyUp(event: KeyboardEvent) {
      const button = buttonForKey(event);
      if (button === null) return;
      setHeld((current) => current.filter((held) => held !== button));
    }

    // Key-up is lost when the window loses focus, so nothing stays drawn as held.
    function release() {
      setHeld([]);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', release);
    };
  }, [enabled]);

  return held;
}
