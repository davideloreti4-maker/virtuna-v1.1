/**
 * Phase 1 Plan 02 (F46 + F16) — Read substrate robustness for NO-SPEECH / no-audio videos.
 *
 * F46: speech/audio-derived hook fields (first_words_speech_score, audio_hook_quality) are
 * legitimately null on b-roll / music-only / ASMR content. They were REQUIRED numbers → a
 * single null failed the WHOLE Omni read (silent total failure; Ashton Hall 79s clip repro).
 * Made nullable (mirrors GeminiAudioSignalsSchema's D-A2 audio nulling). weakest_modality
 * derive skips the null modalities so an absent modality isn't miscounted as "weakest".
 *
 * F16: audio_description min(10) → min(1) — a terse legit audio ("music") no longer fails parse.
 */
import { describe, it, expect } from "vitest";
import {
  OmniAnalysisZodSchema,
  HookDecompositionZodSchema,
} from "@/lib/engine/qwen/schemas";

/** A complete, Zod-valid Omni response body, with overridable fields for the edge under test. */
function makeBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    content_type: "talking_head",
    niche_primary_slug: "tech",
    niche_micro_slug: "dev_tools",
    factors: [
      { name: "Scroll-Stop Power", score: 3, rationale: "weak open" },
      { name: "Completion Pull", score: 5, rationale: "mid retention" },
      { name: "Rewatch Potential", score: 2, rationale: "low" },
      { name: "Share Trigger", score: 4, rationale: "some" },
      { name: "Emotional Charge", score: 3, rationale: "flat affect" },
    ],
    overall_impression: "A low-production talking-head teaser.",
    content_summary: "Dev introduces a tool to camera.",
    hook_visual_impact: 3,
    hook_decomposition: {
      visual_stop_power: 6,
      audio_hook_quality: 4,
      text_overlay_score: 2,
      first_words_speech_score: 3,
      visual_audio_coherence: 6,
      cognitive_load: 4,
      watermark_detected: { tiktok: false, ig: false, yt: false },
    },
    video_signals: { visual_production_quality: 4, pacing_score: 3, transition_quality: 4 },
    cta_segment: { cta_present: false, strength: null, type: null, rationale: "no explicit ask" },
    audio_signals: {
      voice_clarity_0_10: 7,
      audio_hook_first_2s_0_10: 3,
      silence_ratio: 0.1,
      voiceover_ratio: 0.8,
      music_ratio: 0.1,
      audio_description: "Clear voiceover throughout with minimal background music.",
    },
    audio_perceptual_score: 72,
    emotion_arc: [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000, intensity_0_1: 0.6, label: "mid" },
    ],
    segments: [
      { t_start: 0, t_end: 3, visual_event: "talking head", audio_event: "greeting" },
      { t_start: 3, t_end: 30, visual_event: "screen share", audio_event: "explanation" },
    ],
    ...overrides,
  };
}

describe("F46 — no-speech / no-audio read robustness", () => {
  it("parses a NO-SPEECH read: first_words_speech_score + audio_hook_quality null no longer fail the whole parse", () => {
    const body = makeBody({
      content_type: "b_roll",
      hook_decomposition: {
        visual_stop_power: 7,
        audio_hook_quality: null,          // no audio hook
        text_overlay_score: 5,
        first_words_speech_score: null,    // no speech (the field that rejected the Ashton Hall read)
        visual_audio_coherence: 4,
        cognitive_load: 3,
      },
      audio_signals: {
        voice_clarity_0_10: null,
        audio_hook_first_2s_0_10: null,
        silence_ratio: 0.2,
        voiceover_ratio: 0.0,
        music_ratio: 0.8,
        audio_description: "Ambient music, no speech.",
      },
    });
    const r = OmniAnalysisZodSchema.safeParse(body);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hook_decomposition.first_words_speech_score).toBeNull();
      expect(r.data.hook_decomposition.audio_hook_quality).toBeNull();
    }
  });

  it("weakest_modality derives over the NON-null modalities (skips nulls, no NaN/crash)", () => {
    const decomp = HookDecompositionZodSchema.parse({
      visual_stop_power: 6,
      audio_hook_quality: null,
      text_overlay_score: 2,        // lowest of the NON-null pair → weakest
      first_words_speech_score: null,
      visual_audio_coherence: 5,
      cognitive_load: 3,
    });
    expect(decomp.weakest_modality).toBe("text_overlay_score");
  });

  it("keeps a model-named valid weakest_modality even when a modality is null", () => {
    const decomp = HookDecompositionZodSchema.parse({
      visual_stop_power: 6,
      audio_hook_quality: null,
      text_overlay_score: 4,
      first_words_speech_score: null,
      weakest_modality: "visual_stop_power",
      visual_audio_coherence: 5,
      cognitive_load: 3,
    });
    expect(decomp.weakest_modality).toBe("visual_stop_power");
  });

  it("F16 — a terse legit audio_description ('music', 5 chars) now parses", () => {
    const body = makeBody({
      audio_signals: {
        voice_clarity_0_10: null,
        audio_hook_first_2s_0_10: null,
        silence_ratio: 0.1,
        voiceover_ratio: 0.0,
        music_ratio: 0.9,
        audio_description: "music",
      },
    });
    const r = OmniAnalysisZodSchema.safeParse(body);
    expect(r.success).toBe(true);
  });

  it("F16 — an EMPTY audio_description is still rejected (min(1) guard holds)", () => {
    const body = makeBody({
      audio_signals: {
        voice_clarity_0_10: 5,
        audio_hook_first_2s_0_10: 5,
        silence_ratio: 0.1,
        voiceover_ratio: 0.8,
        music_ratio: 0.1,
        audio_description: "",
      },
    });
    expect(OmniAnalysisZodSchema.safeParse(body).success).toBe(false);
  });

  it("a normal SPEECH read still derives weakest_modality unchanged (no regression)", () => {
    const decomp = HookDecompositionZodSchema.parse({
      visual_stop_power: 6,
      audio_hook_quality: 4,
      text_overlay_score: 2,   // genuine lowest
      first_words_speech_score: 3,
      visual_audio_coherence: 6,
      cognitive_load: 4,
    });
    expect(decomp.weakest_modality).toBe("text_overlay_score");
    expect(decomp.audio_hook_quality).toBe(4);
    expect(decomp.first_words_speech_score).toBe(3);
  });
});
