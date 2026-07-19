/**
 * PRICING — the single source of truth for what Maven costs and what each plan buys.
 *
 * Owner-locked 2026-07-19: three paid plans, no free plan on the page, a $1 / 3-day trial
 * on ALL THREE — and the meter is CREDITS. One pool per plan; every paid action draws from
 * it at a public per-action price (CREDIT_COSTS). "Reading" survives as the NAME of the
 * flagship action — a full simulation — which costs 10 credits, so the plan allowances are
 * the same capacity the 2026-07-13 Readings model sold (50 → 500, 150 → 1,500).
 *
 *   Creator  $49/mo    500 credits
 *   Pro      $99/mo  1,500 credits   ← best value
 *   Studio  $499/mo  unlimited (fair-use ceiling) + seats + API
 *
 * WHY CREDITS, not Readings-only and not an opaque usage meter: half the product is now
 * skills that are not Readings (hooks, ideas, scripts, explore, reads) and all of them cost
 * real engine spend; a per-action price list is the one model a creator can predict, compare
 * (the tools they shop against all sell credits), and top up. An invisible percentage meter
 * is for developers; a balance you can count is for customers.
 *
 * ⚠️ PUBLIC NAME vs INTERNAL ID. The tier ids stay `starter | pro | studio` because they are
 * persisted (`user_subscriptions.virtuna_tier`, a CHECK constraint) and read by every gate.
 * `starter` is the id; **"Creator" is what the customer sees.** Renaming the id would mean a
 * data migration for zero user-visible gain — so the mapping lives here, in one place, and
 * nowhere else. Never print a tier id in the UI; print `plan.name`.
 *
 * This module is import-safe from both server and client components: it holds NO secrets
 * (Whop product ids come from env, in `lib/whop/config.ts`) and no `process.env` reads.
 */

/** The paid tiers. `free` is NOT a plan — it is the lapsed/never-subscribed state. */
export type PaidPlanId = "starter" | "pro" | "studio";

/**
 * THE PRICE LIST — what each paid action draws from the credit pool.
 *
 * Keys are the ledger's `mode` values (reading_events.mode): one key per billable action,
 * written by the route that delivers it. Costs are anchored to real engine spend:
 *
 *   10 — a full Reading: score a video/concept, decode a remix source, /test in chat.
 *        The heaviest thing we run (video pipeline + population simulation).
 *    5 — a LIVE outlier scrape (explore with "find new outliers") — real Apify spend.
 *    2 — deep single-output generation/simulation: one script, a Predict, a Simulate,
 *        a Profile read.
 *    1 — light generation and reads: a hooks pack, an ideas pack, develop-this-idea,
 *        a concept Read, a card refine, a cached explore.
 *
 * NOT here = free: open chat, type-to-room reactions, card adapters, viewing anything.
 * Free is a product decision (chat is the glue), enforced by rate limits, not the meter.
 *
 * ⚠️ Draft costs (2026-07-19): the RATIOS are owner-locked; exact per-action numbers get a
 * final owner sign-off after verification against measured engine spend, before enforcement
 * flips on. Change a number here and every gate, balance and page follows.
 */
export const CREDIT_COSTS = {
  /** A full Reading — score mode on /api/analyze. */
  score: 10,
  /** A remix decode — /api/analyze mode=remix and /api/tools/remix/run. */
  remix: 10,
  /** One generated script. */
  script: 2,
  /** A Predict verb run. */
  predict: 2,
  /** A Simulate verb run. */
  simulate: 2,
  /** A Profile read (evidence → profile). */
  profile: 2,
  /** A hooks pack. */
  hooks: 1,
  /** An ideas pack. */
  ideas: 1,
  /** Develop-this-idea (anchored hooks run). */
  develop: 1,
  /** A concept Read against the selected audience. */
  read: 1,
  /** A scoped card refine (fresh SIM-scored re-run). */
  refine: 1,
  /** Explore from the cached corpus. */
  explore: 1,
  /** Explore that triggers a LIVE outlier scrape (allowScrape) — Apify spend. */
  explore_scrape: 5,
} as const;

export type BillableAction = keyof typeof CREDIT_COSTS;

/** The cost of one action, in credits. */
export function creditCost(action: BillableAction): number {
  return CREDIT_COSTS[action];
}

/** How many credits one full Reading costs — the unit the old model sold directly. */
export const CREDITS_PER_READING = CREDIT_COSTS.score;

/**
 * Fair-use ceiling for "unlimited" (Studio, outside a trial): credits per UTC day.
 * "Unlimited" prices a team's honest month, not a scripted farm — 300/day is 30 full
 * Readings every single day, far beyond human use, and it caps our worst-case engine
 * spend at ~$135/mo against Studio's $499. Stated in the FAQ; enforced by the meter.
 */
export const UNLIMITED_DAILY_CREDIT_CEILING = 300;

/** The $1 trial, offered on every plan. */
export const TRIAL = {
  /** What the card is charged today. */
  price: "$1",
  /** How long the trial runs before it converts to the plan's monthly price. */
  days: 3,
  /**
   * THE TRIAL POOL — owner-locked 2026-07-19. A $1 trial buys at most **50 credits**
   * (5 full Readings' worth), on EVERY plan, regardless of the plan's monthly allowance.
   *
   * This is leech protection, and it is the whole reason the trial is safe to offer on all
   * three plans: without it, $1 would buy 1,500 Pro credits (~$22 of engine spend) or an
   * unbounded number on Studio. The trial's job is to prove the product on a few real
   * videos, not to hand over a month of capacity for a dollar.
   */
  credits: 50,
  /** The badge on every pricing card. */
  badge: "$1 for 3 days",
  /**
   * The risk-reducer under every CTA. It has to carry BOTH surprises a buyer could
   * otherwise hit: the pool is capped at 50 credits, and it renews at the plan price.
   * Burying either one is how you earn chargebacks.
   */
  microcopy: "$1 for 3 days · 50 credits, then the plan price — cancel anytime",
} as const;

