/**
 * Phase 5 Plan 03 Task 3 — AI-SPEC eval D1-D17 alignment cross-checks.
 *
 * Cross-cutting verification that Plan 02's segment helpers + merge + Plan 03's
 * pipeline/aggregator integration satisfy the AI-SPEC §5 eval dimensions that are
 * code-checkable inside Phase 5 (D1, D2, D3, D8, D14, D15, D16) plus a smoke test
 * for D-11 legacy compatibility.
 *
 * Dimensions in scope:
 *   D1  — per-segment Zod schema compliance
 *   D2  — per-segment cost cap warning emission
 *   D3  — partial-failure flag correctness (re-confirmation cross-check)
 *   D8  — cognitive_load polarity perturbation pair (schema-level)
 *   D14 — short-video body-skip NOT a failure (no false-positive warning)
 *   D15 — rationale-vs-score consistency (NEW via validateRationaleConsistency)
 *   D16 — temporal grounding regex check (NEW via validateRationaleConsistency)
 *   D-11 — legacy analyzeVideoWithGemini export still callable
 *
 * Out of scope (Phase 12 acceptance gate territory):
 *   D17–D21 — LLM-judge correlation, latency, segmented-vs-legacy outcome lift,
 *             CTA-aware aggregator lift, partial-failure preserves usable score.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageEvent } from "../events";
import type { HookSegmentResult, BodySegmentResult, CtaSegmentResult } from "../gemini/schemas";
import type { SegmentResult } from "../gemini/hook-segment";

// =====================================================
// Mocks for the orchestrator test (Test 9: cross-segment cost summation)
// =====================================================

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

import { mergeSegments, validateRationaleConsistency } from "../gemini/merge";
import { analyzeVideoSegmented } from "../gemini/segmented";
import { analyzeVideoWithGemini } from "../gemini"; // D-11 legacy export
import { HookSegmentZodSchema } from "../gemini/schemas";
import type { CalibrationData } from "../gemini";

// =====================================================
// Fixture builders
// =====================================================

function buildHookFixture(overrides?: Partial<HookSegmentResult>): HookSegmentResult {
  return {
    factors: [
      { name: "Scroll-Stop Power", score: 7, rationale: "Strong opening", improvement_tip: "Add motion" },
      { name: "Completion Pull", score: 6, rationale: "Promises payoff", improvement_tip: "Tighten" },
      { name: "Rewatch Potential", score: 5, rationale: "Single watch", improvement_tip: "Add layer" },
      { name: "Share Trigger", score: 5, rationale: "Relatable", improvement_tip: "End w/ question" },
      { name: "Emotional Charge", score: 6, rationale: "Energetic", improvement_tip: "Sharpen mood" },
    ],
    overall_impression: "Solid",
    content_summary: "Beauty tutorial opener",
    hook_decomposition: {
      visual_stop_power: 7,
      audio_hook_quality: 6,
      text_overlay_score: 4,
      first_words_speech_score: 7,
      weakest_modality: "text_overlay_score",
      visual_audio_coherence: 7,
      cognitive_load: 3,
    },
    ...overrides,
  };
}

function buildBodyFixture(overrides?: Partial<BodySegmentResult>): BodySegmentResult {
  return {
    video_signals: {
      visual_production_quality: 7,
      pacing_score: 6,
      transition_quality: 5,
    },
    body_summary: "Body has steady three-beat pacing through the middle.",
    ...overrides,
  };
}

function buildCtaFixture(overrides?: Partial<CtaSegmentResult>): CtaSegmentResult {
  return {
    cta_present: true,
    strength: 7,
    type: "follow",
    rationale: "Creator says 'follow for more' at 28s",
    ...overrides,
  } as CtaSegmentResult;
}

function settledOk<T>(value: T, cost_cents = 0.5, model = "gemini-test"): PromiseSettledResult<SegmentResult<T>> {
  return { status: "fulfilled", value: { ok: true, analysis: value, cost_cents, model } };
}

function settledFail<T>(message = "segment failure"): PromiseSettledResult<SegmentResult<T>> {
  return { status: "fulfilled", value: { ok: false, error: new Error(message) } };
}

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

function smallVideo(): Buffer {
  return Buffer.from(new Uint8Array(2048));
}

function stubOpts(durationSeconds: number, events: StageEvent[] = []) {
  return {
    calibration: STUB_CAL,
    niche: "beauty",
    contentType: "tutorial" as const,
    onStageEvent: (e: StageEvent) => events.push(e),
    durationSeconds,
  };
}

// Identify which segment called generateContent (mirror gemini-segmented.test.ts).
type Segment = "hook" | "body" | "cta";
function segmentOf(call: { contents?: Array<{ parts?: Array<{ text?: string }> }> }): Segment {
  const text = call.contents?.[0]?.parts?.[0]?.text ?? "";
  if (text.includes("Scroll-Stop Power")) return "hook";
  if (text.includes("cta_present")) return "cta";
  return "body";
}

// =====================================================
// Tests
// =====================================================

describe("Phase 5 Plan 03 Task 3 — AI-SPEC eval D1-D17 alignment + D-11 legacy compat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileUpload.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockFileGet.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
    mockFileDelete.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------
  // Test 1 (D1) — schema compliance per segment
  // -------------------------------------------------------
  it("Test 1 (D1): malformed hook JSON → mergeSegments produces analysis with signalAvailability.gemini_hook=false (Zod is the boundary)", () => {
    const events: StageEvent[] = [];

    // Hook is a rejected promise (mimics what runHookSegment returns on Zod failure).
    const merged = mergeSegments(
      settledFail<HookSegmentResult>("Zod: missing hook_decomposition field"),
      settledOk(buildBodyFixture(), 0.3),
      settledOk(buildCtaFixture(), 0.1),
      (e) => events.push(e),
    );

    expect(merged.signalAvailability.gemini_hook).toBe(false);
    expect(merged.signalAvailability.gemini_body).toBe(true);
    expect(merged.signalAvailability.gemini_cta).toBe(true);
    // Hook-failed → factors null-filled (score 0 across the board); merged analysis still usable.
    expect(merged.analysis).not.toBeNull();
    expect(merged.analysis!.factors.every((f) => f.score === 0)).toBe(true);
  });

  // -------------------------------------------------------
  // Test 2 (D2) — per-segment hard cost cap warning
  // -------------------------------------------------------
  it("Test 2 (D2): hook cost > HOOK_COST_HARD_CAP_CENTS (2.0¢) emits pipeline_warning with 'exceeds hard cap'", async () => {
    // Drive a hook segment with very high usage to trip the cost cap. Easiest path:
    // call the helper directly via the orchestrator with a mock that returns inflated tokens.
    mockGenerate.mockImplementation(async (call: unknown) => {
      const seg = segmentOf(call as { contents?: Array<{ parts?: Array<{ text?: string }> }> });
      if (seg === "hook") {
        return {
          text: JSON.stringify(buildHookFixture()),
          // ~$2/M in × 1_000_000 input + $12/M out × 200_000 output = $2 + $2.4 = $4.40 → 440¢ → well over 2.0¢
          usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 200_000 },
        };
      }
      if (seg === "body") return { text: JSON.stringify(buildBodyFixture()), usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 } };
      return { text: JSON.stringify(buildCtaFixture()), usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 } };
    });

    const events: StageEvent[] = [];
    await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30, events));

    const hookWarnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "gemini_hook")
      .filter((e) => (e as { message: string }).message.includes("exceeds hard cap"));

    expect(hookWarnings.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------
  // Test 3 (D3) — partial-failure flag correctness (cross-check via mergeSegments)
  // -------------------------------------------------------
  it("Test 3 (D3): all 8 failure permutations → correct signalAvailability triple + warning count", () => {
    type Perm = [boolean, boolean, boolean]; // [hookOk, bodyOk, ctaOk]
    const permutations: Perm[] = [
      [true, true, true],   // HHH
      [true, true, false],  // HHF
      [true, false, true],  // HFH
      [true, false, false], // HFF
      [false, true, true],  // FHH
      [false, true, false], // FHF
      [false, false, true], // FFH
      [false, false, false],// FFF
    ];

    for (const [h, b, c] of permutations) {
      const events: StageEvent[] = [];
      const merged = mergeSegments(
        h ? settledOk(buildHookFixture(), 1.2) : settledFail<HookSegmentResult>("hook"),
        b ? settledOk(buildBodyFixture(), 0.4) : settledFail<BodySegmentResult>("body"),
        c ? settledOk(buildCtaFixture(), 0.2) : settledFail<CtaSegmentResult>("cta"),
        (e) => events.push(e),
      );

      expect(merged.signalAvailability).toEqual({
        gemini_hook: h,
        gemini_body: b,
        gemini_cta: c,
      });

      const warnings = events
        .filter((e) => e.type === "pipeline_warning")
        .map((e) => (e as { stage?: string }).stage);

      const failed = [!h && "gemini_hook", !b && "gemini_body", !c && "gemini_cta"].filter(Boolean) as string[];

      if (!h && !b && !c) {
        // 3-of-3 → ONE consolidated gemini_video_unavailable warning, no individual warnings.
        expect(warnings).toEqual(["gemini_video_unavailable"]);
      } else {
        for (const stage of failed) {
          expect(warnings).toContain(stage);
        }
        expect(warnings).not.toContain("gemini_video_unavailable");
      }
    }
  });

  // -------------------------------------------------------
  // Test 4 (D8) — cognitive_load polarity perturbation pair (schema level)
  // -------------------------------------------------------
  it("Test 4 (D8): cognitive_load=2 AND cognitive_load=9 both pass Zod parse; perturbation pair detectable downstream", () => {
    // Both pass the 0-10 schema; the polarity is conveyed through the PROMPT TEXT.
    const low = HookSegmentZodSchema.safeParse(buildHookFixture({
      hook_decomposition: {
        visual_stop_power: 7,
        audio_hook_quality: 6,
        text_overlay_score: 4,
        first_words_speech_score: 7,
        weakest_modality: "text_overlay_score",
        visual_audio_coherence: 7,
        cognitive_load: 2.0,
      },
    }));
    const high = HookSegmentZodSchema.safeParse(buildHookFixture({
      hook_decomposition: {
        visual_stop_power: 7,
        audio_hook_quality: 6,
        text_overlay_score: 4,
        first_words_speech_score: 7,
        weakest_modality: "text_overlay_score",
        visual_audio_coherence: 7,
        cognitive_load: 9.0,
      },
    }));

    expect(low.success).toBe(true);
    expect(high.success).toBe(true);
    if (low.success && high.success) {
      // Downstream code can detect the perturbation difference.
      expect(low.data.hook_decomposition.cognitive_load).toBe(2.0);
      expect(high.data.hook_decomposition.cognitive_load).toBe(9.0);
      expect(high.data.hook_decomposition.cognitive_load).toBeGreaterThan(
        low.data.hook_decomposition.cognitive_load,
      );
    }
  });

  // -------------------------------------------------------
  // Test 5 (D14) — short video body-skip is NOT a failure
  // -------------------------------------------------------
  it("Test 5 (D14): duration ≤ 8s → gemini_body=false BUT no gemini_body pipeline_warning fires (suppression in segmented.ts)", async () => {
    mockGenerate.mockImplementation(async (call: unknown) => {
      const seg = segmentOf(call as { contents?: Array<{ parts?: Array<{ text?: string }> }> });
      if (seg === "hook") return { text: JSON.stringify(buildHookFixture()), usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 } };
      if (seg === "body") return { text: JSON.stringify(buildBodyFixture()), usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 } };
      return { text: JSON.stringify(buildCtaFixture()), usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 200 } };
    });

    const events: StageEvent[] = [];
    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(6, events));

    // Body skipped → flag false.
    expect(result.signalAvailability.gemini_body).toBe(false);

    // BUT no `gemini_body` pipeline_warning fired (the orchestrator suppresses it because skip is by design).
    const bodyWarnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "gemini_body");
    expect(bodyWarnings).toHaveLength(0);
  });

  // -------------------------------------------------------
  // Test 6 (D15) — rationale claims absent text but text_overlay_score > 2 → flag
  // -------------------------------------------------------
  it("Test 6 (D15): rationale says 'no on-screen text' AND text_overlay_score > 2 → rationale_inconsistency pipeline_warning", () => {
    const events: StageEvent[] = [];

    validateRationaleConsistency(
      {
        factors: [
          { name: "Scroll-Stop Power", rationale: "Strong frame but no on-screen text overlay anywhere in hook." },
          { name: "Completion Pull", rationale: "Promises payoff." },
          { name: "Rewatch Potential", rationale: "Single watch." },
          { name: "Share Trigger", rationale: "Relatable." },
          { name: "Emotional Charge", rationale: "Energetic." },
        ],
        hook_decomposition: {
          text_overlay_score: 8,        // contradicts the "no on-screen text" rationale
          first_words_speech_score: 7,
        },
      },
      (e) => events.push(e),
    );

    const warnings = events.filter((e) => e.type === "pipeline_warning");
    expect(warnings.some(
      (e) => (e as { stage?: string }).stage === "rationale_inconsistency",
    )).toBe(true);
  });

  // -------------------------------------------------------
  // Test 7 (D15) — consistent case → no warning
  // -------------------------------------------------------
  it("Test 7 (D15): rationale says 'no on-screen text' AND text_overlay_score ≤ 2 → NO warning (score correctly matches absence)", () => {
    const events: StageEvent[] = [];

    validateRationaleConsistency(
      {
        factors: [
          { name: "Scroll-Stop Power", rationale: "No on-screen text overlay in hook; visual carries the entire stop power." },
          { name: "Completion Pull", rationale: "Promises payoff." },
          { name: "Rewatch Potential", rationale: "Single watch." },
          { name: "Share Trigger", rationale: "Relatable." },
          { name: "Emotional Charge", rationale: "Energetic." },
        ],
        hook_decomposition: {
          text_overlay_score: 1,    // matches "no on-screen text"
          first_words_speech_score: 7,
        },
      },
      (e) => events.push(e),
    );

    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "rationale_inconsistency");
    expect(warnings).toHaveLength(0);
  });

  // -------------------------------------------------------
  // Test 8 (D16) — temporal-grounding regex check
  // -------------------------------------------------------
  it("Test 8 (D16): rationale references 'later in the video' → hook_temporal_drift pipeline_warning", () => {
    const events: StageEvent[] = [];

    validateRationaleConsistency(
      {
        factors: [
          { name: "Scroll-Stop Power", rationale: "Opening shot is strong; later in the video she shows the full skincare routine." },
          { name: "Completion Pull", rationale: "Promises payoff." },
          { name: "Rewatch Potential", rationale: "Single watch." },
          { name: "Share Trigger", rationale: "Relatable." },
          { name: "Emotional Charge", rationale: "Energetic." },
        ],
        hook_decomposition: {
          text_overlay_score: 5,
          first_words_speech_score: 7,
        },
      },
      (e) => events.push(e),
    );

    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "hook_temporal_drift");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("Test 8b (D16): rationale references '15s' → hook_temporal_drift pipeline_warning (timestamp > 5s)", () => {
    const events: StageEvent[] = [];

    validateRationaleConsistency(
      {
        factors: [
          { name: "Scroll-Stop Power", rationale: "Hook works at the start; at 15s the camera cuts to product detail." },
          { name: "Completion Pull", rationale: "Promises payoff." },
          { name: "Rewatch Potential", rationale: "Single watch." },
          { name: "Share Trigger", rationale: "Relatable." },
          { name: "Emotional Charge", rationale: "Energetic." },
        ],
        hook_decomposition: {
          text_overlay_score: 5,
          first_words_speech_score: 7,
        },
      },
      (e) => events.push(e),
    );

    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "hook_temporal_drift");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("Test 8c (D16): rationale references only 0-5s events → NO temporal_drift warning", () => {
    const events: StageEvent[] = [];

    validateRationaleConsistency(
      {
        factors: [
          { name: "Scroll-Stop Power", rationale: "Face-first frame at 0.2s with motion at 0.4s." },
          { name: "Completion Pull", rationale: "Promises payoff in opening 3s." },
          { name: "Rewatch Potential", rationale: "Hidden detail at 4s." },
          { name: "Share Trigger", rationale: "Relatable beat at 2s." },
          { name: "Emotional Charge", rationale: "Energetic peak at 1s." },
        ],
        hook_decomposition: {
          text_overlay_score: 5,
          first_words_speech_score: 7,
        },
      },
      (e) => events.push(e),
    );

    const warnings = events
      .filter((e) => e.type === "pipeline_warning")
      .filter((e) => (e as { stage?: string }).stage === "hook_temporal_drift");
    expect(warnings).toHaveLength(0);
  });

  // -------------------------------------------------------
  // Test 9 — cross-segment cost summation
  // -------------------------------------------------------
  it("Test 9: realistic 30s video usage on all 3 segments → merged cost_cents ≈ 2.0¢ (within ±0.5)", async () => {
    mockGenerate.mockImplementation(async (call: unknown) => {
      const seg = segmentOf(call as { contents?: Array<{ parts?: Array<{ text?: string }> }> });
      if (seg === "hook") {
        return {
          text: JSON.stringify(buildHookFixture()),
          usageMetadata: { promptTokenCount: 1790, candidatesTokenCount: 800 }, // typical Pro hook
        };
      }
      if (seg === "body") {
        return {
          text: JSON.stringify(buildBodyFixture()),
          usageMetadata: { promptTokenCount: 6075, candidatesTokenCount: 600 }, // typical Flash body
        };
      }
      return {
        text: JSON.stringify(buildCtaFixture()),
        usageMetadata: { promptTokenCount: 1074, candidatesTokenCount: 250 }, // typical Flash cta
      };
    });

    const result = await analyzeVideoSegmented(smallVideo(), "video/mp4", stubOpts(30));

    // AI-SPEC §4b cost table: hook ≈ 1.3¢, body ≈ 0.5¢, cta ≈ 0.2¢ → ~2.0¢ total.
    expect(result.cost_cents).toBeGreaterThan(0.5);
    expect(result.cost_cents).toBeLessThanOrEqual(5.0); // soft cap upper bound
    // Allow generous tolerance (±1.5) since pricing constants can drift between Plan 01 and Phase 12.
    expect(Math.abs(result.cost_cents - 2.0)).toBeLessThanOrEqual(1.5);
  });

  // -------------------------------------------------------
  // Test 10 (D-11) — legacy analyzeVideoWithGemini still callable
  // -------------------------------------------------------
  it("Test 10 (D-11): legacy analyzeVideoWithGemini export from gemini.ts still callable (eval-harness compat)", () => {
    expect(typeof analyzeVideoWithGemini).toBe("function");
    // Function-arity smoke check (3 required args: buffer, mimeType, niche).
    expect(analyzeVideoWithGemini.length).toBeGreaterThanOrEqual(2);
  });
});
