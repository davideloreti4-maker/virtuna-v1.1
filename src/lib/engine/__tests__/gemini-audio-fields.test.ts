/**
 * Phase 6 Plan 03 Task 2 — extended Gemini video response schema, prompt, and
 * Zod validation tests for the new audio_signals block.
 *
 * Test 8 strategy: Option (a) — buildVideoPrompt is exported with @internal JSDoc;
 * tests call it directly with a minimal CalibrationData. Cleaner test surface than
 * mock-and-capture.
 *
 * BLOCKER 2 contract verified by Tests 9 + 10:
 *   - GeminiVideoResponseSchema accepts a response with audio_signals omitted entirely.
 *   - Downstream optional-chaining (`audio_signals?.audio_description ?? null`) remains
 *     type-safe (proven implicitly via `pnpm tsc --noEmit`).
 *
 * WARNING 4 fix: NO it.todo in this file — every test makes a real assertion.
 */
import { describe, it, expect } from "vitest";
import {
  GeminiAudioSignalsSchema,
  GeminiVideoResponseSchema,
} from "../types";
import { VIDEO_RESPONSE_SCHEMA, buildVideoPrompt } from "../gemini";

// Minimal CalibrationData stub for buildVideoPrompt (Test 8). buildVideoPrompt
// only reads numeric/string fields; we pass real-looking values to satisfy the
// shape contract.
function makeCalibration() {
  return {
    primary_kpis: {
      share_rate: { viral_threshold: 0.02 },
      weighted_engagement_score: { percentiles: { p90: 85 } },
    },
    duration_analysis: {
      sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 60] },
    },
    viral_vs_average: {
      differentiators: [
        {
          factor: "hook_strength",
          difference_pct: 40,
          description: "Strong hooks boost engagement",
        },
        {
          factor: "audio_clarity",
          difference_pct: 25,
          description: "Clear audio retains viewers",
        },
        {
          factor: "pacing",
          difference_pct: 15,
          description: "Fast pacing keeps attention",
        },
      ],
    },
  };
}

// Helper to build a minimum valid GeminiVideoResponseSchema response (sans audio_signals).
function makeMinimalVideoResponse() {
  return {
    factors: [
      { name: "Scroll-Stop Power", score: 7, rationale: "Hook is strong", improvement_tip: "Tweak opening" },
      { name: "Completion Pull", score: 7, rationale: "Pacing keeps viewers", improvement_tip: "Tighten middle" },
      { name: "Rewatch Potential", score: 6, rationale: "Layered content", improvement_tip: "Add detail" },
      { name: "Share Trigger", score: 6, rationale: "Relatable", improvement_tip: "Add CTA" },
      { name: "Emotional Charge", score: 6, rationale: "Decent emotion", improvement_tip: "Amplify peak" },
    ],
    overall_impression: "Solid video with engagement potential",
    content_summary: "Test content for schema validation",
    video_signals: {
      visual_production_quality: 7,
      hook_visual_impact: 7,
      pacing_score: 6,
      transition_quality: 7,
    },
  };
}

describe("GeminiAudioSignalsSchema (Phase 6)", () => {
  it("Test 1: parses a valid audio_signals object (ratios sum to 1.0)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 8,
      audio_hook_first_2s_0_10: 7,
      silence_ratio: 0.2,
      voiceover_ratio: 0.6,
      music_ratio: 0.2,
      audio_description: "upbeat hip-hop track, 90 BPM",
    });
    expect(result.success).toBe(true);
  });

  it("Test 2: accepts nullable voice_clarity and audio_hook (D-A2 nullability)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: null,
      audio_hook_first_2s_0_10: null,
      silence_ratio: 0.1,
      voiceover_ratio: 0.0,
      music_ratio: 0.9,
      audio_description: "ambient music with no speech, slow tempo, lofi piano",
    });
    expect(result.success).toBe(true);
  });

  it("Test 3a: refine accepts ratios summing within ±0.1 tolerance (sum=1.05)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 6,
      audio_hook_first_2s_0_10: 6,
      silence_ratio: 0.3,
      voiceover_ratio: 0.4,
      music_ratio: 0.35, // 0.3 + 0.4 + 0.35 = 1.05 (within ±0.1)
      audio_description: "mixed dialogue and background music",
    });
    expect(result.success).toBe(true);
  });

  it("Test 3b: refine REJECTS ratios summing outside ±0.1 tolerance (sum=1.2)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 6,
      audio_hook_first_2s_0_10: 6,
      silence_ratio: 0.3,
      voiceover_ratio: 0.4,
      music_ratio: 0.5, // 0.3 + 0.4 + 0.5 = 1.2 (outside tolerance)
      audio_description: "valid description text here for the schema",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" | ");
      expect(messages).toMatch(/sum to ~1\.0|±0\.1 tolerance/);
    }
  });

  it("Test 4: rejects out-of-range voice_clarity (> 10)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 15,
      audio_hook_first_2s_0_10: 5,
      silence_ratio: 0.2,
      voiceover_ratio: 0.6,
      music_ratio: 0.2,
      audio_description: "valid description",
    });
    expect(result.success).toBe(false);
  });

  it("Test 5: rejects empty audio_description", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 5,
      audio_hook_first_2s_0_10: 5,
      silence_ratio: 0.2,
      voiceover_ratio: 0.6,
      music_ratio: 0.2,
      audio_description: "",
    });
    expect(result.success).toBe(false);
  });

  it("Test 6: rejects oversized audio_description (> 300 chars)", () => {
    const result = GeminiAudioSignalsSchema.safeParse({
      voice_clarity_0_10: 5,
      audio_hook_first_2s_0_10: 5,
      silence_ratio: 0.2,
      voiceover_ratio: 0.6,
      music_ratio: 0.2,
      audio_description: "x".repeat(500),
    });
    expect(result.success).toBe(false);
  });
});

