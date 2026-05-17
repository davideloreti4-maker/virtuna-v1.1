"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * CardProgressDots — 9-dot horizontal progress indicator for the 9-card
 * creator interview modal (UI-SPEC §Animation, §Color).
 *
 * - Active dot (index === currentIndex): coral 8×8, role="tab" aria-selected="true"
 * - Completed dot (index < currentIndex): white/30 6×6
 * - Upcoming dot (index > currentIndex): white/12 6×6
 *
 * Active dot is the ONLY legitimate coral surface on the wizard (UI-SPEC §Color).
 * 150ms ease transition matches the rest of the modal's micro-interactions.
 */
export interface CardProgressDotsProps {
  currentIndex: number;
  totalCards: number;
}

export function CardProgressDots({
  currentIndex,
  totalCards,
}: CardProgressDotsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label={`Step ${currentIndex + 1} of ${totalCards}`}
      data-testid="card-progress-dots"
      className="flex items-center justify-center gap-2"
    >
      {Array.from({ length: totalCards }).map((_, idx) => {
        const isActive = idx === currentIndex;
        const isCompleted = idx < currentIndex;
        return (
          <span
            key={idx}
            role="tab"
            aria-selected={isActive}
            aria-label={
              isActive
                ? `Step ${currentIndex + 1} of ${totalCards}`
                : undefined
            }
            data-testid={`card-progress-dot-${idx}`}
            className={cn(
              "rounded-full transition-all duration-150 ease-in-out",
              isActive
                ? "h-2 w-2 bg-accent"
                : isCompleted
                  ? "h-1.5 w-1.5 bg-white/30"
                  : "h-1.5 w-1.5 bg-white/[0.12]"
            )}
          />
        );
      })}
    </div>
  );
}
