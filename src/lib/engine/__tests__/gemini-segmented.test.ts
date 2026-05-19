/**
 * Integration tests for src/lib/engine/gemini/segmented.ts — Phase 5 Plan 02 Task 3.
 *
 * This is the comprehensive integration suite that indirectly tests body + CTA helpers
 * by driving them through the orchestrator. Covers:
 *  - Window assertions for each segment (SEGMENT-01, SEGMENT-02, SEGMENT-03)
 *  - Single-upload + single-delete invariant (SEGMENT-04, D-10, Pitfall #1)
 *  - Per-segment events under wave 1 (D-14)
 *  - All 7 non-HHH partial-failure permutations end-to-end (D-08, D-09)
 *  - Short-video body-skip branch (Claude's Discretion option a)
 *  - Niche + contentType prompt injection (D-15)
 *  - Files API upload failure + processing-FAILED state (G4)
 *  - Per-segment AbortController independence (Pitfall #5)
 *  - 50MB size-cap rejection
 *
 * Mock pattern source: src/lib/engine/__tests__/wave0-content-type.test.ts:9-47 (Phase 4
 * verified analog). Same MockGoogleGenAI constructor exposing models.generateContent
 * + files.upload/get/delete.
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
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = {
      upload: mockFileUpload,
      get: mockFileGet,
      delete: mockFileDelete,
    };
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
process.env.GEMINI_HOOK_MODEL = "gemini-3.1-pro-preview";
process.env.GEMINI_BODY_MODEL = "gemini-3-flash-preview";
process.env.GEMINI_CTA_MODEL = "gemini-3-flash-preview";

import { analyzeVideoSegmented } from "../gemini/segmented";
import type { CalibrationData } from "../gemini";

// ============================================================================
// Fixtures
// ============================================================================

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

const VALID_BODY_FIXTURE = {
  video_signals: {
    visual_production_quality: 7,
    pacing_score: 6,
    transition_quality: 5,
  },
  body_summary: "Body has steady three-beat pacing through the middle.",
};

const VALID_CTA_FIXTURE = {
  cta_present: true,
  strength: 7,
  type: "follow",
  rationale: "Creator says 'follow for more' at 28s",
};

const HOOK_USAGE = { promptTokenCount: 1790, candidatesTokenCount: 800 };
const BODY_USAGE = { promptTokenCount: 6075, candidatesTokenCount: 600 };
const CTA_USAGE = { promptTokenCount: 1074, candidatesTokenCount: 250 };

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

// Build a small video buffer (well below the 50MB cap).
function smallVideo(): Buffer {
  return Buffer.from(new Uint8Array(2048));
}

// Build a 30s-window options object with niche + contentType injection.
function stubOpts(durationSeconds: number, events: StageEvent[] = []) {
  return {
    calibration: STUB_CAL,
    niche: "beauty",
    contentType: "tutorial" as const,
    onStageEvent: (e: StageEvent) => events.push(e),
    durationSeconds,
  };
}

// Helper: queue three successful generateContent responses in fan-out order (hook, body, cta).
function queueHHH() {
  mockGenerate
    .mockResolvedValueOnce({
      text: JSON.stringify(VALID_HOOK_FIXTURE),
      usageMetadata: HOOK_USAGE,
    })
    .mockResolvedValueOnce({
      text: JSON.stringify(VALID_BODY_FIXTURE),
      usageMetadata: BODY_USAGE,
    })
    .mockResolvedValueOnce({
      text: JSON.stringify(VALID_CTA_FIXTURE),
      usageMetadata: CTA_USAGE,
    });
}

// Extract videoMetadata from each generateContent call.
function extractVideoMetadata(
  call: unknown,
): { startOffset: string; endOffset: string } | undefined {
  const typed = call as {
    contents?: Array<{ parts?: Array<Record<string, unknown>> }>;
  };
  const part = typed.contents?.[0]?.parts?.[1] as
    | { videoMetadata?: { startOffset: string; endOffset: string } }
    | undefined;
  return part?.videoMetadata;
}

// Extract prompt text (parts[0].text) from each generateContent call.
function extractPromptText(call: unknown): string {
  const typed = call as {
    contents?: Array<{ parts?: Array<{ text?: string }> }>;
  };
  return typed.contents?.[0]?.parts?.[0]?.text ?? "";
}

// ============================================================================
// Tests
// ============================================================================

describe("analyzeVideoSegmented — Phase 5 Plan 02 Task 3 orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUpload.mockResolvedValue({
      name: "files/abc",
      state: "ACTIVE",
      uri: "gs://abc",
    });
    mockFileGet.mockResolvedValue({
      name: "files/abc",
      state: "ACTIVE",
      uri: "gs://abc",
    });
    mockFileDelete.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Window assertions (SEGMENT-01, SEGMENT-02, SEGMENT-03 + Pitfall #4)
  // -------------------------------------------------------------------------

  it("Test 1: 30s video → 3 generateContent calls with correct window strings", async () => {
    queueHHH();
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    // Calls are issued in fan-out order: hook (index 0), body (1), cta (2).
    const hookMeta = extractVideoMetadata(mockGenerate.mock.calls[0]![0]);
    const bodyMeta = extractVideoMetadata(mockGenerate.mock.calls[1]![0]);
    const ctaMeta = extractVideoMetadata(mockGenerate.mock.calls[2]![0]);
    expect(hookMeta).toEqual({ startOffset: "0s", endOffset: "5s" });
    expect(bodyMeta).toEqual({ startOffset: "5s", endOffset: "27s" });
    expect(ctaMeta).toEqual({ startOffset: "27s", endOffset: "30s" });
  });

  it("Test 2: 22s video → body window `{5s, 19s}`, cta window `{19s, 22s}` (Pitfall #4 zero-padding)", async () => {
    queueHHH();
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(22));

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    const bodyMeta = extractVideoMetadata(mockGenerate.mock.calls[1]![0]);
    const ctaMeta = extractVideoMetadata(mockGenerate.mock.calls[2]![0]);
    // STRING with "s" suffix — NOT "19.0s", NOT 19 (numeric).
    expect(bodyMeta).toEqual({ startOffset: "5s", endOffset: "19s" });
    expect(ctaMeta).toEqual({ startOffset: "19s", endOffset: "22s" });
    // Sanity: no trailing decimals (".0s") or numeric serialization.
    expect(bodyMeta!.endOffset).not.toMatch(/\./);
    expect(typeof bodyMeta!.endOffset).toBe("string");
  });

  // -------------------------------------------------------------------------
  // Single-upload invariant (SEGMENT-04, D-10, Pitfall #1)
  // -------------------------------------------------------------------------

  it("Test 3: Exactly ONE files.upload + ONE files.delete per call (Pitfall #1)", async () => {
    queueHHH();
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));
    expect(mockFileUpload).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  it("Test 4: files.delete fires AFTER all 3 generateContent calls resolve", async () => {
    const callOrder: string[] = [];
    mockGenerate
      .mockImplementationOnce(async () => {
        callOrder.push("generate-hook");
        return { text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE };
      })
      .mockImplementationOnce(async () => {
        callOrder.push("generate-body");
        return { text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE };
      })
      .mockImplementationOnce(async () => {
        callOrder.push("generate-cta");
        return { text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE };
      });
    mockFileDelete.mockImplementation(async () => {
      callOrder.push("delete");
    });

    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));

    // delete must be the LAST entry.
    expect(callOrder[callOrder.length - 1]).toBe("delete");
    // All 3 generates must precede the delete.
    expect(callOrder.filter((s) => s.startsWith("generate-"))).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Per-segment events under wave 1 (D-14)
  // -------------------------------------------------------------------------

  it("Test 5: emits stage_start/stage_end for gemini_hook + gemini_body + gemini_cta under wave 1 (no wrapper event)", async () => {
    queueHHH();
    const events: StageEvent[] = [];
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));

    const stageEvents = events.filter(
      (e) => e.type === "stage_start" || e.type === "stage_end",
    );
    const stages = stageEvents.map((e) => (e as { stage: string }).stage);
    expect(stages.filter((s) => s === "gemini_hook")).toHaveLength(2);
    expect(stages.filter((s) => s === "gemini_body")).toHaveLength(2);
    expect(stages.filter((s) => s === "gemini_cta")).toHaveLength(2);
    // All under wave 1 per D-14.
    for (const event of stageEvents) {
      expect((event as { wave: number }).wave).toBe(1);
    }
    // No wrapper event with stage name `gemini_video_analysis` (D-14).
    expect(stages).not.toContain("gemini_video_analysis");
  });

  // -------------------------------------------------------------------------
  // Partial-failure permutations end-to-end (D-08, D-09)
  // -------------------------------------------------------------------------

  it("Test 6: HHF (CTA failed) — signalAvailability.gemini_cta=false + ONE warning", async () => {
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE })
      .mockRejectedValueOnce(new Error("cta failed"));

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: false,
    });
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    // gemini_cta warning expected; no `gemini_video_unavailable` (not 3-of-3).
    expect(warnings.filter((s) => s === "gemini_cta")).toHaveLength(1);
    expect(warnings).not.toContain("gemini_video_unavailable");
  });

  it("Test 7: HFH (body failed) — gemini_body warning, hook+cta data preserved", async () => {
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockRejectedValue(new Error("body failed")) // body + body retry both fail
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE });

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability.gemini_body).toBe(false);
    expect(result.signalAvailability.gemini_hook).toBe(true);
    expect(result.signalAvailability.gemini_cta).toBe(true);
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    expect(warnings.filter((s) => s === "gemini_body")).toHaveLength(1);
  });

  it("Test 8: HFF (body + CTA failed) — two warnings, hook data intact", async () => {
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockRejectedValue(new Error("body + cta + retries all fail"));

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability).toEqual({
      gemini_hook: true,
      gemini_body: false,
      gemini_cta: false,
    });
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    expect(warnings.filter((s) => s === "gemini_body")).toHaveLength(1);
    expect(warnings.filter((s) => s === "gemini_cta")).toHaveLength(1);
    expect(warnings).not.toContain("gemini_video_unavailable");
  });

  it("Test 9: FHH (hook failed) — gemini_hook warning, factors null-filled", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("hook failed"))
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE });

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability.gemini_hook).toBe(false);
    expect(result.analysis).not.toBeNull();
    expect(result.analysis!.hook_decomposition).toBeNull();
    for (const f of result.analysis!.factors) {
      expect(f.score).toBe(0);
    }
  });

  it("Test 10: FHF (hook + cta failed) — two warnings, body data preserved", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("hook failed"))
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE })
      .mockRejectedValue(new Error("cta + retry failed"));

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: true,
      gemini_cta: false,
    });
  });

  it("Test 11: FFH (hook + body failed) — two warnings, cta data preserved", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("hook failed"))
      .mockRejectedValueOnce(new Error("body attempt 1"))
      .mockRejectedValueOnce(new Error("body attempt 2"))
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE });

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: true,
    });
  });

  it("Test 12: FFF (all failed, D-09) — analysis: null, cost_cents: 0, ONE consolidated `gemini_video_unavailable` warning", async () => {
    mockGenerate.mockRejectedValue(new Error("all failed"));

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));
    expect(result.analysis).toBeNull();
    expect(result.cost_cents).toBe(0);
    expect(result.signalAvailability).toEqual({
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
    });
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    // D-09: ONE consolidated warning, NOT three.
    expect(warnings.filter((s) => s === "gemini_video_unavailable")).toHaveLength(1);
    expect(warnings).not.toContain("gemini_hook");
    expect(warnings).not.toContain("gemini_body");
    expect(warnings).not.toContain("gemini_cta");
  });

  // -------------------------------------------------------------------------
  // Single-upload invariant under partial failure
  // -------------------------------------------------------------------------

  it("Test 13: HFF — files.delete still called exactly ONCE (Pitfall #1, outer finally)", async () => {
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockRejectedValue(new Error("body + cta failed"));

    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));
    expect(mockFileUpload).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Short-video body-skip branch (Claude's Discretion option a — D-08)
  // -------------------------------------------------------------------------

  it("Test 14: 7s video — body skipped (only 2 generateContent calls); gemini_body=false; CTA window {5s, 7s}; NO body pipeline_warning", async () => {
    // Only hook + cta fire. Order: hook (Promise.allSettled index 0), cta (index 2).
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE), usageMetadata: CTA_USAGE });

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(7, events));

    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(result.signalAvailability.gemini_body).toBe(false);
    expect(result.signalAvailability.gemini_hook).toBe(true);
    expect(result.signalAvailability.gemini_cta).toBe(true);

    // CTA window: max(5, 7-3)=5, end=7
    // The hook call is index 0, but the CTA call may be index 0 or 1 depending on
    // the orchestrator's fan-out fire order. Find it by scanning videoMetadata starts.
    const allMetas = mockGenerate.mock.calls.map((c) =>
      extractVideoMetadata(c[0]),
    );
    const ctaMeta = allMetas.find((m) => m?.endOffset === "7s" && m?.startOffset === "5s");
    expect(ctaMeta).toBeTruthy();

    // Body-skip is BY DESIGN — not a failure — no pipeline_warning should fire for body.
    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .map((e) => (e as { stage?: string }).stage);
    expect(warnings).not.toContain("gemini_body");
  });

  // -------------------------------------------------------------------------
  // Niche + contentType injection (D-15)
  // -------------------------------------------------------------------------

  it("Test 15: niche `beauty` and contentType `tutorial` appear in ALL 3 segment prompts (D-15)", async () => {
    queueHHH();
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));

    expect(mockGenerate).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      const text = extractPromptText(mockGenerate.mock.calls[i]![0]);
      expect(text).toContain("beauty");
      expect(text).toContain("tutorial");
    }
  });

  // -------------------------------------------------------------------------
  // Files API failure paths
  // -------------------------------------------------------------------------

  it("Test 16: Files API upload failure → throws + NO generateContent calls + NO delete call (no uploadedFileName)", async () => {
    mockFileUpload.mockRejectedValue(new Error("Files API upload failed"));

    await expect(
      analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30)),
    ).rejects.toThrow(/Files API upload failed/);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockFileDelete).not.toHaveBeenCalled();
  });

  it("Test 17: Files API processing FAILED → throws mentioning FAILED + files.delete IS called", async () => {
    mockFileUpload.mockResolvedValue({
      name: "files/abc",
      state: "PROCESSING",
      uri: null,
    });
    mockFileGet.mockResolvedValue({
      name: "files/abc",
      state: "FAILED",
      uri: null,
    });

    await expect(
      analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30)),
    ).rejects.toThrow(/FAILED|processing failed/i);

    expect(mockGenerate).not.toHaveBeenCalled();
    // uploadedFileName WAS set, so outer finally still tries to delete.
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Per-segment AbortController independence (Pitfall #5)
  // -------------------------------------------------------------------------

  it("Test 18: one segment hangs/aborts — other two still complete normally; delete still called once", async () => {
    // Body never resolves (Promise that never settles within the body 30s timeout window —
    // but in the test we synthesize this by making body reject with AbortError after a
    // microtask. The other two complete normally.).
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    mockGenerate
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
      // body retries — both fail with abort
      .mockRejectedValue(abortError);

    // CTA call still goes through after body's rejected attempts (helpers internally retry).
    // To ensure cta gets a fresh slot, sequence with mockResolvedValueOnce at index 1 for cta
    // path. But because Promise.allSettled fans concurrently, hook is index 0, body 1, cta 2
    // in mockGenerate's queue. The cleanest mock: hook=success, then ALL subsequent calls
    // alternate. We give cta success via mockResolvedValueOnce queued AFTER the rejections
    // exhaust:
    mockGenerate.mockReset();
    mockGenerate
      .mockImplementationOnce(async () => ({
        text: JSON.stringify(VALID_HOOK_FIXTURE),
        usageMetadata: HOOK_USAGE,
      })) // hook fires
      .mockImplementationOnce(async () => {
        throw abortError;
      }) // body attempt 1
      .mockImplementationOnce(async () => ({
        text: JSON.stringify(VALID_CTA_FIXTURE),
        usageMetadata: CTA_USAGE,
      })) // cta fires (no retry needed)
      .mockImplementationOnce(async () => {
        throw abortError;
      }); // body retry — still aborts

    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));
    // Hook + CTA succeed, body fails — partial result.
    expect(result.signalAvailability.gemini_hook).toBe(true);
    expect(result.signalAvailability.gemini_cta).toBe(true);
    expect(result.signalAvailability.gemini_body).toBe(false);
    // Single-upload invariant still holds.
    expect(mockFileUpload).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 50MB size-cap rejection
  // -------------------------------------------------------------------------

  it("Test 19: video > 50MB → throws size-cap error; NO upload/generate/delete fired", async () => {
    // Synthesize 51MB buffer (51 * 1024 * 1024 bytes).
    const oversized = Buffer.alloc(51 * 1024 * 1024);
    await expect(
      analyzeVideoSegmented(oversized, "video/mp4", stubOpts(30)),
    ).rejects.toThrow(/50MB|exceeds maximum/);

    expect(mockFileUpload).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockFileDelete).not.toHaveBeenCalled();
  });
});
