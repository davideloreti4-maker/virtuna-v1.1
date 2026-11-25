/**
 * Who referred a buyer (rulings 29, 30, 31 and 35): decided at checkout from the buyer's own referral
 * cookies, read by the server, and from what the server itself knows: the code's owner (service client),
 * never the buyer, enrolled at Whop, a buyer with no subscription history, an account created after the
 * link was opened. `referral_clicks` is never read. Real: the rule, the time limit, the row writer. Stood in
 * for: the database behind the service client (`fake-referral-db.ts`), the request's `Cookie` header, the
 * buyer's subscription read (the route's own, passed in) and the clock. Every id, code and username is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral/constants";

import { JOINED_WITHIN_HOURS } from "../earn";
import { REFERRAL_ROW_MS } from "../referral-row";
import {
  OPENING_TOLERANCE_MS,
  REFERRER_LOOKUP_MS,
  checkoutReferrer,
  hasSubscriptionHistory,
  recordAttributed,
  referrerOf,
  type Referrer,
  type ReferrerInput,
  type SubscriptionRead,
} from "../referrer-of";
import { fakeReferralDb, type FakeReferralDb } from "./fake-referral-db";

const BUYER = "acct-buyer";
const NOW = "2026-11-24T12:00:00.000Z";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();
/** The link was opened 20 minutes ago; the account was made 5 minutes ago. */
const OPENED = at(-20 * MIN);
const CREATED = at(-5 * MIN);

let db: FakeReferralDb;
let subscription: SubscriptionRead;
let subscriptionReads: number;
let adminsMade: number;

const service = () => {
  adminsMade += 1;
  return db.serviceClient() as unknown as ReturnType<NonNullable<ReferrerInput["makeAdmin"]>>;
};
const cookies = (code: string | null = "K349Z4QP", openedAt: string | null = OPENED) =>
  [code === null ? null : `virtuna_referral=${code}`, openedAt === null ? null : `virtuna_referral_at=${encodeURIComponent(openedAt)}`, "other=1"].filter(Boolean).join("; ");
const input = (over: Partial<ReferrerInput> = {}): ReferrerInput => ({
  configured: true,
  buyer: { id: BUYER, created_at: CREATED },
  cookies: cookies(),
  subscription: async () => {
    subscriptionReads += 1;
    return subscription;
  },
  makeAdmin: service,
  now: Date.parse(NOW),
  ...over,
});
function owner(id: string, code: string, username: string | null, affiliateId: string | null = username ? "aff_test1" : null) {
  db.state.tables.referral_codes!.push({ id: `c-${id}`, user_id: id, code, whop_username: username, whop_affiliate_id: affiliateId });
}
const NIA: Referrer = { affiliateCode: "nia.cooks", code: "K349Z4QP", referrerId: "acct-nia", clickedAt: OPENED };
const nothingRead = () => {
  expect(db.state.calls).toEqual([]);
  expect(adminsMade).toBe(0);
  expect(subscriptionReads).toBe(0);
};

