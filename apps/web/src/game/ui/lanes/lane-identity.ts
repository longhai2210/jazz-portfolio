/**
 * What tells the 4 lanes apart (design "Lane identity", AC-DUEL-013.11): each button has its own
 * shape and its own color, so no lane relies on color alone. The same shape is drawn on the lane's
 * key label, on its touch pad and on every note marker of the lane.
 *
 * Class names are full literals so Tailwind's scanner finds them; never build them from parts.
 */
import { BUTTON_LABELS } from '../../core/config';
import type { Button } from '../../core/types';

export type LaneShapeName = 'circle' | 'square' | 'diamond' | 'triangle';

/** The `jazz-*` color token of a lane. */
export type LaneColor = 'jazz-copper' | 'jazz-amber' | 'jazz-text' | 'jazz-steel';

export interface LaneIdentity {
  readonly button: Button;
  /** Keyboard key of the lane: D, F, J or K. */
  readonly key: string;
  readonly shape: LaneShapeName;
  readonly color: LaneColor;
  /** SVG paint of a filled marker: a note the opponent plays or a tap the player made. */
  readonly filledClass: string;
  /** SVG paint of a hollow marker: a target the player must play. */
  readonly hollowClass: string;
}

export const LANE_IDENTITY: Readonly<Record<Button, LaneIdentity>> = {
  0: {
    button: 0,
    key: BUTTON_LABELS[0],
    shape: 'circle',
    color: 'jazz-copper',
    filledClass: 'fill-jazz-copper',
    hollowClass: 'fill-none stroke-jazz-copper',
  },
  1: {
    button: 1,
    key: BUTTON_LABELS[1],
    shape: 'square',
    color: 'jazz-amber',
    filledClass: 'fill-jazz-amber',
    hollowClass: 'fill-none stroke-jazz-amber',
  },
  2: {
    button: 2,
    key: BUTTON_LABELS[2],
    shape: 'diamond',
    color: 'jazz-text',
    filledClass: 'fill-jazz-text',
    hollowClass: 'fill-none stroke-jazz-text',
  },
  3: {
    button: 3,
    key: BUTTON_LABELS[3],
    shape: 'triangle',
    color: 'jazz-steel',
    // Steel is dark on the black track, so the triangle always carries a text-muted outline.
    filledClass: 'fill-jazz-steel stroke-jazz-text-muted',
    hollowClass: 'fill-none stroke-jazz-text-muted',
  },
};

/** Lanes from top to bottom: K (highest note) on top, D (lowest) at the bottom. */
export const LANE_ORDER: readonly Button[] = [3, 2, 1, 0];

/** Inline style that keeps a game element out of the site-wide 0.5 s color transition. */
export const NO_TRANSITION = { transition: 'none' } as const;
