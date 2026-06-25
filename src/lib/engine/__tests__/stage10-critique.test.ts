/**
 * Stage 10 self-critique — deterministic TS (rewritten 2026-05-31).
 *
 * The LLM path (mocked OpenAI, circuit breaker, Zod schema, thinking-mode args) is gone:
 * deriveCritique is pure arithmetic over the assembled PredictionResult. These tests lock
 * the three live D-13 checks (Check #1 signal-agreement DROPPED in plan 01-04 / F34), the
 * clamped confidence penalty, flag attribution, and determinism.
 */
import { describe, it, expect } from "vitest";
import {
  deriveCritique,
  applyCritiqueAdjustment,
  runStage10Critique,
} from "../stage10-critique";
import type { PredictionResult, CritiqueResult } from "../types";
import type { StageEvent } from "../events";
import type { CreatorContext } from "../creator";

function makeFakePredictionResult(overrides?: Partial<PredictionResult>): PredictionResult {
  return {
    overall_score: 72,
    confidence: 0.75,
    confidence_label: "HIGH",
    behavioral_predictions: {
      completion_pct: 45,
      completion_percentile: "top 50%",
      share_pct: 2.1,
      share_percentile: "top 50%",
      comment_pct: 1.5,
      comment_percentile: "top 50%",
      save_pct: 1.8,
      save_percentile: "top 50%",
    },
    feature_vector: {
      hookScore: 6,
      completionPull: 5,
      rewatchPotential: 5,
      shareTrigger: 5,
      emotionalCharge: 5,
      visualProductionQuality: null,
      hookVisualImpact: null,
      pacingScore: null,
      transitionQuality: null,
      hookEffectiveness: 6,
      retentionStrength: 5,
      shareability: 5,
      commentProvocation: 5,
      saveWorthiness: 5,
      trendAlignment: 5,
      originality: 5,
      ruleScore: 55,
      trendScore: 30,
      audioTrendingMatch: null,
      captionScore: 5,
      hashtagRelevance: 0.5,
      hashtagCount: 3,
      durationSeconds: null,
      hasVideo: false,
    } as PredictionResult["feature_vector"],
    reasoning: "test reasoning",
    warnings: [],
    predicted_engagement: { lo: 5000, hi: 15000, confidence: 0.65, basis: "test fixture" },
    factors: [
      { id: "hook-power", name: "Hook Power", score: 8, max_score: 10, rationale: "Strong opening", improvement_tip: "Add visual surprise" },
      { id: "retention-pull", name: "Retention Pull", score: 6, max_score: 10, rationale: "Decent narrative", improvement_tip: "Tease earlier" },
      { id: "share-trigger", name: "Share Trigger", score: 3, max_score: 10, rationale: "Low shareability", improvement_tip: "Add CTA" },
      { id: "emotional-charge", name: "Emotional Charge", score: 5, max_score: 10, rationale: "Moderate", improvement_tip: "Amplify" },
    ],
    suggestions: [{ id: "sug-1", text: "Add pattern interrupt at 3s", priority: "high", category: "hook" }],
    rule_score: 55,
    trend_score: 30,
    gemini_score: 85,
    behavioral_score: 45,
    ml_score: 50,
    score_weights: { behavioral: 0.35, apollo: 0.25, gemini: 0, ml: 0.15, rules: 0.15, trends: 0.1 },
    latency_ms: 1500,
    cost_cents: 5,
    engine_version: "9.0.0",
    gemini_model: "gemini-2.0-flash",
    deepseek_model: "deepseek-reasoner",
    input_mode: "text",
    has_video: false,
    signal_availability: {
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: true,
      niche: true,
      gemini_hook: true,
      gemini_body: true,
      gemini_cta: true,
      personas: true,
      audio: false,
      retrieval: false,
    },
    persona_behavioral_aggregate: null,
    persona_simulation_results: [],
    retrieval_score: null,
    retrieval_evidence: [],
    anti_virality_gated: false,
    analysis_unavailable: false,
    partial_analysis: false,
    ...overrides,
  };
}

/** A result with no consistency problems — every check should pass. */
function cleanResult(overrides?: Partial<PredictionResult>): PredictionResult {
  return makeFakePredictionResult({
    gemini_score: 70,
    behavioral_score: 62, // Δ8 < 30 → Check #1 clean
    overall_score: 65, // between LOW and HIGH → Check #2 clean
    confidence: 0.6, // ≤0.7 → Checks #3/#4 clean
    signal_availability: {
      behavioral: true, gemini: true, ml: true, rules: true, trends: true,
      content_type: true, niche: true, gemini_hook: true, gemini_body: true,
      gemini_cta: true, personas: true, audio: true, retrieval: true,
    },
    ...overrides,
  });
}

