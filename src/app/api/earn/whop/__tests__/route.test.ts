/**
 * POST /api/earn/whop — a creator enrols at Whop from the card `Get paid` (plan 2026-11-24-earn, step B;
 * rulings 13, 14, 26, 27 and 33; the plan's statuses). Real: the handler, the CSRF guard, the shared rate limiter, the
 * enrolment, the Whop client, the page read, the server's cache. Stood in for: the build-time flag, the
 * database and auth behind the session and service clients (`fake-referral-db.ts`), the rate limiter's
 * store (Upstash's SDK), `fetch` toward Whop (`whop-fetch.ts`) and the environment. Every id, key, email
 * and username is made up.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  // The plan ids are read when `src/lib/whop/config.ts` loads: set before any import.
  Object.assign(process.env, {
    WHOP_PRODUCT_ID_STARTER: "plan_full_starter",
    WHOP_PRODUCT_ID_PRO: "plan_full_pro",
    WHOP_PRODUCT_ID_STUDIO: "plan_full_studio",
    WHOP_TRIAL_PLAN_ID_STARTER: "plan_trial_starter",
    WHOP_TRIAL_PLAN_ID_PRO: "plan_trial_pro",
    WHOP_TRIAL_PLAN_ID_STUDIO: "plan_trial_studio",
  });
  return {
    flag: true,
    db: null as unknown as import("@/lib/earn/__tests__/fake-referral-db").FakeReferralDb,
    rate: { success: true, limit: 3, remaining: 2, reset: 0 },
    limitCalls: [] as string[],
    prefixes: [] as string[],
    /** Each limiter's budget, by its prefix: what `slidingWindow` was asked for. */
    budgets: {} as Record<string, { max: number; window: string }>,
    /** Set: no service client can be made (its settings are missing). */
    noService: false,
  };
});

vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return h.flag;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.db.sessionClient() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (h.noService) throw new Error("supabaseUrl is required.");
    return h.db.serviceClient();
  },
}));
// The shared limiter's store (Upstash) is the boundary: its SDK is stood in, `rateLimitGuard` runs for real.
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(max: number, window: string) {
      return { max, window };
    }
    constructor(opts: { prefix: string; limiter: { max: number; window: string } }) {
      h.prefixes.push(opts.prefix);
      h.budgets[opts.prefix] = opts.limiter;
    }
    async limit(id: string) {
      h.limitCalls.push(id);
      return h.rate;
    }
  },
}));

import { clearEarnCaches } from "@/lib/earn/earn-cache";
import { ENROL_ATTEMPTS_PER_HOUR, clearEnrolGate } from "@/lib/earn/enrol";
import { fakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";
import { TEST_BASE, TEST_COMPANY, TEST_KEY, affiliateJson, whopFetch, type Route } from "@/lib/earn/__tests__/whop-fetch";

import { POST } from "../route";

const ME = "acct-nia";
const ORIGIN = "https://maven.example.test";
const ENV = ["NEXT_PUBLIC_APP_URL", "WHOP_API_BASE_URL", "WHOP_API_KEY", "WHOP_COMPANY_ID", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const saved: Record<string, string | undefined> = {};
beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
});
afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

let whop: ReturnType<typeof whopFetch>;
let log: ReturnType<typeof vi.spyOn>;

/** Whop's answers for a full enrolment. */
function whopAnswers(over: { affiliate?: Route["answer"]; override?: Route["answer"] } = {}) {
  whop = whopFetch([
    { method: "POST", path: "/affiliates", answer: over.affiliate ?? { status: 200, json: affiliateJson() } },
    { method: "GET", path: "/affiliates/aff_test1/overrides", answer: { status: 200, json: { data: [] } } },
    { method: "POST", path: "/affiliates/aff_test1/overrides", answer: over.override ?? { status: 200, json: { id: "ovr_new" } } },
    { method: "GET", path: "/affiliates/aff_test1", answer: { status: 200, json: affiliateJson() } },
  ]);
  vi.stubGlobal("fetch", whop.http);
}

