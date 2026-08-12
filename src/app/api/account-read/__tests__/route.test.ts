/**
 * route.test.ts — POST /api/account-read, the BILLING layer (2026-07-29).
 *
 * This route ran two Apify scrapes per call for free until `account` was priced at 5 credits. The
 * source-scan in `lib/billing/__tests__/route-wiring.test.ts` proves the gate and the bill are
 * PRESENT; this file proves they fire at the right moments, which a scan cannot see.
 *
 * The rule under test is BILL ON DELIVERY, and it matters here more than on the other paid routes
 * because this one has THREE exits that reach no Read at all:
 *
 *   1. no personal audience on file  → no scrape is even attempted;
 *   2. thin history                  → the scrape ran, and the honest answer is "not enough";
 *   3. scrape failure                → Apify errored.
 *
 * Charging for any of them bills a creator for being told we have nothing to say. Each is asserted
 * separately rather than as one "does not bill on failure" case, because they fail at three
 * different depths and a refactor can easily fix one while breaking another.
 *
 * The refusal is also asserted to be an HTTP 402 that never reaches the engine — a gate that runs
 * but lets the scrape start anyway would still cost real Apify time on an empty wallet.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/billing/credit-gate", () => ({ creditGate: vi.fn(), billUsage: vi.fn() }));
vi.mock("@/lib/audience/audience-repo", () => ({ listAudiences: vi.fn() }));
vi.mock("@/lib/flywheel/reconciliation-repo", () => ({ listReconciliations: vi.fn() }));
vi.mock("@/lib/account-read/account-read", () => ({ generateAccountRead: vi.fn() }));
vi.mock("@/lib/threads/threads", () => ({ createOpenThreadLazy: vi.fn() }));
vi.mock("@/lib/threads/messages", () => ({ insertMessage: vi.fn() }));
vi.mock("@/lib/tools/run-header", () => ({ runHeaderBlock: vi.fn(() => ({ type: "run-header" })) }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "test" })) }));

import { POST } from "../route";
import { createClient } from "@/lib/supabase/server";
import { creditGate, billUsage } from "@/lib/billing/credit-gate";
import { listAudiences } from "@/lib/audience/audience-repo";
import { listReconciliations } from "@/lib/flywheel/reconciliation-repo";
import { generateAccountRead } from "@/lib/account-read/account-read";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreditGate = creditGate as ReturnType<typeof vi.fn>;
const mockBillUsage = billUsage as ReturnType<typeof vi.fn>;
const mockListAudiences = listAudiences as ReturnType<typeof vi.fn>;
const mockListReconciliations = listReconciliations as ReturnType<typeof vi.fn>;
const mockGenerate = generateAccountRead as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSupabase(userId: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId, is_anonymous: false } : null },
        error: null,
      }),
    },
  };
}

/** A personal audience carrying a calibrated handle — the only source of the handle (T-10-12). */
const PERSONAL_AUDIENCE = {
  id: "aud_1",
  type: "personal",
  calibration: { handle: "zachking" },
};

const SUCCESS_READ = {
  handle: "zachking",
  profile: { handle: "zachking", displayName: "Zach King", followerCount: 100 },
  analyzedVideos: [],
  patterns: { recurringHooks: [], formatMix: [], dropPoints: [], working: [], fix: [] },
  trackRecord: null,
};

const req = () => new Request("http://localhost/api/account-read", { method: "POST" });

/** Drain the SSE body so the stream's `start` runs to completion before we assert. */
async function drain(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(makeSupabase("user_1"));
  mockCreditGate.mockResolvedValue({ refusal: null, verdict: { tier: "pro" } });
  mockListAudiences.mockResolvedValue([PERSONAL_AUDIENCE]);
  mockListReconciliations.mockResolvedValue([]);
  mockGenerate.mockResolvedValue(SUCCESS_READ);
});

// ─── The gate ─────────────────────────────────────────────────────────────────

describe("POST /api/account-read — the credit gate", () => {
  it("charges 'account', and asks BEFORE the scrape", async () => {
    await drain(await POST(req()));

    expect(mockCreditGate).toHaveBeenCalledTimes(1);
    // The USER object, never `user.id` — `is_anonymous` decides which allowance applies.
    expect(mockCreditGate.mock.calls[0]![2]).toBe("account");
    expect(mockCreditGate.mock.calls[0]![1]).toMatchObject({ id: "user_1" });
  });

  it("a refusal short-circuits the route — no scrape, no bill, no stream", async () => {
    const wall = Response.json({ error: "insufficient_credits" }, { status: 402 });
    mockCreditGate.mockResolvedValue({ refusal: wall, verdict: null });

    const res = await POST(req());

    expect(res.status).toBe(402);
    // The whole point of gating BEFORE spend: an empty wallet must not cost Apify minutes.
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBillUsage).not.toHaveBeenCalled();
  });

  it("never reaches the gate for an anonymous caller — auth refuses first", async () => {
    // Load-bearing ordering: creditGate enforces for anonymous users regardless of
    // BILLING_ENFORCE_QUOTA, so gating ahead of auth would meter visitors the moment it deployed.
    mockCreateClient.mockResolvedValue(makeSupabase(null));

    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(mockCreditGate).not.toHaveBeenCalled();
  });
});

// ─── Bill on delivery ─────────────────────────────────────────────────────────

describe("POST /api/account-read — bills ON DELIVERY only", () => {
  it("bills once, as 'account', when a Read is actually delivered", async () => {
    const body = await drain(await POST(req()));

    expect(body).toContain("event: done");
    expect(mockBillUsage).toHaveBeenCalledTimes(1);
    expect(mockBillUsage.mock.calls[0]![0]).toMatchObject({
      userId: "user_1",
      action: "account",
      tier: "pro",
    });
  });

  it("does NOT bill when there is no personal audience — no scrape was even attempted", async () => {
    mockListAudiences.mockResolvedValue([]);

    const body = await drain(await POST(req()));

    expect(body).toContain("event: fallback");
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBillUsage).not.toHaveBeenCalled();
  });

  it("does NOT bill a THIN history — the scrape ran, the answer is a refusal to fabricate", async () => {
    mockGenerate.mockResolvedValue({ fallback: "thin" });

    const body = await drain(await POST(req()));

    expect(body).toContain("event: fallback");
    expect(mockBillUsage).not.toHaveBeenCalled();
  });

  it("does NOT bill a scrape FAILURE", async () => {
    mockGenerate.mockResolvedValue({ error: "scrape_failed", message: "apify exploded" });

    const body = await drain(await POST(req()));

    expect(body).toContain("event: error");
    expect(mockBillUsage).not.toHaveBeenCalled();
  });

  it("does NOT bill when the engine throws outright", async () => {
    mockGenerate.mockRejectedValue(new Error("boom"));

    const body = await drain(await POST(req()));

    expect(body).toContain("event: error");
    expect(mockBillUsage).not.toHaveBeenCalled();
  });
});
