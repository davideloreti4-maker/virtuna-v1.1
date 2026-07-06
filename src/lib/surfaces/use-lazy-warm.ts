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

import { useEffect, useRef, useState } from "react";

const warmInFlight = new Map<string, Promise<Record<string, unknown>>>();

/** Sentinel key for callers with no live audience switcher (e.g. /calendar): warm once, never re-warm. */
const NO_AUDIENCE = "__no-audience__";

/**
 * POST the refresh route once per in-flight window (dedupe concurrent warms of the SAME target).
 * `dedupeKey` defaults to the endpoint; pass a per-audience key so two audiences hitting the same
 * bodiless endpoint don't share one in-flight promise (an audience switch must POST afresh — the
 * server resolves the newly-persisted audience and returns ITS cards, cache-first when warm).
 */
export function warmOnce(
  endpoint: string,
  dedupeKey: string = endpoint,
): Promise<Record<string, unknown>> {
  let p = warmInFlight.get(dedupeKey);
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
      .finally(() => warmInFlight.delete(dedupeKey));
    warmInFlight.set(dedupeKey, p);
  }
  return p;
}

/**
 * Lazy warm for a pre-tested section. A fresh server cache seeds `initial` (→ ready immediately);
 * a miss (`initial === null`) warms on the first visit of the day. `enabled` gates it off for
 * first-run / uncalibrated (no audience to test against). Honest degrade: any failure → [].
 *
 * `audienceKey` (optional) makes the section audience-aware: `initial` reflects the audience live
 * at mount, and a later switch (the key changes) RE-WARMS against the newly-selected audience —
 * the fix for "switching audience on the dock doesn't re-sim". Omit it (callers with no switcher,
 * e.g. /calendar) to keep the original warm-once-on-mount behaviour. Ordering is the caller's job:
 * the routes server-resolve the audience from persisted settings, so only advance `audienceKey`
 * AFTER that persist settles (see start-page's handleSelectAudience).
 */
export function useLazyWarm<T>(
  initial: T[] | null,
  endpoint: string,
  responseKey: string,
  enabled: boolean,
  audienceKey?: string,
): { items: T[]; status: "warming" | "ready" } {
  const [items, setItems] = useState<T[]>(initial ?? []);
  const [status, setStatus] = useState<"warming" | "ready">(
    initial === null && enabled ? "warming" : "ready",
  );

  // The audience key the current `items` reflect. A fresh server cache (`initial !== null`) reflects
  // the mount audience; a cold miss reflects nothing yet (null → warm). When `audienceKey` later
  // differs, `items` are stale for a switched-to audience → re-warm. `NO_AUDIENCE` collapses the
  // switcher-less caller back to a single mount warm (the key never changes).
  const reflectedKey = useRef<string | null>(
    initial !== null ? (audienceKey ?? NO_AUDIENCE) : null,
  );

  useEffect(() => {
    if (!enabled) return;
    const key = audienceKey ?? NO_AUDIENCE;
    if (reflectedKey.current === key) return; // items already reflect this audience — no warm
    const isSwitch = reflectedKey.current !== null; // a real switch (not the cold first mount)
    let cancelled = false;
    setStatus("warming");
    if (isSwitch) setItems([]); // drop the prior audience's cards — never show them as the new one
    warmOnce(endpoint, `${endpoint}::${key}`)
      .then((json) => {
        if (cancelled) return;
        setItems((json[responseKey] as T[]) ?? []);
        reflectedKey.current = key;
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
  }, [enabled, audienceKey, endpoint, responseKey]);

  return { items, status };
}
