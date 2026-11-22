'use client';

import {
  createContext,
  useContext,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Shared pieces of the game screens (design "Shared pieces and reuse"): the way home, the top bar,
 * the centered panel, buttons, chips and star ratings. Plain React with `jazz-*` tokens.
 */

/** Called just before the player leaves the game for the portfolio: releases the audio. */
export const LeaveGameContext = createContext<() => void>(() => undefined);

/**
 * How the screens sit inside the 3D stage (game-stage), set by `DuelGame` when the stage passes a
 * scene or a note. Null, the default, is the grey-box duel of game-duel, drawn exactly as before.
 */
export interface StageLayout {
  /**
   * A 3D scene is drawn behind the screens (design.md section 4): every text sits on a solid strip,
   * chip or panel, never on the scene, and the duel leaves a window for the scene.
   */
  readonly backdrop: boolean;
  /**
   * A notice laid in the page flow right under the top bar (design.md section 2), or null. With a
   * note or a scene, the duel board fits the screen: the page never grows taller than it.
   */
  readonly note: ReactNode;
  /** The element the scene shows through on the duel board, between the HUD and the lanes. */
  readonly sceneWindow: HTMLElement | null;
  /** The duel board registers its scene window here (a callback ref), and null when it goes. */
  readonly setSceneWindow: (element: HTMLElement | null) => void;
}

export const StageLayoutContext = createContext<StageLayout | null>(null);

/** The layout of the stage the screens are in, or null for the grey-box duel of game-duel. */
export function useStageLayout(): StageLayout | null {
  return useContext(StageLayoutContext);
}

/** The solid strip behind a bar of text over the 3D scene (design.md section 4). */
export const STRIP_CLASS = 'border-jazz-slate bg-jazz-dark/90';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/** Full class names, so Tailwind's scanner finds them. Every target is at least 44 px high. */
export const BUTTON_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-jazz-gold bg-jazz-gold px-6 py-2.5 font-body text-sm font-semibold text-jazz-black hover:bg-jazz-amber disabled:cursor-default disabled:opacity-60',
  secondary:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-jazz-slate bg-jazz-charcoal px-6 py-2.5 font-body text-sm font-semibold text-jazz-text hover:border-jazz-gold disabled:cursor-default disabled:opacity-60',
  ghost:
    'inline-flex min-h-11 items-center justify-center rounded-xl border border-jazz-slate bg-transparent px-6 py-2.5 font-body text-sm font-semibold text-jazz-text-muted hover:text-jazz-gold disabled:cursor-default disabled:opacity-60',
};

export function GameButton({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { readonly variant?: ButtonVariant }) {
  return <button type={type} className={`${BUTTON_CLASSES[variant]} ${className}`} {...props} />;
}

export type HomeLinkVariant = 'bar' | 'icon' | ButtonVariant;

const HOME_LINK_CLASSES: Readonly<Record<'bar' | 'icon', string>> = {
  bar: 'inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-jazz-slate px-3.5 py-2 font-body text-[13px] text-jazz-text-muted hover:border-jazz-gold hover:text-jazz-gold',
  icon: 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-jazz-slate font-body text-base text-jazz-text-muted hover:border-jazz-gold hover:text-jazz-gold',
};

/**
 * A plain left click, the only click that leaves this tab. Ctrl, Cmd, Shift or Alt, or another
 * button, opens the link elsewhere (new tab, window, download) and the game here goes on.
 */
function leavesThisTab(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
  );
}

/**
 * "Back to portfolio", to the portfolio home page in the language in use (AC-DUEL-013.9). A plain
 * left click releases the audio first (AC-DUEL-014.3); the page then leaves through the router.
 * Opening it in a new tab keeps the audio of this tab, so a paused match can resume
 * (AC-DUEL-013.13). The middle button sends `auxclick`, which has no handler here.
 */
