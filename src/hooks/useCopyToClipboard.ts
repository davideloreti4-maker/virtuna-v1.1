"use client";

import { useState, useCallback } from "react";

interface UseCopyToClipboardReturn {
  /** Whether the text was recently copied (resets after timeout) */
  copied: boolean;
  /** Copy text to clipboard. Returns true if successful. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Hook for copying text to the clipboard with feedback state.
 *
 * @param resetDelay - Time in ms before `copied` resets to false (default: 2000)
 *
 * @example
 * ```tsx
 * const { copied, copy } = useCopyToClipboard();
 * <button onClick={() => copy(affiliateLink)}>
 *   {copied ? "Copied!" : "Copy Link"}
 * </button>
 * ```
 */
export function useCopyToClipboard(
  resetDelay = 2000
): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator.clipboard) {
        console.warn("Clipboard API not available");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetDelay);
        return true;
      } catch {
        console.error("Failed to copy to clipboard");
        return false;
      }
    },
    [resetDelay]
  );

  return { copied, copy };
}
