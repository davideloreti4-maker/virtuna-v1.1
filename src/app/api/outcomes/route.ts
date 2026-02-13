import { createClient } from "@/lib/supabase/server";
import {
  decodeCursor,
  encodeCursor,
  parsePaginationParams,
} from "@/lib/pagination";
import { z } from "zod";

const OutcomeInputSchema = z.object({
  analysis_id: z.string().uuid(),
  actual_views: z.number().int().nonnegative().optional(),
  actual_likes: z.number().int().nonnegative().optional(),
  actual_shares: z.number().int().nonnegative().optional(),
  actual_engagement_rate: z.number().min(0).max(100).optional(),
  actual_score: z.number().min(0).max(100).optional(),
  platform: z.string().optional(),
  platform_post_url: z.string().url().optional(),
});

/**
 * POST /api/outcomes
 *
 * Submit an outcome report for a previous analysis (authenticated).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = OutcomeInputSchema.safeParse(body);

    if (!parseResult.success) {
      return Response.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Verify the analysis belongs to this user
    const { data: analysis, error: analysisError } = await supabase
      .from("analysis_results")
      .select("id, overall_score")
      .eq("id", input.analysis_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (analysisError || !analysis) {
      return Response.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // Calculate delta if both scores available
    const predictedScore = analysis.overall_score;
    const delta =
      predictedScore != null && input.actual_score != null
        ? input.actual_score - predictedScore
        : null;

    const { data: outcome, error: insertError } = await supabase
      .from("outcomes")
      .insert({
        analysis_id: input.analysis_id,
        user_id: user.id,
        actual_views: input.actual_views ?? null,
        actual_likes: input.actual_likes ?? null,
        actual_shares: input.actual_shares ?? null,
        actual_engagement_rate: input.actual_engagement_rate ?? null,
        predicted_score: predictedScore,
        actual_score: input.actual_score ?? null,
        delta,
        platform: input.platform ?? null,
        platform_post_url: input.platform_post_url ?? null,
        reported_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // Unique constraint on analysis_id
      if (insertError.code === "23505") {
        return Response.json(
          { error: "Outcome already submitted for this analysis" },
          { status: 409 }
        );
      }
      console.error("[outcomes] Insert error:", insertError);
      return Response.json(
        { error: "Failed to save outcome" },
        { status: 500 }
      );
    }

    return Response.json(outcome, { status: 201 });
  } catch (error) {
    console.error("[outcomes] POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/outcomes?limit=12&cursor=xxx
 *
 * Returns the authenticated user's outcome history.
 */
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
    const { cursor, limit } = parsePaginationParams(searchParams);

    let query = supabase
      .from("outcomes")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
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

    const { data: outcomes, error } = await query;

    if (error) {
      console.error("[outcomes] Query error:", error);
      return Response.json(
        { error: "Failed to fetch outcomes" },
        { status: 500 }
      );
    }

    const hasMore = (outcomes?.length ?? 0) > limit;
    const items = (outcomes ?? []).slice(0, limit);

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
    console.error("[outcomes] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
