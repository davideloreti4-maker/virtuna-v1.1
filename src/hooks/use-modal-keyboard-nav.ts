// src/hooks/use-modal-keyboard-nav.ts
import { useCallback, useEffect } from "react";

interface UseModalKeyboardNavOptions {
  isOpen: boolean;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export function useModalKeyboardNav({
  isOpen,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: UseModalKeyboardNavOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if target is within an iframe (avoid TikTok player conflicts)
      const target = event.target as HTMLElement;
      if (target.tagName === "IFRAME" || target.closest("iframe")) return;

      if (event.key === "ArrowLeft" && hasPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    },
    [onPrevious, onNext, hasPrevious, hasNext]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);
}
