'use client';

import { useLayoutEffect, type ReactNode } from 'react';

/**
 * The theme the game is designed for. `globals.css` has a rule only for `light-jazz`, so `dark`
 * selects the default `@theme` tokens.
 */
const GAME_THEME = 'dark';

/**
 * Shell of `/{locale}/game`, outside `(portfolio)`: no site header and no music player. The game is
 * dark only, and `data-theme` on `<html>` (set from the saved theme by the locale layout) decides the
 * tokens, so the layout switches it to dark while the route is mounted and puts the saved value back
 * when the player leaves. A layout effect, so a client-side visit paints no light frame.
 */
export default function GameLayout({ children }: { readonly children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', GAME_THEME);
    return () => {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    };
  }, []);

  return <div id="main-content">{children}</div>;
}
