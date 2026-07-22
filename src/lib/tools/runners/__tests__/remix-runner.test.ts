/**
 * remix-runner.test.ts — runRemixPipeline unit tests (S3′ generate-rate-rank rebaseline).
 *
 * Tests:
 *   - runRemixPipeline calls the full chain in order: resolveAndRehost → analyzeVideoWithOmni
 *     → omniOutputToStructuralInput → runDecode → decodeResultToAdaptInput
 *     → generateAdaptConcepts (T-pipeline-order)
 *   - cleanup() is called in finally even when decode returns null (T-03-02)
 *   - cleanup() is called in finally even when adapt throws (T-03-02)
 *   - a null decode returns result with error:"decode_failed" and no throw (Pitfall 6 graceful)
 *   - S3′: SIM ONE batched call for ALL 3 concepts; ships ALL rated cards ranked by band→stop-count
 *   - Flash gate scores ALL ADAPTED hooks with framing "hook" (D-05 opener-scoped)
 *   - runRemixPipeline does NOT import runPredictionPipeline or touch ENGINE_VERSION (D-05a)
 *   - null/empty adapt concepts returns error:"adapt_failed"
 *   - each card carries personas (length 10) + shared sourceDecode 4-beat anatomy
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
const mockRunFlashTextModeBatch = vi.fn();

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

// S3′: runner now calls runFlashTextModeBatch (batched), not runFlashTextMode (N=1).
vi.mock("@/lib/engine/flash/run-flash-text-mode", () => ({
  runFlashTextModeBatch: (...args: unknown[]) => mockRunFlashTextModeBatch(...args),
}));

// Audience Sim v2 Stage 2 — the ONE content LLM call. New dependency; inert for existing tests
// (nothing else calls it). Mocked so the pure population math (population.ts) runs for real.
const mockCharacterizeContent = vi.fn();
vi.mock("@/lib/audience/characterize-content", () => ({
  characterizeContent: (...args: unknown[]) => mockCharacterizeContent(...args),
}));

// ─── Mock pinPredictedSignature (FLYWHEEL-02) ─────────────────────────────────
const mockPinPredictedSignature = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/tools/runners/predicted-pin", () => ({
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

/** 10-persona array: 7 stop → Strong, "7/10 stop". */
function makeStrongPersonas() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: i === 0 ? "tough_crowd" : `arch_${i}`,
    verdict: i < 7 ? "stop" : "scroll",
    quote: `Strong quote from persona ${i}`,
  }));
}

