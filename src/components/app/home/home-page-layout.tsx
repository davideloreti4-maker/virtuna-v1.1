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
  const reducedMotion = usePrefersReducedMotion();

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  const handleConversationChange = useCallback((next: boolean) => {
    setHasConversation(next);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center px-4">
      <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
        {!hasConversation && (
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
          className={cn(hasThread && "flex-1 min-h-0")}
          onThreadChange={handleThreadChange}
          onConversationChange={handleConversationChange}
        />
      </div>
    </div>
  );
}
