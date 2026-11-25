/**
 * Enrolling at Whop (rulings 13, 14, 26, 27, 33 and 42): who is enrolled under which identifier, the
 * commission set once per plan and BEFORE anything is stored (enrolled means every configured plan has it),
 * one Whop account for one creator, one enrolment at a time per creator and per Whop account, and three
 * attempts an hour per creator. Real: the enrolment, the Whop client, the rules, the gate. Stood in for:
 * `fetch` toward Whop (`whop-fetch.ts`), the database behind the service client (`fake-referral-db.ts`) and
 * the clock. Every id, key and username is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PLANS = vi.hoisted(() => {
  const plans = {
    WHOP_PRODUCT_ID_STARTER: "plan_full_starter",
    WHOP_PRODUCT_ID_PRO: "plan_full_pro",
    WHOP_PRODUCT_ID_STUDIO: "plan_full_studio",
    WHOP_TRIAL_PLAN_ID_STARTER: "plan_trial_starter",
    WHOP_TRIAL_PLAN_ID_PRO: "plan_trial_pro",
    WHOP_TRIAL_PLAN_ID_STUDIO: "plan_trial_studio",
  };
  // The plan ids are read when `src/lib/whop/config.ts` loads: set before any import.
  Object.assign(process.env, plans);
  return plans;
});

import { clearEarnCaches, earnedCache, earnedKey, earnedUnreadable } from "../earn-cache";
import { ENROL_ATTEMPTS_PER_HOUR, clearEnrolGate, commissionPlanIds, enrolAtWhop, setCommission, type EnrolDeps } from "../enrol";
import { fakeReferralDb, type FakeReferralDb } from "./fake-referral-db";
import { TEST_BASE, TEST_COMPANY, TEST_KEY, affiliateJson, whopFetch, type Route } from "./whop-fetch";

const ME = "acct-nia";
const SIX = Object.values(PLANS);
const SETTINGS = { baseUrl: TEST_BASE, apiKey: TEST_KEY, companyId: TEST_COMPANY };

let db: FakeReferralDb;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  db = fakeReferralDb();
  db.state.tables.referral_codes!.push({ id: "c1", user_id: ME, code: "K349Z4QP", whop_username: null, whop_affiliate_id: null });
  db.state.tables.referral_codes!.push({ id: "c2", user_id: "acct-other", code: "QWERTY23", whop_username: null, whop_affiliate_id: null });
  clearEarnCaches();
  clearEnrolGate();
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Whop's answers for a full enrolment: the affiliate, an empty list of overrides, and each override set. */
function whop(over: { affiliate?: Route["answer"]; overrides?: Route["answer"]; override?: Route["answer"] } = {}) {
  return whopFetch([
    { method: "POST", path: "/affiliates", answer: over.affiliate ?? { status: 200, json: affiliateJson() } },
    { method: "GET", path: "/affiliates/aff_test1/overrides", answer: over.overrides ?? { status: 200, json: { data: [] } } },
    { method: "POST", path: "/affiliates/aff_test1/overrides", answer: over.override ?? { status: 200, json: { id: "ovr_new" } } },
    { method: "POST", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { id: "ovr_new" } } },
    { method: "GET", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { data: [] } } },
  ]);
}
const deps = (http: EnrolDeps["http"], over: Partial<EnrolDeps> = {}): EnrolDeps => ({
  admin: db.serviceClient() as unknown as EnrolDeps["admin"],
  http,
  settings: SETTINGS,
  planIds: SIX,
  ...over,
});
const myRow = () => db.state.tables.referral_codes!.find((r) => r.user_id === ME)!;
const logged = () => log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");

