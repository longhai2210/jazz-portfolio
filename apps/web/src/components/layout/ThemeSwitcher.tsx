'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/stores/themeStore';

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const VinylKnob = () => (
  <div className="w-6 h-6 rounded-full bg-jazz-black border border-jazz-gold/50 shadow-md relative flex items-center justify-center overflow-hidden">
    {/* Vinyl Record Grooves */}
    <div className="absolute inset-0 rounded-full border border-jazz-slate/20" />
    <div className="absolute w-4.5 h-4.5 rounded-full border border-jazz-slate/15" />
    <div className="absolute w-3 h-3 rounded-full border border-jazz-slate/10" />
    {/* Center brass label */}
    <div className="w-1.5 h-1.5 rounded-full bg-jazz-gold" />
  </div>
);

interface Note {
  id: number;
  char: string;
  x: number;
}

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [wipePos, setWipePos] = useState({ x: 0, y: 0 });
  const [targetTheme, setTargetTheme] = useState<'dark' | 'light-jazz'>('dark');
  const [notes, setNotes] = useState<Note[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync initial theme to document.documentElement on mount
  useEffect(() => {
    setMounted(true);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggle = (e: React.MouseEvent) => {
    if (isWiping) return;

    const nextTheme = theme === 'dark' ? 'light-jazz' : 'dark';
    setTargetTheme(nextTheme);

    // Calculate click coordinates or button center
    const rect = buttonRef.current?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : e.clientX;
    const y = rect ? rect.top + rect.height / 2 : e.clientY;
    setWipePos({ x, y });

    // Spawn floating musical notes
    const noteChars = ['♩', '♪', '♫', '♬'];
    const newNotes = Array.from({ length: 3 }).map((_, i) => ({
      id: Date.now() + i,
      char: noteChars[Math.floor(Math.random() * noteChars.length)],
      x: (Math.random() - 0.5) * 30, // drift left or right
    }));
    setNotes((prev) => [...prev, ...newNotes]);
    setTimeout(() => {
      setNotes((prev) => prev.filter((n) => !newNotes.find((nn) => nn.id === n.id)));
    }, 1500);

    // Start transition wipe
    setIsWiping(true);

    // Perform the actual theme switch halfway through the circular expansion
    const themeSwitchTimeout = setTimeout(() => {
      toggleTheme();
    }, 3500 * 0.1); // approx 350ms of 700ms transition

    const completeTimeout = setTimeout(() => {
      setIsWiping(false);
    }, 700);

    return () => {
      clearTimeout(themeSwitchTimeout);
      clearTimeout(completeTimeout);
    };
  };

  if (!mounted) {
    // Render placeholder to avoid layout shift while maintaining the server DOM structure
    return (
      <div className="w-18 h-9 rounded-full bg-jazz-charcoal/50 border border-jazz-slate/40" />
    );
  }

  const isDark = theme === 'dark';
  const overlayBg = targetTheme === 'dark' ? '#0a0a0f' : '#faf6f0';

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative w-18 h-9 rounded-full bg-jazz-charcoal/80 border border-jazz-slate hover:border-jazz-gold/60 flex items-center justify-between px-2 cursor-pointer transition-all duration-300 select-none overflow-visible focus:outline-none focus:ring-1 focus:ring-jazz-gold/50"
        aria-label="Toggle theme"
      >
        {/* Floating notes container */}
        <div className="absolute inset-x-0 -top-8 flex justify-center pointer-events-none">
          <AnimatePresence>
            {notes.map((note) => (
              <motion.span
                key={note.id}
                initial={{ opacity: 0, y: 15, scale: 0.5, x: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: -30,
                  x: note.x,
                  scale: [0.5, 1.2, 1, 0.8],
                  rotate: note.x * 2,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute text-jazz-gold text-lg font-bold"
              >
                {note.char}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {/* Emojis/Icons for active states */}
        <span className={`transition-opacity duration-300 ${isDark ? 'opacity-100 text-jazz-gold' : 'opacity-40 text-jazz-text-dim'}`}>
          <MoonIcon />
        </span>
        <span className={`transition-opacity duration-300 ${!isDark ? 'opacity-100 text-jazz-gold' : 'opacity-40 text-jazz-text-dim'}`}>
          <SunIcon />
        </span>

        {/* Sliding Vinyl Knob */}
        <motion.div
          className="absolute left-1"
          animate={{ x: isDark ? 0 : 36 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <motion.div
            animate={{ rotate: isDark ? 0 : 360 }}
            transition={{ duration: 0.5 }}
          >
            <VinylKnob />
          </motion.div>
        </motion.div>
      </button>

      {/* Full-screen Vinyl wiping transition overlay */}
      <AnimatePresence>
        {isWiping && (
          <motion.div
            initial={{ clipPath: `circle(0% at ${wipePos.x}px ${wipePos.y}px)` }}
            animate={{ clipPath: `circle(150% at ${wipePos.x}px ${wipePos.y}px)` }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: overlayBg }}
          >
            {/* Spinning Groove lines */}
            <div
              className="absolute inset-0 opacity-8"
              style={{
                backgroundImage: `radial-gradient(circle at ${wipePos.x}px ${wipePos.y}px, transparent 0%, currentColor 100%)`,
                color: targetTheme === 'dark' ? '#ffffff' : '#000000',
              }}
            />

            {/* Background Vinyl Grooves */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
              className="w-[150vmax] h-[150vmax] border-[6px] border-double rounded-full opacity-[0.03] pointer-events-none absolute"
              style={{ borderColor: targetTheme === 'dark' ? '#ffffff' : '#000000' }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
              className="w-[100vmax] h-[100vmax] border-[3px] border-dashed rounded-full opacity-[0.02] pointer-events-none absolute"
              style={{ borderColor: targetTheme === 'dark' ? '#ffffff' : '#000000' }}
            />
            <motion.div
              animate={{ rotate: 180 }}
              transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
              className="w-[60vmax] h-[60vmax] border border-double rounded-full opacity-[0.015] pointer-events-none absolute"
              style={{ borderColor: targetTheme === 'dark' ? '#ffffff' : '#000000' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
