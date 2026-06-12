import { createClient } from "@/lib/supabase/server";
import { fromPersistedRow } from "@/lib/reading/from-persisted-row";

/**
 * GET /api/analysis/:id
 *
 * Returns a single analysis result by ID for the authenticated user.
 *
 * Thin caller (02-03 / D-11): the ownership-scoped row is fetched here, then
 * normalized by the PURE deterministic `fromPersistedRow`. The former inline reload
 * shims (numeric coercion, the heatmap synth, the optimal_post_window recompute) moved
 * into that module — the non-deterministic ones (Math.random persona ids, time/DB
 * recompute) were DROPPED so live ≡ replay (the DATA-02 precondition).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return Response.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    // ?summary branch — minimal parent summary for the "remixed from" chip (D-10).
    // Returns ONLY id + caption + created_at (never the full row).
    // Runs AFTER the user_id-scoped SELECT above — a forged cross-user parent_id 404s
    // before reaching here. Ownership is inherited from the SELECT filter above (T-05-06).
    if (new URL(request.url).searchParams.has("summary")) {
      return Response.json({
        id: data.id,
        caption: (data.content_text ?? "").slice(0, 120) || null,
        created_at: data.created_at,
      });
    }

    // Normalize the ownership-scoped row into the deterministic CanonicalReading
    // shape (D-11). `fromPersistedRow` is PURE — no DB I/O, no Math.random, no
    // time/recompute — and receives the already-authorized `data` row. The former
    // heatmap-synthesis + post-window reconstruction is intentionally gone so a
    // re-opened permalink renders byte-identically to the live run (DATA-02).
    return Response.json(fromPersistedRow(data));
  } catch (error) {
    console.error("[analysis/id] GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/analysis/:id
 *
 * Soft-deletes an analysis result by setting deleted_at timestamp.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("analysis_results")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[analysis/id] DELETE error:", error);
      return Response.json(
        { error: "Failed to delete analysis" },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[analysis/id] DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
