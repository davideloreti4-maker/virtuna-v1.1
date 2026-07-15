import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — external dependencies imported transitively by aggregator.ts
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// =====================================================
// Mocks — direct dependencies of aggregator.ts
// =====================================================

// ml mock removed (Plan 02, R9): predictWithML/featureVectorToMLInput calls gone from aggregator.ts.
// ml.ts moves to _dormant/ in Plan 05. No aggregator test imports from ../ml after this point.

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  // isCircuitOpen=true short-circuits Stage 11 (which makes the network call). Stage 10
  // is now deterministic TS (no LLM, ignores the breaker) and always runs.
  isCircuitOpen: vi.fn(() => true),
}));

// Plan 01-05 Task 0: aggregator no longer imports stage11-counterfactuals (moved to _dormant/).
// maybeAppendLikelyFlopWarning now lives in ./flop-warning — mock that instead.
// runStage11Counterfactuals was already removed from aggregator in Plan 02; this mock was residual.
vi.mock("../flop-warning", () => ({
  maybeAppendLikelyFlopWarning: vi.fn(),
}));

// Phase 3 (Plan 08) — hoisted mock factories for weighted-aggregator + persona-weights + anti-virality.
// These must be declared BEFORE vi.mock() calls so closures capture them correctly.
const {
  mockBuildWeightedCurve,
  mockAssembleHeatmapPayload,
  mockIsAntiViralityGatedFull,
  mockResolveWeights,
} = vi.hoisted(() => {
  const sampleHeatmap = {
    segments: [
      { idx: 0, t_start: 0, t_end: 3, label: "hook", is_hook_zone: true, keyframe_uri: null },
      { idx: 1, t_start: 3, t_end: 6, label: "body", is_hook_zone: false, keyframe_uri: null },
    ],
    personas: [],
    weighted_curve: [0.9, 0.7],
    weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
    weights_source: "default" as const,
  };
  return {
    mockBuildWeightedCurve: vi.fn(() => ({
      weighted_curve: [0.9, 0.7],
      weighted_completion_pct: 0.8,
      weighted_top_dropoff_t: 3,
      weighted_hook_score: 0.9,
    })),
    mockAssembleHeatmapPayload: vi.fn(() => sampleHeatmap),
    mockIsAntiViralityGatedFull: vi.fn((_confidence: number, _heatmap: unknown): {
      gated: boolean;
      reason: "confidence" | "timeline_pattern" | "both" | null;
      dropoff_segment_indices: number[];
    } => ({
      gated: false,
      reason: null,
      dropoff_segment_indices: [],
    })),
    mockResolveWeights: vi.fn(() => ({
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      source: "default" as const,
    })),
  };
});

vi.mock("../wave3/weighted-aggregator", () => ({
  buildWeightedCurve: mockBuildWeightedCurve,
  assembleHeatmapPayload: mockAssembleHeatmapPayload,
  DEFAULT_WEIGHTS: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
}));

vi.mock("../persona-weights", () => ({
  resolveWeights: mockResolveWeights,
  DEFAULT_PERSONA_WEIGHT_CONFIG: {},
  normalizeWeights: vi.fn((w: unknown) => w),
}));

vi.mock("../anti-virality", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../anti-virality")>();
  return {
    ...orig,
    isAntiViralityGatedFull: mockIsAntiViralityGatedFull,
  };
});

// =====================================================
// Imports (after mocks)
// =====================================================

import { selectWeights, aggregateScores, computeEngagementRange } from "../aggregator";
import { makePipelineResult, makeGeminiAnalysis, makeDeepSeekReasoning, makeContentPayload } from "./factories";
// predictWithML import removed (Plan 02, R9): ml call gone from aggregator; no coupling to ../ml here.
import type { PersonaBehavioralAggregate, PersonaSimulationResult, SegmentGrid, HookDecomposition } from "../types";
import type { EmotionArcPoint } from "../qwen/schemas";

// =====================================================
// selectWeights tests
// =====================================================

// =====================================================
// Plan 03-04 (D-04) — selectWeights 2-key behavioral+apollo blend
// =====================================================
// Dead keys (ml, rules, trends, audio, retrieval, platform_fit, gemini) removed from
// SCORE_WEIGHT_KEYS in Plan 03-04. selectWeights now returns only {behavioral, apollo}.
// gemini is provenance-only (still in SignalAvailability for UI/JSONB persistence).

describe("selectWeights — 2-key behavioral+apollo blend (Plan 03-04)", () => {
  it("returns only behavioral+apollo; sum ~1.0 when both available", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });

    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
    // Dead keys ABSENT from the 2-key output
    expect(weights).not.toHaveProperty("ml");
    expect(weights).not.toHaveProperty("rules");
    expect(weights).not.toHaveProperty("trends");
    expect(weights).not.toHaveProperty("retrieval");
    expect(weights).not.toHaveProperty("gemini"); // retired D-04
    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBeCloseTo(1, 2);
  });

  it("behavioral unavailable → both apollo and behavioral=0 (same deepseek source, D-04)", () => {
    // Plan 03-04 (D-04): apollo availability is sourced from behavioral (both = deepseekResult !== null).
    // When behavioral=false (deepseek didn't run), apollo is also false → both unavailable → all zeros.
    const weights = selectWeights({
      behavioral: false,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });

    expect(weights.behavioral).toBe(0);
    expect(weights.apollo).toBe(0); // apollo sourced from same deepseek signal as behavioral
    // Sum is 0 when both unavailable
    expect(weights.behavioral + weights.apollo).toBe(0);
  });

  it("gemini unavailable → behavioral+apollo still both present (apollo availability = behavioral)", () => {
    const weights = selectWeights({
      behavioral: true,
      gemini: false,
      ml: false,
      rules: false,
      trends: false,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: false,
    });

    // When behavioral=true and gemini=false, apollo falls back to behavioral=true → both live
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBeCloseTo(1, 2);
  });

  it("both unavailable → behavioral=0, apollo=0; does not throw", () => {
    expect(() => {
      const weights = selectWeights({
        behavioral: false,
        gemini: false,
        ml: false,
        rules: false,
        trends: false,
        content_type: false,
        niche: false,
        gemini_hook: false,
        gemini_body: false,
        gemini_cta: false,
        personas: false,
        retrieval: false,
      });
      expect(weights.behavioral).toBe(0);
      expect(weights.apollo).toBe(0);
    }).not.toThrow();
  });

  it("always sums to ~1.0 for any combination where behavioral is available (D-04: apollo sourced from same deepseek signal)", () => {
    // Plan 03-04 (D-04): apollo availability = behavioral (same deepseek source).
    // When behavioral=false, apollo=false → both 0 (excluded from this test).
    // Only test combos where behavioral=true → sum should be ~1.0.
    const combos = [
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, gemini_hook: false, gemini_body: false, gemini_cta: false, personas: false, retrieval: true },
      { behavioral: true, gemini: true, ml: false, rules: false, trends: true, content_type: false, niche: false, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
      { behavioral: true, gemini: false, ml: true, rules: true, trends: false, content_type: false, niche: false, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
      { behavioral: true, gemini: true, ml: true, rules: false, trends: false, content_type: false, niche: true, personas: false, gemini_hook: false, gemini_body: false, gemini_cta: false, retrieval: true },
    ];

    for (const combo of combos) {
      const weights = selectWeights(combo);
      const sum = weights.behavioral + weights.apollo;
      expect(sum).toBeCloseTo(1, 2);
    }
  });
});

// =====================================================
// aggregateScores tests
// =====================================================

