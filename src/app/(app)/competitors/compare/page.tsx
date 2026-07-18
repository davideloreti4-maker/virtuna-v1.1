import { redirect } from "next/navigation";

/**
 * /competitors/compare — the competitor comparison page, orphaned by the MVP launch cut (2026-07-15).
 * Its only entry points sit inside the (now hidden) competitor surface, so it is already unreachable
 * through the UI; this route stayed live only via direct URL / stale bookmark (P3, ambient-room-v2).
 * Redirect to /home to close the leak and match the parent.
 *
 * The ComparisonClient + compare actions are LEFT IN PLACE (unreferenced) — restore this route from
 * git to bring the comparison back post-launch, exactly like /feed and /start.
 */
export default function CompetitorCompareRedirect() {
  redirect("/home");
}

/**
 * Kept as the type's original home: the (now-dead) ComparisonClient still imports it from here, and a
 * `git restore` of the full page brings back its producer. Type-only — zero runtime, no page render.
 */
export interface ComparisonData {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followers: number | null;
  likes: number | null;
  videos: number | null;
  engagementRate: number | null;
  growthVelocity: {
    percentage: number;
    direction: "up" | "down" | "flat";
  } | null;
  postingCadence: { postsPerWeek: number; postsPerMonth: number } | null;
  avgViews: number | null;
  snapshotTimeSeries: { date: string; followers: number }[];
  lastScrapedAt: string | null;
}
