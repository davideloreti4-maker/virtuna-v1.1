import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/engine/pipeline", () => ({
  runPredictionPipeline: vi.fn(),
}));
vi.mock("@/lib/engine/aggregator", () => ({
  aggregateScores: vi.fn(),
  ENGINE_VERSION: "2.1.0",
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { runEvalOverCorpus, CostCapExceededError } from "../eval-runner";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import { createServiceClient } from "@/lib/supabase/service";

describe("runEvalOverCorpus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock supabase to return 3 fixture rows
    vi.mocked(createServiceClient).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            range: vi
              .fn()
              .mockResolvedValueOnce({
                data: [
                  { id: "r1", niche: "beauty", bucket: "viral", caption: "hi", views: 1000000, likes: 50000, comments: 5000, shares: 1000, saves: 500, creator_handle: "a" },
                  { id: "r2", niche: "comedy", bucket: "average", caption: "ho", views: 100000, likes: 5000, comments: 500, shares: 100, saves: 50, creator_handle: "b" },
                  { id: "r3", niche: "edu", bucket: "under", caption: "x", views: 500, likes: 5, comments: 1, shares: 0, saves: 0, creator_handle: "c" },
                ],
                error: null,
              })
              .mockResolvedValueOnce({ data: [], error: null }),
          }),
        }),
      }),
    } as never);

    vi.mocked(runPredictionPipeline).mockResolvedValue({
      timings: [{ stage: "gemini", duration_ms: 100 }],
      warnings: [],
    } as never);
    // PredictionResult shape — per-signal scores are top-level (types.ts:162-166)
    vi.mocked(aggregateScores).mockResolvedValue({
      overall_score: 80,
      cost_cents: 5,
      behavioral_score: 75,
      gemini_score: 80,
      ml_score: 60,
      rule_score: 70,
      trend_score: 50,
    } as never);
  });

  it("processes all rows and awaits aggregateScores", async () => {
    const results = await runEvalOverCorpus({
      corpusVersion: "test.fixture",
      maxTotalCostCents: 5000,
      rateLimitDelayMs: 0,
    });
    expect(results).toHaveLength(3);
    expect(results[0]!.predicted_bucket).toBe("viral");          // score 80 >= 70
    expect(vi.mocked(aggregateScores)).toHaveBeenCalledTimes(3);
  });

  it("calls runPredictionPipeline with a real AnalysisInput (no `as never` cast)", async () => {
    await runEvalOverCorpus({ corpusVersion: "test.fixture", rateLimitDelayMs: 0 });
    const firstCall = vi.mocked(runPredictionPipeline).mock.calls[0]![0];
    // Assert the input shape matches AnalysisInputSchema (types.ts:53-83)
    expect(firstCall.input_mode).toBe("text");
    expect(firstCall.content_type).toBe("video");
    expect(typeof firstCall.content_text).toBe("string");
    expect(firstCall.niche).toBe("beauty");
    // No fabricated fields
    expect(firstCall).not.toHaveProperty("completion_pct");
  });

  it("extracts signalScores from typed PredictionResult fields", async () => {
    const results = await runEvalOverCorpus({ corpusVersion: "test.fixture", rateLimitDelayMs: 0 });
    expect(results[0]!.signalScores).toEqual({
      behavioral: 75,
      gemini: 80,
      ml: 60,
      rules: 70,
      trends: 50,
    });
  });

  it("aborts with CostCapExceededError when cumulative cost exceeds cap", async () => {
    vi.mocked(aggregateScores).mockResolvedValue({
      overall_score: 50,
      cost_cents: 3000,   // each row costs $30
      behavioral_score: 50, gemini_score: 50, ml_score: 50, rule_score: 50, trend_score: 50,
    } as never);
    await expect(
      runEvalOverCorpus({ corpusVersion: "test.fixture", maxTotalCostCents: 5000, rateLimitDelayMs: 0 }),
    ).rejects.toBeInstanceOf(CostCapExceededError);
  });

  it("isolates per-row failure and continues", async () => {
    vi.mocked(runPredictionPipeline)
      .mockRejectedValueOnce(new Error("Gemini timeout"))
      .mockResolvedValue({ timings: [], warnings: [] } as never);
    const results = await runEvalOverCorpus({
      corpusVersion: "test.fixture",
      rateLimitDelayMs: 0,
    });
    expect(results).toHaveLength(3);
    expect(results[0]!.error).toContain("Gemini timeout");
    expect(results[1]!.error).toBeNull();
  });
});
