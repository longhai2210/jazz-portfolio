'use client';

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Shared pieces of the game screens (design "Shared pieces and reuse"): the way home, the top bar,
 * the centered panel, buttons, chips and star ratings. Plain React with `jazz-*` tokens.
 */

/** Called just before the player leaves the game for the portfolio: releases the audio. */
export const LeaveGameContext = createContext<() => void>(() => undefined);

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
 * "Back to portfolio", to the portfolio home page in the language in use (AC-DUEL-013.9). It
 * releases the audio first (AC-DUEL-014.3); the page then leaves through the router.
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
      onClick={() => leave()}
      aria-label={variant === 'icon' ? label : undefined}
      className={className}
      data-testid="home-link"
    >
      {(variant === 'bar' || variant === 'icon') && <span aria-hidden="true">&larr;</span>}
      {variant !== 'icon' && <span>{label}</span>}
    </Link>
  );
}

/** The top bar every screen has: the way home on the left, screen controls on the right. */
export function TopBar({
  compact = false,
  left,
  right,
}: {
  readonly compact?: boolean;
  readonly left?: ReactNode;
  readonly right?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-jazz-slate px-4 py-2.5 text-[13px]">
      <div className="flex items-center gap-3">
        <HomeLink variant={compact ? 'icon' : 'bar'} />
        {left}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </header>
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
  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
        <section
          role={role}
          aria-labelledby={labelledBy}
          className={`flex w-full flex-col items-center gap-3.5 rounded-2xl border border-jazz-slate bg-jazz-dark px-6 py-7 text-center ${
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
  return (
    <span
      data-on={on}
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] ${
        on ? 'border-jazz-gold bg-jazz-gold text-jazz-black' : 'border-jazz-slate text-jazz-text-muted'
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
