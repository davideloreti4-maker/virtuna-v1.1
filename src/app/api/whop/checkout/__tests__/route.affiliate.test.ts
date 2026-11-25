/**
 * POST /api/whop/checkout — Earn's part of it (rulings 25, 29 to 32, 35 and 38). A buyer who opened an
 * enrolled creator's link, whose account was created after that and who has never subscribed, gets a
 * checkout that carries `affiliate_code`: the OWNER's stored Whop username, so Whop tracks the sale and pays
 * them. The owner is decided from the request's own referral cookies and the server's reads, never from
 * `referral_clicks`. In every other case, and on any failure, the request Whop receives is byte for byte
 * the one it received before; and when Whop refuses a checkout that carried the code, it is sent once more
 * without it. With any look.
 *
 * Real: the route, the rule, the time limits, the row writer, the Whop settings. Stood in for: the session
 * client and the service client's database (`fake-referral-db.ts`), `fetch` toward Whop, the request's
 * cookies, the clock and the build-time flag. Every id, email, key, code and username is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  flag: true,
  db: null as unknown as import("@/lib/earn/__tests__/fake-referral-db").FakeReferralDb,
  /** Service clients made; set `noService` and none can be. */
  serviceMade: 0,
  noService: false,
}));

vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return h.flag;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.db.sessionClient() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (h.noService) throw new Error("supabaseUrl is required.");
    h.serviceMade += 1;
    return h.db.serviceClient();
  },
}));

import { fakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";
import { REFERRAL_ROW_MS } from "@/lib/earn/referral-row";
import { REFERRER_LOOKUP_MS } from "@/lib/earn/referrer-of";

const BUYER = "acct-buyer";
const NOW = "2026-11-24T12:00:00.000Z";
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
/** The link was opened 20 minutes ago; the buyer's account was made 5 minutes ago. */
const OPENED = at(-20 * MIN);
const CREATED = at(-5 * MIN);
const APP = "https://maven.example.test";
const PRODUCT_STARTER = "prod_full_starter";
const PRODUCTION = "https://api.whop.com/api/v1/checkout_configurations";
const ENV = ["WHOP_PRODUCT_ID_STARTER", "WHOP_TRIAL_PLAN_ID_STARTER", "WHOP_API_KEY", "WHOP_COMPANY_ID", "WHOP_API_BASE_URL", "NEXT_PUBLIC_APP_URL"] as const;
const saved: Record<string, string | undefined> = {};

let sent: Array<{ url: string; body: string }>;
/** Each answer Whop gave, in order, as the route received it. */
let answered: Response[];
/** What Whop answers to each request, in order; the last one repeats. */
let whopAnswers: Array<{ status: number; json: unknown }>;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  h.flag = true;
  h.serviceMade = 0;
  h.noService = false;
  h.db = fakeReferralDb();
  h.db.state.user = { id: BUYER, email: "buyer@example.test", created_at: CREATED };
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.WHOP_PRODUCT_ID_STARTER = PRODUCT_STARTER;
  process.env.WHOP_API_KEY = "test_key";
  process.env.WHOP_COMPANY_ID = "biz_test1";
  process.env.NEXT_PUBLIC_APP_URL = APP;
  sent = [];
  answered = [];
  whopAnswers = [{ status: 200, json: { id: "chk_123" } }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      const answer = whopAnswers[Math.min(sent.length, whopAnswers.length - 1)]!;
      sent.push({ url: String(url), body: String(init?.body) });
      const res = new Response(JSON.stringify(answer.json), { status: answer.status });
      answered.push(res);
      return res;
    }),
  );
  log = vi.spyOn(console, "error").mockImplementation(() => {});
  owner("acct-nia", "K349Z4QP", "nia.cooks");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const linkCookies = (code = "K349Z4QP", openedAt: string | null = OPENED) =>
  [`sb-test-auth-token=made-up`, `virtuna_referral=${code}`, openedAt === null ? null : `virtuna_referral_at=${encodeURIComponent(openedAt)}`].filter(Boolean).join("; ");

async function post(body: unknown = { planId: "starter", trial: false }, cookie: string | null = linkCookies()) {
  const { POST } = await import("../route");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie !== null) headers.cookie = cookie;
  return POST(new Request("http://test.local/api/whop/checkout", { method: "POST", headers, body: JSON.stringify(body) }));
}

function owner(id: string, code: string, username: string | null, affiliateId: string | null = username ? "aff_test1" : null) {
  h.db.state.tables.referral_codes!.push({ id: `c-${id}`, user_id: id, code, whop_username: username, whop_affiliate_id: affiliateId });
}

