'use client';

import { useEffect, useRef, useState } from 'react';
import { isGameKeyEvent } from '../../ui/input/keys';
import {
  handlesEnterItself,
  isEnterClubKey,
  keyId,
  NO_SIDES,
  walkSideForKey,
  type HeldSides,
  type WalkSide,
} from './street-keys';

export interface StreetKeysOptions {
  /** Listen only while the player can walk: after Play, on the street, with the tab shown. */
  readonly enabled: boolean;
  /** The character stands by the club door, so E and Enter enter the club. */
  readonly canEnter: boolean;
  /** Called once per press of E or Enter while `canEnter` is true. */
  readonly onEnter: () => void;
}

/** Held keys by physical key, so A and the left arrow held together need both released. */
type HeldKeys = ReadonlyMap<string, WalkSide>;

function sidesOf(held: HeldKeys): HeldSides {
  if (held.size === 0) return NO_SIDES;
  const sides = [...held.values()];
  return { left: sides.includes('left'), right: sides.includes('right') };
}

/**
 * The street keys (design.md section 3): returns the sides held now, and calls `onEnter` on E or
 * Enter by the door (AC-STAGE-003.1, 003.3).
 *
 * Keys are heard on `window`. Shortcuts with Ctrl, Alt or Meta, input method compositions and
 * typing in a field are ignored. A held key's repeats are ignored, so one press enters once.
 * Losing focus or hiding the tab drops every key, since its key-up never arrives and the
 * character would walk on by itself.
 */
export function useStreetKeys({ enabled, canEnter, onEnter }: StreetKeysOptions): HeldSides {
  const [held, setHeld] = useState<HeldKeys>(() => new Map());
  const latest = useRef({ canEnter, onEnter });

  useEffect(() => {
    latest.current = { canEnter, onEnter };
  });

  useEffect(() => {
    if (!enabled) {
      setHeld(new Map());
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isGameKeyEvent(event)) return;
      const side = walkSideForKey(event);
      if (side !== null) {
        // Arrow keys would scroll a page taller than the screen.
        event.preventDefault();
        const id = keyId(event);
        setHeld((current) => {
          if (current.get(id) === side) return current;
          const next = new Map(current);
          next.set(id, side);
          return next;
        });
        return;
      }
      if (!isEnterClubKey(event) || event.repeat || !latest.current.canEnter) return;
      if (event.key === 'Enter' && handlesEnterItself(event.target)) return;
      event.preventDefault();
      latest.current.onEnter();
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (walkSideForKey(event) === null) return;
      const id = keyId(event);
      setHeld((current) => {
        if (!current.has(id)) return current;
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    }

    function releaseAll() {
      setHeld((current) => (current.size === 0 ? current : new Map()));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') releaseAll();
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return sidesOf(held);
}
