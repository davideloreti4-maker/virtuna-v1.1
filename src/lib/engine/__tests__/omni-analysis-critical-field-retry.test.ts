/**
 * Phase 1 Plan 02 (F9/D-11) — critical-field bounded retry + read_drift telemetry.
 *
 * The Omni read's MAX_RETRIES=1 fired ONLY on whole-response JSON/Zod failure — NOT on a
 * parse that SUCCEEDED but left a perception-critical field empty (empty emotion_arc, null
 * hook_verbatim on a speech video). Those silently dropped to undefined with no telemetry.
 *
 * This adds: ONE bounded retry on critical-field drift (re-sends the volatile user message,
 * keeps the cached system prefix), then — if still drifted after the retry — a `read_drift`
 * log entry instead of a silent drop. The retry is GATED so legitimately-empty content
 * (no-speech video → null verbatim, slideshow → absent emotion_arc) does NOT false-trigger.
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

/** Valid Omni body; toggles for the drift edges under test. */
function makeBody(opts: {
  emotionArc?: boolean;
  spokenWords?: string | null;
  speech?: boolean;           // controls first_words_speech_score + voiceover_ratio
  contentType?: string;
} = {}): string {
  const { emotionArc = true, spokenWords = "Hey welcome back", speech = true, contentType = "talking_head" } = opts;
  const body: Record<string, unknown> = {
    content_type: contentType,
    niche_primary_slug: "tech",
    niche_micro_slug: null,
    factors: [
      { name: "Scroll-Stop Power", score: 3, rationale: "weak open" },
      { name: "Completion Pull", score: 5, rationale: "mid retention" },
      { name: "Rewatch Potential", score: 2, rationale: "low" },
      { name: "Share Trigger", score: 4, rationale: "some" },
      { name: "Emotional Charge", score: 3, rationale: "flat" },
    ],
    overall_impression: "A talking-head teaser.",
    content_summary: "Dev to camera.",
    hook_visual_impact: 3,
    hook_decomposition: {
      visual_stop_power: 6,
      audio_hook_quality: speech ? 4 : null,
      text_overlay_score: 2,
      first_words_speech_score: speech ? 3 : null,
      visual_audio_coherence: 6,
      cognitive_load: 4,
    },
    video_signals: { visual_production_quality: 4, pacing_score: 3, transition_quality: 4 },
    cta_segment: { cta_present: false, strength: null, type: null, rationale: "none" },
    audio_signals: {
      voice_clarity_0_10: speech ? 7 : null,
      audio_hook_first_2s_0_10: speech ? 3 : null,
      silence_ratio: 0.1,
      voiceover_ratio: speech ? 0.8 : 0.0,
      music_ratio: speech ? 0.1 : 0.9,
      audio_description: speech ? "Clear voiceover." : "Ambient music.",
    },
    audio_perceptual_score: 60,
    hook_verbatim: { spoken_words: spokenWords, on_screen_text: null },
    segments: [
      { t_start: 0, t_end: 3, visual_event: "open", audio_event: "greeting" },
      { t_start: 3, t_end: 30, visual_event: "body", audio_event: "talk" },
    ],
  };
  if (emotionArc) {
    body.emotion_arc = [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000, intensity_0_1: 0.7, label: "high" },
    ];
  }
  return JSON.stringify(body);
}

function resp(content: string) {
  return { choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 } };
}

describe("F9 — critical-field bounded retry + read_drift", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    warnSpy.mockReset();
  });

  it("Test 1: empty emotion_arc on a video → ONE bounded retry, then accepts the good response", async () => {
    mockCreate
      .mockResolvedValueOnce(resp(makeBody({ emotionArc: false })))  // drift: no emotion_arc
      .mockResolvedValueOnce(resp(makeBody({ emotionArc: true })));  // retry returns it

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(2); // retry fired
    const arc = (out.geminiResult?.analysis as unknown as { emotion_arc?: unknown[] })?.emotion_arc;
    expect(arc).toHaveLength(2);
  });

  it("Test 2: still-empty emotion_arc after the retry → accepts gracefully AND logs read_drift", async () => {
    mockCreate
      .mockResolvedValueOnce(resp(makeBody({ emotionArc: false })))
      .mockResolvedValueOnce(resp(makeBody({ emotionArc: false }))); // still drifted

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Graceful: the read still returns (no thrown frame), emotion_arc just absent.
    expect(out.geminiResult).not.toBeNull();
    const arc = (out.geminiResult?.analysis as unknown as { emotion_arc?: unknown[] })?.emotion_arc;
    expect(arc === undefined || (Array.isArray(arc) && arc.length === 0)).toBe(true);
    // Telemetry: a read_drift entry naming the field — no longer a silent drop.
    const driftCall = warnSpy.mock.calls.find((c) => c[0] === "read_drift");
    expect(driftCall).toBeDefined();
    expect(driftCall?.[1]?.drifted_fields).toContain("emotion_arc");
  });

  it("Test 3: a valid full response → NO retry, NO read_drift", async () => {
    mockCreate.mockResolvedValueOnce(resp(makeBody({})));

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(1); // no retry
    expect(out.geminiResult).not.toBeNull();
    expect(warnSpy.mock.calls.find((c) => c[0] === "read_drift")).toBeUndefined();
  });

  it("Test 4a: hook_verbatim null on a SPEECH video → retry-then-log path", async () => {
    mockCreate
      .mockResolvedValueOnce(resp(makeBody({ speech: true, spokenWords: null }))) // drift
      .mockResolvedValueOnce(resp(makeBody({ speech: true, spokenWords: null }))); // still

    await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const driftCall = warnSpy.mock.calls.find((c) => c[0] === "read_drift");
    expect(driftCall?.[1]?.drifted_fields).toContain("hook_verbatim");
  });

  it("Test 4b: hook_verbatim null on a NO-SPEECH video → LEGIT, no retry, no drift (F46 interplay)", async () => {
    mockCreate.mockResolvedValueOnce(resp(makeBody({ speech: false, spokenWords: null, contentType: "b_roll" })));

    await analyzeVideoWithOmni("https://example.com/v.mp4");

    expect(mockCreate).toHaveBeenCalledTimes(1); // no spurious retry on a genuinely silent video
    expect(warnSpy.mock.calls.find((c) => c[0] === "read_drift")).toBeUndefined();
  });
});