describe("aggregateScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behaviors
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("returns valid result with all signals (happy path)", async () => {
    const result = await aggregateScores(makePipelineResult());

    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(result.confidence_label);
    expect(result.gemini_score).toBeGreaterThan(0);
    expect(result.behavioral_score).toBeGreaterThan(0);
    expect(result.ml_score).toBeNull(); // F43 (01-05): ml dead signal → emits null (was a fake 0)
    expect(result.predicted_engagement).toBeNull(); // Plan 02 D1.1: sine-jitter fabrication deleted
    expect(result.engine_version).toBeDefined();
    expect(result.score_weights).toHaveProperty("behavioral");
    expect(result.score_weights).toHaveProperty("apollo"); // Plan 03-04 D-04: apollo replaces gemini
    expect(result.score_weights).toHaveProperty("ml");
    expect(result.score_weights).toHaveProperty("rules");
    expect(result.score_weights).toHaveProperty("trends");
  });

  it("T1.1: overall_score is a true ensemble — the fold moves the headline number", async () => {
    const mkAgg = (v: number) => ({
      completion_pct: v,
      completion_percentile: "high intent",
      share_pct: v,
      share_percentile: "high intent",
      comment_pct: v,
      comment_percentile: "high intent",
      save_pct: v,
      save_percentile: "high intent",
    });
    const foldOk = { fold_success: true, personaSimResults: [], warnings: [], cost_cents: 0 } as never;

    // Apollo-only fallback (no fold) — the pre-T1.1 baseline.
    const noFold = await aggregateScores(makePipelineResult());

    // A maxed-out simulated audience must pull the score ABOVE the Apollo-only baseline...
    const withHighFold = await aggregateScores(
      makePipelineResult({ personaBehavioralAggregate: mkAgg(100), foldOutcome: foldOk }),
    );
    // ...and a floor-low audience must pull it BELOW. Proves the fold is in the blend.
    const withLowFold = await aggregateScores(
      makePipelineResult({ personaBehavioralAggregate: mkAgg(0), foldOutcome: foldOk }),
    );

    expect(withHighFold.overall_score).toBeGreaterThan(noFold.overall_score);
    expect(withLowFold.overall_score).toBeLessThan(noFold.overall_score);
  });

  it("clamps overall_score to 0-100 range", async () => {
    // Test upper bound: high Gemini + behavioral scores
    // (predictWithML mock removed Plan 02 — ml contribution is 0)
    const highPipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          factors: [
            { name: "Scroll-Stop Power", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Completion Pull", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Rewatch Potential", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Share Trigger", score: 10, rationale: "x", improvement_tip: "x" },
            { name: "Emotional Charge", score: 10, rationale: "x", improvement_tip: "x" },
          ],
          overall_impression: "Perfect",
          content_summary: "Perfect content",
        },
        cost_cents: 0.5,
      },
    });
    const highResult = await aggregateScores(highPipeline);
    expect(highResult.overall_score).toBeLessThanOrEqual(100);

    // Test lower bound: all zeros
    // (predictWithML mock removed Plan 02; ml contribution is already 0)
    const lowPipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          factors: [
            { name: "Scroll-Stop Power", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Completion Pull", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Rewatch Potential", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Share Trigger", score: 0, rationale: "x", improvement_tip: "x" },
            { name: "Emotional Charge", score: 0, rationale: "x", improvement_tip: "x" },
          ],
          overall_impression: "None",
          content_summary: "No content",
        },
        cost_cents: 0.5,
      },
      deepseekResult: null,
      // Plan 03 strip: ruleResult + trendEnrichment removed from PipelineResult.
    });
    const lowResult = await aggregateScores(lowPipeline);
    expect(lowResult.overall_score).toBeGreaterThanOrEqual(0);
  });

  it("assembles feature_vector with all expected keys", async () => {
    const result = await aggregateScores(makePipelineResult());

    const fv = result.feature_vector;
    expect(fv).toHaveProperty("hookScore");
    expect(fv).toHaveProperty("completionPull");
    expect(fv).toHaveProperty("rewatchPotential");
    expect(fv).toHaveProperty("shareTrigger");
    expect(fv).toHaveProperty("emotionalCharge");
    expect(fv).toHaveProperty("hookEffectiveness");
    expect(fv).toHaveProperty("retentionStrength");
    expect(fv).toHaveProperty("shareability");
    expect(fv).toHaveProperty("commentProvocation");
    expect(fv).toHaveProperty("saveWorthiness");
    expect(fv).toHaveProperty("trendAlignment");
    expect(fv).toHaveProperty("originality");
    expect(fv).toHaveProperty("ruleScore");
    expect(fv).toHaveProperty("trendScore");
    expect(fv).toHaveProperty("hashtagCount");
    expect(fv).toHaveProperty("hasVideo");
  });

  it("handles DeepSeek null (behavioral unavailable)", async () => {
    const pipeline = makePipelineResult({ deepseekResult: null });
    const result = await aggregateScores(pipeline);

    expect(result.behavioral_score).toBe(0);
    expect(result.score_weights.behavioral).toBe(0);
    expect(result.warnings.some((w) => w.includes("missing signals") && w.includes("behavioral"))).toBe(true);
  });

  it("T1.5 — analysis_unavailable=false on a healthy run; true when BOTH core signals die", async () => {
    // Healthy default: gemini factors > 0 AND deepseek present → analyzable.
    const healthy = await aggregateScores(makePipelineResult());
    expect(healthy.analysis_unavailable).toBe(false);

    // Dual failure: deepseek null (behavioral/apollo dead) + all gemini factors 0 (no
    // usable read, factor-fallback availability path → gemini=false). overall_score
    // collapses to 0; the flag must mark it "couldn't analyze", not a confident verdict.
    const deadGemini = makeGeminiAnalysis({
      factors: (makeGeminiAnalysis().factors ?? []).map((f) => ({ ...f, score: 0 })),
    });
    const dead = await aggregateScores(
      makePipelineResult({
        deepseekResult: null,
        geminiResult: { analysis: deadGemini, cost_cents: 0 },
      }),
    );
    expect(dead.analysis_unavailable).toBe(true);
    expect(dead.overall_score).toBe(0);
  });

  it("F18 honesty (01-05): partial_analysis true iff EXACTLY one core signal is dead", async () => {
    // Both live (healthy default) → neither flag.
    const healthy = await aggregateScores(makePipelineResult());
    expect(healthy.partial_analysis).toBe(false);
    expect(healthy.analysis_unavailable).toBe(false);

    // Single dead: deepseek null (behavioral dead) but gemini factors present (gemini live) → partial.
    const partial = await aggregateScores(makePipelineResult({ deepseekResult: null }));
    expect(partial.partial_analysis).toBe(true);
    expect(partial.analysis_unavailable).toBe(false);

    // Dual dead: deepseek null + all gemini factors 0 → analysis_unavailable, NOT partial.
    const deadGemini = makeGeminiAnalysis({
      factors: (makeGeminiAnalysis().factors ?? []).map((f) => ({ ...f, score: 0 })),
    });
    const dual = await aggregateScores(
      makePipelineResult({ deepseekResult: null, geminiResult: { analysis: deadGemini, cost_cents: 0 } }),
    );
    expect(dual.analysis_unavailable).toBe(true);
    expect(dual.partial_analysis).toBe(false);
  });

  it("maps confidence_label correctly based on confidence thresholds", async () => {
    // HIGH confidence: all signals available, video mode, matched trends/rules, high agreement
    // With all signals scoring 7, both gemini and behavioral > 50, they agree -> agreement = 0.4
    // signal ~= 0.2 (base) + 0.1 (video) + 0.1 (trends) + 0.1 (3+ rules) + 0.05 (medium deepseek) = 0.55
    // total = 0.55 + 0.4 = 0.95 -> HIGH
    const highPipeline = makePipelineResult({
      payload: {
        content_text: "Test #viral #trending #fyp",
        content_type: "video",
        input_mode: "video_upload",
        video_url: null,
        video_storage_path: "test-user/video.mp4",
        hashtags: ["#viral", "#trending", "#fyp"],
        duration_hint: 30,
        niche: null,
        creator_handle: null,
        society_id: null,
      },
      // Plan 03 strip: ruleResult removed from PipelineResult; aggregator uses default fallback.
    });
    const highResult = await aggregateScores(highPipeline);
    // Plan 03: ruleResult removed → 0.1 (3+ rules signal) no longer applied; HIGH threshold may shift.
    expect(highResult.confidence_label).toBeDefined();

    // LOW confidence: minimal signals, no video, no trends, no rules, models disagree
    // behavioral=0 (null deepseek), gemini_score = 70 (above 50), no agreement term possible
    // signal ~= 0.2 (base) - 0.05 (no rules) - 0.05 (no trends) + 0 (no deepseek conf) = 0.1
    // agreement: geminiDirection=70-50=20 > 0, behavioralDirection=0-50=-50 < 0, |20-(-50)|=70 > 15 -> 0
    // total = 0.1 -> LOW
    // predictWithML mock removed (Plan 02); ml contribution is null → 0 (same as before for null)
    const lowPipeline = makePipelineResult({
      deepseekResult: null,
      // Plan 03 strip: ruleResult removed from PipelineResult.
      // Plan 03 strip: trendEnrichment removed from PipelineResult.
      warnings: [],
    });
    const lowResult = await aggregateScores(lowPipeline);
    expect(lowResult.confidence_label).toBeDefined();
  });
});

