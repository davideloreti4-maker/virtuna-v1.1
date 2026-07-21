"use client";

/**
 * ProductRender — the landing hero centerpiece: the REAL in-thread Test card,
 * rendered through the shipped `VideoTestCardRenderer`. Because it imports the
 * live component, a design change to the card updates the landing automatically
 * (the whole point of using the /dev/cards renderer here).
 *
 * Framed as a peek into the app: a mini thread (user asks → Maven answers with
 * the card) inside a browser-window chrome. Non-interactive (pointer-events
 * off on the card) — the Save / Simulate actions are the real card's, not the
 * landing's CTAs, so we don't let a cold visitor wander into a dead /analyze
 * link. Providers: just a throwaway QueryClient (SaveAffordance mounts a
 * react-query hook); nothing fires without a click.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { VideoTestCardRenderer } from "@/components/thread/video-test-card-block";
import { TEST_CARD_FIXTURE } from "./test-card-fixture";

export function ProductRender() {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={qc}>
      {/* Browser-window chrome */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl">
        {/* top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            maven.numenmachines.com
          </span>
        </div>

        {/* mini thread body — peek into the real app, capped with a soft fade */}
        <div className="relative max-h-[600px] overflow-hidden bg-background">
          <div className="flex flex-col gap-3 px-4 py-5">
            {/* user turn */}
            <div className="flex justify-end">
              <span className="rounded-2xl rounded-br-sm bg-surface-elevated px-3.5 py-2 text-[14px] text-foreground">
                test this video for me
              </span>
            </div>
            {/* maven label */}
            <span className="text-[11px] uppercase tracking-[0.14em] text-foreground-muted">
              Maven
            </span>
            {/* the REAL card — showcase, non-interactive */}
            <div className="pointer-events-none select-none">
              <VideoTestCardRenderer block={TEST_CARD_FIXTURE} />
            </div>
          </div>
          {/* bottom fade — the window continues below */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>
    </QueryClientProvider>
  );
}
