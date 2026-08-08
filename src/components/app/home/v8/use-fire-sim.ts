"use client";

/**
 * useFireSim — the v8 report's fire-on-demand sim (Phase 3).
 *
 * THE LAW (SSOT §1, spec's v8 block): generation NEVER auto-simulates. This hook fires only from
 * a deliberate act — a card's Simulate action — and exactly ONE run may be in flight at a time:
 * a second tap while watching is DROPPED, not queued. Every room reaction costs credits, so the
 * in-flight guard IS the debounce.
 *
 * Reuses the shipped `/api/tools/react` primitive (the same engine every card already uses; it
 * resolves the active audience SERVER-side off the open thread). The sealed-verdict beat lives in
 * `watching`: the verdict is withheld while true and lands with the snapshot.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { reportCredit402 } from "@/lib/billing/credit-wall";
import { reportSession401 } from "@/lib/auth/session-expired";
import { reactRequestBody, reactResponseToSnapshot, type ReportSnapshot } from "./fire-sim";

export function useFireSim(): {
  watching: boolean;
  snapshots: Record<string, ReportSnapshot>;
  fireSim: (id: string, text: string, kind?: string) => Promise<void>;
} {
  const [snapshots, setSnapshots] = useState<Record<string, ReportSnapshot>>({});
  const [watching, setWatching] = useState(false);
  const inflightRef = useRef<AbortController | null>(null);
  useEffect(() => () => inflightRef.current?.abort(), []);

  const fireSim = useCallback(async (id: string, text: string, kind?: string) => {
    const stimulus = text.trim();
    if (stimulus.length === 0) return;
    // One run at a time. A second tap while watching is DROPPED — never a second billed call.
    if (inflightRef.current) return;

    const controller = new AbortController();
    inflightRef.current = controller;
    setWatching(true);
    try {
      const res = await fetch("/api/tools/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reactRequestBody({ text: stimulus, ...(kind ? { kind } : {}) })),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) {
        // The run was REFUSED, not failed: announce it so the one paywall dialog / session-expired
        // banner renders the server's own sentence. Nothing seals either way.
        const err = await res.json().catch(() => null);
        reportSession401(res.status);
        reportCredit402(res.status, err);
        return;
      }
      const snap = reactResponseToSnapshot(await res.json());
      if (controller.signal.aborted || !snap) return;
      setSnapshots((prev) => ({ ...prev, [id]: snap }));
    } catch {
      // Aborted or failed → no seal. An unsimulated card is the honest resting state.
    } finally {
      if (inflightRef.current === controller) {
        inflightRef.current = null;
        setWatching(false);
      }
    }
  }, []);

  return { watching, snapshots, fireSim };
}
