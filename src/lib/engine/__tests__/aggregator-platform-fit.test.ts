/**
 * Wave 0 test stubs for Phase 9 platform_fit signal in aggregator selectWeights.
 * Tests fail RED — selectWeights does not yet handle platform_fit availability.
 */
import { describe, it, expect } from "vitest";
import { selectWeights } from "../aggregator";

describe("selectWeights — platform_fit signal (Phase 9 Wave 0 stubs)", () => {
  it("returns platform_fit weight when platform_fit signal is available", () => {
    // FAILS: selectWeights does not yet include platform_fit in SCORE_WEIGHT_KEYS.
    // Phase 9 aggregator update (Plan 09-04) will add it and this test passes GREEN.
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
      platform_fit: true,
    });

    expect(weights).toHaveProperty("platform_fit");
    expect(typeof weights.platform_fit).toBe("number");
    expect(weights.platform_fit!).toBeGreaterThan(0);
  });

  it("sets platform_fit to 0 when platform_fit signal is unavailable", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
      platform_fit: false,
    });

    // FAILS: selectWeights does not yet include platform_fit in SCORE_WEIGHT_KEYS.
    expect(weights).toHaveProperty("platform_fit");
    expect(weights.platform_fit).toBe(0);
  });

  it("weights sum to ~1.0 when platform_fit is included", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
      platform_fit: true,
    });

    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 2);
  });
});
