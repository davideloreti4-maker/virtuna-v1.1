/**
 * The auth callback's referral row (rulings 20a and 31, with ruling 8's rule and constant): a sign-in with
 * the referral cookie writes a `referral_clicks` row only for an account created within the last 24 hours,
 * never for the code's owner, once. The SERVER looks the code's owner up and writes the row, with the
 * service client, because the code belongs to another account; so every test here runs with the session
 * held to its own account's rows (`state.sessionAs`). Nothing of this can stop a sign-in: the redirect and
 * the cookie set again are as before whatever happens.
 *
 * Real: the callback, the rule, the row writer, the time limit. Stood in for: Supabase's server client
 * (the code exchange, the session's database) and the service client's database (`fake-referral-db.ts`),
 * and the clock. Every id and code is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  db: null as unknown as import("@/lib/earn/__tests__/fake-referral-db").FakeReferralDb,
  user: null as null | { id: string; created_at?: string },
  serviceMade: 0,
  noService: false,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { exchangeCodeForSession: async () => ({ data: { user: h.user, session: null }, error: null }) },
    from: h.db.from,
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    if (h.noService) throw new Error("supabaseUrl is required.");
    h.serviceMade += 1;
    return h.db.serviceClient();
  },
}));

import { fakeReferralDb } from "@/lib/earn/__tests__/fake-referral-db";
import { JOINED_WITHIN_HOURS } from "@/lib/earn/earn";
import { SIGN_IN_REFERRAL_MS } from "@/lib/earn/referral-row";
import { REFERRAL_COOKIE_NAME } from "@/lib/referral/constants";

import { GET } from "../callback/route";

const NOW = "2026-11-24T12:00:00.000Z";
const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();
const NEW = "acct-new";
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  h.db = fakeReferralDb();
  h.serviceMade = 0;
  h.noService = false;
  h.user = { id: NEW, created_at: ago(10 * 60_000) };
  // The session is the new account's: it reaches only the rows that name it.
  h.db.state.sessionAs = NEW;
  h.db.state.tables.referral_codes!.push({ id: "c1", user_id: "acct-nia", code: "K349Z4QP" });
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const signIn = (cookie = `${REFERRAL_COOKIE_NAME}=K349Z4QP`) =>
  GET(new NextRequest("https://maven.example.test/auth/callback?code=made-up-code&next=/home", { headers: { cookie } }));
const rows = () => h.db.state.tables.referral_clicks!;
const referralCalls = () => h.db.state.calls.filter((c) => c.table === "referral_codes" || c.table === "referral_clicks");
const logged = () => log.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
/** The sign-in itself: the redirect (a new account goes to the welcome page) and the cookie set again. */
function signedIn(res: Response & { cookies: NextRequest["cookies"] | { get(name: string): { value: string } | undefined } }, code = "K349Z4QP") {
  expect(res.status).toBe(307);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/welcome");
  expect(res.cookies.get(REFERRAL_COOKIE_NAME)?.value).toBe(code);
}

