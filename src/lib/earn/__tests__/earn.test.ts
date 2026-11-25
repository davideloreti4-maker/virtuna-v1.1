/**
 * The Earn rules (plan 2026-11-24-earn, step A; rulings 6, 8 and 10): the constants, and what counts as
 * a creator who joined through a link. Pure: no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { REFERRAL_COOKIE_MAX_AGE } from "@/lib/referral/constants";
import {
  EARN_FIRST_PAYMENT_ONLY,
  EARN_LINK_DAYS,
  EARN_RATE_PCT,
  JOINED_WITHIN_HOURS,
  countsAsJoined,
  joinedCount,
} from "../earn";

const HOUR = 3_600_000;
const CLICKED = "2026-11-20T12:00:00.000Z";
const before = (ms: number) => new Date(Date.parse(CLICKED) - ms).toISOString();

describe("the constants (ruling 10)", () => {
  it("are 50%, the first month only, and a link that counts for 30 days", () => {
    expect(EARN_RATE_PCT).toBe(50);
    expect(EARN_FIRST_PAYMENT_ONLY).toBe(true);
    expect(EARN_LINK_DAYS).toBe(30);
  });

  it("the 30 days are the days the link's cookie lives: the page cannot promise more than the app keeps", () => {
    expect(EARN_LINK_DAYS * 24 * 60 * 60).toBe(REFERRAL_COOKIE_MAX_AGE);
  });
});

describe("countsAsJoined (ruling 8): an account created after it opened the link", () => {
  it("counts an account created at the sign-in that wrote the row (minutes before it)", () => {
    expect(countsAsJoined(before(5 * 60_000), CLICKED)).toBe(true);
  });

  it(`counts an account created exactly ${JOINED_WITHIN_HOURS} hours before the row, not a millisecond more`, () => {
    expect(JOINED_WITHIN_HOURS).toBe(24);
    expect(countsAsJoined(before(24 * HOUR), CLICKED)).toBe(true);
    expect(countsAsJoined(before(24 * HOUR + 1), CLICKED)).toBe(false);
  });

  it("does not count an older account signing in again through the link", () => {
    expect(countsAsJoined(before(30 * 24 * HOUR), CLICKED)).toBe(false);
  });

  it("counts an account whose creation the clock puts after the row (it cannot be older than the link)", () => {
    expect(countsAsJoined(new Date(Date.parse(CLICKED) + 2_000).toISOString(), CLICKED)).toBe(true);
  });

  it.each([
    [null, CLICKED],
    [before(HOUR), null],
    [undefined, CLICKED],
    ["not a time", CLICKED],
    [before(HOUR), "not a time"],
  ])("a missing or unreadable time (%s, %s) does not count", (created, clicked) => {
    expect(countsAsJoined(created, clicked)).toBe(false);
  });
});

describe("joinedCount: the creators who joined through the caller's link", () => {
  const created = new Map<string, string | null>([
    ["acct-new", before(HOUR)],
    ["acct-new-2", before(2 * HOUR)],
    ["acct-old", before(90 * 24 * HOUR)],
    ["acct-unknown", null],
  ]);

  it("counts each referred account once, when it was created at most a day before its row", () => {
    const rows = [
      { referredUserId: "acct-new", clickedAt: CLICKED },
      { referredUserId: "acct-new-2", clickedAt: CLICKED },
      { referredUserId: "acct-old", clickedAt: CLICKED },
      { referredUserId: "acct-unknown", clickedAt: CLICKED },
      { referredUserId: "acct-gone", clickedAt: CLICKED },
    ];
    expect(joinedCount(rows, created, "acct-me")).toBe(2);
  });

  it("an account listed twice counts once", () => {
    const rows = [
      { referredUserId: "acct-new", clickedAt: CLICKED },
      { referredUserId: "acct-new", clickedAt: CLICKED },
    ];
    expect(joinedCount(rows, created, "acct-me")).toBe(1);
  });

  it("a row whose account was deleted (no id) and the caller's own account never count", () => {
    const own = new Map([["acct-me", before(HOUR)]]);
    expect(joinedCount([{ referredUserId: null, clickedAt: CLICKED }, { referredUserId: "acct-me", clickedAt: CLICKED }], own, "acct-me")).toBe(0);
  });

  it("no rows: 0", () => {
    expect(joinedCount([], created, "acct-me")).toBe(0);
  });
});
