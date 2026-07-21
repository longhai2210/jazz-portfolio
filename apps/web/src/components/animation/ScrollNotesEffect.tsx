'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useThemeStore } from '@/stores/themeStore';
import {
  MusicNoteGlyph,
  NoteVariant,
  randomNoteVariant,
} from './MusicNoteGlyphs';

const MAX_NOTES = 24;
const EDGE_ZONE = 40;
const EDGE_COOLDOWN_MS = 400;
const SCROLL_SPAWN_MIN_DELTA = 8;

type NoteKind = 'trail' | 'burst-top' | 'burst-bottom';

interface ActiveNote {
  id: number;
  variant: NoteVariant;
  kind: NoteKind;
  x: number;
  y: number;
  size: number;
  rotate: number;
  dx: number;
  dy: number;
  colorClass: string;
}

let noteIdSeq = 0;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function colorForTheme(theme: 'dark' | 'light-jazz'): string {
  if (theme === 'light-jazz') {
    return Math.random() > 0.45 ? 'text-jazz-brass' : 'text-jazz-gold';
  }
  return Math.random() > 0.4 ? 'text-jazz-gold' : 'text-jazz-brass';
}

export default function ScrollNotesEffect() {
  const theme = useThemeStore((s) => s.theme);
  const [notes, setNotes] = useState<ActiveNote[]>([]);
  const [enabled, setEnabled] = useState(false);

  const lastScrollY = useRef(0);
  const lastSpawnAt = useRef(0);
  const lastBurstAt = useRef(0);
  const atTopLatched = useRef(true);
  const atBottomLatched = useRef(false);

  const removeNote = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushNotes = useCallback((incoming: ActiveNote[]) => {
    if (incoming.length === 0) return;
    setNotes((prev) => {
      const next = [...prev, ...incoming];
      if (next.length <= MAX_NOTES) return next;
      return next.slice(next.length - MAX_NOTES);
    });
  }, []);

  const spawnTrail = useCallback(
    (scrollDelta: number) => {
      const now = performance.now();
      if (now - lastSpawnAt.current < 55) return;
      lastSpawnAt.current = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = w < 640 ? 1 : 1 + Math.floor(Math.random() * 2);
      const dir = scrollDelta > 0 ? 1 : -1;
      const batch: ActiveNote[] = [];

      for (let i = 0; i < count; i++) {
        batch.push({
          id: ++noteIdSeq,
          variant: randomNoteVariant(),
          kind: 'trail',
          x: w - (12 + Math.random() * 28),
          y: h * (0.25 + Math.random() * 0.5),
          size: 18 + Math.random() * 14,
          rotate: (Math.random() - 0.5) * 40,
          dx: -(18 + Math.random() * 42),
          dy: dir * (28 + Math.random() * 48),
          colorClass: colorForTheme(theme),
        });
      }
      pushNotes(batch);
    },
    [pushNotes, theme],
  );

  const spawnBurst = useCallback(
    (edge: 'top' | 'bottom') => {
      const now = performance.now();
      if (now - lastBurstAt.current < EDGE_COOLDOWN_MS) return;
      lastBurstAt.current = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = w < 640;
      const count = isMobile ? 5 : 5 + Math.floor(Math.random() * 4);
      const batch: ActiveNote[] = [];

      for (let i = 0; i < count; i++) {
        // Hit top → burst from top-right (jump down-left)
        // Hit bottom → burst from bottom-right (jump up-left)
        const fromTop = edge === 'top';
        batch.push({
          id: ++noteIdSeq,
          variant: randomNoteVariant(),
          kind: fromTop ? 'burst-top' : 'burst-bottom',
          x: w - (4 + Math.random() * 14),
          y: fromTop
            ? 72 + Math.random() * 28 // below header
            : h - (88 + Math.random() * 36), // above music bar
          size: 20 + Math.random() * 16,
          rotate: (Math.random() - 0.5) * 50,
          dx: -(40 + Math.random() * 90),
          dy: fromTop
            ? 50 + Math.random() * 100
            : -(50 + Math.random() * 100),
          colorClass: colorForTheme(theme),
        });
      }
      pushNotes(batch);
    },
    [pushNotes, theme],
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setEnabled(false);
      return;
    }
    setEnabled(true);

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => setEnabled(!media.matches);
    media.addEventListener('change', onMotionChange);

    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      if (prefersReducedMotion()) return;

      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      const docH = document.documentElement.scrollHeight;
      const viewH = window.innerHeight;
      const maxScroll = Math.max(0, docH - viewH);

      const nearTop = y <= 2;
      const nearBottom = y >= maxScroll - 2;
      const leftTopZone = y > EDGE_ZONE;
      const leftBottomZone = y < maxScroll - EDGE_ZONE;

      if (leftTopZone) atTopLatched.current = false;
      if (leftBottomZone) atBottomLatched.current = false;

      if (nearTop && !atTopLatched.current) {
        atTopLatched.current = true;
        spawnBurst('top');
      } else if (nearBottom && !atBottomLatched.current && maxScroll > EDGE_ZONE) {
        atBottomLatched.current = true;
        spawnBurst('bottom');
      } else if (Math.abs(delta) >= SCROLL_SPAWN_MIN_DELTA && !nearTop && !nearBottom) {
        spawnTrail(delta);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      media.removeEventListener('change', onMotionChange);
      window.removeEventListener('scroll', onScroll);
    };
  }, [spawnBurst, spawnTrail]);

  if (!enabled) return null;

  return (
    <div
      className="fixed inset-0 z-[15] overflow-hidden pointer-events-none"
      aria-hidden
    >
      <AnimatePresence>
        {notes.map((note) => (
          <NoteParticle key={note.id} note={note} onDone={removeNote} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NoteParticle({
  note,
  onDone,
}: {
  note: ActiveNote;
  onDone: (id: number) => void;
}) {
  const isBurst = note.kind !== 'trail';
  const duration = isBurst ? 0.58 : 0.5;
  const wobble = isBurst ? (note.rotate > 0 ? 32 : -32) : note.rotate * 0.35;

  return (
    <motion.div
      className={`absolute ${note.colorClass} drop-shadow-sm`}
      style={{
        left: note.x,
        top: note.y,
        willChange: 'transform, opacity',
      }}
      initial={{
        opacity: 0,
        scale: 0.6,
        x: 0,
        y: 0,
        rotate: note.rotate * 0.3,
      }}
      animate={{
        opacity: [0, 1, 0.95, 0],
        scale: isBurst ? [0.55, 1.18, 0.95, 0.4] : [0.7, 1.08, 0.85, 0.35],
        x: note.dx,
        y: note.dy,
        rotate: note.rotate + wobble,
      }}
      transition={{
        duration,
        ease: [0.16, 1.15, 0.3, 1],
        opacity: { times: [0, 0.1, 0.7, 1], duration },
        scale: { times: [0, 0.25, 0.55, 1], duration, ease: [0.22, 1.55, 0.36, 1] },
      }}
      onAnimationComplete={() => onDone(note.id)}
    >
      <MusicNoteGlyph
        variant={note.variant}
        size={note.size}
        className="scroll-note-glyph"
      />
    </motion.div>
  );
}
