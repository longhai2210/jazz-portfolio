/**
 * Hand-drawn-clean jazz/café SVG marks — use currentColor for theme tokens.
 * Decorative by default (aria-hidden).
 */

import type { ReactNode } from 'react';

export type JazzMarkName =
  | 'mail'
  | 'phone'
  | 'pin'
  | 'globe'
  | 'briefcase'
  | 'toolkit'
  | 'avatar'
  | 'trumpet'
  | 'check';

interface MarkProps {
  size?: number;
  className?: string;
}

function MarkSvg({
  size = 24,
  className = '',
  viewBox = '0 0 32 32',
  children,
}: MarkProps & { viewBox?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={`inline-block shrink-0 select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Envelope with a tiny eighth-note flag — organic corners. */
export function JazzMarkMail({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M4.5 9.2c0-1.2.9-2.2 2-2.2h19c1.1 0 2 1 2 2.2v13.1c0 1.2-.9 2.2-2 2.2h-19c-1.1 0-2-1-2-2.2V9.2Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path
        d="M5.2 9.5 15.4 17.2c.5.4 1.3.4 1.8 0L27 9.5"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tiny note flourish */}
      <circle cx={25.2} cy={6.2} r={1.35} fill="currentColor" />
      <path
        d="M26.4 6.1V2.4c1.1.3 1.9 1.1 2 2.1"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </MarkSvg>
  );
}

/** Soft vintage handset curve. */
export function JazzMarkPhone({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M8.2 5.5c1.1-.9 2.8-.7 3.6.5l1.5 2.2c.5.8.3 1.9-.5 2.5l-1.4 1c.8 2.2 2.5 4 4.7 4.9l1.1-1.3c.6-.8 1.7-1 2.5-.5l2.3 1.4c1.2.7 1.5 2.4.6 3.5-1.2 1.4-3.1 2.3-5.1 2.1-5.6-.5-10.4-5.1-11.2-10.7-.3-2 .5-4 2-5.2Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path
        d="M19.5 8.2c1.4.4 2.5 1.5 2.9 2.9"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.85}
      />
      <path
        d="M18.2 5.8c2.4.6 4.3 2.5 5 4.9"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        opacity={0.55}
      />
    </MarkSvg>
  );
}

/** Map pin with a soft leaf accent. */
export function JazzMarkPin({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M16 4.2c4.2 0 7.5 3.2 7.5 7.2 0 5.4-6.2 12.4-7.1 13.4-.2.2-.5.2-.7 0-.9-1-7.2-8-7.2-13.4 0-4 3.3-7.2 7.5-7.2Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <circle cx={16} cy={11.2} r={2.4} stroke="currentColor" strokeWidth={1.6} />
      <path
        d="M22.5 6.5c1.6-.2 2.8 1.1 2.4 2.6-.5 1.6-2.2 2.4-3.5 2.1"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        opacity={0.75}
      />
    </MarkSvg>
  );
}

/** Soft globe with an orbit ring. */
export function JazzMarkGlobe({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <circle cx={16} cy={16} r={10.2} stroke="currentColor" strokeWidth={1.7} />
      <ellipse
        cx={16}
        cy={16}
        rx={4.2}
        ry={10.2}
        stroke="currentColor"
        strokeWidth={1.4}
      />
      <path
        d="M6.2 12.5h19.6M6.2 19.5h19.6"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
      />
      <path
        d="M8 8.5c3.2 1.2 6.8 1.2 10 0"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.7}
      />
    </MarkSvg>
  );
}

/** Soft briefcase with a tiny note on the clasp. */
export function JazzMarkBriefcase({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M5 12.2c0-1.3 1-2.4 2.3-2.4h17.4c1.3 0 2.3 1.1 2.3 2.4v11c0 1.3-1 2.4-2.3 2.4H7.3C6 25.6 5 24.5 5 23.2v-11Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path
        d="M12 9.8V7.6c0-1 .8-1.8 1.8-1.8h4.4c1 0 1.8.8 1.8 1.8v2.2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M5.2 16.2h21.6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={16} cy={16.2} r={1.3} fill="currentColor" />
      <path
        d="M16.9 15.9V13.4c.7.2 1.2.7 1.3 1.3"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </MarkSvg>
  );
}

/** Crossed brushes / tools with soft organic handles. */
export function JazzMarkToolkit({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M9.2 6.5 22.8 20.1"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M22.8 6.5 9.2 20.1"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path
        d="M7.5 5.2c1.4-.4 2.8.6 2.8 2.1 0 1-.6 1.8-1.5 2.1"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path
        d="M24.5 5.2c-1.4-.4-2.8.6-2.8 2.1 0 1 .6 1.8 1.5 2.1"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={8.2} cy={23.2} r={2.1} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={23.8} cy={23.2} r={2.1} stroke="currentColor" strokeWidth={1.5} />
    </MarkSvg>
  );
}

/** Soft person silhouette with a small note — avatar fallback. */
export function JazzMarkAvatar({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <circle cx={16} cy={11} r={5.2} stroke="currentColor" strokeWidth={1.7} />
      <path
        d="M6.5 26.5c1.2-5.2 5-8 9.5-8s8.3 2.8 9.5 8"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <circle cx={23.5} cy={7.2} r={1.2} fill="currentColor" />
      <path
        d="M24.5 7.1V4.2c.8.2 1.4.8 1.5 1.5"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </MarkSvg>
  );
}

/** Trumpet flourish for form success. */
export function JazzMarkTrumpet({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className} viewBox="0 0 40 32">
      <path
        d="M4 18.5h18.5c.8 0 1.5.4 1.9 1.1l3.2 5.4c.5.9-.1 2-1.2 2H8.2c-1.1 0-1.7-1.2-1.1-2.1l2-3.4"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <path
        d="M8 18.5V12.2c0-1.2.9-2.2 2.1-2.2h8.2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <path
        d="M22.5 10h8.2c1.4 0 2.3 1.5 1.6 2.7L28.5 19"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <circle cx={12.5} cy={14.2} r={1.5} fill="currentColor" />
      <circle cx={17.2} cy={14.2} r={1.5} fill="currentColor" />
      <path
        d="M33 8.5c1.5-1.2 3.2-1.4 4.2-.4"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.8}
      />
      <path
        d="M33.5 12c1.8-.4 3.5.2 4.2 1.4"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        opacity={0.55}
      />
    </MarkSvg>
  );
}

/** Soft check for copied / success micro-state. */
export function JazzMarkCheck({ size = 24, className = '' }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path
        d="M7 16.2 13.2 22 25 8.5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </MarkSvg>
  );
}

const MARKS = {
  mail: JazzMarkMail,
  phone: JazzMarkPhone,
  pin: JazzMarkPin,
  globe: JazzMarkGlobe,
  briefcase: JazzMarkBriefcase,
  toolkit: JazzMarkToolkit,
  avatar: JazzMarkAvatar,
  trumpet: JazzMarkTrumpet,
  check: JazzMarkCheck,
} as const;

export function JazzMark({
  name,
  size,
  className,
}: MarkProps & { name: JazzMarkName }) {
  const Comp = MARKS[name];
  return <Comp size={size} className={className} />;
}
