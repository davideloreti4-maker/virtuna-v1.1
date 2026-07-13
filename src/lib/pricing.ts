/**
 * PRICING — the single source of truth for what Maven costs and what each plan buys.
 *
 * Owner-locked 2026-07-13: three paid plans, no free plan on the page, and a
 * $1 / 3-day trial available on ALL THREE (adopted from makeugc.ai's "Start for $1",
 * which sells a short paid trial that converts into the plan).
 *
 *   Creator  $49/mo   50 Readings
 *   Pro      $99/mo  150 Readings   ← best value
 *   Studio  $499/mo  unlimited + seats + API
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

/** The $1 trial, offered on every plan. */
export const TRIAL = {
  /** What the card is charged today. */
  price: "$1",
  /** How long the trial runs before it converts to the plan's monthly price. */
  days: 3,
  /**
   * THE TRIAL POOL — owner-locked 2026-07-13. A $1 trial buys at most **5 Readings**, on
   * EVERY plan, regardless of the plan's monthly allowance.
   *
   * This is leech protection, and it is the whole reason the trial is safe to offer on all
   * three plans: without it, $1 would buy 150 Pro Readings (~$22 of engine spend) or an
   * unbounded number on Studio. The trial's job is to prove the product on a few real
   * videos, not to hand over a month of capacity for a dollar.
   */
  readings: 5,
  /** The badge on every pricing card. */
  badge: "$1 for 3 days",
  /**
   * The risk-reducer under every CTA. It has to carry BOTH surprises a buyer could
   * otherwise hit: the pool is capped at 5 Readings, and it renews at the plan price.
   * Burying either one is how you earn chargebacks.
   */
  microcopy: "$1 for 3 days · 5 Readings, then the plan price — cancel anytime",
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
   * THE METER. Readings per calendar month; `null` = unlimited.
   * A "Reading" is one full simulation of one video/concept — the thing the
   * whole product is priced on.
   */
  readingsPerMonth: number | null;
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
    readingsPerMonth: 50,
    seats: 1,
    tagline: "For the creator posting every week.",
    bullets: [
      "50 Readings a month",
      "Virality score — and the why behind it",
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
    readingsPerMonth: 150,
    seats: 1,
    badge: "Best value",
    highlighted: true,
    tagline: "For the creator who posts daily and can't afford a miss.",
    bullets: [
      "150 Readings a month",
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
    readingsPerMonth: null,
    seats: 5,
    tagline: "For agencies and teams running many accounts.",
    bullets: [
      "Unlimited Readings",
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

/** "50 Readings a month" / "Unlimited Readings" — one phrasing, used everywhere. */
export function readingsLabel(plan: Plan): string {
  return plan.readingsPerMonth === null
    ? "Unlimited Readings"
    : `${plan.readingsPerMonth} Readings a month`;
}

/**
 * The monthly Reading allowance for a persisted tier — the number the quota check
 * enforces. `free` (never subscribed / lapsed / cancelled) gets nothing: the $1 trial
 * is the way in, so there is no free tier to farm.
 *
 * NOTE: this is the allowance for a BILLED month. Someone inside their $1 trial is capped
 * at `TRIAL.readings` instead, whatever plan they picked — see `readingAllowanceFor`.
 */
export function readingAllowance(tier: string): number | null {
  if (isPaidPlanId(tier)) return getPlan(tier).readingsPerMonth;
  return 0;
}

/**
 * The allowance that actually applies right now: the trial pool while the $1 trial is
 * running, the plan's monthly allowance once it has converted.
 *
 * The trial cap wins even on Studio ("unlimited"), which is the point — `null` (unlimited)
 * must never leak into a trial.
 */
export function readingAllowanceFor(
  tier: string,
  opts: { inTrial: boolean }
): number | null {
  if (opts.inTrial) return TRIAL.readings;
  return readingAllowance(tier);
}