/** 10-persona array: 4 stop → Mixed, "4/10 stop". */
function makeMixedPersonas() {
  return Array.from({ length: 10 }, (_, i) => ({
    archetype: `arch_${i}`,
    verdict: i < 4 ? "stop" : "scroll",
    quote: `Mixed quote from persona ${i}`,
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

/**
 * Build a batch mock return value: Map keyed by candidate id "0","1","2",
 * each mapped to a personas array. Pass an array of persona arrays (length 3).
 */
function makeBatchResult(
  personasPerConcept: Array<ReturnType<typeof makeStrongPersonas>>,
) {
  const results = new Map(
    personasPerConcept.map((personas, i) => [String(i), { personas }]),
  );
  return { results, warnings: [] as string[] };
}

/**
 * Default happy-path setup — all 3 concepts get Strong reactions.
 * S3′: mockRunFlashTextModeBatch resolves once with a Map for all 3 candidates.
 */
function setupHappyPath() {
  mockResolveAndRehost.mockResolvedValue({
    signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
    cleanup: mockCleanup,
  });
  mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
  mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
  mockRunDecode.mockResolvedValue(makeDecodeResult());
  mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts());
  // All 3 concepts rated Strong
  mockRunFlashTextModeBatch.mockResolvedValue(
    makeBatchResult([makeStrongPersonas(), makeStrongPersonas(), makeStrongPersonas()]),
  );
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

  it("wires production: the adapt concept's shoot plan flows to the remix card (owner 2026-07-22)", async () => {
    setupHappyPath();
    // A concept carrying the ready-to-film plan — what a wired adapt call now returns.
    const production = {
      shots: "Cold-open talking-head, cut to habit-tracker b-roll",
      onScreenText: "'90% quit' overlay at 0s",
      setup: "Phone on tripod, window light",
      edit: "Hard cuts on the turn",
    };
    const concepts = makeAdaptConcepts();
    (concepts[0] as Record<string, unknown>).production = production;
    mockGenerateAdaptConcepts.mockResolvedValue(concepts);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
    });

    const card = result.blocks.find((b) => b.props.adaptedHook === concepts[0]!.hook);
    expect(card!.props.production).toEqual(production);
    // A concept with no shoot plan omits it (byte-identical to pre-wiring).
    const noPlan = result.blocks.find((b) => b.props.adaptedHook === concepts[1]!.hook);
    expect(noPlan!.props.production).toBeUndefined();
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

  /**
   * S3′ cardinality: was "exactly 1 remix-card (concepts[0])".
   * Now: ships ALL rated concepts (up to 3), ranked Strong→Mixed→Weak.
   * 3 concepts all Strong → 3 cards, ranked by stop-count then generation order.
   */
  it("S3′: ships ALL rated remix-card blocks (up to 3), ranked by band→stop-count", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-cardinality",
    });

    expect(result.error).toBeUndefined();
    // All 3 concepts rated Strong → all 3 cards returned
    expect(result.blocks.length).toBe(3);
    for (const block of result.blocks) {
      expect(block.type).toBe("remix-card");
    }
  });

  /**
   * S3′ ranking: mixed bands → Strong cards sort before Mixed cards.
   * Concepts: 0=Mixed(4 stop), 1=Strong(7 stop), 2=Mixed(4 stop).
   * Expected rank order: concept 1 (Strong) → concept 0 (Mixed, lower gen index) → concept 2.
   */
  it("S3′: ranks cards Strong before Mixed; among same band by stop-count then generation order", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(makeDecodeResult());
    mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts());
    // concept 0 → Mixed(4 stop), concept 1 → Strong(7 stop), concept 2 → Mixed(4 stop)
    mockRunFlashTextModeBatch.mockResolvedValue(
      makeBatchResult([makeMixedPersonas(), makeStrongPersonas(), makeMixedPersonas()]),
    );

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-ranking",
    });

    expect(result.blocks.length).toBe(3);
    const cards = result.blocks as RemixCardBlock[];
    // Rank-1 card must be Strong (concept index 1)
    expect(cards[0]!.props.band).toBe("Strong");
    expect(cards[0]!.props.adaptedHook).toBe(makeAdaptConcepts()[1]!.hook);
    // Remaining two are Mixed
    expect(cards[1]!.props.band).toBe("Mixed");
    expect(cards[2]!.props.band).toBe("Mixed");
    // Among Mixed, generation order preserved (concept 0 before concept 2)
    expect(cards[1]!.props.adaptedHook).toBe(makeAdaptConcepts()[0]!.hook);
    expect(cards[2]!.props.adaptedHook).toBe(makeAdaptConcepts()[2]!.hook);
  });

  /**
   * S3′ SIM call count: ONE batched call for ALL 3 concepts (not 1 call per concept).
   * The candidates array must contain all 3 hooks with ids "0","1","2".
   * Framing must be "hook" (D-05 opener-scoped, Pitfall 5).
   */
  it("S3′: Flash gate calls runFlashTextModeBatch ONCE with all 3 candidates + framing:'hook'", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-flash-gate",
    });

    // ONE batched call (not N=3 individual calls)
    expect(mockRunFlashTextModeBatch).toHaveBeenCalledTimes(1);

    const [candidates, framing] = mockRunFlashTextModeBatch.mock.calls[0] as [
      Array<{ id: string; text: string }>,
      string,
    ];

    // All 3 adapted hooks submitted as candidates
    expect(candidates).toHaveLength(3);
    const concepts = makeAdaptConcepts();
    expect(candidates[0]).toEqual({ id: "0", text: concepts[0]!.hook });
    expect(candidates[1]).toEqual({ id: "1", text: concepts[1]!.hook });
    expect(candidates[2]).toEqual({ id: "2", text: concepts[2]!.hook });

    // Opener-scoped framing (D-05 Pitfall 5 — adapted hook only, never full-video)
    expect(framing).toBe("hook");
  });

  it("each remix-card block contains sourceDecode with REAL 4-beat anatomy (D-05 moat), shared across all cards", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-decode-anatomy",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      const card = block as RemixCardBlock;
      expect(card.props.sourceDecode).toBeDefined();
      expect(typeof card.props.sourceDecode.hookPattern).toBe("string");
      expect(card.props.sourceDecode.hookPattern.length).toBeGreaterThan(0);
      expect(typeof card.props.sourceDecode.structure).toBe("string");
      expect(typeof card.props.sourceDecode.theTurn).toBe("string");
      expect(typeof card.props.sourceDecode.emotionalBeat).toBe("string");
    }
    // All cards share the SAME sourceDecode object (same source video)
    const cards = result.blocks as RemixCardBlock[];
    if (cards.length > 1) {
      expect(cards[1]!.props.sourceDecode).toEqual(cards[0]!.props.sourceDecode);
    }
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

  /**
   * Band/fraction come from aggregateFlash of the ADAPTED hook SIM (Pitfall 5 — opener-scoped).
   * S3′: each card carries its own band/fraction from the batched SIM result.
   * rank-1 card: Strong, "7/10 stop" (makeStrongPersonas = 7 stop out of 10).
   */
  it("each card's band/fraction come from aggregateFlash of its adapted hook SIM (Pitfall 5 opener-scoped)", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(makeDecodeResult());
    mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts());
    // concept 0 → Strong(7 stop), concept 1 → Mixed(4 stop), concept 2 → Mixed(4 stop)
    mockRunFlashTextModeBatch.mockResolvedValue(
      makeBatchResult([makeStrongPersonas(), makeMixedPersonas(), makeMixedPersonas()]),
    );

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-band",
    });

    expect(result.blocks.length).toBe(3);
    const cards = result.blocks as RemixCardBlock[];
    // Rank-1 (concept 0, Strong)
    expect(cards[0]!.props.band).toBe("Strong");
    expect(cards[0]!.props.fraction).toBe("7/10 stop");
    expect(cards[0]!.props.model).toBe("sim1-flash");
    // Rank-2/3 (Mixed)
    expect(cards[1]!.props.band).toBe("Mixed");
    expect(cards[1]!.props.fraction).toBe("4/10 stop");
  });

  /**
   * S3′: each card carries props.personas (10-persona array from the batched SIM).
   */
  it("S3′: each remix-card carries props.personas with 10 entries from the batched SIM", async () => {
    setupHappyPath();

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-personas",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      const card = block as RemixCardBlock;
      expect(card.props.personas).toBeDefined();
      expect(card.props.personas!.length).toBe(10);
    }
  });

  it("module does NOT import runPredictionPipeline or ENGINE_VERSION (D-05a guard)", async () => {
    setupHappyPath();

    const remixRunner = await import("@/lib/tools/runners/remix-runner");
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

  /**
   * adapt_failed when batch call throws: runner catches the flash error,
   * pushes warning, returns adapt_failed + empty blocks.
   */
  it("batched Flash gate throw → adapt_failed graceful, cleanup still runs", async () => {
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
    });
    mockAnalyzeVideoWithOmni.mockResolvedValue(makeOmniOutput());
    mockOmniOutputToStructuralInput.mockReturnValue(makeStructuralInput());
    mockRunDecode.mockResolvedValue(makeDecodeResult());
    mockGenerateAdaptConcepts.mockResolvedValue(makeAdaptConcepts());
    mockRunFlashTextModeBatch.mockRejectedValue(new Error("Flash batch failed"));

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-flash-throw",
    });

    expect(result.error).toBe("adapt_failed");
    expect(result.blocks).toEqual([]);
    expect(mockCleanup).toHaveBeenCalledTimes(1);
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

  /**
   * S3′: pin uses the RANK-1 concept's personas (not a fixed concepts[0]).
   * When all concepts are Strong, rank-1 = generation index 0 = concept 0.
   */
  it("pins the rank-1 adapted hook's personas with the run's audience_id + analysis_id", async () => {
    setupHappyPath();
    const rank1Personas = makeStrongPersonas();
    // concept 0 is rank-1 (all Strong → generation order → index 0 wins)
    mockRunFlashTextModeBatch.mockResolvedValue(
      makeBatchResult([rank1Personas, makeStrongPersonas(), makeStrongPersonas()]),
    );

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
    expect(mockPinPredictedSignature).toHaveBeenCalledWith(supabase, rank1Personas, {
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

/**
 * The source receipt (§11f on remix, 2026-07-13).
 *
 * Remix adapts ONE specific real video, and used to render it as an anonymous thumbnail — the
 * card showed the post's picture but never said whose it was. These tests pin BOTH halves of
 * the fix: the attribution now reaches the card, AND the fields we cannot honestly know about
 * a pasted video stay null. A remix source has no follower baseline (so no outlier multiplier)
 * and was never scored against your audience (so no fit label). Inventing either would make
 * the receipt claim authority that retrieval earns and remix does not.
 */
describe("runRemixPipeline — source receipt (proof)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanup.mockResolvedValue(undefined);
  });

  it("attributes the source post: handle, views and permalink reach every card", async () => {
    setupHappyPath();
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
      coverUrl: "https://p16.tiktokcdn.com/cover-abc.jpeg",
      handle: "braedan.health",
      views: 621_000,
      sourceUrl: "https://www.tiktok.com/@braedan.health/video/999",
    });

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-proof",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks as RemixCardBlock[]) {
      const { proof } = block.props;
      expect(proof).toBeDefined();
      expect(proof!.handle).toBe("braedan.health");
      expect(proof!.views).toBe(621_000);
      expect(proof!.videoUrl).toBe("https://www.tiktok.com/@braedan.health/video/999");
      expect(proof!.coverUrl).toBe("https://p16.tiktokcdn.com/cover-abc.jpeg");
    }
  });

  it("never fabricates authority: multiplier, baseline and fit stay null on a pasted source", async () => {
    setupHappyPath();
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
      handle: "braedan.health",
      views: 621_000,
    });

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-honesty",
    });

    const proof = (result.blocks[0] as RemixCardBlock).props.proof;
    expect(proof).toBeDefined();
    // No follower baseline was fetched → no outlier basis to print.
    expect(proof!.multiplier).toBeNull();
    expect(proof!.baselineLabel).toBeNull();
    // Nothing scored this video against the audience → no match claim.
    expect(proof!.fitLabel).toBeNull();
    // Remix does not extract a bracketed reusable template from the source.
    expect(proof!.hookTemplate).toBeNull();
    expect(proof!.archetype).toBeNull();
  });

  it("falls back to the submitted URL when the actor returns no permalink", async () => {
    setupHappyPath();
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
      handle: "braedan.health",
      // no sourceUrl
    });

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-fallback",
    });

    const proof = (result.blocks[0] as RemixCardBlock).props.proof;
    expect(proof!.videoUrl).toBe("https://www.tiktok.com/@creator/video/123456");
  });

  it("emits NO receipt when the source cannot be named — an unattributable video is not a receipt", async () => {
    setupHappyPath();
    // A cover but no author: the card can show the post, but cannot say whose it is. Rather
    // than print a receipt with an anonymous source, it emits none (buildProofFromSource's gate).
    mockResolveAndRehost.mockResolvedValue({
      signedUrl: "https://supabase.example.com/videos/remix-temp/req-abc.mp4",
      cleanup: mockCleanup,
      coverUrl: "https://p16.tiktokcdn.com/cover-abc.jpeg",
    });

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-anon",
    });

    const props = (result.blocks[0] as RemixCardBlock).props;
    expect(props.proof).toBeUndefined();
    // The legacy bare cover still renders, so the card is not left empty-handed.
    expect(props.coverUrl).toBe("https://p16.tiktokcdn.com/cover-abc.jpeg");
  });
});

