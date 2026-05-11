---
phase: 1
plan: E
title: Eval harness + baseline measurement + eval CLI
status: pending
type: execute
wave: 2
depends_on: [A, B]
files_modified:
  - src/lib/engine/corpus/eval-runner.ts
  - src/lib/engine/corpus/eval-harness.ts
  - src/lib/engine/corpus/baseline.ts
  - src/lib/engine/corpus/failure-cases.ts
  - scripts/eval.ts
  - package.json
  - src/lib/engine/corpus/__tests__/eval-runner.test.ts
  - src/lib/engine/corpus/__tests__/eval-harness.test.ts
  - src/lib/engine/corpus/__tests__/failure-cases.test.ts
autonomous: true
requirements: [EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-08]
must_haves:
  truths:
    - "runEvalHarness({corpusVersion, engineVersion}) iterates training_corpus rows, calls runPredictionPipeline + aggregateScores, and returns a structured BenchmarkReport"
    - "Cost cap: total cost > maxTotalCostCents aborts the run mid-batch (Pitfall 5; CLI flag --max-total-cost-cents 5000 default)"
    - "measureV21Baseline(corpusVersion) hardcodes engine_version=ENGINE_VERSION ('2.1.0' per D-21) and persists ONE row to benchmark_results"
    - "Per-signal leave-one-out is opt-in via --leave-one-out flag (6× cost — RESEARCH §C.3)"
    - "Top-10 mispredictions captured as JSON in benchmark_results.failure_cases JSONB column (per Claude's discretion §C.5)"
    - "Aggregator's aggregateScores() is always AWAITED (fix bug at benchmark.ts:515)"
    - "Per-stage latency p50/p95/p99 collected from pipelineResult.timings"
    - "completion_pct=NULL handled without error (per user decision 2026-05-11)"
  artifacts:
    - path: src/lib/engine/corpus/eval-runner.ts
      provides: "runEvalOverCorpus(opts) — pure-ish loop over training_corpus, per-row try/catch, cost cap, returns raw per-row predictions"
      contains: "runEvalOverCorpus"
    - path: src/lib/engine/corpus/eval-harness.ts
      provides: "runEvalHarness(opts) — wrapper that calls eval-runner, computes metrics, optionally LOO, persists row to benchmark_results, returns BenchmarkReport"
      contains: "runEvalHarness"
    - path: src/lib/engine/corpus/baseline.ts
      provides: "measureV21Baseline(corpusVersion) — runs harness with engine_version=ENGINE_VERSION, persists baseline row (D-20)"
      contains: "measureV21Baseline"
    - path: src/lib/engine/corpus/failure-cases.ts
      provides: "top10Mispredictions(rows) — curate failure cases for JSONB column"
      contains: "top10Mispredictions"
    - path: scripts/eval.ts
      provides: "CLI: tsx scripts/eval.ts --corpus-version <v> [--engine-version 2.1.0] [--baseline] [--leave-one-out] [--max-total-cost-cents 5000] [--output <path>]"
      exports: ["main"]
  key_links:
    - from: src/lib/engine/corpus/eval-runner.ts
      to: src/lib/engine/pipeline.ts
      via: "runPredictionPipeline(input) — NEVER edit pipeline.ts (additive only)"
      pattern: "runPredictionPipeline"
    - from: src/lib/engine/corpus/eval-runner.ts
      to: src/lib/engine/aggregator.ts
      via: "await aggregateScores(pipelineResult), import ENGINE_VERSION"
      pattern: "aggregateScores|ENGINE_VERSION"
    - from: src/lib/engine/corpus/eval-harness.ts
      to: src/lib/engine/corpus/metrics
      via: "computeMacroF1, computeECE, bucketFromScore, aggregateStageLatencies, scoreWithoutSignal, scoreBaseline"
      pattern: "computeMacroF1|computeECE|bucketFromScore"
    - from: src/lib/engine/corpus/baseline.ts
      to: src/lib/engine/aggregator.ts
      via: "ENGINE_VERSION import (D-21: hardcoded '2.1.0' until Phase 3)"
      pattern: "import.*ENGINE_VERSION"
---

