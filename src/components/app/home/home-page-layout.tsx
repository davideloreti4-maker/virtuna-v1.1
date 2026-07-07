"use client";

/**
 * HomePageLayout — client wrapper for the /home page.
 *
 *   Empty state (!hasConversation):
 *     Serif welcome hero (logo + greeting) centered above the composer.
 *
 *   Active thread (hasThread):
 *     Welcome hero is removed entirely (Claude-style — not a persistent banner).
 *     Composer fills remaining height; its internal thread-region scrolls while
 *     the form stays pinned at the bottom (homeThreadMode branch in composer.tsx).
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HomeGreeting } from "./home-greeting";
import { Composer } from "./composer";

export function HomePageLayout() {
  const [hasThread, setHasThread] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  // A1: true while the composer rehydrates a switched-to thread. Keeps the thread
  // shell mounted + suppresses the welcome hero across the load gap (so the layout
  // never collapses to the centered serif hero between threads).
  const [rehydrating, setRehydrating] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  const handleConversationChange = useCallback((next: boolean) => {
    setHasConversation(next);
  }, []);

  const handleRehydratingChange = useCallback((next: boolean) => {
    setRehydrating(next);
  }, []);

  return (
    // The audience presence is a single docked card on top of the composer at every breakpoint
    // (the ≥xl right rail was retired 2026-07-07), so the work column centers full-width.
    <div className="flex h-full w-full flex-col items-center px-4">
      <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
        {!hasConversation && !rehydrating && (
          // Empty home: the serif greeting sits centered in the space ABOVE the composer,
          // which the child pins to the bottom of the column (flex-1 hero + shrink-0 dock).
          <div
            className={cn(
              "flex flex-1 min-h-0 flex-col items-center justify-center pb-6",
              !reducedMotion && "transition-[padding] duration-300 ease-out",
            )}
          >
            <HomeGreeting />
          </div>
        )}
        <Composer
          className={cn((hasThread || rehydrating) && "flex-1 min-h-0")}
          onThreadChange={handleThreadChange}
          onConversationChange={handleConversationChange}
          onRehydratingChange={handleRehydratingChange}
        />
      </div>
    </div>
  );
}
