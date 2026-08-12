/**
 * watchlist-reads.ts — the Discover hub's Watchlist read: ONE list of tracked sources.
 *
 * Channels and Competitors were the same idea stored twice — `tracked_accounts` vs
 * `user_competitors` → `competitor_profiles` — and they FORK on the video store (the
 * channel path writes `scraped_videos` with a computed multiplier, the competitor path
 * writes `competitor_videos` without one). This module merges the two lists for display;
 * it does not touch the underlying tables.
 *
 * Merge rule: a tracked handle folds into a competitor profile when the normalized handle
 * matches the profile's `tiktok_handle` OR its `display_name` — that is exactly the
 * `chrisbumstead` (tracked) / `cbum` "Chris Bumstead" (profile) duplicate, without a
 * hardcoded alias table.
 *
 * Honesty: a profile whose scrape FAILED with nothing salvageable (no follower count) is
 * returned `held: true` — the UI shows it as awaiting a clean read, never as
 * `elmakbtn915 · 0 followers` junk.
 *
 * ⚠️ The enrichment join has to run on the SERVICE client, and that is not an optimization.
 * `competitor_profiles` RLS exposes only profiles the user tracks through `user_competitors`
 * (the Competitors feature); a creator added through the user-agnostic CHANNEL ingest writes
 * a profile row with no such link, so the user cannot read the avatar and follower count that
 * their own add just captured — @zachking and @garyvee rendered as bare letter-avatars until
 * this was fixed. `/api/channels/watchlist` hit the same wall and solved it the same way;
 * this mirrors it deliberately rather than inventing a second shape.
 *
 * Scoping is explicit and narrow: the query asks only for profiles matching THIS user's
 * tracked handles or their own competitor ids. Ownership reads still come from the caller's
 * RLS-scoped client — the service client only enriches rows the user already owns.
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface WatchlistSource {
  /** Stable key: competitor profile id when merged, else the tracked handle. */
  key: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  followerCount: number | null;
  /** Measured outliers held for this source (`scraped_videos` rows with a multiplier). */
  outlierCount: number;
  bestMultiplier: number | null;
  /** Recent posts held (`competitor_videos` rows). */
  videosHeld: number;
  newestPostAt: string | null;
  /** The tracked handle that folded into this profile row, when the two spellings differ. */
  mergedFrom: string | null;
  /** Failed scrape with nothing salvageable — held back until a clean read. */
  held: boolean;
  /** Set when a competitor profile backs this row — the /competitors/[handle] deep link. */
  profileHandle: string | null;
}

export interface LatestSourcePost {
  id: string;
  handle: string;
  caption: string;
  coverUrl: string;
  views: number;
  postedAt: string | null;
}

export interface WatchlistData {
  sources: WatchlistSource[];
  latest: LatestSourcePost[];
}

/** Lowercased alphanumerics only — `khaby.lame` → `khabylame`, `Chris Bumstead` → `chrisbumstead`. */
const normalize = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

interface ProfileRow {
  id: string;
  tiktok_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number | null;
  scrape_status: string | null;
}

