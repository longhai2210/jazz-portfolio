'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import JazzLoader from '../animation/JazzLoader';
import JazzWaveBackground from '../animation/JazzWaveBackground';

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
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {/* Soft sound-wave / vinyl-groove ambient layer (behind content) */}
      <div
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <JazzWaveBackground />
      </div>

      {/* 1. Full-screen Intro Loader */}
      <JazzLoader onComplete={() => setIsLoading(false)} />

      {/* 2. Main Page Layout (Fades in once loading finishes) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoading ? 0 : 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="relative z-10 w-full min-h-screen"
      >
        {children}
      </motion.div>

      {/* 3. Ambient Background Smoke Effect */}
      {!isLoading && <SmokeEffect />}

      {/* 4. Scroll music-notes (right gutter + edge bounce) */}
      {!isLoading && <ScrollNotesEffect />}
    </>
  );
}
