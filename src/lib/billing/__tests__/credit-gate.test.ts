import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { creditGate, quotaRefusalMessage, quotaRefusalBody } from "../credit-gate";
import { isCreditQuotaExceeded } from "../quota-error";
import type { QuotaVerdict } from "../quota";
import { DEMO_CREDITS } from "@/lib/pricing";

/**
 * The gate every paid route calls. What matters:
 *   1. a refusal is a 402 whose body the client-side type-guard recognises,
 *   2. each wall gets its OWN sentence (trial ≠ no-plan ≠ spent ≠ fair-use ≠ demo ≠ trial-required),
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

/** The gate takes the USER — `is_anonymous` is part of the identity, not an optional flag. */
const U1 = { id: "u1" };
/** A `/go` funnel visitor: signed in anonymously, no plan, one free Test owing. */
const ANON = { id: "anon-1", is_anonymous: true };

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

/**
 * The demo's meter is a RUN COUNT (delivered `reading_events` rows for the action), not a
 * credit sum, so the stub has to answer both: `priorRuns` for the ledger HEAD-count and
 * `credits` for the RPC — and the tests below assert WHICH one decided.
 */
function stubAnonClient(
  opts: { priorRuns?: number | "boom"; credits?: number; row?: Record<string, unknown> | null } = {}
) {
  const rpc = vi.fn(() => Promise.resolve({ data: opts.credits ?? 0, error: null }));
  const reads: string[] = [];

  const from = vi.fn((table: string) => {
    reads.push(table);
    if (table === "reading_events" || table === "analysis_results") {
      // A HEAD count is awaited off the builder itself — no terminal call to hang a mock on.
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.gte = () => builder;
      builder.then = (resolve: (v: unknown) => void) =>
        resolve(
          opts.priorRuns === "boom"
            ? { count: null, error: { code: "08006", message: "conn lost" } }
            : { count: opts.priorRuns ?? 0, error: null }
        );
      return builder;
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => Promise.resolve({ data: opts.row ?? null, error: null })),
    };
  });

  return { client: { rpc, from } as unknown as SupabaseClient, rpc, reads };
}

describe("creditGate", () => {
  it("refuses a spent allowance with a 402 the client type-guard recognises", async () => {
    const client = stubClient({ virtuna_tier: "starter" }, 500);
    const { refusal, verdict } = await creditGate(client, U1, "hooks");

    expect(refusal).not.toBeNull();
    expect(refusal!.status).toBe(402);
    const body = await refusal!.json();
    expect(isCreditQuotaExceeded(body)).toBe(true);
    expect(body.cost).toBe(1);
    expect(verdict.tier).toBe("starter");
  });

  it("lets an affordable action through and hands back the verdict for billing", async () => {
    const client = stubClient({ virtuna_tier: "pro" }, 100);
    const { refusal, verdict } = await creditGate(client, U1, "score");
    expect(refusal).toBeNull();
    expect(verdict.tier).toBe("pro"); // the success path stamps this on the ledger row
  });

  it("never refuses while enforcement is off", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const client = stubClient({ virtuna_tier: "free" }, 0);
    const { refusal, verdict } = await creditGate(client, U1, "score");
    expect(refusal).toBeNull(); // free/0 would be refused if the flag were on…
    expect(verdict.allowed).toBe(false); // …and the verdict says so honestly
  });
});

