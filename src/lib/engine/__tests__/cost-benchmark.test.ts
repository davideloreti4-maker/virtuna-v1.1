/**
 * Cost Benchmark — Real API calls to measure Wave 1 + Wave 2 costs
 * for 30s and 60s video analysis.
 *
 * Run with: npx vitest run src/lib/engine/__tests__/cost-benchmark.test.ts
 *
 * IMPORTANT: Uses real API keys from .env.local — costs real money.
 * Skips automatically if GEMINI_API_KEY or DEEPSEEK_API_KEY not set.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Mock Sentry (not needed for benchmarks)
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock logger to reduce noise but capture key info
const logEntries: Array<{ level: string; msg: string; data?: unknown }> = [];
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn((msg: string, data?: unknown) => logEntries.push({ level: "info", msg, data })),
    warn: vi.fn((msg: string, data?: unknown) => logEntries.push({ level: "warn", msg, data })),
    error: vi.fn((msg: string, data?: unknown) => logEntries.push({ level: "error", msg, data })),
  })),
}));

// Mock Supabase (not calling DB in this benchmark)
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
    })),
  })),
}));

import { promises as fs } from "node:fs";
import path from "node:path";
import { analyzeVideoWithGemini, analyzeWithGemini } from "../gemini";
import { reasonWithDeepSeek } from "../deepseek";
import type { AnalysisInput, GeminiAnalysis, RuleScoreResult, TrendEnrichment } from "../types";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;

// Helper to format cents nicely
function fmt(cents: number): string {
  return `${cents.toFixed(4)}¢ ($${(cents / 100).toFixed(6)})`;
}

// Shared input for DeepSeek calls
const baseInput: AnalysisInput = {
  input_mode: "video_upload",
  content_text: "POV: you discover a hidden beach that nobody talks about. The water is crystal clear and the sand is white. This is why you need to visit Portugal. #travel #portugal #hiddenbeach #travellife",
  content_type: "video",
  niche: "travel",
};

const defaultRules: RuleScoreResult = {
  rule_score: 50,
  matched_rules: [],
};

const defaultTrends: TrendEnrichment = {
  trend_score: 0,
  matched_trends: [],
  trend_context: "Benchmark — trends not loaded.",
  hashtag_relevance: 0,
};

interface BenchmarkResult {
  duration: string;
  gemini_cost_cents: number;
  gemini_input_tokens: number | null;
  gemini_output_tokens: number | null;
  gemini_latency_ms: number;
  deepseek_cost_cents: number;
  deepseek_input_tokens: number | null;
  deepseek_output_tokens: number | null;
  deepseek_latency_ms: number;
  total_cost_cents: number;
  total_latency_ms: number;
}

const results: BenchmarkResult[] = [];

describe.skipIf(!hasGeminiKey || !hasDeepSeekKey)(
  "Cost Benchmark — Real API Video Analysis",
  () => {
    // Increase timeout for real API calls
    vi.setConfig({ testTimeout: 180_000 });

    afterAll(() => {
      // Print summary table
      console.log("\n");
      console.log("═".repeat(72));
      console.log("  COST BENCHMARK RESULTS — Wave 1 (Gemini) + Wave 2 (DeepSeek)");
      console.log("═".repeat(72));

      for (const r of results) {
        console.log(`\n  📹 ${r.duration} video`);
        console.log("  ─".repeat(34));

        console.log(`  Wave 1 (Gemini Flash):`);
        console.log(`    Cost:     ${fmt(r.gemini_cost_cents)}`);
        console.log(`    Tokens:   ${r.gemini_input_tokens ?? "?"} in / ${r.gemini_output_tokens ?? "?"} out`);
        console.log(`    Latency:  ${(r.gemini_latency_ms / 1000).toFixed(1)}s`);

        console.log(`  Wave 2 (DeepSeek Reasoner):`);
        console.log(`    Cost:     ${fmt(r.deepseek_cost_cents)}`);
        console.log(`    Tokens:   ${r.deepseek_input_tokens ?? "?"} in / ${r.deepseek_output_tokens ?? "?"} out`);
        console.log(`    Latency:  ${(r.deepseek_latency_ms / 1000).toFixed(1)}s`);

        console.log(`  ──────────`);
        console.log(`  TOTAL:      ${fmt(r.total_cost_cents)}`);
        console.log(`  Latency:    ${(r.total_latency_ms / 1000).toFixed(1)}s (sequential)`);
        console.log(`  Wave split: Gemini ${((r.gemini_cost_cents / r.total_cost_cents) * 100).toFixed(0)}% / DeepSeek ${((r.deepseek_cost_cents / r.total_cost_cents) * 100).toFixed(0)}%`);
      }

      console.log("\n" + "═".repeat(72));

      if (results.length === 2) {
        const [r30, r60] = results;
        console.log(`\n  Cost scaling (30s → 60s):`);
        console.log(`    Gemini:   ${fmt(r30!.gemini_cost_cents)} → ${fmt(r60!.gemini_cost_cents)} (${((r60!.gemini_cost_cents / r30!.gemini_cost_cents) * 100 - 100).toFixed(0)}% increase)`);
        console.log(`    DeepSeek: ${fmt(r30!.deepseek_cost_cents)} → ${fmt(r60!.deepseek_cost_cents)} (${((r60!.deepseek_cost_cents / r30!.deepseek_cost_cents) * 100 - 100).toFixed(0)}% increase)`);
        console.log(`    Total:    ${fmt(r30!.total_cost_cents)} → ${fmt(r60!.total_cost_cents)} (${((r60!.total_cost_cents / r30!.total_cost_cents) * 100 - 100).toFixed(0)}% increase)`);
      }

      console.log("\n");
    });

    async function runBenchmark(videoFile: string, durationLabel: string) {
      const videoPath = path.join(FIXTURES_DIR, videoFile);
      const videoBuffer = await fs.readFile(videoPath);
      const fileSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(1);

      console.log(`\n  Running ${durationLabel} benchmark (${fileSizeMB}MB)...`);

      // ── Wave 1: Gemini Video Analysis ──
      const geminiStart = performance.now();
      const geminiResult = await analyzeVideoWithGemini(
        videoBuffer,
        "video/mp4",
        "travel"
      );
      const geminiLatency = performance.now() - geminiStart;

      // Extract token counts from log entries
      const geminiLog = logEntries.find(
        (e) => e.msg === "Video analysis complete" && e.data
      );
      logEntries.length = 0; // Reset for next stage

      console.log(`  ✓ Gemini complete: ${fmt(geminiResult.cost_cents)} in ${(geminiLatency / 1000).toFixed(1)}s`);

      // ── Wave 2: DeepSeek Reasoning ──
      // Build the Gemini analysis as GeminiAnalysis (text format, not video)
      const geminiAnalysis: GeminiAnalysis = {
        factors: geminiResult.analysis.factors,
        overall_impression: geminiResult.analysis.overall_impression,
        content_summary: geminiResult.analysis.content_summary,
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

      // ── Collect Results ──
      const result: BenchmarkResult = {
        duration: durationLabel,
        gemini_cost_cents: geminiResult.cost_cents,
        gemini_input_tokens: null, // Will try to extract from response
        gemini_output_tokens: null,
        gemini_latency_ms: Math.round(geminiLatency),
        deepseek_cost_cents: deepseekCost,
        deepseek_input_tokens: null,
        deepseek_output_tokens: null,
        deepseek_latency_ms: Math.round(deepseekLatency),
        total_cost_cents: geminiResult.cost_cents + deepseekCost,
        total_latency_ms: Math.round(geminiLatency + deepseekLatency),
      };

      // Try to reverse-engineer token counts from cost
      // Gemini: cost = (input * 0.15/1M + output * 0.60/1M) * 100
      // DeepSeek: cost = (input * 0.28/1M + output * 0.42/1M) * 100

      results.push(result);
      return result;
    }

    it("30-second video — full Wave 1 + Wave 2", async () => {
      const result = await runBenchmark("test-30s.mp4", "30s");

      expect(result.gemini_cost_cents).toBeGreaterThan(0);
      expect(result.deepseek_cost_cents).toBeGreaterThan(0);
      expect(result.total_cost_cents).toBeGreaterThan(0);
    });

    it("60-second video — full Wave 1 + Wave 2", async () => {
      const result = await runBenchmark("test-60s.mp4", "60s");

      expect(result.gemini_cost_cents).toBeGreaterThan(0);
      expect(result.deepseek_cost_cents).toBeGreaterThan(0);
      expect(result.total_cost_cents).toBeGreaterThan(0);
    });
  }
);
