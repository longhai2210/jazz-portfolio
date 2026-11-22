'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { NO_SIDES, type HeldSides, type WalkSide } from './street-keys';

export interface StreetControlsProps {
  /** Called with the sides held whenever they change. */
  readonly onChange: (held: HeldSides) => void;
  /** Draw the arrows: true on a touch screen (`pointer: coarse`). The zones work either way. */
  readonly showArrows: boolean;
  /** Ignore presses and let go of every held side, for example while the tab is hidden. */
  readonly disabled?: boolean;
}

const SIDES: readonly WalkSide[] = ['left', 'right'];

/** Which pointers hold which side, by pointer id. */
type HeldPointers = ReadonlyMap<number, WalkSide>;

function sidesOf(pointers: HeldPointers): HeldSides {
  if (pointers.size === 0) return NO_SIDES;
  const sides = [...pointers.values()];
  return { left: sides.includes('left'), right: sides.includes('right') };
}

function Arrow({ side }: { readonly side: WalkSide }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-14 w-14 text-jazz-text-muted opacity-50"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-testid={`street-arrow-${side}`}
    >
      {side === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

/**
 * The touch zones of the street (design.md section 3, AC-STAGE-003.1): a strip along the bottom,
 * 40% of the screen high, split into a left and a right half. Holding a half walks that way and
 * letting go (or `pointercancel`) stops. Each pointer is captured, so a finger that slides out of
 * its half keeps walking the same way until it lifts. A finger on each half cancels out.
 *
 * The strip is `aria-hidden`: keyboard and screen reader users walk with A, D and the arrows.
 */
export default function StreetControls({ onChange, showArrows, disabled = false }: StreetControlsProps) {
  const [pointers, setPointers] = useState<HeldPointers>(() => new Map());
  const held = sidesOf(pointers);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    onChangeRef.current({ left: held.left, right: held.right });
  }, [held.left, held.right]);

  useEffect(() => {
    if (disabled) setPointers((current) => (current.size === 0 ? current : new Map()));
  }, [disabled]);

  function press(side: WalkSide, event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // Only the main button of a mouse; touch and pen report button 0 too.
    if (event.button > 0) return;
    const { pointerId } = event;
    try {
      event.currentTarget.setPointerCapture(pointerId);
    } catch {
      // A pointer the browser no longer tracks: it still counts until it lifts.
    }
    setPointers((current) => {
      const next = new Map(current);
      next.set(pointerId, side);
      return next;
    });
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    const { pointerId } = event;
    setPointers((current) => {
      if (!current.has(pointerId)) return current;
      const next = new Map(current);
      next.delete(pointerId);
      return next;
    });
  }

  return (
    <div
      aria-hidden="true"
      data-testid="street-touch-zones"
      className="pointer-events-auto absolute inset-x-0 bottom-0 grid h-[40%] grid-cols-2 touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
    >
      {SIDES.map((side) => {
        const isHeld = held[side];
        return (
          <div
            key={side}
            data-side={side}
            data-held={isHeld}
            onPointerDown={(event) => press(side, event)}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex items-center justify-center border-t-2 ${
              isHeld ? 'border-jazz-gold bg-jazz-dark/60' : 'border-transparent bg-transparent'
            }`}
          >
            {showArrows && <Arrow side={side} />}
          </div>
        );
      })}
    </div>
  );
}
