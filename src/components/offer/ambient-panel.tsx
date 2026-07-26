"use client";

/**
 * AmbientPanel — the SECOND surface of the two-surface story: the shipped
 * Ambient v2 depth surface (`<AmbientDetail>` — The brain ⇄ The audience),
 * mounted beside the Test card so the hero shows the full loop — craft (the
 * card) AND reception (the read).
 *
 * ⚠️ This is a REPRODUCTION of what the CURRENT platform renders in the
 * composer's ≥xl rail when a card is drilled (`AmbientOverviewRail` →
 * `AmbientDetail`, behind AMBIENT_V2). Owner correction 2026-07-26: the panel
 * previously reproduced the LEGACY `AmbientRoom` (three tabs, "6 of 10 would
 * stop") — a surface the current platform no longer shows. Diff against the
 * live app rail, not `/dev/cards` (stale, still mounts the legacy room).
 *
 * Fidelity choices, each mirroring the real mount:
 *  • `CREATOR_TEMPLATE` — the authored, seeded-deterministic review fixture
 *    (byte-identical SSR; modeled-not-measured chips carry the honesty).
 *  • `onBack` omitted — the component's own contract: a back button that goes
 *    nowhere is a dead control. Same reason the legacy panel kept
 *    `canRewrite` off.
 *  • `presentation="sheet"` — this card owns the ground, painted the rail's
 *    real `#181817` tone.
 *
 * Own throwaway QueryClient as insurance for any child hook.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AmbientDetail } from "@/components/audience-lens/v2/AmbientDetail";
import { CREATOR_TEMPLATE } from "@/components/audience-lens/v2/detail-fixture";

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
        className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-border bg-[#181817] ${className}`}
      >
        {/* Bounded flex host — the walkthrough shipped AmbientDetail in an unbounded-height
            wrapper and it rendered 2,182px instead of 800 (go/page.tsx postmortem). The sheet
            presentation expects its host to own the cap: flex + overflow-hidden bounds the root,
            the detail's own min-h-0 internals scroll. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AmbientDetail template={CREATOR_TEMPLATE} presentation="sheet" />
        </div>
      </div>
    </QueryClientProvider>
  );
}
