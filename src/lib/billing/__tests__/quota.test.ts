import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  checkReadingQuota,
  currentPeriodStart,
  isQuotaEnforced,
  isTrialActive,
  type TrialWindow,
} from "../quota";

/**
 * The Reading meter. The properties that matter:
 *   1. INERT until BILLING_ENFORCE_QUOTA=true (no Whop plans exist yet, so enforcing would
 *      lock out every existing user — all of whom are tier `free`),
 *   2. it FAILS OPEN — a flaky count must never cost a paying customer a Reading, and
 *   3. the $1 TRIAL POOL (5 Readings, every plan) wins over the plan's allowance — the leech
 *      guard. Without it $1 buys 150 Pro Readings, or unlimited on Studio.
 */

/** A Supabase stub whose HEAD count resolves to `count` (or throws). */
function stubClient(result: { count?: number; throws?: boolean }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn(() => {
      if (result.throws) return Promise.reject(new Error("db down"));
      return Promise.resolve({ count: result.count ?? 0, error: null });
    }),
  };
  return { from: vi.fn(() => builder), _builder: builder } as unknown as SupabaseClient & {
    _builder: typeof builder;
  };
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

describe("the $1 trial pool — 5 Readings, every plan (leech guard)", () => {
  it("caps a Creator trial at 5, not the plan's 50", async () => {
    const at4 = await checkReadingQuota(stubClient({ count: 4 }), "u1", "starter", ACTIVE_TRIAL, NOW);
    expect(at4.limit).toBe(5);
    expect(at4.inTrial).toBe(true);
    expect(at4.allowed).toBe(true);

    const at5 = await checkReadingQuota(stubClient({ count: 5 }), "u1", "starter", ACTIVE_TRIAL, NOW);
    expect(at5.allowed).toBe(false); // the 6th Reading of a $1 trial is refused
  });

  it("caps a Pro trial at 5, not 150 — $1 must not buy ~$22 of engine spend", async () => {
    const verdict = await checkReadingQuota(stubClient({ count: 5 }), "u1", "pro", ACTIVE_TRIAL, NOW);
    expect(verdict.limit).toBe(5);
    expect(verdict.allowed).toBe(false);
  });

  it("caps a STUDIO trial at 5 — 'unlimited' must never leak into a trial", async () => {
    // The nastiest hole: Studio's allowance is null (unlimited), and null short-circuits the
    // count. If the trial cap did not win, $1 would buy unbounded Readings.
    const verdict = await checkReadingQuota(stubClient({ count: 5 }), "u1", "studio", ACTIVE_TRIAL, NOW);
    expect(verdict.limit).toBe(5);
    expect(verdict.inTrial).toBe(true);
    expect(verdict.allowed).toBe(false);
  });

  it("counts the trial pool from the TRIAL's start, not the 1st of the month", async () => {
    const client = stubClient({ count: 0 });
    await checkReadingQuota(client, "u1", "pro", ACTIVE_TRIAL, NOW);
    // The window handed to the count query is the trial start, not 2026-07-01.
    expect(client._builder.gte).toHaveBeenCalledWith(
      "created_at",
      ACTIVE_TRIAL.trialStartedAt!.toISOString()
    );
  });

  it("hands back the FULL plan allowance once the trial has converted", async () => {
    const verdict = await checkReadingQuota(stubClient({ count: 60 }), "u1", "pro", EXPIRED_TRIAL, NOW);
    expect(verdict.inTrial).toBe(false);
    expect(verdict.limit).toBe(150); // not 5 — a paying Pro is not still on the trial pool
    expect(verdict.allowed).toBe(true);
  });

  it("restores Studio's unlimited after the trial converts", async () => {
    const verdict = await checkReadingQuota(stubClient({ count: 9_999 }), "u1", "studio", EXPIRED_TRIAL, NOW);
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
  it("allows a Creator their 50th Reading and blocks the 51st", async () => {
    const at49 = await checkReadingQuota(stubClient({ count: 49 }), "u1", "starter", NO_TRIAL, NOW);
    expect(at49.allowed).toBe(true);
    expect(at49.limit).toBe(50);

    const at50 = await checkReadingQuota(stubClient({ count: 50 }), "u1", "starter", NO_TRIAL, NOW);
    expect(at50.allowed).toBe(false);
  });

  it("gives Pro 150", async () => {
    expect((await checkReadingQuota(stubClient({ count: 149 }), "u1", "pro", NO_TRIAL, NOW)).allowed).toBe(true);
    expect((await checkReadingQuota(stubClient({ count: 150 }), "u1", "pro", NO_TRIAL, NOW)).allowed).toBe(false);
  });

  it("never blocks Studio — unlimited, and it does not even run the count", async () => {
    const client = stubClient({ count: 10_000 });
    const verdict = await checkReadingQuota(client, "u1", "studio", NO_TRIAL, NOW);
    expect(verdict.allowed).toBe(true);
    expect(verdict.limit).toBeNull();
    expect(client.from).not.toHaveBeenCalled(); // no wasted query on the hot path
  });

  it("blocks `free` at zero — there is no free plan to farm", async () => {
    const verdict = await checkReadingQuota(stubClient({ count: 0 }), "u1", "free", NO_TRIAL, NOW);
    expect(verdict.limit).toBe(0);
    expect(verdict.allowed).toBe(false);
  });
});

describe("safety", () => {
  it("FAILS OPEN when the count blows up — a DB blip must not cost a paid Reading", async () => {
    const verdict = await checkReadingQuota(stubClient({ throws: true }), "u1", "starter", NO_TRIAL, NOW);
    expect(verdict.allowed).toBe(true);
  });

  it("is INERT while the flag is off: it still measures, but reports enforced=false", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const verdict = await checkReadingQuota(stubClient({ count: 999 }), "u1", "starter", NO_TRIAL, NOW);
    expect(isQuotaEnforced()).toBe(false);
    expect(verdict.enforced).toBe(false); // → the route lets it through
    expect(verdict.allowed).toBe(false); // → but the truth is still recorded
    expect(verdict.used).toBe(999);
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
    const client = stubClient({ count: 0 });
    await checkReadingQuota(client, "u1", "starter", NO_TRIAL, NOW, new Date("2026-07-28T14:00:00Z"));
    expect(client._builder.gte).toHaveBeenCalledWith("created_at", "2026-06-28T14:00:00.000Z");
  });
});

describe("the ledger — a Reading is an event, not a row", () => {
  /**
   * A client that can answer differently per table, so the ledger and the legacy fallback can
   * be told apart. `readingEvents: "missing"` = the migration hasn't been applied yet.
   */
  function stubTables(opts: {
    readingEvents?: number | "missing" | "boom";
    analysisResults?: number;
  }) {
    const calls: string[] = [];
    const builderFor = (table: string) => {
      const b = {
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
      };
      return b;
    };
    const builders: Record<string, ReturnType<typeof builderFor>> = {};
    const client = {
      from: vi.fn((table: string) => {
        calls.push(table);
        builders[table] ??= builderFor(table);
        return builders[table]!;
      }),
    } as unknown as SupabaseClient;
    return { client, calls, builders };
  }

  it("counts BILLED ledger events, ignoring unbilled ones", async () => {
    const { client, calls, builders } = stubTables({ readingEvents: 3 });
    const verdict = await checkReadingQuota(client, "u1", "starter", NO_TRIAL, NOW);

    expect(calls).toContain("reading_events");
    expect(calls).not.toContain("analysis_results"); // the ledger answered; no fallback
    expect(builders.reading_events!.eq).toHaveBeenCalledWith("billed", true);
    expect(verdict.used).toBe(3);
  });

  it("falls back to the legacy analysis_results count when the ledger table does not exist yet", async () => {
    // The owner has not run 20260713160000 — behaviour must be exactly what it was before it.
    const { client, calls } = stubTables({ readingEvents: "missing", analysisResults: 12 });
    const verdict = await checkReadingQuota(client, "u1", "starter", NO_TRIAL, NOW);

    expect(calls).toEqual(["reading_events", "analysis_results"]);
    expect(verdict.used).toBe(12);
    expect(verdict.allowed).toBe(true);
  });

  it("does NOT substitute the legacy count for a real ledger error — it fails open instead", async () => {
    // Silently swapping in a different (higher) number could block a customer who is within
    // their plan. A transient error must cost us a Reading, never them.
    const { client, calls } = stubTables({ readingEvents: "boom", analysisResults: 999 });
    const verdict = await checkReadingQuota(client, "u1", "starter", NO_TRIAL, NOW);

    expect(calls).not.toContain("analysis_results");
    expect(verdict.allowed).toBe(true);
    expect(verdict.used).toBe(0);
  });
});