// ─── Audience Sim v2 (Stage 2): population projection on the remix card ────────

/**
 * A calibrated signature carrying the v2 axes (mirrors the hooks/ideas/script runner tests —
 * same shape drives the SAME pure population.ts math). Two segments so the aggregate has a real
 * per-segment split. Spread onto the gate-safe calibratedAudience (personas:[] + profile:null) so
 * the real, unmocked buildReactionPanel / buildFlashWeighting / buildAudienceGroundingLine take
 * their no-op paths — this isolates the population wiring, not the steer/panel path.
 */
function signatureWithAxes(): unknown {
  return {
    creator_persona: { content_description: "x", context: "x", writing_style_sample: "x", format_signature: "x" },
    audience: {
      follower_tier: "10k-100k",
      maturity: "established",
      temperature_mix: { cold: 0.4, warm: 0.4, hot: 0.2 },
      interest_tags: ["craft"],
      what_resonates: "x",
      what_falls_flat: "x",
      persona_weights: { fyp: 0.4, niche: 0.3, loyalist: 0.2, cross_niche: 0.1 },
      topic_vocab: ["craft", "spectacle"],
      personas: [
        {
          archetype: "lurker", share: 0.6, temperature: "cold", disposition: "scanner",
          reaction_frame: "x", evidence: "x", display_name: "Dopamine Scrollers",
          reaction: { interests: {}, hookSensitivity: 0.2, noveltyBias: 0.5, skepticism: 0.2, attentionSpan: 0.1 },
        },
        {
          archetype: "niche_deep_buyer", share: 0.4, temperature: "hot", disposition: "collector",
          reaction_frame: "x", evidence: "x", display_name: "Frame-by-frame editors",
          reaction: { interests: { craft: 0.9 }, hookSensitivity: 0.8, noveltyBias: 0.3, skepticism: 0.5, attentionSpan: 0.9 },
        },
      ],
    },
    summary: "x",
    provenance: { handle: "@x", scraped_at: "2026-07-16", videos_analyzed: 8, videos_watched: 4, sub_coverage: "6/8" },
  };
}

