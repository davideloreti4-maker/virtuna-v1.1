"use client";

/**
 * HomePageLayout — client wrapper for the /home page.
 *
 * The greeting is anchored at a fixed hero position (~18vh from the top) on every
 * load and skill switch — it never jumps to the top when thread content appears.
 * Skill output renders in the Composer's scroll region directly underneath.
 *
 *   Empty state (hasThread = false):
 *     Greeting at the hero anchor + centered composer sitting below it.
 *
 *   Thread state (hasThread = true):
 *     Same greeting anchor. The Composer fills the remaining height; its internal
 *     thread-region scrolls while the form stays pinned at the bottom
 *     (homeThreadMode branch).
 *
 * This split must live in a client component because it reacts to Composer's
 * thread-presence signal (hasThread), which is a runtime client-side state.
 * The server page (page.tsx) delegates entirely here.
 */

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { HomeGreeting } from "./home-greeting";
import { Composer } from "./composer";

export function HomePageLayout() {
  const [hasThread, setHasThread] = useState(false);

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center px-4">
      <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
        {/* Fixed hero anchor — same vertical position on empty home and when skill
            thread content loads underneath (no collapse to top). */}
        <div
          className={cn(
            "shrink-0 flex flex-col items-center pt-[clamp(3rem,18vh,7rem)]",
            hasThread ? "pb-4" : "pb-8",
          )}
        >
          <HomeGreeting />
        </div>
        <Composer
          className={cn(hasThread && "flex-1 min-h-0")}
          onThreadChange={handleThreadChange}
        />
      </div>
    </div>
  );
}
