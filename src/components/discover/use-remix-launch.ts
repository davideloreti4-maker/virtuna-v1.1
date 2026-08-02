"use client";

/**
 * useRemixLaunch — the discover→remix chain, shared by every Discover panel.
 *
 * Lifted verbatim from feed-client's launchRemix so the Outliers grid and a collection's
 * rows start the same chain the old feed tiles did (endpoint from the CHAIN_HANDOFFS
 * registry, never a hardcoded path). Tracks which row is pending so a card can show its
 * own spinner without a shared "something is loading" flag.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { handoffsFor } from "@/lib/tools/chain-handoff";

const PLATFORM = "tiktok";

export function useRemixLaunch() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const remix = useCallback(
    async (id: string, url: string | null) => {
      const handoff = handoffsFor("discover").find((h) => h.to === "remix");
      if (!handoff?.endpoint || !url) {
        toast({ variant: "error", title: "That video has no URL to remix" });
        return;
      }
      setPendingId(id);
      try {
        await fetch(handoff.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, platform: PLATFORM }),
        });
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
