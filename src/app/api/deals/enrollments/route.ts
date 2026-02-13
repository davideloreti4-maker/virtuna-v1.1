import { createClient } from "@/lib/supabase/server";
import {
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
} from "@/lib/pagination";

/**
 * GET /api/deals/enrollments?limit=12&cursor=xxx
 *
 * Returns the authenticated user's deal enrollments.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { cursor, limit } = parsePaginationParams(searchParams);

    let query = supabase
      .from("deal_enrollments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        query = query.or(
          `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`
        );
      }
    }

    const { data: enrollments, error } = await query;

    if (error) {
      console.error("[deals/enrollments] Query error:", error);
      return Response.json(
        { error: "Failed to fetch enrollments" },
        { status: 500 }
      );
    }

    const hasMore = (enrollments?.length ?? 0) > limit;
    const items = (enrollments ?? []).slice(0, limit);

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor(lastItem.created_at!, lastItem.id)
        : null;

    return Response.json({
      data: items,
      next_cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error) {
    console.error("[deals/enrollments] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
