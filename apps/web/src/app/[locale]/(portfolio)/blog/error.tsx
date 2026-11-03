'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Blog error encountered:', error);
  }, [error]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center gap-6">
      <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-2xl">
        🎷
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">
          Something went wrong loading Journal
        </h1>
        <p className="text-sm font-mono text-jazz-text-muted max-w-md">
          {error.message || 'An unexpected network or system error occurred.'}
        </p>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={reset}
          className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-2.5 px-6 rounded-xl text-xs font-mono transition-all cursor-pointer shadow-[0_0_15px_rgba(212,165,116,0.15)]"
        >
          🔄 Try Again
        </button>

        <Link
          href="/"
          className="px-6 py-2.5 border border-jazz-slate hover:border-jazz-gold text-jazz-gold rounded-xl text-xs font-mono transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