describe("who may enrol, and under which identifier (ruling 13)", () => {
  it("not configured (no key or no company id): not_available, and nothing is called or stored", async () => {
    const { http, calls } = whop();
    expect(await enrolAtWhop(deps(http, { settings: null }), ME, "nia.cooks")).toEqual({ kind: "not_available" });
    expect(calls).toEqual([]);
    expect(db.state.calls).toEqual([]);
  });

  it("a typed username: sent without its @, and the username Whop answers is the one stored", async () => {
    const { http, calls } = whop({ affiliate: { status: 200, json: affiliateJson({ username: "Nia.Cooks" }) } });
    const result = await enrolAtWhop(deps(http), ME, "  @nia.cooks ");
    expect(calls[0]).toMatchObject({ method: "POST", url: `${TEST_BASE}/affiliates`, body: { account_id: TEST_COMPANY, user_identifier: "nia.cooks" } });
    expect(result).toMatchObject({ kind: "enrolled", username: "Nia.Cooks", affiliateId: "aff_test1" });
    expect(myRow()).toMatchObject({ whop_username: "Nia.Cooks", whop_affiliate_id: "aff_test1" });
  });

  it.each(["nia@example.test", "nia cooks", "", "@"])("a typed text that is not a Whop username (%j): invalid_username, nothing sent", async (typed) => {
    const { http, calls } = whop();
    expect(await enrolAtWhop(deps(http), ME, typed)).toEqual({ kind: "invalid_username" });
    expect(calls).toEqual([]);
    expect(myRow().whop_username).toBeNull();
  });

  it("no username: a paying customer is enrolled by their stored Whop user id", async () => {
    db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" });
    const { http, calls } = whop();
    expect(await enrolAtWhop(deps(http), ME, undefined)).toMatchObject({ kind: "enrolled", username: "nia.cooks" });
    expect(calls[0]!.body).toEqual({ account_id: TEST_COMPANY, user_identifier: "user_test1" });
    const read = db.state.calls.find((c) => c.table === "user_subscriptions")!;
    expect(read).toMatchObject({ op: "select", columns: "whop_user_id", filters: [["user_id", ME]], client: "service" });
  });

  it.each([
    ["no subscription row", null],
    ["a row without a Whop user id", { user_id: ME, whop_user_id: null }],
    ["an email address where the id should be (never sent)", { user_id: ME, whop_user_id: "nia@example.test" }],
  ])("no username and %s: no_account, nothing sent", async (_why, row) => {
    if (row) db.state.tables.user_subscriptions!.push(row);
    const { http, calls } = whop();
    expect(await enrolAtWhop(deps(http), ME, undefined)).toEqual({ kind: "no_account" });
    expect(calls).toEqual([]);
  });

  it("another person's subscription is not mine", async () => {
    db.state.tables.user_subscriptions!.push({ user_id: "acct-other", whop_user_id: "user_test9" });
    const { http } = whop();
    expect(await enrolAtWhop(deps(http), ME, undefined)).toEqual({ kind: "no_account" });
  });
});

describe("what Whop answers", () => {
  it("Whop finds nobody (404): not_found, nothing stored", async () => {
    const { http, calls } = whop({ affiliate: { status: 404, json: {} } });
    expect(await enrolAtWhop(deps(http), ME, "nobody.here")).toEqual({ kind: "not_found" });
    expect(calls).toHaveLength(1);
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
  });

  it.each([
    ["a refusal", { status: 500, json: {} }],
    ["an affiliate without a username", { status: 200, json: affiliateJson({ username: null }) }],
    ["no answer at all", "network-error" as const],
  ])("%s: failed, nothing stored, logged by kind only", async (_why, answer) => {
    const { http, calls } = whop({ affiliate: answer });
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toEqual({ kind: "failed" });
    expect(calls).toHaveLength(1);
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    expect(logged()).toMatch(/^\[earn\] whop enrol failed:/);
    expect(logged()).not.toMatch(/nia\.cooks|aff_test1|acct-nia|user_test1|test-key/);
  });
});

