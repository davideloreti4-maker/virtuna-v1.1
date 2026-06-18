"use client";

/**
 * HomePageLayout — client wrapper for the /home page.
 *
 * Switches between two layouts based on whether the Composer reports thread
 * content (ideas or hooks cards present/streaming):
 *
 *   Empty state (hasThread = false):
 *     Centered hero — same as the original page.tsx layout. The greeting and
 *     composer are vertically centered in the main area.
 *
 *   Thread state (hasThread = true):
 *     Full-height column. The Composer fills the available space; its internal
 *     thread-region scrolls while the form stays pinned at the bottom (the
 *     Composer itself handles this via its homeThreadMode branch). The greeting
 *     collapses to the top (acceptable per requirements).
 *
 * This split must live in a client component because it reacts to Composer's
 * thread-presence signal (hasThread), which is a runtime client-side state.
 * The server page (page.tsx) delegates entirely here.
 */

import { useState, useCallback } from "react";
import { HomeGreeting } from "./home-greeting";
import { Composer } from "./composer";

export function HomePageLayout() {
  const [hasThread, setHasThread] = useState(false);

  const handleThreadChange = useCallback((next: boolean) => {
    setHasThread(next);
  }, []);

  if (hasThread) {
    // Thread mode: fill the main area height, greeting stays at top, Composer
    // fills the rest (Composer's homeThreadMode branch handles internal scroll).
    return (
      <div className="flex h-full w-full flex-col items-center px-4">
        <div className="flex w-full max-w-[760px] flex-col flex-1 min-h-0">
          {/* Greeting stays at top when thread is active (acceptable per D-24). */}
          <div className="shrink-0 pt-6 pb-4">
            <HomeGreeting />
          </div>
          {/* Composer takes remaining height — its homeThreadMode branch renders
              the thread-scroll + pinned-form layout internally. */}
          <Composer
            className="flex-1 min-h-0"
            onThreadChange={handleThreadChange}
          />
        </div>
      </div>
    );
  }

  // Empty state: original centered hero layout (no regression).
  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[760px] flex-col items-center gap-8">
        <HomeGreeting />
        <Composer onThreadChange={handleThreadChange} />
      </div>
    </div>
  );
}
