/**
 * Regression test for omniOutputToStructuralInput (decode.ts).
 *
 * Guards the live-only bug where the analyze route passed the engine's
 * transformed `OmniAnalysisOutput` straight into runDecode via
 * `as unknown as OmniStructuralInput`. That cast compiled but left
 * `hook_decomposition` undefined at runtime → buildDecodeContext threw
 * "Cannot read properties of undefined (reading 'visual_stop_power')".
 *
 * The structural fields actually live under `geminiResult.analysis.*` and
 * top-level `segments` / `wave0Result`. These tests assert the mapper reads
 * them from their real locations.
 */
import { describe, it, expect } from "vitest";
import { omniOutputToStructuralInput } from "../decode";
import { buildDecodeContext } from "../decode-prompts";
import type { OmniAnalysisOutput } from "@/lib/engine/qwen/omni-analysis";

// Mirrors the assembly in omni-analysis.ts (geminiResult.analysis.* + top-level
// segments/wave0Result). hook_decomposition + emotion_arc are Omni-only fields
// that ride through the GeminiVideoAnalysis cast, so we attach them the same way.
function makeOmniOutput(): OmniAnalysisOutput {
  const analysis = {
    factors: [
      { name: "Scroll-Stop Power", score: 8, rationale: "Strong cold open" },
      { name: "Completion Pull", score: 7, rationale: "Tight arc" },
    ],
    overall_impression: "Sharp, well-paced talking-head hook.",
    content_summary: "Creator delivers a punchy contrarian claim up front.",
    video_signals: {
      visual_production_quality: 8,
      hook_visual_impact: 9,
      pacing_score: 7,
      transition_quality: 6,
    },
    audio_signals: {},
    hook_decomposition: {
      visual_stop_power: 9,
      audio_hook_quality: 8,
      text_overlay_score: 7,
      first_words_speech_score: 9,
      weakest_modality: "text_overlay_score",
      visual_audio_coherence: 8,
      cognitive_load: 3,
      watermark_detected: { tiktok: false, ig: false, yt: false },
    },
    cta_segment: { cta_present: false, strength: null, type: null, rationale: "" },
    emotion_arc: [
      { timestamp_ms: 0, intensity_0_1: 0.4, label: "mid" as const },
      { timestamp_ms: 3000, intensity_0_1: 0.8, label: "high" as const },
    ],
  };

  return {
    geminiResult: { analysis: analysis as never, cost_cents: 0 },
    wave0Result: {
      content_type: { type: "talking_head", confidence: 1 },
      niche: { primary_slug: "fitness", micro_slug: "strength-training", confidence: 1 },
    },
    audio_perceptual_score: null,
    signalAvailability: { gemini_hook: true, gemini_body: true, gemini_cta: true },
    segments: [
      { t_start: 0, t_end: 3, visual_event: "cold open", audio_event: "claim", is_hook_zone: true },
      { t_start: 3, t_end: 10, visual_event: "demo", audio_event: "explain" },
    ],
  } as OmniAnalysisOutput;
}

describe("omniOutputToStructuralInput", () => {
  it("extracts hook_decomposition from geminiResult.analysis (the live-bug regression)", () => {
    const structural = omniOutputToStructuralInput(makeOmniOutput());
    expect(structural).not.toBeNull();
    expect(structural!.hook_decomposition.visual_stop_power).toBe(9);
    expect(structural!.hook_decomposition.weakest_modality).toBe("text_overlay_score");
  });

  it("produces an input that buildDecodeContext renders without throwing", () => {
    const structural = omniOutputToStructuralInput(makeOmniOutput());
    const ctx = buildDecodeContext(structural!);
    expect(ctx).toContain("visual_stop_power: 9");
    expect(ctx).toContain("Content Type: talking_head");
    expect(ctx).toContain("Niche: fitness");
  });

  it("maps factors, video_signals, segments, and emotion_arc from their real locations", () => {
    const s = omniOutputToStructuralInput(makeOmniOutput())!;
    expect(s.factors).toHaveLength(2);
    expect(s.video_signals.visual_production_quality).toBe(8);
    expect(s.video_signals.pacing_score).toBe(7);
    expect(s.segments).toHaveLength(2);
    expect(s.emotion_arc).toHaveLength(2);
    expect(s.content_type).toBe("talking_head");
    expect(s.niche_primary_slug).toBe("fitness");
  });

  // ---------------------------------------------------------------------------
  // D-R1 (2026-06-11): the Read became a PURE SENSOR and stopped emitting generic
  // JUDGMENT — factors[], overall_impression and content_summary all went to
  // Apollo (omni-analysis.ts:279-282). `makeOmniOutput()` above still carries all
  // three, so it mirrors an omni output that has not existed for two months, and
  // every test in this file passed against a shape the producer no longer emits.
  //
  // Measured live 2026-08-11: a real remix run reached omni fine — 4 segments, 6
  // audio events, verbatim present — and then died here, because the guard
  // required `factors`. decode_failed, zero cards, on every run since D-R1.
  // ---------------------------------------------------------------------------

  /** The omni shape as `assembleOmniOutput` ACTUALLY builds it today. */
  function makePureSensorOmniOutput(): OmniAnalysisOutput {
    const full = makeOmniOutput();
    const analysis = { ...(full.geminiResult!.analysis as unknown as Record<string, unknown>) };
    // The three fields D-R1 removed. Deleted rather than set undefined: an absent
    // key is what the real assembly produces.
    delete analysis.factors;
    delete analysis.overall_impression;
    delete analysis.content_summary;
    return {
      ...full,
      geminiResult: { analysis: analysis as never, cost_cents: 0 },
    } as OmniAnalysisOutput;
  }

  it("survives a PURE SENSOR omni output — perception without judgment", () => {
    const s = omniOutputToStructuralInput(makePureSensorOmniOutput());
    expect(s).not.toBeNull();
    // Perception is preserved and must still map.
    expect(s!.hook_decomposition.visual_stop_power).toBe(9);
    expect(s!.video_signals.pacing_score).toBe(7);
    expect(s!.segments).toHaveLength(2);
    // Judgment is gone. An empty array, never undefined — blueprint.ts calls
    // `structural.factors.filter(...)` unguarded and would throw on undefined.
    expect(s!.factors).toEqual([]);
  });

  it("renders a decode context from a pure-sensor input without throwing", () => {
    const s = omniOutputToStructuralInput(makePureSensorOmniOutput())!;
    const ctx = buildDecodeContext(s);
    expect(ctx).toContain("visual_stop_power: 9");
  });

  it("returns null when the Omni call failed (geminiResult null)", () => {
    const failed = {
      geminiResult: null,
      wave0Result: { content_type: null, niche: null },
      audio_perceptual_score: null,
      signalAvailability: { gemini_hook: false, gemini_body: false, gemini_cta: false },
    } as OmniAnalysisOutput;
    expect(omniOutputToStructuralInput(failed)).toBeNull();
  });
});
