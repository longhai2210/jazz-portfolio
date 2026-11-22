'use client';

import { useLayoutEffect } from 'react';

/**
 * The theme the game is designed for. `globals.css` has a rule only for `light-jazz`, so `dark`
 * selects the default `@theme` tokens.
 */
const GAME_THEME = 'dark';

/**
 * The game is dark only, and `data-theme` on `<html>` (set from the saved theme by the locale layout)
 * decides the tokens. While mounted, this switches it to dark; on unmount it puts the saved value
 * back. A layout effect, so a client-side visit paints no light frame. Renders nothing.
 */
export default function GameTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', GAME_THEME);
    return () => {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    };
  }, []);

  return null;
}