export async function getWatchlistData(supabase: ServerClient): Promise<WatchlistData> {
  // Ownership: both reads are RLS-scoped to the caller.
  const [trackedRes, competitorsRes] = await Promise.all([
    supabase.from("tracked_accounts").select("handle, platform"),
    supabase.from("user_competitors").select("competitor_id"),
  ]);

  const tracked = (trackedRes.data ?? []) as { handle: string; platform: string }[];
  const competitorIds = (competitorsRes.data ?? []).map((r) => r.competitor_id as string);
  const trackedHandles = tracked.map((t) => t.handle);

  // Enrichment: profiles the user owns by either door, and nothing else.
  const service = createServiceClient();
  const profileFilters = [
    trackedHandles.length > 0
      ? `tiktok_handle.in.(${trackedHandles.map((h) => `"${h}"`).join(",")})`
      : null,
    competitorIds.length > 0 ? `id.in.(${competitorIds.join(",")})` : null,
  ].filter(Boolean);

  // A creator tracked as `chrisbumstead` whose profile is stored as `cbum` still resolves:
  // that profile arrives through the competitor-id half of this filter, and the merge below
  // matches it on the normalized display_name. Only the two ownership keys are queried —
  // there is no name search across profiles the user does not own.
  let profiles: ProfileRow[] = [];
  if (profileFilters.length > 0) {
    const { data } = await service
      .from("competitor_profiles")
      .select("id, tiktok_handle, display_name, avatar_url, follower_count, scrape_status")
      .or(profileFilters.join(","));
    profiles = (data ?? []) as ProfileRow[];
  }

  // Measured outliers per tracked handle (the channel path's videos).
  const outlierAgg = new Map<string, { n: number; best: number }>();
  if (trackedHandles.length > 0) {
    const { data: outlierRows } = await supabase
      .from("scraped_videos")
      .select("creator_handle, outlier_multiplier")
      .in("creator_handle", trackedHandles)
      .not("outlier_multiplier", "is", null);
    for (const row of outlierRows ?? []) {
      const key = normalize(row.creator_handle);
      const m = Number(row.outlier_multiplier) || 0;
      const agg = outlierAgg.get(key) ?? { n: 0, best: 0 };
      agg.n += 1;
      if (m > agg.best) agg.best = m;
      outlierAgg.set(key, agg);
    }
  }

  // Recent posts per competitor profile + the latest strip (the competitor path's videos).
  const profileIds = profiles.map((p) => p.id);
  const videoAgg = new Map<string, { n: number; newest: string | null }>();
  const latest: LatestSourcePost[] = [];
  if (profileIds.length > 0) {
    // Service client for the same reason as the profiles above: `competitor_videos` is
    // RLS-scoped through `user_competitors`, so a channel-ingested creator's posts are
    // invisible to the user who added them. `profileIds` is already the owned set.
    const { data: videoRows } = await service
      .from("competitor_videos")
      .select("id, competitor_id, caption, cover_url, views, posted_at")
      .in("competitor_id", profileIds)
      .order("posted_at", { ascending: false })
      .limit(120);
    const handleById = new Map(profiles.map((p) => [p.id, p.tiktok_handle]));
    const perSource = new Map<string, number>();
    for (const v of videoRows ?? []) {
      const agg = videoAgg.get(v.competitor_id) ?? { n: 0, newest: null };
      agg.n += 1;
      if (!agg.newest || (v.posted_at && v.posted_at > agg.newest)) agg.newest = v.posted_at;
      videoAgg.set(v.competitor_id, agg);
      // Strip: newest first, cover required, max 2 per source so one prolific account
      // doesn't take the whole shelf.
      const handle = handleById.get(v.competitor_id);
      const taken = perSource.get(v.competitor_id) ?? 0;
      if (handle && v.cover_url && taken < 2 && latest.length < 10) {
        perSource.set(v.competitor_id, taken + 1);
        latest.push({
          id: v.id,
          handle,
          caption: (v.caption ?? "Untitled").slice(0, 80),
          coverUrl: v.cover_url,
          views: v.views ?? 0,
          postedAt: v.posted_at,
        });
      }
    }
  }

  // ── Merge: competitor profiles first, tracked handles fold in or append ────
  const sources: WatchlistSource[] = [];
  const claimed = new Set<string>();

  for (const p of profiles) {
    const held = p.scrape_status === "failed" && !p.follower_count;
    const byHandle = normalize(p.tiktok_handle);
    const byName = normalize(p.display_name);
    const match = tracked.find((t) => {
      const n = normalize(t.handle);
      return n === byHandle || (byName.length > 0 && n === byName);
    });
    if (match) claimed.add(normalize(match.handle));
    const outliers = outlierAgg.get(byHandle) ?? (match ? outlierAgg.get(normalize(match.handle)) : undefined);
    const videos = videoAgg.get(p.id);
    sources.push({
      key: p.id,
      handle: p.tiktok_handle,
      // A junk display_name from a failed scrape must not label the row.
      name: held ? p.tiktok_handle : p.display_name || p.tiktok_handle,
      avatarUrl: held ? null : p.avatar_url,
      followerCount: p.follower_count || null,
      outlierCount: outliers?.n ?? 0,
      bestMultiplier: outliers?.best || null,
      videosHeld: videos?.n ?? 0,
      newestPostAt: videos?.newest ?? null,
      mergedFrom:
        match && normalize(match.handle) !== byHandle ? match.handle : null,
      held,
      profileHandle: p.tiktok_handle,
    });
  }

  for (const t of tracked) {
    const key = normalize(t.handle);
    if (claimed.has(key)) continue;
    const outliers = outlierAgg.get(key);
    sources.push({
      key: t.handle,
      handle: t.handle,
      name: t.handle,
      avatarUrl: null,
      followerCount: null,
      outlierCount: outliers?.n ?? 0,
      bestMultiplier: outliers?.best || null,
      videosHeld: 0,
      newestPostAt: null,
      mergedFrom: null,
      held: false,
      profileHandle: null,
    });
  }

  // Held rows sink; the rest order by measured signal, then by recent material.
  sources.sort(
    (a, b) =>
      Number(a.held) - Number(b.held) ||
      b.outlierCount - a.outlierCount ||
      b.videosHeld - a.videosHeld,
  );

  return { sources, latest };
}
