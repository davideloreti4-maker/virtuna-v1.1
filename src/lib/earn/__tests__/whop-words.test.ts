/**
 * Step B's pure parts (rulings 13, 16, 17 and 33): the forms a Whop username, a Whop user id and an affiliate
 * id may take, and every word of the card `Get paid`, each built from the constants (`moneyWord` has its
 * own test, `money-word.test.ts`).
 * Pure: no stand-ins. Every username is made up.
 */
import { describe, expect, it } from "vitest";

import {
  EARN_RATE_PCT,
  EARN_RULE,
  WHOP_AFFILIATE_ID_PATTERN,
  WHOP_USERNAME_PATTERN,
  WHOP_USER_ID_PATTERN,
  WHOP_WAIT_DAYS,
  enrolledAs,
  whopUsernameOf,
} from "../earn";
import { GET_PAID_STRINGS, earnedLine, howItWorks, paidByLine } from "../earn-words";

describe("a typed Whop username (ruling 13)", () => {
  it.each([
    ["nia.cooks", "nia.cooks"],
    ["@nia.cooks", "nia.cooks"],
    ["  @Nia_Cooks-2 ", "Nia_Cooks-2"],
    ["a", "a"],
    ["x".repeat(64), "x".repeat(64)],
  ])("%j is %j", (typed, username) => {
    expect(whopUsernameOf(typed)).toBe(username);
  });

  it.each([
    ["", "empty"],
    ["@", "only the @"],
    ["@@nia", "two @"],
    ["nia cooks", "a space"],
    ["nia@example.test", "an email address"],
    ["x".repeat(65), "65 characters"],
    ["nía", "a letter outside A to Z"],
    ["nia/cooks", "a slash"],
  ])("%j is refused (%s)", (typed) => {
    expect(whopUsernameOf(typed)).toBeNull();
  });

  it("anything but text is refused", () => {
    for (const value of [undefined, null, 42, { username: "nia.cooks" }]) expect(whopUsernameOf(value)).toBeNull();
  });

  it("the form is the one ruled: 1 to 64 of A to Z, a to z, 0 to 9, dot, underscore, hyphen", () => {
    expect(WHOP_USERNAME_PATTERN.source).toBe("^[A-Za-z0-9._-]{1,64}$");
  });
});

describe("the ids Whop answers", () => {
  it("an affiliate id is aff_ and 1 to 64 letters or digits", () => {
    expect(WHOP_AFFILIATE_ID_PATTERN.source).toBe("^aff_[A-Za-z0-9]{1,64}$");
    expect(WHOP_AFFILIATE_ID_PATTERN.test("aff_test1")).toBe(true);
    expect(WHOP_AFFILIATE_ID_PATTERN.test("aff_")).toBe(false);
    expect(WHOP_AFFILIATE_ID_PATTERN.test("aff_te st")).toBe(false);
  });

  it("a Whop user id is user_ or usr_ and letters or digits: never an email address", () => {
    expect(WHOP_USER_ID_PATTERN.test("user_test1")).toBe(true);
    expect(WHOP_USER_ID_PATTERN.test("usr_test1")).toBe(true);
    expect(WHOP_USER_ID_PATTERN.test("user_nia@example.test")).toBe(false);
    expect(WHOP_USER_ID_PATTERN.test("nia@example.test")).toBe(false);
    expect(WHOP_USER_ID_PATTERN.test("user_")).toBe(false);
  });
});

describe("enrolled: a row that holds both the username and the affiliate id, each of its form", () => {
  it("both there: enrolled as that account", () => {
    expect(enrolledAs({ whop_username: "nia.cooks", whop_affiliate_id: "aff_test1" })).toEqual({ username: "nia.cooks", affiliateId: "aff_test1" });
  });

  it.each([
    ["no row", null],
    ["neither", { whop_username: null, whop_affiliate_id: null }],
    ["a username alone", { whop_username: "nia.cooks", whop_affiliate_id: null }],
    ["an affiliate id alone", { whop_username: null, whop_affiliate_id: "aff_test1" }],
    ["a username of another form", { whop_username: "nia@example.test", whop_affiliate_id: "aff_test1" }],
    ["an affiliate id of another form", { whop_username: "nia.cooks", whop_affiliate_id: "user_test1" }],
    ["something that is not text", { whop_username: 42, whop_affiliate_id: "aff_test1" }],
  ])("%s: not enrolled", (_why, row) => {
    expect(enrolledAs(row)).toBeNull();
  });
});

describe("the words of Get paid (rulings 17, 33 and 43)", () => {
  it("are exactly the ruled ones", () => {
    expect(GET_PAID_STRINGS).toEqual({
      title: "Get paid",
      lead: "Whop, our payment partner, pays your share to your Whop account.",
      notCredited: "Sales made before you set this up are not credited.",
      setUp: "Set up payouts",
      addUsername: "Add your Whop username to get paid.",
      field: "Whop username",
      placeholder: "yourname",
      save: "Save",
      change: "Change",
      notFound: "We couldn't find that Whop username.",
      notAvailable: "Payouts aren't available yet.",
      failed: "Couldn't set up payouts. Try again.",
      alreadyConnected: "That Whop account is already connected.",
    });
  });

  it("enrolled: who is paid, and when", () => {
    expect(paidByLine("nia.cooks")).toBe("Paid by Whop to @nia.cooks, 14 to 30 days after a creator's first payment.");
    expect(WHOP_WAIT_DAYS).toEqual({ from: 14, to: 30 });
  });

  it("with a known number, the top says it", () => {
    expect(earnedLine(2450)).toBe("$24.50 earned");
    expect(earnedLine(0)).toBe("$0 earned");
  });

  it("How it works, line 3, names Whop only when asked to", () => {
    expect(howItWorks()[2]).toBe("When they start paying, you earn 50% of their first month.");
    expect(howItWorks(EARN_RULE, { paidByWhop: true })).toEqual([
      "Share your link or the card.",
      "A creator opens it and subscribes within 30 days, on the same device.",
      "When they start paying, you earn 50% of their first month. Whop pays you 14 to 30 days later.",
    ]);
  });

  it("every sentence follows the constants", () => {
    const other = { ratePct: 30, firstPaymentOnly: false, linkDays: 60 };
    expect(howItWorks(other, { paidByWhop: true })[2]).toBe("When they start paying, you earn 30% of each payment they make. Whop pays you 14 to 30 days later.");
    expect(paidByLine("nia.cooks", other)).toBe("Paid by Whop to @nia.cooks, 14 to 30 days after each payment.");
    expect(EARN_RATE_PCT).toBe(50);
  });
});