export function HomeLink({ variant = 'bar' }: { readonly variant?: HomeLinkVariant }) {
  const t = useTranslations('game');
  const locale = useLocale();
  const leave = useContext(LeaveGameContext);
  const label = t('home.back');
  const className =
    variant === 'bar' || variant === 'icon' ? HOME_LINK_CLASSES[variant] : BUTTON_CLASSES[variant];

  return (
    <Link
      href={`/${locale}`}
      onClick={(event) => {
        if (leavesThisTab(event)) leave();
      }}
      aria-label={variant === 'icon' ? label : undefined}
      className={className}
      data-testid="home-link"
    >
      {(variant === 'bar' || variant === 'icon') && <span aria-hidden="true">&larr;</span>}
      {variant !== 'icon' && <span>{label}</span>}
    </Link>
  );
}

/**
 * The top bar every screen has: the way home on the left, screen controls on the right. Over a 3D
 * scene it sits on a solid strip; with a stage note, the note follows it in the page flow.
 */
export function TopBar({
  compact = false,
  left,
  right,
}: {
  readonly compact?: boolean;
  readonly left?: ReactNode;
  readonly right?: ReactNode;
}) {
  const stage = useStageLayout();
  const header = (
    <header
      className={`flex items-center justify-between gap-3 border-b border-jazz-slate px-4 py-2.5 text-[13px]${
        stage?.backdrop ? ' bg-jazz-dark/90' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <HomeLink variant={compact ? 'icon' : 'bar'} />
        {left}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
  );
  if (stage === null || stage.note === null) return header;
  return (
    <>
      {header}
      <div data-testid="duel-note">{stage.note}</div>
    </>
  );
}

/** A centered panel under the top bar: start, difficulty, calibration, result and summary. */
export function ScreenShell({
  children,
  wide = false,
  role,
  labelledBy,
}: {
  readonly children: ReactNode;
  readonly wide?: boolean;
  readonly role?: 'alert';
  readonly labelledBy?: string;
}) {
  const stage = useStageLayout();
  // In the stage the panel is a touch see-through over the scene, and a short phone screen gets
  // less room around it, so a note above does not push the page past the screen.
  const mainClass =
    stage === null
      ? 'flex flex-1 items-start justify-center px-4 py-8 sm:items-center'
      : 'flex flex-1 items-start justify-center px-4 py-8 sm:items-center [@media(max-height:500px)]:py-3';
  const panelBackground = stage?.backdrop ? 'bg-jazz-dark/90' : 'bg-jazz-dark';
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className={mainClass}>
        <section
          role={role}
          aria-labelledby={labelledBy}
          className={`flex w-full flex-col items-center gap-3.5 rounded-2xl border border-jazz-slate ${panelBackground} px-6 py-7 text-center ${
            wide ? 'max-w-[820px]' : 'max-w-[560px]'
          }`}
        >
          {children}
        </section>
      </main>
    </div>
  );
}

export function PanelTitle({ id, children }: { readonly id?: string; readonly children: ReactNode }) {
  return (
    <h2 id={id} className="font-heading text-2xl text-jazz-text">
      {children}
    </h2>
  );
}

export function PanelText({ children }: { readonly children: ReactNode }) {
  return <p className="font-body text-sm leading-normal text-jazz-text-muted">{children}</p>;
}

export function Actions({ children }: { readonly children: ReactNode }) {
  return <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{children}</div>;
}

export function Chip({ on = false, children }: { readonly on?: boolean; readonly children: ReactNode }) {
  const stage = useStageLayout();
  // Over a 3D scene an outline chip gets a solid fill, so its text never sits on the scene.
  const off = stage?.backdrop
    ? 'border-jazz-slate bg-jazz-dark text-jazz-text-muted'
    : 'border-jazz-slate text-jazz-text-muted';
  return (
    <span
      data-on={on}
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] ${
        on ? 'border-jazz-gold bg-jazz-gold text-jazz-black' : off
      }`}
    >
      {children}
    </span>
  );
}

/** Stars as filled or outline glyphs with a text label, so color is not the only signal. */
export function Stars({ count, small = false }: { readonly count: number; readonly small?: boolean }) {
  const t = useTranslations('game');
  return (
    <div
      role="img"
      aria-label={t('result.stars', { count })}
      className={`flex gap-2 leading-none ${small ? 'text-[28px]' : 'text-[40px]'}`}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          data-on={index < count}
          className={index < count ? 'text-jazz-amber' : 'text-jazz-muted'}
        >
          {index < count ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}
