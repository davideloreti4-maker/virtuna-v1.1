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
vi.mock("@/lib/threads/threads", () => ({ createOpenThreadLazy: vi.fn(), setThreadTitleIfEmpty: vi.fn() }));
vi.mock("@/lib/threads/messages", () => ({ insertMessage: vi.fn(), deleteMessage: vi.fn() }));
vi.mock("@/lib/tools/run-header", () => ({ runHeaderBlock: vi.fn(() => ({ type: "run-header" })) }));
vi.mock("@/lib/kc/kc-stamp", () => ({ kcStamp: vi.fn(() => ({ kcGenVersion: "test" })) }));
// The block schema, at the line this file needs: the run-header stand-in above and the fixture read
// are not full blocks, so the route's check before storing is answered here: a read with no profile
// is the one that would not store.
vi.mock("@/lib/tools/block-registry", () => ({
  validateBlock: vi.fn((b: { type?: string; props?: { profile?: unknown } }) =>
    b.type === "account-read" && b.props?.profile === null ? { ok: false } : { ok: true, block: b },
  ),
}));

import { POST } from "../route";
import { createClient } from "@/lib/supabase/server";
import { creditGate, billUsage } from "@/lib/billing/credit-gate";
import { listAudiences } from "@/lib/audience/audience-repo";
import { listReconciliations } from "@/lib/flywheel/reconciliation-repo";
import { generateAccountRead } from "@/lib/account-read/account-read";
import { createOpenThreadLazy, setThreadTitleIfEmpty } from "@/lib/threads/threads";
import { insertMessage, deleteMessage } from "@/lib/threads/messages";

const mockCreateClient = createClient as ReturnType<typeof vi.fn>;
const mockCreditGate = creditGate as ReturnType<typeof vi.fn>;
const mockBillUsage = billUsage as ReturnType<typeof vi.fn>;
const mockListAudiences = listAudiences as ReturnType<typeof vi.fn>;
const mockListReconciliations = listReconciliations as ReturnType<typeof vi.fn>;
const mockGenerate = generateAccountRead as ReturnType<typeof vi.fn>;
const mockOpenThread = createOpenThreadLazy as ReturnType<typeof vi.fn>;
const mockInsert = insertMessage as ReturnType<typeof vi.fn>;

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
  mockOpenThread.mockResolvedValue({ id: "t1" });
  mockInsert.mockResolvedValue(undefined);
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

// ─── Persist: the read and its message, in the chat it was asked in ─────────────

const persistReq = () =>
  new Request("http://localhost/api/account-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persist: true }),
  });

describe("POST /api/account-read — persist stores the read and its message together", () => {
  it("resolves the chat at the start of the request, before the scrape", async () => {
    await drain(await POST(persistReq()));

    expect(mockOpenThread).toHaveBeenCalledTimes(1);
    expect(mockOpenThread.mock.invocationCallOrder[0]!).toBeLessThan(mockGenerate.mock.invocationCallOrder[0]!);
  });

  it("a delivered read stores its message, then the read, in that chat", async () => {
    const body = await drain(await POST(persistReq()));

    expect(body).toContain("event: done");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    const [user, assistant] = mockInsert.mock.calls;
    expect(user!.slice(0, 3)).toEqual(["t1", "user", [{ type: "markdown", props: { text: "Read my account" } }]]);
    expect(assistant![0]).toBe("t1");
    expect(assistant![1]).toBe("assistant");
    expect((assistant![2] as Array<{ type: string }>).map((b) => b.type)).toEqual(["run-header", "account-read"]);
    // A new chat is named by it, as by any first message.
    expect(setThreadTitleIfEmpty).toHaveBeenCalledWith("user_1", "t1", "Read my account");
  });

  it("the creator opening another chat during the read does not move it: both rows go to the chat it was asked in", async () => {
    // The pointer, read again later, would name another chat.
    mockOpenThread.mockResolvedValueOnce({ id: "t1" }).mockResolvedValue({ id: "t2" });
    await drain(await POST(persistReq()));
    expect(mockInsert.mock.calls.map((c) => c[0])).toEqual(["t1", "t1"]);
  });

  it.each([
    ["no personal audience", () => mockListAudiences.mockResolvedValue([])],
    ["a thin history", () => mockGenerate.mockResolvedValue({ fallback: "thin" })],
    ["a scrape failure", () => mockGenerate.mockResolvedValue({ error: "scrape_failed", message: "x" })],
    ["an engine that throws", () => mockGenerate.mockRejectedValue(new Error("boom"))],
  ])("%s stores nothing: no message, no read", async (_name, arrange) => {
    arrange();
    await drain(await POST(persistReq()));
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("a credit refusal resolves no chat and stores nothing", async () => {
    mockCreditGate.mockResolvedValue({ refusal: Response.json({ error: "insufficient_credits" }, { status: 402 }), verdict: null });
    await POST(persistReq());
    expect(mockOpenThread).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("without persist (the account tool) it touches no chat", async () => {
    await drain(await POST(req()));
    expect(mockOpenThread).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/account-read — a scrape failure is named, not blamed on the handle", () => {
  it("sends cause scrape_failed, and no 'Check your handle' line", async () => {
    mockGenerate.mockResolvedValue({ error: "scrape_failed", message: "Blocked (HTTP 200 with an empty body)" });
    const body = await drain(await POST(req()));
    const frame = body.split("\n\n").find((f) => f.startsWith("event: error"))!;
    const data = JSON.parse(frame.split("\n").find((l) => l.startsWith("data: "))!.slice(6)) as Record<string, unknown>;
    expect(data.cause).toBe("scrape_failed");
    expect(data.retry).toBe(true);
    expect(String(data.message)).not.toMatch(/handle/i);
  });

  it("an engine that throws is not called a scrape failure", async () => {
    mockGenerate.mockRejectedValue(new Error("boom"));
    const body = await drain(await POST(req()));
    expect(body).toContain("event: error");
    expect(body).not.toContain("scrape_failed");
  });
});

describe("POST /api/account-read — never a message with no read under it", () => {
  it("the read's row failing to store takes its message back out; the read still streams", async () => {
    mockInsert.mockResolvedValueOnce({ id: "m-user" }).mockRejectedValueOnce(new Error("db down"));
    const body = await drain(await POST(persistReq()));
    expect(body).toContain("event: done");
    expect(deleteMessage).toHaveBeenCalledWith("m-user");
  });

  it("a read that would not store (an invalid block) stores nothing, not even its message", async () => {
    mockGenerate.mockResolvedValue({ ...SUCCESS_READ, profile: null });
    await drain(await POST(persistReq()));
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