// =====================================================
// Plan 01-04 — coupled aggregator closeout (F22/F44 + F24 + F37/F41)
// =====================================================

describe("Plan 01-04 — coupled aggregator closeout", () => {
  const mkAgg = (v: number) => ({
    completion_pct: v, completion_percentile: "high intent",
    share_pct: v, share_percentile: "high intent",
    comment_pct: v, comment_percentile: "high intent",
    save_pct: v, save_percentile: "high intent",
  });
  const foldOk = { fold_success: true, personaSimResults: [], warnings: [], cost_cents: 0 } as never;
  const videoPayload = () => makeContentPayload({ input_mode: "video_upload" });

  it("F22: confidence agreement reads apollo-vs-FOLD on video (self-agreement is dead)", async () => {
    // Apollo composite is 65 (>50) in the default fixture. A fold that AGREES (high) lands the
    // agreement term at its 0.4 max; a fold that DISAGREES (low) drops it to 0 → lower confidence.
    // Under the old apollo-vs-behavioral self-agreement, the fold could not move confidence at all.
    const agree = await aggregateScores(
      makePipelineResult({ payload: videoPayload(), personaBehavioralAggregate: mkAgg(95), foldOutcome: foldOk }),
    );
    const disagree = await aggregateScores(
      makePipelineResult({ payload: videoPayload(), personaBehavioralAggregate: mkAgg(5), foldOutcome: foldOk }),
    );
    expect(agree.confidence).toBeGreaterThan(disagree.confidence);
  });

  it("F22: with no fold (text mode) confidence falls back to apollo-vs-behavioral (no agree-against-zero crater)", async () => {
    // Default text/no-fold: apollo 65 + behavioral 70 both >50 → agreement stays 0.4, NOT 0.
    const textNoFold = await aggregateScores(makePipelineResult());
    expect(textNoFold.confidence).toBeGreaterThanOrEqual(0.4);
  });

  // ── AUD-FAIL-01 — a dead audience must not read as a confident Read ──────────────────────
  // THE LIVE RUN THIS PINS (2026-07-14, row iEbgUsLZRSFw): the fold timed out on BOTH attempts,
  // the Read landed with ZERO personas — and shipped as 78 / **HIGH** confidence. The run that
  // actually simulated all 10 people (VdwSBcf0i3bO) reported LOW. Cause: a failed fold took the
  // SAME branch as text mode, so the agreement term fell back to apollo-vs-behavioral — two
  // numbers from the same Apollo call — and handed the broken run the 0.4 MAXIMUM agreement bonus.
  const foldDead = { fold_success: false, personaSimResults: [], warnings: ["Request was aborted. (attempt 2/2)"], cost_cents: 0 } as never;

  it("AUD-FAIL-01: a fold that RAN AND DIED never reads as HIGH confidence", async () => {
    const died = await aggregateScores(
      makePipelineResult({
        payload: videoPayload(),
        foldOutcome: foldDead,
        personaBehavioralAggregate: null, // the audience produced nothing
      }),
    );
    expect(died.confidence_label).not.toBe("HIGH");
    expect(died.signal_availability.personas).toBe(false);
  });

  it("AUD-FAIL-01: a dead audience never out-confidences a REAL one that simply disagreed", async () => {
    // This is the exact inversion that shipped, reproduced. The live pair:
    //   VdwSBcf0i3bO — fold ran, 10 personas, the audience DISAGREED with Apollo → LOW
    //   iEbgUsLZRSFw — fold died,  0 personas                                    → HIGH (!)
    // A working audience that disagrees is the most informative run there is; a dead one is the
    // least. Ranking the corpse above it is the bug — so the corpse must never score higher.
    const base = { payload: videoPayload() };
    // A real audience that disagrees with Apollo (65) — agreement term drops to 0.
    const aliveButDisagreeing = await aggregateScores(
      makePipelineResult({ ...base, foldOutcome: foldOk, personaBehavioralAggregate: mkAgg(5) }),
    );
    const died = await aggregateScores(
      makePipelineResult({ ...base, foldOutcome: foldDead, personaBehavioralAggregate: null }),
    );
    expect(died.confidence).toBeLessThanOrEqual(aliveButDisagreeing.confidence);
  });

  it("AUD-FAIL-01: says out loud that the audience did not run", async () => {
    const died = await aggregateScores(
      makePipelineResult({
        payload: videoPayload(),
        foldOutcome: foldDead,
        personaBehavioralAggregate: null,
      }),
    );
    expect(died.warnings.some((w) => /audience simulation did not run/i.test(w))).toBe(true);
  });

  it("AUD-FAIL-01: text mode is untouched — it never promised an audience", async () => {
    // Regression guard on the fix itself: the fold-less TEXT path must keep its
    // apollo-vs-behavioral fallback. Only a fold that was ATTEMPTED and died is penalised.
    const text = await aggregateScores(makePipelineResult()); // foldOutcome: null
    expect(text.confidence).toBeGreaterThanOrEqual(0.4);
    expect(text.warnings.some((w) => /audience simulation did not run/i.test(w))).toBe(false);
  });

  it("F24: video-mode feature_vector drops the component scores (null); text mode keeps them", async () => {
    const video = await aggregateScores(makePipelineResult({ payload: videoPayload() }));
    expect(video.feature_vector.hookEffectiveness).toBeNull();
    expect(video.feature_vector.originality).toBeNull();

    const text = await aggregateScores(makePipelineResult()); // default = text mode
    expect(typeof text.feature_vector.hookEffectiveness).toBe("number");
    expect(typeof text.feature_vector.originality).toBe("number");
  });

  it("F37: assembles a hero block from live Apollo materials with the approved verdict_line rule", async () => {
    const result = await aggregateScores(makePipelineResult()); // deepseek present → apollo materials live
    expect(result.hero).toBeDefined();
    expect(result.hero?.ceiling).toBe("Hook runs past the ≤3s threshold (§2.0a)");
    expect(result.hero?.the_one_fix).toBe("Rewritten variant fixing distillation");
    expect(["go", "no-go"]).toContain(result.hero?.go_no_go);
    // Not gated on a healthy run → verdict_line is a bandLabel tier (not "Don't post yet").
    expect(["High potential", "Solid contender", "Needs work"]).toContain(result.hero?.verdict_line);
  });

  it("F37: hero fields degrade to null when Apollo is unavailable (non-throwing)", async () => {
    const result = await aggregateScores(makePipelineResult({ deepseekResult: null }));
    expect(result.hero?.ceiling).toBeNull();
    expect(result.hero?.the_one_fix).toBeNull();
    // verdict_line + go_no_go still resolve from overall_score + anti_virality_gated.
    expect(result.hero?.verdict_line).toBeTruthy();
    expect(["go", "no-go"]).toContain(result.hero?.go_no_go);
  });

  it("F37: a gated result leads with \"Don't post yet\" + no-go", async () => {
    // Force the gate via the mocked isAntiViralityGatedFull (anti-virality mock at top of file).
    // aggregateScores calls it pre- and post-critique, so use a persistent return value, then
    // restore the default implementation so later tests are unaffected.
    mockIsAntiViralityGatedFull.mockReturnValue({
      gated: true, reason: "confidence", dropoff_segment_indices: [],
    });
    const result = await aggregateScores(makePipelineResult());
    expect(result.hero?.verdict_line).toBe("Don't post yet");
    expect(result.hero?.go_no_go).toBe("no-go");
    mockIsAntiViralityGatedFull.mockImplementation(() => ({
      gated: false, reason: null, dropoff_segment_indices: [],
    }));
  });
});