/** An on-topic craft ContentVector — deterministic input for the (mocked) characterize call. */
const CRAFT_VECTOR = { topics: { craft: 0.9 }, hookStrength: 0.5, novelty: 0.3, hype: 0.1, slowness: 0.2 };

describe("runRemixPipeline — Audience Sim v2 population projection (Stage 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCleanup.mockResolvedValue(undefined);
  });

  it("characterizes each ADAPTED hook and attaches props.population (real per-segment split) with v2 axes", async () => {
    setupHappyPath();
    mockCharacterizeContent.mockResolvedValue(CRAFT_VECTOR);

    const audience = { ...(calibratedAudience as object), signature: signatureWithAxes() } as never;

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
      audience,
    });

    // Characterized once per adapted concept (3), on the SAME adapted hook the SIM reacts to
    // (opener-scoped), keyed to the signature's topic_vocab.
    expect(mockCharacterizeContent).toHaveBeenCalledTimes(3);
    const adaptedHooks = makeAdaptConcepts().map((c) => c.hook);
    const charTexts = mockCharacterizeContent.mock.calls.map((call) => call[0]);
    expect(charTexts.sort()).toEqual([...adaptedHooks].sort());
    expect(mockCharacterizeContent.mock.calls[0]![1]).toEqual(["craft", "spectacle"]);

    // Every card carries the REAL projection with both named segments (the rollup can't produce this).
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of result.blocks as RemixCardBlock[]) {
      const pop = b.props.population;
      expect(pop).toBeDefined();
      expect(pop!.total).toBeGreaterThan(0);
      expect(pop!.stop + pop!.scroll).toBe(pop!.total);
      expect(pop!.segments.length).toBe(2);
      const names = pop!.segments.map((s) => s.displayName).sort();
      expect(names).toEqual(["Dopamine Scrollers", "Frame-by-frame editors"]);
    }
  });

  it("omits props.population (and makes NO characterize call) for an audience without v2 axes", async () => {
    setupHappyPath();
    mockCharacterizeContent.mockResolvedValue(CRAFT_VECTOR);

    const { runRemixPipeline } = await import("@/lib/tools/runners/remix-runner");
    // calibratedAudience has NO signature → the gate is closed → byte-identical pre-v2 shape.
    const result = await runRemixPipeline({
      url: "https://www.tiktok.com/@creator/video/123456",
      platform: "tiktok",
      profileRow: makeProfileRow(),
      requestId: "req-abc",
      audience: calibratedAudience,
    });

    expect(mockCharacterizeContent).not.toHaveBeenCalled();
    expect(result.blocks.length).toBeGreaterThanOrEqual(1);
    for (const b of result.blocks as RemixCardBlock[]) {
      expect(b.props.population).toBeUndefined();
    }
  });
});