beforeEach(() => {
  h.flag = true;
  h.rate = { success: true, limit: 3, remaining: 2, reset: 0 };
  h.limitCalls = [];
  h.noService = false;
  h.db = fakeReferralDb();
  h.db.state.user = { id: ME, email: "nia@example.test", user_metadata: { full_name: "Nia Carter" } };
  h.db.state.tables.referral_codes!.push({ id: "c1", user_id: ME, code: "K349Z4QP", whop_username: null, whop_affiliate_id: null });
  Object.assign(process.env, {
    NEXT_PUBLIC_APP_URL: ORIGIN,
    WHOP_API_BASE_URL: TEST_BASE,
    WHOP_API_KEY: TEST_KEY,
    WHOP_COMPANY_ID: TEST_COMPANY,
    UPSTASH_REDIS_REST_URL: "https://ratelimit.example.test",
    UPSTASH_REDIS_REST_TOKEN: "made-up-token",
  });
  clearEarnCaches();
  clearEnrolGate();
  whopAnswers();
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${ORIGIN}/api/earn/whop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}
const myRow = () => h.db.state.tables.referral_codes!.find((r) => r.user_id === ME)!;
const nothingSent = () => {
  expect(whop.calls).toEqual([]);
  expect(h.db.state.calls.filter((c) => c.op === "update")).toEqual([]);
};

describe("who may ask", () => {
  it("flag off: 404, nothing read, nothing sent", async () => {
    h.flag = false;
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(h.db.state.authCalls).toBe(0);
    expect(h.db.state.calls).toEqual([]);
    expect(whop.calls).toEqual([]);
  });

  it("signed out: 401", async () => {
    h.db.state.user = null;
    expect((await post({ username: "nia.cooks" })).status).toBe(401);
    nothingSent();
  });

  it("a funnel visitor: 404", async () => {
    h.db.state.user = { id: ME, is_anonymous: true };
    expect((await post({ username: "nia.cooks" })).status).toBe(404);
    nothingSent();
  });

  it("not JSON: 415; another site: 403 (the CSRF guard)", async () => {
    expect((await post({ username: "nia.cooks" }, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await post({ username: "nia.cooks" }, { Origin: "https://elsewhere.example.test" })).status).toBe(403);
    nothingSent();
  });

  it("over the shared rate limit: its 429 as it answers, counted for the session's id", async () => {
    h.rate = { success: false, limit: 3, remaining: 0, reset: Date.now() + 30_000 };
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(h.limitCalls).toEqual([ME]);
    expect(h.prefixes).toContain("rl:tools:earn-whop");
    nothingSent();
  });

  it("the route has its own budget in the shared limiter: 3 a minute (ruling 42)", async () => {
    await post({ username: "nia.cooks" });
    expect(h.budgets["rl:tools:earn-whop"]).toEqual({ max: 3, window: "60 s" });
  });

  it.each([
    ["not JSON at all", "{"],
    ["a username that is not text", { username: 42 }],
    ["another person's id in the body (the id is the session's only)", { username: "nia.cooks", user_id: "acct-other" }],
    ["an array", ["nia.cooks"]],
  ])("%s: 400 Bad request", async (_why, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Bad request" });
    nothingSent();
  });
});

describe("enrolling", () => {
  it("a typed username: 200 with the new page, the answered username and the affiliate stored", async () => {
    const res = await post({ username: "@nia.cooks" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      link: `${ORIGIN}/?ref=K349Z4QP`,
      code: "K349Z4QP",
      name: "Nia Carter",
      joined: 0,
      whop: { canEnrol: true, knownAccount: false, username: "nia.cooks", earnedCents: 1250 },
    });
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    expect(whop.calls[0]).toMatchObject({ method: "POST", url: `${TEST_BASE}/affiliates`, body: { account_id: TEST_COMPANY, user_identifier: "nia.cooks" } });
    // The commission on the six plans, and no second read of the affiliate (its answer was kept).
    expect(whop.calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"))).toHaveLength(6);
    expect(whop.calls.some((c) => c.method === "GET" && c.url.endsWith("/affiliates/aff_test1"))).toBe(false);
  });

  it("a paying customer, no username: enrolled by the stored Whop user id", async () => {
    h.db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" });
    const res = await post({});
    expect(res.status).toBe(200);
    expect(whop.calls[0]!.body).toEqual({ account_id: TEST_COMPANY, user_identifier: "user_test1" });
    expect((await res.json()).whop).toMatchObject({ knownAccount: true, username: "nia.cooks" });
  });

  it("no username and no stored Whop user id: 400 no_account", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_account" });
    nothingSent();
  });

  it("a typed text that is not a Whop username: 400 invalid_username, nothing sent", async () => {
    const res = await post({ username: "nia@example.test" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_username" });
    nothingSent();
  });

  it("Whop is not configured here: 503 not_available, nothing sent", async () => {
    delete process.env.WHOP_COMPANY_ID;
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_available" });
    nothingSent();
  });

  it("Whop finds nobody: 422 not_found, nothing stored", async () => {
    whopAnswers({ affiliate: { status: 404, json: {} } });
    const res = await post({ username: "nobody.here" });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
  });

  it("anything else from Whop: 502 failed, nothing stored", async () => {
    whopAnswers({ affiliate: { status: 500, json: {} } });
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "failed" });
    expect(myRow()).toMatchObject({ whop_username: null });
  });

  it("a plan's commission refused: 502 failed and nothing stored (ruling 26); a second try sets what is missing and stores", async () => {
    whopAnswers({ override: (call) => ((call.body as { plan_id: string }).plan_id === "plan_trial_pro" ? { status: 500, json: {} } : { status: 200, json: {} }) });
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "failed" });
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    const logged = log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
    expect(logged).toBe("[earn] whop commission failed: whop refused 500");

    whopAnswers();
    const again = await post({ username: "nia.cooks" });
    expect(again.status).toBe(200);
    expect((await again.json()).whop).toMatchObject({ username: "nia.cooks" });
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  });

  it("a Whop account that is another creator's already: 409 already_connected, nothing stored (ruling 33)", async () => {
    h.db.state.tables.referral_codes!.push({ id: "c2", user_id: "acct-other", code: "QWERTY23", whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_connected" });
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    // Nothing of the other creator is answered or changed, and no commission is touched.
    expect(whop.calls.map((c) => c.method)).toEqual(["POST"]);
    expect(h.db.state.tables.referral_codes!.find((r) => r.user_id === "acct-other")).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  });

  it(`the attempt after ${ENROL_ATTEMPTS_PER_HOUR} in an hour: 429 with the failure's name and when to come back; nothing sent (ruling 33)`, async () => {
    whopAnswers({ affiliate: { status: 404, json: {} } });
    for (let i = 0; i < ENROL_ATTEMPTS_PER_HOUR; i++) expect((await post({ username: `nobody.${i}` })).status).toBe(422);
    whopAnswers();
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "failed" });
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(Number(res.headers.get("Retry-After"))).toBeLessThanOrEqual(3600);
    nothingSent();
  });

  it("a second request while one runs: 429 with the failure's name, nothing sent for it (ruling 27)", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const inner = whop.http;
    const sentBy: string[] = [];
    vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
      sentBy.push(String(input));
      await held;
      return inner(input, init);
    });
    const first = post({ username: "nia.cooks" });
    await vi.waitFor(() => expect(sentBy).toHaveLength(1));
    const second = await post({ username: "nia.cooks" });
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "failed" });
    expect(second.headers.get("Retry-After")).toBeNull();
    expect(sentBy).toHaveLength(1);
    release();
    expect((await first).status).toBe(200);
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks" });
  });

  it("another creator sends the same Whop username while one runs: 429 with the failure's name, nothing sent for it (ruling 42)", async () => {
    h.db.state.tables.referral_codes!.push({ id: "c2", user_id: "acct-other", code: "QWERTY23", whop_username: null, whop_affiliate_id: null });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const inner = whop.http;
    const sentBy: string[] = [];
    vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
      sentBy.push(String(input));
      await held;
      return inner(input, init);
    });
    const first = post({ username: "nia.cooks" });
    await vi.waitFor(() => expect(sentBy).toHaveLength(1));
    // The next request is another creator's session.
    h.db.state.user = { id: "acct-other", email: "sam@example.test" };
    const second = await post({ username: "@Nia.Cooks" });
    expect(second.status).toBe(429);
    expect(await second.json()).toEqual({ error: "failed" });
    expect(sentBy).toHaveLength(1);
    release();
    expect((await first).status).toBe(200);
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    expect(h.db.state.tables.referral_codes!.find((r) => r.user_id === "acct-other")).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    // One creator's six commissions, not twelve.
    expect(whop.calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"))).toHaveLength(6);
  });

  it("no service client can be made (its settings are missing): 500 Server error, nothing sent", async () => {
    h.noService = true;
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n")).toBe("[earn] whop enrol failed: supabaseUrl is required.");
    nothingSent();
  });

  it("a database error: 500 Server error, its text in the log, no id, username or key there", async () => {
    h.db.state.failOn = "referral_codes";
    const res = await post({ username: "nia.cooks" });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    const logged = log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
    expect(logged).toMatch(/^\[earn\] whop enrol failed: referral_codes: connection reset by peer$/);
    expect(logged).not.toMatch(/acct-nia|nia\.cooks|aff_test1|test-key/);
  });

  it("no email address reaches Whop, and the key never reaches the answer", async () => {
    h.db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" });
    const res = await post({});
    expect(JSON.stringify(whop.calls.map((c) => [c.url, c.body]))).not.toMatch(/@/);
    expect(JSON.stringify(await res.json())).not.toContain(TEST_KEY);
  });
});
