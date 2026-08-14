"use client";

/**
 * useRemixLaunch — the discover→remix chain, shared by every Discover panel.
 *
 * Originally lifted from feed-client's launchRemix so the Outliers grid and a collection's
 * rows start the same chain the old feed tiles did (endpoint from the CHAIN_HANDOFFS
 * registry, never a hardcoded path). Tracks which row is pending so a card can show its
 * own spinner without a shared "something is loading" flag.
 *
 * ⚠️ No longer a copy of that function, and `FeedClient` is now orphaned (exported, imported
 * by nothing). It still carries the swallowed-status bug removed here, as do two LIVE
 * siblings — `feed/discover/discover-client.tsx` and `thread/account-read-block.tsx`.
 * Do not restore parity by copying from any of them.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { handoffsFor } from "@/lib/tools/chain-handoff";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401 } from "@/lib/auth/session-expired";

const PLATFORM = "tiktok";

export function useRemixLaunch() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const remix = useCallback(
    async (id: string, url: string | null, brief?: string | null) => {
      const handoff = handoffsFor("discover").find((h) => h.to === "remix");
      if (!handoff?.endpoint || !url) {
        toast({ variant: "error", title: "That video has no URL to remix" });
        return;
      }
      setPendingId(id);
      try {
        // ⚠️ The brief key is OMITTED when absent, never sent as null. The route's schema is
        // `brief: z.string().max(200).optional()` — `undefined` parses and means "no target",
        // but an explicit `null` is not a string and 400s the entire run. D3 also makes an empty
        // string wrong on its own terms: the runner reads `target: input.brief ?? null`, so ""
        // would REPLACE the creator's niche with nothing rather than fall back to it.
        const target = brief?.trim();
        const res = await fetch(handoff.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, platform: PLATFORM, ...(target ? { brief: target } : {}) }),
        });
        // `fetch` does not reject on an HTTP status, and this used to push to /home regardless —
        // so a refusal put the creator on an unchanged home screen with no card and no reason,
        // which reads as the product being broken. /api/tools/remix/run is a PAID route
        // (creditGate), so the 402 and the 401 are shapes it really returns.
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          setPendingId(null);
          // Each refusal owns ONE piece of UI. The wall dialog and the session dialog are already
          // mounted app-wide; a toast underneath either would be a second, wronger explanation.
          if (reportCredit402(res.status, body) || reportSession401(res.status)) return;
          toast({ variant: "error", title: "Couldn't start that remix" });
          return;
        }
        // Deliberately does NOT clear pendingId. It is what disables the tile and prints
        // "Starting…", and it is the only guard against a second (billed) run being fired during
        // the route transition. All three consumers unmount on /home, which is what clears it.
        // The 200 body is an SSE stream that stays open for the whole pipeline — never read it.
        router.push("/home");
      } catch {
        setPendingId(null);
        toast({ variant: "error", title: "Couldn't start that remix" });
      }
    },
    [router, toast],
  );

  return { remix, pendingId };
}
