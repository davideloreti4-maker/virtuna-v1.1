/**
 * feed-query.ts — Discover Feed Phase 2.1.
 *
 * The query layer behind GET /api/feed: build a filtered, sorted, keyset-paginated
 * read over scraped_videos and map rows to OutlierTile-compatible tiles.
 *
 *  - tab 'watched'  → creator_handle IN the user's tracked tiktok handles
 *  - tab 'trending' → the whole non-archived corpus
 *  - sort recent|views|outlier|engagement → posted_at|views|outlier_multiplier|engagement_rate desc
 *  - filters become plain WHEREs on the columns Phase 1.1 stores (Architecture decision 2)
 *
 * Keyset (not offset): every sort filters its column NOT NULL and pages on a
 * (sortValue, id) cursor, so a feed that grows mid-scroll never double-shows or skips.
 * The cursor is validated on decode (numeric/ISO value + UUID id) before it touches the
 * PostgREST `.or()` filter string — the one place raw values are interpolated.
 *
 * Tiles carry MEASURED signals only (multiplier / engagement) — never a SIM score.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedTab = "watched" | "trending";
export type FeedSort = "recent" | "views" | "outlier" | "engagement";

export const FEED_SORT_COLUMN: Record<FeedSort, string> = {
  recent: "posted_at",
  views: "views",
  outlier: "outlier_multiplier",
  engagement: "engagement_rate",
};

export const DEFAULT_FEED_LIMIT = 24;
export const MAX_FEED_LIMIT = 48;

export interface FeedFilters {
  /** creator_handle IN — explicit channel narrowing (intersects with the watched set). */
  channels?: string[];
  /** description ILIKE substring (wildcards already stripped by the route). */
  q?: string;
  minOutlier?: number;
  minViews?: number;
  minEngagement?: number;
  postedWithinDays?: number;
  platform: string;
}

export interface FeedParams {
  tab: FeedTab;
  sort: FeedSort;
  limit: number;
  cursor: FeedCursor | null;
  filters: FeedFilters;
}

export interface FeedCursor {
  v: number | string;
  id: string;
}

/** OutlierTile-compatible tile (mirrors OutlierTileData; saves omitted at the scrape boundary). */
export interface FeedTile {
  platformVideoId: string;
  /** Source platform ("tiktok" | "instagram" | "youtube") — drives the card's platform badge. */
  platform: string;
  videoUrl: string;
  caption: string;
  coverUrl?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  durationSeconds: number;
  postedAt: string;
  multiplier: number;
  baselineLabel: "vs own" | "vs niche";
  source: string;
  trackable: boolean;
  trackHandle: string;
}

export interface FeedPage {
  tiles: FeedTile[];
  total: number;
  nextCursor: string | null;
}

/** Only the columns the feed reads — cast target for the select(). */
interface FeedRow {
  id: string;
  platform: string | null;
  platform_video_id: string;
  video_url: string | null;
  description: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  duration_seconds: number | null;
  posted_at: string | null;
  outlier_multiplier: number | null;
  baseline_label: string | null;
  engagement_rate: number | null;
  creator_handle: string | null;
  primary_niche: string | null;
  metadata: unknown;
}

const SELECT_COLUMNS =
  "id, platform, platform_video_id, video_url, description, views, likes, comments, shares, duration_seconds, posted_at, outlier_multiplier, baseline_label, engagement_rate, creator_handle, primary_niche, metadata";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// base64url JSON. encode/decode are symmetric; decode HARD-validates before the value is
// ever interpolated into the `.or()` keyset filter (id must be a UUID; v a finite number or
// a timestamp-charset string).
export function encodeCursor(c: FeedCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): FeedCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const { v, id } = parsed as { v: unknown; id: unknown };
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;
    if (typeof v === "number") return Number.isFinite(v) ? { v, id } : null;
    if (typeof v === "string") return /^[0-9T:.+\- Z]+$/.test(v) ? { v, id } : null;
    return null;
  } catch {
    return null;
  }
}

