import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { creditGate, quotaRefusalMessage, quotaRefusalBody } from "../credit-gate";
import { isCreditQuotaExceeded } from "../quota-error";
import type { QuotaVerdict } from "../quota";

/**
 * The gate every paid route calls. What matters:
 *   1. a refusal is a 402 whose body the client-side type-guard recognises,
 *   2. the four walls get four DIFFERENT sentences (trial ≠ no-plan ≠ spent ≠ fair-use),
 *   3. no enforcement → no refusal, whatever the numbers say.
 */

const ORIGINAL_FLAG = process.env.BILLING_ENFORCE_QUOTA;

beforeEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = "true";
});
afterEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

/** A client whose subscription row and credit sum are canned. */
function stubClient(row: Record<string, unknown> | null, creditsUsed: number) {
  return {
    rpc: vi.fn(() => Promise.resolve({ data: creditsUsed, error: null })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
    })),
  } as unknown as SupabaseClient;
}

describe("creditGate", () => {
  it("refuses a spent allowance with a 402 the client type-guard recognises", async () => {
    const client = stubClient({ virtuna_tier: "starter" }, 500);
    const { refusal, verdict } = await creditGate(client, "u1", "hooks");

    expect(refusal).not.toBeNull();
    expect(refusal!.status).toBe(402);
    const body = await refusal!.json();
    expect(isCreditQuotaExceeded(body)).toBe(true);
    expect(body.cost).toBe(1);
    expect(verdict.tier).toBe("starter");
  });

  it("lets an affordable action through and hands back the verdict for billing", async () => {
    const client = stubClient({ virtuna_tier: "pro" }, 100);
    const { refusal, verdict } = await creditGate(client, "u1", "score");
    expect(refusal).toBeNull();
    expect(verdict.tier).toBe("pro"); // the success path stamps this on the ledger row
  });

  it("never refuses while enforcement is off", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const client = stubClient({ virtuna_tier: "free" }, 0);
    const { refusal, verdict } = await creditGate(client, "u1", "score");
    expect(refusal).toBeNull(); // free/0 would be refused if the flag were on…
    expect(verdict.allowed).toBe(false); // …and the verdict says so honestly
  });
});

describe("the four walls get four different sentences", () => {
  const base: QuotaVerdict = {
    enforced: true,
    allowed: false,
    used: 500,
    limit: 500,
    tier: "starter",
    inTrial: false,
    reason: "allowance",
    periodStart: new Date("2026-07-01T00:00:00Z"),
    renewsAt: new Date("2026-08-01T00:00:00Z"),
  };

  it("trial → a date, in trial vocabulary", () => {
    const msg = quotaRefusalMessage({ ...base, inTrial: true, limit: 50 });
    expect(msg).toContain("$1 trial");
    expect(msg).toContain("50 credits");
  });

  it("fair-use → midnight UTC, never an upsell", () => {
    const msg = quotaRefusalMessage({ ...base, tier: "studio", limit: null, reason: "fair_use" });
    expect(msg).toContain("fair-use");
    expect(msg).toContain("midnight UTC");
    expect(msg.toLowerCase()).not.toContain("upgrade");
  });

  it("no plan → the $1 door in", () => {
    const msg = quotaRefusalMessage({ ...base, tier: "free", limit: 0 });
    expect(msg).toContain("Start a plan");
    expect(msg).toContain("$1 trial");
  });

  it("plan spent → the number they bought", () => {
    const msg = quotaRefusalMessage(base);
    expect(msg).toContain("all 500 credits");
  });

  it("admission block → the action's price against what's left, never 'used all'", () => {
    // 497 of 500 used, a 10-credit Reading refused: the balance line next to the dialog
    // says "3 of 500 credits left", so this sentence must agree with it.
    const msg = quotaRefusalMessage({ ...base, used: 497 }, 10);
    expect(msg).toContain("10 credits");
    expect(msg).toContain("3 credits left");
    expect(msg).not.toContain("used all");
  });

  it("a genuinely spent allowance still reads 'used all', even with a cost", () => {
    const msg = quotaRefusalMessage(base, 10);
    expect(msg).toContain("all 500 credits");
  });

  it("the body carries reason + cost so the wall can adapt", () => {
    const body = quotaRefusalBody({ ...base, reason: "fair_use", limit: null }, 10);
    expect(body.reason).toBe("fair_use");
    expect(body.cost).toBe(10);
    expect(body.error).toBe("credit_quota_exceeded");
  });
});
