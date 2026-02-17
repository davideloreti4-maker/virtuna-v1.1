'use client';

import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

interface ShareButtonProps {
  resultId?: string;
}

/**
 * ShareButton - Copies simulation result URL to clipboard
 *
 * Features:
 * - Ghost button with icon + text
 * - Copies share URL on click
 * - Shows toast feedback via useToast
 */
export function ShareButton({ resultId }: ShareButtonProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const shareUrl = resultId
      ? `${window.location.origin}/results/${resultId}`
      : window.location.href;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: "success", title: "Link copied to clipboard" });
    } catch {
      toast({ variant: "error", title: "Failed to copy link" });
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleShare}>
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  );
}