describe("what is stored (through the service client, for the session's id only)", () => {
  it("both columns, on the caller's row alone", async () => {
    const { http } = whop();
    await enrolAtWhop(deps(http), ME, "nia.cooks");
    const write = db.state.calls.find((c) => c.op === "update")!;
    expect(write).toMatchObject({
      table: "referral_codes",
      client: "service",
      values: { whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" },
      filters: [["user_id", ME]],
    });
    expect(db.state.tables.referral_codes!.find((r) => r.user_id === "acct-other")).toMatchObject({ whop_username: null, whop_affiliate_id: null });
  });

  it("Change: a second enrolment with a new username overwrites both columns", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    const second = whopFetch([
      { method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson({ id: "aff_test2", username: "nia.bakes" }) } },
      { method: "GET", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { data: [] } } },
      { method: "POST", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: {} } },
    ]);
    expect(await enrolAtWhop(deps(second.http), ME, "nia.bakes")).toMatchObject({ kind: "enrolled", username: "nia.bakes", affiliateId: "aff_test2" });
    expect(myRow()).toMatchObject({ whop_username: "nia.bakes", whop_affiliate_id: "aff_test2" });
  });

  it("a database error on the write throws (the route answers 500)", async () => {
    db.state.failOn = "referral_codes";
    await expect(enrolAtWhop(deps(whop().http), ME, "nia.cooks")).rejects.toThrow(/referral_codes/);
  });

  it("no row to write to throws: an enrolment is never lost without a word", async () => {
    db.state.tables.referral_codes = db.state.tables.referral_codes!.filter((r) => r.user_id !== ME);
    await expect(enrolAtWhop(deps(whop().http), ME, "nia.cooks")).rejects.toThrow(/referral_codes/);
  });

  it("what Whop says was earned is remembered for the page", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    expect(earnedCache.get(earnedKey(ME, "aff_test1"))).toBe(1250);
  });

  it("a number that could not be read a moment ago is no longer remembered as unreadable", async () => {
    earnedUnreadable.set(earnedKey(ME, "aff_test1"), true);
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    expect(earnedUnreadable.get(earnedKey(ME, "aff_test1"))).toBeNull();
    expect(earnedCache.get(earnedKey(ME, "aff_test1"))).toBe(1250);
  });
});

