import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  checkCreditQuota,
  currentPeriodStart,
  currentUtcDayStart,
  isQuotaEnforced,
  isTrialActive,
  type TrialWindow,
} from "../quota";
import { CREDIT_COSTS, UNLIMITED_DAILY_CREDIT_CEILING } from "@/lib/pricing";

/**
 * The credit meter. The properties that matter:
 *   1. INERT until BILLING_ENFORCE_QUOTA=true (no Whop plans exist yet, so enforcing would
 *      lock out every existing user — all of whom are tier `free`),
 *   2. it FAILS OPEN — a flaky count must never cost a paying customer their action,
 *   3. the $1 TRIAL POOL (50 credits, every plan) wins over the plan's allowance — the leech
 *      guard. Without it $1 buys 1,500 Pro credits, or unlimited on Studio,
 *   4. admission is COST-AWARE: 3 credits left affords a 1-credit hooks pack, not a
 *      10-credit Reading, and
 *   5. "unlimited" (Studio) sits on a fair-use daily ceiling, not on nothing.
 */

const READING = CREDIT_COSTS.score; // 10
const HOOKS = CREDIT_COSTS.hooks; // 1

/**
 * A Supabase stub for the three meter paths:
 *   rpc            — `credits_used_since` (the real meter),
 *   readingEvents  — the ledger HEAD-count fallback (credits migration missing),
 *   analysisResults— the legacy count (ledger missing entirely).
 * "missing" = the relevant migration has not been applied; "boom" = a real error.
 */
function stubClient(opts: {
  rpc?: number | "missing" | "boom";
  readingEvents?: number | "missing" | "boom";
  analysisResults?: number;
}) {
  const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => {
    if (opts.rpc === "missing") {
      return Promise.resolve({
        data: null,
        error: { code: "PGRST202", message: "function credits_used_since not found" },
      });
    }
    if (opts.rpc === "boom") {
      return Promise.resolve({ data: null, error: { code: "08006", message: "conn lost" } });
    }
    return Promise.resolve({ data: opts.rpc ?? 0, error: null });
  });

  const calls: string[] = [];
  const builderFor = (table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn(() => {
      if (table === "reading_events") {
        if (opts.readingEvents === "missing") {
          return Promise.resolve({
            count: null,
            error: { code: "42P01", message: 'relation "reading_events" does not exist' },
          });
        }
        if (opts.readingEvents === "boom") {
          return Promise.resolve({ count: null, error: { code: "08006", message: "conn lost" } });
        }
        return Promise.resolve({ count: opts.readingEvents ?? 0, error: null });
      }
      return Promise.resolve({ count: opts.analysisResults ?? 0, error: null });
    }),
  });

  const builders: Record<string, ReturnType<typeof builderFor>> = {};
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      calls.push(table);
      builders[table] ??= builderFor(table);
      return builders[table]!;
    }),
  } as unknown as SupabaseClient;

  return { client, rpc, calls, builders };
}

const NOW = new Date("2026-07-13T12:00:00Z");
/** A trial that started an hour ago and runs the full 3 days. */
const ACTIVE_TRIAL: TrialWindow = {
  trialStartedAt: new Date("2026-07-13T11:00:00Z"),
  trialEndsAt: new Date("2026-07-16T11:00:00Z"),
};
/** A trial that has already converted. */
const EXPIRED_TRIAL: TrialWindow = {
  trialStartedAt: new Date("2026-07-01T10:00:00Z"),
  trialEndsAt: new Date("2026-07-04T10:00:00Z"),
};
const NO_TRIAL: TrialWindow = { trialStartedAt: null, trialEndsAt: null };

const ORIGINAL_FLAG = process.env.BILLING_ENFORCE_QUOTA;

beforeEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = "true"; // enforcement ON unless a test says otherwise
});
afterEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

