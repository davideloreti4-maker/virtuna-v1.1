import { unstable_cache } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * waitlist-count.ts — PROOF-01 cached live-count read (D-08/D-10).
 *
 * Reads the waitlist size via the `waitlist_count()` SECURITY DEFINER RPC (the
 * function runs as definer so the anon caller gets a count WITHOUT row visibility —
 * insert-only RLS hides the emails; T-03-12). The read is wrapped in
 * `unstable_cache` so the landing stays near-static: one Supabase round-trip per
 * revalidate window, not per request. `page.tsx` reads this ONCE and threads it to
 * both proof surfaces (one source, two surfaces — D-10); never call `createClient()`
 * in the page body for the count (that would opt the page into dynamic rendering).
 *
 * Fail-soft: any error or non-number result → 0, which routes the D-09 guard to the
 * qualitative anchor — the page NEVER renders "0 creators" and never throws. The
 * cached wrapper is itself fail-soft: outside a Next request/incremental-cache
 * scope (e.g. unit tests) it falls back to the uncached read instead of throwing
 * the "incrementalCache missing" invariant.
 */

/** The raw RLS-safe count read (fail-soft → 0). Cache-independent. */
async function readWaitlistCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("waitlist_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

const cachedWaitlistCount = unstable_cache(readWaitlistCount, ["waitlist-count"], {
  revalidate: 60,
  tags: ["waitlist-count"],
});

export async function getWaitlistCount(): Promise<number> {
  try {
    return await cachedWaitlistCount();
  } catch {
    // No incremental-cache scope (unit tests / non-request context) — fall back to
    // the uncached read so the count still resolves and never throws.
    return readWaitlistCount();
  }
}
