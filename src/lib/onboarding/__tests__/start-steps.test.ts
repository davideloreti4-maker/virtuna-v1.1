/**
 * start-steps.ts (plan 01-start-and-profile, Task 3): a visitor can go back to any step, never past the first
 * question they have not answered; the address and the bar.
 */
import { describe, expect, it } from "vitest";

import type { StartAnswers } from "../answers";
import { barOf, firstOpenStep, nextStep, previousStep, resolveStep, startHref, stepParamOf } from "../start-steps";

const NONE: StartAnswers = { platforms: [], nicheSource: "typed" };
const PLATFORM: StartAnswers = { platforms: ["tiktok"], tiktokHandle: "nia", nicheSource: "typed" };
const NICHE: StartAnswers = { ...PLATFORM, niche: "budget meals" };
const ACCOUNT_NICHE: StartAnswers = { ...PLATFORM, nicheSource: "account" };
const ALL: StartAnswers = { ...NICHE, goal: "growth" };

describe("firstOpenStep", () => {
  it.each([
    ["nothing answered", NONE, "platform"],
    ["the platform", PLATFORM, "niche"],
    ["a typed niche", NICHE, "goal"],
    ["'work it out'", ACCOUNT_NICHE, "goal"],
    ["everything", ALL, "account"],
  ] as const)("%s: %s", (_, answers, want) => {
    expect(firstOpenStep(answers)).toBe(want);
  });
});

describe("resolveStep", () => {
  it("nothing asked: the first open step", () => {
    expect(resolveStep(null, NICHE)).toBe("goal");
  });
  it("an earlier step: that step", () => {
    expect(resolveStep("platform", ALL)).toBe("platform");
    expect(resolveStep("niche", ALL)).toBe("niche");
  });
  it("a step past the first open one: the first open one", () => {
    expect(resolveStep("account", PLATFORM)).toBe("niche");
    expect(resolveStep("goal", NONE)).toBe("platform");
  });
});

describe("the address and the bar", () => {
  it("reads only a known step", () => {
    expect(stepParamOf("niche")).toBe("niche");
    for (const value of ["pay", "", null, undefined, ["niche"]]) expect(stepParamOf(value)).toBeNull();
  });
  it("back and next", () => {
    expect(previousStep("platform")).toBeNull();
    expect(previousStep("account")).toBe("goal");
    expect(nextStep("goal")).toBe("account");
    expect(nextStep("account")).toBeNull();
  });
  it("the bar fills one segment per question; the account step has none", () => {
    expect([barOf("platform"), barOf("niche"), barOf("goal"), barOf("account")]).toEqual([1, 2, 3, null]);
  });
  it("the address", () => {
    expect(startHref("goal")).toBe("/start?step=goal");
  });
});
