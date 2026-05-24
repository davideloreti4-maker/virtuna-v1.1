export type FollowerTier = "nano" | "micro" | "mid" | "large" | "mega";

/**
 * Classify a creator into a follower-count tier.
 * Aligned with industry-standard influencer tiers (1k/10k/100k/1M cutoffs).
 *
 * Returns null when count is missing/zero — clockworks profile-scraper does
 * not always populate followers (RESEARCH §A.3); downstream callers handle
 * NULL gracefully.
 */
export function getFollowerTier(
  count: number | null | undefined
): FollowerTier | null {
  if (count === null || count === undefined || count <= 0) return null;
  if (count < 10_000) return "nano";
  if (count < 100_000) return "micro";
  if (count < 1_000_000) return "mid";
  if (count < 10_000_000) return "large";
  return "mega";
}