describe("deriveCritique — clean result", () => {
  it("no checks fire → empty flags, 0 adjustment, perfect consistency", () => {
    const c = deriveCritique(cleanResult());
    expect(c.flags).toHaveLength(0);
    expect(c.confidence_adjustment).toBe(0);
  });
});

describe("deriveCritique — Check #1 Signal Agreement DROPPED (F34, plan 01-04)", () => {
  // F34: Check #1 (|gemini − behavioral| > 30) was removed. Its basis died with D-R1
  // (gemini_score null on video) and the independent apollo-vs-fold agreement now lives in
  // calculateConfidence (F22) — re-checking it here would double-count. A large gemini/behavioral
  // gap must now contribute ZERO penalty.
  it("a large |gemini − behavioral| gap no longer fires any penalty", () => {
    const c = deriveCritique(cleanResult({ gemini_score: 85, behavioral_score: 45 }));
    expect(c.confidence_adjustment).toBe(0);
  });
  it("even an extreme gap (90 vs 10) contributes nothing (Check #1 is gone)", () => {
    const c = deriveCritique(cleanResult({ gemini_score: 90, behavioral_score: 10 }));
    expect(c.confidence_adjustment).toBe(0);
  });
});

describe("deriveCritique — Check #2 Score vs Factors", () => {
  // Plan 04 (D2.3): flags[] always empty. Assert via confidence_adjustment.
  it("high score on uniformly weak top factors → penalty applied", () => {
    const c = deriveCritique(
      cleanResult({
        overall_score: 78,
        factors: [
          { id: "a", name: "Hook Power", score: 3, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "b", name: "Retention Pull", score: 2, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "c", name: "Share Trigger", score: 4, max_score: 10, rationale: "x", improvement_tip: "y" },
        ],
      }),
    );
    expect(c.flags).toHaveLength(0);
    expect(c.confidence_adjustment).toBeCloseTo(-0.07, 10);
  });
  it("low score on uniformly strong top factors → penalty applied", () => {
    const c = deriveCritique(
      cleanResult({
        overall_score: 22,
        factors: [
          { id: "a", name: "Hook Power", score: 8, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "b", name: "Retention Pull", score: 9, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "c", name: "Share Trigger", score: 7, max_score: 10, rationale: "x", improvement_tip: "y" },
        ],
      }),
    );
    expect(c.flags).toHaveLength(0);
    expect(c.confidence_adjustment).toBeCloseTo(-0.07, 10);
  });
});

describe("deriveCritique — Check #3 Historical-flop match", () => {
  const creatorWithFlops: CreatorContext = {
    found: true, follower_count: 50000, avg_views: 10000, engagement_rate: 0.05,
    niche: "gaming", posting_frequency: "daily",
    platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.004 },
    target_platforms: ["tiktok"], niche_primary: "gaming", niche_sub: null, target_audience: null,
    primary_goal: "growth", creator_stage: "mid", content_style: null, cuts_per_second: null,
    reference_creators: null,
    past_wins: [{ url: "https://tiktok.com/@t/1" }],
    past_flops: [{ url: "https://tiktok.com/@t/flop1" }, { url: "https://tiktok.com/@t/flop2" }],
    time_of_day_aware: null, pain_points: null,
  };

  // Plan 04 (D2.3): flags[] always empty; check fires via confidence_adjustment penalty.
  // URL-safety invariant: no URL in flags (trivially satisfied — flags is always empty).
  it("flops + high confidence + weak hook → penalty applied (flags empty, URL-safety invariant holds)", () => {
    const c = deriveCritique(
      cleanResult({ confidence: 0.82, signal_availability: { ...cleanResult().signal_availability, gemini_hook: false } }),
      creatorWithFlops,
    );
    expect(c.flags).toHaveLength(0); // flags always empty after Plan 04
    expect(c.confidence_adjustment).toBeCloseTo(-0.05, 10); // PENALTY_HISTORICAL_FLOP
    // URL-safety invariant: trivially satisfied (no flags to contain URLs)
    expect(c.flags.join(" ")).not.toContain("tiktok.com");
  });

  it("does not fire without creator history", () => {
    const c = deriveCritique(
      cleanResult({ confidence: 0.82, signal_availability: { ...cleanResult().signal_availability, gemini_hook: false } }),
    );
    expect(c.confidence_adjustment).toBe(0);
  });
});

