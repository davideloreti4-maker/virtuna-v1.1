import { createClient } from "@/lib/supabase/server";
import {
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
  type PaginatedResponse,
} from "@/lib/pagination";
import type { Tables } from "@/types/database.types";

type ScrapedVideo = Tables<"scraped_videos">;

/**
 * GET /api/trending?category=trending-now&limit=12&cursor=xxx
 *
 * Returns paginated trending videos with cursor-based pagination.
 * Categories map to trend_phase values or special filters.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { cursor, limit } = parsePaginationParams(searchParams);
    const category = searchParams.get("category") ?? "trending-now";

    const supabase = await createClient();

    // Build query — fetch limit + 1 to detect has_more
    let query = supabase
      .from("scraped_videos")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    // Apply category filter
    if (category === "trending-now") {
      // Videos with sounds that are currently emerging or rising
      const { data: trendingSounds } = await supabase
        .from("trending_sounds")
        .select("sound_name")
        .in("trend_phase", ["emerging", "rising"])
        .order("velocity_score", { ascending: false })
        .limit(50);

      if (trendingSounds && trendingSounds.length > 0) {
        const soundNames = trendingSounds.map((s) => s.sound_name);
        query = query.in("sound_name", soundNames);
      }
    } else if (category !== "all") {
      query = query.eq("category", category);
    }

    // Apply cursor for pagination
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
        );
      }
    }

    const { data: videos, error } = await query;

    if (error) {
      console.error("[trending] Query error:", error);
      return Response.json({ error: "Failed to fetch videos" }, { status: 500 });
    }

    const hasMore = (videos?.length ?? 0) > limit;
    const items = (videos ?? []).slice(0, limit);

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.created_at!, lastItem.id)
        : null;

    const response: PaginatedResponse<ScrapedVideo> = {
      data: items,
      next_cursor: nextCursor,
      has_more: hasMore,
    };

    return Response.json(response);
  } catch (error) {
    console.error("[trending] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
