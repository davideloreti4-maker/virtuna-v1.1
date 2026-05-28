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

    // Synthesize a minimal heatmap for the Audience node when the DB row
    // doesn't persist one. The audience renders from `result.heatmap.*` and
    // would otherwise show the "Persona data isn't available" empty state
    // despite the row containing rich persona output.
    type RawPersona = {
      persona_id?: string;
      slot_type?: string;
      watch_through_pct?: number;
      scroll_past_second?: number | null;
    };
    type RawBehavioral = { completion_pct?: number };
    const SEGMENT_COUNT = 10;
    const TOTAL_DURATION_S = 30;
    function synthHeatmap() {
      const personasRaw = (data as { personas?: RawPersona[] }).personas ?? [];
      const behavioral = (data as { behavioral_predictions?: RawBehavioral }).behavioral_predictions ?? {};
      if (!personasRaw.length) return null;

      const segDuration = TOTAL_DURATION_S / SEGMENT_COUNT;
      const segments = Array.from({ length: SEGMENT_COUNT }, (_, idx) => ({
        idx,
        t_start: idx * segDuration,
        t_end: (idx + 1) * segDuration,
        is_hook_zone: idx < 1,
        keyframe_uri: null,
      }));

      const personas = personasRaw.map((p) => {
        const base = Math.max(0, Math.min(1, (p.watch_through_pct ?? 50) / 100));
        const dropSeg = p.scroll_past_second != null && p.scroll_past_second > 0
          ? Math.floor(p.scroll_past_second / segDuration)
          : SEGMENT_COUNT;
        const attentions = segments.map((s) =>
          s.idx < dropSeg ? base : Math.max(0, base * 0.3),
        );
        const slot = ['fyp', 'niche_deep', 'loyalist', 'cross_niche'].includes(p.slot_type ?? '')
          ? p.slot_type
          : 'fyp';
        return {
          id: p.persona_id ?? `persona-${Math.random().toString(36).slice(2, 8)}`,
          slot_type: slot,
          attentions,
          swipe_predicted_at: p.scroll_past_second ?? null,
          segment_reasons: {},
        };
      });

      const weighted_curve = segments.map((s) => {
        const sum = personas.reduce((acc, p) => acc + (p.attentions[s.idx] ?? 0), 0);
        return personas.length ? sum / personas.length : 0;
      });

      const completionFallback = (behavioral.completion_pct ?? 50) / 100;

      return {
        segments,
        personas,
        weighted_curve: weighted_curve.length ? weighted_curve : Array(SEGMENT_COUNT).fill(completionFallback),
        weights: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
        weights_source: 'default' as const,
      };
    }

    const heatmap = (data as { heatmap?: unknown }).heatmap ?? synthHeatmap();

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
      heatmap,
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
