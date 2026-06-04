/**
 * Plan 04 — selectWeights 2-key blend assertions.
 *
 * Supersedes the Phase 10 8-key redistribution tests. After Plan 04 cuts the dead
 * blend keys to behavioral+gemini only, the remaining meaningful assertions are:
 *   - weights.behavioral + weights.gemini sum to ~1.0 for all availability combos
 *   - platform_fit and audio keys are ABSENT from the returned weights object
 *   - 2-key redistribution: if behavioral unavailable → gemini=1; vice versa
 *
 * Note: The old per-signal redistribution cases (platform_fit unavailable → other 7
 * redistribute, etc.) are superseded — those keys no longer exist.
 */
import { describe, it, expect } from "vitest";
import { selectWeights } from "../aggregator";

describe("selectWeights — 2-key behavioral+gemini blend (Plan 04)", () => {
  /**
   * Test 1 — ALL signals available.
   * Only behavioral+gemini keys returned; platform_fit/audio ABSENT.
   * Sum ~1.0.
   */
  it("returns only behavioral+gemini keys; platform_fit/audio ABSENT; sum ~1.0", () => {
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
    expect(weights.gemini).toBeGreaterThan(0);
    // Dead keys MUST be absent from the returned 2-key object
    expect(weights).not.toHaveProperty("platform_fit");
    expect(weights).not.toHaveProperty("audio");
    expect(weights).not.toHaveProperty("ml");
    expect(weights).not.toHaveProperty("rules");
    expect(weights).not.toHaveProperty("trends");
    expect(weights).not.toHaveProperty("retrieval");

    const sum = weights.behavioral + weights.gemini;
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 2 — behavioral unavailable → all weight goes to gemini.
   */
  it("behavioral=false → gemini=1, behavioral=0; sum=1.0", () => {
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
    expect(weights.gemini).toBe(1);
    const sum = weights.behavioral + weights.gemini;
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 3 — gemini unavailable → all weight goes to behavioral.
   */
  it("gemini=false → behavioral=1, gemini=0; sum=1.0", () => {
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

    expect(weights.behavioral).toBe(1);
    expect(weights.gemini).toBe(0);
    const sum = weights.behavioral + weights.gemini;
    expect(sum).toBeCloseTo(1, 2);
  });

  /**
   * Test 4 — both unavailable → all zeros (no source to redistribute to).
   */
  it("both unavailable → behavioral=0, gemini=0; sum=0", () => {
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
    expect(weights.gemini).toBe(0);
  });

  /**
   * Test 5 — provenance-only flags (audio, platform_fit) do NOT affect weight distribution.
   * Availability of audio/platform_fit should not change behavioral/gemini split.
   */
  it("audio and platform_fit availability do NOT affect behavioral/gemini distribution", () => {
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
    expect(withAudio.gemini).toBeCloseTo(withoutAudio.gemini, 3);
  });
});