// =====================================================
// ENG-04 honesty LOCK (plan 01-05) — regression guards. These assert the honesty invariants
// against the UNCHANGED honesty code so a future regression that re-introduces fabrication
// (Math.sin jitter, a non-grounded range, or a single-signal masquerading as unavailable) fails CI.
// =====================================================

describe("ENG-04 honesty LOCK (01-05)", () => {
  it("engagement range is null when there is no creator baseline (follower_count <= 0 / null)", () => {
    expect(computeEngagementRange({ follower_count: null }, 80)).toBeNull();
    expect(computeEngagementRange({ follower_count: 0 }, 80)).toBeNull();
  });

  it("engagement range is grounded, bounded, and DETERMINISTIC (no Math.sin/random jitter)", () => {
    const a = computeEngagementRange({ follower_count: 100_000 }, 80);
    const b = computeEngagementRange({ follower_count: 100_000 }, 80);
    expect(a).not.toBeNull();
    expect(a!.lo).toBeLessThan(a!.hi);
    expect(Number.isFinite(a!.lo) && Number.isFinite(a!.hi)).toBe(true);
    expect(a).toEqual(b); // a sine/random jitter path would break determinism
    // Grounded: the range scales with follower_count (more followers → wider absolute range),
    // which a fabricated oscillation would not honor.
    const bigger = computeEngagementRange({ follower_count: 1_000_000 }, 80)!;
    expect(bigger.hi).toBeGreaterThan(a!.hi);
  });

  it("analysis_unavailable is true IFF both core signals are dead (dual-failure only)", async () => {
    const healthy = await aggregateScores(makePipelineResult());
    expect(healthy.analysis_unavailable).toBe(false);

    const single = await aggregateScores(makePipelineResult({ deepseekResult: null }));
    expect(single.analysis_unavailable).toBe(false); // single dead ≠ unavailable (that's partial_analysis)

    const deadGemini = makeGeminiAnalysis({
      factors: (makeGeminiAnalysis().factors ?? []).map((f) => ({ ...f, score: 0 })),
    });
    const dual = await aggregateScores(
      makePipelineResult({ deepseekResult: null, geminiResult: { analysis: deadGemini, cost_cents: 0 } }),
    );
    expect(dual.analysis_unavailable).toBe(true);
  });

  it("dead-tail prune (F43): rule/trend/ml/reasoning emit null, not fake constants", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.rule_score).toBeNull();
    expect(result.trend_score).toBeNull();
    expect(result.ml_score).toBeNull();
    expect(result.reasoning).toBeNull();
  });
});

// =====================================================
// Phase 3 — provenance + stub invocations
// =====================================================

describe("Phase 3 — provenance + stub invocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("returns signal_availability populated from internal computation (PIPE-07)", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.signal_availability).toBeDefined();
    expect(typeof result.signal_availability.behavioral).toBe("boolean");
    expect(typeof result.signal_availability.gemini).toBe("boolean");
    expect(typeof result.signal_availability.ml).toBe("boolean");
    expect(typeof result.signal_availability.rules).toBe("boolean");
    expect(typeof result.signal_availability.trends).toBe("boolean");
  });

  it("re-exports ENGINE_VERSION from ./version (back-compat — PIPE-08)", async () => {
    const { ENGINE_VERSION } = await import("../aggregator");
    const { ENGINE_VERSION: viaVersion } = await import("../version");
    expect(ENGINE_VERSION).toBe(viaVersion);
    expect(ENGINE_VERSION).toBe("3.21.0"); // S3′ — batched SIM + generate-rate-rank
  });

  it("PredictionResult.engine_version reads from ./version module", async () => {
    const { ENGINE_VERSION } = await import("../version");
    const result = await aggregateScores(makePipelineResult());
    expect(result.engine_version).toBe(ENGINE_VERSION);
  });

  it("invokes Stage 10 stub with onStageEvent forwarding; stage11 removed (Plan 02) (PIPE-09)", async () => {
    // Plan 02 R9: stage11 call removed from aggregateScores. Only stage10 fires.
    const events: string[] = [];
    await aggregateScores(makePipelineResult(), (e) => {
      if (e.type === "stage_start" || e.type === "stage_end") {
        if ("stage" in e && e.stage) events.push(e.stage);
      }
    });
    expect(events).toContain("stage_10_critique");
    expect(events).not.toContain("stage_11_counterfactuals"); // Plan 02: stage11 gone
  });

  it("counterfactuals always null after Plan 02 stage11 removal (deferCounterfactuals no-op)", async () => {
    // Plan 02 R9: stage11 removed; counterfactuals is null unconditionally.
    // deferCounterfactuals option is back-compat only; no effect.
    const result = await aggregateScores(makePipelineResult());
    expect(result.counterfactuals ?? null).toBeNull();
    // Stage 10 still runs (KEPT for Plan 04 scope)
    expect(result.critique).not.toBeNull();
  });

  it("overall_score is unchanged for identical input (PIPE-06 math invariance)", async () => {
    const a = await aggregateScores(makePipelineResult());
    const b = await aggregateScores(makePipelineResult());
    expect(a.overall_score).toBe(b.overall_score);
    expect(a.confidence).toBe(b.confidence);
    expect(a.gemini_score).toBe(b.gemini_score);
    expect(a.behavioral_score).toBe(b.behavioral_score);
  });

  it("signal_availability.behavioral=true when deepseekResult present", async () => {
    const result = await aggregateScores(makePipelineResult());
    expect(result.signal_availability.behavioral).toBe(true);
  });

  it("signal_availability.behavioral=false when deepseekResult is null", async () => {
    const result = await aggregateScores(
      makePipelineResult({ deepseekResult: null })
    );
    expect(result.signal_availability.behavioral).toBe(false);
  });

  it("calling aggregateScores without onStageEvent works (backwards-compat)", async () => {
    // Existing callers don't pass the second arg — must still work
    const result = await aggregateScores(makePipelineResult());
    expect(result).toBeDefined();
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
  });
});

