'use client';
import { useState } from 'react';
import { FiCopy, FiTwitter, FiLinkedin, FiCheck } from 'react-icons/fi';

interface ShareBarProps {
  url: string;
  title: string;
}

export default function ShareBar({ url, title }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const shareText = encodeURIComponent(title);
  const shareUrl = encodeURIComponent(url);

  const twitterUrl = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-jazz-slate/40">
      <span className="text-sm font-mono text-jazz-text-dim">Share:</span>
      <button
        onClick={handleCopy}
        className="p-2 text-jazz-text-muted hover:text-jazz-gold hover:bg-jazz-slate/20 rounded-full transition-colors flex items-center justify-center w-9 h-9"
        title="Copy Link"
        aria-label="Copy Link"
      >
        {copied ? <FiCheck /> : <FiCopy />}
      </button>
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-jazz-text-muted hover:text-jazz-gold hover:bg-jazz-slate/20 rounded-full transition-colors flex items-center justify-center w-9 h-9"
        title="Share on Twitter/X"
        aria-label="Share on Twitter/X"
      >
        <FiTwitter />
      </a>
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-jazz-text-muted hover:text-jazz-gold hover:bg-jazz-slate/20 rounded-full transition-colors flex items-center justify-center w-9 h-9"
        title="Share on LinkedIn"
        aria-label="Share on LinkedIn"
      >
        <FiLinkedin />
      </a>
    </div>
  );
}
