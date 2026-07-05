"use client";

/**
 * useLazyWarm — the shared lazy-warm hook for pre-tested surface sections (Seams 1/2, owner
 * cadence). A fresh server cache seeds `initial` (→ ready immediately); a miss warms on the first
 * visit of the day via a POST to the refresh route, which gens/sims + persists + returns the cards.
 *
 * Extracted from start-page.tsx so /start and /calendar share ONE implementation — critically the
 * `warmOnce` in-flight dedupe, which collapses React StrictMode's dev double-invoke (and a fast
 * re-mount) of the expensive generate/sim pipeline into a single request. Both callers resolve to
 * the same result; a genuine later visit re-warms (the entry clears on settle).
 */

import { useEffect, useState } from "react";

const warmInFlight = new Map<string, Promise<Record<string, unknown>>>();

/** POST the refresh route once per in-flight window (dedupe concurrent warms of the SAME endpoint). */
export function warmOnce(endpoint: string): Promise<Record<string, unknown>> {
  let p = warmInFlight.get(endpoint);
  if (!p) {
    p = fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) =>
        r.ok
          ? (r.json() as Promise<Record<string, unknown>>)
          : Promise.reject(new Error("warm failed")),
      )
      .finally(() => warmInFlight.delete(endpoint));
    warmInFlight.set(endpoint, p);
  }
  return p;
}

/**
 * Lazy warm for a pre-tested section. A fresh server cache seeds `initial` (→ ready immediately);
 * a miss (`initial === null`) warms on the first visit of the day. `enabled` gates it off for
 * first-run / uncalibrated (no audience to test against). Honest degrade: any failure → [].
 */
export function useLazyWarm<T>(
  initial: T[] | null,
  endpoint: string,
  responseKey: string,
  enabled: boolean,
): { items: T[]; status: "warming" | "ready" } {
  const [items, setItems] = useState<T[]>(initial ?? []);
  const [status, setStatus] = useState<"warming" | "ready">(
    initial === null && enabled ? "warming" : "ready",
  );

  useEffect(() => {
    if (!enabled || initial !== null) return;
    let cancelled = false;
    warmOnce(endpoint)
      .then((json) => {
        if (!cancelled) setItems((json[responseKey] as T[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]); // honest empty state — never a fabricated card
      })
      .finally(() => {
        if (!cancelled) setStatus("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, initial, endpoint, responseKey]);

  return { items, status };
}
