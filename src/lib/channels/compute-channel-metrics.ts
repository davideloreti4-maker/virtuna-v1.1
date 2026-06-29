/**
 * compute-channel-metrics.ts — Discover Feed Phase 1.1.
 *
 * Pure outlier/engagement arithmetic for the per-channel ingest path. NO Apify /
 * Supabase / network imports — input is a VideoData[] from the scrape boundary,
 * output is the measured signals stored on each scraped_videos row
 * (outlier_multiplier / baseline_label / engagement_rate, Architecture decision 2).
 *
 * Honesty (Pitfall 5, mirrors outlier-compute): every number here is MEASURED
 * engagement arithmetic, NEVER a SIM score.
 *
 *   baseline           = median(views over the bundle) || 1   (the channel's OWN median)
 *   outlierMultiplier  = views / baseline                      (the "{n}× vs own" badge)
 *   engagementRate     = (likes + comments + shares) / views   (0 when views = 0)
 *   baselineLabel      = 'vs own'   (a single-channel ingest is always its own baseline)
 *
 * Unlike rankOutliers (Discover), this does NOT 90-day-window-filter: the profile
 * bundle is already "latest N (pinned excluded)", and the feed does recency filtering
 * at query time (posted_at), so EVERY stored row earns a multiplier — including a
 * dormant channel's older posts.
 */
import { median } from "@/lib/discover/outlier-compute";
import type { VideoData } from "@/lib/scraping/types";

/** Per-channel ingest always measures against the channel's OWN median (Architecture decision 2). */
export const CHANNEL_BASELINE_LABEL = "vs own" as const;

/** The measured signals computed per video at ingest. */
export interface ChannelVideoMetrics {
  /** views / channel-median-views — the "{n}× vs own" badge value (measured, not a SIM score). */
  outlierMultiplier: number;
  /** (likes + comments + shares) / views, in [0, ~]. 0 when views = 0 (no divide-by-zero). */
  engagementRate: number;
}

/**
 * Compute per-video outlier + engagement signals for a channel's scraped bundle.
 *
 * @param videos VideoData from scrapeProfileBundle (already pinned-excluded, latest-first).
 * @returns the shared `baseline` (channel median views) + a `metrics` array 1:1 with `videos`.
 */
export function computeChannelMetrics(videos: VideoData[]): {
  baseline: number;
  metrics: ChannelVideoMetrics[];
} {
  // Channel's own median views — the honest "vs own" baseline. Divide-by-zero guard:
  // an all-zero / empty set falls back to 1 (mirrors rankOutliers' `|| 1`).
  const baseline = median(videos.map((v) => v.views)) || 1;

  const metrics = videos.map((v) => ({
    outlierMultiplier: v.views / baseline,
    engagementRate: v.views > 0 ? (v.likes + v.comments + v.shares) / v.views : 0,
  }));

  return { baseline, metrics };
}