/** The cursor sort value for a row, by sort key. */
function sortValueOf(row: FeedRow, sort: FeedSort): number | string {
  switch (sort) {
    case "recent":
      return row.posted_at ?? "";
    case "views":
      return row.views ?? 0;
    case "outlier":
      return row.outlier_multiplier ?? 0;
    case "engagement":
      return row.engagement_rate ?? 0;
  }
}

function toTile(row: FeedRow, tab: FeedTab): FeedTile {
  const handle = row.creator_handle ?? "";
  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<
    string,
    unknown
  >;
  const coverUrl = typeof meta.cover_url === "string" ? meta.cover_url : undefined;
  const baselineLabel: "vs own" | "vs niche" =
    row.baseline_label === "vs own" || row.baseline_label === "vs niche"
      ? row.baseline_label
      : tab === "watched"
        ? "vs own"
        : "vs niche";
  const source =
    tab === "watched"
      ? handle
        ? `@${handle}`
        : "Watched"
      : (row.primary_niche ?? "Trending");

  return {
    platformVideoId: row.platform_video_id,
    platform: row.platform ?? "tiktok",
    videoUrl: row.video_url ?? "",
    caption: row.description ?? "",
    coverUrl,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    shares: row.shares ?? 0,
    saves: 0, // scraped_videos doesn't capture saves
    durationSeconds: row.duration_seconds ?? 0,
    postedAt: row.posted_at ?? "",
    multiplier: row.outlier_multiplier ?? 0,
    baselineLabel,
    source,
    trackable: Boolean(handle),
    trackHandle: handle,
  };
}

/**
 * Run the feed query. `watchedHandles` is the user's tracked tiktok handles for the
 * watched tab (the route resolves it + short-circuits the empty case), or null for trending.
 */
export async function queryFeed(
  supabase: SupabaseClient,
  params: FeedParams,
  watchedHandles: string[] | null,
): Promise<FeedPage> {
  const sortCol = FEED_SORT_COLUMN[params.sort];
  const { filters } = params;

  let q = supabase
    .from("scraped_videos")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("archived_at", null)
    .eq("platform", filters.platform)
    // every sort pages on a non-null column → clean keyset + no NULL-ordering surprises.
    .not(sortCol, "is", null);

  if (params.tab === "watched") {
    q = q.in("creator_handle", watchedHandles ?? []);
  }
  if (filters.channels && filters.channels.length > 0) {
    q = q.in("creator_handle", filters.channels);
  }
  if (filters.q) q = q.ilike("description", `%${filters.q}%`);
  if (filters.minViews != null) q = q.gte("views", filters.minViews);
  if (filters.minOutlier != null) q = q.gte("outlier_multiplier", filters.minOutlier);
  if (filters.minEngagement != null) q = q.gte("engagement_rate", filters.minEngagement);
  if (filters.postedWithinDays != null) {
    const cutoff = new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString();
    q = q.gte("posted_at", cutoff);
  }

  // keyset: (sortCol, id) strictly less than the cursor, in DESC order.
  if (params.cursor) {
    const vLit = String(params.cursor.v);
    q = q.or(`${sortCol}.lt.${vLit},and(${sortCol}.eq.${vLit},id.lt.${params.cursor.id})`);
  }

  q = q
    .order(sortCol, { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`feed query failed: ${error.message}`);

  const rows = (data ?? []) as unknown as FeedRow[];
  const hasMore = rows.length > params.limit;
  const pageRows = hasMore ? rows.slice(0, params.limit) : rows;

  const tiles = pageRows.map((r) => toTile(r, params.tab));
  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1]!;
    nextCursor = encodeCursor({ v: sortValueOf(last, params.sort), id: last.id });
  }

  return { tiles, total: count ?? tiles.length, nextCursor };
}
