/**
 * Phase 13 Plan 02 — Stage 11 Counterfactuals tests (D-01..D-06 + COUNTER rebuild).
 *
 * Test surface:
 *   1 — D-04: always returns non-null CounterfactualResult (no score >= 70 short-circuit)
 *   2 — D-05: low band returns 3 fix items
 *   3 — D-05: mid band returns 2 fix + 1 reinforcement
 *   4 — D-05: high band returns 1 stretch + 2-3 reinforcements
 *   5 — D-01: videoContext fileUri is included in Gemini generateContent parts
 *   6 — D-01: videoContext=null → no fileData part, no crash
 *   7 — D-05: Zod rejects mid band with wrong type mix
 *   8 — maybeAppendLikelyFlopWarning (4 boundary tests — preserved verbatim from original)
 *   9 — D-03: buildSignalContextUserMessage contains all 7 section headers, no truncation
 *  10 — D-10: cost_cents is numeric in emitStageEnd
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runStage11Counterfactuals, maybeAppendLikelyFlopWarning } from "../stage11-counterfactuals";
import { buildSignalContextUserMessage, CounterfactualsResponseSchema } from "../stage11-counterfactuals-prompts";
import type { PredictionResult } from "../types";

// =====================================================
// Module mocks
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

// @google/genai mock — replaces the DeepSeek/OpenAI mock from the original file
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerateContent };
  });
  return { GoogleGenAI: MockGoogleGenAI };
});

process.env.GEMINI_API_KEY = "test-key";

// =====================================================
// Per-band fixture factories (D-05 shapes)
// =====================================================

function makeLowBandResponse(): string {
  return JSON.stringify({
    band: "low",
    suggestions: [
      {
        type: "fix",
        headline: "Reframe hook to lead with the result",
        detail: "Starting with the outcome instead of the setup reduces early drop-off by 20%.",
        timestamp_ms: 500,
        signal_anchor: "hook_decomposition.visual_stop_power",
      },
      {
        type: "fix",
        headline: "Add pattern interrupt at 3-second mark",
        detail: "A visual cut or sound effect at second 3 resets viewer attention.",
        timestamp_ms: 3000,
        signal_anchor: "hook_decomposition.audio_hook_quality",
      },
      {
        type: "fix",
        headline: "Replace vague CTA with number-backed statement",
        detail: "Specificity bias: '9 out of 10 creators miss this' outperforms generic 'watch to learn'.",
        timestamp_ms: 0,
        signal_anchor: "gemini_factor.Share Trigger",
      },
    ],
  });
}

function makeMidBandResponse(): string {
  return JSON.stringify({
    band: "mid",
    suggestions: [
      {
        type: "fix",
        headline: "Extend hook to 3 seconds with stronger visual",
        detail: "Current hook resolves too quickly; 1-2s more of visual tension lifts retention 15%.",
        timestamp_ms: 1200,
        signal_anchor: "hook_decomposition.visual_stop_power",
      },
      {
        type: "fix",
        headline: "Increase music-to-voiceover ratio in mid-section",
        detail: "Pacing dips at second 8-12; music bed lift keeps completion above 60%.",
        timestamp_ms: 8000,
        signal_anchor: "audio_signals.music_ratio",
      },
      {
        type: "reinforcement",
        headline: "Strong voice clarity is your biggest asset",
        detail: "Voice clarity 8.5/10 is top decile — double down on close-mic talking-head framing.",
        timestamp_ms: 0,
        signal_anchor: "audio_signals.voice_clarity",
      },
    ],
  });
}

function makeHighBandResponse(): string {
  return JSON.stringify({
    band: "high",
    suggestions: [
      {
        type: "stretch",
        headline: "Add a second-hook reveal at second 7",
        detail: "Top-performing videos in your niche use a mid-video twist; could push completion +25%.",
        timestamp_ms: 7000,
        signal_anchor: "gemini_factor.Completion Pull",
      },
      {
        type: "reinforcement",
        headline: "Hook visual impact is exceptional",
        detail: "9/10 hook score is already viral-tier — maintain the opening frame pattern.",
        timestamp_ms: 0,
        signal_anchor: "hook_decomposition.visual_stop_power",
      },
      {
        type: "reinforcement",
        headline: "Persona engagement is unusually high",
        detail: "Cross-niche persona watch_through 82% means your content travels outside your niche.",
        timestamp_ms: 0,
        signal_anchor: "persona_dissent",
      },
    ],
  });
}

function mockGeminiSuccess(body: string): void {
  mockGenerateContent.mockResolvedValueOnce({
    text: body,
    usageMetadata: {
      promptTokenCount: 1200,
      candidatesTokenCount: 300,
    },
  });
}

// =====================================================
// PredictionResult factory
// =====================================================

function makeFakePredictionResult(
  overrides?: Partial<PredictionResult>,
): PredictionResult {
  return {
    overall_score: 45,
    confidence: 0.65,
    confidence_label: "MEDIUM",
    is_calibrated: false,
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
      shareability: 4,
      commentProvocation: 3,
      saveWorthiness: 4,
      trendAlignment: 5,
      originality: 5,
      ruleScore: 55,
      trendScore: 30,
      audioTrendingMatch: null,
      captionScore: 4,
      hashtagRelevance: 0.5,
      hashtagCount: 3,
      durationSeconds: 45,
      hasVideo: false,
    },
    reasoning: "Full untruncated DeepSeek reasoning about hook analysis, persona simulation, and content scoring with no artificial cutoff.",
    warnings: [],
    predicted_engagement: {
      views: 10000,
      likes: 500,
      shares: 100,
      comments: 50,
      saves: 30,
    },
    factors: [
      { id: "factor-1", name: "Scroll-Stop Power", score: 8, max_score: 10, rationale: "Strong opening", improvement_tip: "Add visual surprise" },
      { id: "factor-2", name: "Completion Pull", score: 6, max_score: 10, rationale: "Decent narrative", improvement_tip: "Tease earlier" },
      { id: "factor-3", name: "Rewatch Potential", score: 4, max_score: 10, rationale: "Low rewatch", improvement_tip: "Add layers" },
      { id: "factor-4", name: "Share Trigger", score: 3, max_score: 10, rationale: "Low shareability", improvement_tip: "Add CTA" },
      { id: "factor-5", name: "Emotional Charge", score: 5, max_score: 10, rationale: "Moderate emotion", improvement_tip: "Amplify peak" },
    ],
    suggestions: [
      { id: "sug-1", text: "Add pattern interrupt at 3s", priority: "high", category: "hook" },
    ],
    rule_score: 55,
    trend_score: 30,
    gemini_score: 65,
    behavioral_score: 45,
    ml_score: 50,
    score_weights: {
      behavioral: 0.40,
      gemini: 0.35,
      ml: 0,
      rules: 0,
      trends: 0.10,
      audio: 0.05,
      platform_fit: 0.05,
      retrieval: 0,
    },
    latency_ms: 1500,
    cost_cents: 5,
    engine_version: "13.0.0",
    gemini_model: "gemini-3.1-pro-preview",
    deepseek_model: "deepseek-chat",
    input_mode: "text",
    has_video: false,
    signal_availability: {
      behavioral: true,
      gemini: true,
      ml: false,
      rules: false,
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
    persona_behavioral_aggregate: {
      completion_pct: 52,
      completion_percentile: "top 45%",
      share_pct: 2.5,
      share_percentile: "top 40%",
      comment_pct: 1.8,
      comment_percentile: "top 45%",
      save_pct: 2.0,
      save_percentile: "top 40%",
    },
    persona_simulation_results: [],
    retrieval_score: null,
    retrieval_evidence: [],
    ...overrides,
  };
}

// =====================================================
// Tests
// =====================================================

describe("runStage11Counterfactuals — Phase 13 Plan 02 rebuild (D-01..D-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1 — D-04: always returns non-null (no score >= 70 short-circuit)
  it("Test 1: always returns non-null CounterfactualResult (D-04 — no score >= 70 skip)", async () => {
    mockGeminiSuccess(makeHighBandResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 85 }),
      null,
    );
    expect(result).not.toBeNull();
    expect(result!.band).toBe("high");
    expect(Array.isArray(result!.suggestions)).toBe(true);
  });

  // Test 2 — D-05: low band → 3 fix items
  it("Test 2: score=30 → band=low, 3 items all type=fix", async () => {
    mockGeminiSuccess(makeLowBandResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 30 }),
      null,
    );
    expect(result).not.toBeNull();
    expect(result!.band).toBe("low");
    expect(result!.suggestions).toHaveLength(3);
    for (const s of result!.suggestions) {
      expect(s.type).toBe("fix");
    }
  });

  // Test 3 — D-05: mid band → 2 fix + 1 reinforcement
  it("Test 3: score=60 → band=mid, 2 fix + 1 reinforcement", async () => {
    mockGeminiSuccess(makeMidBandResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 60 }),
      null,
    );
    expect(result).not.toBeNull();
    expect(result!.band).toBe("mid");
    const fixes = result!.suggestions.filter((s) => s.type === "fix");
    const reinforcements = result!.suggestions.filter((s) => s.type === "reinforcement");
    expect(fixes).toHaveLength(2);
    expect(reinforcements).toHaveLength(1);
  });

  // Test 4 — D-05: high band → 1 stretch + 2-3 reinforcements
  it("Test 4: score=85 → band=high, 1 stretch + 2-3 reinforcements", async () => {
    mockGeminiSuccess(makeHighBandResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 85 }),
      null,
    );
    expect(result).not.toBeNull();
    expect(result!.band).toBe("high");
    const stretches = result!.suggestions.filter((s) => s.type === "stretch");
    const reinforcements = result!.suggestions.filter((s) => s.type === "reinforcement");
    expect(stretches).toHaveLength(1);
    expect(reinforcements.length).toBeGreaterThanOrEqual(2);
  });

  // Test 5 — D-01: videoContext with fileUri → fileData part in generateContent call
  it("Test 5: videoContext with fileUri → generateContent receives fileData part", async () => {
    mockGeminiSuccess(makeLowBandResponse());
    await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 30 }),
      { fileUri: "files/abc123", mimeType: "video/mp4" },
    );
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts as Array<Record<string, unknown>>;
    const fileDataPart = parts.find((p) => "fileData" in p);
    expect(fileDataPart).toBeDefined();
    expect((fileDataPart as { fileData: { fileUri: string } }).fileData.fileUri).toBe("files/abc123");
  });

  // Test 6 — D-01: videoContext=null → no fileData part, no crash
  it("Test 6: videoContext=null → no fileData part, runs text-only without crash", async () => {
    mockGeminiSuccess(makeLowBandResponse());
    const result = await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 30 }),
      null,
    );
    expect(result).not.toBeNull();
    const callArgs = mockGenerateContent.mock.calls[0][0];
    const parts = callArgs.contents[0].parts as Array<Record<string, unknown>>;
    const fileDataPart = parts.find((p) => "fileData" in p);
    expect(fileDataPart).toBeUndefined();
  });

  // Test 7 — D-05: Zod rejects mid band with wrong type mix (3 fix + 0 reinforcement)
  it("Test 7: Zod rejects mid band with 3 fix + 0 reinforcement (D-05 schema enforcement)", () => {
    const invalid = {
      band: "mid",
      suggestions: [
        { type: "fix", headline: "Fix 1", detail: "detail", timestamp_ms: 0, signal_anchor: "x" },
        { type: "fix", headline: "Fix 2", detail: "detail", timestamp_ms: 0, signal_anchor: "x" },
        { type: "fix", headline: "Fix 3", detail: "detail", timestamp_ms: 0, signal_anchor: "x" },
      ],
    };
    const parsed = CounterfactualsResponseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  // Test 10 — D-10: cost_cents is numeric in emitStageEnd
  it("Test 10: cost telemetry — emitStageEnd receives numeric cost_cents from calculateGeminiCost", async () => {
    const events: Array<{ type: string; cost_cents?: number }> = [];
    mockGeminiSuccess(makeLowBandResponse());
    await runStage11Counterfactuals(
      makeFakePredictionResult({ overall_score: 30 }),
      null,
      (event) => events.push(event as typeof events[0]),
    );
    const endEvent = events.find((e) => e.type === "stage_end");
    expect(endEvent).toBeDefined();
    expect(typeof endEvent!.cost_cents).toBe("number");
    expect(endEvent!.cost_cents).toBeGreaterThan(0);
  });
});

// Test 9 — D-03: buildSignalContextUserMessage contains all 7 section headers, untruncated reasoning
describe("buildSignalContextUserMessage — D-03 full signal context (no truncation)", () => {
  it("Test 9: contains all 7 section headers + untruncated reasoning", () => {
    const longReasoning = "A".repeat(2000); // 2000 chars — would be cut at 500 in old impl
    const result = makeFakePredictionResult({ reasoning: longReasoning });
    const msg = buildSignalContextUserMessage(result);

    // 7 required section headers
    expect(msg).toContain("## Gemini Factor Scores");
    expect(msg).toContain("## Hook Decomposition");
    expect(msg).toContain("## Audio Signals");
    expect(msg).toContain("## Trend Matches");
    expect(msg).toContain("## Persona Dissent");
    expect(msg).toContain("## Platform Fit");
    expect(msg).toContain("## DeepSeek Reasoning");

    // D-03: full reasoning present, not truncated to 500 chars
    expect(msg).toContain(longReasoning);
    expect(msg.includes(longReasoning.slice(0, 500))).toBe(true);
    // The full 2000-char reasoning must be present (not sliced)
    expect(msg.length).toBeGreaterThan(msg.indexOf("## DeepSeek Reasoning") + 2000);
  });

  it("uses (none) fallback for absent optional fields", () => {
    const result = makeFakePredictionResult({
      hook_decomposition: null,
      audio_signals: null,
      matched_trends: [],
      persona_simulation_results: [],
      platform_fit: null,
    });
    const msg = buildSignalContextUserMessage(result);
    // All sections still present
    expect(msg).toContain("## Hook Decomposition");
    expect(msg).toContain("## Audio Signals");
    expect(msg).toContain("## Trend Matches");
    // Fallback text for absent fields
    expect(msg).toContain("(none)");
  });
});

// Test 8 — maybeAppendLikelyFlopWarning: 4 boundary tests (PRESERVED VERBATIM from original file)
describe("maybeAppendLikelyFlopWarning — 4 boundary fixtures (COUNTER LIKELY_FLOP)", () => {
  it("adds warning when score < 30 AND confidence > 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 25,
      confidence: 0.75,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("LIKELY_FLOP");
  });

  it("does NOT add warning when score >= 30 AND confidence > 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 30,
      confidence: 0.75,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });

  it("does NOT add warning when score < 30 AND confidence <= 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 25,
      confidence: 0.70,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });

  it("does NOT add warning when score >= 30 AND confidence <= 0.70", () => {
    const result = makeFakePredictionResult({
      overall_score: 85,
      confidence: 0.65,
      warnings: [],
    });
    maybeAppendLikelyFlopWarning(result);
    expect(result.warnings.length).toBe(0);
  });
});
