/**
 * 1:1 E2E learning loop — label pass.
 *
 * Assigns the REAL outcome label to predicted rows: percentile-within-niche of
 * actual views → viral/average/under (learning/labeling.ts), plus the
 * engine-vs-reality comparison (bucket_match, prediction_error). Sets
 * status='labeled' — those rows are the honest (feature_vector → real_bucket)
 * training pairs the clean retrain consumes.
 *
 * Per-niche percentile needs a cohort: a niche with < MIN_NICHE_COHORT predicted
 * rows is left unlabeled (untrustworthy) rather than mislabeled.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import {
  computeNicheBuckets,
  bucketMatch,
  bucketDistance,
  MIN_NICHE_COHORT,
  DEFAULT_THRESHOLDS,
  type BucketThresholds,
  type OutcomeBucket,
} from "./labeling";

const log = createLogger({ module: "learning/label" });

export interface LabelInputRow {
  id: string;
  niche: string;
  real_views: number;
  engine_predicted_bucket: OutcomeBucket | null;
}

export interface LabelUpdate {
  id: string;
  real_bucket: OutcomeBucket;
  real_percentile: number; // 0-100 (NUMERIC(5,2))
  bucket_match: boolean;
  prediction_error: number; // ordinal bucket distance 0-2
  status: "labeled";
}

/**
 * Pure: predicted rows → label updates. Niches with fewer than `minCohort` rows
 * are skipped (returned in `skippedNiches`) so their rows stay 'predicted'.
 */
export function buildLabelUpdates(
  rows: LabelInputRow[],
  minCohort: number = MIN_NICHE_COHORT,
  thresholds: BucketThresholds = DEFAULT_THRESHOLDS,
): { updates: LabelUpdate[]; skippedNiches: string[] } {
  // Which niches have a big enough cohort to trust the percentile?
  const nicheCounts = new Map<string, number>();
  for (const r of rows) nicheCounts.set(r.niche, (nicheCounts.get(r.niche) ?? 0) + 1);
  const eligible = rows.filter((r) => (nicheCounts.get(r.niche) ?? 0) >= minCohort);
  const skippedNiches = [...nicheCounts.entries()]
    .filter(([, c]) => c < minCohort)
    .map(([niche]) => niche);

  const buckets = computeNicheBuckets(
    eligible.map((r) => ({ id: r.id, niche: r.niche, real_views: r.real_views })),
    thresholds,
  );

  const updates: LabelUpdate[] = [];
  for (const r of eligible) {
    const b = buckets.get(r.id);
    if (!b) continue;
    const match = bucketMatch(r.engine_predicted_bucket, b.bucket);
    const error = r.engine_predicted_bucket
      ? bucketDistance(r.engine_predicted_bucket, b.bucket)
      : 2; // no engine bucket = worst-case distance
    updates.push({
      id: r.id,
      real_bucket: b.bucket,
      real_percentile: Math.round(b.percentile * 10000) / 100, // 0-100, 2dp
      bucket_match: match,
      prediction_error: error,
      status: "labeled",
    });
  }
  return { updates, skippedNiches };
}

export interface LabelPassOptions {
  minCohort?: number;
  thresholds?: BucketThresholds;
  supabase?: SupabaseClient;
}

export interface LabelPassResult {
  labeled: number;
  skippedNiches: string[];
  bucketMatchRate: number | null; // share of labeled rows where engine bucket == real bucket
}

export async function runLabelPass(
  opts: LabelPassOptions = {},
): Promise<LabelPassResult> {
  const supabase = opts.supabase ?? createServiceClient();

  const { data, error } = await supabase
    .from("engine_training_videos")
    .select("id, niche, real_views, engine_predicted_bucket")
    .eq("status", "predicted")
    .not("real_views", "is", null)
    .not("niche", "is", null);
  if (error) throw new Error(`label-pass fetch failed: ${error.message}`);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    niche: String(r.niche),
    real_views: Number(r.real_views ?? 0),
    engine_predicted_bucket: (r.engine_predicted_bucket as OutcomeBucket | null) ?? null,
  }));

  const { updates, skippedNiches } = buildLabelUpdates(
    rows,
    opts.minCohort,
    opts.thresholds,
  );

  for (const u of updates) {
    const { id, ...fields } = u;
    const { error: upErr } = await supabase
      .from("engine_training_videos")
      .update(fields)
      .eq("id", id);
    if (upErr) log.error("label update failed", { id, error: upErr.message });
  }

  const matchRate =
    updates.length > 0
      ? updates.filter((u) => u.bucket_match).length / updates.length
      : null;
  log.info("label-pass done", {
    labeled: updates.length,
    skippedNiches,
    bucketMatchRate: matchRate,
  });
  return { labeled: updates.length, skippedNiches, bucketMatchRate: matchRate };
}
