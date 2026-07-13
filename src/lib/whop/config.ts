/**
 * Whop integration configuration and tier management utilities.
 *
 * The customer-facing pricing (names, prices, what each plan buys) lives in
 * `src/lib/pricing.ts` — the SSOT. THIS file only maps our tier ids onto Whop plan ids
 * and answers "does this user's tier clear that bar?".
 *
 * Tier ids are persisted (`whop_subscriptions.virtuna_tier`, CHECK constraint) and are
 * NOT display names: `starter` is sold as **Creator**. See pricing.ts.
 */

import type { PaidPlanId } from "@/lib/pricing";

export type NumenTier = "free" | PaidPlanId; // free | starter | pro | studio

export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

export const TIER_HIERARCHY = {
  free: 0,
  starter: 1,
  pro: 2,
  studio: 3,
} as const;

/**
 * The Whop plan a customer buys at full price — one per tier. Create them in the Whop
 * dashboard, then set these env vars.
 */
export const WHOP_PRODUCT_IDS: Record<PaidPlanId, string | undefined> = {
  starter: process.env.WHOP_PRODUCT_ID_STARTER,
  pro: process.env.WHOP_PRODUCT_ID_PRO,
  studio: process.env.WHOP_PRODUCT_ID_STUDIO,
};

/**
 * The $1 / 3-day trial SKUs — a SEPARATE Whop plan per tier whose initial price is $1
 * for 3 days and which then renews at the plan's monthly price. Owner-locked: the trial
 * is offered on ALL THREE plans.
 *
 * A missing trial plan id degrades to the full-price plan (see `resolveWhopPlanId`), so
 * an unset env var means "no trial offered on that plan" — never a broken checkout.
 */
export const WHOP_TRIAL_PLAN_IDS: Record<PaidPlanId, string | undefined> = {
  starter: process.env.WHOP_TRIAL_PLAN_ID_STARTER,
  pro: process.env.WHOP_TRIAL_PLAN_ID_PRO,
  studio: process.env.WHOP_TRIAL_PLAN_ID_STUDIO,
};

/**
 * Which Whop plan to send a buyer to. `trial` picks the $1/3-day SKU when one exists.
 * Returns undefined when the tier has no plan configured at all (env unset) — callers
 * must treat that as "checkout unavailable", never as a silent free grant.
 */
export function resolveWhopPlanId(
  planId: PaidPlanId,
  opts: { trial?: boolean } = {}
): string | undefined {
  if (opts.trial) {
    const trialPlan = WHOP_TRIAL_PLAN_IDS[planId];
    if (trialPlan) return trialPlan;
  }
  return WHOP_PRODUCT_IDS[planId];
}

/**
 * Map a Whop plan id (from a webhook) back to the tier it grants. A plan and its $1 trial
 * SKU grant the SAME tier — someone three days into a $1 Pro trial IS on Pro; the trial
 * ending arrives later as its own cancellation/expiry webhook.
 */
export function mapWhopProductToTier(productId: string): NumenTier {
  for (const tier of ["starter", "pro", "studio"] as const) {
    if (productId && productId === WHOP_PRODUCT_IDS[tier]) return tier;
    if (productId && productId === WHOP_TRIAL_PLAN_IDS[tier]) return tier;
  }
  return "free";
}

export function getTierFromPlanId(planId: PaidPlanId): string | undefined {
  return WHOP_PRODUCT_IDS[planId];
}

export function hasAccessToTier(
  userTier: NumenTier,
  requiredTier: NumenTier
): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}
