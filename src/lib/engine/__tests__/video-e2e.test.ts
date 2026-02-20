/**
 * Video E2E Test — Real API calls through the full prediction engine
 *
 * Runs Wave 1 (Gemini video analysis) + Wave 2 (DeepSeek reasoning) + Aggregation
 * against a real TikTok video file, printing detailed cost breakdown.
 *
 * Run with: npx vitest run src/lib/engine/__tests__/video-e2e.test.ts
 *
 * IMPORTANT: Uses real API keys from .env.local — costs real money.
 * Skips automatically if GEMINI_API_KEY or DEEPSEEK_API_KEY not set.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// =====================================================
// Mocks — only infrastructure, NOT the AI APIs
// =====================================================

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const logEntries: Array<{ level: string; msg: string; data?: unknown }> = [];
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn((msg: string, data?: unknown) =>
      logEntries.push({ level: "info", msg, data })
    ),
    warn: vi.fn((msg: string, data?: unknown) =>
      logEntries.push({ level: "warn", msg, data })
    ),
    error: vi.fn((msg: string, data?: unknown) =>
      logEntries.push({ level: "error", msg, data })
    ),
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
    })),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    },
  })),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  }),
}));

// Mock calibration file reads (node:fs used by gemini.ts and deepseek.ts for calibration data)
vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        primary_kpis: {
          share_rate: {
            viral_threshold: 0.1,
            percentiles: { p50: 0.02, p75: 0.05, p90: 0.1 },
          },
          comment_rate: {
            percentiles: { p50: 0.01, p75: 0.03, p90: 0.07 },
          },
          save_rate: {
            percentiles: { p50: 0.015, p75: 0.04, p90: 0.08 },
          },
          weighted_engagement_score: {
            percentiles: { p50: 50, p75: 70, p90: 85 },
          },
        },
        virality_tiers: [
          {
            tier: 1,
            label: "Low",
            score_range: [0, 20],
            median_share_rate: 0.01,
            median_comment_rate: 0.005,
            median_save_rate: 0.008,
          },
        ],
        viral_vs_average: {
          differentiators: [
            {
              factor: "hook_strength",
              difference_pct: 40,
              description: "Strong hooks boost engagement",
            },
          ],
        },
        duration_analysis: {
          sweet_spot_by_weighted_score: { optimal_range_seconds: [15, 45] },
        },
      })
    ),
  },
  readFileSync: vi.fn(() =>
    JSON.stringify({
      featureNames: Array.from({ length: 15 }, (_, i) => `feature_${i}`),
      trainSet: { features: [], labels: [] },
      testSet: { features: [], labels: [] },
    })
  ),
}));

vi.mock("node:path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn(() => "/mock"),
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
    dirname: vi.fn(() => "/mock"),
  },
}));

// ML model — will return null (no trained model available), aggregator redistributes weight
vi.mock("../ml", () => ({
  predictWithML: vi.fn().mockResolvedValue(null),
  featureVectorToMLInput: vi.fn().mockReturnValue(Array(15).fill(0.5)),
}));

vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number) => score),
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import { promises as realFs } from "node:fs";
import { analyzeVideoWithGemini } from "../gemini";
import { reasonWithDeepSeek, resetCircuitBreaker } from "../deepseek";
import { aggregateScores } from "../aggregator";
import type {
  AnalysisInput,
  GeminiAnalysis,
  GeminiVideoAnalysis,
  RuleScoreResult,
  TrendEnrichment,
} from "../types";
import type { PipelineResult } from "../pipeline";

// =====================================================
// Setup
// =====================================================

const VIDEO_PATH =
  "/Users/davideloreti/virtuna-v1.1/ssstik.io_@agentoflaughter_1771597963788.mp4";

const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;

function fmt(cents: number): string {
  return `${cents.toFixed(4)}¢ ($${(cents / 100).toFixed(6)})`;
}

const baseInput: AnalysisInput = {
  input_mode: "video_upload",
  video_storage_path: "test/video.mp4",
  content_text:
    "POV: comedy skit that catches you off guard. #comedy #funny #skit #viral",
  content_type: "video",
  niche: "comedy",
};

const defaultRules: RuleScoreResult = {
  rule_score: 50,
  matched_rules: [],
};

const defaultTrends: TrendEnrichment = {
  trend_score: 0,
  matched_trends: [],
  trend_context: "E2E test — trends not loaded.",
  hashtag_relevance: 0,
};

// =====================================================
// Test
// =====================================================

describe.skipIf(!hasGeminiKey || !hasDeepSeekKey)(
  "Video E2E — Gemini + DeepSeek + Aggregation",
  () => {
    vi.setConfig({ testTimeout: 180_000 });

    beforeEach(() => {
      logEntries.length = 0;
      resetCircuitBreaker();
    });

    it("full prediction pipeline with real video", async () => {
      // Read video file directly from disk (bypass mocked node:fs)
      const { readFile: originalReadFile } = await vi.importActual<
        typeof import("node:fs")
      >("node:fs").then((m) => m.promises);
      const videoBuffer = await originalReadFile(VIDEO_PATH);
      const fileSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(1);

      console.log(`\n  Loading video: ${fileSizeMB}MB`);

      // ── Wave 1: Gemini Video Analysis ──
      console.log("\n  Running Wave 1 (Gemini Video Analysis)...");
      const geminiStart = performance.now();
      const geminiResult = await analyzeVideoWithGemini(
        videoBuffer as Buffer,
        "video/mp4",
        "comedy"
      );
      const geminiLatency = performance.now() - geminiStart;

      const videoAnalysis = geminiResult.analysis as GeminiVideoAnalysis;

      console.log(`  ✓ Gemini complete: ${fmt(geminiResult.cost_cents)} in ${(geminiLatency / 1000).toFixed(1)}s`);

      // ── Wave 1 Output ──
      console.log("\n" + "═".repeat(60));
      console.log("  GEMINI VIDEO ANALYSIS");
      console.log("═".repeat(60));
      console.log(`  Cost:    ${fmt(geminiResult.cost_cents)}`);
      console.log(`  Latency: ${(geminiLatency / 1000).toFixed(1)}s`);

      console.log("\n  Factors:");
      for (const f of videoAnalysis.factors) {
        console.log(`    ${f.name}: ${f.score}/10 — ${f.rationale}`);
      }

      console.log("\n  Video Signals:");
      if (videoAnalysis.video_signals) {
        const vs = videoAnalysis.video_signals;
        console.log(`    Visual Production Quality: ${vs.visual_production_quality}/10`);
        console.log(`    Hook Visual Impact:        ${vs.hook_visual_impact}/10`);
        console.log(`    Pacing Score:              ${vs.pacing_score}/10`);
        console.log(`    Transition Quality:        ${vs.transition_quality}/10`);
      }

      console.log(`\n  Overall Impression: ${videoAnalysis.overall_impression}`);
      console.log(`  Content Summary: ${videoAnalysis.content_summary}`);

      // ── Wave 2: DeepSeek Reasoning ──
      console.log("\n  Running Wave 2 (DeepSeek Reasoning)...");

      // Build GeminiAnalysis shape for DeepSeek (strips video_signals to text format)
      const geminiAnalysis: GeminiAnalysis = {
        factors: videoAnalysis.factors,
        overall_impression: videoAnalysis.overall_impression,
        content_summary: videoAnalysis.content_summary,
      };

      const deepseekStart = performance.now();
      const deepseekResult = await reasonWithDeepSeek({
        input: baseInput,
        gemini_analysis: geminiAnalysis,
        rule_result: defaultRules,
        trend_enrichment: defaultTrends,
      });
      const deepseekLatency = performance.now() - deepseekStart;

      const deepseekCost = deepseekResult?.cost_cents ?? 0;
      console.log(`  ✓ DeepSeek complete: ${fmt(deepseekCost)} in ${(deepseekLatency / 1000).toFixed(1)}s`);

      console.log("\n" + "═".repeat(60));
      console.log("  DEEPSEEK REASONING");
      console.log("═".repeat(60));
      console.log(`  Cost:    ${fmt(deepseekCost)}`);
      console.log(`  Latency: ${(deepseekLatency / 1000).toFixed(1)}s`);

      if (deepseekResult) {
        const { reasoning } = deepseekResult;
        console.log("\n  Component Scores:");
        const cs = reasoning.component_scores;
        console.log(`    Hook Effectiveness:   ${cs.hook_effectiveness}/10`);
        console.log(`    Retention Strength:   ${cs.retention_strength}/10`);
        console.log(`    Shareability:         ${cs.shareability}/10`);
        console.log(`    Comment Provocation:  ${cs.comment_provocation}/10`);
        console.log(`    Save Worthiness:      ${cs.save_worthiness}/10`);
        console.log(`    Trend Alignment:      ${cs.trend_alignment}/10`);
        console.log(`    Originality:          ${cs.originality}/10`);

        console.log("\n  Behavioral Predictions:");
        const bp = reasoning.behavioral_predictions;
        console.log(`    Completion: ${bp.completion_pct}% (${bp.completion_percentile})`);
        console.log(`    Share:      ${bp.share_pct}% (${bp.share_percentile})`);
        console.log(`    Comment:    ${bp.comment_pct}% (${bp.comment_percentile})`);
        console.log(`    Save:       ${bp.save_pct}% (${bp.save_percentile})`);

        console.log(`\n  Confidence: ${reasoning.confidence}`);

        console.log("\n  Suggestions:");
        for (const s of reasoning.suggestions) {
          console.log(`    [${s.priority}] ${s.text}`);
        }

        if (reasoning.warnings.length > 0) {
          console.log("\n  Warnings:");
          for (const w of reasoning.warnings) {
            console.log(`    ⚠ ${w}`);
          }
        }
      } else {
        console.log("  ⚠ DeepSeek returned null (circuit breaker open)");
      }

      // ── Aggregation ──
      console.log("\n  Running Aggregation...");

      const pipelineResult: PipelineResult = {
        payload: {
          content_text: baseInput.content_text!,
          content_type: baseInput.content_type,
          input_mode: baseInput.input_mode,
          video_url: null,
          hashtags: ["comedy", "funny", "skit", "viral"],
          duration_hint: null,
          niche: "comedy",
          creator_handle: null,
          society_id: null,
        },
        geminiResult: {
          analysis: geminiAnalysis,
          cost_cents: geminiResult.cost_cents,
        },
        creatorContext: {
          handle: null,
          historicalPerformance: null,
          contentPatterns: null,
        },
        ruleResult: defaultRules,
        trendEnrichment: defaultTrends,
        deepseekResult,
        audioResult: null,
        requestId: "video-e2e-test",
        timings: [
          { stage: "gemini_video", duration_ms: Math.round(geminiLatency) },
          { stage: "deepseek_reasoning", duration_ms: Math.round(deepseekLatency) },
        ],
        total_duration_ms: Math.round(geminiLatency + deepseekLatency),
        warnings: [],
      };

      const prediction = await aggregateScores(pipelineResult);

      console.log("\n" + "═".repeat(60));
      console.log("  AGGREGATED PREDICTION");
      console.log("═".repeat(60));
      console.log(`  Overall Score:  ${prediction.overall_score}/100`);
      console.log(`  Confidence:     ${prediction.confidence_label} (${prediction.confidence.toFixed(2)})`);
      console.log(`  Score Breakdown:`);
      console.log(`    Gemini:      ${prediction.gemini_score}`);
      console.log(`    Behavioral:  ${prediction.behavioral_score}`);
      console.log(`    Rules:       ${prediction.rule_score}`);
      console.log(`    Trends:      ${prediction.trend_score}`);
      console.log(`    ML:          ${prediction.ml_score}`);
      console.log(`  Weights: ${JSON.stringify(prediction.score_weights)}`);

      // ── Cost Breakdown ──
      const totalCost = geminiResult.cost_cents + deepseekCost;
      console.log("\n" + "═".repeat(60));
      console.log("  COST BREAKDOWN");
      console.log("═".repeat(60));
      console.log(`  Gemini (video):        ${fmt(geminiResult.cost_cents)}`);
      console.log(`  DeepSeek (reasoning):  ${fmt(deepseekCost)}`);
      console.log(`  ──────────────────────`);
      console.log(`  TOTAL:                 ${fmt(totalCost)}`);
      console.log(
        `  Wave split: Gemini ${((geminiResult.cost_cents / totalCost) * 100).toFixed(0)}% / DeepSeek ${((deepseekCost / totalCost) * 100).toFixed(0)}%`
      );
      console.log("\n");

      // ── Assertions ──
      // Wave 1: Gemini factors
      expect(videoAnalysis.factors).toHaveLength(5);
      for (const f of videoAnalysis.factors) {
        expect(f.score).toBeGreaterThanOrEqual(0);
        expect(f.score).toBeLessThanOrEqual(10);
        expect(f.rationale).toBeTruthy();
      }

      // Wave 1: Video signals
      expect(videoAnalysis.video_signals).toBeDefined();
      const vs = videoAnalysis.video_signals;
      expect(vs.visual_production_quality).toBeGreaterThanOrEqual(0);
      expect(vs.visual_production_quality).toBeLessThanOrEqual(10);
      expect(vs.hook_visual_impact).toBeGreaterThanOrEqual(0);
      expect(vs.hook_visual_impact).toBeLessThanOrEqual(10);
      expect(vs.pacing_score).toBeGreaterThanOrEqual(0);
      expect(vs.pacing_score).toBeLessThanOrEqual(10);
      expect(vs.transition_quality).toBeGreaterThanOrEqual(0);
      expect(vs.transition_quality).toBeLessThanOrEqual(10);

      // Wave 1: Cost sanity
      expect(geminiResult.cost_cents).toBeGreaterThan(0);
      expect(geminiResult.cost_cents).toBeLessThan(2.0); // Soft cap

      // Wave 2: DeepSeek
      expect(deepseekResult).not.toBeNull();
      expect(deepseekResult!.cost_cents).toBeGreaterThan(0);

      // Aggregation
      expect(prediction.overall_score).toBeGreaterThanOrEqual(0);
      expect(prediction.overall_score).toBeLessThanOrEqual(100);
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(prediction.confidence_label);

      // Total cost
      expect(totalCost).toBeGreaterThan(0);
      expect(totalCost).toBeLessThan(1.0); // Should be well under 1 cent
    });
  }
);
