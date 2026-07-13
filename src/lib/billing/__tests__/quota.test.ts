import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { checkReadingQuota, currentPeriodStart, isQuotaEnforced } from "../quota";

/**
 * The Reading meter. Two properties matter more than anything else here:
 *   1. it is INERT until BILLING_ENFORCE_QUOTA=true (no Whop plans exist yet, so enforcing
 *      would lock out every existing user — all of whom are tier `free`), and
 *   2. it FAILS OPEN — a flaky count must never cost a paying customer a Reading.
 */

/** A Supabase stub whose count query resolves to `count` (or throws). */
function stubClient(result: { count?: number; error?: unknown; throws?: boolean }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn(() => {
      if (result.throws) return Promise.reject(new Error("db down"));
      return Promise.resolve({ count: result.count ?? 0, error: result.error ?? null });
    }),
  };
  return { from: vi.fn(() => builder) } as unknown as SupabaseClient;
}

const ORIGINAL_FLAG = process.env.BILLING_ENFORCE_QUOTA;

beforeEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = "true"; // enforcement ON unless a test says otherwise
});
afterEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

describe("reading quota", () => {
  it("allows a Creator their 50th Reading and blocks the 51st", async () => {
    const at49 = await checkReadingQuota(stubClient({ count: 49 }), "u1", "starter");
    expect(at49.allowed).toBe(true);
    expect(at49.limit).toBe(50);

    const at50 = await checkReadingQuota(stubClient({ count: 50 }), "u1", "starter");
    expect(at50.allowed).toBe(false); // 50 used = allowance spent; the NEXT one is over
    expect(at50.used).toBe(50);
  });

  it("gives Pro 150", async () => {
    expect((await checkReadingQuota(stubClient({ count: 149 }), "u1", "pro")).allowed).toBe(true);
    expect((await checkReadingQuota(stubClient({ count: 150 }), "u1", "pro")).allowed).toBe(false);
  });

  it("never blocks Studio — unlimited, and it does not even run the count", async () => {
    const client = stubClient({ count: 10_000 });
    const verdict = await checkReadingQuota(client, "u1", "studio");
    expect(verdict.allowed).toBe(true);
    expect(verdict.limit).toBeNull();
    expect(client.from).not.toHaveBeenCalled(); // no wasted query on the hot path
  });

  it("blocks `free` at zero — there is no free plan to farm", async () => {
    const verdict = await checkReadingQuota(stubClient({ count: 0 }), "u1", "free");
    expect(verdict.limit).toBe(0);
    expect(verdict.allowed).toBe(false);
  });

  it("FAILS OPEN when the count blows up — a DB blip must not cost a paid Reading", async () => {
    const verdict = await checkReadingQuota(stubClient({ throws: true }), "u1", "starter");
    expect(verdict.allowed).toBe(true);
  });

  it("is INERT while the flag is off: it still measures, but reports enforced=false", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const verdict = await checkReadingQuota(stubClient({ count: 999 }), "u1", "starter");
    expect(isQuotaEnforced()).toBe(false);
    expect(verdict.enforced).toBe(false); // → the route lets it through
    expect(verdict.allowed).toBe(false); // → but the truth is still recorded
    expect(verdict.used).toBe(999);
  });
});

describe("billing period", () => {
  it("resets on the 1st of the calendar month (UTC)", () => {
    const start = currentPeriodStart(new Date("2026-07-13T09:41:00Z"));
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
