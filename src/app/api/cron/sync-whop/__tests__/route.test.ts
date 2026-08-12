import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The drift-reconciliation cron — what it repairs, and the hole it does NOT cover.
 *
 * It is described as the safety net under the webhook. It is only half of one, and the half
 * it is missing is the failure that actually happened on 2026-07-27: it SELECTs
 * `user_subscriptions` rows that already carry a `whop_membership_id` and UPDATEs them. There
 * is no insert path anywhere in it. A webhook that never landed leaves no row to find, so the
 * net cannot catch the customer who paid and got nothing — precisely the case it looks like
 * it exists for.
 *
 * The last test pins that as a KNOWN LIMIT rather than leaving it to be rediscovered. If
 * someone gives this cron an insert path, that test fails and should be rewritten — a failure
 * there is good news.
 */

const MEMBERSHIP = "mem_o3mXSuod9Gxteg";
const TRIAL_SKU = "plan_trial_starter";

/** Rows the cron finds. */
let rows: Array<Record<string, unknown>> = [];
/** What Whop reports for the membership. */
let whopMembership: Record<string, unknown> = {};
/** Captured writes, by operation. */
let updates: Array<Record<string, unknown>> = [];
let inserts: Array<Record<string, unknown>> = [];

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: () => null }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = vi.fn(() => b);
      b.not = vi.fn(async () => ({ data: rows, error: null }));
      b.eq = vi.fn(async () => ({ error: null }));
      b.update = vi.fn((row: Record<string, unknown>) => {
        updates.push(row);
        return { eq: vi.fn(async () => ({ error: null })) };
      });
      b.insert = vi.fn((row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      });
      b.upsert = vi.fn((row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      });
      return b;
    },
  }),
}));

async function runCron() {
  const { GET } = await import("@/app/api/cron/sync-whop/route");
  return GET(new Request("https://numenmachines.com/api/cron/sync-whop") as never);
}

beforeEach(() => {
  vi.resetModules();
  rows = [];
  updates = [];
  inserts = [];
  vi.stubEnv("WHOP_API_KEY", "test-key");
  vi.stubEnv("WHOP_TRIAL_PLAN_ID_STARTER", TRIAL_SKU);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(whopMembership), { status: 200 }))
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/cron/sync-whop", () => {
  it("repairs a row that drifted out of sync with Whop", async () => {
    // Supabase thinks they are gone; Whop says they are paying. The cron's whole job.
    rows = [{ user_id: "u1", whop_membership_id: MEMBERSHIP, virtuna_tier: "free", status: "cancelled" }];
    whopMembership = {
      id: MEMBERSHIP,
      status: "active",
      plan: { id: TRIAL_SKU },
      renewal_period_end: "2026-08-30T10:19:45.367Z",
    };

    const res = await runCron();

    await expect(res.json()).resolves.toMatchObject({ synced: 1, total: 1 });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ virtuna_tier: "starter", status: "active" });
    expect(updates[0]?.last_synced_at).toBeTruthy();
  });

  it("revokes a row Whop says is cancelled", async () => {
    rows = [{ user_id: "u1", whop_membership_id: MEMBERSHIP, virtuna_tier: "starter", status: "active" }];
    whopMembership = { id: MEMBERSHIP, status: "canceled", plan: { id: TRIAL_SKU }, renewal_period_end: null };

    await runCron();

    expect(updates[0]).toMatchObject({ virtuna_tier: "free", status: "cancelled" });
  });

  it("KEEPS the tier on past_due — a retryable card must not lock anyone out", async () => {
    rows = [{ user_id: "u1", whop_membership_id: MEMBERSHIP, virtuna_tier: "starter", status: "active" }];
    whopMembership = { id: MEMBERSHIP, status: "past_due", plan: { id: TRIAL_SKU }, renewal_period_end: null };

    await runCron();

    expect(updates[0]).toMatchObject({ virtuna_tier: "starter", status: "past_due" });
  });

  it("leaves a paying customer alone when the SKU matches no configured plan", async () => {
    // An unset WHOP_*_ID must never silently demote someone who is still paying.
    rows = [{ user_id: "u1", whop_membership_id: MEMBERSHIP, virtuna_tier: "starter", status: "active" }];
    whopMembership = { id: MEMBERSHIP, status: "active", plan: { id: "plan_unknown" }, renewal_period_end: null };

    const res = await runCron();

    expect(updates).toHaveLength(0);
    await expect(res.json()).resolves.toMatchObject({ synced: 0, total: 1 });
  });

  /**
   * KNOWN LIMIT — the net has a hole exactly where the 2026-07-27 outage was.
   *
   * A missed webhook means NO row (or a row with no membership id). The cron's driving query
   * filters on `whop_membership_id IS NOT NULL`, so there is nothing to iterate and nothing
   * to repair — it reports a clean run over zero rows. "0 errors" from this cron is not
   * evidence that every paying customer has their tier.
   *
   * Repairing it needs a Whop-side enumeration (list the company's memberships and reconcile
   * INTO Supabase), which is a different cron than this one. Until that exists, a
   * pay-and-get-nothing is only caught by a human.
   */
  it("CANNOT repair a missed webhook — there is no insert path (documents the gap)", async () => {
    rows = []; // the customer paid; the webhook 401'd; no row was ever written
    whopMembership = { id: MEMBERSHIP, status: "active", plan: { id: TRIAL_SKU } };

    const res = await runCron();

    expect(inserts).toHaveLength(0);
    // And it reports success while doing nothing about it — which is the dangerous part.
    await expect(res.json()).resolves.toMatchObject({ synced: 0, total: 0 });
  });
});