describe("the referral row at sign-in (rulings 20a and 31)", () => {
  it("a new account with the cookie: one row, for the link's owner, at this moment", async () => {
    const res = await signIn();
    expect(rows()).toEqual([expect.objectContaining({ referral_code: "K349Z4QP", referrer_user_id: "acct-nia", referred_user_id: NEW, clicked_at: NOW })]);
    signedIn(res);
    expect(logged()).toBe("");
  });

  it("the server looks the owner up and writes the row: both through the service client, none through the session", async () => {
    await signIn();
    expect(referralCalls()).toEqual([
      expect.objectContaining({ table: "referral_codes", op: "select", client: "service", columns: "user_id", filters: [["code", "K349Z4QP"]] }),
      expect.objectContaining({
        table: "referral_clicks",
        op: "insert",
        client: "service",
        values: { referral_code: "K349Z4QP", referrer_user_id: "acct-nia", referred_user_id: NEW, clicked_at: NOW },
      }),
    ]);
  });

  it("the stand-in's own proof: another account's code is not the session's to read", async () => {
    const own = await h.db.from("referral_codes").select("user_id").eq("code", "K349Z4QP").maybeSingle();
    expect(own).toMatchObject({ data: null, error: null });
  });

  it("the row is written with the service client, also where the tables take a new row from it alone", async () => {
    h.db.state.serverWritesOnly = true;
    await signIn();
    expect(rows()).toHaveLength(1);
  });

  it(`an account created exactly ${JOINED_WITHIN_HOURS} hours ago still counts`, async () => {
    h.user = { id: NEW, created_at: ago(JOINED_WITHIN_HOURS * HOUR) };
    await signIn();
    expect(rows()).toHaveLength(1);
  });

  it("an older account signing in with the cookie: no row, no lookup, no service client; the cookie and the redirect as before", async () => {
    h.user = { id: "acct-old", created_at: ago(JOINED_WITHIN_HOURS * HOUR + 1) };
    const res = await signIn();
    expect(rows()).toEqual([]);
    expect(referralCalls()).toEqual([]);
    expect(h.serviceMade).toBe(0);
    signedIn(res);
  });

  it("an account whose creation time is unknown: no row", async () => {
    h.user = { id: NEW };
    signedIn(await signIn());
    expect(rows()).toEqual([]);
  });

  it("the owner's own code: never a row for oneself", async () => {
    h.user = { id: "acct-nia", created_at: ago(60_000) };
    signedIn(await signIn());
    expect(rows()).toEqual([]);
  });

  it("a second sign-in of the same account: still one row, and nothing logged", async () => {
    await signIn();
    signedIn(await signIn());
    expect(rows()).toHaveLength(1);
    expect(logged()).toBe("");
  });

  it("a code nobody owns: no row", async () => {
    signedIn(await signIn(`${REFERRAL_COOKIE_NAME}=ZZZZZZZZ`), "ZZZZZZZZ");
    expect(rows()).toEqual([]);
  });

  it("a cookie that is not a code: nothing is looked up; the cookie is set again as before", async () => {
    signedIn(await signIn(`${REFERRAL_COOKIE_NAME}=nia.cooks`), "nia.cooks");
    expect(referralCalls()).toEqual([]);
    expect(h.serviceMade).toBe(0);
  });

  it("no cookie: nothing, as before", async () => {
    const res = await signIn("other=1");
    expect(rows()).toEqual([]);
    expect(h.serviceMade).toBe(0);
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
  });

  it("the time cookie alone is not a code", async () => {
    const res = await signIn(`${REFERRAL_COOKIE_NAME}_at=2026-11-24T11%3A00%3A00.000Z`);
    expect(referralCalls()).toEqual([]);
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
  });
});

describe("nothing of it can stop a sign-in", () => {
  it("the lookup fails: signed in all the same; the log names the kind only", async () => {
    h.db.state.failOn = "referral_codes";
    signedIn(await signIn());
    expect(rows()).toEqual([]);
    expect(logged()).toBe("[referral] sign-in row not written: error");
  });

  it("the write fails: signed in all the same", async () => {
    h.db.state.failOn = "referral_clicks";
    signedIn(await signIn());
    expect(logged()).toBe("[referral] sign-in row not written: error");
    expect(logged()).not.toMatch(/acct-|K349Z4QP|connection reset/);
  });

  it("no service client can be made (its settings are missing): signed in all the same, no row", async () => {
    h.noService = true;
    signedIn(await signIn());
    expect(rows()).toEqual([]);
    expect(logged()).toBe("[referral] sign-in row not written: error");
  });

  it(`the lookup hangs: given up after ${SIGN_IN_REFERRAL_MS} ms, and the sign-in goes on`, async () => {
    expect(SIGN_IN_REFERRAL_MS).toBe(2_000);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(NOW));
    h.db.state.hangOn = "referral_codes";
    let res: Awaited<ReturnType<typeof signIn>> | undefined;
    void signIn().then((r) => (res = r));
    await vi.advanceTimersByTimeAsync(SIGN_IN_REFERRAL_MS - 1);
    expect(res).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    signedIn(res!);
    expect(logged()).toBe("[referral] sign-in row not written: timeout");
  });
});
