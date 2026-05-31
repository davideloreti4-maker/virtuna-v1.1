/**
 * Phase 1 Plan 04 (R1.7) — Omni Plus emotion_arc engine extension.
 *
 * Replaces Plan 01-01 it.todo stubs with real assertions covering:
 *   - EmotionArcPointSchema validation (happy + sad paths)
 *   - OmniAnalysisZodSchema backward compat (.optional() — Assumption A3)
 *   - System prompt contains the literal "emotion_arc" field name
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EmotionArcPointSchema,
  OmniAnalysisZodSchema,
} from "@/lib/engine/qwen/schemas";
import { buildSystemPrompt, analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";

// =====================================================
// Module mocks (only used by the assembly-path block below)
// =====================================================
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = "test-key";

/** A complete, Zod-valid Omni response. emotion_arc included or stripped per the arg. */
function makeOmniResponse(withArc: boolean): string {
  const body: Record<string, unknown> = {
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
      visual_stop_power: 3,
      audio_hook_quality: 4,
      text_overlay_score: 2,
      first_words_speech_score: 3,
      weakest_modality: "text_overlay_score",
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
    segments: [
      { t_start: 0, t_end: 3, visual_event: "talking head", audio_event: "greeting" },
      { t_start: 3, t_end: 30, visual_event: "screen share", audio_event: "explanation" },
    ],
  };
  if (withArc) {
    body.emotion_arc = [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000, intensity_0_1: 0.6, label: "mid" },
      { timestamp_ms: 15000, intensity_0_1: 0.8, label: "high" },
    ];
  }
  return JSON.stringify(body);
}

describe("emotion_arc — schema validation", () => {
  it("EmotionArcPointSchema validates a valid point with label", () => {
    const p = EmotionArcPointSchema.parse({
      timestamp_ms: 1000,
      intensity_0_1: 0.5,
      label: "mid",
    });
    expect(p.timestamp_ms).toBe(1000);
    expect(p.intensity_0_1).toBe(0.5);
    expect(p.label).toBe("mid");
  });

  it("EmotionArcPointSchema accepts point without label (optional)", () => {
    const p = EmotionArcPointSchema.parse({
      timestamp_ms: 0,
      intensity_0_1: 0.2,
    });
    expect(p.label).toBeUndefined();
    expect(p.timestamp_ms).toBe(0);
    expect(p.intensity_0_1).toBe(0.2);
  });

  it("EmotionArcPointSchema rejects intensity > 1", () => {
    expect(() =>
      EmotionArcPointSchema.parse({ timestamp_ms: 0, intensity_0_1: 1.2 }),
    ).toThrow();
  });

  it("EmotionArcPointSchema rejects negative timestamp", () => {
    expect(() =>
      EmotionArcPointSchema.parse({ timestamp_ms: -1, intensity_0_1: 0.5 }),
    ).toThrow();
  });

  it("OmniAnalysisZodSchema accepts response WITH emotion_arc via .partial()", () => {
    // Build a minimal subset asserting only the emotion_arc surface — .partial()
    // makes all OmniAnalysisZodSchema fields optional so the test focuses on the
    // new field without rebuilding the full 11-field response shape.
    const withArc = {
      emotion_arc: [
        { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" as const },
        { timestamp_ms: 5000, intensity_0_1: 0.8, label: "high" as const },
      ],
    };
    const parsed = OmniAnalysisZodSchema.partial().parse(withArc);
    expect(parsed.emotion_arc).toBeDefined();
    expect(parsed.emotion_arc).toHaveLength(2);
    expect(parsed.emotion_arc?.[0]?.intensity_0_1).toBe(0.3);
  });

  it("OmniAnalysisZodSchema accepts response WITHOUT emotion_arc (backward compat — A3)", () => {
    // Backward compat: existing Omni Plus responses that don't include the new
    // field continue to validate. .optional() declaration on OmniAnalysisZodSchema
    // means absent emotion_arc → field undefined, no error.
    expect(() => OmniAnalysisZodSchema.partial().parse({})).not.toThrow();
    const parsed = OmniAnalysisZodSchema.partial().parse({});
    expect(parsed.emotion_arc).toBeUndefined();
  });

  it("OmniAnalysisZodSchema rejects emotion_arc with invalid point shape", () => {
    // Defense-in-depth: the field is optional but when present must validate.
    const invalidArc = {
      emotion_arc: [{ timestamp_ms: 0, intensity_0_1: 1.5 }], // intensity > 1
    };
    expect(() => OmniAnalysisZodSchema.partial().parse(invalidArc)).toThrow();
  });

  it("buildSystemPrompt output contains the literal 'emotion_arc'", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("emotion_arc");
    // Also assert it documents the per-point shape (timestamp_ms + intensity_0_1)
    expect(prompt).toContain("timestamp_ms");
    expect(prompt).toContain("intensity_0_1");
  });
});

// =====================================================
// Regression: emotion_arc must survive analyzeVideoWithOmni's assembly.
// The schema parsed it and the prompt asked for it, but the assembled
// OmniAnalysisOutput dropped emotion_arc → 26/26 persisted rows null in prod.
// The aggregator plucks geminiResult.analysis.emotion_arc, so it MUST land there.
// =====================================================
describe("emotion_arc — analyzeVideoWithOmni assembly (regression)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("threads model-emitted emotion_arc onto geminiResult.analysis", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(true) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    // The exact field+path the aggregator reads (aggregator.ts ~692).
    const arc = (out.geminiResult?.analysis as unknown as {
      emotion_arc?: { timestamp_ms: number; intensity_0_1: number; label?: string }[];
    })?.emotion_arc;
    expect(arc).toBeDefined();
    expect(arc).toHaveLength(3);
    expect(arc?.[0]?.intensity_0_1).toBe(0.3);
    expect(arc?.[2]?.label).toBe("high");
  });

  it("leaves emotion_arc undefined when the model omits it (no fabrication)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(false) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    const arc = (out.geminiResult?.analysis as unknown as {
      emotion_arc?: unknown[];
    })?.emotion_arc;
    expect(arc).toBeUndefined();
    // Sanity: the rest of the assembly still succeeded.
    expect(out.geminiResult?.analysis.factors).toHaveLength(5);
  });
});