describe("the $1 trial pool — 50 credits, every plan (leech guard)", () => {
  it("caps a Creator trial at 50 credits, not the plan's 500", async () => {
    const { client: c1 } = stubClient({ rpc: 40 });
    const at40 = await checkCreditQuota(c1, "u1", "starter", READING, ACTIVE_TRIAL, NOW);
    expect(at40.limit).toBe(50);
    expect(at40.inTrial).toBe(true);
    expect(at40.allowed).toBe(true); // 40 + 10 fits exactly

    const { client: c2 } = stubClient({ rpc: 41 });
    const at41 = await checkCreditQuota(c2, "u1", "starter", READING, ACTIVE_TRIAL, NOW);
    expect(at41.allowed).toBe(false); // the 6th Reading of a $1 trial is refused
    expect(at41.reason).toBe("allowance");
  });

  it("caps a Pro trial at 50, not 1,500 — $1 must not buy ~$22 of engine spend", async () => {
    const { client } = stubClient({ rpc: 50 });
    const verdict = await checkCreditQuota(client, "u1", "pro", READING, ACTIVE_TRIAL, NOW);
    expect(verdict.limit).toBe(50);
    expect(verdict.allowed).toBe(false);
  });

  it("caps a STUDIO trial at 50 — 'unlimited' must never leak into a trial", async () => {
    // The nastiest hole: Studio's allowance is null (unlimited), and null routes to the
    // fair-use path. If the trial cap did not win, $1 would buy 300 credits every day.
    const { client } = stubClient({ rpc: 50 });
    const verdict = await checkCreditQuota(client, "u1", "studio", READING, ACTIVE_TRIAL, NOW);
    expect(verdict.limit).toBe(50);
    expect(verdict.inTrial).toBe(true);
    expect(verdict.allowed).toBe(false);
  });

  it("counts the trial pool from the TRIAL's start, not the 1st of the month", async () => {
    const { client, rpc } = stubClient({ rpc: 0 });
    await checkCreditQuota(client, "u1", "pro", READING, ACTIVE_TRIAL, NOW);
    expect(rpc).toHaveBeenCalledWith("credits_used_since", {
      p_user_id: "u1",
      p_since: ACTIVE_TRIAL.trialStartedAt!.toISOString(),
    });
  });

  it("hands back the FULL plan allowance once the trial has converted", async () => {
    const { client } = stubClient({ rpc: 600 });
    const verdict = await checkCreditQuota(client, "u1", "pro", READING, EXPIRED_TRIAL, NOW);
    expect(verdict.inTrial).toBe(false);
    expect(verdict.limit).toBe(1500); // not 50 — a paying Pro is not still on the trial pool
    expect(verdict.allowed).toBe(true);
  });

  it("restores Studio's unlimited (fair-use) after the trial converts", async () => {
    const { client } = stubClient({ rpc: 0 });
    const verdict = await checkCreditQuota(client, "u1", "studio", READING, EXPIRED_TRIAL, NOW);
    expect(verdict.limit).toBeNull();
    expect(verdict.allowed).toBe(true);
  });
});

describe("trial window", () => {
  it("is active only between its start and end", () => {
    expect(isTrialActive(ACTIVE_TRIAL, NOW)).toBe(true);
    expect(isTrialActive(EXPIRED_TRIAL, NOW)).toBe(false);
    expect(isTrialActive(NO_TRIAL, NOW)).toBe(false);
    // The instant it ends, it is over.
    expect(isTrialActive(ACTIVE_TRIAL, ACTIVE_TRIAL.trialEndsAt!)).toBe(false);
  });
});

