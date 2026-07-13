/**
 * READING QUOTA — the meter the plans are sold on.
 *
 * Pricing (src/lib/pricing.ts) promises "50 Readings a month" (Creator), "150" (Pro),
 * "Unlimited" (Studio). This module is what makes that promise true: it counts the
 * Readings a user has produced this calendar month and answers whether the next one is
 * within their plan.
 *
 * ⚠️ INERT BY DEFAULT. Enforcement is behind `BILLING_ENFORCE_QUOTA=true` because the Whop
 * plans do not exist yet — with no way to BUY a plan, enforcing limits would lock out
 * every existing user (all of whom are tier `free`, allowance 0). Flip the flag the day the
 * three Whop products go live. `checkReadingQuota` still computes the honest answer when the
 * flag is off; it just reports `enforced: false`, so callers let the request through and the
 * numbers can be watched before the gate closes.
 *
 * A "Reading" = one row in `analysis_results` — one full simulation of one video/concept.
 * That is the unit the customer is charged for, so it is the unit we count. Counting
 * anything else (API hits, tokens) would drift from what the page promised.
 *
 * TWO WINDOWS, and the trial wins:
 *   - inside the $1 / 3-day trial → the pool is `TRIAL.readings` (5) on EVERY plan, counted
 *     from the instant the trial started. This is the leech guard: without it $1 buys 150 Pro
 *     Readings (~$22 of engine spend), or unlimited on Studio.
 *   - after it converts → the plan's monthly allowance, counted from the 1st (UTC).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { readingAllowanceFor } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

/** Enforcement is opt-in — see the module note. */
export function isQuotaEnforced(): boolean {
  return process.env.BILLING_ENFORCE_QUOTA === "true";
}

/** First instant of the current calendar month, UTC — the window a plan's allowance resets on. */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
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
  /** Readings used in the window that applies (the trial, or the calendar month). */
  used: number;
  /** The allowance that applies; `null` = unlimited (never true inside a trial). */
  limit: number | null;
  /** The tier the allowance came from. */
  tier: NumenTier;
  /** Whether the $1 trial pool is what's being enforced. */
  inTrial: boolean;
}

/**
 * How many Readings this user has produced since `since` — the start of their billing month,
 * or the moment their $1 trial began. A HEAD count (no rows transferred): this runs on the
 * hot path of /api/analyze.
 */
export async function countReadingsSince(
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
 * unlimited on Studio. Once it converts, it is the plan's allowance for the calendar month.
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
  now: Date = new Date()
): Promise<QuotaVerdict> {
  const inTrial = isTrialActive(trial, now);
  const limit = readingAllowanceFor(tier, { inTrial });
  const enforced = isQuotaEnforced();

  // Unlimited (Studio, outside a trial) never needs the count.
  if (limit === null) {
    return { enforced, allowed: true, used: 0, limit: null, tier, inTrial };
  }

  // The trial pool is counted from the trial's start; a plan's allowance from the 1st.
  const windowStart =
    inTrial && trial.trialStartedAt ? trial.trialStartedAt : currentPeriodStart(now);

  let used: number;
  try {
    used = await countReadingsSince(supabase, userId, windowStart);
  } catch (error) {
    console.error("[quota] count failed — failing open", error);
    return { enforced, allowed: true, used: 0, limit, tier, inTrial };
  }

  return { enforced, allowed: used < limit, used, limit, tier, inTrial };
}

/**
 * The whole check in one call, for a request handler that already has an authed client:
 * read the user's tier, then measure it against their Readings this month.
 *
 * A missing subscription row is `free` — allowance 0 — which is correct: with no free plan
 * on the pricing page, "no subscription" means "hasn't started a trial yet". It only bites
 * once BILLING_ENFORCE_QUOTA is on, which is the point.
 */
export async function getReadingQuotaVerdict(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<QuotaVerdict> {
  let tier: NumenTier = "free";
  let trial: TrialWindow = { trialStartedAt: null, trialEndsAt: null };

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("virtuna_tier, trial_started_at, trial_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.virtuna_tier) tier = data.virtuna_tier as NumenTier;
    trial = {
      trialStartedAt: data?.trial_started_at ? new Date(data.trial_started_at) : null,
      trialEndsAt: data?.trial_ends_at ? new Date(data.trial_ends_at) : null,
    };
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
    };
  }

  return checkReadingQuota(supabase, userId, tier, trial, now);
}
