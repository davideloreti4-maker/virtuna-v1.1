import { describe, it, expect } from "vitest";

import {
  CREDIT_COSTS,
  CREDITS_PER_READING,
  PLANS,
  TRIAL,
  UNLIMITED_DAILY_CREDIT_CEILING,
  creditAllowance,
  creditAllowanceFor,
  creditCost,
  creditsLabel,
  creditsRemainingLabel,
  getPlan,
  isPaidPlanId,
} from "@/lib/pricing";

/**
 * The pricing SSOT is owner-locked (2026-07-19: credits model). These tests are the contract:
 * if someone changes a price, a tier id, the trial, or an action's credit cost, they have to
 * change this file too — which is exactly the friction we want on the numbers customers are
 * charged.
 */
describe("pricing — owner-locked plans", () => {
  it("sells exactly three paid plans at $49 / $99 / $499", () => {
    expect(PLANS.map((p) => p.price)).toEqual(["$49", "$99", "$499"]);
    expect(PLANS.map((p) => p.monthlyPriceUsd)).toEqual([49, 99, 499]);
  });

  it("names them Creator · Pro · Studio (public names, not tier ids)", () => {
    expect(PLANS.map((p) => p.name)).toEqual(["Creator", "Pro", "Studio"]);
    // The persisted ids stay starter/pro/studio — `starter` IS "Creator".
    expect(PLANS.map((p) => p.id)).toEqual(["starter", "pro", "studio"]);
  });

  it("sells the `starter` id as 'Creator' — the one id whose name differs", () => {
    // The only place the id/name split can actually bite: a regression here means a
    // customer sees "Starter" on a $49 plan we market as Creator. (`pro` and `studio`
    // share their word with their id by design, so they need no such guard.)
    expect(getPlan("starter").name).toBe("Creator");
    expect(PLANS.map((p) => p.name)).not.toContain("Starter");
  });

  it("marks exactly one plan as the best value (one CTA dominates)", () => {
    const highlighted = PLANS.filter((p) => p.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.id).toBe("pro");
    expect(highlighted[0]?.badge).toBe("Best value");
  });

  it("meters credits: 500 / 1,500 / unlimited — same capacity the Readings model sold", () => {
    expect(getPlan("starter").creditsPerMonth).toBe(500);
    expect(getPlan("pro").creditsPerMonth).toBe(1500);
    expect(getPlan("studio").creditsPerMonth).toBeNull();
    // The continuity invariant: 50 and 150 Readings, at 10 credits each.
    expect(getPlan("starter").creditsPerMonth).toBe(50 * CREDITS_PER_READING);
    expect(getPlan("pro").creditsPerMonth).toBe(150 * CREDITS_PER_READING);
  });

  it("leads every plan's bullets with the meter — it is what they buy", () => {
    for (const plan of PLANS) {
      expect(plan.bullets[0]?.toLowerCase()).toContain("credits");
    }
  });

  it("offers the $1 / 3-day trial (owner-locked: on ALL three plans)", () => {
    expect(TRIAL.price).toBe("$1");
    expect(TRIAL.days).toBe(3);
    // The microcopy must say what happens on day 4 — a trial that hides its
    // conversion is the thing customers file chargebacks over.
    expect(TRIAL.microcopy).toMatch(/then the plan price/i);
    expect(TRIAL.microcopy).toMatch(/cancel anytime/i);
    // ...and it must state the pool, in the unit the meter enforces.
    expect(TRIAL.microcopy).toContain(`${TRIAL.credits} credits`);
  });

  it("caps the trial pool at 50 credits — the leech guard", () => {
    // Owner-locked 2026-07-19. $1 buys 50 credits (5 full Readings' worth), whatever plan
    // was picked. Raising this silently is how a dollar starts buying $22 of engine spend.
    expect(TRIAL.credits).toBe(50);
    expect(TRIAL.credits).toBe(5 * CREDITS_PER_READING);
    expect(TRIAL.credits).toBeLessThan(getPlan("starter").creditsPerMonth!);
  });
});

