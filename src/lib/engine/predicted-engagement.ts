import type { PredictedEngagement, BehavioralPredictions } from "@/lib/engine/types";

/**
 * Client-safe derivation of TikTok-style engagement counts from an overall
 * score and behavioral predictions. Mirrors `computePredictedEngagement` in
 * `aggregator.ts` — extracted here because the aggregator pulls in server-only
 * dependencies that can't be imported into client components.
 *
 * Used by the Input node on /analyze/[id] to surface the same metrics overlay
 * the legacy result card showed when permalink replay loads a row whose
 * `predicted_engagement` was never persisted.
 */
export function derivePredictedEngagement(
  overallScore: number,
  behavioral: Pick<BehavioralPredictions, "share_pct" | "comment_pct" | "save_pct" | "completion_pct">,
): PredictedEngagement {
  const jitter = (seed: number) => {
    const x = Math.sin(seed * 12.9898 + overallScore * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const scoreNorm = overallScore / 100;
  const baseViews = Math.round(
    5000 + (scoreNorm ** 2.2) * 450000 * (0.8 + jitter(1) * 0.4),
  );

  const likeRate = 0.03 + scoreNorm * 0.09 + jitter(2) * 0.02;
  const likes = Math.round(baseViews * likeRate);

  const commentRate = Math.max(0.005, (behavioral.comment_pct / 100) * (0.6 + jitter(3) * 0.3));
  const comments = Math.round(baseViews * commentRate);

  const shareRate = Math.max(0.002, (behavioral.share_pct / 100) * (0.5 + jitter(4) * 0.3));
  const shares = Math.round(baseViews * shareRate);

  const saveRate = Math.max(0.005, (behavioral.save_pct / 100) * (0.7 + jitter(5) * 0.3));
  const saves = Math.round(baseViews * saveRate);

  return { likes, comments, shares, saves, views: baseViews };
}
