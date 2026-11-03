'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    setIsVisible(true);
    setProgress(0);
    
    // Start fast progress
    const t1 = setTimeout(() => setProgress(80), 10);
    // Complete progress
    const t2 = setTimeout(() => setProgress(100), 300);
    // Hide
    const t3 = setTimeout(() => setIsVisible(false), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 z-50 w-full pointer-events-none">
      <div
        className="h-[2px] bg-gradient-to-r from-jazz-gold via-jazz-amber to-jazz-gold transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: isVisible ? 1 : 0,
        }}
      />
    </div>
  );
}