describe("deriveCritique — Check #4 thin-signal over-confidence", () => {
  // Plan 04 (D2.3): flags[] always empty; sa.audio/sa.retrieval sub-conditions removed
  // (those keys no longer in the blend). Check now fires when gemini_hook=false + personas=false
  // (both ≥2-unavailable indicators remaining after the audio/retrieval sub-condition removal).
  it("confidence>0.7 + gemini_hook=false + personas=false → penalty applied", () => {
    const c = deriveCritique(
      makeFakePredictionResult({
        gemini_score: 70, behavioral_score: 65, overall_score: 65, confidence: 0.82,
        signal_availability: {
          behavioral: true, gemini: true, ml: true, rules: true, trends: true,
          content_type: true, niche: true, gemini_hook: false, gemini_body: true,
          gemini_cta: true, personas: false, audio: false, retrieval: false,
        },
      }),
    );
    expect(c.flags).toHaveLength(0); // flags always empty after Plan 04
    expect(c.confidence_adjustment).toBeCloseTo(-0.08, 10); // PENALTY_THIN_SIGNAL
  });

  it("confidence>0.7 but only 1 unavailable signal (personas=false only) → no penalty", () => {
    const c = deriveCritique(
      makeFakePredictionResult({
        gemini_score: 70, behavioral_score: 65, overall_score: 65, confidence: 0.82,
        signal_availability: {
          behavioral: true, gemini: true, ml: true, rules: true, trends: true,
          content_type: true, niche: true, gemini_hook: true, gemini_body: true,
          gemini_cta: true, personas: false, audio: false, retrieval: false,
        },
      }),
    );
    expect(c.confidence_adjustment).toBe(0);
  });
});

describe("deriveCritique — aggregation & clamping", () => {
  // Plan 04 (D2.3): flags[] always empty. F34 (01-04): Check #1 dropped, so the three live checks
  // are #2 (0.07) + #3 (0.05) + #4 (0.08) = 0.20 — the natural max equals the [-0.20, 0] clamp.
  const creatorWithFlops: CreatorContext = {
    found: true, follower_count: 50000, avg_views: 10000, engagement_rate: 0.05,
    niche: "gaming", posting_frequency: "daily",
    platform_averages: { avg_views: 50000, avg_engagement_rate: 0.06, avg_share_rate: 0.008, avg_comment_rate: 0.004 },
    target_platforms: ["tiktok"], niche_primary: "gaming", niche_sub: null, target_audience: null,
    primary_goal: "growth", creator_stage: "mid", content_style: null, cuts_per_second: null,
    reference_creators: null,
    past_wins: null,
    past_flops: [{ url: "https://tiktok.com/@t/flop1" }],
    time_of_day_aware: null, pain_points: null,
  };
  it("all three live checks fire → penalty sums to the -0.20 floor", () => {
    const c = deriveCritique(
      makeFakePredictionResult({
        overall_score: 80,
        factors: [
          { id: "a", name: "Hook Power", score: 2, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "b", name: "Retention Pull", score: 3, max_score: 10, rationale: "x", improvement_tip: "y" },
          { id: "c", name: "Share Trigger", score: 1, max_score: 10, rationale: "x", improvement_tip: "y" },
        ], // #2 fires (high score + weak factors)
        confidence: 0.9, // >0.7 → enables #3 and #4
        signal_availability: {
          behavioral: true, gemini: true, ml: true, rules: true, trends: true,
          content_type: true, niche: true, gemini_hook: false, gemini_body: true,
          gemini_cta: true, personas: false, audio: false, retrieval: false,
        }, // #4 fires (gemini_hook=false + personas=false); gemini_hook=false also makes #3's hook weak
      }),
      creatorWithFlops, // #3 fires (past_flops + confidence>0.7 + weak hook)
    );
    expect(c.flags).toHaveLength(0); // flags always empty after Plan 04
    expect(c.confidence_adjustment).toBe(-0.2); // 0.07+0.05+0.08 = 0.20
  });

  it("is deterministic — same input twice yields identical critique", () => {
    const r = makeFakePredictionResult();
    expect(deriveCritique(r)).toEqual(deriveCritique(r));
  });
});

describe("applyCritiqueAdjustment — confidence clamp", () => {
  it("clamps -0.30 → -0.20 (upper bound)", () => {
    const critique: CritiqueResult = { flags: [], confidence_adjustment: -0.3 };
    expect(applyCritiqueAdjustment(0.75, critique)).toBeCloseTo(0.55, 10);
  });
  it("clamps +0.10 → 0 (only reductions allowed)", () => {
    const critique: CritiqueResult = { flags: [], confidence_adjustment: 0.1 };
    expect(applyCritiqueAdjustment(0.75, critique)).toBeCloseTo(0.75, 10);
  });
});

describe("runStage10Critique — wrapper", () => {
  it("returns a non-null critique, emits stage_end ok=true with zero cost", async () => {
    const events: StageEvent[] = [];
    const result = await runStage10Critique(makeFakePredictionResult(), (e) => events.push(e));
    expect(result).not.toBeNull();
    const end = events.find(
      (e): e is Extract<StageEvent, { type: "stage_end" }> =>
        e.type === "stage_end" && e.stage === "stage_10_critique",
    )!;
    expect(end.ok).toBe(true);
    expect(end.cost_cents).toBe(0);
  });
});
