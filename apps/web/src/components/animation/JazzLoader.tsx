'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JazzIcon from '../common/JazzIcon';


interface JazzLoaderProps {
  onComplete: () => void;
}

export default function JazzLoader({ onComplete }: JazzLoaderProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Check if the loader has already run in this session, allowing bypass via forceLoader query param
    const hasLoaded = sessionStorage.getItem('jazz-loader-complete');
    const params = new URLSearchParams(window.location.search);
    const forceLoader = params.get('forceLoader') === 'true';

    if (hasLoaded === 'true' && !forceLoader) {
      setShouldRender(false);
      onComplete();
      return;
    }


    // Set a timeout to trigger loader completion
    const timer = setTimeout(() => {
      setIsLoaded(true);
      sessionStorage.setItem('jazz-loader-complete', 'true');
      const completeTimer = setTimeout(() => {
        setShouldRender(false);
        onComplete();
      }, 800); // Wait for fade-out transition
      return () => clearTimeout(completeTimer);
    }, 3500); // Intro plays for 3.5s

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!shouldRender) return null;

  // Generate 12 floating musical notes and abstract dust particles with random start positions & delays
  const notes = ['♫', '♪', '✧', '✦', '⋆', '·', '🎵', '✨'];
  const particles = Array.from({ length: 15 }).map((_, i) => ({
    id: i,
    char: notes[i % notes.length],
    x: Math.random() * 100 - 50, // offset left-right
    delay: Math.random() * 2.5,
    duration: 2.5 + Math.random() * 2,
    scale: 0.5 + Math.random() * 0.7,
  }));

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="fixed inset-0 bg-jazz-black z-50 flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Glowing Smoky Backlight */}
          <div className="absolute w-[400px] h-[400px] bg-jazz-gold/15 rounded-full blur-[80px] animate-pulse" />

          {/* Spinning Vinyl Wrapper */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Spinning Vinyl Record */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="relative w-48 h-48 rounded-full shadow-[0_0_30px_rgba(212,165,116,0.3)] flex items-center justify-center"
            >
              <motion.img
                src="/images/vinyl_record.webp"
                alt="Spinning Vinyl Record"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                className="w-full h-full object-cover rounded-full"
              />
              {/* Overlay styling for the vinyl edge */}
              <div className="absolute inset-0 rounded-full border border-jazz-gold/20 pointer-events-none shadow-inner" />
            </motion.div>

            {/* Rising Musical Note Particles */}
            {particles.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 0, y: 80, x: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.8, 0.8, 0],
                  y: [-20, -180],
                  x: [0, p.x, p.x * 1.5],
                  scale: [0, p.scale, p.scale, p.scale * 0.5],
                }}
                transition={{
                  repeat: Infinity,
                  duration: p.duration,
                  delay: p.delay,
                  ease: 'easeOut',
                }}
                className="absolute text-jazz-gold/70 text-xl pointer-events-none"
                style={{ bottom: '20%' }}
              >
                {p.char}
              </motion.span>
            ))}
          </div>

          {/* Glowing Brass Brand Label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-center mt-6 z-10"
          >
            <h1 className="text-3xl font-heading font-bold text-jazz-gold tracking-widest uppercase drop-shadow-[0_0_10px_rgba(212,165,116,0.3)]">
              <JazzIcon size={32} className="mr-2" /> Jazzfolio
            </h1>
            <p className="text-xs text-jazz-text-dim mt-2 tracking-[0.3em] uppercase">
              Improvisation & Code
            </p>
          </motion.div>

          {/* Loader bar */}
          <div className="w-48 h-[2px] bg-jazz-slate mt-8 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ left: '-100%' }}
              animate={{ left: '100%' }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-jazz-gold to-transparent"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
