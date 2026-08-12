import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { checkCreditQuota, type TrialWindow } from "../quota";
import { ACTIVATION_ACTION, CREDIT_COSTS } from "@/lib/pricing";

/**
 * THE ACTIVATION ENTITLEMENT — one free card for a creator who just calibrated.
 *
 * The defect it closes, measured on a production build 2026-08-04: a new signup waited ~135s
 * for calibration, landed on /home, clicked the one CTA the product offered, and got 402. Free
 * tier's allowance is 0 and BILLING_ENFORCE_QUOTA is true in production, so this was every new
 * user rather than an edge case.
 *
 * What these lock, in order of how expensive each would be to get wrong:
 *   1. it applies ONLY to someone who actually calibrated — otherwise it is a free pack for the
 *      entire user base, since every existing user is tier `free` (the #423 confusion);
 *   2. it is ONE run, counted as delivered runs, not a credit balance that other actions can
 *      quietly consume;
 *   3. it does not leak to any other action — `ideas` only;
 *   4. it never overrides a trial or a paid tier, whose own allowances must win;
 *   5. it fails CLOSED, like the demo it is modelled on.
 */

const NOW = new Date("2026-08-04T12:00:00Z");
const NO_TRIAL: TrialWindow = { trialStartedAt: null, trialEndsAt: null };
const ACTIVE_TRIAL: TrialWindow = {
  trialStartedAt: new Date("2026-08-04T11:00:00Z"),
  trialEndsAt: new Date("2026-08-07T11:00:00Z"),
};

const U1 = { id: "u1" };
const ANON = { id: "anon", is_anonymous: true };

/**
 * Stubs the two reads the entitlement makes: the calibrated-audience lookup on `audiences`, and
 * the delivered-run count on the ledger. Everything else resolves to a zero balance, which is
 * what the free tier actually has.
 */
function stubClient(opts: {
  calibrated?: boolean;
  audienceError?: boolean;
  priorIdeaRuns?: number;
  countThrows?: boolean;
}) {
  const seen: string[] = [];

  const audiencesBuilder = {
    select: vi.fn(() => audiencesBuilder),
    eq: vi.fn(() => audiencesBuilder),
    not: vi.fn(() => audiencesBuilder),
    limit: vi.fn(() => audiencesBuilder),
    maybeSingle: vi.fn(async () => {
      if (opts.audienceError) {
        return { data: null, error: { code: "08006", message: "conn lost" } };
      }
      return { data: opts.calibrated ? { id: "aud-1" } : null, error: null };
    }),
  };

  const ledgerBuilder = {
    select: vi.fn(() => ledgerBuilder),
    eq: vi.fn(() => ledgerBuilder),
    gte: vi.fn(async () => ({ count: 0, error: null })),
    then: vi.fn((resolve: (v: unknown) => void) => {
      if (opts.countThrows) {
        return resolve({ count: null, error: { code: "08006", message: "conn lost" } });
      }
      return resolve({ count: opts.priorIdeaRuns ?? 0, error: null });
    }),
  };

  const client = {
    rpc: vi.fn(async () => ({ data: 0, error: null })),
    from: vi.fn((table: string) => {
      seen.push(table);
      return table === "audiences" ? audiencesBuilder : ledgerBuilder;
    }),
  } as unknown as SupabaseClient;

  return { client, seen };
}

const ORIGINAL_FLAG = process.env.BILLING_ENFORCE_QUOTA;

beforeEach(() => {
  // Production's setting. Without it the free tier is not refused at all and the entitlement
  // would look like it works when it is the disabled flag doing the work.
  process.env.BILLING_ENFORCE_QUOTA = "true";
});
afterEach(() => {
  process.env.BILLING_ENFORCE_QUOTA = ORIGINAL_FLAG;
  vi.restoreAllMocks();
});

describe("activation entitlement — who gets the free card", () => {
  it("allows one ideas pack for a calibrated free-tier creator", async () => {
    const { client } = stubClient({ calibrated: true, priorIdeaRuns: 0 });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(true);
    expect(verdict.reason).toBeNull();
  });

  it("refuses a free-tier user who has NEVER calibrated", async () => {
    // The one that matters most: every existing user is tier `free`, so keying on tier alone
    // would hand the whole user base a free pack.
    const { client } = stubClient({ calibrated: false });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(false);
  });

  it("is spent after one delivered run", async () => {
    const { client } = stubClient({ calibrated: true, priorIdeaRuns: 1 });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(false);
  });

  it("does not leak to any other action", async () => {
    // A calibrated free user must still be walled off the paid skills — the entitlement is one
    // card, not a free tier.
    const { client } = stubClient({ calibrated: true, priorIdeaRuns: 0 });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      "score",
      CREDIT_COSTS.score,
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(false);
  });

  it("never applies to an anonymous visitor — that is the demo's lane", async () => {
    // An anonymous session is the /go funnel, which has its own entitlement (DEMO_ACTION). If
    // both applied to one session it would be two free runs per visitor.
    const { client, seen } = stubClient({ calibrated: true, priorIdeaRuns: 0 });

    await checkCreditQuota(
      client,
      ANON,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    // The demo path returns before the activation check, so the audience lookup never runs.
    expect(seen).not.toContain("audiences");
  });

  it("does not fire during a trial — the trial pool decides", async () => {
    const { client, seen } = stubClient({ calibrated: true, priorIdeaRuns: 0 });

    await checkCreditQuota(
      client,
      U1,
      "starter",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      ACTIVE_TRIAL,
      NOW,
    );

    expect(seen).not.toContain("audiences");
  });

  it("fails CLOSED when the audience lookup errors", async () => {
    // Same asymmetry as the demo: failing open hands out free engine runs to anyone whose
    // query happened to error; failing closed costs one conversion, recoverable by retry.
    const { client } = stubClient({ audienceError: true });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(false);
  });

  it("fails CLOSED when the run count errors", async () => {
    const { client } = stubClient({ calibrated: true, countThrows: true });

    const verdict = await checkCreditQuota(
      client,
      U1,
      "free",
      ACTIVATION_ACTION,
      CREDIT_COSTS[ACTIVATION_ACTION],
      NO_TRIAL,
      NOW,
    );

    expect(verdict.allowed).toBe(false);
  });
});