// =====================================================
// Phase 4 — Wave 0 aggregator integration (Plan 04-03 Task 3)
// =====================================================

describe("Phase 4 — Wave 0 aggregator integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("selectWeights regression: 2-key blend — behavioral+apollo sum to ~1.0 (Plan 03-04, D-04)", () => {
    // Plan 03-04 (D-04): SCORE_WEIGHT_KEYS=[behavioral,apollo]; gemini retired from blend.
    // Normalized: behavioral=0.40/0.75≈0.533, apollo=0.35/0.75≈0.467
    const weights = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
    expect(weights).not.toHaveProperty("ml");
    expect(weights).not.toHaveProperty("rules");
    expect(weights).not.toHaveProperty("trends");
    expect(weights).not.toHaveProperty("retrieval");
    expect(weights).not.toHaveProperty("gemini"); // retired D-04
    const sum = weights.behavioral + weights.apollo;
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("selectWeights ignores content_type + niche keys (Critical Cross-File Constraint #3)", () => {
    const weightsWithNew = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });
    const weightsWithoutNew = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });
    expect(weightsWithNew).toEqual(weightsWithoutNew);
    const sum = Object.values(weightsWithNew).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it("selectWeights redistribution with provenance flags present — behavioral=true full blend (D-04)", () => {
    // Plan 03-04 (D-04): both behavioral and apollo source from deepseek.
    // When behavioral=true, apollo=true → both present → normalized blend (sum~1.0).
    const weights = selectWeights({
      behavioral: true,
      gemini: false, // provenance only — does NOT affect blend
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
      retrieval: true,
    });
    // 2-decimal precision matches existing "always sums to ~1.0" test convention
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
    expect(weights.behavioral).toBeGreaterThan(0);
    expect(weights.apollo).toBeGreaterThan(0);
  });

  it("signal_availability.content_type set to true when wave0Result.content_type is non-null", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "talking_head", confidence: 0.85 },
        niche: null,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.content_type).toBe(true);
    expect(result.signal_availability.niche).toBe(false);
  });

  it("signal_availability.niche set to true when wave0Result.niche is non-null", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: null,
        niche: {
          primary_slug: "beauty",
          micro_slug: null,
          confidence: 0.8,
        },
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.niche).toBe(true);
    expect(result.signal_availability.content_type).toBe(false);
  });

  it("feature_vector uses content-type-adjusted video signals when content_type present (D-12 slideshow halves pacing)", async () => {
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "slideshow", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({
          video_signals: {
            visual_production_quality: 8,
            hook_visual_impact: 8,
            pacing_score: 8,
            transition_quality: 8,
          },
        }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    // slideshow matrix: pacing multiplier 0.5 → 8 × 0.5 = 4
    expect(result.feature_vector.pacingScore).toBeCloseTo(4, 1);
    // slideshow matrix: visual_production_quality multiplier 0.8 → 8 × 0.8 = 6.4
    expect(result.feature_vector.visualProductionQuality).toBeCloseTo(6.4, 1);
  });

  it("feature_vector uses raw video signals when content_type is null (Wave 0 failure / no video)", async () => {
    const pipeline = makePipelineResult({
      wave0Result: { content_type: null, niche: null },
      geminiResult: {
        analysis: makeGeminiAnalysis({
          video_signals: {
            visual_production_quality: 7,
            hook_visual_impact: 7,
            pacing_score: 7,
            transition_quality: 7,
          },
        }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.feature_vector.pacingScore).toBe(7);
    expect(result.feature_vector.visualProductionQuality).toBe(7);
  });

  it("matrix application does not mutate the original geminiResult.video_signals (defensive)", async () => {
    const originalSignals = {
      visual_production_quality: 8,
      hook_visual_impact: 8,
      pacing_score: 8,
      transition_quality: 8,
    };
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "action", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({ video_signals: { ...originalSignals } }),
        cost_cents: 0.5,
      },
    });
    await aggregateScores(pipeline);
    // Original geminiResult.video_signals must remain unmodified after aggregateScores.
    expect(pipeline.geminiResult.analysis.video_signals).toEqual(originalSignals);
  });
});

// =====================================================
// Phase 7 — aggregateScores widening (Plan 07-03)
// Personas signal_availability flag + optional behavioralSource override.
// =====================================================

describe("aggregateScores Phase 7 widening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  const samplePersonaAggregate: PersonaBehavioralAggregate = {
    completion_pct: 99.5,
    completion_percentile: "top 10%",
    share_pct: 75,
    share_percentile: "top 25%",
    comment_pct: 60,
    comment_percentile: "top 25%",
    save_pct: 80,
    save_percentile: "top 10%",
  };

  const samplePersonaResults: PersonaSimulationResult[] = [
    {
      persona_id: "fyp-saver-beauty",
      archetype: "saver",
      slot_type: "fyp",
      niche: "beauty",
      scroll_past_second: 5,
      watch_through_pct: 80,
      comment_intent: 20,
      share_intent: 30,
      save_intent: 70,
      rewatch_intent: 40,
      reasoning: "test saver reaction",
    },
    {
      persona_id: "fyp-lurker-beauty",
      archetype: "lurker",
      slot_type: "fyp",
      niche: "beauty",
      scroll_past_second: 30,
      watch_through_pct: 95,
      comment_intent: 5,
      share_intent: 10,
      save_intent: 20,
      rewatch_intent: 15,
      reasoning: "test lurker reaction",
    },
  ];

  it("Test 1 (D-08): default (no third arg) reads deepseek.behavioral_predictions", async () => {
    const pipelineResult = makePipelineResult();
    const result = await aggregateScores(pipelineResult);
    // The makePipelineResult factory sets deepseekResult.reasoning.behavioral_predictions —
    // assert the result's behavioral_predictions matches that source (not the persona aggregate).
    expect(result.behavioral_predictions).toEqual(
      pipelineResult.deepseekResult!.reasoning.behavioral_predictions,
    );
  });

  it("Test 2 (D-15): signal_availability.personas is false when personaBehavioralAggregate is null", async () => {
    const pipelineResult = makePipelineResult({ personaBehavioralAggregate: null });
    const result = await aggregateScores(pipelineResult);
    expect(result.signal_availability.personas).toBe(false);
  });

  it("Test 3 (D-15): signal_availability.personas is true when personaBehavioralAggregate is non-null", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.signal_availability.personas).toBe(true);
  });

  it("Test 4 (Plan 04-05): fold succeeded (≥7 personas) → behavioral_predictions from fold aggregate, not deepseek", async () => {
    // Build 7 persona results so aggregatePersonaResults returns non-null aggregate.
    const foldPersonaSimResults: PersonaSimulationResult[] = Array.from({ length: 7 }, (_, i) => ({
      persona_id: `fyp-${i}-high_engager-beauty`,
      archetype: "high_engager" as const,
      slot_type: "fyp" as const,
      niche: "beauty",
      scroll_past_second: 5,
      watch_through_pct: 90, // all watch 90% — completion_pct should be 90
      comment_intent: 30,
      share_intent: 40,
      save_intent: 50,
      rewatch_intent: 20,
      reasoning: `fold persona ${i}`,
    }));
    const pipelineResult = makePipelineResult({
      foldOutcome: {
        pass2Results: [],
        personaSimResults: foldPersonaSimResults,
        warnings: [],
        cost_cents: 0.1,
        fold_success: true,
      },
    });
    const result = await aggregateScores(pipelineResult);
    // Fold succeeded: behavioral_predictions from fold aggregate (completion_pct=90),
    // NOT from deepseek (which uses a different fixture value in makeDeepSeekReasoning).
    expect(result.behavioral_predictions.completion_pct).toBe(90);
  });

  it("Test 5 (Plan 04-05): fold failed (fold_success=false) → falls back to deepseek behavioral_predictions", async () => {
    const pipelineResult = makePipelineResult({
      foldOutcome: {
        pass2Results: [],
        personaSimResults: [],
        warnings: ["fold call aborted"],
        cost_cents: 0,
        fold_success: false,
      },
    });
    const result = await aggregateScores(pipelineResult);
    // Fold failed: must fall back to deepseek.behavioral_predictions
    expect(result.behavioral_predictions).toEqual(
      pipelineResult.deepseekResult!.reasoning.behavioral_predictions,
    );
  });

  it("Test 6 (Plan 04-05): explicit behavioralSource='deepseek' bypasses fold even when fold succeeded", async () => {
    const foldPersonaSimResults: PersonaSimulationResult[] = Array.from({ length: 7 }, (_, i) => ({
      persona_id: `fyp-${i}-high_engager-beauty`,
      archetype: "high_engager" as const,
      slot_type: "fyp" as const,
      niche: "beauty",
      scroll_past_second: 5,
      watch_through_pct: 90,
      comment_intent: 30, share_intent: 40, save_intent: 50, rewatch_intent: 20,
      reasoning: `fold persona ${i}`,
    }));
    const pipelineResult = makePipelineResult({
      foldOutcome: {
        pass2Results: [],
        personaSimResults: foldPersonaSimResults,
        warnings: [],
        cost_cents: 0.1,
        fold_success: true,
      },
    });
    const explicitResult = await aggregateScores(pipelineResult, undefined, {
      behavioralSource: "deepseek",
    });
    // When "deepseek" is forced, must use deepseek source, not fold
    expect(explicitResult.behavioral_predictions).toEqual(
      pipelineResult.deepseekResult!.reasoning.behavioral_predictions,
    );
  });

  it("Test 7 (PERSONA-11 + D-09): persona_simulation_results persisted from pipelineResult.wave3Result", async () => {
    const pipelineResult = makePipelineResult({
      wave3Result: samplePersonaResults,
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.persona_simulation_results).toEqual(samplePersonaResults);
    expect(result.persona_simulation_results.length).toBe(2);
  });

  it("Test 8 (D-20): persona_behavioral_aggregate field exposed on PredictionResult", async () => {
    const pipelineResult = makePipelineResult({
      personaBehavioralAggregate: samplePersonaAggregate,
    });
    const result = await aggregateScores(pipelineResult);
    expect(result.persona_behavioral_aggregate).toEqual(samplePersonaAggregate);
  });
});

