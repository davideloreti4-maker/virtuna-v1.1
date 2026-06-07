import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeOptimalPostWindow } from "@/lib/engine/optimal-post";

/**
 * GET /api/analysis/:id
 *
 * Returns a single analysis result by ID for the authenticated user.
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

    // These three fields are derived at runtime by the engine but never
    // persisted to a column — read defensively (cast through unknown) so the
    // shim still picks them up if a future migration adds them, without
    // tripping `analysis_results.Row` (which doesn't declare them today).
    const extras = data as unknown as {
      confidence_label?: string | null;
      is_calibrated?: boolean | null;
      anti_virality_gated?: boolean | null;
      analysis_unavailable?: boolean | null;
      signal_availability?: { gemini?: boolean; behavioral?: boolean } | null;
      heatmap?: unknown;
    };
    // T1.5 — degradation honesty. No dedicated column; derive from the persisted
    // signal_availability JSONB (both core signals dead = "couldn't analyze") so a
    // reloaded permalink renders the same honest state the live run did.
    const sa = extras.signal_availability ?? null;
    const analysis_unavailable =
      extras.analysis_unavailable ??
      (sa ? !sa.gemini && !sa.behavioral : false);
    const heatmap = extras.heatmap ?? synthHeatmap();

    // Optimal posting window — like the heatmap/confidence shims above, older
    // rows (and any run where the niche lookup degraded) persist null, leaving
    // the Actions "When to post" card stuck on a skeleton. Recompute it from the
    // creator's niche using the SAME pipeline function (computeOptimalPostWindow),
    // so the UI always shows real niche-derived data (or the pipeline's own
    // documented fallback) rather than an endless skeleton.
    let optimal_post_window =
      (data as { optimal_post_window?: unknown }).optimal_post_window ?? null;
    if (!optimal_post_window) {
      try {
        const service = createServiceClient();
        const { data: profile } = await service
          .from("creator_profiles")
          .select("niche_primary")
          .eq("user_id", user.id)
          .maybeSingle();
        optimal_post_window = await computeOptimalPostWindow(
          service,
          profile?.niche_primary ?? null,
          null,
        );
      } catch (err) {
        console.error("[analysis/id] optimal_post_window backfill failed:", err);
        optimal_post_window = null; // non-fatal — card falls back to skeleton
      }
    }

    const enriched = {
      ...data,
      overall_score: overall,
      confidence,
      confidence_label:
        extras.confidence_label ??
        (confidence == null
          ? null
          : confidence >= 0.7
          ? "HIGH"
          : confidence >= 0.4
          ? "MEDIUM"
          : "LOW"),
      is_calibrated: extras.is_calibrated ?? true,
      anti_virality_gated:
        extras.anti_virality_gated ??
        (confidence == null ? false : confidence < 0.4),
      analysis_unavailable,
      heatmap,
      optimal_post_window,
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
