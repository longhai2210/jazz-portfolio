/**
 * Soft sound-wave / vinyl-groove ribbons for the portfolio ambient background.
 * Theme-aware via CSS variables; motion handled in globals.css (no client JS).
 */

const WAVE_VIEW_W = 1440;
const WAVE_VIEW_H = 900;
const SEGMENTS = 6;

/** One period of a soft audio-envelope curve starting at xOffset. */
function wavePathPeriod(
  yBase: number,
  amplitude: number,
  phases: number,
  xOffset: number,
): string {
  const w = WAVE_VIEW_W;
  let d = `M ${xOffset} ${yBase}`;
  for (let i = 0; i < SEGMENTS; i++) {
    const x1 = xOffset + ((i + 1) / SEGMENTS) * w;
    const mid = xOffset + ((i + 0.5) / SEGMENTS) * w;
    const dir = (i + phases) % 2 === 0 ? -1 : 1;
    const y = yBase + dir * amplitude;
    d += ` Q ${mid} ${y} ${x1} ${yBase}`;
  }
  return d;
}

/** Two identical periods side-by-side for a seamless -50% translate loop. */
function dualWavePath(yBase: number, amplitude: number, phases: number): string {
  return (
    wavePathPeriod(yBase, amplitude, phases, 0) +
    ' ' +
    wavePathPeriod(yBase, amplitude, phases, WAVE_VIEW_W)
  );
}

function WaveBand({
  className,
  yBase,
  amplitude,
  phases,
  strokeVar,
  fillVar,
  strokeWidth,
}: {
  className: string;
  yBase: number;
  amplitude: number;
  phases: number;
  strokeVar: string;
  fillVar: string;
  strokeWidth: number;
}) {
  const path = dualWavePath(yBase, amplitude, phases);
  const fillPath = `${path} L ${WAVE_VIEW_W * 2} ${WAVE_VIEW_H} L 0 ${WAVE_VIEW_H} Z`;

  return (
    <svg
      className={`wave-layer ${className}`}
      viewBox={`0 0 ${WAVE_VIEW_W * 2} ${WAVE_VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d={fillPath} fill={fillVar} stroke="none" />
      <path
        d={path}
        fill="none"
        stroke={strokeVar}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function JazzWaveBackground() {
  return (
    <div className="jazz-wave-bg wave-breathe" aria-hidden>
      {/* Far — cool indigo groove, slowest */}
      <WaveBand
        className="wave-layer--far"
        yBase={220}
        amplitude={48}
        phases={0}
        strokeVar="color-mix(in srgb, var(--color-jazz-indigo) 55%, transparent)"
        fillVar="color-mix(in srgb, var(--color-jazz-indigo) 6%, transparent)"
        strokeWidth={1.25}
      />
      {/* Mid — brass ribbon */}
      <WaveBand
        className="wave-layer--mid"
        yBase={420}
        amplitude={56}
        phases={1}
        strokeVar="color-mix(in srgb, var(--color-jazz-brass) 45%, transparent)"
        fillVar="color-mix(in srgb, var(--color-jazz-brass) 7%, transparent)"
        strokeWidth={1.35}
      />
      {/* Near — gold sound envelope */}
      <WaveBand
        className="wave-layer--near"
        yBase={640}
        amplitude={40}
        phases={0}
        strokeVar="color-mix(in srgb, var(--color-jazz-gold) 50%, transparent)"
        fillVar="color-mix(in srgb, var(--color-jazz-gold) 8%, transparent)"
        strokeWidth={1.5}
      />
    </div>
  );
}
