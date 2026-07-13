/**
 * READING QUOTA — the meter the plans are sold on.
 *
 * Pricing (src/lib/pricing.ts) promises "50 Readings a month" (Creator), "150" (Pro),
 * "Unlimited" (Studio). This module is what makes that promise true: it counts the
 * Readings a user has been delivered in their current billing period and answers whether
 * the next one is within their plan.
 *
 * ⚠️ INERT BY DEFAULT. Enforcement is behind `BILLING_ENFORCE_QUOTA=true` because the Whop
 * plans do not exist yet — with no way to BUY a plan, enforcing limits would lock out
 * every existing user (all of whom are tier `free`, allowance 0). Flip the flag the day the
 * three Whop products go live. `checkReadingQuota` still computes the honest answer when the
 * flag is off; it just reports `enforced: false`, so callers let the request through and the
 * numbers can be watched — and SHOWN — before the gate ever closes.
 *
 * Enforcement is not the same thing as visibility: the UI shows a customer their balance
 * whenever they have a plan, flag or no flag. The flag only decides whether we BLOCK.
 *
 * WHAT COUNTS AS A READING — the ledger, not the row count.
 * A Reading is one row in `reading_events` (billed=true): one Reading actually DELIVERED.
 * It used to be one row in `analysis_results`, which is not the same thing and billed the
 * customer wrongly in three ways — a failed engine run still left its placeholder row behind
 * and charged for it; deleting a Reading refunded the allowance; and nothing was auditable.
 * See supabase/migrations/20260713160000_reading_events.sql.
 *
 * The ledger table may not exist yet (the owner has not run the migration), so the count
 * FALLS BACK to the legacy `analysis_results` count when the relation is missing. Behaviour
 * is therefore identical before the migration and correct after it, with no flag day.
 *
 * TWO WINDOWS, and the trial wins:
 *   - inside the $1 / 3-day trial → the pool is `TRIAL.readings` (5) on EVERY plan, counted
 *     from the instant the trial started. This is the leech guard: without it $1 buys 150 Pro
 *     Readings (~$22 of engine spend), or unlimited on Studio.
 *   - after it converts → the plan's allowance for the current BILLING period, counted from
 *     the subscription's renewal anchor (not the 1st of the calendar month).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { readingAllowanceFor } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

/** Enforcement is opt-in — see the module note. */
export function isQuotaEnforced(): boolean {
  return process.env.BILLING_ENFORCE_QUOTA === "true";
}

/** Postgres `undefined_table` — the ledger migration has not been applied yet. */
const UNDEFINED_TABLE = "42P01";

/**
 * The same day-of-month as `anchor`, in the given month, clamped to that month's length.
 *
 * A subscription that renews on the 31st has no 31st in February: it must land on the 28th
 * (29th in a leap year), not spill into March. `Date.UTC` rolls a `monthIndex` of -1 back into
 * the previous December on its own, so no special-casing is needed there.
 *
 * The time of day is carried over from the anchor: a period that ends today at 14:00 must not
 * be treated as having already rolled over at 00:00 this morning, or the customer gets their
 * next allowance up to a day early.
 */
