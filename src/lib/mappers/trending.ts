import type { Tables } from "@/types/database.types";
import type { TrendingVideo, TrendingCategory } from "@/types/trending";

const VALID_CATEGORIES: TrendingCategory[] = [
  "breaking-out",
  "trending-now",
  "rising-again",
];

/**
 * Maps a scraped_videos DB row (snake_case) to TrendingVideo UI type (camelCase).
 *
 * Null DB values are given safe fallbacks so the UI never receives undefined
 * for required fields.
 */
export function mapScrapedVideoToTrendingVideo(
  row: Tables<"scraped_videos">
): TrendingVideo {
  const category: TrendingCategory = VALID_CATEGORIES.includes(
    row.category as TrendingCategory
  )
    ? (row.category as TrendingCategory)
    : "trending-now";

  return {
    id: row.id,
    title: row.description ?? "Untitled",
    thumbnailUrl: `https://picsum.photos/seed/${row.platform_video_id}/400/500`,
    creator: {
      handle: row.author
        ? `@${row.author.replace(/^@/, "")}`
        : "@unknown",
      displayName: row.author ?? "Unknown Creator",
      avatarUrl: `https://picsum.photos/seed/${row.author ?? "default"}/100/100`,
    },
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    shares: row.shares ?? 0,
    date: row.created_at ?? new Date().toISOString(),
    category,
    hashtags: row.hashtags ?? [],
    tiktokUrl: row.video_url ?? "",
    // TODO: Derive velocity from historical view data when available
    velocity: 1.0,
  };
}
