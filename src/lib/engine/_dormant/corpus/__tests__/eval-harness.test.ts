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
    // Fixture design (Rule 1 auto-fix): uses mathematically self-consistent signal values.
    // With 70/30 bucket thresholds and 5-signal aggregator weights (behavioral=0.35, others sum=0.65),
    // the maximum reachable score from signals alone is ~67.5 (behavioral=100, others=50).
    // To get a differential LOO: use rows where behavioral is HIGH and other signals are LOW so
    // the row sits in "average" (score ~35-45), and removing behavioral pushes it to "under" (<30).
    // Removing "trends" (low-weight, low-value) does NOT cross any threshold.
    //
    // Example row: behavioral=80, gemini=30, ml=20, rules=20, trends=10
    //   Baseline:         0.35*80+0.25*30+0.15*20+0.15*20+0.10*10 = 42.5 -> "average"
    //   Without behavioral: (0.25*30+0.15*20+0.15*20+0.10*10)/0.65 = 22.3 -> "under"
    //   Without trends:     (0.35*80+0.25*30+0.15*20+0.15*20)/0.90 = 46.1 -> "average" (no change)
    //
    // predicted_bucket in makeRaw is derived from predictedScore (mocked engine output).
    // The LOO comparison overwrites bucket using signalScores math, producing a measurable delta
    // for behavioral but NOT for trends.

    const rows: RawEvalResult[] = [
      // Rows where behavioral dominates: removing behavioral -> under; removing trends -> average (no change)
      makeRaw(1, "beauty",    "average", 42, { behavioral: 80, gemini: 30, ml: 20, rules: 20, trends: 10 }),
      makeRaw(2, "beauty",    "average", 40, { behavioral: 75, gemini: 28, ml: 18, rules: 18, trends: 8  }),
      makeRaw(3, "comedy",    "average", 43, { behavioral: 82, gemini: 32, ml: 22, rules: 22, trends: 12 }),
      makeRaw(4, "comedy",    "average", 41, { behavioral: 78, gemini: 29, ml: 19, rules: 19, trends: 9  }),
      makeRaw(5, "edu",       "average", 44, { behavioral: 84, gemini: 33, ml: 23, rules: 23, trends: 11 }),
      // Rows that are already "under" regardless of LOO ablation (stable bucket)
      makeRaw(6, "edu",       "under",   15, { behavioral: 10, gemini: 15, ml: 10, rules: 10, trends: 5  }),
      makeRaw(7, "fitness",   "under",   12, { behavioral: 8,  gemini: 12, ml: 8,  rules: 8,  trends: 4  }),
      makeRaw(8, "fitness",   "under",   18, { behavioral: 12, gemini: 18, ml: 12, rules: 12, trends: 6  }),
      makeRaw(9, "lifestyle", "under",   10, { behavioral: 5,  gemini: 10, ml: 5,  rules: 5,  trends: 3  }),
      makeRaw(10,"lifestyle", "under",   20, { behavioral: 15, gemini: 20, ml: 15, rules: 15, trends: 7  }),
    ];
    vi.mocked(runEvalOverCorpus).mockResolvedValue(rows);

    const report = await runEvalHarness({
      corpusVersion: "test.fixture",
      leaveOneOut: true,
      persist: false,
    });

    expect(report.signal_contribution).not.toBeNull();
    // Removing behavioral must change macro-F1 measurably (BLOCKER-6).
    // It converts average-predicted rows to under via ablation score crossing 30.
    expect(report.signal_contribution!.behavioral).not.toBe(0);
    expect(Math.abs(report.signal_contribution!.behavioral)).toBeGreaterThan(0.001);
    // Removing trends (low-weight, low-value) does NOT change any row's bucket -> zero contribution.
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