beforeEach(() => {
  db = fakeReferralDb();
  subscription = { data: null, error: null };
  subscriptionReads = 0;
  adminsMade = 0;
  owner("acct-nia", "K349Z4QP", "nia.cooks");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("referrerOf: the code in the buyer's cookie, and its owner", () => {
  it("a new account that opened an enrolled creator's link: that creator's stored Whop username", async () => {
    expect(await referrerOf(input())).toEqual(NIA);
  });

  it("reads the code's owner once, with the service client, and nothing else in the database", async () => {
    await referrerOf(input());
    expect(db.state.calls).toEqual([
      expect.objectContaining({ table: "referral_codes", op: "select", client: "service", columns: "user_id, whop_username, whop_affiliate_id", filters: [["code", "K349Z4QP"]] }),
    ]);
    expect(subscriptionReads).toBe(1);
  });

  it("the referrer comes from the code's owner: referral_clicks is never read, and its rows decide nothing", async () => {
    owner("acct-sam", "QWERTY23", "sam.lifts", "aff_test2");
    // Rows of referral_clicks that name another creator for this buyer, one of them under the cookie's code.
    db.state.tables.referral_clicks!.push(
      { id: "k1", referral_code: "QWERTY23", referrer_user_id: "acct-sam", referred_user_id: BUYER, clicked_at: at(-300 * DAY) },
      { id: "k2", referral_code: "K349Z4QP", referrer_user_id: "acct-sam", referred_user_id: BUYER, clicked_at: at(-300 * DAY) },
    );
    expect(await referrerOf(input())).toEqual(NIA);
    expect(await referrerOf(input({ cookies: "other=1" }))).toBeNull();
    expect(db.state.calls.some((c) => c.table === "referral_clicks")).toBe(false);
  });

  it("Whop not configured here (no company id): nobody, and nothing is read", async () => {
    expect(await referrerOf(input({ configured: false }))).toBeNull();
    nothingRead();
  });

  it.each([
    ["no Cookie header", null],
    ["no referral cookie", "other=1"],
    ["only the time cookie", `virtuna_referral_at=${encodeURIComponent(OPENED)}`],
  ])("%s: nobody, and nothing is read", async (_why, header) => {
    expect(await referrerOf(input({ cookies: header }))).toBeNull();
    nothingRead();
  });

  it.each([
    ["lower case", "k349z4qp"],
    ["too short", "K349Z4Q"],
    ["too long", "K349Z4QPP"],
    ["a letter outside the alphabet", "K349Z4QO"],
    ["a filter after the code", "K349Z4QP%2Cuser_id.neq.x"],
    ["a username where the code should be", "nia.cooks"],
    ["empty", ""],
  ])("a cookie that is not a code (%s): nobody, and nothing is read", async (_why, code) => {
    expect(await referrerOf(input({ cookies: cookies(code) }))).toBeNull();
    nothingRead();
  });

  it("a code nobody owns: nobody", async () => {
    expect(await referrerOf(input({ cookies: cookies("ZZZZZZZZ") }))).toBeNull();
  });

  it("the buyer's own code: never the buyer", async () => {
    owner(BUYER, "SELFSELF", "buyer.self", "aff_test9");
    expect(await referrerOf(input({ cookies: cookies("SELFSELF") }))).toBeNull();
  });

  it.each([
    ["no stored username", null, null],
    ["a username but no affiliate id (not written by an enrolment)", "nia.cooks", null],
  ])("an owner who is not enrolled (%s): nobody", async (_why, username, affiliateId) => {
    db.state.tables.referral_codes = [];
    owner("acct-nia", "K349Z4QP", username, affiliateId);
    expect(await referrerOf(input())).toBeNull();
  });

  it("a stored username of another form is never sent", async () => {
    // Written behind the fake's check, as a row that predates it could be.
    db.state.tables.referral_codes![0]!.whop_username = "nia@example.test";
    expect(await referrerOf(input())).toBeNull();
  });

  it("a database error on the owner's read throws", async () => {
    db.state.failOn = "referral_codes";
    await expect(referrerOf(input())).rejects.toThrow();
  });
});

describe("only a buyer's first purchase (ruling 35)", () => {
  it.each([
    ["no row at all", null],
    ["a row that never had a membership and never used a trial", { user_id: BUYER, virtuna_tier: "free", status: "active", whop_membership_id: null, whop_user_id: null, trial_used_at: null }],
  ])("%s: attributed", async (_why, row) => {
    subscription = { data: row, error: null };
    expect(await referrerOf(input())).toEqual(NIA);
    expect(hasSubscriptionHistory(row)).toBe(false);
  });

  it.each([
    ["a membership, once", { whop_membership_id: "mem_test1" }],
    ["a known Whop account", { whop_user_id: "user_test1" }],
    ["a plan bought before", { whop_product_id: "plan_full_pro" }],
    ["a trial used", { trial_used_at: "2026-06-01T00:00:00Z" }],
    ["a trial started (rows before trial_used_at)", { trial_started_at: "2026-06-01T00:00:00Z" }],
    ["a trial running", { is_trial: true }],
    ["a paid plan without a membership on record", { virtuna_tier: "pro" }],
    ["a cancelled subscription", { virtuna_tier: "free", status: "cancelled" }],
  ])("%s: nobody", async (_why, row) => {
    subscription = { data: { user_id: BUYER, virtuna_tier: "free", status: "active", ...row }, error: null };
    expect(hasSubscriptionHistory(subscription.data)).toBe(true);
    expect(await referrerOf(input())).toBeNull();
  });

  it("a subscription row that could not be read says nothing: it throws (the checkout then carries no code)", async () => {
    subscription = { data: null, error: { message: "connection reset by peer" } };
    await expect(referrerOf(input())).rejects.toThrow();
  });

  it("the row is the route's own read, asked once", async () => {
    await referrerOf(input());
    expect(subscriptionReads).toBe(1);
    expect(db.state.calls.some((c) => c.table === "user_subscriptions")).toBe(false);
  });
});

describe("only an account created after the link was opened (ruling 30)", () => {
  const created = (createdAt: string | null, openedAt: string | null = OPENED) => referrerOf(input({ buyer: { id: BUYER, created_at: createdAt }, cookies: cookies("K349Z4QP", openedAt) }));

  it("the tolerance is ten minutes", () => {
    expect(OPENING_TOLERANCE_MS).toBe(10 * MIN);
  });

  it("created a second after the opening: attributed, and the row's time is the opening", async () => {
    expect(await created(at(-20 * MIN + 1000))).toEqual(NIA);
  });

  it("created up to ten minutes before the opening (two clocks): attributed; a millisecond more: nobody", async () => {
    expect(await created(at(-30 * MIN))).toEqual(NIA);
    expect(await created(at(-30 * MIN - 1))).toBeNull();
  });

  it("an account that existed long before it opened the link: nobody", async () => {
    expect(await created(at(-200 * DAY))).toBeNull();
    nothingRead();
  });

  it("a link opened three weeks ago, the account made the day after: attributed", async () => {
    const opened = at(-21 * DAY);
    expect(await created(at(-20 * DAY), opened)).toEqual({ ...NIA, clickedAt: opened });
  });

  it("the account's creation time as the sign-in service writes it (microseconds, an offset) is read", async () => {
    expect(await created("2026-11-24T11:55:00.123456+00:00")).toEqual(NIA);
    expect(await created("2026-11-24T11:55:00.123456Z")).toEqual(NIA);
    expect(await created("2026-11-24T11:29:59.999999+00:00")).toBeNull();
  });

  it("the buyer's creation time unknown: nobody", async () => {
    expect(await created(null)).toBeNull();
    expect(await referrerOf(input({ buyer: { id: BUYER } }))).toBeNull();
    expect(await referrerOf(input({ buyer: { id: BUYER, created_at: "not a time" } }))).toBeNull();
  });

  describe("no time cookie (a link opened before this change): an account at most 24 hours old", () => {
    it(`created ${JOINED_WITHIN_HOURS} hours ago: attributed, and the row's time is now`, async () => {
      expect(await created(at(-JOINED_WITHIN_HOURS * HOUR), null)).toEqual({ ...NIA, clickedAt: NOW });
    });

    it("a millisecond older: nobody", async () => {
      expect(await created(at(-JOINED_WITHIN_HOURS * HOUR - 1), null)).toBeNull();
    });
  });

  describe("a time cookie that cannot be a real opening counts as none (the 24-hour rule)", () => {
    const life = REFERRAL_COOKIE_MAX_AGE * 1000;
    it.each([
      ["not a time", "yesterday"],
      ["a date without a time", "2026-11-24"],
      ["a number", "1764000000000"],
      ["in the future", at(OPENING_TOLERANCE_MS + 1)],
      ["older than the cookie can live", at(-life - OPENING_TOLERANCE_MS - 1)],
      ["the first day of time", "1970-01-01T00:00:00.000Z"],
    ])("%s: an old account is not attributed, a new one is (its row's time is now)", async (_why, openedAt) => {
      expect(await created(at(-40 * DAY), openedAt)).toBeNull();
      expect(await created(at(-2 * HOUR), openedAt)).toEqual({ ...NIA, clickedAt: NOW });
    });

    it("an opening exactly as old as the cookie can live still counts", async () => {
      const opened = at(-life);
      expect(await created(at(-life + DAY), opened)).toEqual({ ...NIA, clickedAt: opened });
    });
  });
});

describe("checkoutReferrer: never throws, never waits long", () => {
  it("answers the lookup", async () => {
    expect(await checkoutReferrer(input())).toEqual(NIA);
  });

  it("a failed lookup is nobody, logged by kind only", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.state.failOn = "referral_codes";
    expect(await checkoutReferrer(input())).toBeNull();
    expect(log.mock.calls.map((c) => c.map(String).join(" "))).toEqual(["[checkout] referrer lookup failed: error"]);
  });

  it("a subscription read that throws is nobody", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkoutReferrer(input({ subscription: () => Promise.reject(new Error("socket hang up")) }))).toBeNull();
  });

  it("no database client could be made: nobody", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await checkoutReferrer(
        input({
          makeAdmin: () => {
            throw new Error("supabaseUrl is required.");
          },
        }),
      ),
    ).toBeNull();
  });

  it(`a lookup that hangs is given up after ${REFERRER_LOOKUP_MS} ms: nobody`, async () => {
    expect(REFERRER_LOOKUP_MS).toBe(1_000);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    db.state.hangOn = "referral_codes";
    let answered: Referrer | null | undefined;
    void checkoutReferrer(input()).then((r) => (answered = r));
    await vi.advanceTimersByTimeAsync(REFERRER_LOOKUP_MS - 1);
    expect(answered).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(answered).toBeNull();
    expect(log.mock.calls.map((c) => c.map(String).join(" "))).toEqual(["[checkout] referrer lookup failed: timeout"]);
  });

  it("a subscription read that hangs is given up too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let answered: Referrer | null | undefined;
    void checkoutReferrer(input({ subscription: () => new Promise<SubscriptionRead>(() => {}) })).then((r) => (answered = r));
    await vi.advanceTimersByTimeAsync(REFERRER_LOOKUP_MS);
    expect(answered).toBeNull();
  });

  it("a creator whose Whop username is the word timeout is credited like any other", async () => {
    db.state.tables.referral_codes![0]!.whop_username = "timeout";
    expect(await checkoutReferrer(input())).toEqual({ ...NIA, affiliateCode: "timeout" });
  });
});

