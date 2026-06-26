/**
 * Omni read rationale coercion — a null'd required prose field no longer fails the WHOLE Read.
 *
 * Observed live 2026-06-26: a clean omni read returned `cta_segment.rationale: null` on a
 * no-CTA video; the schema (`z.string().min(1)`) hard-FAILED both attempts → the entire Read
 * errored ("Omni null analysis"). coerceOmniRead fills the null'd required-`.min(1)` prose
 * strings (cta_segment.rationale, hook_decomposition.rationale, audio_signals.audio_description)
 * with a neutral "n/a" BEFORE Zod — fabricating no score (D-R1: rationale is secondary prose).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { warnSpy } = vi.hoisted(() => ({ warnSpy: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: warnSpy, error: vi.fn(),
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

import { analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";

/** Valid no-CTA Omni body; `nullProse` nulls the three required prose strings the model can drop. */
function makeBody(nullProse: boolean): string {
  const body: Record<string, unknown> = {
    content_type: "talking_head",
    niche_primary_slug: "tech",
    niche_micro_slug: null,
    hook_visual_impact: 3,
    hook_decomposition: {
      visual_stop_power: 6,
      audio_hook_quality: 4,
      text_overlay_score: 2,
      first_words_speech_score: 3,
      visual_audio_coherence: 6,
      cognitive_load: 4,
      // hook_decomposition has no `rationale` in the current schema — included only when present.
    },
    video_signals: { visual_production_quality: 4, pacing_score: 3, transition_quality: 4 },
    // no-CTA video: cta_present false; the model returns rationale null (the observed failure).
    cta_segment: { cta_present: false, strength: null, type: null, rationale: nullProse ? null : "no cta present" },
    audio_signals: {
      voice_clarity_0_10: 7,
      audio_hook_first_2s_0_10: 3,
      silence_ratio: 0.1,
      voiceover_ratio: 0.8,
      music_ratio: 0.1,
      audio_description: nullProse ? null : "Clear voiceover.",
    },
    audio_perceptual_score: 60,
    hook_verbatim: { spoken_words: "Hey welcome back", on_screen_text: null },
    emotion_arc: [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000, intensity_0_1: 0.7, label: "high" },
    ],
    segments: [
      { t_start: 0, t_end: 3, visual_event: "open", audio_event: "greeting" },
      { t_start: 3, t_end: 30, visual_event: "body", audio_event: "talk" },
    ],
  };
  return JSON.stringify(body);
}

function resp(content: string) {
  return { choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } };
}

describe("omni read — required-prose null coercion", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    warnSpy.mockReset();
  });

  it("null cta_segment.rationale + audio_description → Read SUCCEEDS in ONE call (no retry)", async () => {
    mockCreate.mockResolvedValueOnce(resp(makeBody(true)));

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    // The whole Read no longer hard-fails on one null'd prose field.
    expect(mockCreate).toHaveBeenCalledTimes(1); // coercion fixed it pre-Zod → no Zod-fail retry
    expect(out.geminiResult).not.toBeNull();
    const analysis = out.geminiResult?.analysis as unknown as {
      cta_segment?: { rationale?: string };
      audio_signals?: { audio_description?: string };
    };
    expect(analysis?.cta_segment?.rationale).toBe("n/a");
    expect(analysis?.audio_signals?.audio_description).toBe("n/a");
  });

  it("clean prose is preserved (coercion is a no-op when fields are present)", async () => {
    mockCreate.mockResolvedValueOnce(resp(makeBody(false)));

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const analysis = out.geminiResult?.analysis as unknown as {
      cta_segment?: { rationale?: string };
      audio_signals?: { audio_description?: string };
    };
    expect(analysis?.cta_segment?.rationale).toBe("no cta present");
    expect(analysis?.audio_signals?.audio_description).toBe("Clear voiceover.");
  });
});
