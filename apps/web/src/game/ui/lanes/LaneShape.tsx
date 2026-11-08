import type { Button } from '../../core/types';
import { LANE_IDENTITY, NO_TRANSITION, type LaneShapeName } from './lane-identity';

export type LaneShapeVariant = 'filled' | 'hollow';

interface LaneShapeProps {
  readonly button: Button;
  /** Filled: a note played or tapped. Hollow: a target still to play. */
  readonly variant?: LaneShapeVariant;
  readonly className?: string;
}

/** Stroke width in viewBox units (the box is 20 x 20). */
const STROKE: Readonly<Record<LaneShapeVariant, number>> = { filled: 1.5, hollow: 2 };

function ShapePath({ shape }: { readonly shape: LaneShapeName }) {
  switch (shape) {
    case 'circle':
      return <circle cx="10" cy="10" r="8" />;
    case 'square':
      return <rect x="2.5" y="2.5" width="15" height="15" rx="3" />;
    case 'diamond':
      return <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" />;
    case 'triangle':
      return <polygon points="10,2 18.5,17.5 1.5,17.5" />;
  }
}

/** The glyph of a lane: the same shape on the key label, the touch pad and every marker. */
export default function LaneShape({ button, variant = 'filled', className }: LaneShapeProps) {
  const identity = LANE_IDENTITY[button];
  const paint = variant === 'filled' ? identity.filledClass : identity.hollowClass;
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={NO_TRANSITION}
      data-shape={identity.shape}
      data-color={identity.color}
      data-variant={variant}
    >
      <g className={paint} strokeWidth={STROKE[variant]} strokeLinejoin="round">
        <ShapePath shape={identity.shape} />
      </g>
    </svg>
  );
}