describe("monthly allowances (outside a trial)", () => {
  it("allows a Creator their 500th credit and blocks the 501st", async () => {
    const { client: c1 } = stubClient({ rpc: 490 });
    const at490 = await checkCreditQuota(c1, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(at490.allowed).toBe(true);
    expect(at490.limit).toBe(500);

    const { client: c2 } = stubClient({ rpc: 491 });
    const at491 = await checkCreditQuota(c2, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(at491.allowed).toBe(false);
    expect(at491.reason).toBe("allowance");
  });

  it("is COST-AWARE: 3 credits left affords a hooks pack, not a Reading", async () => {
    const { client: c1 } = stubClient({ rpc: 497 });
    const hooks = await checkCreditQuota(c1, "u1", "starter", HOOKS, NO_TRIAL, NOW);
    expect(hooks.allowed).toBe(true); // 497 + 1 ≤ 500

    const { client: c2 } = stubClient({ rpc: 497 });
    const reading = await checkCreditQuota(c2, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(reading.allowed).toBe(false); // 497 + 10 > 500
  });

  it("gives Pro 1,500", async () => {
    const { client: c1 } = stubClient({ rpc: 1490 });
    expect((await checkCreditQuota(c1, "u1", "pro", READING, NO_TRIAL, NOW)).allowed).toBe(true);
    const { client: c2 } = stubClient({ rpc: 1491 });
    expect((await checkCreditQuota(c2, "u1", "pro", READING, NO_TRIAL, NOW)).allowed).toBe(false);
  });

  it("blocks `free` at zero — there is no free plan to farm", async () => {
    const { client } = stubClient({ rpc: 0 });
    const verdict = await checkCreditQuota(client, "u1", "free", HOOKS, NO_TRIAL, NOW);
    expect(verdict.limit).toBe(0);
    expect(verdict.allowed).toBe(false);
  });
});

describe("Studio 'unlimited' — the fair-use daily ceiling", () => {
  it("allows up to the ceiling and refuses past it, with reason=fair_use", async () => {
    const { client: c1 } = stubClient({ rpc: UNLIMITED_DAILY_CREDIT_CEILING - READING });
    const atCeiling = await checkCreditQuota(c1, "u1", "studio", READING, NO_TRIAL, NOW);
    expect(atCeiling.allowed).toBe(true); // 290 + 10 = 300 fits exactly
    expect(atCeiling.limit).toBeNull(); // still sold as unlimited

    const { client: c2 } = stubClient({ rpc: UNLIMITED_DAILY_CREDIT_CEILING - READING + 1 });
    const past = await checkCreditQuota(c2, "u1", "studio", READING, NO_TRIAL, NOW);
    expect(past.allowed).toBe(false);
    expect(past.reason).toBe("fair_use"); // the paywall says "resets at midnight UTC", not "upgrade"
  });

  it("measures TODAY (midnight UTC), not the billing period", async () => {
    const { client, rpc } = stubClient({ rpc: 0 });
    await checkCreditQuota(client, "u1", "studio", READING, NO_TRIAL, NOW);
    expect(rpc).toHaveBeenCalledWith("credits_used_since", {
      p_user_id: "u1",
      p_since: "2026-07-13T00:00:00.000Z",
    });
  });

  it("fails OPEN when the fair-use count blows up", async () => {
    const { client } = stubClient({ rpc: "boom" });
    const verdict = await checkCreditQuota(client, "u1", "studio", READING, NO_TRIAL, NOW);
    expect(verdict.allowed).toBe(true);
  });
});

describe("safety", () => {
  it("FAILS OPEN when the count blows up — a DB blip must not cost a paid action", async () => {
    const { client } = stubClient({ rpc: "boom" });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(verdict.allowed).toBe(true);
  });

  it("is INERT while the flag is off: it still measures, but reports enforced=false", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const { client } = stubClient({ rpc: 9999 });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(isQuotaEnforced()).toBe(false);
    expect(verdict.enforced).toBe(false); // → the route lets it through
    expect(verdict.allowed).toBe(false); // → but the truth is still recorded
    expect(verdict.used).toBe(9999);
  });
});

describe("billing period", () => {
  it("falls back to the 1st of the calendar month when there is no subscription to anchor to", () => {
    expect(currentPeriodStart(new Date("2026-07-13T09:41:00Z")).toISOString()).toBe(
      "2026-07-01T00:00:00.000Z"
    );
  });

  it("anchors on the BILLING date, not the 1st — subscribe on the 28th and you get one month", () => {
    // The bug this replaces: the period reset on the 1st, so someone who subscribed on the 28th
    // got a whole fresh allowance three days later, every month, for free.
    const renews = new Date("2026-08-28T14:30:00Z");

    // The 30th: this period began on the 28th of THIS month.
    expect(currentPeriodStart(new Date("2026-07-30T09:00:00Z"), renews).toISOString()).toBe(
      "2026-07-28T14:30:00.000Z"
    );

    // The 5th: the anchor has not come round yet this month, so the period began LAST month.
    expect(currentPeriodStart(new Date("2026-07-05T09:00:00Z"), renews).toISOString()).toBe(
      "2026-06-28T14:30:00.000Z"
    );
  });

  it("does not roll over early on the renewal day itself", () => {
    // Renewal at 14:00; at 09:00 that morning the period has NOT reset yet. Anchoring at
    // midnight would hand out the next allowance up to a day early.
    const renews = new Date("2026-07-28T14:00:00Z");
    expect(currentPeriodStart(new Date("2026-07-28T09:00:00Z"), renews).toISOString()).toBe(
      "2026-06-28T14:00:00.000Z"
    );
    // ...and at 14:00 sharp it does.
    expect(currentPeriodStart(new Date("2026-07-28T14:00:00Z"), renews).toISOString()).toBe(
      "2026-07-28T14:00:00.000Z"
    );
  });

  it("clamps a 31st anchor into short months instead of spilling into the next one", () => {
    const renews = new Date("2026-01-31T00:00:00Z");
    // February has no 31st: the period starts on the 28th, NOT on 3 March.
    expect(currentPeriodStart(new Date("2026-02-27T12:00:00Z"), renews).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z"
    );
    expect(currentPeriodStart(new Date("2026-03-01T12:00:00Z"), renews).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    );
  });

  it("walks back to the most recent anchor even when current_period_end is stale", () => {
    // A row Whop hasn't refreshed. Naively doing "period end minus one month" would open a
    // window months wide and let a customer's usage accumulate against one allowance.
    const stale = new Date("2026-03-10T00:00:00Z");
    expect(currentPeriodStart(new Date("2026-07-13T00:00:00Z"), stale).toISOString()).toBe(
      "2026-07-10T00:00:00.000Z"
    );
  });

  it("counts the plan's allowance from the billing anchor", async () => {
    const { client, rpc } = stubClient({ rpc: 0 });
    await checkCreditQuota(
      client,
      "u1",
      "starter",
      READING,
      NO_TRIAL,
      NOW,
      new Date("2026-07-28T14:00:00Z")
    );
    expect(rpc).toHaveBeenCalledWith("credits_used_since", {
      p_user_id: "u1",
      p_since: "2026-06-28T14:00:00.000Z",
    });
  });

  it("computes midnight UTC for the fair-use window", () => {
    expect(currentUtcDayStart(new Date("2026-07-13T23:59:59Z")).toISOString()).toBe(
      "2026-07-13T00:00:00.000Z"
    );
    expect(currentUtcDayStart(new Date("2026-07-13T00:00:00Z")).toISOString()).toBe(
      "2026-07-13T00:00:00.000Z"
    );
  });
});

describe("the meter's fallback chain — RPC → ledger count × 10 → legacy count × 10", () => {
  it("sums credits via the RPC and never touches a table when it answers", async () => {
    const { client, calls } = stubClient({ rpc: 37 });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(verdict.used).toBe(37);
    expect(calls).toEqual([]); // no table reads on the happy path
  });

  it("falls back to ledger COUNT × 10 when the credits migration is missing", async () => {
    // Every pre-credits ledger row was a full Reading, so count × 10 is exact, not a guess.
    const { client, calls, builders } = stubClient({ rpc: "missing", readingEvents: 3 });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(calls).toContain("reading_events");
    expect(calls).not.toContain("analysis_results");
    expect(builders.reading_events!.eq).toHaveBeenCalledWith("billed", true);
    expect(verdict.used).toBe(30);
  });

  it("falls back to the legacy analysis_results count × 10 when the ledger doesn't exist", async () => {
    const { client, calls } = stubClient({
      rpc: "missing",
      readingEvents: "missing",
      analysisResults: 12,
    });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(calls).toEqual(["reading_events", "analysis_results"]);
    expect(verdict.used).toBe(120);
    expect(verdict.allowed).toBe(true); // 120 + 10 ≤ 500
  });

  it("does NOT substitute a fallback for a real ledger error — it fails open instead", async () => {
    // Silently swapping in a different (higher) number could block a customer who is within
    // their plan. A transient error must cost us an action, never them.
    const { client, calls } = stubClient({ rpc: "missing", readingEvents: "boom" });
    const verdict = await checkCreditQuota(client, "u1", "starter", READING, NO_TRIAL, NOW);
    expect(calls).not.toContain("analysis_results");
    expect(verdict.allowed).toBe(true);
    expect(verdict.used).toBe(0);
  });
});
