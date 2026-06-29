/**
 * GET /api/channels/search?q= — Discover Feed Phase 1.2.
 *
 * Search the SHARED competitor_profiles corpus (channels anyone has ingested) by
 * handle or display name, so the Channels "Search" tab can surface an existing channel
 * to one-click track without paying for a fresh scrape. Runs server-side with the
 * service client because competitor_profiles RLS only exposes profiles the user tracks
 * via user_competitors (see watchlist route) — channel profiles are public TikTok data.
 *
 * The query is hard-sanitized to an alphanumeric-ish charset before it's interpolated
 * into the PostgREST `.or(...ilike...)` filter, so a user can't inject filter syntax
 * (commas / parens) or ILIKE wildcards.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ChannelSearchResult {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  videoCount: number | null;
}

const MAX_RESULTS = 12;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Hard-restrict to letters/digits/space before interpolating into the PostgREST
    // `.or(...)` string: strips the filter separators ( , ( ) ), the `.` value-separator
    // (would mis-split column.op.value), and the ILIKE wildcards ( % _ ). Fuzzy by design —
    // type "khaby", not "khaby.lame"; the Add URL tab handles exact dotted handles.
    const q = (searchParams.get("q") ?? "").replace(/[^a-zA-Z0-9 ]/g, "").trim();
    if (q.length < 2) {
      return Response.json({ results: [] });
    }

    const service = createServiceClient();
    const like = `%${q}%`;
    const { data, error } = await service
      .from("competitor_profiles")
      .select("tiktok_handle, display_name, avatar_url, follower_count, video_count")
      .or(`tiktok_handle.ilike.${like},display_name.ilike.${like}`)
      .order("follower_count", { ascending: false, nullsFirst: false })
      .limit(MAX_RESULTS);

    if (error) {
      console.error("[channels/search] query error:", error.message);
      return Response.json({ error: "Search failed" }, { status: 500 });
    }

    const results: ChannelSearchResult[] = (data ?? []).map((p) => ({
      handle: p.tiktok_handle,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      followerCount: p.follower_count,
      videoCount: p.video_count,
    }));

    return Response.json({ results });
  } catch (error) {
    console.error("[channels/search] GET error:", error);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