<objective>
Build the eval harness end-to-end: a CLI + library functions that load a sealed corpus version, run every video through the unchanged v2.1 pipeline, collect predicted-vs-actual bucket pairs + cost + latency, compute macro-F1 (D-14) + per-niche F1 + ECE (re-uses Plan B's metric layer) + per-signal LOO (EVAL-03) + bucket-specific recall/precision + failure cases, and persist the result to `benchmark_results`. The `measureV21Baseline()` entrypoint is the canonical D-20 artifact.

Parallel with Plan D — both depend only on A (schema) and B (metrics). No dependency on C/D — eval harness reads from the (eventually-populated) `training_corpus` table; it doesn't need the scrape orchestrator to be wired.

Purpose: Provides the runnable artifact (`tsx scripts/eval.ts`) that Plan G uses to measure the v2.1 baseline.
Output: 4 library files + CLI + 3 test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md
@.planning/phases/01-training-corpus-eval-foundation/01-RESEARCH.md
@.planning/phases/01-training-corpus-eval-foundation/01-PATTERNS.md
@src/lib/engine/pipeline.ts
@src/lib/engine/aggregator.ts
@src/lib/engine/calibration.ts
@src/lib/engine/types.ts
@src/lib/engine/corpus/eval-config.ts
@src/lib/engine/corpus/metrics/macro-f1.ts
@src/lib/engine/corpus/metrics/score-to-bucket.ts
@src/lib/engine/corpus/metrics/leave-one-out.ts
@src/lib/engine/corpus/metrics/stage-latency.ts
@src/lib/supabase/service.ts
@scripts/benchmark.ts
@scripts/extract-training-data.ts
@package.json

<interfaces>
<!-- From Plan A (already written by Wave 1) -->
- `training_corpus` table with columns including: id, corpus_version, niche, bucket, caption, hashtags, views, likes, comments, shares, saves, follower_tier, completion_pct (nullable)
- `benchmark_results` table with macro_f1, per_niche_f1 JSONB, ece, signal_contribution JSONB, failure_cases JSONB, etc.

<!-- From Plan B (already written by Wave 1) -->
- `import { computeMacroF1 } from "./metrics/macro-f1"`
- `import { computeECE } from "./metrics"`     // re-export from calibration
- `import { bucketFromScore } from "./metrics/score-to-bucket"`
- `import { aggregateStageLatencies } from "./metrics/stage-latency"`
- `import { scoreBaseline, scoreWithoutSignal, type Signal, SIGNALS } from "./metrics/leave-one-out"`
- `import { NICHES, type Niche, type Bucket, MIN_VIEWS_FOR_MAE_ENGAGEMENT } from "./eval-config"`

<!-- From existing engine (NEVER edit per additive-only rule) -->
- `runPredictionPipeline(input: AnalysisInput) → Promise<PipelineResult>` (pipeline.ts)
- `aggregateScores(pipelineResult: PipelineResult) → Promise<PredictionResult>` (aggregator.ts:263 — ASYNC, must be awaited)
- `ENGINE_VERSION = "2.1.0"` (aggregator.ts:17)
- `interface PipelineResult { timings: StageTiming[], deepseekResult, geminiResult, ruleScoreResult, trendEnrichment, featureVector, mlPrediction, warnings: string[] }`
- `interface PredictionResult { overall_score, confidence, ..., cost_cents }`

<!-- Patterns to mirror -->
- `scripts/benchmark.ts:481-760` — main eval loop with per-sample try/catch, cost accumulation, structured summary
- `scripts/benchmark.ts:514-515` — pipeline → aggregator pattern (BUG: missing `await` on aggregateScores; fix in new code)
- `scripts/extract-training-data.ts:249-268` — batched supabase fetch with `range(offset, offset + BATCH_SIZE - 1)`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: eval-runner.ts (raw per-row loop) + failure-cases.ts + tests</name>
  <files>src/lib/engine/corpus/eval-runner.ts, src/lib/engine/corpus/failure-cases.ts, src/lib/engine/corpus/__tests__/eval-runner.test.ts, src/lib/engine/corpus/__tests__/failure-cases.test.ts</files>
  <behavior>
**eval-runner:**
- `runEvalOverCorpus({ corpusVersion, maxRows, maxTotalCostCents })` fetches rows from training_corpus in pages of 50, calls runPredictionPipeline + AWAITED aggregateScores per row, collects results
- Per-row error → log + push synthetic null-fields result; continue (mirror benchmark.ts:551-578)
- Cost cap: when `totalCostCents > maxTotalCostCents`, abort with a `CostCapExceededError`
- Per-row max cost guard: if 3 consecutive rows exceed 2× the running avg, log warning (Pitfall 5)
- Returns `RawEvalResult[]` with: corpus_row_id, niche, actual_bucket, predicted_overall_score, predicted_bucket, pipelineTimings, cost_cents, signalScores (for LOO), error
- completion_pct=NULL on a row does NOT throw; field is passed through to AnalysisInput as undefined

**failure-cases:**
- `top10Mispredictions(results)` returns the top 10 by misprediction severity (viral→under and under→viral count more than viral→avg)
- Severity scoring: viral↔under = 2, viral↔avg or avg↔under = 1, correct = 0
- Each curated case includes: corpus_row_id, niche, actual_bucket, predicted_bucket, predicted_score, top_signal_warnings (first 3 from pipelineResult.warnings)
- Returns max 10 even when there are 100 candidates
  </behavior>
  <action>
**src/lib/engine/corpus/eval-runner.ts**:

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores, ENGINE_VERSION } from "@/lib/engine/aggregator";
import type { Niche, Bucket } from "./eval-config";
import { bucketFromScore } from "./metrics/score-to-bucket";

const log = createLogger({ module: "corpus/eval-runner" });

export interface RawEvalResult {
  corpus_row_id: string;
  niche: Niche;
  actual_bucket: Bucket;
  // Engine outputs
  predicted_overall_score: number | null;
  predicted_bucket: Bucket | null;
  // Per-signal scores (for LOO computation downstream — extracted from aggregator inputs)
  signalScores: {
    behavioral: number;
    gemini: number;
    ml: number;
    rules: number;
    trends: number;
  } | null;
  pipelineTimings: Array<{ stage: string; duration_ms: number }>;
  cost_cents: number;
  // Outcome features (for MAE / Spearman)
  actual_views: number;
  actual_likes: number;
  actual_comments: number;
  actual_shares: number;
  actual_saves: number;
  warnings: string[];
  error: string | null;
}

