"use client";

/**
 * AmbientPanel — the SECOND surface of the two-surface story: the shipped
 * `<AmbientRoom>` (The brain ⇄ The people ⇄ The population), mounted beside the
 * Test card so the hero shows the full loop — craft (the card) AND reception
 * (the room). It lands on the BRAIN scale, which auto-plays a labeled simulated
 * neural read on mount (no click needed) — the ambient wow.
 *
 * ⚠️ This is a REPRODUCTION of the app's persistent right rail
 * (`audience-presence.tsx` variant='rail') — diff against that mount, not
 * taste (owner correction 2026-07-26). Container = the rail card (12px radius,
 * surface-elevated, no shadow); header = the rail's top bar: audience IDENTITY
 * only (constellation mark + "General" + liveness dot + "not calibrated" tag +
 * caret, rendered static). The rail deliberately carries NO viewer count and
 * no "live" chip in that bar (§3.6 killed the readiness echo) — earlier
 * versions here invented both.
 *
 * Non-grounded (personas-only) so there's no gitignored sample-video dependency.
 * Own throwaway QueryClient as insurance for any child hook; `canRewrite` off —
 * the re-run lever is an in-app action, not a landing CTA.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import { ConstellationMark } from "@/components/brand/constellation-mark";
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
        className={`relative flex h-full flex-col overflow-hidden rounded-[12px] border border-border bg-surface-elevated ${className}`}
      >
        {/* header — the rail's real top bar (audience identity), rendered static:
            no switcher menu on a landing, but the same pieces in the same order. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 py-1 pl-1 pr-1.5">
            <ConstellationMark width={40} />
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-foreground">
              General
              <span
                aria-hidden
                className="inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)]"
              />
            </span>
            <span className="shrink-0 rounded-[4px] border border-white/[0.09] bg-white/[0.03] px-[5px] py-px text-[9px] font-semibold uppercase leading-[1.5] tracking-[0.06em] text-foreground-muted">
              not calibrated
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-hidden />
          </div>
          <div className="min-w-0 flex-1" />
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
