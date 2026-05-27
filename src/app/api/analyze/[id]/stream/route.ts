import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

// Phase 3 (Plan 08) — helpers for filmstrip polling and partial persona state tracking.
// Reads heatmap.segments[].keyframe_uri from the JSONB analysis_results column.
// Emits filmstrip_segment_ready SSE events when new keyframe_uri entries appear.
interface HeatmapSegmentRow {
  idx: number;
  keyframe_uri: string | null;
}

function extractHeatmapSegments(row: Record<string, unknown>): HeatmapSegmentRow[] {
  try {
    const ar = row.analysis_results as { heatmap?: { segments?: unknown[] } } | null;
    const segs = ar?.heatmap?.segments;
    if (!Array.isArray(segs)) return [];
    return segs.map((s, i) => ({
      idx: (s as { idx?: number }).idx ?? i,
      keyframe_uri: (s as { keyframe_uri?: string | null }).keyframe_uri ?? null,
    }));
  } catch {
    return [];
  }
}

// Extract partial personas array from the DB row's JSONB column.
// Returns null when not yet written (pre-Pass-1 state).
function extractPartialPersonas(row: Record<string, unknown>): unknown[] | null {
  try {
    const ar = row.analysis_results as { partial?: { personas?: unknown[] } } | null;
    const personas = ar?.partial?.personas;
    return Array.isArray(personas) ? personas : null;
  } catch {
    return null;
  }
}

/**
 * Phase 1 (D-04) — GET /api/analyze/[id]/stream.
 *
 * EventSource-compatible endpoint. Two modes:
 *   (1) Terminal state (overall_score !== null) — single event:complete, close.
 *   (2) In-flight (overall_score === null) — short-poll DB every 2s up to 90s, heartbeat every 15s.
 *
 * Auth: same-origin Supabase session cookie (rides GET automatically per browser cookie rules).
 * Security: IDOR mitigation via `.eq("user_id", user.id)` server-side filter. 404 for both
 *           missing and wrong-owner cases (indistinguishable response prevents enumeration).
 *
 * Pitfall #1 — runtime/dynamic/maxDuration mirrored from /api/analyze/route.ts.
 * Pitfall #2 — no custom headers expected; cookie auth handles everything.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SHORT_POLL_INTERVAL_MS = 2_000;
const SHORT_POLL_MAX_ATTEMPTS = 45; // 45 * 2s = 90s ceiling (>60s engine SLA)
const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = nanoid(12);
  const log = createLogger({ requestId, module: "analyze.stream" });

  // ---- Auth ----
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Row lookup (IDOR-mitigated by user_id filter) ----
  const { data: row, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (error || !row) {
    log.info("stream not found", { id, hasError: !!error });
    return Response.json({ error: "Analysis not found" }, { status: 404 });
  }

  const lastEventId = request.headers.get("Last-Event-ID");
  log.info("stream connect", {
    id,
    lastEventId,
    status: row.overall_score === null ? "in-flight" : "complete",
  });

  // ---- Stream ----
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, eventId?: string) => {
        const prefix = eventId ? `id: ${eventId}\n` : "";
        controller.enqueue(
          encoder.encode(`${prefix}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Wire client-disconnect abort to clean up heartbeat + DB poll loop
      const aborted = { value: false };
      request.signal?.addEventListener("abort", () => {
        aborted.value = true;
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });

      try {
        if (row.overall_score !== null) {
          send("complete", row, "complete");
        } else {
          let attempts = 0;
          // Phase 3 (Plan 08) — filmstrip polling state.
          // Track which segment indices already have keyframe_uri so we only
          // emit filmstrip_segment_ready ONCE per segment (delta-only emission).
          const knownKeyframeIndices = new Set<number>();
          // Track last personas array reference for change detection.
          let lastPersonasJson = "";

          while (attempts < SHORT_POLL_MAX_ATTEMPTS) {
            if (aborted.value) break;
            const { data: fresh, error: pollErr } = await supabase
              .from("analysis_results")
              .select("*")
              .eq("id", id)
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .single();
            if (pollErr) {
              log.error("poll error", { error: pollErr.message });
              send("error", { error: "Poll failed" });
              break;
            }
            if (fresh) {
              const freshRow = fresh as Record<string, unknown>;

              // Phase 3 (Plan 08) — partial persona state emission (D-15).
              // Emit a `partial` event when personas array changes (new pass2 state added).
              const personas = extractPartialPersonas(freshRow);
              if (personas) {
                const personasJson = JSON.stringify(personas);
                if (personasJson !== lastPersonasJson) {
                  lastPersonasJson = personasJson;
                  send("partial", { personas });
                }
              }

              // Phase 3 (Plan 08) — filmstrip segment ready polling.
              // Emit filmstrip_segment_ready for each newly populated keyframe_uri.
              const heatmapSegs = extractHeatmapSegments(freshRow);
              for (const seg of heatmapSegs) {
                if (seg.keyframe_uri && !knownKeyframeIndices.has(seg.idx)) {
                  knownKeyframeIndices.add(seg.idx);
                  send("filmstrip_segment_ready", {
                    segment_idx: seg.idx,
                    keyframe_uri: seg.keyframe_uri,
                  });
                }
              }

              if (fresh.overall_score !== null) {
                send("complete", fresh, "complete");
                break;
              }
            }
            await new Promise((r) => setTimeout(r, SHORT_POLL_INTERVAL_MS));
            attempts++;
          }
          if (attempts >= SHORT_POLL_MAX_ATTEMPTS && !aborted.value) {
            send("error", { error: "Stream timed out — analysis still running" });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("stream error", { error: msg });
        try { send("error", { error: msg }); } catch { /* controller closed */ }
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      Vary: "Accept",
    },
  });
}