describe("the commission (ruling 14)", () => {
  it("lists the overrides once and sets one standard override per plan the app sells: six", async () => {
    const { http, calls } = whop();
    const result = await enrolAtWhop(deps(http), ME, "nia.cooks");
    expect(calls.filter((c) => c.method === "GET")).toHaveLength(1);
    const sets = calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"));
    expect(sets.map((c) => (c.body as { plan_id: string }).plan_id).sort()).toEqual([...SIX].sort());
    for (const c of sets) {
      expect(c.body).toEqual({
        override_type: "standard",
        id: "aff_test1",
        plan_id: (c.body as { plan_id: string }).plan_id,
        commission_type: "percentage",
        commission_value: 50,
        applies_to_payments: "first_payment",
      });
    }
    expect(result).toMatchObject({ commission: { set: 6, kept: 0, failed: 0 } });
  });

  it("a plan that already has one is left alone", async () => {
    const { http, calls } = whop({
      overrides: { status: 200, json: { data: [{ id: "ovr_1", plan_id: "plan_full_pro" }, { id: "ovr_2", plan_id: "plan_trial_pro" }, { id: "ovr_3", plan_id: "plan_elsewhere" }] } },
    });
    const result = await enrolAtWhop(deps(http), ME, "nia.cooks");
    const sets = calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides")).map((c) => (c.body as { plan_id: string }).plan_id);
    expect(sets.sort()).toEqual(["plan_full_starter", "plan_full_studio", "plan_trial_starter", "plan_trial_studio"]);
    expect(result).toMatchObject({ commission: { set: 4, kept: 2, failed: 0 } });
  });

  it("a plan that answers 2xx with no body at all is set (what counts is the status)", async () => {
    const { http } = whop({ override: { status: 201, text: "" } });
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled", commission: { set: 6, kept: 0, failed: 0 } });
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  });

  it("an unset plan id is skipped, and a plan named twice is set once", async () => {
    const { http, calls } = whopFetch([
      { method: "GET", path: "/affiliates/aff_test1/overrides", answer: { status: 200, json: { data: [] } } },
      { method: "POST", path: "/affiliates/aff_test1/overrides", answer: { status: 200, json: {} } },
    ]);
    expect(await setCommission(http, SETTINGS, "aff_test1", ["plan_full_pro", undefined, "", "plan_full_pro", null])).toEqual({ set: 1, kept: 0, failed: 0 });
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("no plan configured: nothing is listed or set", async () => {
    const { http, calls } = whopFetch();
    expect(await setCommission(http, SETTINGS, "aff_test1", [undefined, undefined])).toEqual({ set: 0, kept: 0, failed: 0 });
    expect(calls).toEqual([]);
  });

  it("the plans the app sells are the three plans and their three trial plans (src/lib/whop/config.ts)", () => {
    expect([...commissionPlanIds()].sort()).toEqual([...SIX].sort());
  });
});

describe("enrolled means the commission is set on every plan (ruling 26)", () => {
  const refuseOne = (plan: string, status = 422): Route["answer"] => (call) =>
    (call.body as { plan_id: string }).plan_id === plan ? { status, json: { error: "nia.cooks plan_trial_pro" } } : { status: 200, json: {} };

  it("one plan refused: failed, nothing stored, nothing remembered; the log names the kind only", async () => {
    const { http, calls } = whop({ override: refuseOne("plan_trial_pro") });
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toEqual({ kind: "failed" });
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"))).toHaveLength(6);
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    expect(db.state.calls.filter((c) => c.op === "update")).toEqual([]);
    expect(earnedCache.get(earnedKey(ME, "aff_test1"))).toBeNull();
    expect(logged()).toBe("[earn] whop commission failed: whop refused 422");
  });

  it("a second try finds the affiliate and the five commissions there, sets only the missing one, and then stores", async () => {
    await enrolAtWhop(deps(whop({ override: refuseOne("plan_trial_pro") }).http), ME, "nia.cooks");
    const five = SIX.filter((id) => id !== "plan_trial_pro").map((plan_id, i) => ({ id: `ovr_${i}`, plan_id }));
    const { http, calls } = whop({ overrides: { status: 200, json: { data: five } } });
    const result = await enrolAtWhop(deps(http), ME, "nia.cooks");
    expect(result).toMatchObject({ kind: "enrolled", username: "nia.cooks", commission: { set: 1, kept: 5, failed: 0 } });
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides")).map((c) => (c.body as { plan_id: string }).plan_id)).toEqual(["plan_trial_pro"]);
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  });

  it("the list refused: nothing is set (it could be set twice), failed, nothing stored", async () => {
    const { http, calls } = whop({ overrides: { status: 500, json: {} } });
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toEqual({ kind: "failed" });
    expect(calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"))).toEqual([]);
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    expect(logged()).toBe("[earn] whop commission failed: whop refused 500");
  });

  it("the row is written only after every plan answered", async () => {
    const order: string[] = [];
    const inner = whop();
    const http: EnrolDeps["http"] = async (input, init) => {
      const res = await inner.http(input, init);
      order.push(`whop ${init.method} ${db.state.calls.some((c) => c.op === "update") ? "after" : "before"} the write`);
      return res;
    };
    await enrolAtWhop(deps(http), ME, "nia.cooks");
    expect(order).toHaveLength(8);
    expect(order.every((line) => line.endsWith("before the write"))).toBe(true);
    expect(db.state.calls.filter((c) => c.op === "update")).toHaveLength(1);
  });
});

describe("one Whop account, one creator (ruling 33)", () => {
  const other = () => db.state.tables.referral_codes!.find((r) => r.user_id === "acct-other")!;

  it("a username already stored on another creator's row: already_connected, nothing stored, no commission touched", async () => {
    Object.assign(other(), { whop_username: "nia.cooks", whop_affiliate_id: "aff_test7" });
    const { http, calls } = whop();
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toEqual({ kind: "already_connected" });
    expect(calls.map((c) => `${c.method} ${c.url.slice(TEST_BASE.length)}`)).toEqual(["POST /affiliates"]);
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    expect(earnedCache.get(earnedKey(ME, "aff_test1"))).toBeNull();
  });

  it("an affiliate id already stored on another creator's row (the account was renamed since): already_connected", async () => {
    Object.assign(other(), { whop_username: "nia.old", whop_affiliate_id: "aff_test1" });
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toEqual({ kind: "already_connected" });
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
  });

  it("the paying customer's button is refused the same way", async () => {
    db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" });
    Object.assign(other(), { whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    expect(await enrolAtWhop(deps(whop().http), ME, undefined)).toEqual({ kind: "already_connected" });
  });

  it("the check is the server's: two reads through the service client, each leaving out the caller's own row", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    const checks = db.state.calls.filter((c) => c.table === "referral_codes" && c.op === "select");
    expect(checks).toEqual([
      expect.objectContaining({ client: "service", columns: "user_id", filters: [["whop_username", "nia.cooks"]], neq: [["user_id", ME]], limit: 1 }),
      expect.objectContaining({ client: "service", columns: "user_id", filters: [["whop_affiliate_id", "aff_test1"]], neq: [["user_id", ME]], limit: 1 }),
    ]);
  });

  it("the caller's own account, enrolled again, is not 'another creator'", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled", username: "nia.cooks" });
  });

  it("a database error on the check throws (the route answers 500), and nothing is set at Whop", async () => {
    db.state.failOn = "referral_codes";
    const { http, calls } = whop();
    await expect(enrolAtWhop(deps(http), ME, "nia.cooks")).rejects.toThrow(/referral_codes/);
    expect(calls).toHaveLength(1);
  });

  it("another creator's row takes the same account while the commissions are set: a write the database refuses as a duplicate is answered already_connected", async () => {
    db.state.serverWritesOnly = true;
    // The other creator's write lands while this one's commissions are being set, after its own check.
    const inner = whop();
    const http: EnrolDeps["http"] = async (input, init) => {
      if (init.method === "GET") Object.assign(other(), { whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
      return inner.http(input, init);
    };
    expect(await enrolAtWhop(deps(http), ME, "nia.cooks")).toEqual({ kind: "already_connected" });
    expect(myRow()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
    expect(earnedCache.get(earnedKey(ME, "aff_test1"))).toBeNull();
  });
});

/** A Whop that answers nothing until it is let go. */
function heldWhop() {
  const inner = whop();
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const http: EnrolDeps["http"] = async (input, init) => {
    await held;
    return inner.http(input, init);
  };
  return { http, calls: inner.calls, release };
}

describe("one enrolment at a time per creator (ruling 27)", () => {
  it("a second request while one runs is busy, and sends nothing to Whop; the first finishes as usual", async () => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    const second = whop();
    expect(await enrolAtWhop(deps(second.http), ME, "nia.cooks")).toEqual({ kind: "busy" });
    expect(second.calls).toEqual([]);
    first.release();
    expect(await running).toMatchObject({ kind: "enrolled" });
    expect(first.calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"))).toHaveLength(6);
  });

  it("once it is done the creator may enrol again (Change), and so they may after one that failed", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    expect(await enrolAtWhop(deps(whop({ affiliate: { status: 500, json: {} } }).http), ME, "nia.cooks")).toEqual({ kind: "failed" });
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled" });
  });

  it("an enrolment that threw does not leave the creator busy", async () => {
    db.state.failOn = "referral_codes";
    await expect(enrolAtWhop(deps(whop().http), ME, "nia.cooks")).rejects.toThrow();
    db.state.failOn = null;
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled" });
  });

  it("another creator is not held up", async () => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    const theirs = whopFetch([
      { method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson({ id: "aff_test2", username: "sam.lifts" }) } },
      { method: "GET", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { data: [] } } },
      { method: "POST", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: {} } },
    ]);
    expect(await enrolAtWhop(deps(theirs.http), "acct-other", "sam.lifts")).toMatchObject({ kind: "enrolled", username: "sam.lifts" });
    first.release();
    await running;
  });
});

describe("one enrolment at a time per Whop account too (ruling 42)", () => {
  const OTHER = "acct-other";
  const other = () => db.state.tables.referral_codes!.find((r) => r.user_id === OTHER)!;
  const commissionsSet = (calls: Array<{ method: string; url: string }>) => calls.filter((c) => c.method === "POST" && c.url.endsWith("/overrides"));

  it("two creators send the same Whop username in the same moment: the second is busy and sends nothing to Whop", async () => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    const second = whop();
    expect(await enrolAtWhop(deps(second.http), OTHER, "nia.cooks")).toEqual({ kind: "busy" });
    expect(second.calls).toEqual([]);
    first.release();
    expect(await running).toMatchObject({ kind: "enrolled", username: "nia.cooks" });
    // One creator's six commissions, and one row.
    expect(commissionsSet(first.calls)).toHaveLength(6);
    expect(myRow()).toMatchObject({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    expect(other()).toMatchObject({ whop_username: null, whop_affiliate_id: null });
  });

  it.each(["Nia.Cooks", " @NIA.COOKS ", "@nia.cooks"])("the same username typed as %j is the same Whop account", async (typed) => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    const second = whop();
    expect(await enrolAtWhop(deps(second.http), OTHER, typed)).toEqual({ kind: "busy" });
    expect(second.calls).toEqual([]);
    first.release();
    await running;
  });

  it("two creators enrolled by the same stored Whop user id in the same moment: the second is busy", async () => {
    db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" }, { user_id: OTHER, whop_user_id: "user_test1" });
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, undefined);
    const second = whop();
    expect(await enrolAtWhop(deps(second.http), OTHER, undefined)).toEqual({ kind: "busy" });
    expect(second.calls).toEqual([]);
    first.release();
    expect(await running).toMatchObject({ kind: "enrolled" });
  });

  it("once the first is done the Whop account is held no more: the second creator is answered by the rule (already connected)", async () => {
    await enrolAtWhop(deps(whop().http), ME, "nia.cooks");
    const second = whop();
    expect(await enrolAtWhop(deps(second.http), OTHER, "nia.cooks")).toEqual({ kind: "already_connected" });
    expect(commissionsSet(second.calls)).toEqual([]);
  });

  it("an enrolment that threw, or one that failed, does not leave the Whop account held", async () => {
    db.state.failOn = "referral_codes";
    await expect(enrolAtWhop(deps(whop().http), ME, "nia.cooks")).rejects.toThrow();
    db.state.failOn = null;
    expect(await enrolAtWhop(deps(whop({ affiliate: { status: 500, json: {} } }).http), ME, "nia.cooks")).toEqual({ kind: "failed" });
    expect(await enrolAtWhop(deps(whop().http), OTHER, "nia.cooks")).toMatchObject({ kind: "enrolled", username: "nia.cooks" });
  });

  it("busy for the Whop account is not one of the creator's attempts of the hour", async () => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    for (let i = 0; i < ENROL_ATTEMPTS_PER_HOUR + 2; i++) expect(await enrolAtWhop(deps(whop().http), OTHER, "nia.cooks")).toEqual({ kind: "busy" });
    first.release();
    await running;
    const nobody = () => whop({ affiliate: { status: 404, json: {} } });
    for (let i = 0; i < ENROL_ATTEMPTS_PER_HOUR; i++) expect(await enrolAtWhop(deps(nobody().http), OTHER, `nobody.${i}`)).toEqual({ kind: "not_found" });
    expect(await enrolAtWhop(deps(nobody().http), OTHER, "nobody.9")).toMatchObject({ kind: "too_many" });
  });

  it("a creator held for their own running enrolment does not hold a second Whop account", async () => {
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    // The same creator again, with another username: busy for the creator, and that username stays free.
    expect(await enrolAtWhop(deps(whop().http), ME, "sam.lifts")).toEqual({ kind: "busy" });
    const theirs = whopFetch([
      { method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson({ id: "aff_test2", username: "sam.lifts" }) } },
      { method: "GET", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { data: [] } } },
      { method: "POST", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: {} } },
    ]);
    expect(await enrolAtWhop(deps(theirs.http), OTHER, "sam.lifts")).toMatchObject({ kind: "enrolled", username: "sam.lifts" });
    first.release();
    await running;
  });

  it("a creator's id that reads like a username holds no Whop account, and the other way round", async () => {
    // The two gates are kept apart: a username equal to another creator's id is not that creator.
    const first = heldWhop();
    const running = enrolAtWhop(deps(first.http), ME, "nia.cooks");
    const theirs = whopFetch([
      { method: "POST", path: "/affiliates", answer: { status: 200, json: affiliateJson({ id: "aff_test2", username: ME }) } },
      { method: "GET", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: { data: [] } } },
      { method: "POST", path: "/affiliates/aff_test2/overrides", answer: { status: 200, json: {} } },
    ]);
    expect(await enrolAtWhop(deps(theirs.http), OTHER, ME)).toMatchObject({ kind: "enrolled", username: ME });
    first.release();
    await running;
  });
});

