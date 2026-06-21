/**
 * outlier-compute.ts — Phase 08, Plan 02, Task 2 (D-05 / D-06 / D-07 / D-14).
 *
 * Pure outlier-ranking arithmetic. NO Apify / Supabase / network imports — the only
 * input is a VideoData[] (already normalized at the scrape boundary, RESEARCH Pattern 2).
 *
 * Ranking model (RESEARCH §Code Examples, Pattern 3):
 *   - WINDOW_DAYS=90 (D-07): videos older than the trailing window are EXCLUDED. A
 *     2-year-old viral cannot dominate a "what's working now" pull.
 *   - baseline = median views of the in-window set. In profile mode this is the single
 *     channel's own median ("vs own"); in niche mode it is the result-set median
 *     ("vs niche") — same arithmetic, different honest label (D-05).
 *   - multiplier = views / baseline (the "{n}× vs own/niche" badge — measured data, NOT
 *     a SIM score, Pitfall 5).
 *   - rankKey = recencyDecay(age) × multiplier, half-life HALF_LIFE_DAYS over the window
 *     so a recent spike outranks a stale one of the same multiplier (D-07).
 *   - Sort: rankKey desc → saves/views desc → shares/views desc (D-06 value tiebreaks).
 */
import type { VideoData } from "@/lib/scraping/types";

export const WINDOW_DAYS = 90; // D-07 constant
export const HALF_LIFE_DAYS = 30; // Claude's discretion within the D-07 envelope

const MS_PER_DAY = 86_400_000;

export type OutlierMode = "profile" | "niche";

/** A ranked Discover tile: VideoData plus the measured outlier signal. */
export interface RankedOutlier extends VideoData {
  /** views / baseline — the "{n}× vs own/niche" badge value (measured, not a SIM score). */
  multiplier: number;
  /** Honest baseline label per mode (D-05): "vs own" | "vs niche". NEVER a bare number. */
  baselineLabel: "vs own" | "vs niche";
  /** Internal sort score = recencyDecay × multiplier (D-06 primary). */
  rankKey: number;
}

/** Median of a numeric list. Returns 0 for an empty list (callers guard divide-by-zero). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Rank Discover videos by recency-decayed outlier multiplier (D-05/06/07).
 *
 * @param videos VideoData from the apidojo scrape boundary (any actor — actor-agnostic).
 * @param mode   "profile" → "vs own" baseline; "niche" → "vs niche" baseline.
 * @param now    injectable clock (ms) for deterministic testing; defaults to Date.now().
 */
export function rankOutliers(
  videos: VideoData[],
  mode: OutlierMode,
  now: number = Date.now(),
): RankedOutlier[] {
  // D-07: exclude anything outside the trailing 90-day window.
  const recent = videos.filter(
    (v) => (now - v.postedAt.getTime()) / MS_PER_DAY <= WINDOW_DAYS,
  );

  // Pattern 3: one baseline for the in-window set. Profile pulls are a single channel,
  // so the result-set median IS that channel's own median; niche pulls span the niche.
  // Divide-by-zero guard: an all-zero / empty set falls back to 1.
  const baseline = median(recent.map((v) => v.views)) || 1;
  const baselineLabel: "vs own" | "vs niche" = mode === "profile" ? "vs own" : "vs niche";

  return recent
    .map((v) => {
      const ageDays = Math.max(0, (now - v.postedAt.getTime()) / MS_PER_DAY);
      const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS); // D-07 recency half-life
      const multiplier = v.views / baseline;
      return { ...v, multiplier, baselineLabel, rankKey: decay * multiplier };
    })
    .sort(
      (a, b) =>
        b.rankKey - a.rankKey || // D-06 primary
        b.saves / (b.views || 1) - a.saves / (a.views || 1) || // saves/views tiebreak
        b.shares / (b.views || 1) - a.shares / (a.views || 1), // shares/views tiebreak
    );
}