describe("VIDEO_RESPONSE_SCHEMA (Phase 6)", () => {
  it("Test 7: includes audio_signals with 6 sub-properties", () => {
    const audio = (
      VIDEO_RESPONSE_SCHEMA as {
        properties: {
          audio_signals: { properties: Record<string, unknown>; required: string[] };
        };
      }
    ).properties.audio_signals;
    expect(audio).toBeDefined();
    expect(audio.properties).toHaveProperty("voice_clarity_0_10");
    expect(audio.properties).toHaveProperty("audio_hook_first_2s_0_10");
    expect(audio.properties).toHaveProperty("silence_ratio");
    expect(audio.properties).toHaveProperty("voiceover_ratio");
    expect(audio.properties).toHaveProperty("music_ratio");
    expect(audio.properties).toHaveProperty("audio_description");
  });

  it("Test 7b: audio_signals is NOT in the outer required array (BLOCKER 2 — graceful degradation)", () => {
    const outerRequired = (
      VIDEO_RESPONSE_SCHEMA as { required: string[] }
    ).required;
    expect(outerRequired).not.toContain("audio_signals");
    // But the existing required keys must still be present (no regression)
    expect(outerRequired).toContain("factors");
    expect(outerRequired).toContain("video_signals");
  });
});

describe("buildVideoPrompt (Phase 6)", () => {
  it("Test 8: emits the Audio Signals prompt section with the ratio-sum=1.0 instruction", () => {
    const prompt = buildVideoPrompt(makeCalibration());
    expect(prompt).toContain("Audio Signals");
    expect(prompt).toContain(
      "silence_ratio + voiceover_ratio + music_ratio MUST sum to exactly 1.0",
    );
  });

  it("Test 8b: prompt also explains voice_clarity_0_10 and audio_description fields", () => {
    const prompt = buildVideoPrompt(makeCalibration());
    expect(prompt).toContain("voice_clarity_0_10");
    expect(prompt).toContain("audio_description");
    expect(prompt).toContain("audio_hook_first_2s_0_10");
  });

  it("Test 8c: prompt does not regress the Video Signals section", () => {
    const prompt = buildVideoPrompt(makeCalibration());
    expect(prompt).toContain("Video Signals");
    expect(prompt).toContain("visual_production_quality");
    expect(prompt).toContain("hook_visual_impact");
  });
});

describe("GeminiVideoResponseSchema audio_signals optional (Phase 6 BLOCKER 2 fix)", () => {
  it("Test 9: safeParse succeeds when audio_signals is missing entirely", () => {
    const responseWithoutAudio = makeMinimalVideoResponse();
    // audio_signals key intentionally omitted — simulates Gemini degrading to video-only output
    const result = GeminiVideoResponseSchema.safeParse(responseWithoutAudio);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audio_signals).toBeUndefined();
    }
  });

  it("Test 10: downstream optional-chaining access reads as undefined gracefully", () => {
    const minimal = makeMinimalVideoResponse();
    const parsed = GeminiVideoResponseSchema.safeParse(minimal);
    if (!parsed.success) throw new Error("setup failure — fix Test 9 first");

    // Runtime: optional chaining returns undefined cleanly (no crash)
    const description: string | null =
      parsed.data.audio_signals?.audio_description ?? null;
    expect(description).toBeNull();

    // Compile-time: the assignment above to `string | null` proves the type is
    // `T | undefined` (not `T`). `pnpm tsc --noEmit` enforces this implicitly —
    // if `.optional()` did not yield `| undefined`, the `?.` would be a TS error.
  });

  it("Test 10b: when audio_signals IS present, validation flows through to .refine()", () => {
    const withAudio = {
      ...makeMinimalVideoResponse(),
      audio_signals: {
        voice_clarity_0_10: 8,
        audio_hook_first_2s_0_10: 7,
        silence_ratio: 0.2,
        voiceover_ratio: 0.6,
        music_ratio: 0.2,
        audio_description: "upbeat hip-hop track 90 BPM",
      },
    };
    const result = GeminiVideoResponseSchema.safeParse(withAudio);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.audio_signals).toBeDefined();
      expect(result.data.audio_signals?.audio_description).toBe(
        "upbeat hip-hop track 90 BPM",
      );
    }
  });

  it("Test 10c: when audio_signals is present with BAD ratios, refine triggers and parse fails", () => {
    // Demonstrates that .optional() does not bypass .refine() when the field IS present.
    const withBadAudio = {
      ...makeMinimalVideoResponse(),
      audio_signals: {
        voice_clarity_0_10: 8,
        audio_hook_first_2s_0_10: 7,
        silence_ratio: 0.3,
        voiceover_ratio: 0.4,
        music_ratio: 0.5, // sum=1.2 → outside ±0.1 tolerance
        audio_description: "valid description text",
      },
    };
    const result = GeminiVideoResponseSchema.safeParse(withBadAudio);
    expect(result.success).toBe(false);
  });
});
