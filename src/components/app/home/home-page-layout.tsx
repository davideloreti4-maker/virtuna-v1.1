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
    // The Room, PR-4: at ≥ xl the persistent audience rail is a fixed 392px right column
    // (rendered by the composer, portaled to <body>). Reserve its width here so the greeting +
    // thread + composer never slide under it. ≤ lg keeps the full width (the mobile Bloom).
    <div className="flex h-full w-full flex-col items-center px-4 xl:pr-[392px]">
      <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
        {!hasConversation && !rehydrating && (
          <div
            className={cn(
              "shrink-0 flex flex-col items-center pt-[clamp(3rem,18vh,7rem)] pb-8",
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
