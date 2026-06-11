import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores, ENGINE_VERSION } from "@/lib/engine/aggregator";
import type { AnalysisInput, PredictionResult } from "@/lib/engine/types";
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
  // Per-signal scores (for LOO computation downstream — read directly from typed PredictionResult)
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
  /**
   * Phase 7 D-14: optional aggregator behavioral source override.
   * Defaults to "fold" (Phase 4 Plan 05 — fold is sole audience-sim path).
   * Pass "deepseek" to force DeepSeek behavioral predictions (eval back-compat).
   * "personas" option removed — 10-pass deleted.
   */
  behavioralSource?: "deepseek" | "fold";
}

const FETCH_BATCH = 50;

export async function runEvalOverCorpus(
  opts: EvalRunnerOptions,
): Promise<RawEvalResult[]> {
  const supabase = createServiceClient();
  // CR-03 defensive harden: `??` only catches null/undefined, so NaN would pass through
  // and disable the cost cap (every `totalCost > NaN` is false). Normalize non-finite
  // values to the default 5000. Same for maxRows below.
  const cap = Number.isFinite(opts.maxTotalCostCents)
    ? (opts.maxTotalCostCents as number)
    : 5000;
  const delayMs = Number.isFinite(opts.rateLimitDelayMs)
    ? (opts.rateLimitDelayMs as number)
    : 2000;
  const results: RawEvalResult[] = [];
  let totalCost = 0;
  let consecutiveHighCost = 0;

  // Page through corpus rows (extract-training-data.ts:249-268 pattern)
  let offset = 0;
  const allRows: Array<Record<string, unknown>> = [];
  while (true) {
    const { data, error } = await supabase
      .from("training_corpus")
      .select("id, niche, bucket, caption, hashtags, views, likes, comments, shares, saves, follower_tier, completion_pct, sound_name, creator_handle")
      .eq("corpus_version", opts.corpusVersion)
      .range(offset, offset + FETCH_BATCH - 1);
    if (error) throw new Error(`Corpus fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < FETCH_BATCH) break;
    offset += FETCH_BATCH;
  }

  // CR-03 defensive harden: treat non-finite (NaN) maxRows as "no cap" rather than
  // silently truncating to 0 / Array.slice(0, NaN) = []. The CLI now hard-exits on
  // bad input upstream, but keep the runner robust to other callers.
  const effective = Number.isFinite(opts.maxRows) && (opts.maxRows as number) > 0
    ? allRows.slice(0, opts.maxRows as number)
    : allRows;
  log.info("Eval loop starting", { corpusVersion: opts.corpusVersion, rowCount: effective.length, cap });

  for (let i = 0; i < effective.length; i++) {
    const row = effective[i]!;
    const niche = row.niche as Niche;
    const actual_bucket = row.bucket as Bucket;

    try {
      // BLOCKER-2 resolution: construct a real AnalysisInput (types.ts:53-85).
      // Phase 1 uses text-mode evaluation — see the "Input-shape decision" in the plan.
      // The corpus does not store raw video bytes, so video_upload mode is unavailable.
      // Re-fetching via tiktok_url would multiply cost+latency; deferred to Phase 10/12.
      // No `as never` cast — the shape below matches AnalysisInputSchema (types.ts:53-83).
      const input: AnalysisInput = {
        input_mode: "text",
        content_text: typeof row.caption === "string" ? row.caption : "",
        content_type: "video",                              // corpus is TikTok video-only
        mode: "score",                                      // eval corpus is always score mode
        niche,
        creator_handle: typeof row.creator_handle === "string" ? row.creator_handle : undefined,
      };

      const pipelineResult = await runPredictionPipeline(input);
      // Phase 7 D-14: forward optional behavioralSource into aggregator.
      // The conditional avoids passing `{ behavioralSource: undefined }` — preserves
      // byte-identical production behavior when caller omits the option.
      const prediction = await aggregateScores(
        pipelineResult,
        undefined,
        opts.behavioralSource ? { behavioralSource: opts.behavioralSource } : undefined,
      );

      const cost = prediction.cost_cents ?? 0;
      totalCost += cost;

      // Cost cap (Pitfall 5)
      // Cost cap check fires AFTER the successful row's cost is added.
      // One over-budget row is tolerated within the 33% safety buffer ($50 cap vs $37.50 ceiling).
      // WR-07 (post-CR-01): `prediction.cost_cents` now folds in Wave 3 multi-persona spend
      // via `pipelineResult.wave3CostCents` (see aggregator.ts cost roll-up), so this cap
      // operates on TRUE total spend. The 33% buffer math is therefore correct again; before
      // CR-01 the cap silently under-counted by ~0.5-2.5 cents/row of hidden Wave 3 spend.
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

      // BLOCKER-1 resolution: read per-signal scores from typed PredictionResult fields.
      // These are non-optional on PredictionResult (types.ts:162-166) — `ml_score` is
      // documented to be `0` when ML model is unavailable (types.ts:166), `gemini_score`
      // and `behavioral_score` already encode graceful degradation inside aggregator.ts
      // (lines 311-321, 327-330). No casts needed.
      const signalScores = extractSignalScores(prediction);

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

/**
 * Read per-signal scores directly from the typed PredictionResult.
 * All five fields are non-optional on PredictionResult (types.ts:162-166).
 * Gemini/behavioral fields already encode graceful degradation inside the
 * aggregator (HARD-03 fallback at aggregator.ts:281-302) — when a signal is
 * unavailable, the aggregator emits 0 and updates `score_weights` accordingly.
 * Re-reading them here for LOO is sufficient: scoreWithoutSignal in metrics/
 * leave-one-out.ts redistributes weights using SCORE_WEIGHTS_BASE so a "0"
 * input still produces a non-degenerate ablation delta.
 */
function extractSignalScores(
  prediction: PredictionResult,
): RawEvalResult["signalScores"] {
  return {
    behavioral: prediction.behavioral_score,
    gemini: prediction.gemini_score ?? 0, // D-R1: null on video (Read no longer scores) → 0 for offline ablation
    ml: prediction.ml_score,
    rules: prediction.rule_score,
    trends: prediction.trend_score,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
