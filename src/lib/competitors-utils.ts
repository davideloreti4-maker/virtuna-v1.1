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

// --- Video metrics interface ---

export interface VideoMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

/**
 * Compute engagement rate from video metrics.
 *
 * Formula: sum(likes + comments + shares) / sum(views) * 100
 * Only considers videos with views > 0. Returns null if no valid videos.
 */
export function computeEngagementRate(videos: VideoMetrics[]): number | null {
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

// --- Video-level engagement ---

/**
 * Compute engagement rate for a single video: (likes + comments + shares) / views * 100.
 * Returns null if views <= 0 or null.
 */
export function computeVideoEngagementRate(video: VideoMetrics): number | null {
  if (!video.views || video.views <= 0) return null;
  const engagement =
    (video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0);
  return Math.round((engagement / video.views) * 100 * 10) / 10;
}

/**
 * Compute average views across videos (defaults to last 30).
 * Returns null if no valid videos.
 */
export function computeAverageViews(
  videos: { views: number | null }[],
  limit = 30
): number | null {
  const recent = videos.slice(0, limit);
  const valid = recent.filter((v) => v.views !== null && v.views > 0);
  if (valid.length === 0) return null;
  const total = valid.reduce((sum, v) => sum + v.views!, 0);
  return Math.round(total / valid.length);
}

/**
 * Compute posting frequency: posts per week and per month.
 * Returns null if fewer than 2 dated videos.
 */
export function computePostingCadence(
  videos: { posted_at: string | null }[]
): { postsPerWeek: number; postsPerMonth: number } | null {
  const dated = videos.filter((v) => v.posted_at !== null);
  if (dated.length < 2) return null;
  const sorted = [...dated].sort(
    (a, b) =>
      new Date(a.posted_at!).getTime() - new Date(b.posted_at!).getTime()
  );
  const firstDate = new Date(sorted[0]!.posted_at!);
  const lastDate = new Date(sorted[sorted.length - 1]!.posted_at!);
  const spanMs = lastDate.getTime() - firstDate.getTime();
  const spanWeeks = Math.max(spanMs / (7 * 24 * 60 * 60 * 1000), 1);
  const spanMonths = Math.max(spanWeeks / 4.33, 1);
  return {
    postsPerWeek: Math.round((dated.length / spanWeeks) * 10) / 10,
    postsPerMonth: Math.round((dated.length / spanMonths) * 10) / 10,
  };
}

/**
 * Extract and rank hashtags by frequency from video hashtags arrays.
 * Uses hashtags column as source of truth (not caption parsing).
 */
export function computeHashtagFrequency(
  videos: { hashtags: string[] | null }[]
): { tag: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const video of videos) {
    if (!video.hashtags) continue;
    for (const tag of video.hashtags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized) {
        freq[normalized] = (freq[normalized] ?? 0) + 1;
      }
    }
  }
  return Object.entries(freq)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Aggregate posting times into a 7x24 grid (Mon=0..Sun=6 x 0-23 hours).
 * Uses UTC times.
 */
export function computePostingTimeGrid(
  videos: { posted_at: string | null }[]
): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0) as number[]
  );
  for (const video of videos) {
    if (!video.posted_at) continue;
    const date = new Date(video.posted_at);
    const day = date.getUTCDay(); // 0=Sun
    const hour = date.getUTCHours();
    const adjustedDay = day === 0 ? 6 : day - 1; // Mon=0..Sun=6
    grid[adjustedDay]![hour]!++;
  }
  return grid;
}

/**
 * Bucket videos by duration into format categories per CONT-06.
 */
export function computeDurationBreakdown(
  videos: { duration_seconds: number | null }[]
): { label: string; count: number; percentage: number }[] {
  const buckets = [
    { label: "< 15s", min: 0, max: 15, count: 0 },
    { label: "15-60s", min: 15, max: 60, count: 0 },
    { label: "1-3 min", min: 60, max: 180, count: 0 },
    { label: "3+ min", min: 180, max: Infinity, count: 0 },
  ];
  const validVideos = videos.filter(
    (v) => v.duration_seconds !== null && v.duration_seconds > 0
  );
  for (const video of validVideos) {
    const d = video.duration_seconds!;
    const bucket = buckets.find((b) => d >= b.min && d < b.max);
    if (bucket) bucket.count++;
  }
  const total = validVideos.length || 1;
  return buckets.map(({ label, count }) => ({
    label,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

// --- Stale data utilities ---

/**
 * Convert an ISO date string to a human-readable relative time string.
 *
 * @example
 * formatRelativeTime(null)                    // "Never"
 * formatRelativeTime("2026-02-17T09:00:00Z")  // "Just now" (< 1h)
 * formatRelativeTime("2026-02-17T04:00:00Z")  // "5h ago"
 * formatRelativeTime("2026-02-14T09:00:00Z")  // "3d ago"
 * formatRelativeTime("2026-02-03T09:00:00Z")  // "2w ago"
 */
export function formatRelativeTime(isoDate: string | null): string {
  if (isoDate === null) return "Never";

  const elapsed = Date.now() - new Date(isoDate).getTime();

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;

  if (elapsed < HOUR) return "Just now";
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  return `${Math.floor(elapsed / WEEK)}w ago`;
}

/**
 * Returns true when data is considered stale (never scraped or older than 48 hours).
 */
export function isStale(isoDate: string | null): boolean {
  if (isoDate === null) return true;
  const elapsed = Date.now() - new Date(isoDate).getTime();
  return elapsed > 48 * 60 * 60 * 1000;
}
