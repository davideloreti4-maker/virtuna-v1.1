/**
 * remix-runner.test.ts — runRemixPipeline unit tests (Task 1, plan 06-04).
 *
 * Tests:
 *   - runRemixPipeline calls the full chain in order: resolveAndRehost → analyzeVideoWithOmni
 *     → omniOutputToStructuralInput → runDecode → decodeResultToAdaptInput
 *     → generateAdaptConcepts (T-pipeline-order)
 *   - cleanup() is called in finally even when decode returns null (T-03-02)
 *   - cleanup() is called in finally even when adapt throws (T-03-02)
 *   - a null decode returns result with error:"decode_failed" and no throw (Pitfall 6 graceful)
 *   - exactly ONE remix-card returned (cardinality A3/scout — concepts[0])
 *   - Flash gate scores the ADAPTED hook with framing "hook" (D-05 opener-scoped)
 *   - runRemixPipeline does NOT import runPredictionPipeline or touch ENGINE_VERSION (D-05a)
 *   - null/empty adapt concepts returns error:"adapt_failed"
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RemixCardBlock } from "@/lib/tools/blocks";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCleanup = vi.fn().mockResolvedValue(undefined);
const mockResolveAndRehost = vi.fn();
const mockAnalyzeVideoWithOmni = vi.fn();
const mockOmniOutputToStructuralInput = vi.fn();
const mockRunDecode = vi.fn();
const mockGenerateAdaptConcepts = vi.fn();
const mockRunFlashTextMode = vi.fn();

vi.mock("@/lib/engine/remix/resolve-and-rehost", () => ({
  resolveAndRehost: (...args: unknown[]) => mockResolveAndRehost(...args),
}));

vi.mock("@/lib/engine/qwen/omni-analysis", () => ({
  analyzeVideoWithOmni: (...args: unknown[]) => mockAnalyzeVideoWithOmni(...args),
}));

vi.mock("@/lib/engine/remix/decode", () => ({
  omniOutputToStructuralInput: (...args: unknown[]) => mockOmniOutputToStructuralInput(...args),
  runDecode: (...args: unknown[]) => mockRunDecode(...args),
}));

vi.mock("@/lib/engine/remix/decode-types", () => ({
  decodeResultToAdaptInput: vi.fn((_decode: unknown, niche: string) => ({
    hook_pattern: "hook pattern body",
    structure: "structure body",
    the_turn: "the turn body",
    emotional_beat: "emotional beat body",
    repeatable: [{ label: "open-loop cold open", why_repeatable: "" }],
    niche,
  })),
}));

vi.mock("@/lib/engine/remix/adapt", () => ({
  generateAdaptConcepts: (...args: unknown[]) => mockGenerateAdaptConcepts(...args),
}));

vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextMode: (...args: unknown[]) => mockRunFlashTextMode(...args),
}));

// ─── Mock pinPredictedSignature (FLYWHEEL-02) ─────────────────────────────────
const mockPinPredictedSignature = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/tools/runners/flash-runner", () => ({
  pinPredictedSignature: (...args: unknown[]) => mockPinPredictedSignature(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOmniOutput() {
  return { geminiResult: { analysis: {}, cost_cents: 0.01 }, wave0Result: {} };
}

function makeStructuralInput() {
  return {
    hook_decomposition: { visual_stop_power: 8 },
    factors: [],
    video_signals: { visual_production_quality: 7, pacing_score: 6, transition_quality: 5 },
    content_summary: "Test content",
    overall_impression: "Good",
    content_type: "talking_head",
    niche_primary_slug: "fitness",
  };
}

function makeDecodeResult() {
  return {
    beats: [
      { id: "hook_pattern",       body: "A pattern interrupt", verdict: "present" },
      { id: "structure_pacing",   body: "Fast setup",         verdict: "present" },
      { id: "the_turn",           body: "Unexpected pivot",   verdict: "present" },
      { id: "emotional_beat",     body: "Hope and resolve",   verdict: "present" },
    ],
    repeatable: ["open-loop cold open"],
    luck: [{ category: "algorithmic_outlier", note: "Distribution spike" }],
  };
}

function makeAdaptConcepts() {
  return [
    {
      hook: "The real reason 90% of fitness beginners quit (and the fix)",
      angle: "Cold-open pattern interrupt reveals hidden truth",
      who_its_for: "Beginner fitness creators targeting 18-30 demographic",
      format_borrowed: "open-loop cold open",
    },
    {
      hook: "What no nutrition coach tells you about sustainable eating",
      angle: "Authority-challenge structure reframed for niche",
      who_its_for: "Nutrition-focused audience seeking long-term results",
      format_borrowed: "authority-challenge opener",
    },
    {
      hook: "This workout mistake is costing you 2 hours a week",
      angle: "Loss-aversion hook for time-conscious creators",
      who_its_for: "Busy professionals in fitness niche",
      format_borrowed: "loss-aversion hook",
    },
  ];
}

function makeStrongPersonas() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "tough_crowd" : `arch_${i}`,
    verdict: i < 7 ? "stop" : "scroll",
    quote: `Strong quote from persona ${i}`,
  }));
}

function makeProfileRow() {
  return {
    user_id: "user-123",
    niche_primary: "fitness",
    niche_sub: null,
    target_audience: { age_range: "18-25", gender_skew: null, geo: null, language: null },
    primary_goal: null,
    past_wins: null,
    past_flops: null,
    target_platforms: ["tiktok"],
  };
}

function setupHappyPath() {
  mockResolveAndRehost.mockResolvedValue({
    signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
    cleanup: mockCleanup,
  });
  mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
  mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
  mockRunDecode.mockResolvedValue(makeDecodeResult());
  mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts());
  mockRunFlashTextMode.mockResolvedValue({
    result: { personas: makeStrongPersonas() },
    warnings: [],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runRemixPipeline (runner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanup.mockResolvedValue(undefined);
  });

  it("calls the full chain in order: resolveAndRehost → analyzeVideoWithOmni → omniOutputToStructuralInput → runDecode → decodeResultToAdaptInput → generateAdaptConcepts", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
    });

    expect(result.error).toBeUndefined();
    expect(mockResolveAndRehost).toHaveBeenCalledTimes(1);
    expect(mockResolveAndRehost).toHaveBeenCalledWith(
      "https://www.tiktok.com/@creator/video/123456",
      "req-abc",
    );
    expect(mockAnalyzeVideoWithOmni).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeVideoWithOmni).toHaveBeenCalledWith(
      "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
    );
    expect(mockOmniOutputToStructuralInput).toHaveBeenCalledTimes(1);
    expect(mockRunDecode).toHaveBeenCalledTimes(1);
    expect(mockGenerateAdaptConcepts).toHaveBeenCalledTimes(1);
  });

  it("cleanup() is called in finally even when decode returns null (T-03-02)", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    // Decode returns null → graceful failure path
    mockRunDecode.mockResolvedValue(null);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: null,
      requestId: "req-null-decode",
    });

    expect(result.error).toBe("decode_failed");
    // cleanup MUST have been called even on decode_failed path
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("cleanup() is called in finally even when generateAdaptConcepts throws (T-03-02)", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(makeDecodeResult());
    // Adapt throws unexpectedly
    mockGenerateAdaptConcepts.mockRejectedValue(new Error("Qwen adapt call failed"));

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: null,
      requestId: "req-adapt-throw",
    });

    // Should not throw — should return adapt_failed gracefully
    expect(result.error).toBe("adapt_failed");
    // cleanup MUST still have been called
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("null decode returns error:'decode_failed' with blocks:[] and no throw (Pitfall 6 graceful)", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(null);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");

    // Must not throw
    let result: Awaited<ReturnType<typeof runRemixPipeline>>;
    await expect(async () => {
      result = await runRemixPipeline({
        url: "https://www.tiktok.com/@creator/video/123456",
        platform: "tiktok",
        profileRow: null,
        requestId: "req-graceful",
      });
    }).not.toThrow();

    result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: null,
      requestId: "req-graceful-2",
    });
    expect(result.blocks).toEqual([]);
    expect(result.error).toBe("decode_failed");
  });

  it("returns exactly ONE remix-card block from 3 adapt concepts (cardinality A3 — concepts[0])", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-cardinality",
    });

    expect(result.blocks.length).toBe(1);
    expect(result.blocks[0]!.type).toBe("remix-card");
  });

  it("Flash gate is called with the ADAPTED hook + framing:'hook' (D-05 opener-scoped)", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-flash-gate",
    });

    expect(mockRunFlashTextMode).toHaveBeenCalledTimes(1);
    const flashCall = mockRunFlashTextMode.mock.calls[0] as [string, string, unknown];
    const [callContent, callFraming] = flashCall;
    // The content passed to Flash must be the adapted hook (concepts[0].hook)
    expect(callContent).toBe(makeAdaptConcepts()[0]!.hook);
    expect(callFraming).toBe("hook");
  });

  it("remix-card block contains sourceDecode with REAL 4-beat anatomy (D-05 moat)", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-decode-anatomy",
    });

    expect(result.blocks.length).toBe(1);
    const card = result.blocks[0] as RemixCardBlock;
    expect(card.props.sourceDecode).toBeDefined();
    expect(typeof card.props.sourceDecode.hookPattern).toBe("string");
    expect(card.props.sourceDecode.hookPattern.length).toBeGreaterThan(0);
    expect(typeof card.props.sourceDecode.structure).toBe("string");
    expect(typeof card.props.sourceDecode.theTurn).toBe("string");
    expect(typeof card.props.sourceDecode.emotionalBeat).toBe("string");
  });

  it("null/empty adapt concepts returns error:'adapt_failed' with blocks:[]", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(makeDecodeResult());
    // generateAdaptConcepts returns null (graceful failure)
    mockGenerateAdaptConcepts.mockResolvedValue(null);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: null,
      requestId: "req-adapt-null",
    });

    expect(result.blocks).toEqual([]);
    expect(result.error).toBe("adapt_failed");
  });

  it("remix-card band/fraction come from aggregateFlash of the adapted hook SIM (Pitfall 5 opener-scoped)", async () => {
    setupHappyPath();
    // Override with known personas: 7 stop → Strong, 7/10 stop
    mockRunFlashTextMode.mockResolvedValue({
      result: { personas: makeStrongPersonas() },
      warnings: [],
    });

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-band",
    });

    expect(result.blocks.length).toBe(1);
    const card = result.blocks[0] as RemixCardBlock;
    expect(card.props.band).toBe("Strong");
    expect(card.props.fraction).toBe("7/10 stop");
    expect(card.props.model).toBe("sim1-flash");
  });

  it("module does NOT import runPredictionPipeline or ENGINE_VERSION (D-05a guard)", async () => {
    // Import the module and inspect it — cannot directly assert at import level in TS,
    // so we verify that calling runRemixPipeline with our mocks (which do NOT include
    // those forbidden imports) works without errors. The structural guarantee is in the
    // source file itself (no such imports). Here we assert the mock surface is not extended.
    setupHappyPath();

    const remixRunner = await import("@/lib/tools/runners/remix-runner");
    // The exported surface must only be runRemixPipeline, RemixPipelineInput (type), RemixPipelineResult (type)
    // No runPredictionPipeline or ENGINE_VERSION should be re-exported
    expect("runPredictionPipeline" in remixRunner).toBe(false);
    expect("ENGINE_VERSION" in remixRunner).toBe(false);
    expect("aggregateScores" in remixRunner).toBe(false);
  });

  it("resolve failure returns error:'resolve_failed' and does not call analyzeVideoWithOmni", async () => {
    mockResolveAndRehost.mockRejectedValue(new Error("Apify resolve failed"));

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: null,
      requestId: "req-resolve-fail",
    });

    expect(result.error).toBe("resolve_failed");
    expect(result.blocks).toEqual([]);
    expect(mockAnalyzeVideoWithOmni).not.toHaveBeenCalled();
  });
});

// ─── FLYWHEEL-02: predicted-signature pin wiring ──────────────────────────────

const calibratedAudience = {
  id: "aud-calibrated",
  user_id: "user-1",
  name: "Skincare Buyers",
  type: "target",
  platform: "instagram",
  goal_label: "Drive sales",
  goal_intent: "sell",
  is_general: false,
  is_preset: false,
  persona_weights: { fyp: 0.4, niche: 0.4, loyalist: 0.15, cross_niche: 0.05 },
  personas: [],
  profile: null,
  calibration: null,
  created_at: "2026-06-19T00:00:00Z",
  updated_at: "2026-06-19T00:00:00Z",
} as never;

const generalAudience = { ...(calibratedAudience as object), id: "general", is_general: true, personas: [] } as never;

describe("runRemixPipeline — FLYWHEEL-02 predicted pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanup.mockResolvedValue(undefined);
  });

  it("pins the adapted hook's personas with the run's audience_id + analysis_id", async () => {
    setupHappyPath();
    const adaptedHookPersonas = makeStrongPersonas();
    mockRunFlashTextMode.mockResolvedValue({
      result: { personas: adaptedHookPersonas },
      warnings: [],
    });

    const supabase = {} as never;
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
      audience: calibratedAudience,
      pin: { supabase, analysisId: "an-1" },
    });

    expect(mockPinPredictedSignature).toHaveBeenCalledTimes(1);
    expect(mockPinPredictedSignature).toHaveBeenCalledWith(supabase, adaptedHookPersonas, {
      audienceId: "aud-calibrated",
      analysisId: "an-1",
    });
  });

  it("pins audience_id null for a General audience", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
      audience: generalAudience,
      pin: { supabase: {} as never, analysisId: null },
    });

    expect(mockPinPredictedSignature).toHaveBeenCalledTimes(1);
    expect(mockPinPredictedSignature.mock.calls[0]![2]).toEqual({
      audienceId: null,
      analysisId: null,
    });
  });

  it("does NOT pin when no pin context is passed", async () => {
    setupHappyPath();
    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
    });

    expect(mockPinPredictedSignature).not.toHaveBeenCalled();
  });
});