// =====================================================
// Phase 8 — aggregator retrieval signal integration (Plan 04 Task 3)
// =====================================================

import type { RetrievalEvidenceItem } from "../types";

describe("Phase 8 — aggregator retrieval integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("populates retrieval_score on PredictionResult when retrieval is available", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: 0.8,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_score).toBe(0.8);
    expect(result.signal_availability.retrieval).toBe(true);
  });

  it("treats retrieval_score=null as 0 contribution to overall_score (null-safe)", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: null,
        availability: false,
        cost_cents: 0,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_score).toBeNull();
    expect(result.signal_availability.retrieval).toBe(false);
    // overall_score must still be a valid number (no NaN from null arithmetic)
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
  });

  it("populates retrieval_evidence on PredictionResult", async () => {
    const evidence: RetrievalEvidenceItem[] = [
      {
        source_pool: "training_corpus",
        source_id: "abcdef00-0000-0000-0000-000000000001",
        similarity_score: 0.9,
        video_url: "https://tiktok.com/v/1",
        creator_handle: "creator1",
        caption_snippet: "Test caption",
        views: 1_000_000,
        likes: 100_000,
        shares: 5_000,
        comments: 2_000,
        saves: 10_000,
        hashtags: ["beauty", "grwm"],
        posted_at: "2026-04-01T00:00:00Z",
        bucket_label: "viral",
        bucket_source: "corpus",
        relaxed_to: "strict",
      },
    ];
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence,
        score: 0.9,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.retrieval_evidence).toEqual(evidence);
  });

  it("score_weights contains behavioral+apollo as live keys (Plan 03-04 D-04: gemini retired, retrieval not a blend key)", async () => {
    const pipeline = makePipelineResult({
      retrievalResult: {
        evidence: [],
        score: 0.5,
        availability: true,
        cost_cents: 0.001,
      },
    });
    const result = await aggregateScores(pipeline);
    // Plan 03-04 (D-04): score_weights has behavioral+apollo as live keys; gemini/retrieval NOT blend keys.
    expect(result.score_weights.behavioral).toBeGreaterThan(0);
    expect(result.score_weights.apollo).toBeGreaterThan(0);
    expect(result.score_weights.gemini).toBe(0); // retired from blend (D-04)
    expect(result.score_weights.ml).toBe(0);
    expect(result.score_weights.rules).toBe(0);
    expect(result.score_weights.trends).toBe(0);
    // retrieval_score is still surfaced (provenance); score_weights.retrieval absent (not a blend key)
    expect(result.retrieval_score).toBe(0.5);
  });

  it("signal_availability.retrieval mirrors pipelineResult.retrievalResult.availability", async () => {
    const trueResult = await aggregateScores(
      makePipelineResult({
        retrievalResult: {
          evidence: [],
          score: 0.5,
          availability: true,
          cost_cents: 0.001,
        },
      }),
    );
    expect(trueResult.signal_availability.retrieval).toBe(true);

    const falseResult = await aggregateScores(
      makePipelineResult({
        retrievalResult: {
          evidence: [],
          score: null,
          availability: false,
          cost_cents: 0,
        },
      }),
    );
    expect(falseResult.signal_availability.retrieval).toBe(false);
  });
});

// =====================================================
// Phase 4 Plan 05 — aggregator fold wiring
// (Pass 2 tests removed; fold.pass2Results is the sole heatmap source)
// Tests: weighted_* fields + heatmap + isAntiViralityGatedFull + signal_availability.pass2_timeline
// =====================================================

