'use client';
import { useEffect, useState, useRef } from 'react';

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  headings: Heading[];
  variant?: 'mobile' | 'desktop';
}

export default function TableOfContents({ headings, variant = 'desktop' }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      rootMargin: '-100px 0px -40% 0px',
    });

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.current?.observe(element);
      }
    });

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [headings]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
      setIsOpen(false);
    }
  };

  if (headings.length === 0) return null;

  const content = (
    <ul className="space-y-2 text-sm">
      {headings.map((heading) => (
        <li
          key={heading.id}
          style={{ paddingLeft: heading.level === 3 ? '1rem' : '0' }}
        >
          <a
            href={`#${heading.id}`}
            onClick={(e) => handleClick(e, heading.id)}
            className={`block py-1 px-2 border-l-2 transition-colors ${
              activeId === heading.id
                ? 'border-jazz-gold text-jazz-gold'
                : 'border-transparent text-jazz-text-muted hover:text-jazz-text'
            }`}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );

  if (variant === 'mobile') {
    return (
      <div className="lg:hidden mb-8">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 bg-jazz-dark/70 backdrop-blur-md border border-jazz-slate rounded-2xl text-jazz-text font-bold"
        >
          Table of Contents
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
        {isOpen && (
          <div className="mt-2 p-4 bg-jazz-dark/70 backdrop-blur-md border border-jazz-slate rounded-2xl">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-6 bg-jazz-dark/70 backdrop-blur-md border border-jazz-slate rounded-2xl min-w-[250px]">
      <h2 className="text-lg font-bold text-jazz-gold mb-4">Table of Contents</h2>
      {content}
    </div>
  );
}
