/**
 * readEarnPage (plan 2026-11-24-earn, steps A and B; rulings 8, 9, 16, 20, 34 and 36): the caller's link and code
 * (made on first view, for any account), the caller's own name for the share card, how many creators
 * joined through the link, and the payment side (`whop`). Real: the read, the rule, the code generator, the
 * Whop client, the server's cache. Stood in for: the database and the auth admin API behind the two clients
 * (`fake-referral-db.ts`), `fetch` toward Whop (`whop-fetch.ts`) and the cache's clock. Every id, code,
 * key and name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EARNED_UNREADABLE_MS, clearEarnCaches } from "../earn-cache";
import { ADMIN_BATCH, EARNED_READ_MS, JOINED_CHECKED_ROWS, readEarnPage } from "../earn-read";
import type { WhopSettings } from "../whop-affiliates";
import { fakeReferralDb, type FakeReferralDb } from "./fake-referral-db";
import { TEST_BASE, TEST_COMPANY, TEST_KEY, affiliateJson, whopFetch, type Route } from "./whop-fetch";

const ME = "acct-nia";
const CLICKED = "2026-11-20T12:00:00.000Z";
const HOUR = 3_600_000;
const before = (ms: number) => new Date(Date.parse(CLICKED) - ms).toISOString();

const SETTINGS: WhopSettings = { baseUrl: TEST_BASE, apiKey: TEST_KEY, companyId: TEST_COMPANY };

let db: FakeReferralDb;
let whop: ReturnType<typeof whopFetch>;
let settings: WhopSettings | null;
const savedUrl = process.env.NEXT_PUBLIC_APP_URL;

beforeEach(() => {
  db = fakeReferralDb();
  whop = whopFetch();
  settings = null;
  clearEarnCaches();
  process.env.NEXT_PUBLIC_APP_URL = "https://maven.example.test";
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = savedUrl;
});

type Args = Parameters<typeof readEarnPage>;
const read = (caller: Args[2] = { id: ME }) =>
  readEarnPage(db.sessionClient() as unknown as Args[0], db.serviceClient() as unknown as Args[1], caller, { http: whop.http, settings });
const NOT_ENROLLED = { canEnrol: false, knownAccount: false, username: null, earnedCents: null };

const withCode = () => db.state.tables.referral_codes!.push({ id: "c1", user_id: ME, code: "K349Z4QP" });
const click = (referred: string | null, clickedAt: string | null = CLICKED, referrer = ME) =>
  db.state.tables.referral_clicks!.push({ id: `k${db.state.tables.referral_clicks!.length}`, referral_code: "K349Z4QP", referrer_user_id: referrer, referred_user_id: referred, clicked_at: clickedAt });
const account = (id: string, createdAt: string) => db.state.accounts.push({ id, created_at: createdAt });

describe("the answer", () => {
  it("is exactly the link, the code, the name, the count and the payment side", async () => {
    withCode();
    const page = await read();
    expect(Object.keys(page).sort()).toEqual(["code", "joined", "link", "name", "whop"]);
    expect(page).toEqual({ link: "https://maven.example.test/?ref=K349Z4QP", code: "K349Z4QP", name: null, joined: 0, whop: NOT_ENROLLED });
  });

  it("an account with no code yet (any plan: nothing reads the tier) gets one on this view", async () => {
    const page = await read();
    expect(page.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    expect(page.link).toBe(`https://maven.example.test/?ref=${page.code}`);
    expect(db.state.tables.referral_codes).toEqual([expect.objectContaining({ user_id: ME, code: page.code })]);
    // Ruling 36: the server writes the code (the service client the route already holds), for the caller's id.
    expect(db.state.calls.filter((c) => c.op === "insert")).toEqual([expect.objectContaining({ table: "referral_codes", client: "service", values: { user_id: ME, code: page.code } })]);
    // The plan is never read: the one read of the subscription is its Whop user id (step B, `knownAccount`).
    expect(db.state.calls.filter((c) => c.table === "user_subscriptions").map((c) => c.columns)).toEqual(["whop_user_id"]);
  });

  it("no code could be made: it throws (the route answers 500), it never answers a link without a code", async () => {
    db.state.codeTaken = 99;
    await expect(read()).rejects.toThrow(/referral code/);
  });
});

describe("the name on the share card: the You page's chain", () => {
  beforeEach(withCode);

  it("the name saved in Settings first", async () => {
    db.state.tables.user_settings!.push({ user_id: ME, display_name: "Nia Carter" });
    db.state.tables.creator_profiles!.push({ user_id: ME, display_name: "nia.cooks" });
    expect((await read({ id: ME, user_metadata: { full_name: "Nia C." } })).name).toBe("Nia Carter");
  });

  it("else the creator profile's, else the sign-in's full name", async () => {
    db.state.tables.creator_profiles!.push({ user_id: ME, display_name: "nia.cooks" });
    expect((await read({ id: ME, user_metadata: { full_name: "Nia C." } })).name).toBe("nia.cooks");
    db.state.tables.creator_profiles = [];
    expect((await read({ id: ME, user_metadata: { full_name: "Nia C." } })).name).toBe("Nia C.");
  });

  it("a blank one is skipped, trimmed; none at all is null", async () => {
    db.state.tables.user_settings!.push({ user_id: ME, display_name: "   " });
    db.state.tables.creator_profiles!.push({ user_id: ME, display_name: "  nia.cooks " });
    expect((await read()).name).toBe("nia.cooks");
    db.state.tables.creator_profiles = [];
    expect((await read({ id: ME, user_metadata: { full_name: 42 } })).name).toBeNull();
  });
});

describe("joined (ruling 8): accounts created after they opened the link", () => {
  beforeEach(withCode);

  it("counts a referred account created at most a day before its row; an older one signing in again does not", async () => {
    account("acct-new-1", before(10 * 60_000));
    account("acct-new-2", before(23 * HOUR));
    account("acct-old", before(200 * 24 * HOUR));
    click("acct-new-1");
    click("acct-new-2");
    click("acct-old");
    // Another referrer's row is not the caller's.
    account("acct-theirs", before(HOUR));
    click("acct-theirs", CLICKED, "acct-someone-else");
    expect((await read()).joined).toBe(2);
  });

  it("reads each referred account's creation time once, through the service role, and only the caller's", async () => {
    account("acct-new-1", before(HOUR));
    click("acct-new-1");
    click(null);
    click(ME);
    await read();
    expect(db.state.adminCalls).toEqual(["acct-new-1"]);
    const clicks = db.state.calls.filter((c) => c.table === "referral_clicks");
    expect(clicks).toEqual([expect.objectContaining({ op: "select", columns: "referred_user_id, clicked_at", filters: [["referrer_user_id", ME]] })]);
  });

  it(`reads many accounts in batches of ${ADMIN_BATCH}, every one of them`, async () => {
    for (let i = 0; i < 45; i++) {
      account(`acct-${i}`, i % 3 === 0 ? before(200 * 24 * HOUR) : before(HOUR));
      click(`acct-${i}`);
    }
    expect((await read()).joined).toBe(30);
    expect(db.state.adminCalls).toHaveLength(45);
  });

  it("no rows: no account is read", async () => {
    expect((await read()).joined).toBe(0);
    expect(db.state.adminCalls).toEqual([]);
  });

  it("an account that no longer exists (404) is not counted; the page still answers", async () => {
    click("acct-gone");
    account("acct-new", before(HOUR));
    click("acct-new");
    expect((await read()).joined).toBe(1);
  });

  it("an account lookup that fails for another reason: that row is not counted, and the page still answers (ruling 20)", async () => {
    account("acct-new", before(HOUR));
    account("acct-new-2", before(HOUR));
    click("acct-new");
    click("acct-new-2", "2026-11-20T12:01:00.000Z");
    db.state.adminFailsFor = ["acct-new"];
    expect((await read()).joined).toBe(1);
  });

  it("a database error on the rows throws", async () => {
    db.state.failOn = "referral_clicks";
    await expect(read()).rejects.toThrow(/referral_clicks/);
  });

  it("nothing of another person is in the answer: no id, no email, no time", async () => {
    account("acct-new", before(HOUR));
    click("acct-new");
    const text = JSON.stringify(await read());
    expect(text).not.toMatch(/acct-new|@example\.test|2026-11-/);
  });
});

describe("joined is bounded, and kept for five minutes (ruling 20)", () => {
  beforeEach(withCode);
  const minutesAfter = (n: number) => new Date(Date.parse(CLICKED) + n * 60_000).toISOString();

  it(`checks only the newest ${JOINED_CHECKED_ROWS} rows, asked with an explicit limit, newest first`, async () => {
    expect(JOINED_CHECKED_ROWS).toBe(200);
    account("acct-new", before(HOUR));
    click("acct-new");
    await read();
    const select = db.state.calls.find((c) => c.table === "referral_clicks" && c.op === "select")!;
    expect(select).toMatchObject({ client: "session", order: [["clicked_at", false]], limit: 200, neq: [["referred_user_id", ME]] });
  });

  it("older rows count as they are: not looked up, one each", async () => {
    // 205 rows: the 200 newest are checked (old accounts among them do not count), the 5 oldest just count.
    for (let i = 0; i < 205; i++) {
      account(`acct-${i}`, i % 2 === 0 ? before(200 * 24 * HOUR) : before(HOUR));
      click(`acct-${i}`, minutesAfter(i));
    }
    const page = await read();
    // Rows 5..204 are the newest 200: the odd ones are new accounts (100); rows 0..4 count as they are (5).
    expect(page.joined).toBe(105);
    expect(db.state.adminCalls).toHaveLength(200);
    expect(db.state.adminCalls).not.toContain("acct-0");
    const count = db.state.calls.filter((c) => c.table === "referral_clicks" && c.columns === "id");
    expect(count).toEqual([expect.objectContaining({ filters: [["referrer_user_id", ME]], neq: [["referred_user_id", ME]] })]);
  });

  it(`fewer than ${JOINED_CHECKED_ROWS} rows: no count is asked`, async () => {
    account("acct-new", before(HOUR));
    click("acct-new");
    await read();
    expect(db.state.calls.filter((c) => c.table === "referral_clicks")).toHaveLength(1);
  });

  it("the checked count is kept for five minutes per creator, then checked again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
    account("acct-new", before(HOUR));
    click("acct-new");
    expect((await read()).joined).toBe(1);
    account("acct-new-2", before(HOUR));
    click("acct-new-2");
    vi.setSystemTime(new Date("2026-11-24T10:04:59.000Z"));
    expect((await read()).joined).toBe(1);
    expect(db.state.adminCalls).toEqual(["acct-new"]);
    vi.setSystemTime(new Date("2026-11-24T10:05:01.000Z"));
    expect((await read()).joined).toBe(2);
    // Another creator's count is their own.
    expect((await read({ id: "acct-someone-else" })).joined).toBe(0);
  });

  it("a count with a failed lookup is not kept: the next view checks again", async () => {
    account("acct-new", before(HOUR));
    click("acct-new");
    db.state.adminFails = true;
    expect((await read()).joined).toBe(0);
    db.state.adminFails = false;
    expect((await read()).joined).toBe(1);
  });
});

describe("the payment side (rulings 13 and 16): whop", () => {
  beforeEach(withCode);
  const myCode = () => db.state.tables.referral_codes!.find((r) => r.user_id === ME)!;
  const enrolled = () => Object.assign(myCode(), { whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
  const affiliate = (answer: Route["answer"]) => {
    whop = whopFetch([{ method: "GET", path: "/affiliates/aff_test1", answer }]);
  };

  it("not configured (no key or no company id): canEnrol false, and Whop is never asked", async () => {
    enrolled();
    expect((await read()).whop).toEqual({ canEnrol: false, knownAccount: false, username: "nia.cooks", earnedCents: null });
    expect(whop.calls).toEqual([]);
  });

  it("configured, not enrolled: canEnrol, and no call to Whop", async () => {
    settings = SETTINGS;
    expect((await read()).whop).toEqual({ ...NOT_ENROLLED, canEnrol: true });
    expect(whop.calls).toEqual([]);
  });

  it("a paying customer (a stored Whop user id) is a known account; an email address there is not", async () => {
    settings = SETTINGS;
    db.state.tables.user_subscriptions!.push({ user_id: ME, whop_user_id: "user_test1" });
    expect((await read()).whop).toMatchObject({ knownAccount: true });
    db.state.tables.user_subscriptions = [{ user_id: ME, whop_user_id: "nia@example.test" }];
    expect((await read()).whop).toMatchObject({ knownAccount: false });
  });

  it("enrolled: the username, and what Whop says was earned, in whole cents", async () => {
    settings = SETTINGS;
    enrolled();
    affiliate({ status: 200, json: affiliateJson({ earned: "24.50" }) });
    expect((await read()).whop).toEqual({ canEnrol: true, knownAccount: false, username: "nia.cooks", earnedCents: 2450 });
    expect(whop.calls).toEqual([expect.objectContaining({ method: "GET", url: `${TEST_BASE}/affiliates/aff_test1`, headers: { authorization: `Bearer ${TEST_KEY}` } })]);
  });

  it("the earned number is read at most once in five minutes per creator", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T10:00:00.000Z"));
    settings = SETTINGS;
    enrolled();
    affiliate({ status: 200, json: affiliateJson({ earned: "24.50" }) });
    await read();
    vi.setSystemTime(new Date("2026-11-24T10:04:59.000Z"));
    expect((await read()).whop?.earnedCents).toBe(2450);
    expect(whop.calls).toHaveLength(1);
    vi.setSystemTime(new Date("2026-11-24T10:05:01.000Z"));
    await read();
    expect(whop.calls).toHaveLength(2);
  });

  it("an enrolled creator with only one of the two columns is not enrolled: no username, no call", async () => {
    settings = SETTINGS;
    Object.assign(myCode(), { whop_username: "nia.cooks", whop_affiliate_id: null });
    expect((await read()).whop).toEqual({ ...NOT_ENROLLED, canEnrol: true });
    expect(whop.calls).toEqual([]);
  });
});

describe("the earned read is cheap (ruling 34)", () => {
  beforeEach(() => {
    withCode();
    settings = SETTINGS;
    Object.assign(db.state.tables.referral_codes!.find((r) => r.user_id === ME)!, { whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  const affiliate = (answer: Route["answer"]) => {
    whop = whopFetch([{ method: "GET", path: "/affiliates/aff_test1", answer }]);
  };
  const UNREADABLE = { canEnrol: true, knownAccount: false, username: "nia.cooks", earnedCents: null };
  const clock = (iso: string) => vi.setSystemTime(new Date(iso));

  it(`waits at most ${EARNED_READ_MS / 1000} seconds for Whop`, async () => {
    expect(EARNED_READ_MS).toBe(3_000);
    const limit = vi.spyOn(AbortSignal, "timeout");
    affiliate({ status: 200, json: affiliateJson({ earned: "24.50" }) });
    await read();
    expect(limit.mock.calls).toEqual([[3_000]]);
    expect(whop.calls[0]!.hasSignal).toBe(true);
  });

  it("a Whop that does not answer in time: the page answers without a number", async () => {
    settings = { ...SETTINGS, timeoutMs: 20 };
    affiliate("hang");
    const page = await read();
    expect(page.whop).toEqual(UNREADABLE);
    expect(page.link).toBe("https://maven.example.test/?ref=K349Z4QP");
  });

  it.each<[string, Route["answer"]]>([
    ["Whop refuses", { status: 500, json: {} }],
    ["Whop is unreachable", "network-error"],
    ["the affiliate is gone", { status: 404, json: {} }],
    ["a number that is not one", { status: 200, json: affiliateJson({ earned: "abc" }) }],
    ["no number at all", { status: 200, json: affiliateJson({ earned: null }) }],
  ])(`unreadable (%s) is remembered for ${EARNED_UNREADABLE_MS / 1000} seconds, as unreadable; then asked again`, async (_why, answer) => {
    expect(EARNED_UNREADABLE_MS).toBe(60_000);
    vi.useFakeTimers({ toFake: ["Date"] });
    clock("2026-11-24T10:00:00.000Z");
    affiliate(answer);
    expect((await read()).whop).toEqual(UNREADABLE);
    expect(whop.calls).toHaveLength(1);

    // Whop is well again, but nobody asks inside the minute.
    affiliate({ status: 200, json: affiliateJson({ earned: "3" }) });
    clock("2026-11-24T10:00:59.000Z");
    expect((await read()).whop).toEqual(UNREADABLE);
    expect(whop.calls).toEqual([]);

    clock("2026-11-24T10:01:01.000Z");
    expect((await read()).whop?.earnedCents).toBe(300);
    expect(whop.calls).toHaveLength(1);
  });

  it("the answer must be the account the creator enrolled as: another username is unreadable, and its number is never shown or kept", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    clock("2026-11-24T10:00:00.000Z");
    affiliate({ status: 200, json: affiliateJson({ username: "someone.else", earned: "9999.00" }) });
    expect((await read()).whop).toEqual(UNREADABLE);
    // Remembered as unreadable, not as a number.
    clock("2026-11-24T10:00:30.000Z");
    expect((await read()).whop).toEqual(UNREADABLE);
    expect(whop.calls).toHaveLength(1);
  });

  it("an answer without a username is unreadable too; the same name in another case is another name", async () => {
    affiliate({ status: 200, json: affiliateJson({ username: null, earned: "5.00" }) });
    expect((await read()).whop).toEqual(UNREADABLE);
    clearEarnCaches();
    affiliate({ status: 200, json: affiliateJson({ username: "Nia.Cooks", earned: "5.00" }) });
    expect((await read()).whop).toEqual(UNREADABLE);
  });

  it("the log names the kind only: no id, no username, no key", async () => {
    const log = vi.mocked(console.error);
    affiliate({ status: 200, json: affiliateJson({ username: "someone.else", earned: "1.00" }) });
    await read();
    clearEarnCaches();
    affiliate({ status: 500, json: {} });
    await read();
    const logged = log.mock.calls.map((c) => c.map(String).join(" "));
    expect(logged).toEqual(["[earn] whop earned read failed: another account", "[earn] whop earned read failed: whop refused 500"]);
    expect(logged.join(" ")).not.toMatch(/acct-nia|nia\.cooks|someone\.else|aff_test1|test-key/);
  });

  it("each creator is answered their own number, also from the memory", async () => {
    db.state.tables.referral_codes!.push({ id: "c2", user_id: "acct-sam", code: "QWERTY23", whop_username: "sam.lifts", whop_affiliate_id: "aff_test2" });
    whop = whopFetch([
      { method: "GET", path: "/affiliates/aff_test1", answer: { status: 200, json: affiliateJson({ earned: "24.50" }) } },
      { method: "GET", path: "/affiliates/aff_test2", answer: { status: 200, json: affiliateJson({ id: "aff_test2", username: "sam.lifts", earned: "7.00" }) } },
    ]);
    for (let round = 0; round < 2; round++) {
      expect((await read({ id: ME })).whop?.earnedCents).toBe(2450);
      expect((await read({ id: "acct-sam" })).whop?.earnedCents).toBe(700);
    }
    expect(whop.calls.map((c) => c.url.slice(TEST_BASE.length))).toEqual(["/affiliates/aff_test1", "/affiliates/aff_test2"]);
  });
});

describe("the payment side: whose rows", () => {
  beforeEach(withCode);

  it("reads the caller's own rows through the session client", async () => {
    settings = SETTINGS;
    await read();
    const reads = db.state.calls.filter((c) => (c.table === "user_subscriptions" || c.table === "referral_codes") && c.columns !== "code");
    expect(reads).toEqual([
      expect.objectContaining({ table: "user_subscriptions", columns: "whop_user_id", filters: [["user_id", ME]], client: "session" }),
      expect.objectContaining({ table: "referral_codes", columns: "whop_username, whop_affiliate_id", filters: [["user_id", ME]], client: "session" }),
    ]);
  });

  it("a payment side that cannot be read (say, before the migration) is null; the page still answers", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    settings = SETTINGS;
    db.state.failOn = "user_subscriptions";
    const page = await read();
    expect(page.whop).toBeNull();
    expect(page.code).toBe("K349Z4QP");
    expect(log.mock.calls.map(String).join(" ")).not.toMatch(/acct-nia|K349Z4QP/);
  });
});