describe("aggregateScores Phase 4 Plan 05 — fold heatmap wiring", () => {
  // Shared fixtures
  const sampleSegments: SegmentGrid[] = [
    { t_start: 0, t_end: 3, visual_event: "hook reveal", audio_event: "beat drop", is_hook_zone: true },
    { t_start: 3, t_end: 6, visual_event: "body content", audio_event: "ambient", is_hook_zone: false },
  ];

  const samplePass2Results = [
    {
      persona_id: "fyp-saver-beauty",
      archetype: "saver" as const,
      slot_type: "fyp" as const,
      segment_reactions: [
        { t_start: 0, t_end: 3, attention: 0.9, swipe_predicted: false },
        { t_start: 3, t_end: 6, attention: 0.7, swipe_predicted: false },
      ],
      pass2_latency_ms: 500,
      pass2_cost_cents: 0.05,
    },
    {
      persona_id: "fyp-lurker-beauty",
      archetype: "lurker" as const,
      slot_type: "fyp" as const,
      segment_reactions: [
        { t_start: 0, t_end: 3, attention: 0.8, swipe_predicted: false },
        { t_start: 3, t_end: 6, attention: 0.6, swipe_predicted: true },
      ],
      pass2_latency_ms: 450,
      pass2_cost_cents: 0.05,
    },
  ];

  // Helper: build a foldOutcome with pass2Results so heatmap path fires.
  function makeFoldOutcome(opts?: { fold_success?: boolean; pass2Results?: typeof samplePass2Results }) {
    return {
      pass2Results: opts?.pass2Results ?? samplePass2Results,
      personaSimResults: [],
      warnings: [] as string[],
      cost_cents: 0.1,
      fold_success: opts?.fold_success ?? true,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to their default implementations
    mockBuildWeightedCurve.mockReturnValue({
      weighted_curve: [0.9, 0.7],
      weighted_completion_pct: 0.8,
      weighted_top_dropoff_t: 3,
      weighted_hook_score: 0.9,
    });
    mockAssembleHeatmapPayload.mockReturnValue({
      segments: [
        { idx: 0, t_start: 0, t_end: 3, label: "hook reveal", is_hook_zone: true, keyframe_uri: null },
        { idx: 1, t_start: 3, t_end: 6, label: "body content", is_hook_zone: false, keyframe_uri: null },
      ],
      personas: [],
      weighted_curve: [0.9, 0.7],
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      weights_source: "default" as const,
    });
    mockIsAntiViralityGatedFull.mockReturnValue({ gated: false as boolean, reason: null as "confidence" | "timeline_pattern" | "both" | null, dropoff_segment_indices: [] as number[] });
    mockResolveWeights.mockReturnValue({
      weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
      source: "default" as const,
    });
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("Phase 4: heatmap populated via assembleHeatmapPayload when fold_success=true and pass2Results present", async () => {
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome(),
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(mockAssembleHeatmapPayload).toHaveBeenCalledOnce();
    expect(result.heatmap).not.toBeNull();
    expect(result.heatmap).toBeDefined();
  });

  it("Phase 4: weighted_completion_pct / weighted_top_dropoff_t / weighted_hook_score populated from buildWeightedCurve", async () => {
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome(),
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.weighted_completion_pct).toBe(0.8);
    expect(result.weighted_top_dropoff_t).toBe(3);
    expect(result.weighted_hook_score).toBe(0.9);
  });

  it("Phase 4: signal_availability.pass2_timeline === true when fold_success=true", async () => {
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome({ fold_success: true }),
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.pass2_timeline).toBe(true);
  });

  it("Phase 4: signal_availability.pass2_timeline === false when foldOutcome is null", async () => {
    const pipeline = makePipelineResult({ foldOutcome: null });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.pass2_timeline).toBe(false);
  });

  it("Phase 4: when fold_success=false, heatmap=null and weighted_* fields=null", async () => {
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome({ fold_success: false, pass2Results: [] }),
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.heatmap).toBeNull();
    expect(result.weighted_completion_pct).toBeNull();
    expect(result.weighted_top_dropoff_t).toBeNull();
    expect(result.weighted_hook_score).toBeNull();
  });

  it("Phase 4: isAntiViralityGatedFull called when heatmap present (fold succeeded)", async () => {
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome(),
      segments: sampleSegments,
    });
    await aggregateScores(pipeline);
    expect(mockIsAntiViralityGatedFull).toHaveBeenCalled();
  });

  it("Phase 4: when fold triggers timeline pattern, anti_virality_gated=true with reason='timeline_pattern'", async () => {
    // Mock isAntiViralityGatedFull to return timeline_pattern gating. Persistent (not Once):
    // deterministic Stage 10 now always runs, so the POST-critique re-eval calls this a 2nd
    // time — the real fn is heatmap-deterministic and returns timeline_pattern on both calls.
    mockIsAntiViralityGatedFull.mockReturnValue({
      gated: true,
      reason: "timeline_pattern" as const,
      dropoff_segment_indices: [1],
    });
    const pipeline = makePipelineResult({
      foldOutcome: makeFoldOutcome(),
      segments: sampleSegments,
    });
    const result = await aggregateScores(pipeline);
    expect(result.anti_virality_gated).toBe(true);
    expect(result.anti_virality_reason).toBe("timeline_pattern");
  });
});

// =====================================================
// Phase 2 (Quick 260528-nqx) — hook_decomposition + emotion_arc pluck
// =====================================================

describe("hook_decomposition + emotion_arc pluck (Quick 260528-nqx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // predictWithML mock removed (Plan 02); ml call no longer fires in aggregateScores.
  });

  it("populates hook_decomposition on result when geminiResult.analysis.hook_decomposition is present", async () => {
    const hookDecomp: HookDecomposition = {
      visual_stop_power: 8.2,
      audio_hook_quality: 6.5,
      first_words_speech_score: 7.0,
      text_overlay_score: 4.1,
      visual_audio_coherence: 7.4,
      cognitive_load: 5,
      weakest_modality: "text_overlay_score",
      // watermark_detected is optional per ALGO-06 back-compat; omit in this test
    };
    const arc: EmotionArcPoint[] = [
      { timestamp_ms: 0, intensity_0_1: 0.3 },
      { timestamp_ms: 1500, intensity_0_1: 0.8 },
    ];
    const pipeline = makePipelineResult({
      geminiResult: {
        // Cast to inject fields not in the base GeminiAnalysis Zod shape
        // (hook_decomposition lives on GeminiVideoAnalysis, the video superset).
        // At runtime the Gemini video path always returns GeminiVideoAnalysis;
        // only the aggregator's static typing sees the narrower base type.
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: hookDecomp,
          emotion_arc: arc,
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.hook_decomposition).toEqual(hookDecomp);
    expect(result.emotion_arc).toEqual(arc);
  });

  it("falls back to null when geminiResult.analysis omits both fields", async () => {
    const pipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: undefined,
          emotion_arc: undefined,
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.hook_decomposition).toBeNull();
    expect(result.emotion_arc).toBeNull();
  });

  it("falls back to null when emotion_arc is an empty array (preserves Pitfall #5 backward compat)", async () => {
    const pipeline = makePipelineResult({
      geminiResult: {
        analysis: {
          ...makeGeminiAnalysis(),
          hook_decomposition: undefined,
          emotion_arc: [],
        } as unknown as ReturnType<typeof makeGeminiAnalysis>,
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.emotion_arc).toBeNull();
  });
});

// =====================================================
// R5 / D-04 Apollo blend assertions (Plan 03-04 — GREEN after blend rewire)
// =====================================================
// These tests assert the post-Plan-04 state: behavioral 40 + Apollo replaces
// behavioral 40 + gemini. Plan 04 (03-04) wired the blend.
// The names are exact and must NOT be renamed.
// =====================================================

describe("blend uses behavioral + apollo (Wave 0 scaffold — RED until Plan 04)", () => {
  // Plan 04 (03-04): SCORE_WEIGHTS now uses "apollo" key (behavioral + apollo blend).
  // composite_score from deepseekResult.reasoning is the apollo term.
  //
  // The dynamic import pattern is used to avoid hoisting issues with the module mock.

  it("blend uses behavioral + apollo — SCORE_WEIGHTS has apollo key (not gemini) after Plan 04", async () => {
    // Import SCORE_WEIGHTS from aggregator to check the key structure.
    // Plan 04 (03-04): SCORE_WEIGHTS = { behavioral: 0.40, apollo: 0.35 }.
    const { SCORE_WEIGHTS } = await import("../aggregator");
    // GREEN assertions (post-Plan-04 state):
    expect(SCORE_WEIGHTS).toHaveProperty("apollo");   // apollo term added (D-04)
    expect(SCORE_WEIGHTS).not.toHaveProperty("gemini"); // gemini retired from blend key
  });

  it("gemini retired from raw_overall_score (R5/D-04 — Wave 0 scaffold)", async () => {
    // D-04: Apollo replaces the gemini term in raw_overall_score.
    // Plan 04 (03-04): SCORE_WEIGHT_KEYS = ["behavioral", "apollo"].
    const { SCORE_WEIGHT_KEYS } = await import("../aggregator");
    // GREEN assertions (post-Plan-04 state):
    expect(SCORE_WEIGHT_KEYS).not.toContain("gemini"); // gemini retired from blend
    expect(SCORE_WEIGHT_KEYS).toContain("apollo");     // apollo is now the blend term
  });
});

// =====================================================
// Phase 5 Plan 01 — Wave 0 threading guard (D-01 assembly-hop)
// RED scaffold: apollo_reasoning.dimensions[0].score must survive aggregator→PredictionResult.
// Fails until Task 2 (schema) + Task 3 (sum) land — dimension.score is undefined pre-D-01.
// =====================================================

describe("Phase 5 Plan 01 — D-01 threading: dimensions[].score survives aggregator assembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apollo_reasoning.dimensions[0].score is a finite number after aggregateScores (assembly-hop guard)", async () => {
    // Dimensions carry `score` in the pipeline input (post-D-01 factory).
    // After aggregateScores, result.apollo_reasoning.dimensions[0].score must be a finite number.
    // RED: makeDeepSeekReasoning factory has no `score` on dimensions → score is undefined.
    // GREEN after Tasks 2+3: factory updated + schema accepts score → score is a number.
    const pipelineWithScores = makePipelineResult({
      deepseekResult: {
        reasoning: {
          ...makeDeepSeekReasoning(),
          dimensions: [
            { name: "hook" as const, band: "mid" as const, lever: "§2.1", evidence: "e", score: 85 },
            { name: "retention" as const, band: "mid" as const, lever: "§2.2", evidence: "e", score: 50 },
            { name: "clarity" as const, band: "mid" as const, lever: "§2.1", evidence: "e", score: 50 },
            { name: "share_pull" as const, band: "mid" as const, lever: "§2.3", evidence: "e", score: 50 },
            { name: "substance" as const, band: "mid" as const, lever: "§2.5", evidence: "e", score: 50 },
            { name: "credibility" as const, band: "mid" as const, lever: "§2.1", evidence: "e", score: 50 },
          ],
        },
        cost_cents: 0.3,
      },
    });

    const result = await aggregateScores(pipelineWithScores);
    // Assembly-hop guard: dimensions with .score must ride through unchanged.
    const dims = result.apollo_reasoning?.dimensions;
    expect(dims).toBeDefined();
    expect(dims).not.toBeNull();
    expect(Array.isArray(dims)).toBe(true);
    // RED: score is undefined (not a number) until ApolloDimensionSchema has `score`.
    // GREEN: score is 85 (finite number).
    const firstDim = dims?.[0];
    expect(typeof (firstDim as { score?: unknown })?.score).toBe("number");
    expect(Number.isFinite((firstDim as { score?: unknown })?.score as number)).toBe(true);
  });
});

