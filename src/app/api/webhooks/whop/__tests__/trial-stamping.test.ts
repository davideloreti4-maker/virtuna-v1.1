import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * THE TRIAL WINDOW IS STAMPED ONCE — the day-4 conversion, without waiting for day 4.
 *
 * A $1 trial SKU renews into its plan at the plan's price under the SAME Whop plan id, and
 * Whop re-sends `membership_went_valid` when it does. If that second delivery re-stamped the
 * window, the customer would get a fresh 50-credit trial every billing cycle — and worse, a
 * now-paying Pro would be re-capped at 50 credits instead of their 1,500. The bug pays out in
 * both directions at once.
 *
 * The live check for this needs 2026-07-30 and a real conversion. The branch does not: the
 * only inputs are the existing row and the SKU, so it is verifiable now, which is the point
 * of testing it here instead of waiting.
 *
 * Env is stubbed and the route imported dynamically so the REAL `lib/whop/config` mapping is
 * exercised — the SKU→tier and SKU→is-trial decisions are half of what is under test, and
 * mocking them would leave the mapping unverified.
 */

const TRIAL_SKU = "plan_trial_starter";
const FULL_SKU = "prod_full_starter";
const USER = "cab41c2e-63ae-414e-be94-c1f6074bd676";
const MEMBERSHIP = "mem_o3mXSuod9Gxteg";

/** The `user_subscriptions` row the route finds before it writes. */
let existingRow: Record<string, unknown> | null = null;
/** What the route upserted. */
let upserted: Record<string, unknown> | null = null;

vi.mock("@/lib/whop/webhook-verification", () => ({
  verifyWebhookSignature: () => true,
  describeSignatureFailure: () => ({}),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: existingRow, error: null })),
      upsert: vi.fn(async (row: Record<string, unknown>) => {
        upserted = row;
        return { error: null };
      }),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}));

function delivery(skuId: string) {
  return new Request("https://numenmachines.com/api/webhooks/whop", {
    method: "POST",
    body: JSON.stringify({
      // The v2 shape, as actually delivered — the name lives under `type`.
      type: "membership_went_valid",
      data: {
        id: MEMBERSHIP,
        plan: { id: skuId },
        metadata: { supabase_user_id: USER },
        renewal_period_end: "2026-08-30T10:19:45.367Z",
      },
    }),
  });
}

async function post(skuId: string) {
  const { POST } = await import("@/app/api/webhooks/whop/route");
  return POST(delivery(skuId) as never);
}

beforeEach(() => {
  vi.resetModules();
  existingRow = null;
  upserted = null;
  vi.stubEnv("WHOP_WEBHOOK_SECRET", "test-secret");
  vi.stubEnv("WHOP_TRIAL_PLAN_ID_STARTER", TRIAL_SKU);
  vi.stubEnv("WHOP_PRODUCT_ID_STARTER", FULL_SKU);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the $1 trial window is stamped exactly once", () => {
  it("stamps the window on the FIRST grant, 3 days wide", async () => {
    existingRow = null; // never subscribed

    await post(TRIAL_SKU);

    expect(upserted).toMatchObject({
      user_id: USER,
      virtuna_tier: "starter",
      status: "active",
      is_trial: true,
    });
    const started = new Date(upserted!.trial_started_at as string).getTime();
    const ends = new Date(upserted!.trial_ends_at as string).getTime();
    expect((ends - started) / (24 * 60 * 60 * 1000)).toBe(3);
    // History, written at the same moment — this is what denies a second $1 forever.
    expect(upserted!.trial_used_at).toBe(upserted!.trial_started_at);
  });

  /** THE DAY-4 CASE. */
  it("does NOT re-stamp when the trial converts — same membership, same SKU", async () => {
    existingRow = {
      whop_membership_id: MEMBERSHIP,
      trial_started_at: "2026-07-27T10:46:36.395Z",
    };

    await post(TRIAL_SKU);

    // Not "unchanged values" — ABSENT keys. An upsert that names the columns at all would
    // overwrite them, so the assertion has to be about what is written, not what it equals.
    expect(upserted).not.toHaveProperty("trial_started_at");
    expect(upserted).not.toHaveProperty("trial_ends_at");
    expect(upserted).not.toHaveProperty("trial_used_at");
    expect(upserted).not.toHaveProperty("is_trial");

    // The rest of the renewal still lands: they are a paying customer now.
    expect(upserted).toMatchObject({ virtuna_tier: "starter", status: "active" });
  });

  it("clears a lingering window when a FULL-PRICE plan is granted, but keeps the history", async () => {
    existingRow = {
      whop_membership_id: "mem_previous",
      trial_started_at: "2026-06-01T00:00:00.000Z",
    };

    await post(FULL_SKU);

    // A stale window would cap a paying customer at 50 credits instead of their allowance.
    expect(upserted).toMatchObject({
      trial_started_at: null,
      trial_ends_at: null,
      is_trial: false,
      virtuna_tier: "starter",
    });
    // `trial_used_at` is NOT among them: it is history, and clearing it would hand the
    // account a second $1 trial.
    expect(upserted).not.toHaveProperty("trial_used_at");
  });

  it("stamps again for a DIFFERENT membership — the guard is per-membership, not per-account", async () => {
    // Documenting the boundary, not endorsing it: re-buying a trial SKU on a NEW membership
    // does open a new window here. The one-per-account rule is enforced upstream, at
    // /api/whop/checkout, which refuses to sell a second trial at all.
    existingRow = {
      whop_membership_id: "mem_a_different_one",
      trial_started_at: "2026-07-01T00:00:00.000Z",
    };

    await post(TRIAL_SKU);

    expect(upserted).toHaveProperty("trial_started_at");
    expect(upserted!.is_trial).toBe(true);
  });
});