describe("the walls get different sentences — and different doors", () => {
  const base: QuotaVerdict = {
    enforced: true,
    allowed: false,
    used: 500,
    limit: 500,
    isDemo: false,
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

  it("anonymous demo spent → the $1, NOT the plan page", () => {
    // An anonymous visitor is tier `free` with a spent pool, which is exactly the shape the
    // "no plan → Start a plan" branch above matches. Sending the funnel's highest-intent
    // moment to a plan page instead of to checkout is the failure this guards.
    const msg = quotaRefusalMessage({
      ...base,
      tier: "free",
      isDemo: true,
      limit: DEMO_CREDITS,
      used: DEMO_CREDITS,
      reason: "demo_used",
    });
    expect(msg).toContain("free test");
    expect(msg).toContain("$1");
    expect(msg).not.toContain("Start a plan");
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

  it("an action that needs the trial sells the PLATFORM, and never says 'free test'", () => {
    // The visitor still has their free Test in hand — telling them they used it would be a
    // lie, and telling them to "start a plan" is the wrong door (the $1 trial is the door).
    const msg = quotaRefusalMessage(
      { ...base, tier: "free", isDemo: true, limit: DEMO_CREDITS, used: 0, reason: "trial_required" },
      1
    );
    expect(msg).toContain("$1");
    expect(msg).toContain("whole platform");
    expect(msg).toContain("3 days");
    expect(msg).not.toContain("free test");
    expect(msg).not.toContain("Start a plan");
  });

  it("the spent demo sells the same trial — the owner's framing, not a credit top-up", () => {
    const msg = quotaRefusalMessage({
      ...base,
      tier: "free",
      isDemo: true,
      limit: DEMO_CREDITS,
      used: DEMO_CREDITS,
      reason: "demo_used",
    });
    expect(msg).toContain("free test");
    expect(msg).toContain("whole platform");
    expect(msg).toContain("3 days");
  });
});

/**
 * THE DEMO ENTITLEMENT — one free Test, and the 3-day trial for everything else.
 *
 * Owner, 2026-07-27: *"we give the demo to the user for free but to unlock the complete
 * result/value they need to start their 3 day trial and unlock the complete platform."*
 *
 * The code diverged from that in two directions at once, and this block is the guard on both:
 *
 *   1. the demo was a 10-CREDIT WALLET (DEMO_CREDITS = the price of one Test) checked as
 *      `used + cost <= limit`, so ONE 1-credit Ideas tap made it 11 > 10 and the free Test was
 *      refused forever — with the words "That was your free test", to someone who never got
 *      one. The entitlement is now a RUN: exactly one delivered `score`, counted in the ledger,
 *      and nothing else can spend it.
 *   2. every OTHER action ran free and unmetered for an anonymous visitor, because the gate was
 *      never told they were anonymous (see the previous commit) and enforcement fell back to
 *      BILLING_ENFORCE_QUOTA. They now hit the trial wall — the thing the $1 is for.
 */
describe("the demo entitlement — one free Test, the trial for the rest", () => {
  /** Everything an anonymous visitor can reach from /home that is not the free Test. */
  const BEHIND_THE_TRIAL = [
    "ideas",
    "hooks",
    "script",
    "read",
    "refine",
    "explore",
    "predict",
    "simulate",
    "profile",
    "develop",
    "remix",
  ] as const;

  for (const action of BEHIND_THE_TRIAL) {
    it(`refuses "${action}" with the trial wall, not silence`, async () => {
      const { client } = stubAnonClient();
      const { refusal, verdict } = await creditGate(client, ANON, action);

      expect(refusal, `${action} must refuse an anonymous visitor`).not.toBeNull();
      expect(refusal!.status).toBe(402);
      const body = await refusal!.json();
      expect(isCreditQuotaExceeded(body)).toBe(true);
      expect(body.reason).toBe("trial_required");
      expect(verdict.isDemo).toBe(true);
    });
  }

  it("holds even with BILLING_ENFORCE_QUOTA off — that flag protects CUSTOMERS, not strangers", async () => {
    process.env.BILLING_ENFORCE_QUOTA = "false";
    const { client } = stubAnonClient();
    const { refusal } = await creditGate(client, ANON, "ideas");
    expect(refusal).not.toBeNull();
  });

  it("refuses without touching the meter — a wall is not a balance question", async () => {
    // No count means nothing to get wrong and nothing to fail open on. It also means the
    // refusal cannot be made to depend on how much the visitor has spent, which is the whole
    // bug: spend was what foreclosed the Test.
    const { client, rpc, reads } = stubAnonClient();
    await creditGate(client, ANON, "hooks");
    expect(rpc).not.toHaveBeenCalled();
    expect(reads).not.toContain("reading_events");
  });

  it("lets the free Test through — the one thing the demo IS", async () => {
    const { client } = stubAnonClient({ priorRuns: 0 });
    const { refusal, verdict } = await creditGate(client, ANON, "score");
    expect(refusal).toBeNull();
    expect(verdict.isDemo).toBe(true);
    expect(verdict.limit).toBe(DEMO_CREDITS);
  });

  it("refuses the SECOND Test — one run, counted in the ledger, not in credits", async () => {
    // `credits: 0` on purpose: if the demo were still a credit wallet this would be allowed.
    // What forecloses it is the delivered RUN.
    const { client } = stubAnonClient({ priorRuns: 1, credits: 0 });
    const { refusal } = await creditGate(client, ANON, "score");
    expect(refusal).not.toBeNull();
    expect((await refusal!.json()).reason).toBe("demo_used");
  });

  it("a refused Ideas tap does NOT spend the free Test — the headline bug", async () => {
    // The old wallet: DEMO_CREDITS = 10 = the price of a Test, checked as used + cost <= limit.
    // One 1-credit Ideas tap recorded → 1 + 10 > 10 → the Test refused permanently, on the one
    // page built to convert. Here the visitor has spent a credit and run nothing.
    const { client } = stubAnonClient({ priorRuns: 0, credits: 1 });
    const { refusal } = await creditGate(client, ANON, "score");
    expect(refusal).toBeNull();
  });

  it("no amount of recorded credit spend can foreclose the free Test", async () => {
    const { client } = stubAnonClient({ priorRuns: 0, credits: 9_999 });
    expect((await creditGate(client, ANON, "score")).refusal).toBeNull();
  });

  it("fails CLOSED when the run count breaks (it fails OPEN for customers)", async () => {
    // Asymmetric on purpose: failing open here hands EVERY visitor unlimited free engine runs
    // for as long as the ledger is down. Losing conversions is the cheaper failure.
    const { client } = stubAnonClient({ priorRuns: "boom" });
    const { refusal } = await creditGate(client, ANON, "score");
    expect(refusal).not.toBeNull();
    expect((await refusal!.json()).reason).toBe("demo_used");
  });

  it("an anonymous visitor who has PAID is a CUSTOMER — the trial pool wins over the demo", async () => {
    // The funnel's own flow lands here: checkout stamps the subscription while the session is
    // still anonymous (the email claim comes afterwards). Reading the demo onto them would
    // refuse the very verdict they just paid for.
    const { client } = stubAnonClient({
      credits: 0,
      row: {
        virtuna_tier: "starter",
        trial_started_at: "2026-01-01T00:00:00Z",
        trial_ends_at: "2099-01-04T00:00:00Z",
      },
    });
    const { refusal, verdict } = await creditGate(client, ANON, "simulate");

    expect(refusal).toBeNull();
    expect(verdict.isDemo).toBe(false);
    expect(verdict.inTrial).toBe(true);
    expect(verdict.limit).toBe(50); // TRIAL.credits — not DEMO_CREDITS
  });

  it("still meters that paid-but-anonymous session — $1 must not buy the engine", async () => {
    const { client } = stubAnonClient({
      credits: 50,
      row: {
        virtuna_tier: "starter",
        trial_started_at: "2026-01-01T00:00:00Z",
        trial_ends_at: "2099-01-04T00:00:00Z",
      },
    });
    process.env.BILLING_ENFORCE_QUOTA = "false"; // inert for real customers, never for anon
    const { refusal, verdict } = await creditGate(client, ANON, "score");
    expect(verdict.enforced).toBe(true);
    expect(refusal).not.toBeNull();
  });

  it("leaves a signed-up free-tier user on their own wall — the demo is anonymous-only", async () => {
    // Blast radius: every existing user is tier `free`. A demo keyed on anything but
    // `is_anonymous` would hand all of them a free Test.
    const { client } = stubAnonClient({ priorRuns: 0 });
    const { refusal, verdict } = await creditGate(client, U1, "score");
    expect(refusal).not.toBeNull();
    expect(verdict.isDemo).toBe(false);
    expect((await refusal!.json()).reason).toBe("allowance");
  });
});
