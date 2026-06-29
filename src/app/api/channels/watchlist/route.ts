/**
 * GET /api/channels/watchlist — Discover Feed Phase 1.2.
 *
 * The enriched Channels watchlist: the user's tracked_accounts (handles) joined with
 * the shared competitor_profiles store (avatar / followers / videos / freshness) plus
 * an aggregate view count from the channel's scraped_videos rows.
 *
 * Why a dedicated endpoint (not /api/tracked-accounts): tracked_accounts is the flat
 * handle list (consumed as-is by Library, P12); competitor_profiles RLS only exposes
 * profiles the user tracks via user_competitors (the Competitors feature), and channels
 * added through the user-agnostic ingest have NO such link. So the enrichment join runs
 * server-side with the service client, scoped to THIS user's tracked handles.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { listTrackedAccounts } from "@/lib/tracked-accounts/tracked-accounts-repo";

export interface ChannelWatchlistEntry {
  /** tracked_accounts.id — the key the Remove action deletes by. */
  id: string;
  handle: string;
  platform: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  videoCount: number | null;
  /** SUM(views) across the channel's scraped_videos rows we hold. */
  totalViews: number;
  lastScrapedAt: string | null;
  trackedAt: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RLS-scoped to the user (newest first). Channels ingest is TikTok-only today.
    const tracked = await listTrackedAccounts(supabase);
    const tiktok = tracked.filter((t) => t.platform === "tiktok");
    if (tiktok.length === 0) {
      return Response.json({ channels: [] });
    }

    const handles = tiktok.map((t) => t.handle);
    const service = createServiceClient();

    const [{ data: profiles }, { data: videos }] = await Promise.all([
      service
        .from("competitor_profiles")
        .select("tiktok_handle, display_name, avatar_url, follower_count, video_count, last_scraped_at")
        .in("tiktok_handle", handles),
      service
        .from("scraped_videos")
        .select("creator_handle, views")
        .in("creator_handle", handles),
    ]);

    const profileByHandle = new Map(
      (profiles ?? []).map((p) => [p.tiktok_handle, p]),
    );
    const viewsByHandle = new Map<string, number>();
    for (const v of videos ?? []) {
      if (!v.creator_handle) continue;
      viewsByHandle.set(
        v.creator_handle,
        (viewsByHandle.get(v.creator_handle) ?? 0) + (v.views ?? 0),
      );
    }

    const channels: ChannelWatchlistEntry[] = tiktok.map((t) => {
      const p = profileByHandle.get(t.handle);
      return {
        id: t.id,
        handle: t.handle,
        platform: t.platform,
        displayName: p?.display_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        followerCount: p?.follower_count ?? null,
        videoCount: p?.video_count ?? null,
        totalViews: viewsByHandle.get(t.handle) ?? 0,
        lastScrapedAt: p?.last_scraped_at ?? null,
        trackedAt: t.created_at,
      };
    });

    return Response.json({ channels });
  } catch (error) {
    console.error("[channels/watchlist] GET error:", error);
    return Response.json(
      { error: "Failed to load watchlist" },
      { status: 500 },
    );
  }
}
