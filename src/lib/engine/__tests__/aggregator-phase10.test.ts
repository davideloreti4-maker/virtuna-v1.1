/**
 * Plan 03-04 (D-04) — selectWeights 2-key blend assertions.
 *
 * Supersedes the Phase 10 8-key redistribution tests. After Plan 03-04 (D-04) rewires
 * the blend to behavioral+apollo (Apollo composite replaces gemini term), the assertions are:
 *   - weights.behavioral + weights.apollo sum to ~1.0 for all availability combos
 *   - platform_fit, audio, gemini keys are ABSENT from the returned weights object
 *   - 2-key redistribution: if behavioral unavailable → apollo=1; vice versa
 *
 * Note: gemini is now provenance-only (not in SCORE_WEIGHT_KEYS).
 */
import { describe, it, expect } from "vitest";
import { selectWeights } from "../aggregator";

describe("selectWeights — 2-key behavioral+apollo blend (Plan 03-04, D-04)", () => {
  /**
   * Test 1 — ALL signals available.
   * Only behavioral+apollo keys returned; platform_fit/audio/gemini ABSENT.
   * Sum ~1.0.
   */
  it("returns only behavioral+apollo keys; platform_fit/audio/gemini ABSENT; sum ~1.0", () => {
    const weights = selectWeights({
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
    });

    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
    // Dead keys MUST be absent from the returned 2-key object
    expect(weights).not.toHaveProperty("platform_fit");
    expect(weights).not.toHaveProperty("audio");
    expect(weights).not.toHaveProperty("ml");
    expect(weights).not.toHaveProperty("rules");
    expect(weights).not.toHaveProperty("trends");
    expect(weights).not.toHaveProperty("retrieval");
    expect(weights).not.toHaveProperty("gemini"); // retired D-04

    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 2 — behavioral unavailable → both apollo and behavioral=0 (same deepseek source).
   * Plan 03-04 (D-04): apollo availability = behavioral (both sourced from deepseekResult !== null).
   * When behavioral=false, deepseek didn't run → apollo also unavailable → both zeros.
   */
  it("behavioral=false → both apollo=0 and behavioral=0 (same deepseek source, D-04)", () => {
    const weights = selectWeights({
      behavioral: false,
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

    expect(weights.behavioral).toBe(0);
    expect(weights.apollo).toBe(0); // apollo sourced from same deepseek signal
    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBe(0); // both unavailable
  });

  /**
   * Test 3 — apollo unavailable (behavioral=false, deepseek didn't run) → full weight to behavioral.
   * Note: apollo availability = behavioral (same deepseek source). When behavioral=true, apollo=true.
   * When behavioral=false, apollo=false → both unavailable → all zeros.
   */
  it("behavioral=true, gemini=false → behavioral=0.533, apollo=0.467; sum=1.0", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: false,
      ml: false,
      rules: false,
      trends: false,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: false,
    });

    // apollo availability falls back to behavioral (both sourced from deepseek)
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 4 — both unavailable → all zeros (no source to redistribute to).
   */
  it("both unavailable → behavioral=0, apollo=0; sum=0", () => {
    const weights = selectWeights({
      behavioral: false,
      gemini: false,
      ml: false,
      rules: false,
      trends: false,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: false,
    });

    expect(weights.behavioral).toBe(0);
    expect(weights.apollo).toBe(0);
  });

  /**
   * Test 5 — provenance-only flags (audio, platform_fit, gemini) do NOT affect weight distribution.
   * Availability of audio/platform_fit/gemini should not change behavioral/apollo split.
   */
  it("audio and platform_fit availability do NOT affect behavioral/apollo distribution", () => {
    const withAudio = selectWeights({
      behavioral: true, gemini: true, ml: true, rules: true, trends: true,
      content_type: true, niche: true, gemini_hook: true, gemini_body: true,
      gemini_cta: true, personas: true, audio: true, retrieval: true, platform_fit: true,
    });
    const withoutAudio = selectWeights({
      behavioral: true, gemini: true, ml: true, rules: true, trends: true,
      content_type: true, niche: true, gemini_hook: true, gemini_body: true,
      gemini_cta: true, personas: true, audio: false, retrieval: false, platform_fit: false,
    });

    expect(withAudio.behavioral).toBeCloseTo(withoutAudio.behavioral, 3);
    expect(withAudio.apollo).toBeCloseTo(withoutAudio.apollo, 3);
  });
});