export class CostCapExceededError extends Error {
  constructor(public readonly totalCostCents: number, public readonly atRow: number) {
    super(`Cost cap exceeded: ${totalCostCents} cents at row ${atRow}`);
    this.name = "CostCapExceededError";
  }
}

export interface EvalRunnerOptions {
  corpusVersion: string;
  maxRows?: number;
  maxTotalCostCents?: number;                       // Pitfall 5: default 5000 ($50)
  rateLimitDelayMs?: number;                         // default 2000 (matches benchmark.ts:582)
}

const FETCH_BATCH = 50;

export async function runEvalOverCorpus(
  opts: EvalRunnerOptions,
): Promise<RawEvalResult[]> {
  const supabase = createServiceClient();
  const cap = opts.maxTotalCostCents ?? 5000;
  const delayMs = opts.rateLimitDelayMs ?? 2000;
  const results: RawEvalResult[] = [];
  let totalCost = 0;
  let consecutiveHighCost = 0;

  // Page through corpus rows (extract-training-data.ts:249-268 pattern)
  let offset = 0;
  const allRows: Array<Record<string, unknown>> = [];
  while (true) {
    const { data, error } = await supabase
      .from("training_corpus")
      .select("id, niche, bucket, caption, hashtags, views, likes, comments, shares, saves, follower_tier, completion_pct, sound_name")
      .eq("corpus_version", opts.corpusVersion)
      .range(offset, offset + FETCH_BATCH - 1);
    if (error) throw new Error(`Corpus fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < FETCH_BATCH) break;
    offset += FETCH_BATCH;
  }

  const effective = opts.maxRows ? allRows.slice(0, opts.maxRows) : allRows;
  log.info("Eval loop starting", { corpusVersion: opts.corpusVersion, rowCount: effective.length, cap });

  for (let i = 0; i < effective.length; i++) {
    const row = effective[i]!;
    const niche = row.niche as Niche;
    const actual_bucket = row.bucket as Bucket;

    try {
      const pipelineResult = await runPredictionPipeline({
        input_mode: "text",
        content_text: (row.caption as string) ?? "",
        content_type: "video",
        niche,
        // Optional fields — completion_pct intentionally NOT passed (NULL handling per user decision)
      } as never);
      const prediction = await aggregateScores(pipelineResult);  // FIX: always await (benchmark.ts:515 bug)

      const cost = prediction.cost_cents ?? 0;
      totalCost += cost;

      // Cost cap (Pitfall 5)
      if (totalCost > cap) {
        log.error("Cost cap exceeded", { totalCost, atRow: i });
        throw new CostCapExceededError(totalCost, i);
      }

      // Per-row spike monitor
      const runningAvg = totalCost / Math.max(i + 1, 1);
      if (cost > 2 * runningAvg && cost > 5) {
        consecutiveHighCost++;
        if (consecutiveHighCost >= 3) {
          log.warn("3 consecutive high-cost rows; consider aborting", { i, cost, runningAvg });
        }
      } else {
        consecutiveHighCost = 0;
      }

      // Extract per-signal scores for LOO. Pipeline result has the raw signal outputs
      // we approximate the signal scores from pipelineResult; if missing, use 50 as midpoint.
      const signalScores = extractSignalScores(pipelineResult, prediction);

      results.push({
        corpus_row_id: String(row.id),
        niche,
        actual_bucket,
        predicted_overall_score: prediction.overall_score,
        predicted_bucket: bucketFromScore(prediction.overall_score, niche),
        signalScores,
        pipelineTimings: pipelineResult.timings.map((t) => ({ stage: t.stage, duration_ms: t.duration_ms })),
        cost_cents: cost,
        actual_views: Number(row.views ?? 0),
        actual_likes: Number(row.likes ?? 0),
        actual_comments: Number(row.comments ?? 0),
        actual_shares: Number(row.shares ?? 0),
        actual_saves: Number(row.saves ?? 0),
        warnings: pipelineResult.warnings,
        error: null,
      });
      log.info("Row complete", { i, niche, score: prediction.overall_score, actual: actual_bucket, cost });
    } catch (err) {
      if (err instanceof CostCapExceededError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      log.error("Row failed; continuing", { i, error: msg });
      Sentry.captureException(err, { tags: { stage: "eval_harness", engineVersion: ENGINE_VERSION } });
      results.push({
        corpus_row_id: String(row.id),
        niche,
        actual_bucket,
        predicted_overall_score: null,
        predicted_bucket: null,
        signalScores: null,
        pipelineTimings: [],
        cost_cents: 0,
        actual_views: Number(row.views ?? 0),
        actual_likes: Number(row.likes ?? 0),
        actual_comments: Number(row.comments ?? 0),
        actual_shares: Number(row.shares ?? 0),
        actual_saves: Number(row.saves ?? 0),
        warnings: [msg],
        error: msg,
      });
    }

    if (i < effective.length - 1) await sleep(delayMs);
  }

  log.info("Eval loop complete", { processed: results.length, totalCost });
  return results;
}

function extractSignalScores(
  pipelineResult: import("@/lib/engine/pipeline").PipelineResult,
  prediction: import("@/lib/engine/types").PredictionResult,
): RawEvalResult["signalScores"] {
  // Best-effort extraction. The aggregator combines these into overall_score;
  // we read what's exposed on PredictionResult / PipelineResult. When a signal
  // is missing (graceful degradation), use 50 (neutral midpoint) so LOO can
  // still compute a delta.
  const p = prediction as Record<string, unknown>;
  return {
    behavioral: typeof p.behavioral_score === "number" ? (p.behavioral_score as number) : 50,
    gemini: typeof p.gemini_score === "number" ? (p.gemini_score as number) : 50,
    ml: typeof p.ml_score === "number" ? (p.ml_score as number) : 50,
    rules: typeof p.rule_score === "number" ? (p.rule_score as number) : 50,
    trends: typeof p.trend_score === "number" ? (p.trend_score as number) : 50,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
```

**src/lib/engine/corpus/failure-cases.ts**:

```typescript
import type { RawEvalResult } from "./eval-runner";
import type { Bucket } from "./eval-config";

export interface CuratedFailureCase {
  corpus_row_id: string;
  niche: string;
  actual_bucket: Bucket;
  predicted_bucket: Bucket | null;
  predicted_score: number | null;
  severity: number;
  top_warnings: string[];
}

/**
 * Curate the top-10 mispredictions by severity for the failure_cases JSONB column.
 * Severity rubric:
 *   viral↔under (worst): 2
 *   viral↔avg or avg↔under: 1
 *   correct or null: 0
 *
 * Returns max 10 entries; orders by severity desc, then by largest |predicted - actual_score| proxy.
 */
export function top10Mispredictions(results: RawEvalResult[]): CuratedFailureCase[] {
  const severity = (actual: Bucket, predicted: Bucket | null): number => {
    if (predicted === null || actual === predicted) return 0;
    const pair = new Set([actual, predicted]);
    if (pair.has("viral") && pair.has("under")) return 2;
    return 1;
  };

  const candidates = results
    .map((r) => ({
      corpus_row_id: r.corpus_row_id,
      niche: r.niche,
      actual_bucket: r.actual_bucket,
      predicted_bucket: r.predicted_bucket,
      predicted_score: r.predicted_overall_score,
      severity: severity(r.actual_bucket, r.predicted_bucket),
      top_warnings: r.warnings.slice(0, 3),
    }))
    .filter((c) => c.severity > 0);

  candidates.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    // Tiebreak: row with no warnings or all-null predicted_score is more interesting
    return (b.predicted_score ?? 50) - (a.predicted_score ?? 50);
  });

  return candidates.slice(0, 10);
}
```

**Tests `__tests__/eval-runner.test.ts`** (heavy mocks: pipeline, aggregator, supabase):

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/engine/pipeline", () => ({
  runPredictionPipeline: vi.fn(),
}));
vi.mock("@/lib/engine/aggregator", () => ({
  aggregateScores: vi.fn(),
  ENGINE_VERSION: "2.1.0",
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

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
                  { id: "r1", niche: "beauty", bucket: "viral", caption: "hi", views: 1000000, likes: 50000, comments: 5000, shares: 1000, saves: 500 },
                  { id: "r2", niche: "comedy", bucket: "average", caption: "ho", views: 100000, likes: 5000, comments: 500, shares: 100, saves: 50 },
                  { id: "r3", niche: "edu", bucket: "under", caption: "x", views: 500, likes: 5, comments: 1, shares: 0, saves: 0 },
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
    expect(results[0]!.predicted_bucket).toBe("viral");          // score 80 ≥ 70
    expect(vi.mocked(aggregateScores)).toHaveBeenCalledTimes(3);
  });

  it("aborts with CostCapExceededError when cumulative cost exceeds cap", async () => {
    vi.mocked(aggregateScores).mockResolvedValue({
      overall_score: 50,
      cost_cents: 3000,   // each row costs $30
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
```

**Tests `__tests__/failure-cases.test.ts`**:
- 12 fixture results where 2 are viral↔under, 5 are viral↔avg, 3 correct, 2 null → top10 returns the 2 viral↔under first (severity 2), then 5 viral↔avg (severity 1), total 7
- Empty input → []
- All-correct input → []
- Severity ordering preserved

Run tests after writing them; iterate until green.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/eval-runner.test.ts src/lib/engine/corpus/__tests__/failure-cases.test.ts</automated>
  </verify>
  <done>Both test files pass. aggregateScores is always awaited. Cost cap aborts via typed exception. Per-row failures isolated. Failure-case curation honors severity rubric.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: eval-harness.ts (full BenchmarkReport assembly) + baseline.ts</name>
  <files>src/lib/engine/corpus/eval-harness.ts, src/lib/engine/corpus/baseline.ts, src/lib/engine/corpus/__tests__/eval-harness.test.ts</files>
  <behavior>
- `runEvalHarness({ corpusVersion, engineVersion, leaveOneOut, maxTotalCostCents })` calls `runEvalOverCorpus`, computes:
  - macro_f1 (D-14)
  - per_niche_f1 (D-15)
  - ece via computeECE on (score/100, actual=1 if viral)
  - per-class precision/recall
  - signal_contribution: when `leaveOneOut=true`, run scoreWithoutSignal per signal per row, compute macro-F1 delta, store as { behavioral: 0.04, gemini: 0.02, ... }
  - cost_cents_avg, cost_cents_total
  - latency p50/p95/p99 via aggregateStageLatencies + global pipeline duration
  - viral_recall, under_precision
  - mae_engagement_rate restricted to views >= MIN_VIEWS_FOR_MAE_ENGAGEMENT (Pitfall 4)
  - failure_cases (top-10 mispredictions) via failure-cases.ts
- `measureV21Baseline(corpusVersion)` calls runEvalHarness with `engineVersion: ENGINE_VERSION` (= "2.1.0" per D-21), persists ONE row to benchmark_results, returns the report
- Persistence path: INSERT into benchmark_results with all the fields from BenchmarkReport
- Idempotent re-runs: each call inserts a new row (UNIQUE constraint deliberately omitted in Plan A migration; multiple runs per version are intentional for regression testing)
  </behavior>
  <action>
**src/lib/engine/corpus/eval-harness.ts** — per PATTERNS §3 + RESEARCH §C.1-C.8:

```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ENGINE_VERSION } from "@/lib/engine/aggregator";
import { runEvalOverCorpus, type RawEvalResult } from "./eval-runner";
import { computeMacroF1, type MacroF1Result } from "./metrics/macro-f1";
import { computeECE } from "./metrics";        // re-exported from calibration
import { bucketFromScore } from "./metrics/score-to-bucket";
import { aggregateStageLatencies, quantile } from "./metrics/stage-latency";
import { scoreBaseline, scoreWithoutSignal, SIGNALS, type Signal } from "./metrics/leave-one-out";
import { top10Mispredictions, type CuratedFailureCase } from "./failure-cases";
import { NICHES, type Niche, type Bucket, MIN_VIEWS_FOR_MAE_ENGAGEMENT } from "./eval-config";

const log = createLogger({ module: "corpus/eval-harness" });

export interface BenchmarkReport {
  corpus_version: string;
  engine_version: string;
  macro_f1: number;
  per_niche_f1: Record<Niche, number>;
  ece: number | null;
  per_class_metrics: MacroF1Result["perClass"];
  signal_contribution: Record<Signal, number> | null;        // null if leaveOneOut disabled
  spearman_within_niche: Record<Niche, number>;              // placeholder for now; per-niche Spearman to be implemented if time permits
  mae_engagement_rate: number | null;
  cost_cents_avg: number;
  cost_cents_total: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  stage_timings: Record<string, { p50_ms: number; p95_ms: number; p99_ms: number; count: number }>;
  drift_metrics: Record<string, unknown>;
  failure_cases: CuratedFailureCase[];
  viral_recall: number;
  under_precision: number;
  rows_processed: number;
  rows_failed: number;
  run_at: string;
}

export interface RunEvalHarnessOptions {
  corpusVersion: string;
  engineVersion?: string;
  leaveOneOut?: boolean;
  maxTotalCostCents?: number;
  persist?: boolean;                  // default true
}

export async function runEvalHarness(
  opts: RunEvalHarnessOptions,
): Promise<BenchmarkReport> {
  const engineVersion = opts.engineVersion ?? ENGINE_VERSION;
  log.info("Eval harness starting", { corpusVersion: opts.corpusVersion, engineVersion, leaveOneOut: !!opts.leaveOneOut });

  const raw = await runEvalOverCorpus({
    corpusVersion: opts.corpusVersion,
    maxTotalCostCents: opts.maxTotalCostCents,
  });

  const successful = raw.filter((r) => r.predicted_bucket !== null);
  if (successful.length === 0) {
    throw new Error("No successful predictions; cannot compute metrics");
  }

  const predicted: Bucket[] = successful.map((r) => r.predicted_bucket!);
  const actual: Bucket[] = successful.map((r) => r.actual_bucket);

  // Global macro-F1 (D-14)
  const globalF1 = computeMacroF1(predicted, actual);

  // Per-niche F1 (D-15)
  const per_niche_f1 = {} as Record<Niche, number>;
  for (const niche of NICHES) {
    const subset = successful.filter((r) => r.niche === niche);
    if (subset.length < 3) {
      per_niche_f1[niche] = 0;     // insufficient samples
      continue;
    }
    per_niche_f1[niche] = computeMacroF1(
      subset.map((r) => r.predicted_bucket!),
      subset.map((r) => r.actual_bucket),
    ).macroF1;
  }

  // ECE — binary "did we predict viral?" mapping
  const ecePairs = successful
    .filter((r) => r.predicted_overall_score !== null)
    .map((r) => ({
      predicted: r.predicted_overall_score! / 100,
      actual: r.actual_bucket === "viral" ? 1 : 0,
    }));
  const ece = ecePairs.length > 0 ? (computeECE as (p: typeof ecePairs, n: number) => number)(ecePairs, 10) : null;

  // Leave-one-out (EVAL-03)
  let signal_contribution: Record<Signal, number> | null = null;
  if (opts.leaveOneOut) {
    signal_contribution = {} as Record<Signal, number>;
    const baselineF1 = globalF1.macroF1;
    for (const sig of SIGNALS) {
      const withoutSig: Bucket[] = successful.map((r) => {
        if (!r.signalScores) return r.predicted_bucket!;
        const ablation = scoreWithoutSignal(r.signalScores, sig);
        return bucketFromScore(ablation, r.niche);
      });
      const ablationF1 = computeMacroF1(withoutSig, actual).macroF1;
      signal_contribution[sig] = Math.round((baselineF1 - ablationF1) * 10_000) / 10_000;
    }
  }

  // Cost
  const cost_cents_total = raw.reduce((s, r) => s + r.cost_cents, 0);
  const cost_cents_avg = Math.round((cost_cents_total / raw.length) * 10_000) / 10_000;

  // Stage latency
  const stageMetrics = aggregateStageLatencies(raw.map((r) => r.pipelineTimings));
  const stage_timings = stageMetrics.reduce(
    (acc, m) => ({ ...acc, [m.stage]: { p50_ms: m.p50_ms, p95_ms: m.p95_ms, p99_ms: m.p99_ms, count: m.count } }),
    {} as Record<string, { p50_ms: number; p95_ms: number; p99_ms: number; count: number }>,
  );
  // Global pipeline latency: sum stage durations per row
  const perRowTotalMs = raw.map((r) => r.pipelineTimings.reduce((s, t) => s + t.duration_ms, 0));
  const latency_p50 = Math.round(quantile(perRowTotalMs, 0.5));
  const latency_p95 = Math.round(quantile(perRowTotalMs, 0.95));
  const latency_p99 = Math.round(quantile(perRowTotalMs, 0.99));

  // Bucket-specific metrics
  const viralActualIdx = actual.map((a, i) => (a === "viral" ? i : -1)).filter((i) => i >= 0);
  const viralCorrect = viralActualIdx.filter((i) => predicted[i] === "viral").length;
  const viral_recall = viralActualIdx.length > 0 ? Math.round((viralCorrect / viralActualIdx.length) * 10_000) / 10_000 : 0;

  const underPredictedIdx = predicted.map((p, i) => (p === "under" ? i : -1)).filter((i) => i >= 0);
  const underCorrect = underPredictedIdx.filter((i) => actual[i] === "under").length;
  const under_precision = underPredictedIdx.length > 0 ? Math.round((underCorrect / underPredictedIdx.length) * 10_000) / 10_000 : 0;

  // MAE engagement rate (Pitfall 4)
  const maeEligible = raw.filter((r) => r.predicted_overall_score !== null && r.actual_views >= MIN_VIEWS_FOR_MAE_ENGAGEMENT);
  let mae_engagement_rate: number | null = null;
  if (maeEligible.length > 0) {
    const errors = maeEligible.map((r) => {
      const actualRate = (r.actual_likes + r.actual_comments + r.actual_shares + r.actual_saves) / r.actual_views;
      // Approximate predicted rate from overall_score (Phase 1 simplification — Phase 10 refines)
      const predictedRate = (r.predicted_overall_score ?? 0) / 1000;  // 0-100 score → 0-0.1 rate proxy
      return Math.abs(actualRate - predictedRate);
    });
    mae_engagement_rate = Math.round((errors.reduce((s, e) => s + e, 0) / errors.length) * 1_000_000) / 1_000_000;
  }

  const failure_cases = top10Mispredictions(raw);

  const report: BenchmarkReport = {
    corpus_version: opts.corpusVersion,
    engine_version: engineVersion,
    macro_f1: globalF1.macroF1,
    per_niche_f1,
    ece,
    per_class_metrics: globalF1.perClass,
    signal_contribution,
    spearman_within_niche: NICHES.reduce((acc, n) => ({ ...acc, [n]: 0 }), {} as Record<Niche, number>),  // placeholder; computed in Plan G if time permits
    mae_engagement_rate,
    cost_cents_avg,
    cost_cents_total,
    latency_p50,
    latency_p95,
    latency_p99,
    stage_timings,
    drift_metrics: {},  // Phase 1: empty; Plan F can compare to prior version
    failure_cases,
    viral_recall,
    under_precision,
    rows_processed: raw.length,
    rows_failed: raw.filter((r) => r.error !== null).length,
    run_at: new Date().toISOString(),
  };

  if (opts.persist !== false) {
    await persistBenchmarkRow(report);
  }

  log.info("Eval harness complete", { macro_f1: report.macro_f1, ece: report.ece, totalCost: report.cost_cents_total });
  return report;
}

async function persistBenchmarkRow(report: BenchmarkReport): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("benchmark_results").insert({
    corpus_version: report.corpus_version,
    engine_version: report.engine_version,
    macro_f1: report.macro_f1,
    per_niche_f1: report.per_niche_f1,
    ece: report.ece,
    per_class_metrics: report.per_class_metrics,
    signal_contribution: report.signal_contribution ?? {},
    spearman_within_niche: report.spearman_within_niche,
    mae_engagement_rate: report.mae_engagement_rate,
    cost_cents_avg: report.cost_cents_avg,
    cost_cents_total: report.cost_cents_total,
    latency_p50: report.latency_p50,
    latency_p95: report.latency_p95,
    latency_p99: report.latency_p99,
    stage_timings: report.stage_timings,
    drift_metrics: report.drift_metrics,
    failure_cases: report.failure_cases,
    viral_recall: report.viral_recall,
    under_precision: report.under_precision,
    notes: `rows_processed=${report.rows_processed} rows_failed=${report.rows_failed}`,
  });
  if (error) {
    log.error("benchmark_results insert failed", { error: error.message });
    Sentry.captureException(error, { tags: { stage: "eval_harness_persist" } });
    throw error;
  }
}
```

**src/lib/engine/corpus/baseline.ts** — per PATTERNS §4:

```typescript
import { ENGINE_VERSION } from "@/lib/engine/aggregator";
import { runEvalHarness, type BenchmarkReport } from "./eval-harness";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "corpus/baseline" });

/**
 * D-20 deliverable: measure the v2.1 baseline on a sealed corpus_version.
 * Persists ONE row to benchmark_results with engine_version = "2.1.0"
 * (D-21 — hardcoded literal from aggregator.ts:17 until Phase 3 refactors versioning).
 */
export async function measureV21Baseline(
  corpusVersion: string,
  opts: { leaveOneOut?: boolean; maxTotalCostCents?: number } = {},
): Promise<BenchmarkReport> {
  log.info("v2.1 baseline measurement", { corpusVersion });
  const report = await runEvalHarness({
    corpusVersion,
    engineVersion: ENGINE_VERSION,   // = "2.1.0" (D-21)
    leaveOneOut: opts.leaveOneOut,
    maxTotalCostCents: opts.maxTotalCostCents,
    persist: true,
  });
  log.info("v2.1 baseline persisted", { macro_f1: report.macro_f1, ece: report.ece });
  return report;
}
```

**Tests `__tests__/eval-harness.test.ts`** (heavily mocked — assert metric assembly, not engine behavior):

- Build fixture `RawEvalResult[]` with known buckets and scores; call internal helpers directly OR mock `runEvalOverCorpus` and verify `runEvalHarness` produces the right BenchmarkReport shape
- macro_f1 + per_niche_f1 are numbers between 0 and 1
- When `leaveOneOut: true`, `signal_contribution` is populated; when false, it's null
- ECE is null when no rows had a predicted_overall_score
- viral_recall and under_precision computed correctly from fixture
- failure_cases is empty when all predictions match actual
- failure_cases has at most 10 entries

Run tests after writing them; iterate until green.
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/eval-harness.test.ts</automated>
  </verify>
  <done>Test file passes. BenchmarkReport has correct shape. measureV21Baseline writes to benchmark_results via persist=true path.</done>
</task>

<task type="auto">
  <name>Task 3: scripts/eval.ts CLI + package.json script</name>
  <files>scripts/eval.ts, package.json</files>
  <action>
**scripts/eval.ts** — pattern matches `scripts/benchmark.ts:1-22` exactly (RESEARCH §C.7 + PATTERNS §7):

```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

import { runEvalHarness } from "../src/lib/engine/corpus/eval-harness";
import { measureV21Baseline } from "../src/lib/engine/corpus/baseline";

const log = (msg: string) => console.log(`[eval] ${msg}`);

interface Args {
  corpusVersion: string;
  baseline: boolean;
  leaveOneOut: boolean;
  maxTotalCostCents: number;
  output?: string;
  engineVersion?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
    if (i < 0) return undefined;
    const a = args[i]!;
    if (a.includes("=")) return a.split("=", 2)[1];
    return args[i + 1];
  };

  const corpusVersion = get("--corpus-version") ?? "";
  if (!corpusVersion) {
    log("Usage: tsx scripts/eval.ts --corpus-version <v> [--baseline] [--leave-one-out] [--max-total-cost-cents N] [--output <path>] [--engine-version <v>]");
    process.exit(1);
  }
  return {
    corpusVersion,
    baseline: args.includes("--baseline"),
    leaveOneOut: args.includes("--leave-one-out"),
    maxTotalCostCents: Number(get("--max-total-cost-cents") ?? 5000),
    output: get("--output"),
    engineVersion: get("--engine-version"),
  };
}

