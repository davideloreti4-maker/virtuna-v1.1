/**
 * BILLING THE READING — the one place a Reading is charged.
 *
 * Called at the exact moment a Reading is DELIVERED: after the row is persisted, after the
 * engine succeeded. Never before. That is the whole point of the ledger — the meter used to
 * count `analysis_results` rows, and the SSE branch inserts its row BEFORE the pipeline runs
 * (route.ts, "Pitfall #6"), so an engine failure left a placeholder row behind and billed the
 * customer for it. A Reading that was never delivered must never appear here.
 *
 * BEST-EFFORT, NEVER FATAL. A ledger write that fails must not take down a Reading the customer
 * has already been given: they got the value, and losing the meter row costs us at most one
 * uncounted Reading. Failing their delivered result to protect our own accounting would be
 * exactly backwards. The failure is logged loudly instead.
 *
 * It is also a no-op before the ledger migration is applied (the table doesn't exist yet), which
 * is safe: `lib/billing/quota.ts` falls back to the legacy row count until the table shows up.
 *
 * Writes with the SERVICE client: `reading_events` has no INSERT policy for users, by design —
 * a user cannot mint themselves Readings, nor erase the ones they have spent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NumenTier } from "@/lib/whop/config";

export interface RecordReadingInput {
  userId: string;
  /** The delivered Reading's row id (`analysis_results.id`). */
  analysisId: string;
  /** 'score' = a full simulation · 'remix' = a decode. Both bill today. */
  mode?: string | null;
  /** The tier at the moment of delivery, so usage history survives an upgrade. */
  tier?: NumenTier | null;
  /**
   * Does this Reading consume allowance? Default true. `false` records a delivered-but-free
   * Reading (a comp, a credit) — still written, because an unbilled Reading that leaves no
   * trace is unauditable.
   */
  billed?: boolean;
}

/** Minimal logger shape — the analyze route's scoped logger satisfies it. */
interface Log {
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

export async function recordReading(
  service: SupabaseClient,
  input: RecordReadingInput,
  log?: Log
): Promise<void> {
  const { userId, analysisId, mode = null, tier = null, billed = true } = input;

  try {
    const { error } = await service.from("reading_events").insert({
      user_id: userId,
      analysis_id: analysisId,
      mode,
      tier,
      billed,
    });

    if (error) {
      // 42P01 = the ledger migration hasn't been applied yet. Expected, not a problem: the
      // quota check is still counting analysis_results rows until it is.
      if (error.code === "42P01") return;
      log?.warn("reading_event_write_failed", { analysisId, error: error.message });
    }
  } catch (err) {
    log?.warn("reading_event_write_failed", {
      analysisId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
