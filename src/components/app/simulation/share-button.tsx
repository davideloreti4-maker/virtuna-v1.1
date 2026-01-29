'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
  resultId: string;
}

/**
 * ShareButton - Copies simulation result URL to clipboard
 *
 * Features:
 * - Icon + text button
 * - Copies share URL on click
 * - Shows "Copied!" feedback for 2 seconds
 */
export function ShareButton({ resultId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // For now, copy a mock URL to clipboard
    const shareUrl = `${window.location.origin}/results/${resultId}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy to clipboard');
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5',
        'border border-zinc-700 bg-zinc-800/50',
        'text-sm text-zinc-400',
        'transition-colors hover:bg-zinc-800 hover:text-white'
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span>Share Simulation</span>
        </>
      )}
    </button>
  );
}
