/**
 * GET /api/feed — Discover Feed Phase 2.1.
 *
 * The persistent Videos feed over scraped_videos. Two tabs:
 *   - watched  : creator_handle IN the user's tracked tiktok handles (tracked_accounts)
 *   - trending : the whole non-archived corpus (cron/webhook rows)
 * Filters (channels / keyword / outlier / views / engagement / posted-within / platform)
 * are plain WHEREs on the Phase 1.1 columns; sort + keyset pagination live in feed-query.
 *
 * Reads via the AUTHED client — scraped_videos is public-read for non-archived rows (RLS),
 * and the watched handles come from the user's RLS-scoped tracked_accounts.
 */
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listTrackedAccounts } from "@/lib/tracked-accounts/tracked-accounts-repo";
import {
  queryFeed,
  decodeCursor,
  DEFAULT_FEED_LIMIT,
  MAX_FEED_LIMIT,
  type FeedParams,
} from "@/lib/feed/feed-query";

const QuerySchema = z.object({
  tab: z.enum(["watched", "trending"]).default("watched"),
  sort: z.enum(["recent", "views", "outlier", "engagement"]).default("recent"),
  limit: z.coerce.number().int().min(1).max(MAX_FEED_LIMIT).default(DEFAULT_FEED_LIMIT),
  cursor: z.string().optional(),
  channels: z.string().optional(), // comma-separated handles
  q: z.string().max(200).optional(),
  minViews: z.coerce.number().min(0).optional(),
  minOutlier: z.coerce.number().min(0).optional(),
  minEngagement: z.coerce.number().min(0).optional(),
  postedWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
  platform: z.string().default("tiktok"),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const p = parsed.data;

  // ILIKE substring — strip the wildcards so user input is a literal contains, not a pattern.
  const q = p.q ? p.q.replace(/[%_]/g, "").trim() : "";
  const channels = p.channels
    ? p.channels
        .split(",")
        .map((h) => h.replace(/^@/, "").trim().toLowerCase())
        .filter(Boolean)
    : undefined;

  // Watched tab: resolve the user's tracked tiktok handles; short-circuit the empty case
  // so the page can show its "add channels" CTA instead of an ambiguous empty grid.
  let watchedHandles: string[] | null = null;
  if (p.tab === "watched") {
    const tracked = await listTrackedAccounts(supabase);
    watchedHandles = tracked.filter((t) => t.platform === "tiktok").map((t) => t.handle);
    if (watchedHandles.length === 0) {
      return Response.json({ tiles: [], total: 0, nextCursor: null, watchedEmpty: true });
    }
  }

  const params: FeedParams = {
    tab: p.tab,
    sort: p.sort,
    limit: p.limit,
    cursor: decodeCursor(p.cursor),
    filters: {
      channels,
      q: q || undefined,
      minViews: p.minViews,
      minOutlier: p.minOutlier,
      minEngagement: p.minEngagement,
      postedWithinDays: p.postedWithinDays,
      platform: p.platform,
    },
  };

  try {
    const page = await queryFeed(supabase, params, watchedHandles);
    return Response.json(page);
  } catch (error) {
    console.error("[feed] GET error:", error);
    return Response.json({ error: "Feed query failed" }, { status: 500 });
  }
}
