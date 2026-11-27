/**
 * Earn's words (ruling 10), each built from the constants in `earn.ts` so a ruling changes one line.
 * Pure: no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { EARN_STRINGS, MONEY_GOAL_CENTS, earnedAmount, goalWord, howItWorks, joinedLine, ratePct, rateSubtitle, shortMoneyWord, whopTimingLine } from "../earn-words";

describe("the words at the top of the page", () => {
  it("are the rate subtitle, the goal, and the footer's timing", () => {
    expect(rateSubtitle()).toBe("50% of each referred creator's first month.");
    expect(goalWord()).toBe("$65k goal");
    expect(whopTimingLine()).toBe("Whop pays your share 14 to 30 days after a creator's first payment.");
  });

  it.each([
    ["not enrolled", { username: null, earnedCents: null }, "$0"],
    ["payment side unknown", null, "$0"],
    ["enrolled, a number", { username: "nia", earnedCents: 2450 }, "$24.50"],
    ["enrolled, a known zero", { username: "nia", earnedCents: 0 }, "$0"],
    ["enrolled, unreadable", { username: "nia", earnedCents: null }, null],
  ])("earnedAmount, %s", (_why, whop, amount) => {
    expect(earnedAmount(whop)).toBe(amount);
  });

  it.each([
    [0, "0 creators joined through your link"],
    [1, "1 creator joined through your link"],
    [3, "3 creators joined through your link"],
    [1240, "1,240 creators joined through your link"],
  ])("joinedLine(%i) is %s", (n, words) => {
    expect(joinedLine(n)).toBe(words);
  });
});

describe("How it works", () => {
  it("is the three lines of rulings 10 and 43", () => {
    expect(howItWorks()).toEqual([
      "Share your link or the card.",
      "A creator opens it and subscribes within 30 days, on the same device.",
      "When they start paying, you earn 50% of their first month.",
    ]);
  });
});

describe("every sentence follows the constants", () => {
  const other = { ratePct: 30, firstPaymentOnly: false, linkDays: 60 };

  it("another rate and another link time change every sentence that states them", () => {
    expect(ratePct(other)).toBe("30%");
    expect(howItWorks(other)[1]).toBe("A creator opens it and subscribes within 60 days, on the same device.");
    expect(howItWorks(other)[2]).toBe("When they start paying, you earn 30% of each payment they make.");
    expect(rateSubtitle(other)).toBe("30% of everything each referred creator pays.");
    expect(whopTimingLine(other)).toBe("Whop pays your share 14 to 30 days after each payment.");
  });

  it("a one-day link says day, not days", () => {
    expect(howItWorks({ ...other, linkDays: 1 })[1]).toBe("A creator opens it and subscribes within 1 day, on the same device.");
  });
});

describe("the fixed words", () => {
  it("are the ones ruling 10 and the plan name", () => {
    expect(EARN_STRINGS).toEqual({
      title: "Earn",
      pageTitle: "Your Earnings",
      cardTitle: "Get paid for every creator you bring",
      earningsLabel: "Earnings",
      emptyTitle: "No earnings yet",
      emptyHint: "Share your link or the card.",
      statEarned: "Earned",
      statJoined: "Creators joined",
      statPaidBy: "Paid by",
      notSetUp: "Payouts not set up",
      yourLink: "Your link",
      copy: "Copy",
      copied: "Copied",
      share: "Share",
      saveImage: "Save image",
      youEarn: "YOU EARN",
      sharedBy: "SHARED BY",
      howItWorks: "How it works",
      shareText: "Simulate your videos before you post them. Try Maven:",
      loadFailed: "Couldn't load Earn. Try again.",
      tryAgain: "Try again",
      loading: "Loading",
      qrName: "QR code of your link",
      fileName: "maven-earn.png",
    });
  });
});

describe("the goal Home's Money made row counts toward (owner 2026-11-26)", () => {
  it("is $65k", () => {
    expect(MONEY_GOAL_CENTS).toBe(6_500_000);
    expect(shortMoneyWord(MONEY_GOAL_CENTS)).toBe("$65k");
  });

  it.each([
    [0, "$0"],
    [80_000, "$800"],
    [150_000, "$1.5k"],
    [100_000, "$1k"],
    [6_500_000, "$65k"],
    [99_990_000, "$999.9k"],
    [200_000_000, "$2M"],
    [125_000_000, "$1.3M"],
    [Number.NaN, "$0"],
  ])("%i cents in short words: %s", (cents, words) => {
    expect(shortMoneyWord(cents)).toBe(words);
  });
});
