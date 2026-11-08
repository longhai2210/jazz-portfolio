'use client';

import { BEATS_PER_BAR } from '../../core/config';
import { NO_TRANSITION } from '../lanes/lane-identity';

export interface CountInProps {
  /** Beat of the count-in bar, 0 to 3; negative in the short lead before it starts. */
  readonly beat: number;
  /** "Count-in" at the start of a match, "Round n of 3 · Echo restarts" after a resume. */
  readonly caption: string;
}

/**
 * The count-in bar over the board (design screen 8): the beat number, big, and 4 beat dots, so it
 * works with the sound off. Numbers are announced as they change.
 */
export default function CountIn({ beat, caption }: CountInProps) {
  const shown = beat >= 0 && beat < BEATS_PER_BAR ? String(beat + 1) : '';
  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center bg-jazz-black/80"
      data-testid="count-in"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          aria-live="assertive"
          className="min-h-[72px] font-heading text-7xl leading-none text-jazz-amber"
        >
          {shown}
        </div>
        <div className="flex justify-center gap-3" aria-hidden="true">
          {Array.from({ length: BEATS_PER_BAR }, (_, index) => (
            <i
              key={index}
              data-on={index <= beat}
              style={NO_TRANSITION}
              className={`block h-4 w-4 rounded-full border-2 border-jazz-gold ${
                index <= beat ? 'bg-jazz-gold' : ''
              }`}
            />
          ))}
        </div>
        <p className="font-body text-sm text-jazz-text-muted">{caption}</p>
      </div>
    </div>
  );
}