/** The body the route sent before Earn, written out by hand: the bytes must not move. */
const TODAY = JSON.stringify({
  plan_id: PRODUCT_STARTER,
  metadata: { supabase_user_id: BUYER, supabase_email: "buyer@example.test" },
  redirect_url: `${APP}/settings?tab=billing&checkout=success`,
});
const WITH_NIA = `${TODAY.slice(0, -1)},"affiliate_code":"nia.cooks"}`;
const ANSWER = { checkoutConfigId: "chk_123", planId: "starter", trialApplied: false, trialDenied: false };
const rows = () => h.db.state.tables.referral_clicks!;
const calls = (table: string) => h.db.state.calls.filter((c) => c.table === table);
const logged = () => log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
/** One request, to today's address, with today's bytes; today's answer; and no referral row. */
async function asToday(res: Response) {
  expect(sent).toEqual([{ url: PRODUCTION, body: TODAY }]);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(ANSWER);
  expect(rows()).toEqual([]);
}

describe("a referred buyer's first checkout", () => {
  it("carries the OWNER's stored Whop username as affiliate_code, after everything it carried before", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(sent).toEqual([{ url: PRODUCTION, body: WITH_NIA }]);
  });

  it("the buyer's answer is what it was: nothing of the referrer in it", async () => {
    expect(await (await post()).json()).toEqual(ANSWER);
  });

  it("works with any look: the flag off changes nothing here", async () => {
    h.flag = false;
    await post();
    expect(sent[0]!.body).toBe(WITH_NIA);
  });

  it("the owner is read by the cookie's code with the service client; referral_clicks is never read", async () => {
    await post({ planId: "starter", trial: false, buyer: "acct-someone", affiliate_code: "buyer.self" });
    expect(calls("referral_codes")).toEqual([
      expect.objectContaining({ op: "select", client: "service", columns: "user_id, whop_username, whop_affiliate_id", filters: [["code", "K349Z4QP"]] }),
    ]);
    expect(calls("referral_clicks").filter((c) => c.op === "select")).toEqual([]);
    expect(sent[0]!.body).toBe(WITH_NIA);
  });

  it("the buyer's subscription row is read once, by the session, for a plain checkout", async () => {
    await post();
    expect(calls("user_subscriptions")).toEqual([expect.objectContaining({ op: "select", client: "session", columns: "*", filters: [["user_id", BUYER]] })]);
  });

  it("a trial checkout reuses the trial check's read: still one, and the trial plan carries the code", async () => {
    process.env.WHOP_TRIAL_PLAN_ID_STARTER = "plan_trial_starter";
    const res = await post({ planId: "starter", trial: true, funnel: true });
    expect(calls("user_subscriptions")).toHaveLength(1);
    expect(sent).toEqual([
      {
        url: PRODUCTION,
        body: JSON.stringify({
          plan_id: "plan_trial_starter",
          metadata: { supabase_user_id: BUYER, supabase_email: "buyer@example.test" },
          redirect_url: `${APP}/home?checkout=success`,
          affiliate_code: "nia.cooks",
        }),
      },
    ]);
    expect(await res.json()).toEqual({ ...ANSWER, trialApplied: true });
  });

  it("a funnel buyer who never passed the sign-in callback (an anonymous account) is attributed the same way", async () => {
    h.db.state.user = { id: BUYER, is_anonymous: true, created_at: CREATED };
    await post();
    expect(JSON.parse(sent[0]!.body).affiliate_code).toBe("nia.cooks");
  });
});

describe("the referral row is written by the server, after the checkout is created (ruling 31)", () => {
  it("one row for the owner and the buyer, at the time the link was opened, through the service client", async () => {
    await post();
    expect(rows()).toEqual([expect.objectContaining({ referral_code: "K349Z4QP", referrer_user_id: "acct-nia", referred_user_id: BUYER, clicked_at: OPENED })]);
    expect(calls("referral_clicks")).toEqual([expect.objectContaining({ op: "insert", client: "service" })]);
    // After Whop answered, never before.
    expect(h.db.state.calls.at(-1)).toMatchObject({ table: "referral_clicks", op: "insert" });
  });

  it("a second checkout of the same buyer: still one row, and nothing logged", async () => {
    await post();
    await post();
    expect(rows()).toHaveLength(1);
    expect(logged()).toBe("");
  });

  it("the write fails: the buyer gets their checkout all the same; the log names no one", async () => {
    h.db.state.failOn = "referral_clicks";
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
    expect(sent).toEqual([{ url: PRODUCTION, body: WITH_NIA }]);
    expect(logged()).toBe("[checkout] referral row not written: error");
  });

  it(`the write hangs: given up after ${REFERRAL_ROW_MS} ms, and the buyer gets their checkout`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(NOW));
    h.db.state.hangOn = "referral_clicks";
    const answer = post();
    await vi.advanceTimersByTimeAsync(REFERRAL_ROW_MS);
    const res = await answer;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
  });
});

