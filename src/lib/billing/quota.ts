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
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { readingAllowance } from "@/lib/pricing";
import type { NumenTier } from "@/lib/whop/config";

/** Enforcement is opt-in — see the module note. */
export function isQuotaEnforced(): boolean {
  return process.env.BILLING_ENFORCE_QUOTA === "true";
}

/** First instant of the current calendar month, UTC — the window the allowance resets on. */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export interface QuotaVerdict {
  /** Whether the caller should actually block. False while the flag is off. */
  enforced: boolean;
  /** Whether this user is within their plan's allowance right now. */
  allowed: boolean;
  /** Readings used this calendar month. */
  used: number;
  /** The plan's monthly allowance; `null` = unlimited. */
  limit: number | null;
  /** The tier the allowance came from. */
  tier: NumenTier;
}

/**
 * How many Readings this user has produced since the start of the calendar month.
 * Uses a HEAD count (no rows transferred) — this runs on the hot path of /api/analyze.
 */
export async function countReadingsThisPeriod(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<number> {
  const { count, error } = await supabase
    .from("analysis_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", currentPeriodStart(now).toISOString());

  if (error) throw error;
  return count ?? 0;
}

/**
 * Is this user's NEXT Reading within their plan?
 *
 * Fails OPEN on a counting error: a flaky count must never cost a paying customer their
 * Reading. The alternative (fail closed) turns a transient DB blip into "you've hit your
 * limit" for someone who hasn't — the worse of the two failures by far.
 */
export async function checkReadingQuota(
  supabase: SupabaseClient,
  userId: string,
  tier: NumenTier,
  now: Date = new Date()
): Promise<QuotaVerdict> {
  const limit = readingAllowance(tier);
  const enforced = isQuotaEnforced();

  // Unlimited plans never need the count.
  if (limit === null) {
    return { enforced, allowed: true, used: 0, limit: null, tier };
  }

  let used: number;
  try {
    used = await countReadingsThisPeriod(supabase, userId, now);
  } catch (error) {
    console.error("[quota] count failed — failing open", error);
    return { enforced, allowed: true, used: 0, limit, tier };
  }

  return { enforced, allowed: used < limit, used, limit, tier };
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

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("virtuna_tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.virtuna_tier) tier = data.virtuna_tier as NumenTier;
  } catch (error) {
    // Same fail-open rationale: if we cannot read the tier we must not invent a limit.
    console.error("[quota] tier lookup failed — failing open", error);
    return {
      enforced: isQuotaEnforced(),
      allowed: true,
      used: 0,
      limit: null,
      tier: "free",
    };
  }

  return checkReadingQuota(supabase, userId, tier, now);
}
