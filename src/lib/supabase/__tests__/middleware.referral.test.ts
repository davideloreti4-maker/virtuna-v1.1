/**
 * The middleware's referral cookies (Earn, ruling 30). On the first opening of a link (`?ref=CODE`) it sets
 * the code's cookie, as it always has, and now also the time of that opening, with the same options. While
 * the code's cookie exists neither is set again: the first link wins, and so does its time. Real: the
 * middleware, the cookie names and their life. Stood in for: Supabase's server client (the session) and the
 * clock. Every code is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { onboarding_completed_at: "2026-01-01T00:00:00Z" }, error: null }) }) }) }),
  }),
}));

import { NextRequest } from "next/server";

import { REFERRAL_COOKIE_MAX_AGE, REFERRAL_COOKIE_NAME } from "@/lib/referral/constants";
import { REFERRAL_AT_COOKIE_NAME, cookieOf } from "@/lib/referral/cookies";

import { updateSession } from "../middleware";

const ORIGIN = "https://maven.example.test";
const NOW = "2026-11-24T12:00:00.000Z";

beforeEach(() => {
  mockUser = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

const visit = (path: string, cookie?: string) => updateSession(new NextRequest(new URL(path, ORIGIN), cookie ? { headers: { cookie } } : undefined));
/** As the response carries them: Next adds the date the life (`maxAge`) ends. */
const OPTIONS = {
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "lax",
  maxAge: REFERRAL_COOKIE_MAX_AGE,
  expires: new Date(Date.parse(NOW) + REFERRAL_COOKIE_MAX_AGE * 1000),
};

describe("the first opening of a link", () => {
  it("sets the code and the time of the opening, with the same options", async () => {
    const res = await visit("/?ref=K349Z4QP");
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toEqual({ name: "virtuna_referral", value: "K349Z4QP", ...OPTIONS });
    expect(res.cookies.get(REFERRAL_AT_COOKIE_NAME)).toEqual({ name: "virtuna_referral_at", value: NOW, ...OPTIONS });
    expect(REFERRAL_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30);
    expect(res.headers.get("location")).toBeNull();
  });

  it("what the browser sends back is read as the same code and the same time (the checkout's reading)", async () => {
    const res = await visit("/?ref=K349Z4QP");
    // The browser returns each cookie's name=value as the response wrote it.
    const sentBack = res.headers
      .getSetCookie()
      .map((line) => line.split(";")[0])
      .join("; ");
    expect(sentBack).toBe("virtuna_referral=K349Z4QP; virtuna_referral_at=2026-11-24T12%3A00%3A00.000Z");
    expect(cookieOf(sentBack, REFERRAL_COOKIE_NAME)).toBe("K349Z4QP");
    expect(cookieOf(sentBack, REFERRAL_AT_COOKIE_NAME)).toBe(NOW);
  });

  it("on any page that takes a link: the sign-up page too, and a signed-in page for its member", async () => {
    const signup = await visit("/signup?ref=K349Z4QP");
    expect(signup.cookies.get(REFERRAL_AT_COOKIE_NAME)?.value).toBe(NOW);
    mockUser = { id: "acct-nia" };
    const home = await visit("/home?ref=K349Z4QP");
    expect(home.cookies.get(REFERRAL_COOKIE_NAME)?.value).toBe("K349Z4QP");
    expect(home.cookies.get(REFERRAL_AT_COOKIE_NAME)?.value).toBe(NOW);
  });

  it("a time cookie left over without its code is set again with the new code", async () => {
    const res = await visit("/?ref=QWERTY23", `${REFERRAL_AT_COOKIE_NAME}=2026-10-01T08%3A00%3A00.000Z`);
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)?.value).toBe("QWERTY23");
    expect(res.cookies.get(REFERRAL_AT_COOKIE_NAME)?.value).toBe(NOW);
  });
});

describe("while the code's cookie exists, neither is written", () => {
  it("another link later: the first code and its time stay", async () => {
    const res = await visit("/?ref=QWERTY23", `${REFERRAL_COOKIE_NAME}=K349Z4QP; ${REFERRAL_AT_COOKIE_NAME}=2026-11-20T08%3A00%3A00.000Z`);
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
    expect(res.cookies.get(REFERRAL_AT_COOKIE_NAME)).toBeUndefined();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("a code set before this change (no time yet): no time is made up for it", async () => {
    const res = await visit("/?ref=K349Z4QP", `${REFERRAL_COOKIE_NAME}=K349Z4QP`);
    expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
    expect(res.cookies.get(REFERRAL_AT_COOKIE_NAME)).toBeUndefined();
  });
});

describe("no link", () => {
  it("a page without ?ref sets neither", async () => {
    mockUser = { id: "acct-nia" };
    for (const path of ["/", "/home", "/login"]) {
      const res = await visit(path);
      expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
      expect(res.cookies.get(REFERRAL_AT_COOKIE_NAME)).toBeUndefined();
    }
  });
});
