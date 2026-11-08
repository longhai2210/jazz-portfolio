'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** A phone held upright: the duel does not start, and a match in progress pauses. */
export const PORTRAIT_PHONE_QUERY = '(orientation: portrait) and (pointer: coarse) and (max-width: 600px)';

/** A phone on its side, or any short screen: compact lanes, touch zones, lick book in a drawer. */
export const COMPACT_QUERY = '(orientation: landscape) and (max-height: 500px)';

function mediaQuery(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/**
 * Whether a media query matches, followed live. False on the server and in a browser (or test
 * environment) without `matchMedia`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaQuery(query);
      // Safari before 14 has only the deprecated addListener; without either it never changes.
      list?.addEventListener?.('change', onChange);
      return () => list?.removeEventListener?.('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => mediaQuery(query)?.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