async function main() {
  const args = parseArgs();
  log(`corpus=${args.corpusVersion} baseline=${args.baseline} loo=${args.leaveOneOut} cap=${args.maxTotalCostCents}`);

  const report = args.baseline
    ? await measureV21Baseline(args.corpusVersion, {
        leaveOneOut: args.leaveOneOut,
        maxTotalCostCents: args.maxTotalCostCents,
      })
    : await runEvalHarness({
        corpusVersion: args.corpusVersion,
        engineVersion: args.engineVersion,
        leaveOneOut: args.leaveOneOut,
        maxTotalCostCents: args.maxTotalCostCents,
      });

  log(`macro_f1: ${report.macro_f1}`);
  log(`ece: ${report.ece}`);
  log(`cost_cents_avg: ${report.cost_cents_avg}`);
  log(`cost_cents_total: ${report.cost_cents_total}`);
  log(`latency p50/p95/p99 ms: ${report.latency_p50}/${report.latency_p95}/${report.latency_p99}`);
  log(`per-niche macro_f1: ${JSON.stringify(report.per_niche_f1)}`);
  log(`viral_recall: ${report.viral_recall}`);
  log(`under_precision: ${report.under_precision}`);
  log(`rows_processed: ${report.rows_processed} (${report.rows_failed} failed)`);
  log(`failure_cases: ${report.failure_cases.length}`);

  if (args.output) {
    const dir = dirname(args.output);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(args.output, JSON.stringify(report, null, 2));
    log(`Wrote JSON report → ${args.output}`);
  }

  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
```

**package.json** — add npm script alongside `benchmark` and (from Plan D) `build-corpus`:
```json
"eval": "npx tsx scripts/eval.ts",
```

Verify CLI parses correctly without making real API calls:
```bash
npx tsx scripts/eval.ts 2>&1 | grep -q "Usage" && echo OK || echo FAIL
```
  </action>
  <verify>
    <automated>test -f scripts/eval.ts && grep -q '"eval":' package.json && npx tsx scripts/eval.ts 2>&1 | grep -q "Usage"</automated>
  </verify>
  <done>Script exists, package.json has eval entry, CLI prints usage when invoked without args.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLI (operator) → application | tsx scripts/eval.ts runs locally with env-var auth |
| Eval harness → external APIs (Gemini, DeepSeek) | Pipeline calls cost money; cost cap enforced (Pitfall 5) |
| Eval harness → benchmark_results | Service-role write only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-E-01 | DoS (self-inflicted) | Cost runaway during 500-video eval | mitigate | `--max-total-cost-cents 5000` ($50 hard cap) per Pitfall 5. Typed CostCapExceededError thrown mid-run on breach. |
| T-01-E-02 | Tampering | corpus_version mismatch between runs | mitigate | Each row in benchmark_results tagged with corpus_version + engine_version pair (D-12). Comparison logic in Plan G uses paired bootstrap on identical corpus_version only (Pitfall 6). |
| T-01-E-03 | Information disclosure | Logs include caption text from corpus | accept | Captions are scraped from public TikTok. No PII. Structured logger never emits raw API keys. |
| T-01-E-04 | Repudiation | Eval row inserted but not surfaced | mitigate | Sentry tags every insert failure; CLI logs total cost + macro-F1 to stdout; JSON output flag persists the full report to disk for audit. |
| T-01-E-05 | Tampering | Stale ENGINE_VERSION used for baseline row | mitigate | baseline.ts imports ENGINE_VERSION from aggregator.ts (D-21). When Phase 3 changes the constant, this baseline row is still tagged "2.1.0" (already persisted to DB). |
</threat_model>

<verification>
- `npx vitest run src/lib/engine/corpus/__tests__/eval-runner.test.ts src/lib/engine/corpus/__tests__/failure-cases.test.ts src/lib/engine/corpus/__tests__/eval-harness.test.ts` passes
- `scripts/eval.ts` exists and shows usage when run without args
- `package.json` has `"eval": "npx tsx scripts/eval.ts"`
- `npx tsc --noEmit` passes
- `aggregateScores` is awaited everywhere it's called (fix for benchmark.ts:515 bug)
</verification>

<success_criteria>
1. `runEvalHarness({ corpusVersion, engineVersion, leaveOneOut })` returns a complete BenchmarkReport
2. `measureV21Baseline(corpusVersion)` uses ENGINE_VERSION ("2.1.0") and persists one row
3. Cost cap aborts the run mid-batch via typed exception (Pitfall 5)
4. Per-row failures isolated (mirror benchmark.ts:551-578)
5. Top-10 failure curation honors severity rubric
6. `aggregateScores` is always awaited
</success_criteria>

<requirement_coverage>
| Requirement | Cross-link | Task |
|---|---|---|
| EVAL-01 | REQUIREMENTS.md §Evaluation Framework | T1 (eval-runner batches over corpus) |
| EVAL-02 | REQUIREMENTS.md §Evaluation Framework | T2 (macro-F1 + MAE engagement) |
| EVAL-03 | REQUIREMENTS.md §Evaluation Framework | T2 (signal_contribution via LOO when --leave-one-out) |
| EVAL-04 | REQUIREMENTS.md §Evaluation Framework | T2 (ECE via re-exported computeECE) |
| EVAL-05 | REQUIREMENTS.md §Evaluation Framework | T2 (benchmark_results rows enable Plan G + Phase 12 paired bootstrap from Plan B) |
| EVAL-06 | REQUIREMENTS.md §Evaluation Framework | T3 (JSON output + benchmark_results row) |
| EVAL-08 | REQUIREMENTS.md §Evaluation Framework | T2 (measureV21Baseline) — Plan G operationally runs it |
</requirement_coverage>

<out_of_scope>
- Actually running the eval against a populated corpus — Plan G does this
- Paired bootstrap p-value computation against ANOTHER engine version — Phase 12 work; bootstrap function exists in Plan B (metrics/bootstrap.ts)
- Per-niche Spearman ρ computation (placeholder; Plan G adds if time permits, otherwise Phase 10)
- Drift metrics across versions (placeholder; populated when 2+ corpus_versions exist — Plan G or later)
- Edits to pipeline.ts/aggregator.ts/types.ts (additive-only milestone constraint)
- `bucketFromScore` per-niche calibration (Phase 10 per RESEARCH "Open Question A3")
</out_of_scope>

<output>
After completion, create `.planning/phases/01-training-corpus-eval-foundation/01-E-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
