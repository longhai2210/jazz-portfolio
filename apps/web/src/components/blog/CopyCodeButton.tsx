'use client';
import { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

export default function CopyCodeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 bg-jazz-dark/60 hover:bg-jazz-slate/80 text-jazz-text-muted hover:text-jazz-gold rounded transition-colors backdrop-blur-sm z-10"
      aria-label="Copy code"
      title="Copy code"
    >
      {copied ? <FiCheck size={14} /> : <FiCopy size={14} />}
    </button>
  );
}
