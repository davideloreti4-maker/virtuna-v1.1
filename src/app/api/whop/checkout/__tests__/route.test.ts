import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The checkout resolver. What matters:
 *   1. ONE TRIAL PER ACCOUNT — an account that has ever opened a trial window
 *      (trial_used_at history, or a legacy trial_started_at) gets the FULL-PRICE SKU even
 *      when it asks for the trial, and the response says so (trialApplied=false,
 *      trialDenied=true) so the modal's heading matches the embed's price.
 *   2. A missing plan id is a 503, never a silent grant.
 *   3. `trialApplied` is what was RESOLVED, not what was requested — false too when the
 *      trial SKU env is unset and the resolver fell back to full price.
 */

const PRODUCT_STARTER = "prod_full_starter";
const TRIAL_STARTER = "plan_trial_starter";

// The subscription row the route reads; each test sets it.
let subRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "u1", email: "u1@test.local" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: subRow, error: null })),
    })),
  })),
}));

function mockWhopFetch() {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify({ id: "chk_123" }), { status: 200 });
    })
  );
  return calls;
}

async function post(body: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("http://test.local/api/whop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.resetModules();
  subRow = null;
  process.env.WHOP_PRODUCT_ID_STARTER = PRODUCT_STARTER;
  process.env.WHOP_TRIAL_PLAN_ID_STARTER = TRIAL_STARTER;
  process.env.WHOP_API_KEY = "test_key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.WHOP_PRODUCT_ID_STARTER;
  delete process.env.WHOP_TRIAL_PLAN_ID_STARTER;
  delete process.env.WHOP_API_KEY;
});

describe("POST /api/whop/checkout — one trial per account", () => {
  it("sells a first-time trial the $1 SKU and says trialApplied", async () => {
    const calls = mockWhopFetch();
    subRow = null; // never subscribed, never trialed

    const res = await post({ planId: "starter", trial: true });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls[0]!.body.plan_id).toBe(TRIAL_STARTER);
    expect(json.trialApplied).toBe(true);
    expect(json.trialDenied).toBe(false);
  });

  it("denies a SECOND trial — trial_used_at history wins over the request", async () => {
    const calls = mockWhopFetch();
    subRow = { trial_used_at: "2026-06-01T00:00:00Z" }; // trialed before, window long gone

    const res = await post({ planId: "starter", trial: true });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls[0]!.body.plan_id).toBe(PRODUCT_STARTER); // full price, quietly
    expect(json.trialApplied).toBe(false);
    expect(json.trialDenied).toBe(true);
  });

  it("treats a legacy trial_started_at as used too (pre-migration rows)", async () => {
    const calls = mockWhopFetch();
    subRow = { trial_started_at: "2026-07-01T00:00:00Z" };

    const res = await post({ planId: "starter", trial: true });
    const json = await res.json();

    expect(calls[0]!.body.plan_id).toBe(PRODUCT_STARTER);
    expect(json.trialDenied).toBe(true);
  });

  it("reports trialApplied=false when the trial SKU env is unset (full-price fallback)", async () => {
    const calls = mockWhopFetch();
    delete process.env.WHOP_TRIAL_PLAN_ID_STARTER;
    subRow = null;

    const res = await post({ planId: "starter", trial: true });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(calls[0]!.body.plan_id).toBe(PRODUCT_STARTER); // never undercharge
    expect(json.trialApplied).toBe(false); // …and never SAY $1 when it isn't
    expect(json.trialDenied).toBe(false); // not a denial — a config gap
  });

  it("503s when the plan has no Whop id at all — never a silent grant", async () => {
    mockWhopFetch();
    delete process.env.WHOP_PRODUCT_ID_STARTER;
    delete process.env.WHOP_TRIAL_PLAN_ID_STARTER;

    const res = await post({ planId: "starter", trial: false });
    expect(res.status).toBe(503);
  });

  it("400s an unknown plan id", async () => {
    mockWhopFetch();
    const res = await post({ planId: "enterprise", trial: false });
    expect(res.status).toBe(400);
  });
});
