import { describe, it, expect } from "vitest";

import {
  PLANS,
  TRIAL,
  getPlan,
  isPaidPlanId,
  readingAllowance,
  readingAllowanceFor,
  readingsLabel,
} from "@/lib/pricing";

/**
 * The pricing SSOT is owner-locked (2026-07-13). These tests are the contract: if someone
 * changes a price, a tier id, or the trial, they have to change this file too — which is
 * exactly the friction we want on the numbers customers are charged.
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

  it("meters Readings: 50 / 150 / unlimited", () => {
    expect(getPlan("starter").readingsPerMonth).toBe(50);
    expect(getPlan("pro").readingsPerMonth).toBe(150);
    expect(getPlan("studio").readingsPerMonth).toBeNull();
  });

  it("leads every plan's bullets with the meter — it is what they buy", () => {
    for (const plan of PLANS) {
      expect(plan.bullets[0]).toBe(readingsLabel(plan));
    }
  });

  it("offers the $1 / 3-day trial (owner-locked: on ALL three plans)", () => {
    expect(TRIAL.price).toBe("$1");
    expect(TRIAL.days).toBe(3);
    // The microcopy must say what happens on day 4 — a trial that hides its
    // conversion is the thing customers file chargebacks over.
    expect(TRIAL.microcopy).toMatch(/then the plan price/i);
    expect(TRIAL.microcopy).toMatch(/cancel anytime/i);
  });

  it("caps the trial pool at 5 Readings — the leech guard", () => {
    // Owner-locked 2026-07-13. $1 buys FIVE Readings, whatever plan was picked. Raising this
    // silently is how a dollar starts buying $22 of engine spend (150 Pro Readings).
    expect(TRIAL.readings).toBe(5);
    expect(TRIAL.readings).toBeLessThan(getPlan("starter").readingsPerMonth!);
  });
});

describe("pricing — the trial pool beats the plan allowance", () => {
  it("caps EVERY plan at 5 Readings inside the trial", () => {
    for (const plan of PLANS) {
      expect(readingAllowanceFor(plan.id, { inTrial: true })).toBe(5);
    }
  });

  it("never lets Studio's `unlimited` (null) leak into a trial", () => {
    // The dangerous one: null means "don't even count". Inside a trial it must be 5.
    expect(getPlan("studio").readingsPerMonth).toBeNull();
    expect(readingAllowanceFor("studio", { inTrial: true })).toBe(5);
  });

  it("restores the plan's own allowance once the trial converts", () => {
    expect(readingAllowanceFor("starter", { inTrial: false })).toBe(50);
    expect(readingAllowanceFor("pro", { inTrial: false })).toBe(150);
    expect(readingAllowanceFor("studio", { inTrial: false })).toBeNull();
  });
});

describe("pricing — allowances", () => {
  it("gives a paid tier its plan's allowance", () => {
    expect(readingAllowance("starter")).toBe(50);
    expect(readingAllowance("pro")).toBe(150);
    expect(readingAllowance("studio")).toBeNull(); // unlimited
  });

  it("gives `free` NOTHING — there is no free plan, the $1 trial is the way in", () => {
    expect(readingAllowance("free")).toBe(0);
    // Anything unrecognised is treated as free, never as unlimited.
    expect(readingAllowance("legacy_tier")).toBe(0);
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
