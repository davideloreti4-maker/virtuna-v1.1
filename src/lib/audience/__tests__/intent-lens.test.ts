/**
 * Tests for intent-lens.ts — GAP-C2 resolution (§P.10).
 *
 * Spec ("keep 2, derive down"):
 *  - goalIntentToLens: 4-value goal_intent → 2-value lens. grow→grow, sell→sell,
 *    authority→grow, nurture→grow, null/undefined→grow.
 *  - parseIntentLens: narrows untrusted body input to grow|sell, else undefined.
 */
import { describe, it, expect } from "vitest";
import { goalIntentToLens, parseIntentLens } from "../intent-lens";

describe("goalIntentToLens — 4→2 derive-down (GAP-C2)", () => {
  it("grow → grow", () => {
    expect(goalIntentToLens("grow")).toBe("grow");
  });

  it("sell → sell (the only non-grow lens)", () => {
    expect(goalIntentToLens("sell")).toBe("sell");
  });

  it("authority → grow (strategic posture, baked at calibration; neutral run lens)", () => {
    expect(goalIntentToLens("authority")).toBe("grow");
  });

  it("nurture → grow (retention posture; neutral run lens)", () => {
    expect(goalIntentToLens("nurture")).toBe("grow");
  });

  it("null → grow (General / no goal set)", () => {
    expect(goalIntentToLens(null)).toBe("grow");
  });

  it("undefined → grow", () => {
    expect(goalIntentToLens(undefined)).toBe("grow");
  });
});

describe("parseIntentLens — untrusted body narrowing", () => {
  it("accepts 'grow'", () => {
    expect(parseIntentLens("grow")).toBe("grow");
  });

  it("accepts 'sell'", () => {
    expect(parseIntentLens("sell")).toBe("sell");
  });

  it.each([
    ["authority (a 4-value goal_intent, not a lens)", "authority"],
    ["nurture", "nurture"],
    ["empty string", ""],
    ["arbitrary string", "buy"],
    ["number", 1],
    ["object", { intent: "sell" }],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s → undefined", (_label, input) => {
    expect(parseIntentLens(input)).toBeUndefined();
  });
});
