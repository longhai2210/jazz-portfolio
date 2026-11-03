'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import JazzWaveBackground from '../animation/JazzWaveBackground';
import JazzLoader from '../animation/JazzLoader';

const SmokeEffect = dynamic(() => import('../animation/SmokeEffect'), {
  ssr: false,
});

const ScrollNotesEffect = dynamic(() => import('../animation/ScrollNotesEffect'), {
  ssr: false,
});

interface PortfolioShellProps {
  children: React.ReactNode;
}

export default function PortfolioShell({ children }: PortfolioShellProps) {
  const [showAmbientEffects, setShowAmbientEffects] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const finishIntro = useCallback(() => setIntroComplete(true), []);

  useEffect(() => {
    if (!introComplete || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Keep decorative JavaScript out of the critical rendering window.
    const timer = window.setTimeout(() => setShowAmbientEffects(true), 1200);
    return () => window.clearTimeout(timer);
  }, [introComplete]);

  return (
    <>
      <JazzLoader onComplete={finishIntro} />
      {/* Soft sound-wave / vinyl-groove ambient layer (behind content) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
        <JazzWaveBackground />
      </div>

      {/* Server-rendered content stays mounted behind the brief intro overlay. */}
      <div className="relative z-10 w-full min-h-screen">{children}</div>

      {showAmbientEffects && <SmokeEffect />}
      {showAmbientEffects && <ScrollNotesEffect />}
    </>
  );
}
