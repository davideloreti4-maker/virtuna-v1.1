/**
 * Phase 8 — Bucket derivation for retrieval evidence items (D-03a).
 *
 * Pure module — no IO, no logger, no Sentry. Three branches:
 *
 *   1. training_corpus rows: carry forward bucket_label directly (bucket_source: "corpus")
 *   2. scraped_videos in calibrated niche (5 niches): use THRESHOLD_SNAPSHOTS["full.2026-05-11"]
 *      view-count thresholds (bucket_source: "derived")
 *   3. scraped_videos in non-calibrated niche (5 niches): use NON_CORPUS_ENGAGEMENT_PERCENTILES —
 *      P80/P40 of engagement_rate (bucket_source: "derived")
 *
 * NEVER throws — returns "average" as the safe default on unknown niche / missing snapshot.
 *
 * Plan 05's `scripts/embed-corpus.ts --derive-percentiles` will replace the 0/0 placeholders
 * in NON_CORPUS_ENGAGEMENT_PERCENTILES after backfill snapshots P80/P40 of the live data.
 * Until then, all 5 non-calibrated niches fall through to "average" (safe default).
 */

import { getThresholds } from "@/lib/engine/corpus/thresholds";

/**
 * Phase 1's calibrated niches — these use THRESHOLD_SNAPSHOTS["full.2026-05-11"] directly.
 * The 5 non-calibrated niches (tech-gadgets, gaming, fashion-style, music-performance, food-cooking)
 * use NON_CORPUS_ENGAGEMENT_PERCENTILES below.
 *
 * Note: training_corpus uses 'edu' (per migration CHECK constraint); NICHE_TREE uses 'education'.
 * CORPUS_NICHE_ALIASES handles the boundary translation when looking up thresholds.
 */
const CALIBRATED_NICHES = new Set([
  "beauty",
  "fitness",
  "education",
  "comedy",
  "lifestyle",
]);

/**
 * Boundary translation: NICHE_TREE form → training_corpus form.
 * The training_corpus migration CHECK constraint accepts only {beauty, fitness, edu, comedy, lifestyle};
 * NICHE_TREE.slug uses "education" (full word). Apply this map at threshold-lookup boundaries.
 */
export const CORPUS_NICHE_ALIASES: Record<string, string> = {
  education: "edu",
};

/**
 * D-03a percentile snapshot — captured 2026-05-19 via
 *   `pnpm tsx scripts/embed-corpus.ts --derive-percentiles`
 * after Phase 8 backfill embedded 225 training_corpus + 7389 scraped_videos rows.
 *
 * All 5 non-calibrated niches return n=0 (POOL TOO SMALL per RESEARCH Finding 5
 * threshold ≥30): the 7389 scraped_videos rows all have primary_niche=NULL because
 * their source `category` column is also NULL — the migration's category→niche
 * backfill (Strategy A mapping) matched 0 rows. Bucket-derivation correctly falls
 * back to "average" for these niches (safe default per RESEARCH §"Per-niche-corpus
 * check"). Phase 10+ can revisit this once Apify scrapes populate primary_niche via
 * the apify-webhook deriveNicheSlug() path (Plan 05 Task 4).
 *
 * NEVER edit existing values once non-zero — D-13-style immutability for any
 * niche that later receives a real P80/P40 reading.
 */
export const NON_CORPUS_ENGAGEMENT_PERCENTILES: Record<
  string,
  { p80: number; p40: number }
> = {
  "tech-gadgets": { p80: 0, p40: 0 }, // POOL TOO SMALL (n=0; need >=30) — 2026-05-19
  "gaming": { p80: 0, p40: 0 }, // POOL TOO SMALL (n=0; need >=30) — 2026-05-19
  "fashion-style": { p80: 0, p40: 0 }, // POOL TOO SMALL (n=0; need >=30) — 2026-05-19
  "music-performance": { p80: 0, p40: 0 }, // POOL TOO SMALL (n=0; need >=30) — 2026-05-19
  "food-cooking": { p80: 0, p40: 0 }, // POOL TOO SMALL (n=0; need >=30) — 2026-05-19
};

export interface BucketDerivation {
  bucket_label: "viral" | "average" | "under";
  bucket_source: "corpus" | "derived";
}

export interface DeriveInput {
  source_pool: "training_corpus" | "scraped_videos";
  bucket_label: "viral" | "average" | "under" | null;
  niche: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number | null;
}

/**
 * D-03a: derive (or carry forward) the bucket label for a retrieval evidence item.
 *
 *  - training_corpus + non-null bucket_label → carry forward (bucket_source: "corpus")
 *  - scraped_videos OR training_corpus with corrupt-null bucket → derive from data:
 *    - calibrated niche → THRESHOLD_SNAPSHOTS["full.2026-05-11"] view thresholds
 *    - non-calibrated niche → NON_CORPUS_ENGAGEMENT_PERCENTILES engagement-rate thresholds
 *      (or "average" fallback when placeholder is still 0/0)
 *
 * NEVER throws — unknown niche, missing threshold snapshot, division-by-zero on views=0
 * (Math.max(views, 1)), or all-zero placeholders all return "average".
 */
export function deriveBucket(input: DeriveInput): BucketDerivation {
  if (input.source_pool === "training_corpus" && input.bucket_label) {
    return { bucket_label: input.bucket_label, bucket_source: "corpus" };
  }

  // scraped_videos path (or training_corpus with corrupt null bucket)
  const isCalibrated = CALIBRATED_NICHES.has(input.niche);

  if (isCalibrated) {
    const corpusKey = CORPUS_NICHE_ALIASES[input.niche] ?? input.niche;
    const thresholds = getThresholds("full.2026-05-11");
    const t = thresholds[corpusKey as keyof typeof thresholds];
    if (!t) {
      // niche calibrated but threshold-snapshot lookup miss — safe default
      return { bucket_label: "average", bucket_source: "derived" };
    }
    if (input.views >= t.viralFloor) {
      return { bucket_label: "viral", bucket_source: "derived" };
    }
    if (input.views <= t.underCeiling) {
      return { bucket_label: "under", bucket_source: "derived" };
    }
    return { bucket_label: "average", bucket_source: "derived" };
  }

  // Non-calibrated path — engagement-rate percentile snapshot.
  const percentiles = NON_CORPUS_ENGAGEMENT_PERCENTILES[input.niche];
  if (!percentiles || (percentiles.p80 === 0 && percentiles.p40 === 0)) {
    // unknown niche OR placeholder still 0/0 (Plan 05 backfill hasn't run yet)
    return { bucket_label: "average", bucket_source: "derived" };
  }

  const engagementRate =
    (input.likes + input.shares + input.comments + (input.saves ?? 0)) /
    Math.max(input.views, 1);

  if (engagementRate >= percentiles.p80) {
    return { bucket_label: "viral", bucket_source: "derived" };
  }
  if (engagementRate <= percentiles.p40) {
    return { bucket_label: "under", bucket_source: "derived" };
  }
  return { bucket_label: "average", bucket_source: "derived" };
}

/**
 * D-03 score formula bucket-value mapping.
 *
 *   bucket_value[viral]   = 1.0
 *   bucket_value[average] = 0.5
 *   bucket_value[under]   = 0.0
 *
 * Used by Plan 04's retrieval-stage when computing:
 *   retrieval_score = Σ(similarity_i · bucket_value(item_i)) / Σ(similarity_i)
 */
export function bucketValue(bucket: "viral" | "average" | "under"): number {
  switch (bucket) {
    case "viral":
      return 1.0;
    case "average":
      return 0.5;
    case "under":
      return 0.0;
  }
}
