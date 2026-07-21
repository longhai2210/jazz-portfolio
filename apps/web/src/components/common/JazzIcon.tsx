'use client';

import { GiSaxophone } from 'react-icons/gi';

interface JazzIconProps {
  className?: string;
  size?: number;
}

export default function JazzIcon({ className = '', size = 24 }: JazzIconProps) {
  return (
    <GiSaxophone
      size={size}
      className={`inline-block select-none pointer-events-none text-jazz-gold drop-shadow-[0_0_4px_rgba(212,165,116,0.5)] ${className}`}
    />
  );
}