describe("pricing — the credit price list", () => {
  it("prices the flagship actions at 10 — a Reading is a Reading in every mode", () => {
    expect(CREDIT_COSTS.score).toBe(10);
    expect(CREDIT_COSTS.remix).toBe(10);
    expect(CREDITS_PER_READING).toBe(10);
  });

  it("prices a live scrape above every generation — Apify spend is real money", () => {
    expect(CREDIT_COSTS.explore_scrape).toBe(5);
    for (const action of ["script", "predict", "simulate", "profile", "hooks", "ideas", "develop", "read", "refine", "explore"] as const) {
      expect(CREDIT_COSTS[action]).toBeLessThan(CREDIT_COSTS.explore_scrape);
    }
  });

  it("keeps every action strictly positive — a 0-cost action belongs OFF the list, not on it", () => {
    for (const [action, cost] of Object.entries(CREDIT_COSTS)) {
      expect(cost, action).toBeGreaterThan(0);
    }
  });

  it("creditCost reads the list", () => {
    expect(creditCost("hooks")).toBe(1);
    expect(creditCost("script")).toBe(2);
    expect(creditCost("score")).toBe(10);
  });

  it("backs Studio's 'unlimited' with a fair-use ceiling a human can't hit", () => {
    // 300/day = 30 full Readings every day. It exists to bound scripted abuse, not humans.
    expect(UNLIMITED_DAILY_CREDIT_CEILING).toBe(300);
    expect(UNLIMITED_DAILY_CREDIT_CEILING).toBeGreaterThanOrEqual(30 * CREDITS_PER_READING);
  });
});

describe("pricing — the trial pool beats the plan allowance", () => {
  it("caps EVERY plan at 50 credits inside the trial", () => {
    for (const plan of PLANS) {
      expect(creditAllowanceFor(plan.id, { inTrial: true })).toBe(50);
    }
  });

  it("never lets Studio's `unlimited` (null) leak into a trial", () => {
    // The dangerous one: null means "don't even count". Inside a trial it must be 50.
    expect(getPlan("studio").creditsPerMonth).toBeNull();
    expect(creditAllowanceFor("studio", { inTrial: true })).toBe(50);
  });

  it("restores the plan's own allowance once the trial converts", () => {
    expect(creditAllowanceFor("starter", { inTrial: false })).toBe(500);
    expect(creditAllowanceFor("pro", { inTrial: false })).toBe(1500);
    expect(creditAllowanceFor("studio", { inTrial: false })).toBeNull();
  });
});

describe("pricing — allowances", () => {
  it("gives a paid tier its plan's allowance", () => {
    expect(creditAllowance("starter")).toBe(500);
    expect(creditAllowance("pro")).toBe(1500);
    expect(creditAllowance("studio")).toBeNull(); // unlimited
  });

  it("gives `free` NOTHING — there is no free plan, the $1 trial is the way in", () => {
    expect(creditAllowance("free")).toBe(0);
    // Anything unrecognised is treated as free, never as unlimited.
    expect(creditAllowance("legacy_tier")).toBe(0);
  });

  it("recognises only the three paid ids", () => {
    expect(isPaidPlanId("starter")).toBe(true);
    expect(isPaidPlanId("pro")).toBe(true);
    expect(isPaidPlanId("studio")).toBe(true);
    expect(isPaidPlanId("free")).toBe(false);
    expect(isPaidPlanId("enterprise")).toBe(false);
    expect(isPaidPlanId(undefined)).toBe(false);
  });
});

describe("the balance a customer is shown", () => {
  it("counts DOWN — what's left, not what's spent", () => {
    expect(creditsRemainingLabel({ used: 120, limit: 500, inTrial: false })).toBe(
      "380 of 500 credits left"
    );
  });

  it("formats thousands like a human", () => {
    expect(creditsRemainingLabel({ used: 0, limit: 1500, inTrial: false })).toBe(
      "1,500 of 1,500 credits left"
    );
    expect(creditsLabel(getPlan("pro"))).toBe("1,500 credits a month");
  });

  it("names the trial pool as a trial pool", () => {
    // A trialling customer has not hit their PLAN's limit, and must not be told they have.
    expect(creditsRemainingLabel({ used: 20, limit: 50, inTrial: true })).toBe(
      "30 of 50 trial credits left"
    );
  });

  it("never shows a negative balance", () => {
    // The meter is checked BEFORE an action, and it fails open, so `used` can legitimately
    // overshoot the limit. "-3 of 500 left" is not a thing to put in front of a customer.
    expect(creditsRemainingLabel({ used: 530, limit: 500, inTrial: false })).toBe(
      "0 of 500 credits left"
    );
  });

  it("says Unlimited rather than doing arithmetic on null", () => {
    expect(creditsRemainingLabel({ used: 900, limit: null, inTrial: false })).toBe(
      "Unlimited credits"
    );
    expect(creditsLabel(getPlan("studio"))).toBe("Unlimited credits");
  });
});
