'use client';

import { useRef } from 'react';
import { motion, useInView, UseInViewOptions } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'none';
  delay?: number;
  duration?: number;
  threshold?: UseInViewOptions['amount'];
  once?: boolean;
}

export default function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: threshold, once });

  const getVariants = () => {
    const hidden = {
      opacity: 0,
      y: direction === 'up' ? 40 : direction === 'down' ? -40 : 0,
      x: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
      scale: direction === 'scale' ? 0.9 : 1,
    };

    const visible = {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
    };

    return { hidden, visible };
  };

  const variants = getVariants();

  return (
    <div ref={ref} className="w-full">
      <motion.div
        variants={variants}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{
          duration,
          delay,
          ease: [0.25, 0.1, 0.25, 1], // easeInOut cubic
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
