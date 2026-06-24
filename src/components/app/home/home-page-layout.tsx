"use client";

/**
 * HomePageLayout — client wrapper for the /home page.
 *
 *   Empty state (hasThread = false):
 *     Greeting at the hero anchor + centered composer sitting below it.
 *
 *   Thread state (hasThread = true):
 *     Greeting recedes (compact). Composer fills remaining height; its internal
 *     thread-region scrolls while the form stays pinned at the bottom
 *     (homeThreadMode branch in composer.tsx).
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { HomeGreeting } from "./home-greeting";
import { Composer } from "./composer";

export function HomePageLayout() {
  const [hasThread, setHasThread] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center px-4">
      <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
        <div
          className={cn(
            "shrink-0 flex flex-col items-center",
            hasThread ? "pt-3 pb-2" : "pt-[clamp(3rem,18vh,7rem)] pb-8",
            !reducedMotion && "transition-[padding] duration-300 ease-out",
          )}
        >
          <HomeGreeting compact={hasThread} />
        </div>
        <Composer
          className={cn(hasThread && "flex-1 min-h-0")}
          onThreadChange={handleThreadChange}
        />
      </div>
    </div>
  );
}
