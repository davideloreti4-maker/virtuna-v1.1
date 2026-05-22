/**
 * Phase 10 — selectWeights weight redistribution tests.
 * Verifies invariant: sum of weights always ~1.0 (±0.01) regardless of which
 * signals are unavailable. Disabled signals get weight 0, redistributed
 * proportionally to remaining available signals.
 */
import { describe, it, expect } from "vitest";
import { selectWeights } from "../aggregator";

describe("selectWeights — Phase 10 weight redistribution", () => {
  function allAvailable(): Parameters<typeof selectWeights>[0] {
    return {
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: true,
      personas: true,
      audio: true,
      retrieval: true,
      platform_fit: true,
    };
  }

  /**
   * Test 1 — ALL 8 signals available.
   * Every non-disabled signal returns a positive weight; ml=0 (Phase 10 D-05).
   * Sum of all weights must be approximately 1.0 (within ±0.01).
   */
  it("returns weights for all 8 signals summing to ~1.0", () => {
    const weights = selectWeights(allAvailable());

    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.gemini).toBeGreaterThan(0);
    expect(weights.ml).toBe(0); // D-05: disabled
    expect(weights.rules).toBe(0); // D-14: rules weight=0
    expect(weights.trends).toBeGreaterThan(0);
    expect(weights.audio).toBeGreaterThan(0);
    expect(weights.retrieval).toBe(0); // D-15: retrieval weight=0
    expect(weights.platform_fit).toBeGreaterThan(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 2 — ml signal unavailable.
   * ml weight must be 0; remaining 7 signals redistribute ml's share
   * proportionally; sum of all weights must still be ~1.0.
   */
  it("redistributes ml weight when ml=false; sum ~1.0", () => {
    const availability = allAvailable();
    availability.ml = false;

    const weights = selectWeights(availability);

    expect(weights.ml).toBe(0);
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.gemini).toBeGreaterThan(0);
    expect(weights.rules).toBe(0); // D-14: rules weight=0
    expect(weights.trends).toBeGreaterThan(0);
    expect(weights.audio).toBeGreaterThan(0);
    expect(weights.retrieval).toBe(0); // D-15: retrieval weight=0
    expect(weights.platform_fit).toBeGreaterThan(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 3 — retrieval signal unavailable.
   * retrieval weight must be 0; remaining 7 signals redistribute
   * retrieval's share proportionally; sum still ~1.0.
   */
  it("redistributes retrieval weight when retrieval=false; sum ~1.0", () => {
    const availability = allAvailable();
    availability.retrieval = false;

    const weights = selectWeights(availability);

    expect(weights.retrieval).toBe(0);
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.gemini).toBeGreaterThan(0);
    expect(weights.ml).toBe(0); // D-05: disabled
    expect(weights.rules).toBe(0); // D-14: rules weight=0
    expect(weights.trends).toBeGreaterThan(0);
    expect(weights.audio).toBeGreaterThan(0);
    expect(weights.platform_fit).toBeGreaterThan(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 4 — platform_fit signal unavailable.
   * platform_fit weight must be 0; remaining 7 signals redistribute
   * platform_fit's share proportionally; sum still ~1.0.
   */
  it("redistributes platform_fit weight when platform_fit=false; sum ~1.0", () => {
    const availability = allAvailable();
    availability.platform_fit = false;

    const weights = selectWeights(availability);

    expect(weights.platform_fit).toBe(0);
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.gemini).toBeGreaterThan(0);
    expect(weights.ml).toBe(0); // D-05: disabled
    expect(weights.rules).toBe(0); // D-14: rules weight=0
    expect(weights.trends).toBeGreaterThan(0);
    expect(weights.audio).toBeGreaterThan(0);
    expect(weights.retrieval).toBe(0); // D-15: retrieval weight=0

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 5 — ml AND retrieval both unavailable.
   * Both weights must be 0; remaining 6 signals redistribute the combined
   * missing share proportionally; sum still ~1.0.
   */
  it("redistributes both ml and retrieval weight when both disabled; sum ~1.0", () => {
    const availability = allAvailable();
    availability.ml = false;
    availability.retrieval = false;

    const weights = selectWeights(availability);

    expect(weights.ml).toBe(0);
    expect(weights.retrieval).toBe(0);
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.gemini).toBeGreaterThan(0);
    expect(weights.rules).toBe(0); // D-14: rules weight=0
    expect(weights.trends).toBeGreaterThan(0);
    expect(weights.audio).toBeGreaterThan(0);
    expect(weights.platform_fit).toBeGreaterThan(0);

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });
});
