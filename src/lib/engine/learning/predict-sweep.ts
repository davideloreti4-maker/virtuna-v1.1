/**
 * 1:1 E2E learning loop — predict sweep.
 *
 * Reads `status='scraped'` training videos, runs each BLIND through the
 * production pipeline (learning/predict.ts), and writes the engine's
 * content-derived feature_vector + score + predicted bucket back to the row
 * (status='predicted'). Failures mark the row 'failed' and continue.
 *
 * Bounded by maxRows + maxCostCents — full E2E vision runs cost real money.
 * The predict fn + supabase client are injectable for tests.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { runEngineOnTrainingVideo, type BlindEnginePrediction } from "./predict";
import type { Niche } from "../corpus/eval-config";

const log = createLogger({ module: "learning/predict-sweep" });

/** Pure: engine prediction → the `predicted` UPDATE payload. */
export function buildPredictedUpdate(
  p: BlindEnginePrediction,
  evaluatedAtIso: string,
): Record<string, unknown> {
  return {
    engine_feature_vector: p.feature_vector,
    // Per-signal scores (the learnable inputs for per-niche weight fitting).
    engine_prediction: { signal_scores: p.signal_scores, overall_score: p.overall_score },
    engine_overall_score: p.overall_score,
    engine_predicted_bucket: p.predicted_bucket,
    engine_version: p.engine_version,
    engine_evaluated_at: evaluatedAtIso,
    status: "predicted",
  };
}

interface ScrapedRow {
  id: string;
  video_storage_path: string | null;
  niche: string | null;
  society_id: string | null;
}

export interface PredictSweepOptions {
  maxRows?: number;
  maxCostCents?: number; // default 2000 ($20)
  supabase?: SupabaseClient;
  /** Injectable for tests; defaults to the real 1:1 pipeline wrapper. */
  predictFn?: (args: {
    videoStoragePath: string;
    niche: Niche;
    societyId?: string | null;
  }) => Promise<BlindEnginePrediction>;
  /** Injectable clock (avoids real time in tests). */
  nowIso?: () => string;
}

export interface PredictSweepResult {
  predicted: number;
  failed: number;
  skipped: number;
  costCents: number;
}

export async function runPredictSweep(
  opts: PredictSweepOptions = {},
): Promise<PredictSweepResult> {
  const supabase = opts.supabase ?? createServiceClient();
  const predictFn = opts.predictFn ?? runEngineOnTrainingVideo;
  const nowIso = opts.nowIso ?? (() => new Date().toISOString());
  const costCap = Number.isFinite(opts.maxCostCents) ? (opts.maxCostCents as number) : 2000;
  const rowCap = Number.isFinite(opts.maxRows) && (opts.maxRows as number) > 0
    ? (opts.maxRows as number)
    : 100;

  const { data, error } = await supabase
    .from("engine_training_videos")
    .select("id, video_storage_path, niche, society_id")
    .eq("status", "scraped")
    .not("video_storage_path", "is", null)
    .order("scraped_at", { ascending: true })
    .limit(rowCap);
  if (error) throw new Error(`predict-sweep fetch failed: ${error.message}`);

  const rows = (data ?? []) as ScrapedRow[];
  let predicted = 0;
  let failed = 0;
  let skipped = 0;
  let costCents = 0;

  for (const row of rows) {
    if (costCents > costCap) {
      log.warn("predict-sweep cost cap reached; stopping", { costCents, costCap });
      break;
    }
    if (!row.video_storage_path || !row.niche) {
      skipped++;
      continue;
    }
    try {
      const prediction = await predictFn({
        videoStoragePath: row.video_storage_path,
        niche: row.niche as Niche,
        societyId: row.society_id,
      });
      costCents += prediction.cost_cents;
      const update = buildPredictedUpdate(prediction, nowIso());
      const { error: upErr } = await supabase
        .from("engine_training_videos")
        .update(update)
        .eq("id", row.id);
      if (upErr) throw new Error(upErr.message);
      predicted++;
      log.info("row predicted", { id: row.id, score: prediction.overall_score });
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      log.error("row predict failed; marking failed", { id: row.id, error: msg });
      await supabase
        .from("engine_training_videos")
        .update({ status: "failed" })
        .eq("id", row.id);
    }
  }

  log.info("predict-sweep done", { predicted, failed, skipped, costCents });
  return { predicted, failed, skipped, costCents };
}