describe(`at most ${ENROL_ATTEMPTS_PER_HOUR} attempts per creator per hour (ruling 33)`, () => {
  const START = "2026-11-24T10:00:00.000Z";
  const nobody = () => whop({ affiliate: { status: 404, json: {} } });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(START));
  });
  const minutesIn = (n: number) => vi.setSystemTime(new Date(Date.parse(START) + n * 60_000));

  it("the fourth attempt inside the hour is refused, says when to come back, and sends nothing to Whop", async () => {
    expect(ENROL_ATTEMPTS_PER_HOUR).toBe(3);
    for (const n of [0, 10, 20]) {
      minutesIn(n);
      expect(await enrolAtWhop(deps(nobody().http), ME, `nobody.${n}`)).toEqual({ kind: "not_found" });
    }
    minutesIn(30);
    const fourth = whop();
    expect(await enrolAtWhop(deps(fourth.http), ME, "nia.cooks")).toEqual({ kind: "too_many", retryAfterSeconds: 30 * 60 });
    expect(fourth.calls).toEqual([]);
    expect(db.state.calls.filter((c) => c.op === "update")).toEqual([]);
  });

  it("an hour after the first attempt, one more is let through", async () => {
    for (const n of [0, 10, 20]) {
      minutesIn(n);
      await enrolAtWhop(deps(nobody().http), ME, `nobody.${n}`);
    }
    minutesIn(59);
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "too_many" });
    minutesIn(60);
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled" });
    // The window slides: the attempts of 0:10, 0:20 and 1:00 are still inside it.
    minutesIn(61);
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "too_many", retryAfterSeconds: 9 * 60 });
  });

  it("an enrolment that worked counts too; a request that never reaches Whop does not", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await enrolAtWhop(deps(whop().http), ME, "not a username")).toEqual({ kind: "invalid_username" });
      expect(await enrolAtWhop(deps(whop().http), ME, undefined)).toEqual({ kind: "no_account" });
      expect(await enrolAtWhop(deps(whop().http, { settings: null }), ME, "nia.cooks")).toEqual({ kind: "not_available" });
    }
    for (let i = 0; i < 3; i++) expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "enrolled" });
    expect(await enrolAtWhop(deps(whop().http), ME, "nia.cooks")).toMatchObject({ kind: "too_many" });
  });

  it("each creator has their own count", async () => {
    for (let i = 0; i < 3; i++) await enrolAtWhop(deps(nobody().http), ME, "nobody.here");
    expect(await enrolAtWhop(deps(nobody().http), "acct-other", "nobody.here")).toEqual({ kind: "not_found" });
  });
});
