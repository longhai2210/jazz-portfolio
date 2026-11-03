import { ReactNode } from 'react';

interface HeroAnimationsProps {
  children: ReactNode;
  delay?: number;
  animationVariant?: 'fadeUp' | 'fadeScale';
  className?: string;
}

export default function HeroAnimations({
  children,
  delay = 0,
  animationVariant = 'fadeUp',
  className = '',
}: HeroAnimationsProps) {
  return (
    <div
      className={`hero-enter hero-enter--${animationVariant} ${className}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
