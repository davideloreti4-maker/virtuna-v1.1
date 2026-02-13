import { createServiceClient } from "@/lib/supabase/service";
import {
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
  type PaginatedResponse,
} from "@/lib/pagination";
import type { Tables } from "@/types/database.types";

type Deal = Tables<"deals">;

/**
 * GET /api/deals?status=active&tier=starter&limit=12&cursor=xxx
 *
 * Returns filtered, paginated deal listings.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { cursor, limit } = parsePaginationParams(searchParams);
    const status = searchParams.get("status") ?? "active";
    const tier = searchParams.get("tier");

    const supabase = createServiceClient();

    let query = supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (tier) {
      query = query.eq("tier_required", tier);
    }

    // Apply cursor
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
        );
      }
    }

    const { data: deals, error } = await query;

    if (error) {
      console.error("[deals] Query error:", error);
      return Response.json({ error: "Failed to fetch deals" }, { status: 500 });
    }

    const hasMore = (deals?.length ?? 0) > limit;
    const items = (deals ?? []).slice(0, limit);

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.created_at!, lastItem.id)
        : null;

    const response: PaginatedResponse<Deal> = {
      data: items,
      next_cursor: nextCursor,
      has_more: hasMore,
    };

    return Response.json(response);
  } catch (error) {
    console.error("[deals] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