export interface Plan {
  /** Persisted tier id (`user_subscriptions.virtuna_tier`). NOT for display. */
  id: PaidPlanId;
  /** The public name. This is the ONLY name a customer should ever see. */
  name: string;
  /** Display price, e.g. "$49". */
  price: string;
  /** Display suffix, e.g. "/mo". */
  priceSuffix: string;
  /** The billed amount in USD — the number, for anything that must compute. */
  monthlyPriceUsd: number;
  /**
   * THE METER. Credits per billing month; `null` = unlimited (fair-use ceiling applies —
   * see UNLIMITED_DAILY_CREDIT_CEILING). A full Reading costs CREDITS_PER_READING.
   */
  creditsPerMonth: number | null;
  /** Seats included on the plan. */
  seats: number;
  /** Optional card badge (the "best value" flag). */
  badge?: string;
  /** The one card that gets the primary CTA + border. */
  highlighted?: boolean;
  /** One line naming who the plan is for. */
  tagline: string;
  /** 3–4 bullets. First bullet is always the meter — that is what they're buying. */
  bullets: readonly string[];
}

export const PLANS: readonly Plan[] = [
  {
    id: "starter",
    name: "Creator",
    price: "$49",
    priceSuffix: "/mo",
    monthlyPriceUsd: 49,
    creditsPerMonth: 500,
    seats: 1,
    tagline: "For the creator posting every week.",
    bullets: [
      "500 credits a month — about 50 full Readings",
      "Every skill: Readings, hooks, ideas, scripts, explore",
      "Retention curve: the exact moment viewers drop",
      "Your room of 10 personas reacts",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    priceSuffix: "/mo",
    monthlyPriceUsd: 99,
    creditsPerMonth: 1500,
    seats: 1,
    badge: "Best value",
    highlighted: true,
    tagline: "For the creator who posts daily and can't afford a miss.",
    bullets: [
      "1,500 credits a month — about 150 full Readings",
      "Everything in Creator",
      "Population depth — a 1,000-viewer simulation",
      "Priority support",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$499",
    priceSuffix: "/mo",
    monthlyPriceUsd: 499,
    creditsPerMonth: null,
    seats: 5,
    tagline: "For agencies and teams running many accounts.",
    bullets: [
      "Unlimited credits (fair use)",
      "Everything in Pro",
      "5 seats for your team",
      "API access + dedicated support",
    ],
  },
] as const;

const PLAN_BY_ID: Record<PaidPlanId, Plan> = PLANS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PaidPlanId, Plan>
);

export function getPlan(id: PaidPlanId): Plan {
  return PLAN_BY_ID[id];
}

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return value === "starter" || value === "pro" || value === "studio";
}

/** "500 credits a month" / "Unlimited credits" — one phrasing, used everywhere. */
export function creditsLabel(plan: Plan): string {
  return plan.creditsPerMonth === null
    ? "Unlimited credits"
    : `${plan.creditsPerMonth.toLocaleString("en-US")} credits a month`;
}

/** A customer's credit balance right now — what the meter (lib/billing/quota.ts) measured. */
export interface CreditBalance {
  used: number;
  /** null = unlimited. */
  limit: number | null;
  /** Inside the $1 trial the pool is TRIAL.credits, whatever plan they picked. */
  inTrial: boolean;
}

/**
 * "380 of 500 credits left" / "30 of 50 trial credits left" / "Unlimited credits" — one
 * phrasing, used by every surface that shows a balance (settings, the composer, the paywall).
 *
 * Counts DOWN, not up: what a customer wants to know is what they have left, not what they
 * have spent. Clamped at 0 — an over-limit balance reads as "0 left", never a negative.
 */
export function creditsRemainingLabel(balance: CreditBalance): string {
  if (balance.limit === null) return "Unlimited credits";
  const left = Math.max(0, balance.limit - balance.used);
  const noun = balance.inTrial ? "trial credits" : "credits";
  return `${left.toLocaleString("en-US")} of ${balance.limit.toLocaleString("en-US")} ${noun} left`;
}

/**
 * The monthly credit allowance for a persisted tier — the number the quota check
 * enforces. `free` (never subscribed / lapsed / cancelled) gets nothing: the $1 trial
 * is the way in, so there is no free tier to farm.
 *
 * NOTE: this is the allowance for a BILLED month. Someone inside their $1 trial is capped
 * at `TRIAL.credits` instead, whatever plan they picked — see `creditAllowanceFor`.
 */
export function creditAllowance(tier: string): number | null {
  if (isPaidPlanId(tier)) return getPlan(tier).creditsPerMonth;
  return 0;
}

/**
 * The allowance that actually applies right now: the trial pool while the $1 trial is
 * running, the plan's monthly allowance once it has converted.
 *
 * The trial cap wins even on Studio ("unlimited"), which is the point — `null` (unlimited)
 * must never leak into a trial.
 */
export function creditAllowanceFor(
  tier: string,
  opts: { inTrial: boolean }
): number | null {
  if (opts.inTrial) return TRIAL.credits;
  return creditAllowance(tier);
}
