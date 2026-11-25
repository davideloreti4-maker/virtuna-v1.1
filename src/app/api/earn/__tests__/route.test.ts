/**
 * GET /api/earn (plan 2026-11-24-earn, steps A and B; rulings 9, 16 and 34). Real: the handler, the shared
 * rate limiter, the read, the rule, the code generator, the Whop client, the server's cache. Stood in for:
 * the build-time flag, the database and auth behind the session and service clients (`fake-referral-db.ts`),
 * the rate limiter's store (Upstash's SDK), `fetch` toward Whop (`whop-fetch.ts`) and the environment it
 * reads. Every id, code, key and name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearEarnCaches } from "@/lib/earn/earn-cache";
import { fakeReferralDb, type FakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";
import { TEST_BASE, TEST_COMPANY, TEST_KEY, affiliateJson, whopFetch } from "@/lib/earn/__tests__/whop-fetch";

const h = vi.hoisted(() => ({
  flag: true,
  db: null as unknown as FakeReferralDb,
  rate: { success: true, limit: 20, remaining: 19, reset: 0 },
  limitCalls: [] as string[],
  prefixes: [] as string[],
  storeDown: false,
}));

vi.mock("@/lib/flags/new-look", () => ({
  get NEW_LOOK_ENABLED() {
    return h.flag;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => h.db.sessionClient() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => h.db.serviceClient() }));
// The shared limiter's store (Upstash) is the boundary: its SDK is stood in, `rateLimitGuard` runs for real.
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    constructor(opts: { prefix: string }) {
      h.prefixes.push(opts.prefix);
    }
    async limit(id: string) {
      h.limitCalls.push(id);
      if (h.storeDown) throw new Error("store unreachable");
      return h.rate;
    }
  },
}));

import { GET } from "../route";

const ME = "acct-nia";
const CLICKED = "2026-11-20T12:00:00.000Z";
const ENV = ["NEXT_PUBLIC_APP_URL", "WHOP_API_BASE_URL", "WHOP_API_KEY", "WHOP_COMPANY_ID", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;
const saved: Record<string, string | undefined> = {};
let whop: ReturnType<typeof whopFetch>;

beforeEach(() => {
  h.flag = true;
  h.rate = { success: true, limit: 20, remaining: 19, reset: 0 };
  h.limitCalls = [];
  h.storeDown = false;
  h.db = fakeReferralDb();
  h.db.state.user = { id: ME, user_metadata: { full_name: "Nia Carter" } };
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.NEXT_PUBLIC_APP_URL = "https://maven.example.test";
  whop = whopFetch();
  vi.stubGlobal("fetch", whop.http);
  clearEarnCaches();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const get = () => GET();
const nothingRead = () => {
  expect(h.db.state.calls).toEqual([]);
  expect(h.db.state.adminCalls).toEqual([]);
};

describe("who may ask", () => {
  it("flag off: 404, and nothing is read, not even the session", async () => {
    h.flag = false;
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
    expect(h.db.state.authCalls).toBe(0);
    nothingRead();
  });

  it("signed out: 401 Unauthorized, nothing read", async () => {
    h.db.state.user = null;
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    nothingRead();
  });

  it("a funnel visitor (anonymous session): 404, and no code is made for them", async () => {
    h.db.state.user = { id: ME, is_anonymous: true };
    expect((await get()).status).toBe(404);
    nothingRead();
  });
});

describe("the answer", () => {
  it("signed in, any plan: exactly link, code, name, joined and whop (Whop not configured here)", async () => {
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP" });
    h.db.state.accounts.push({ id: "acct-new", created_at: "2026-11-20T11:58:00.000Z" });
    h.db.state.tables.referral_clicks!.push({ referral_code: "K349Z4QP", referrer_user_id: ME, referred_user_id: "acct-new", clicked_at: CLICKED });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["code", "joined", "link", "name", "whop"]);
    expect(body).toEqual({
      link: "https://maven.example.test/?ref=K349Z4QP",
      code: "K349Z4QP",
      name: "Nia Carter",
      joined: 1,
      whop: { canEnrol: false, knownAccount: false, username: null, earnedCents: null },
    });
    expect(whop.calls).toEqual([]);
  });

  it("a first view makes the code", async () => {
    const body = await (await get()).json();
    expect(body.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(h.db.state.tables.referral_codes).toEqual([expect.objectContaining({ user_id: ME, code: body.code })]);
  });

  it("a database error: 500 Server error, its text in the server log, no id or code there", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP" });
    h.db.state.failOn = "referral_clicks";
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server error" });
    expect(log).toHaveBeenCalledTimes(1);
    const logged = log.mock.calls[0]!.map(String).join(" ");
    expect(logged).toMatch(/^\[earn\] page read failed:.*connection reset by peer/);
    expect(logged).not.toMatch(/acct-nia|K349Z4QP/);
  });
});

describe("the payment side (ruling 16)", () => {
  beforeEach(() => {
    process.env.WHOP_API_BASE_URL = TEST_BASE;
    process.env.WHOP_API_KEY = TEST_KEY;
    process.env.WHOP_COMPANY_ID = TEST_COMPANY;
  });

  it("settings read from the environment when asked: an enrolled creator gets what Whop says they earned", async () => {
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP", whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    whop = whopFetch([{ method: "GET", path: "/affiliates/aff_test1", answer: { status: 200, json: affiliateJson({ earned: "24.50" }) } }]);
    vi.stubGlobal("fetch", whop.http);
    const body = await (await get()).json();
    expect(body.whop).toEqual({ canEnrol: true, knownAccount: false, username: "nia.cooks", earnedCents: 2450 });
    expect(whop.calls).toEqual([expect.objectContaining({ url: `${TEST_BASE}/affiliates/aff_test1`, headers: { authorization: `Bearer ${TEST_KEY}` } })]);
  });

  it("no company id: canEnrol false, and Whop is not asked", async () => {
    delete process.env.WHOP_COMPANY_ID;
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP", whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    const body = await (await get()).json();
    expect(body.whop).toEqual({ canEnrol: false, knownAccount: false, username: "nia.cooks", earnedCents: null });
    expect(whop.calls).toEqual([]);
  });

  it("the key never reaches the answer", async () => {
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP" });
    expect(JSON.stringify(await (await get()).json())).not.toContain(TEST_KEY);
  });

  it("flag off: 404, and Whop is not asked", async () => {
    h.flag = false;
    expect((await get()).status).toBe(404);
    expect(whop.calls).toEqual([]);
  });
});

describe("under the shared rate limiter (ruling 34)", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://ratelimit.example.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "made-up-token";
    h.db.state.tables.referral_codes!.push({ user_id: ME, code: "K349Z4QP", whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  });

  it("inside the limit: answered, counted for the session's id under the route's own key", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(h.limitCalls).toEqual([ME]);
    expect(h.prefixes).toContain("rl:tools:earn");
  });

  it("over the limit: its 429 as it answers, and nothing is read, made or asked of Whop", async () => {
    process.env.WHOP_API_BASE_URL = TEST_BASE;
    process.env.WHOP_API_KEY = TEST_KEY;
    process.env.WHOP_COMPANY_ID = TEST_COMPANY;
    h.rate = { success: false, limit: 20, remaining: 0, reset: Date.now() + 30_000 };
    const res = await get();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(h.limitCalls).toEqual([ME]);
    nothingRead();
    expect(whop.calls).toEqual([]);
  });

  it("the limiter's store is down: the page still answers (it fails open)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.storeDown = true;
    expect((await get()).status).toBe(200);
  });

  it("signed out, a funnel visitor, the flag off: refused before the limiter is asked", async () => {
    h.db.state.user = null;
    expect((await get()).status).toBe(401);
    h.db.state.user = { id: ME, is_anonymous: true };
    expect((await get()).status).toBe(404);
    h.flag = false;
    expect((await get()).status).toBe(404);
    expect(h.limitCalls).toEqual([]);
  });
});
