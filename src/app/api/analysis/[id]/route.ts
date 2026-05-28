import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/analysis/:id
 *
 * Returns a single analysis result by ID for the authenticated user.
 */
export async function GET(
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

    // Derive Phase 5 fields the engine emits at runtime but the DB schema
    // doesn't (yet) persist. Phase-5 UI components key off these — without the
    // shim, completed analyses load with a permanent skeleton state.
    const confidence = typeof data.confidence === "string"
      ? Number.parseFloat(data.confidence)
      : data.confidence;
    const overall = typeof data.overall_score === "string"
      ? Number.parseFloat(data.overall_score)
      : data.overall_score;
    const enriched = {
      ...data,
      overall_score: overall,
      confidence,
      confidence_label:
        data.confidence_label ??
        (confidence == null
          ? null
          : confidence >= 0.7
          ? "HIGH"
          : confidence >= 0.4
          ? "MEDIUM"
          : "LOW"),
      is_calibrated: data.is_calibrated ?? true,
      anti_virality_gated:
        data.anti_virality_gated ??
        (confidence == null ? false : confidence < 0.4),
    };

    return Response.json(enriched);
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
