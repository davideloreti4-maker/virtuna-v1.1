import { describe, it, expect } from "vitest";

import { hasUsedTrial } from "@/lib/billing/trial-eligibility";

/**
 * ONE TRIAL PER ACCOUNT — the predicate both halves of the promise now share.
 *
 * The defect this guards: `/api/whop/checkout` refused a second $1 trial, and every CTA in
 * the product offered one anyway. The two agreed on the RULE and disagreed on nothing at all
 * — they simply never asked the same question, because only one of them asked.
 *
 * So the thing worth pinning is not the rule (that's a one-liner) but the fixtures: which
 * shapes of `user_subscriptions` row mean "the dollar is gone". Any caller reading the
 * columns directly instead of calling this is how the two drift apart again.
 */
describe("hasUsedTrial", () => {
  it("is false for an account that has never had a subscription row", () => {
    expect(hasUsedTrial(null)).toBe(false);
    expect(hasUsedTrial(undefined)).toBe(false);
    expect(hasUsedTrial({})).toBe(false);
  });

  it("is false when the row exists but no trial window was ever stamped", () => {
    expect(hasUsedTrial({ virtuna_tier: "free", trial_used_at: null })).toBe(false);
    expect(
      hasUsedTrial({ virtuna_tier: "starter", trial_used_at: null, trial_started_at: null })
    ).toBe(false);
  });

  it("is true once `trial_used_at` is stamped", () => {
    expect(hasUsedTrial({ trial_used_at: "2026-07-27T10:46:00Z" })).toBe(true);
  });

  it("is true on legacy rows that only carry `trial_started_at`", () => {
    // Rows predating the `trial_used_at` migration. The belt, not the braces.
    expect(hasUsedTrial({ trial_started_at: "2026-06-01T00:00:00Z" })).toBe(true);
  });

  /**
   * The case the product actually got wrong. Cancellation returns the account to tier `free`
   * and deliberately does NOT clear the trial history — so `tier === "free"`, which is what
   * every "$1" CTA keyed off, is not evidence the dollar is still available.
   */
  it("stays true after the plan is cancelled and the tier falls back to free", () => {
    expect(
      hasUsedTrial({
        virtuna_tier: "free",
        status: "cancelled",
        is_trial: true,
        trial_used_at: "2026-07-27T10:46:00Z",
      })
    ).toBe(true);
  });
});