function anchoredIn(year: number, monthIndex: number, anchor: Date): Date {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(anchor.getUTCDate(), daysInMonth);
  return new Date(
    Date.UTC(
      year,
      monthIndex,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}

/**
 * When the current billing period began — the instant this month's allowance reset.
 *
 * Driven by the subscription's renewal date (`user_subscriptions.current_period_end`, which
 * Whop sends as `renewal_period_end`). Subscribe on the 28th and your allowance runs the 28th
 * → the 28th; it does NOT reset three days later because a calendar month happened to tick
 * over. That was the old behaviour and it handed out a second month of Readings for free to
 * anyone who subscribed near the end of a month.
 *
 * Derived from the renewal day-of-month rather than "period end minus one month" so that a
 * STALE `current_period_end` (a row Whop hasn't refreshed) still resolves to the most recent
 * anchor at or before `now`, instead of opening a window months wide.
 *
 * With no subscription row (`periodEnd` null) there is no billing date to anchor to, so it
 * falls back to the calendar month.
 */
export function currentPeriodStart(now: Date = new Date(), periodEnd: Date | null = null): Date {
  if (!periodEnd || Number.isNaN(periodEnd.getTime())) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  // The anchor as it falls in the current month; if that is still in the future, this period
  // began with last month's anchor.
  const thisMonth = anchoredIn(now.getUTCFullYear(), now.getUTCMonth(), periodEnd);
  if (thisMonth <= now) return thisMonth;
  return anchoredIn(now.getUTCFullYear(), now.getUTCMonth() - 1, periodEnd);
}

/** The trial window recorded on the subscription row (both null when it isn't a trial). */
export interface TrialWindow {
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
}

/** Is the $1 trial running right now? */
export function isTrialActive(window: TrialWindow, now: Date = new Date()): boolean {
  if (!window.trialStartedAt || !window.trialEndsAt) return false;
  return now >= window.trialStartedAt && now < window.trialEndsAt;
}

export interface QuotaVerdict {
  /** Whether the caller should actually block. False while the flag is off. */
  enforced: boolean;
  /** Whether this user is within their allowance right now. */
  allowed: boolean;
  /** Readings used in the window that applies (the trial, or the billing period). */
  used: number;
  /** The allowance that applies; `null` = unlimited (never true inside a trial). */
  limit: number | null;
  /** The tier the allowance came from. */
  tier: NumenTier;
  /** Whether the $1 trial pool is what's being enforced. */
  inTrial: boolean;
  /** When the window being counted began — the trial's start, or the billing anchor. */
  periodStart: Date;
  /** When this allowance next resets. Null when unknown (no subscription row). */
  renewsAt: Date | null;
}

/**
 * How many Readings this user has been delivered since `since` — the start of their billing
 * period, or the moment their $1 trial began.
 *
 * Counts the LEDGER (`reading_events`, billed only). A HEAD count — no rows transferred: this
 * runs on the hot path of /api/analyze, before any engine spend.
 *
 * Falls back to the legacy `analysis_results` count ONLY when the ledger table does not exist
 * (the migration has not been run). Any other error is thrown, so the caller can fail open —
 * quietly substituting a different, higher number would risk blocking a customer who is within
 * their plan.
 */
export async function countReadingsSince(
  supabase: SupabaseClient,
  userId: string,
  since: Date
): Promise<number> {
  const { count, error } = await supabase
    .from("reading_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("billed", true)
    .gte("created_at", since.toISOString());

  if (!error) return count ?? 0;

  if (error.code !== UNDEFINED_TABLE) throw error;

  // Pre-migration: the ledger does not exist yet. Count rows the old way so behaviour is
  // unchanged until the owner applies 20260713160000_reading_events.sql.
  return countLegacyAnalysisRows(supabase, userId, since);
}

/** The pre-ledger meter: one Reading = one `analysis_results` row. See the module note. */
async function countLegacyAnalysisRows(
  supabase: SupabaseClient,
  userId: string,
  since: Date
): Promise<number> {
  const { count, error } = await supabase
    .from("analysis_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  if (error) throw error;
  return count ?? 0;
}

/**
 * Is this user's NEXT Reading within their allowance?
 *
 * Two windows, and the trial wins: while the $1 trial runs, the pool is TRIAL.readings (5)
 * counted from the moment the trial started — NOT the plan's monthly allowance, and NOT
 * unlimited on Studio. Once it converts, it is the plan's allowance for the current billing
 * period.
 *
 * Fails OPEN on a counting error: a flaky count must never cost a paying customer their
 * Reading. The alternative (fail closed) turns a transient DB blip into "you've hit your
 * limit" for someone who hasn't — the worse of the two failures by far.
 */
export async function checkReadingQuota(
  supabase: SupabaseClient,
  userId: string,
  tier: NumenTier,
  trial: TrialWindow = { trialStartedAt: null, trialEndsAt: null },
  now: Date = new Date(),
  periodEnd: Date | null = null
): Promise<QuotaVerdict> {
  const inTrial = isTrialActive(trial, now);
  const limit = readingAllowanceFor(tier, { inTrial });
  const enforced = isQuotaEnforced();

  // The trial pool is counted from the trial's start; a plan's allowance from its billing
  // anchor. The trial's "renewal" is the day it converts.
  const periodStart =
    inTrial && trial.trialStartedAt ? trial.trialStartedAt : currentPeriodStart(now, periodEnd);
  const renewsAt = inTrial ? trial.trialEndsAt : periodEnd;

  const base = { enforced, tier, inTrial, periodStart, renewsAt };

  // Unlimited (Studio, outside a trial) never needs the count.
  if (limit === null) {
    return { ...base, allowed: true, used: 0, limit: null };
  }

  let used: number;
  try {
    used = await countReadingsSince(supabase, userId, periodStart);
  } catch (error) {
    console.error("[quota] count failed — failing open", error);
    return { ...base, allowed: true, used: 0, limit };
  }

  return { ...base, allowed: used < limit, used, limit };
}

/**
 * The whole check in one call, for a request handler that already has an authed client:
 * read the user's tier and billing window, then measure it against their Readings.
 *
 * A missing subscription row is `free` — allowance 0 — which is correct: with no free plan
 * on the pricing page, "no subscription" means "hasn't started a trial yet". It only bites
 * once BILLING_ENFORCE_QUOTA is on, which is the point.
 *
 * Selects `*` rather than naming the trial columns: `trial_started_at` does not exist until
 * migration 20260713140000 is applied, and naming a missing column makes PostgREST reject the
 * whole SELECT — which would send even the TIER lookup down the fail-open path (and log an
 * error on every single /api/analyze). Reading the fields defensively off the row costs
 * nothing and works either side of the migration.
 */
export async function getReadingQuotaVerdict(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<QuotaVerdict> {
  let tier: NumenTier = "free";
  let trial: TrialWindow = { trialStartedAt: null, trialEndsAt: null };
  let periodEnd: Date | null = null;

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const row = data as Record<string, unknown> | null;

    if (typeof row?.virtuna_tier === "string") tier = row.virtuna_tier as NumenTier;
    trial = {
      trialStartedAt: toDate(row?.trial_started_at),
      trialEndsAt: toDate(row?.trial_ends_at),
    };
    periodEnd = toDate(row?.current_period_end);
  } catch (error) {
    // Same fail-open rationale: if we cannot read the tier we must not invent a limit.
    console.error("[quota] tier lookup failed — failing open", error);
    return {
      enforced: isQuotaEnforced(),
      allowed: true,
      used: 0,
      limit: null,
      tier: "free",
      inTrial: false,
      periodStart: currentPeriodStart(now),
      renewsAt: null,
    };
  }

  return checkReadingQuota(supabase, userId, tier, trial, now, periodEnd);
}

/** A timestamptz off a raw row — null for a missing column, a null value, or an unparseable one. */
function toDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
