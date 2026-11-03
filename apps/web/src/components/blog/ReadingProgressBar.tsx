'use client';
import { useEffect, useState } from 'react';

export default function ReadingProgressBar() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const handleScroll = () => {
      animationFrameId = requestAnimationFrame(() => {
        const article = document.querySelector('article');
        if (!article) return;
        
        const { top, bottom, height } = article.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        let progress = 0;
        if (top > viewportHeight) {
          progress = 0;
        } else if (bottom < viewportHeight) {
          progress = 100;
        } else {
          const scrollableDistance = height - viewportHeight;
          if (scrollableDistance > 0) {
            progress = Math.min(100, Math.max(0, ((viewportHeight - top) / scrollableDistance) * 100));
          }
        }
        setWidth(progress);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 z-50 transition-[width] duration-75 ease-out"
      style={{
        width: `${width}%`,
        height: '3px',
        background: 'linear-gradient(90deg, #d4a574, #e8b868)',
        boxShadow: '0 0 8px rgba(212,165,116,0.4)'
      }}
      aria-hidden="true"
    />
  );
}
