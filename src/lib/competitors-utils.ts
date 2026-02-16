/**
 * Utility functions for competitor data formatting and computation.
 *
 * Pure functions with no side effects -- safe for server and client use.
 */

/**
 * Format large numbers into compact display strings.
 *
 * @example
 * formatCount(null)       // "--"
 * formatCount(892)        // "892"
 * formatCount(45300)      // "45.3K"
 * formatCount(1200000)    // "1.2M"
 */
export function formatCount(count: number | null): string {
  if (count === null || count === undefined) return "--";

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }

  return count.toLocaleString();
}

/**
 * Compute week-over-week growth velocity from follower snapshots.
 *
 * Sorts snapshots by date descending, finds latest and a snapshot >= 6 days ago,
 * and computes percentage delta. Returns null if insufficient data.
 *
 * Thresholds: > 0.5% = up, < -0.5% = down, else flat.
 */
export function computeGrowthVelocity(
  snapshots: { follower_count: number; snapshot_date: string }[]
): { percentage: number; direction: "up" | "down" | "flat" } | null {
  if (snapshots.length < 2) return null;

  // Sort descending by date
  const sorted = [...snapshots].sort(
    (a, b) =>
      new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  );

  const latest = sorted[0]!;
  const latestDate = new Date(latest.snapshot_date);

  // Find a snapshot at least 6 days old
  const older = sorted.find((s) => {
    const diff = latestDate.getTime() - new Date(s.snapshot_date).getTime();
    return diff >= 6 * 24 * 60 * 60 * 1000;
  });

  if (!older || older.follower_count === 0) return null;

  const percentage =
    ((latest.follower_count - older.follower_count) / older.follower_count) *
    100;

  const rounded = Math.round(percentage * 10) / 10;

  let direction: "up" | "down" | "flat";
  if (rounded > 0.5) {
    direction = "up";
  } else if (rounded < -0.5) {
    direction = "down";
  } else {
    direction = "flat";
  }

  return { percentage: rounded, direction };
}

/**
 * Compute engagement rate from video metrics.
 *
 * Formula: sum(likes + comments + shares) / sum(views) * 100
 * Only considers videos with views > 0. Returns null if no valid videos.
 */
export function computeEngagementRate(
  videos: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
  }[]
): number | null {
  const validVideos = videos.filter((v) => v.views !== null && v.views > 0);

  if (validVideos.length === 0) return null;

  let totalEngagement = 0;
  let totalViews = 0;

  for (const video of validVideos) {
    totalEngagement +=
      (video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0);
    totalViews += video.views!;
  }

  if (totalViews === 0) return null;

  return Math.round((totalEngagement / totalViews) * 100 * 10) / 10;
}
