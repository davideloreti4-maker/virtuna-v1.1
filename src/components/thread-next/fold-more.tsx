"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The "More" of a folded text in a sheet, lifted out of the hook's sheet (`FoldedText` in
 * `sheet-body.tsx`) so the remix's "Why the original worked" folds the same way. What a fold shows is
 * `foldLead`'s alone (`src/lib/thread-next/first-sentence.ts`); this is the control and its focus.
 *
 * `useFold`: whether the fold is open, `openFold` for "More", and `wholeRef` for the whole text that
 * replaces the lead: the focus moves to it on the open, so a screen reader and a keyboard carry on
 * where "More" was (the button itself is gone).
 */
export function useFold() {
  const [open, setOpen] = useState(false);
  const justOpened = useRef(false);
  return {
    open,
    openFold: () => {
      justOpened.current = true;
      setOpen(true);
    },
    wholeRef: (el: HTMLElement | null) => {
      if (el && justOpened.current) {
        justOpened.current = false;
        el.focus();
      }
    },
  };
}

/** "More" (650 in the ink, a 44 tap area); it says it is folded and disappears once the text is whole. */
export function MoreButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  return (
    <button type="button" aria-expanded={false} onClick={onOpen} className={cn("tap-44 cursor-pointer font-[650] text-foreground", className)}>
      More
    </button>
  );
}