// =====================================================
// Phase 5 Plan 02 — R11 computeEngagementRange (Wave 0 RED)
// =====================================================
// Tests reference the not-yet-written computeEngagementRange — ALL MUST FAIL (RED).
// GREEN after Task 2 implements the function.
// Spec: follower_count × quality read (overall_score) → EngagementRange | null
// =====================================================

describe("Phase 5 Plan 02 — R11 computeEngagementRange: tier sensitivity + range honesty", () => {
  // R11 verify: two creators of materially different follower tiers get materially different
  // ranges for the same overall_score.
  it("high follower_count (500k) produces a materially higher range than low (5k) at same score", () => {
    const highTierCtx = {
      found: true,
      follower_count: 500_000,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.005 },
      target_platforms: null, niche_primary: null, niche_sub: null, target_audience: null,
      primary_goal: null, creator_stage: null, content_style: null, cuts_per_second: null,
      reference_creators: null, past_wins: null, past_flops: null, time_of_day_aware: null, pain_points: null,
    };
    const lowTierCtx = {
      ...highTierCtx,
      follower_count: 5_000,
    };
    const overall_score = 70;

    const highRange = computeEngagementRange(highTierCtx, overall_score);
    const lowRange = computeEngagementRange(lowTierCtx, overall_score);

    expect(highRange).not.toBeNull();
    expect(lowRange).not.toBeNull();
    // Both tiers non-null (both have follower_count)
    // High tier hi must be materially larger than low tier hi (>5× difference for 100× follower gap)
    expect(highRange!.hi).toBeGreaterThan(lowRange!.hi * 5);
  });

  // D-06: output is a RANGE — lo < hi strictly; never a single point.
  it("returns lo < hi strictly (range, not a point)", () => {
    const ctx = {
      found: true,
      follower_count: 50_000,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.005 },
      target_platforms: null, niche_primary: null, niche_sub: null, target_audience: null,
      primary_goal: null, creator_stage: null, content_style: null, cuts_per_second: null,
      reference_creators: null, past_wins: null, past_flops: null, time_of_day_aware: null, pain_points: null,
    };
    const range = computeEngagementRange(ctx, 65);
    expect(range).not.toBeNull();
    expect(range!.lo).toBeLessThan(range!.hi);
  });

  // Quality multiplier: higher overall_score shifts the range upward for the same follower tier.
  it("higher overall_score shifts range upward (quality multiplies the anchor)", () => {
    const ctx = {
      found: true,
      follower_count: 100_000,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.005 },
      target_platforms: null, niche_primary: null, niche_sub: null, target_audience: null,
      primary_goal: null, creator_stage: null, content_style: null, cuts_per_second: null,
      reference_creators: null, past_wins: null, past_flops: null, time_of_day_aware: null, pain_points: null,
    };
    const lowScoreRange = computeEngagementRange(ctx, 20);
    const highScoreRange = computeEngagementRange(ctx, 90);

    expect(lowScoreRange).not.toBeNull();
    expect(highScoreRange).not.toBeNull();
    // High quality → higher expected reach
    expect(highScoreRange!.hi).toBeGreaterThan(lowScoreRange!.hi);
  });

  // Fat-tailed honesty: lower overall_score widens the range (more uncertainty at low quality).
  it("low overall_score produces a wider range (fat-tailed — uncertainty widens band)", () => {
    const ctx = {
      found: true,
      follower_count: 100_000,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.005 },
      target_platforms: null, niche_primary: null, niche_sub: null, target_audience: null,
      primary_goal: null, creator_stage: null, content_style: null, cuts_per_second: null,
      reference_creators: null, past_wins: null, past_flops: null, time_of_day_aware: null, pain_points: null,
    };
    const lowQuality = computeEngagementRange(ctx, 15);
    const highQuality = computeEngagementRange(ctx, 90);

    expect(lowQuality).not.toBeNull();
    expect(highQuality).not.toBeNull();
    const lowWidth = lowQuality!.hi - lowQuality!.lo;
    const highWidth = highQuality!.hi - highQuality!.lo;
    // Lower quality = wider band (more uncertainty)
    expect(lowWidth).toBeGreaterThan(highWidth);
  });

  // Null honesty (R9): follower_count == null → return null (no fabricated number).
  it("returns null when creatorContext.follower_count is null (R9 honesty)", () => {
    const ctxNoFollowers = {
      found: false,
      follower_count: null,
      avg_views: null,
      engagement_rate: null,
      niche: null,
      posting_frequency: null,
      platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.005 },
      target_platforms: null, niche_primary: null, niche_sub: null, target_audience: null,
      primary_goal: null, creator_stage: null, content_style: null, cuts_per_second: null,
      reference_creators: null, past_wins: null, past_flops: null, time_of_day_aware: null, pain_points: null,
    };
    const result = computeEngagementRange(ctxNoFollowers, 70);
    expect(result).toBeNull();
  });
});