describe("recordAttributed: the buyer's referral row, written by the server (ruling 31)", () => {
  const rows = () => db.state.tables.referral_clicks!;

  it("one row for the code's owner and the buyer, at the time the link was opened, through the service client", async () => {
    await recordAttributed(NIA, BUYER, service);
    expect(rows()).toEqual([expect.objectContaining({ referral_code: "K349Z4QP", referrer_user_id: "acct-nia", referred_user_id: BUYER, clicked_at: OPENED })]);
    expect(db.state.calls).toEqual([
      expect.objectContaining({ table: "referral_clicks", op: "insert", client: "service", values: { referral_code: "K349Z4QP", referrer_user_id: "acct-nia", referred_user_id: BUYER, clicked_at: OPENED } }),
    ]);
  });

  it("once per buyer and code: a second write is quiet", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await recordAttributed(NIA, BUYER, service);
    await recordAttributed(NIA, BUYER, service);
    expect(rows()).toHaveLength(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("a write that fails is logged by kind only, and nothing is thrown", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.state.failOn = "referral_clicks";
    await expect(recordAttributed(NIA, BUYER, service)).resolves.toBeUndefined();
    expect(log.mock.calls.map((c) => c.map(String).join(" "))).toEqual(["[checkout] referral row not written: error"]);
  });

  it("no database client could be made: nothing thrown", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAttributed(NIA, BUYER, () => {
        throw new Error("supabaseUrl is required.");
      }),
    ).resolves.toBeUndefined();
  });

  it(`a write that hangs is given up after ${REFERRAL_ROW_MS} ms`, async () => {
    expect(REFERRAL_ROW_MS).toBe(1_000);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    db.state.hangOn = "referral_clicks";
    let done = false;
    void recordAttributed(NIA, BUYER, service).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(REFERRAL_ROW_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(log.mock.calls.map((c) => c.map(String).join(" "))).toEqual(["[checkout] referral row not written: timeout"]);
  });
});
