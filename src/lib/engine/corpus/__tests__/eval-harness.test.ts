import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock runEvalOverCorpus so we can inject deterministic RawEvalResult fixtures.
vi.mock("../eval-runner", async () => {
  const actual = await vi.importActual<typeof import("../eval-runner")>("../eval-runner");
  return {
    ...actual,
    runEvalOverCorpus: vi.fn(),
  };
});
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  })),
}));
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

import { runEvalHarness } from "../eval-harness";
import { runEvalOverCorpus, type RawEvalResult } from "../eval-runner";

function makeRaw(
  i: number,
  niche: "beauty" | "comedy" | "edu" | "fitness" | "lifestyle",
  actual: "viral" | "average" | "under",
  predictedScore: number,
  signals: { behavioral: number; gemini: number; ml: number; rules: number; trends: number },
): RawEvalResult {
  // bucketFromScore: >=70 viral, <=30 under, else average
  const predictedBucket: "viral" | "average" | "under" =
    predictedScore >= 70 ? "viral" : predictedScore <= 30 ? "under" : "average";
  return {
    corpus_row_id: `r${i}`,
    niche,
    actual_bucket: actual,
    predicted_overall_score: predictedScore,
    predicted_bucket: predictedBucket,
    signalScores: signals,
    pipelineTimings: [{ stage: "gemini", duration_ms: 100 }],
    cost_cents: 5,
    actual_views: 100_000,
    actual_likes: 5000,
    actual_comments: 500,
    actual_shares: 100,
    actual_saves: 50,
    warnings: [],
    error: null,
  };
}

describe("runEvalHarness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a BenchmarkReport with correct shape (no LOO)", async () => {
    const rows: RawEvalResult[] = [
      makeRaw(1, "beauty", "viral", 80, { behavioral: 75, gemini: 80, ml: 60, rules: 70, trends: 50 }),
      makeRaw(2, "beauty", "viral", 75, { behavioral: 70, gemini: 75, ml: 60, rules: 70, trends: 50 }),
      makeRaw(3, "beauty", "viral", 72, { behavioral: 68, gemini: 72, ml: 60, rules: 70, trends: 50 }),
      makeRaw(4, "comedy", "average", 50, { behavioral: 50, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(5, "comedy", "average", 45, { behavioral: 45, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(6, "comedy", "average", 55, { behavioral: 55, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(7, "edu", "under", 20, { behavioral: 20, gemini: 25, ml: 20, rules: 20, trends: 20 }),
      makeRaw(8, "edu", "under", 25, { behavioral: 25, gemini: 25, ml: 20, rules: 20, trends: 20 }),
      makeRaw(9, "edu", "under", 28, { behavioral: 28, gemini: 25, ml: 20, rules: 20, trends: 20 }),
    ];
    vi.mocked(runEvalOverCorpus).mockResolvedValue(rows);

    const report = await runEvalHarness({
      corpusVersion: "test.fixture",
      persist: false,
    });

    expect(report.macro_f1).toBeGreaterThan(0);
    expect(report.macro_f1).toBeLessThanOrEqual(1);
    expect(report.per_niche_f1.beauty).toBeGreaterThan(0);
    expect(report.signal_contribution).toBeNull();          // leaveOneOut not set
    expect(report.viral_recall).toBe(1);
    expect(report.under_precision).toBe(1);
    expect(report.rows_processed).toBe(9);
    expect(report.rows_failed).toBe(0);
    expect(report.failure_cases).toEqual([]);               // all predictions correct
  });

  it("LOO produces non-zero contribution when signals are non-uniform (BLOCKER-6)", async () => {
    // 10 rows where `behavioral` strictly dominates the signal-to-bucket mapping.
    // High-behavioral rows -> viral bucket; low-behavioral rows -> under bucket.
    // Other signals stay flat at 50 so removing `behavioral` collapses every row to 50 -> "average".
    const rows: RawEvalResult[] = [
      makeRaw(1, "beauty", "viral", 80, { behavioral: 95, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(2, "beauty", "viral", 78, { behavioral: 92, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(3, "beauty", "viral", 75, { behavioral: 88, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(4, "comedy", "viral", 75, { behavioral: 88, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(5, "comedy", "average", 55, { behavioral: 60, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(6, "edu", "under", 20, { behavioral: 5, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(7, "edu", "under", 22, { behavioral: 8, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(8, "edu", "under", 25, { behavioral: 12, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(9, "fitness", "under", 28, { behavioral: 15, gemini: 50, ml: 50, rules: 50, trends: 50 }),
      makeRaw(10, "lifestyle", "under", 18, { behavioral: 5, gemini: 50, ml: 50, rules: 50, trends: 50 }),
    ];
    vi.mocked(runEvalOverCorpus).mockResolvedValue(rows);

    const report = await runEvalHarness({
      corpusVersion: "test.fixture",
      leaveOneOut: true,
      persist: false,
    });

    expect(report.signal_contribution).not.toBeNull();
    // Removing the dominating signal must change macro-F1 measurably.
    expect(report.signal_contribution!.behavioral).not.toBe(0);
    expect(Math.abs(report.signal_contribution!.behavioral)).toBeGreaterThan(0.001);
    // Flat signals (rules, trends, gemini at 50 for every row) have zero or near-zero contribution.
    // We don't assert their absolute values, only that behavioral dominates.
    expect(Math.abs(report.signal_contribution!.behavioral)).toBeGreaterThan(
      Math.abs(report.signal_contribution!.trends ?? 0),
    );
  });

  it("ECE is null when no rows had predicted_overall_score", async () => {
    const rows: RawEvalResult[] = [
      { ...makeRaw(1, "beauty", "viral", 0, { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0 }), predicted_overall_score: null, predicted_bucket: "viral" },
    ];
    vi.mocked(runEvalOverCorpus).mockResolvedValue(rows);
    const report = await runEvalHarness({ corpusVersion: "test.fixture", persist: false });
    expect(report.ece).toBeNull();
  });

  it("failure_cases has at most 10 entries even with many mispredictions", async () => {
    const rows: RawEvalResult[] = Array.from({ length: 30 }).map((_, i) =>
      makeRaw(i, "beauty", "viral", 10, { behavioral: 10, gemini: 10, ml: 10, rules: 10, trends: 10 }),
    );
    vi.mocked(runEvalOverCorpus).mockResolvedValue(rows);
    const report = await runEvalHarness({ corpusVersion: "test.fixture", persist: false });
    expect(report.failure_cases.length).toBeLessThanOrEqual(10);
  });
});
