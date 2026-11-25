/**
 * The referral cookies and the form of a code (Earn, rulings 29 and 30): the second cookie's name, how the
 * server reads one cookie out of a request's `Cookie` header, and what a referral code looks like (the
 * generator's own alphabet and length). Pure: no stand-ins. Every code is made up.
 */
import { describe, expect, it } from "vitest";

import { REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH, generateReferralCode, isReferralCode } from "../code-generator";
import { REFERRAL_COOKIE_NAME } from "../constants";
import { REFERRAL_AT_COOKIE_NAME, cookieOf } from "../cookies";

describe("the two cookies", () => {
  it("the code's cookie keeps its name; the time of the first opening is the same name with _at", () => {
    expect(REFERRAL_COOKIE_NAME).toBe("virtuna_referral");
    expect(REFERRAL_AT_COOKIE_NAME).toBe("virtuna_referral_at");
  });
});

describe("cookieOf: one cookie of a request", () => {
  const header = "sb-access=abc.def; virtuna_referral=K349Z4QP; virtuna_referral_at=2026-11-24T12%3A00%3A00.000Z; other=1";

  it("reads a value by its exact name, decoded", () => {
    expect(cookieOf(header, "virtuna_referral")).toBe("K349Z4QP");
    expect(cookieOf(header, "virtuna_referral_at")).toBe("2026-11-24T12:00:00.000Z");
    expect(cookieOf(header, "other")).toBe("1");
  });

  it("a name that only starts or ends the same is another cookie", () => {
    expect(cookieOf("virtuna_referral_at=2026-11-24T12%3A00%3A00.000Z", "virtuna_referral")).toBeUndefined();
    expect(cookieOf("my_virtuna_referral=K349Z4QP", "virtuna_referral")).toBeUndefined();
  });

  it("a value that holds an equals sign is kept whole", () => {
    expect(cookieOf("token=a=b=c", "token")).toBe("a=b=c");
  });

  it("absent, no header, or a value that cannot be decoded: undefined", () => {
    expect(cookieOf(header, "nope")).toBeUndefined();
    expect(cookieOf(null, "virtuna_referral")).toBeUndefined();
    expect(cookieOf(undefined, "virtuna_referral")).toBeUndefined();
    expect(cookieOf("", "virtuna_referral")).toBeUndefined();
    expect(cookieOf("virtuna_referral=%E0%A4%A", "virtuna_referral")).toBeUndefined();
  });

  it("the first one wins when a name is sent twice", () => {
    expect(cookieOf("virtuna_referral=K349Z4QP; virtuna_referral=QWERTY23", "virtuna_referral")).toBe("K349Z4QP");
  });
});

describe("isReferralCode: the generator's own form", () => {
  it("is 8 characters of the generator's alphabet", () => {
    expect(REFERRAL_CODE_LENGTH).toBe(8);
    expect(REFERRAL_CODE_ALPHABET).toBe("23456789ABCDEFGHJKLMNPQRSTUVWXYZ");
    expect(isReferralCode("K349Z4QP")).toBe(true);
    for (let i = 0; i < 50; i++) expect(isReferralCode(generateReferralCode())).toBe(true);
  });

  it.each([
    ["", "empty"],
    ["K349Z4Q", "7 characters"],
    ["K349Z4QPX", "9 characters"],
    ["k349z4qp", "lower case"],
    ["K349Z4Q0", "a zero (not in the alphabet)"],
    ["K349Z4QI", "an I (not in the alphabet)"],
    ["K349Z4Q ", "a space"],
    ["K349Z4QP\n", "a line break after it"],
    ["K349%2CQP", "an encoded comma"],
    ["K349Z4QP,user_id.eq.x", "a filter after it"],
  ])("%j is not a code (%s)", (value) => {
    expect(isReferralCode(value)).toBe(false);
  });

  it("anything but text is not a code", () => {
    for (const value of [undefined, null, 42, ["K349Z4QP"], { code: "K349Z4QP" }]) expect(isReferralCode(value)).toBe(false);
  });
});
