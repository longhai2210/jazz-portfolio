/**
 * Crisp SVG music-notation glyphs (not emoji). Use currentColor for theme tokens.
 */

export type NoteVariant = 'quarter' | 'eighth' | 'beamed';

interface GlyphProps {
  className?: string;
  size?: number;
}

/** Filled oval notehead, slightly rotated like real notation. */
function NoteHead({ cx, cy }: { cx: number; cy: number }) {
  return (
    <ellipse
      cx={cx}
      cy={cy}
      rx={5.2}
      ry={3.8}
      transform={`rotate(-22 ${cx} ${cy})`}
      fill="currentColor"
    />
  );
}

export function QuarterNote({ className = '', size = 28 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size * 1.45}
      viewBox="0 0 24 36"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <NoteHead cx={8} cy={28} />
      <path
        d="M12.6 27.2 V6.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function EighthNote({ className = '', size = 28 }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size * 1.45}
      viewBox="0 0 28 36"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <NoteHead cx={8} cy={28} />
      <path
        d="M12.6 27.2 V7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* Flag */}
      <path
        d="M12.6 7 C18 8.5, 22 12, 21.5 17.5 C19.5 14, 16 11.5, 12.6 11 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function BeamedEighths({ className = '', size = 36 }: GlyphProps) {
  return (
    <svg
      width={size * 1.35}
      height={size}
      viewBox="0 0 48 36"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <NoteHead cx={8} cy={28} />
      <NoteHead cx={30} cy={30} />
      <path
        d="M12.6 27.2 V9"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M34.6 29.2 V11"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* Beam */}
      <path
        d="M12.2 9 L34.8 11 L34.8 14.2 L12.2 12.2 Z"
        fill="currentColor"
      />
    </svg>
  );
}

const VARIANTS = {
  quarter: QuarterNote,
  eighth: EighthNote,
  beamed: BeamedEighths,
} as const;

export function MusicNoteGlyph({
  variant,
  className,
  size,
}: GlyphProps & { variant: NoteVariant }) {
  const Comp = VARIANTS[variant];
  return <Comp className={className} size={size} />;
}

export function randomNoteVariant(): NoteVariant {
  const roll = Math.random();
  if (roll < 0.4) return 'quarter';
  if (roll < 0.75) return 'eighth';
  return 'beamed';
}
