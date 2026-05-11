import type { Niche, Bucket } from "./eval-config";
import type { ThresholdsByNiche } from "./thresholds";

export interface BucketingInput {
  views: number | bigint;
  niche: Niche;
}

/**
 * Classify a video into one of three outcome buckets using per-niche
 * absolute view thresholds (D-07).
 *
 * Boundary semantics (D-10 hard cutoff, no exclusion zone):
 *   views >= viralFloor → "viral"
 *   views <= underCeiling → "under"
 *   otherwise → "average"
 *
 * Pure function. Thresholds are snapshot per corpus_version (D-13).
 * Caller must pass the materialized snapshot.
 *
 * Unknown niche → "average" (safe default; guarded per PATTERNS §1 pitfall).
 */
export function bucketByViews(
  input: BucketingInput,
  thresholds: ThresholdsByNiche,
): Bucket {
  const t = thresholds[input.niche];
  if (!t) return "average";
  const v = typeof input.views === "bigint" ? Number(input.views) : input.views;
  if (v >= t.viralFloor) return "viral";
  if (v <= t.underCeiling) return "under";
  return "average";
}