describe("otherwise the request to Whop is byte for byte today's", () => {
  it("no cookie at all: nothing is looked up, no service client is made", async () => {
    await asToday(await post(undefined, null));
    expect(h.serviceMade).toBe(0);
    expect(h.db.state.calls).toEqual([]);
  });

  it("other cookies, no referral cookie", async () => {
    await asToday(await post(undefined, "sb-test-auth-token=made-up; theme=dark"));
    expect(h.serviceMade).toBe(0);
  });

  it.each([
    ["lower case", "k349z4qp"],
    ["a filter after the code", "K349Z4QP%2Cuser_id.neq.x"],
    ["a username where the code should be", "nia.cooks"],
    ["empty", ""],
  ])("a malformed cookie (%s): nothing is looked up", async (_why, code) => {
    await asToday(await post(undefined, linkCookies(code)));
    expect(h.serviceMade).toBe(0);
    expect(h.db.state.calls).toEqual([]);
  });

  it("an unknown code", async () => {
    await asToday(await post(undefined, linkCookies("ZZZZZZZZ")));
  });

  it("the buyer's own code: never the buyer's own username", async () => {
    owner(BUYER, "SELFSELF", "buyer.self", "aff_test9");
    await asToday(await post(undefined, linkCookies("SELFSELF")));
  });

  it("an owner who is not enrolled at Whop", async () => {
    h.db.state.tables.referral_codes = [];
    owner("acct-nia", "K349Z4QP", null);
    await asToday(await post());
  });

  it.each([
    ["a membership, once", { whop_membership_id: "mem_test1", whop_user_id: "user_test1", virtuna_tier: "free", status: "cancelled" }],
    ["a paying customer who upgrades", { whop_membership_id: "mem_test1", whop_user_id: "user_test1", virtuna_tier: "starter", status: "active" }],
    ["a trial used", { trial_used_at: "2026-06-01T00:00:00Z", virtuna_tier: "free", status: "active" }],
  ])("a buyer with a subscription history (%s): only a first purchase is attributed", async (_why, row) => {
    h.db.state.tables.user_subscriptions!.push({ user_id: BUYER, ...row });
    await asToday(await post());
  });

  it("an account older than the link's opening", async () => {
    h.db.state.user = { id: BUYER, email: "buyer@example.test", created_at: at(-200 * DAY) };
    await asToday(await post());
    expect(h.serviceMade).toBe(0);
  });

  it("no time cookie, and an account more than 24 hours old", async () => {
    h.db.state.user = { id: BUYER, email: "buyer@example.test", created_at: at(-DAY - 1) };
    await asToday(await post(undefined, linkCookies("K349Z4QP", null)));
  });

  it("a time cookie from the first day of time, and an old account: not believed", async () => {
    h.db.state.user = { id: BUYER, email: "buyer@example.test", created_at: at(-200 * DAY) };
    await asToday(await post(undefined, linkCookies("K349Z4QP", "1970-01-01T00:00:00.000Z")));
  });

  it("the referrer comes from the code's owner: a referral_clicks row decides nothing", async () => {
    owner("acct-sam", "QWERTY23", "sam.lifts", "aff_test2");
    rows().push({ id: "k1", referral_code: "QWERTY23", referrer_user_id: "acct-sam", referred_user_id: BUYER, clicked_at: CREATED });
    const res = await post(undefined, null);
    expect(sent).toEqual([{ url: PRODUCTION, body: TODAY }]);
    expect(res.status).toBe(200);
    expect(rows()).toHaveLength(1);
  });

  it("the lookup throws: the checkout still goes out, the log names no one", async () => {
    h.db.state.failOn = "referral_codes";
    await asToday(await post());
    expect(logged()).toBe("[checkout] referrer lookup failed: error");
  });

  it("no service client can be made", async () => {
    h.noService = true;
    await asToday(await post());
  });

  it(`the lookup hangs: given up after ${REFERRER_LOOKUP_MS} ms, and the checkout goes out`, async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(NOW));
    h.db.state.hangOn = "referral_codes";
    const answer = post();
    await vi.advanceTimersByTimeAsync(REFERRER_LOOKUP_MS);
    await asToday(await answer);
    expect(logged()).toBe("[checkout] referrer lookup failed: timeout");
  });

  it("the subscription row cannot be read: no code (a failed read is not 'never subscribed')", async () => {
    h.db.state.failOn = "user_subscriptions";
    await asToday(await post());
  });

  it("Whop is not configured here (no company id): nothing is looked up at all (ruling 38)", async () => {
    delete process.env.WHOP_COMPANY_ID;
    await asToday(await post());
    expect(h.serviceMade).toBe(0);
    expect(h.db.state.calls).toEqual([]);
  });

  it("a trial checkout, not referred: as before too", async () => {
    process.env.WHOP_TRIAL_PLAN_ID_STARTER = "plan_trial_starter";
    await post({ planId: "starter", trial: true, funnel: true }, null);
    expect(sent).toEqual([
      {
        url: PRODUCTION,
        body: JSON.stringify({
          plan_id: "plan_trial_starter",
          metadata: { supabase_user_id: BUYER, supabase_email: "buyer@example.test" },
          redirect_url: `${APP}/home?checkout=success`,
        }),
      },
    ]);
    expect(calls("user_subscriptions")).toHaveLength(1);
  });
});

