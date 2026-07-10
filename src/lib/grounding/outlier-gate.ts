/**
 * grounding/outlier-gate.ts — the outlier gate, split into a cheap SELECTION metric
 * and a durable per-account RECEIPT metric (§14 + spike finding #2).
 *
 * Pure arithmetic — NO Apify/Supabase imports (mirrors outlier-compute.ts). The
 * orchestrator does the network (scrape survivors' profiles for follower_count) and
 * calls these.
 *
 * TWO metrics, two jobs (this is the finding-#2 fix):
 *  - SELECTION (cheap, free): views ÷ result-set-median (shipped rankOutliers "niche").
 *    Sample-jittery — the SAME video read 178×→208× across two pulls — but that's FINE
 *    here: it only picks WHICH survivors to tear down, never shown as proof.
 *  - RECEIPT (durable, per-account): views ÷ follower_count, "vs followers". Stable
 *    pull-to-pull (followers don't wobble with the scrape window) → the number we SHOW.
 *    Computable only after a per-survivor profile scrape (§14: follower_count is not
 *    inline on a niche/search pull, and VideoData carries none).
 *
 * The LOCKED gate (§12) — `views ÷ followers ≥ 3×` — is applied on the RECEIPT metric,
 * so it only bites once real followers are known (post-scrape). When followers are
 * unavailable, the caller falls back to the cheap metric with an honest sample-based
 * label (never silently passing it off as the durable receipt).
 */

import { rankOutliers, type RankedOutlier } from "@/lib/discover/outlier-compute";
import type { VideoData } from "@/lib/scraping/types";

/** §12 LOCKED: an outlier is `views ÷ followers ≥ 3×` (applied on the durable receipt). */
export const MIN_OUTLIER_MULTIPLIER = 3;

/**
 * SELECTION ranking (cheap, jitter-OK): rank a niche pull by the shipped recency-decayed
 * result-set-median multiplier and take the top N candidates to profile-scrape + tear down.
 * This is NOT the receipt — see accountMultiplier for the durable number.
 */
export function selectCandidates(
  videos: VideoData[],
  topN: number,
  now: number = Date.now(),
): RankedOutlier[] {
  return rankOutliers(videos, "niche", now).slice(0, Math.max(0, topN));
}

/** The durable receipt metric. baselineLabel is stable + honest. */
export interface AccountMetric {
  multiplier: number;
  baselineLabel: "vs followers";
}

/**
 * Durable per-account receipt: views ÷ follower_count. Returns null when follower_count
 * is missing/zero (the survivor profile scrape failed or the account is brand-new) — the
 * caller then falls back to the cheap sample-based metric with an honest label.
 */
export function accountMultiplier(
  views: number,
  followerCount: number | null | undefined,
): AccountMetric | null {
  if (!followerCount || followerCount <= 0) return null;
  if (!Number.isFinite(views) || views < 0) return null;
  return { multiplier: views / followerCount, baselineLabel: "vs followers" };
}

/** §12 gate on the durable receipt: does this multiplier clear the ≥3× bar? */
export function passesOutlierGate(multiplier: number): boolean {
  return Number.isFinite(multiplier) && multiplier >= MIN_OUTLIER_MULTIPLIER;
}
