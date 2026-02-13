import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analysis/history
 *
 * Returns the authenticated user's analysis results from the analysis_results
 * table (not outcomes). Soft-deleted rows are excluded.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[analysis/history] Query error:", error);
      return Response.json(
        { error: "Failed to fetch analysis history" },
        { status: 500 }
      );
    }

    return Response.json(data ?? []);
  } catch (error) {
    console.error("[analysis/history] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