describe("a referral never costs a sale (ruling 32)", () => {
  it.each([400, 404, 422, 500])("Whop refuses the checkout that carried the code (%i): sent once more without it, and the buyer gets their checkout", async (status) => {
    whopAnswers = [
      { status, json: { error: { message: "affiliate nia.cooks is not valid" } } },
      { status: 200, json: { id: "chk_456" } },
    ];
    const res = await post();
    expect(sent).toEqual([
      { url: PRODUCTION, body: WITH_NIA },
      { url: PRODUCTION, body: TODAY },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...ANSWER, checkoutConfigId: "chk_456" });
    // Not attributed after all: no row; and the log names the status, never the username or what Whop said.
    expect(rows()).toEqual([]);
    expect(logged()).toBe(`[checkout] whop refused a checkout with an affiliate code (${status}); sent again without it`);
  });

  it("the refused answer is let go unread before the second request: its body is released, never parsed", async () => {
    whopAnswers = [
      { status: 422, json: { error: { message: "affiliate nia.cooks is not valid" } } },
      { status: 200, json: { id: "chk_456" } },
    ];
    const read: string[] = [];
    const inner = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
      const res = await inner(url, init);
      for (const method of ["json", "text", "arrayBuffer", "blob", "formData"] as const) {
        const real = res[method].bind(res);
        Object.defineProperty(res, method, { value: () => (read.push(`${answered.indexOf(res)}:${method}`), real()) });
      }
      return res;
    });
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...ANSWER, checkoutConfigId: "chk_456" });
    // The first answer was not read by anyone, and its stream is closed; the second was read once, as before.
    expect(read).toEqual(["1:json"]);
    expect(answered[0]!.bodyUsed).toBe(true);
  });

  it("Whop refuses the second one too: answered as the route answers a refusal today, after exactly two requests", async () => {
    whopAnswers = [{ status: 500, json: { error: "down" } }];
    const res = await post();
    expect(sent.map((s) => s.body)).toEqual([WITH_NIA, TODAY]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to create checkout session" });
    expect(rows()).toEqual([]);
    expect(logged()).not.toMatch(/nia\.cooks/);
  });

  it("a refused checkout that carried no code is not sent again: one request, as today", async () => {
    whopAnswers = [{ status: 500, json: { error: "down" } }];
    const res = await post(undefined, null);
    expect(sent).toEqual([{ url: PRODUCTION, body: TODAY }]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to create checkout session" });
  });
});

describe("one address for Whop (ruling 25)", () => {
  it("WHOP_API_BASE_URL absent: the checkout posts exactly where it posts today", async () => {
    await post(undefined, null);
    await post();
    expect(sent.map((s) => s.url)).toEqual(["https://api.whop.com/api/v1/checkout_configurations", "https://api.whop.com/api/v1/checkout_configurations"]);
    const { WHOP_CHECKOUT_ENDPOINT } = await import("../route");
    expect(WHOP_CHECKOUT_ENDPOINT).toBe("https://api.whop.com/api/v1/checkout_configurations");
  });

  it("blank counts as absent", async () => {
    process.env.WHOP_API_BASE_URL = "   ";
    await post(undefined, null);
    expect(sent[0]!.url).toBe(PRODUCTION);
  });

  it("set to the sandbox: the checkout goes there, with or without a code, and so does the second try", async () => {
    process.env.WHOP_API_BASE_URL = "https://sandbox-api.whop.com/api/v1/";
    const SANDBOX = "https://sandbox-api.whop.com/api/v1/checkout_configurations";
    await post(undefined, null);
    whopAnswers = [
      { status: 200, json: { id: "chk_123" } },
      { status: 422, json: {} },
      { status: 200, json: { id: "chk_456" } },
    ];
    await post();
    expect(sent).toEqual([
      { url: SANDBOX, body: TODAY },
      { url: SANDBOX, body: WITH_NIA },
      { url: SANDBOX, body: TODAY },
    ]);
  });

  it("an address that is not https is not used (the key would travel in the clear): today's address, and no code", async () => {
    process.env.WHOP_API_BASE_URL = "http://sandbox-api.whop.com/api/v1";
    await asToday(await post());
    expect(h.serviceMade).toBe(0);
  });
});
