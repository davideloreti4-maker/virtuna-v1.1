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
 *    5 — REAL APIFY SPEND: a LIVE outlier scrape (explore with "find new outliers"),
 *        or a Read on your own account (two profile/video scrapes, 1-3 min).
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
  /**
   * A room reaction — one Flash text-mode run against the audience panel
   * (`/api/tools/react`): the composer's "Ask the room" and the Overview rail's armed sim.
   *
   * Its OWN key rather than folding into `read`, so the ledger can tell the two apart: they
   * are different engine calls (a Flash 10-persona reaction vs the two-audience read) and a
   * usage statement that prints them under one name cannot be reconciled line by line.
   *
   * ⚠️ It was FREE until 2026-07-28 (owner call to price it). It is real engine spend — a
   * Flash panel run, plus a `characterizeContent` call when the audience carries v2 axes —
   * and the `＋ Test something of your own` door promotes it to a primary action.
   */
  react: 1,
  /** A scoped card refine (fresh SIM-scored re-run). */
  refine: 1,
  /** Explore from the cached corpus. */
  explore: 1,
  /** Explore that triggers a LIVE outlier scrape (allowScrape) — Apify spend. */
  explore_scrape: 5,
  /**
   * A Read on the creator's OWN account — `/api/account-read`.
   *
   * ⚠️ It was FREE and completely unmetered until 2026-07-29 (owner call to price it at 5). Not a
   * decision — an omission: the route had no `creditGate`, no `billUsage`, and no key here, so it
   * ran real Apify spend for nothing. It was flagged across six sessions before it got a number.
   *
   * Priced at the SCRAPE tier, not the Reading tier, and the two facts that decide it:
   *   • it fires TWO parallel Apify runs (`scrapeProfile` + `scrapeVideos(handle, 30)`), 1-3 min,
   *     which is why the route carries `maxDuration = 300`;
   *   • it makes NO model call at all — every pattern is deterministic extraction.
   * So it is heavier on Apify than `explore_scrape` and lighter everywhere else, which puts it at
   * the same 5 rather than at `score`'s 10. Its NAME argues for 10 ("a Read"); its engine spend
   * does not, and the costs here are anchored to spend.
   *
   * Billed ON DELIVERY only. The route has three exits that reach no scrape or no result — no
   * personal audience on file, thin history, scrape failure — and none of them charge.
   */
  account: 5,
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

/**
 * THE DEMO ENTITLEMENT — what an ANONYMOUS visitor gets before the $1.
 *
 * Owner, 2026-07-27: *"we give the demo to the user for free but to unlock the complete
 * result/value they need to start their 3 day trial and unlock the complete platform."*
 *
 * So it is ONE free Test — a genuine engine run on the visitor's own video, paid for by us —
 * and NOTHING else. Every other skill, and the simulation verdict on that very run, is what
 * the dollar buys. This makes one Reading the funnel's cost-per-visitor ceiling.
 *
 * ⚠️ It is an ENTITLEMENT, not a wallet. This constant was `DEMO_CREDITS` alone and the check
 * was `used + cost <= DEMO_CREDITS`, which reads as "10 credits to spend" — so one 1-credit
 * Ideas tap made it 11 > 10 and the free Test was refused *permanently*, with the words "That
 * was your free test" to someone who had never had one. The meter now counts DELIVERED RUNS of
 * `DEMO_ACTION` (see `lib/billing/quota.ts`), which nothing else can consume.
 *
 * ⚠️ Unlike every other allowance here, it is enforced **regardless of
 * `BILLING_ENFORCE_QUOTA`**. That flag exists so real customers are not locked out before the
 * Whop plans are buyable; it has nothing to say about how much free engine spend an
 * unauthenticated stranger may trigger, and anonymous users are unbounded in number. Leaving
 * this to the flag would mean the demo is uncapped in exactly the window where the funnel is
 * live and the meter is off.
 */
/** The one action the demo entitles: a full video Test. Its ledger `mode` is what's counted. */
export const DEMO_ACTION = "score" as const;
/** How many of them. One. */
export const DEMO_RUNS = 1;
/**
 * The demo's credit-equivalent — one Test's price. NOT a spendable balance: it is what the
 * wall reports as `limit` (and, once the run is used, as `used`) so the 402 body stays in the
 * same units as every other refusal. The admission decision is `DEMO_RUNS`, never this.
 */
export const DEMO_CREDITS = CREDIT_COSTS[DEMO_ACTION];

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
