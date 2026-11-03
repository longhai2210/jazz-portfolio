'use client';

interface ScrollDownButtonProps {
  label: string;
}

export default function ScrollDownButton({ label }: ScrollDownButtonProps) {
  return (
    <button
      className="scroll-down-cue absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer bg-transparent border-none p-2 opacity-60"
      onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
      aria-label={label}
    >
      <span className="text-xs font-mono tracking-widest text-jazz-text-dim uppercase">
        {label}
      </span>
      <span className="text-jazz-gold text-lg">↓</span>
    </button>
  );
}
