/**
 * Unit tests for the locked Phase 6 D-G3 audio_perceptual_score formula and the
 * computeAudioPerceptualScore pure function.
 *
 * PERCEPTUAL_FORMULA_BY_TYPE is LOAD-BEARING — Phase 10 ML audit may revise based
 * on corpus benchmark evidence, but the coefficients asserted here MUST stay in
 * lock-step with D-G3 + plan 06-03 action.
 *
 * Mirrors the test pattern from content-type-weights.test.ts (pure-function +
 * locked-matrix idiom).
 */
import { describe, it, expect } from "vitest";
import { computeAudioPerceptualScore } from "../audio-perceptual";
import type { GeminiAudioSignals } from "../types";

function makeSignals(
  overrides: Partial<GeminiAudioSignals> = {},
): GeminiAudioSignals {
  return {
    voice_clarity_0_10: 5,
    audio_hook_first_2s_0_10: 5,
    silence_ratio: 0.2,
    voiceover_ratio: 0.5,
    music_ratio: 0.3,
    audio_description: "neutral background audio with some speech",
    ...overrides,
  };
}

describe("computeAudioPerceptualScore — Phase 6 (D-G3)", () => {
  it("Test 1: talking_head voice-driven formula (≈74.5 → 75)", () => {
    // signals: voice_clarity=8, audio_hook=7, voiceover_ratio=0.7
    // weightedSum = 0.45*8 + 0.35*7 + 0.20*(0.7*10) = 3.6 + 2.45 + 1.4 = 7.45
    // totalWeight = 1.0 → raw0to10 = 7.45 → score0to100 = round(74.5) = 75
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 8,
        audio_hook_first_2s_0_10: 7,
        silence_ratio: 0.1,
        voiceover_ratio: 0.7,
        music_ratio: 0.2,
      }),
      "talking_head",
    );
    expect(result.formula_mode).toBe("voice");
    expect(result.audio_perceptual_score).toBeCloseTo(75, 0);
    expect(result.sub_scores_used).toContain("voice_clarity");
    expect(result.sub_scores_used).toContain("audio_hook");
    expect(result.sub_scores_used).toContain("voiceover_ratio");
  });

  it("Test 2: slideshow ambient formula uses music_ratio + description (voice fields ignored)", () => {
    // signals: voice_clarity = null, audio_hook = null, music_ratio=0.85, description="upbeat hip-hop 90 BPM"
    // ambient coefficients (slideshow): music_ratio 0.60, description_quality 0.40
    // music_ratio*10 = 8.5
    // description_quality_score("upbeat hip-hop 90 BPM") — len 20, len/5 = 4
    // weightedSum = 0.60*8.5 + 0.40*4 = 5.1 + 1.6 = 6.7
    // totalWeight = 1.0 → raw = 6.7 → score = 67
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: null,
        audio_hook_first_2s_0_10: null,
        music_ratio: 0.85,
        silence_ratio: 0.05,
        voiceover_ratio: 0.10,
        audio_description: "upbeat hip-hop 90 BPM",
      }),
      "slideshow",
    );
    expect(result.formula_mode).toBe("ambient");
    expect(result.sub_scores_used).toContain("music_ratio");
    expect(result.sub_scores_used).toContain("description_quality");
    expect(result.sub_scores_used).not.toContain("voice_clarity");
    expect(result.sub_scores_used).not.toContain("audio_hook");
    expect(result.audio_perceptual_score).toBeGreaterThanOrEqual(0);
    expect(result.audio_perceptual_score).toBeLessThanOrEqual(100);
  });

  it("Test 3: other → balanced formula averages all available sub-scores", () => {
    const result = computeAudioPerceptualScore(makeSignals(), "other");
    expect(result.formula_mode).toBe("balanced");
    expect(result.sub_scores_used).toContain("voice_clarity");
    expect(result.sub_scores_used).toContain("audio_hook");
    expect(result.sub_scores_used).toContain("voiceover_ratio");
    expect(result.sub_scores_used).toContain("music_ratio");
    expect(result.sub_scores_used).toContain("description_quality");
    expect(result.audio_perceptual_score).toBeGreaterThanOrEqual(0);
    expect(result.audio_perceptual_score).toBeLessThanOrEqual(100);
  });

  it("Test 4: null content type → defaults to balanced (other) passthrough", () => {
    const result = computeAudioPerceptualScore(makeSignals(), null);
    expect(result.formula_mode).toBe("balanced");
    // Same shape as Test 3
    expect(result.sub_scores_used).toContain("voice_clarity");
    expect(result.sub_scores_used).toContain("music_ratio");
  });

  it("Test 5: all-zero inputs (talking_head) → 0", () => {
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 0,
        audio_hook_first_2s_0_10: 0,
        silence_ratio: 1.0,
        voiceover_ratio: 0.0,
        music_ratio: 0.0,
        audio_description: "",
      }),
      "talking_head",
    );
    expect(result.audio_perceptual_score).toBe(0);
  });

  it("Test 6: all-max inputs (talking_head) → 100", () => {
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 10,
        audio_hook_first_2s_0_10: 10,
        silence_ratio: 0,
        voiceover_ratio: 1.0,
        music_ratio: 0,
      }),
      "talking_head",
    );
    expect(result.audio_perceptual_score).toBe(100);
  });

  it("Test 7: talking_head with null voice_clarity (graceful degradation, no NaN)", () => {
    // signals.voice_clarity_0_10 = null → audio_perceptual_score from non-null sub-scores only.
    // sub_scores_used reflects actual fields used. NO NaN propagation.
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: null,
        audio_hook_first_2s_0_10: 7,
        voiceover_ratio: 0.6,
      }),
      "talking_head",
    );
    expect(result.formula_mode).toBe("voice");
    expect(result.sub_scores_used).not.toContain("voice_clarity");
    expect(result.sub_scores_used).toContain("audio_hook");
    expect(result.sub_scores_used).toContain("voiceover_ratio");
    expect(Number.isFinite(result.audio_perceptual_score)).toBe(true);
    expect(result.audio_perceptual_score).toBeGreaterThan(0);
  });

  it("Test 8: slideshow with emitted voice_clarity (D-A2 violation) → ambient ignores it", () => {
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 8, // Gemini emitted it anyway
        audio_hook_first_2s_0_10: 7,
        music_ratio: 0.7,
        silence_ratio: 0.2,
        voiceover_ratio: 0.1,
        audio_description: "lofi instrumental, mellow piano loop, 65 BPM",
      }),
      "slideshow",
    );
    expect(result.formula_mode).toBe("ambient");
    expect(result.sub_scores_used).not.toContain("voice_clarity");
    expect(result.sub_scores_used).not.toContain("audio_hook");
    // ambient sub_scores_used = music_ratio + description_quality
    expect(result.sub_scores_used).toContain("music_ratio");
    expect(result.sub_scores_used).toContain("description_quality");
  });

  it("Test 9: sub_scores_used is correct for talking_head with all three voice fields non-null", () => {
    const result = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 6,
        audio_hook_first_2s_0_10: 6,
        voiceover_ratio: 0.5,
      }),
      "talking_head",
    );
    expect(result.sub_scores_used.sort()).toEqual(
      ["audio_hook", "voice_clarity", "voiceover_ratio"].sort(),
    );
  });

  it("Test 10: Result clamping — extreme inputs cannot escape [0, 100]", () => {
    // Even if formula coefficients somehow pushed past 10 internally, output must clamp.
    const high = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 10,
        audio_hook_first_2s_0_10: 10,
        voiceover_ratio: 1.0,
        music_ratio: 1.0,
        silence_ratio: 0,
        audio_description: "x".repeat(120),
      }),
      "talking_head",
    );
    expect(high.audio_perceptual_score).toBeGreaterThanOrEqual(0);
    expect(high.audio_perceptual_score).toBeLessThanOrEqual(100);

    const low = computeAudioPerceptualScore(
      makeSignals({
        voice_clarity_0_10: 0,
        audio_hook_first_2s_0_10: 0,
        voiceover_ratio: 0,
        music_ratio: 0,
        silence_ratio: 1.0,
        audio_description: "",
      }),
      "talking_head",
    );
    expect(low.audio_perceptual_score).toBeGreaterThanOrEqual(0);
    expect(low.audio_perceptual_score).toBeLessThanOrEqual(100);
  });

  // ---- Additional coverage for the 7 content types ----

  it("covers all 7 content types — every type returns a valid 0-100 score and known formula_mode", () => {
    const types = [
      "talking_head",
      "tutorial",
      "vlog",
      "slideshow",
      "b_roll",
      "action",
      "other",
    ] as const;
    for (const t of types) {
      const result = computeAudioPerceptualScore(makeSignals(), t);
      expect(["voice", "ambient", "balanced"]).toContain(result.formula_mode);
      expect(result.audio_perceptual_score).toBeGreaterThanOrEqual(0);
      expect(result.audio_perceptual_score).toBeLessThanOrEqual(100);
      expect(result.sub_scores_used.length).toBeGreaterThan(0);
    }
  });

  it("tutorial uses voice mode", () => {
    const result = computeAudioPerceptualScore(makeSignals(), "tutorial");
    expect(result.formula_mode).toBe("voice");
  });

  it("vlog uses voice mode", () => {
    const result = computeAudioPerceptualScore(makeSignals(), "vlog");
    expect(result.formula_mode).toBe("voice");
  });

  it("b_roll uses ambient mode", () => {
    const result = computeAudioPerceptualScore(makeSignals(), "b_roll");
    expect(result.formula_mode).toBe("ambient");
  });

  it("action uses ambient mode", () => {
    const result = computeAudioPerceptualScore(makeSignals(), "action");
    expect(result.formula_mode).toBe("ambient");
  });

  it("does not mutate input signals object", () => {
    const input = makeSignals({ voice_clarity_0_10: 7 });
    const snapshot = { ...input };
    computeAudioPerceptualScore(input, "talking_head");
    expect(input).toEqual(snapshot);
  });
});
