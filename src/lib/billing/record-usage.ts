/**
 * BILLING THE ACTION — the one place credits are charged.
 *
 * Called at the exact moment a paid action is DELIVERED: after the result is persisted,
 * after the engine succeeded. Never before. That is the whole point of the ledger — the
 * meter used to count `analysis_results` rows, and the SSE branch inserts its row BEFORE
 * the pipeline runs (analyze route, "Pitfall #6"), so an engine failure left a placeholder
 * row behind and billed the customer for it. An action that was never delivered must never
 * appear here.
 *
 * One row per delivered action, stamped with its CREDIT_COSTS price at the moment of
 * delivery — so a later price change never rewrites history, and a usage statement stays
 * explainable line by line ("Reading · 10 credits", "hooks pack · 1 credit").
 *
 * BEST-EFFORT, NEVER FATAL. A ledger write that fails must not take down a result the
 * customer has already been given: they got the value, and losing the meter row costs us at
 * most one uncounted action. Failing their delivered result to protect our own accounting
 * would be exactly backwards. The failure is logged loudly instead.
 *
 * It is also a no-op before the ledger migration is applied (the table doesn't exist yet),
 * which is safe: `lib/billing/quota.ts` falls back to the legacy count until the table
 * shows up. Until the CREDITS migration is applied, inserting the `credits` column errors
 * (42703) — the write retries WITHOUT it and the column's eventual default (10) applies.
 * Light actions would over-count for that window, which is why the migration is applied
 * BEFORE the deploy that starts billing light actions — the retry is a seatbelt, not the
 * plan.
 *
 * Writes with the SERVICE client: `reading_events` has no INSERT policy for users, by
 * design — a user cannot mint themselves credits, nor erase the ones they have spent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { creditCost, type BillableAction } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

/** Postgres: relation does not exist / column does not exist. */
const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";

export interface RecordUsageInput {
  userId: string;
  /**
   * The billable action delivered — the CREDIT_COSTS key. Stored in the ledger's `mode`
   * column ('score' and 'remix' predate this and keep their meaning).
   */
  action: BillableAction;
  /**
   * The delivered result's row id when the action has one (`analysis_results.id` for
   * Readings; thread-block ids are not ledger keys — null is fine).
   */
  analysisId?: string | null;
  /** The tier at the moment of delivery, so usage history survives an upgrade. */
  tier?: NumenTier | null;
  /**
   * Does this action consume allowance? Default true. `false` records a delivered-but-free
   * action (a comp, a credit) — still written, because an unbilled action that leaves no
   * trace is unauditable.
   */
  billed?: boolean;
  /**
   * Price override in credits. Defaults to CREDIT_COSTS[action]. Exists for the one case
   * where the price is decided at delivery time (e.g. an explore that escalated to a live
   * scrape bills explore_scrape while the action stays 'explore' semantics — pass both).
   */
  credits?: number;
}

/** Minimal logger shape — the routes' scoped loggers satisfy it. */
interface Log {
  warn: (msg: string, meta?: Record<string, unknown>) => void;
}

export async function recordUsage(
  service: SupabaseClient,
  input: RecordUsageInput,
  log?: Log
): Promise<void> {
  const {
    userId,
    action,
    analysisId = null,
    tier = null,
    billed = true,
    credits = creditCost(input.action),
  } = input;

  const row = {
    user_id: userId,
    analysis_id: analysisId,
    mode: action,
    tier,
    billed,
    credits,
  };

  try {
    const { error } = await service.from("reading_events").insert(row);
    if (!error) return;

    // The ledger migration hasn't been applied yet. Expected, not a problem: the quota
    // check is still counting analysis_results rows until it is.
    if (error.code === UNDEFINED_TABLE) return;

    // The CREDITS migration hasn't been applied yet — write the event without the column
    // (the default of 10 applies once the column exists; see module note).
    if (error.code === UNDEFINED_COLUMN) {
      const { credits: _omitted, ...legacyRow } = row;
      const { error: retryError } = await service.from("reading_events").insert(legacyRow);
      if (!retryError || retryError.code === UNDEFINED_TABLE) return;
      log?.warn("usage_event_write_failed", { action, analysisId, error: retryError.message });
      return;
    }

    log?.warn("usage_event_write_failed", { action, analysisId, error: error.message });
  } catch (err) {
    log?.warn("usage_event_write_failed", {
      action,
      analysisId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
