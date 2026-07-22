"use client";

/**
 * AmbientPanel — the SECOND surface of the two-surface story: the shipped
 * `<AmbientRoom>` (The brain ⇄ The people ⇄ The population), mounted beside the
 * Test card so the hero shows the full loop — craft (the card) AND reception
 * (the room). It lands on the BRAIN scale, which auto-plays a labeled simulated
 * neural read on mount (no click needed) — the ambient wow.
 *
 * Non-grounded (personas-only) so there's no gitignored sample-video dependency.
 * Own throwaway QueryClient as insurance for any child hook; `canRewrite` off —
 * the re-run lever is an in-app action, not a landing CTA.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import {
  ROOM_CONCEPT,
  ROOM_FRACTION,
  ROOM_PERSONAS,
  ROOM_SIBLINGS,
} from "./room-fixture";

export function AmbientPanel({ className = "" }: { className?: string }) {
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
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-sunken shadow-2xl ${className}`}
      >
        {/* header — mirrors the card's browser-window chrome so the pair reads as a set */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            The room · live
          </span>
          <span className="ml-auto text-[11px] text-foreground-muted">
            1,000 simulated viewers
          </span>
        </div>

        {/* the real ambient room — brain lands first and auto-plays */}
        <div className="min-h-0 flex-1">
          <AmbientRoom
            flatPersonas={ROOM_PERSONAS}
            conceptText={ROOM_CONCEPT}
            fraction={ROOM_FRACTION}
            kindLabel="Hook"
            canRewrite={false}
            focusId="h3"
            initialCompareOpen={false}
            siblings={ROOM_SIBLINGS}
          />
        </div>
      </div>
    </QueryClientProvider>
  );
}
