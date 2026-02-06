// src/types/trending.ts

/**
 * Category slugs for trending video classification.
 *
 * - `"breaking-out"` -- New viral content gaining rapid traction
 * - `"trending-now"` -- Sustained viral content with broad reach
 * - `"rising-again"` -- Resurging content experiencing renewed interest
 */
export type TrendingCategory =
  | "breaking-out"
  | "trending-now"
  | "rising-again";

/** Human-readable labels for each trending category. */
export const CATEGORY_LABELS: Record<TrendingCategory, string> = {
  "breaking-out": "Breaking Out",
  "trending-now": "Trending Now",
  "rising-again": "Rising Again",
} as const;

/** Ordered list of valid tab slugs for the trending page. */
export const VALID_TABS = [
  "breaking-out",
  "trending-now",
  "rising-again",
] as const;

/** Union type derived from VALID_TABS -- identical to TrendingCategory but inferred from the runtime constant. */
export type ValidTab = (typeof VALID_TABS)[number];

/** Extended filter tab type that includes "saved" for bookmarked videos. */
export type FilterTab = TrendingCategory | "saved";

/** All filter tabs including saved. */
export const FILTER_TABS = [...VALID_TABS, "saved"] as const;

/**
 * A single trending video with full metadata.
 *
 * All numeric fields (views, likes, shares, velocity) are raw counts
 * or multipliers -- formatting is the UI layer's responsibility.
 */
export interface TrendingVideo {
  /** Unique identifier, format: `"vid_001"` */
  id: string;
  /** Video title as displayed on TikTok */
  title: string;
  /** Portrait thumbnail URL (400x500) */
  thumbnailUrl: string;
  /** Creator profile information */
  creator: {
    /** TikTok handle including `@` prefix */
    handle: string;
    /** Display name shown on profile */
    displayName: string;
    /** Square avatar URL (100x100) */
    avatarUrl: string;
  };
  /** Total view count */
  views: number;
  /** Total like count */
  likes: number;
  /** Total share count */
  shares: number;
  /** Publication date in ISO 8601 format */
  date: string;
  /** Trending category this video belongs to */
  category: TrendingCategory;
  /** Associated hashtags (including `#` prefix) */
  hashtags: string[];
  /** Full TikTok video URL */
  tiktokUrl: string;
  /** Views multiplier relative to creator's average (e.g. 12.5 = 12.5x normal) */
  velocity: number;
}

/** Aggregate stats for a single trending category. */
export interface CategoryStats {
  /** Number of videos in this category */
  count: number;
  /** Sum of all views across videos in this category */
  totalViews: number;
}

/** Aggregate statistics across all trending categories. */
export interface TrendingStats {
  /** Total number of trending videos */
  totalVideos: number;
  /** Sum of all views across all categories */
  totalViews: number;
  /** Per-category breakdown */
  byCategory: Record<TrendingCategory, CategoryStats>;
}
