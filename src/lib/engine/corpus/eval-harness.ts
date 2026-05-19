import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { ENGINE_VERSION } from "@/lib/engine/aggregator";
import { runEvalOverCorpus } from "./eval-runner";
import { computeMacroF1, type MacroF1Result } from "./metrics/macro-f1";
import { computeECE } from "./metrics";        // re-exported from calibration
import { bucketFromScore } from "./metrics/score-to-bucket";
import { aggregateStageLatencies, quantile } from "./metrics/stage-latency";
import { scoreWithoutSignal, SIGNALS, type Signal } from "./metrics/leave-one-out";
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
  spearman_within_niche: Record<Niche, number>;              // placeholder; per-niche Spearman if time permits
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
  rateLimitDelayMs?: number;        // W7: threaded through to runEvalOverCorpus
  persist?: boolean;                // default true
  /**
   * Phase 7 D-14: optional aggregator behavioral source override. Threaded into
   * runEvalOverCorpus. Defaults to "deepseek" (production aggregator default).
   */
  behavioralSource?: "deepseek" | "personas";
}

export async function runEvalHarness(
  opts: RunEvalHarnessOptions,
): Promise<BenchmarkReport> {
  const engineVersion = opts.engineVersion ?? ENGINE_VERSION;
  log.info("Eval harness starting", { corpusVersion: opts.corpusVersion, engineVersion, leaveOneOut: !!opts.leaveOneOut });

  const raw = await runEvalOverCorpus({
    corpusVersion: opts.corpusVersion,
    maxTotalCostCents: opts.maxTotalCostCents,
    rateLimitDelayMs: opts.rateLimitDelayMs,
    behavioralSource: opts.behavioralSource,
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
  // [Rule 1 - Bug] computeECE returns { ece, bins } not a plain number.
  // The plan's cast `(computeECE as (p, n) => number)` is incorrect; extract .ece instead.
  const ecePairs = successful
    .filter((r) => r.predicted_overall_score !== null)
    .map((r) => ({
      predicted: r.predicted_overall_score! / 100,
      actual: r.actual_bucket === "viral" ? 1 : 0,
    }));
  const ece = ecePairs.length > 0 ? computeECE(ecePairs, 10).ece : null;

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
      const predictedRate = (r.predicted_overall_score ?? 0) / 1000;  // 0-100 score -> 0-0.1 rate proxy
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("benchmark_results").insert({
    corpus_version: report.corpus_version,
    engine_version: report.engine_version,
    macro_f1: report.macro_f1,
    per_niche_f1: report.per_niche_f1 as unknown as Record<string, unknown>,
    ece: report.ece,
    per_class_metrics: report.per_class_metrics as unknown as Record<string, unknown>,
    signal_contribution: (report.signal_contribution ?? {}) as unknown as Record<string, unknown>,
    spearman_within_niche: report.spearman_within_niche as unknown as Record<string, unknown>,
    mae_engagement_rate: report.mae_engagement_rate,
    cost_cents_avg: report.cost_cents_avg,
    cost_cents_total: report.cost_cents_total,
    latency_p50: report.latency_p50,
    latency_p95: report.latency_p95,
    latency_p99: report.latency_p99,
    stage_timings: report.stage_timings as unknown as Record<string, unknown>,
    drift_metrics: report.drift_metrics as unknown as Record<string, unknown>,
    failure_cases: report.failure_cases as unknown as Record<string, unknown>[],
    viral_recall: report.viral_recall,
    under_precision: report.under_precision,
    notes: `rows_processed=${report.rows_processed} rows_failed=${report.rows_failed}`,
  } as never);
  if (error) {
    log.error("benchmark_results insert failed", { error: error.message });
    Sentry.captureException(error, { tags: { stage: "eval_harness_persist" } });
    throw error;
  }
}
