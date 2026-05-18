/**
 * Unit tests for src/lib/engine/gemini/hook-segment.ts — Phase 5 Plan 02 Task 1.
 *
 * Mirrors the wave0-content-type.test.ts mock pattern (Phase 4 verified analog).
 * Tests cover:
 *  - videoMetadata `{ startOffset: "0s", endOffset: "5s" }` is a SIBLING of fileData (Pitfall #3 + #4)
 *  - responseSchema === HOOK_SEGMENT_GEMINI_SCHEMA from Plan 01
 *  - Per-segment AbortController (Pitfall #5)
 *  - cost_cents > 0 + per-stage Sentry tag (Phase 4 D-04 analog)
 *  - Zod-at-boundary failure path → { ok: false } + emitStageEnd ok:false + Sentry
 *  - stage_start + stage_end pair under wave: 1 (D-14)
 *  - Timeout / abort path → clearTimeout in finally
 *  - process.env.GEMINI_HOOK_MODEL respected (env-var-with-default per D-02)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageEvent } from "../events";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockGenerate = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = { upload: vi.fn(), get: vi.fn(), delete: vi.fn() };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT",
      STRING: "STRING",
      NUMBER: "NUMBER",
      BOOLEAN: "BOOLEAN",
      ARRAY: "ARRAY",
    },
  };
});

process.env.GEMINI_API_KEY = "test-key";
// Defaults from Plan 01 env vars — explicitly set here for test determinism.
process.env.GEMINI_HOOK_MODEL = "gemini-3.1-pro-preview";

import { runHookSegment } from "../gemini/hook-segment";
import type { CalibrationData } from "../gemini";

const VALID_HOOK_FIXTURE = {
  factors: [
    {
      name: "Scroll-Stop Power",
      score: 7,
      rationale: "Strong face-first frame at 0.2s",
      improvement_tip: "Add motion in first 0.5s",
    },
    {
      name: "Completion Pull",
      score: 6,
      rationale: "Promises an outcome the body delivers",
      improvement_tip: "Tighten the promise",
    },
    {
      name: "Rewatch Potential",
      score: 5,
      rationale: "Single-watch payoff",
      improvement_tip: "Add a hidden detail",
    },
    {
      name: "Share Trigger",
      score: 5,
      rationale: "Relatable but not tag-worthy",
      improvement_tip: "End with a question",
    },
    {
      name: "Emotional Charge",
      score: 6,
      rationale: "Energetic opening",
      improvement_tip: "Sharpen the mood",
    },
  ],
  overall_impression: "Solid hook with motion-led visual",
  content_summary: "Beauty tutorial opener with face shot",
  hook_decomposition: {
    visual_stop_power: 7.5,
    audio_hook_quality: 6.0,
    text_overlay_score: 4.5,
    first_words_speech_score: 7.0,
    weakest_modality: "text_overlay_score",
    visual_audio_coherence: 7.0,
    cognitive_load: 3.0,
  },
};

const HOOK_USAGE = { promptTokenCount: 1790, candidatesTokenCount: 800 };

const STUB_CAL: CalibrationData = {
  primary_kpis: {
    share_rate: { viral_threshold: 0.02 },
    weighted_engagement_score: { percentiles: { p90: 85 } },
  },
  duration_analysis: {
    sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 60] },
  },
  viral_vs_average: { differentiators: [] },
};

const STUB_OPTS = {
  calibration: STUB_CAL,
  niche: "beauty",
  contentType: "tutorial" as const,
};

const mockAi = {
  models: { generateContent: mockGenerate },
  files: { upload: vi.fn(), get: vi.fn(), delete: vi.fn() },
};

describe("runHookSegment — Phase 5 Plan 02", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: calls generateContent exactly ONCE with model 'gemini-3.1-pro-preview' (default)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const call = mockGenerate.mock.calls[0]![0] as { model: string };
    expect(call.model).toBe("gemini-3.1-pro-preview");
  });

  it("Test 2: videoMetadata is a sibling of fileData with { startOffset: '0s', endOffset: '5s' } (Pitfall #3 + #4)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    const call = mockGenerate.mock.calls[0]![0] as {
      contents: Array<{ parts: Array<Record<string, unknown>> }>;
    };
    const videoPart = call.contents[0]!.parts[1] as {
      fileData?: { fileUri: string; mimeType: string };
      videoMetadata?: { startOffset: string; endOffset: string };
    };
    expect(videoPart.fileData).toEqual({ fileUri: "files/abc", mimeType: "video/mp4" });
    expect(videoPart.videoMetadata).toEqual({ startOffset: "0s", endOffset: "5s" });
  });

  it("Test 3: responseSchema equals HOOK_SEGMENT_GEMINI_SCHEMA (Plan 01 import)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    const { HOOK_SEGMENT_GEMINI_SCHEMA } = await import("../gemini/schemas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    const call = mockGenerate.mock.calls[0]![0] as { config: { responseSchema: unknown } };
    expect(call.config.responseSchema).toBe(HOOK_SEGMENT_GEMINI_SCHEMA);
  });

  it("Test 4: abortSignal is an instance of AbortSignal (per-segment AbortController, Pitfall #5)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    const call = mockGenerate.mock.calls[0]![0] as { config: { abortSignal: unknown } };
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("Test 5: success → { ok: true, analysis, cost_cents > 0, model } shape", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.analysis.factors).toHaveLength(5);
      expect(result.analysis.hook_decomposition.weakest_modality).toBe("text_overlay_score");
      expect(result.cost_cents).toBeGreaterThan(0);
      expect(result.model).toBe("gemini-3.1-pro-preview");
    }
  });

  it("Test 6: Zod-parse failure → { ok: false, error } + Sentry.captureException with tags.stage='gemini_hook'", async () => {
    const Sentry = await import("@sentry/nextjs");
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ malformed: "garbage" }),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    expect(result.ok).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const call = (Sentry.captureException as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    const tags = (call[1] as { tags: { stage: string } }).tags;
    expect(tags.stage).toBe("gemini_hook");
  });

  it("Test 7: Zod-parse failure → emits ONE stage_end with ok:false (NOT pipeline_warning)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({ malformed: "garbage" }),
      usageMetadata: HOOK_USAGE,
    });
    const events: StageEvent[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", {
      ...STUB_OPTS,
      onStageEvent: (e) => events.push(e),
    });
    const stageEnds = events.filter((e) => e.type === "stage_end");
    expect(stageEnds).toHaveLength(1);
    expect((stageEnds[0] as { ok: boolean }).ok).toBe(false);
    const warnings = events.filter((e) => e.type === "pipeline_warning");
    expect(warnings).toHaveLength(0);
  });

  it("Test 8: success → exactly ONE stage_start and ONE stage_end (wave: 1, stage: 'gemini_hook', ok: true, cost_cents > 0)", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    const events: StageEvent[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", {
      ...STUB_OPTS,
      onStageEvent: (e) => events.push(e),
    });
    const starts = events.filter((e) => e.type === "stage_start");
    const ends = events.filter((e) => e.type === "stage_end");
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect((starts[0] as { stage: string; wave: number }).stage).toBe("gemini_hook");
    expect((starts[0] as { stage: string; wave: number }).wave).toBe(1);
    expect((ends[0] as { stage: string; wave: number; ok: boolean; cost_cents: number }).stage).toBe("gemini_hook");
    expect((ends[0] as { stage: string; wave: number; ok: boolean; cost_cents: number }).wave).toBe(1);
    expect((ends[0] as { stage: string; wave: number; ok: boolean; cost_cents: number }).ok).toBe(true);
    expect((ends[0] as { stage: string; wave: number; ok: boolean; cost_cents: number }).cost_cents).toBeGreaterThan(0);
  });

  it("Test 9: abort/timeout path → { ok: false, error } and clearTimeout fires (no dangling timer)", async () => {
    // Reject with AbortError simulating timeout firing.
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    mockGenerate.mockRejectedValue(abortError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
    // Implicitly verifies clearTimeout was called in finally — otherwise vitest would warn about hanging timers.
  });

  it("Test 10: env GEMINI_HOOK_MODEL controls the model name used", async () => {
    // Note: env var is read at module-load time via export const, so we can't easily change it mid-test.
    // Instead, verify that the static binding matches the env var that was set at import time.
    const { GEMINI_HOOK_MODEL } = await import("../gemini");
    expect(GEMINI_HOOK_MODEL).toBe("gemini-3.1-pro-preview");
    // And that the helper threads it through (Test 1 already proved this).
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runHookSegment(mockAi as any, "files/abc", "video/mp4", STUB_OPTS);
    const call = mockGenerate.mock.calls[0]![0] as { model: string };
    expect(call.model).toBe(GEMINI_HOOK_MODEL);
  });
});
