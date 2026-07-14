import { nanoid } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
import { resolveThreadAudience } from "@/lib/audience/resolve-thread-audience";
import { GENERAL_ROSTER } from "@/lib/audience/persona-names";
import { getOpenThread } from "@/lib/threads/threads";
import { createLogger } from "@/lib/logger";

// Phase 3 (Plan 08) — helpers for filmstrip polling and partial persona state tracking.
// Reads variants.filmstrip_segments[].keyframe_uri from the JSONB analysis_results column.
// The filmstrip extract route (/api/filmstrip/extract) persists keyframes to
// `variants.filmstrip_segments` (NOT `heatmap.segments` — no such column exists), so this
// must read the same field or live runs never emit filmstrip_segment_ready (keyframes stay
// blank until a reload hits the bucket-backed /filmstrips endpoint).
interface FilmstripSegmentRow {
  idx: number;
  keyframe_uri: string | null;
}

function extractFilmstripSegments(row: Record<string, unknown>): FilmstripSegmentRow[] {
  try {
    const variants = row.variants as { filmstrip_segments?: unknown[] } | null;
    const segs = variants?.filmstrip_segments;
    if (!Array.isArray(segs)) return [];
    return segs.map((s, i) => ({
      idx: (s as { idx?: number }).idx ?? i,
      keyframe_uri: (s as { keyframe_uri?: string | null }).keyframe_uri ?? null,
    }));
  } catch {
    return [];
  }
}

interface SourceReceiptRow {
  cover_url: string | null;
  handle: string | null;
  views: number | null;
  video_url: string | null;
}

/**
 * The scrape's own receipt (`variants.source`), written by the pipeline seconds into the run —
 * the post's cover, author and view count. It is the FIRST evidence available to the in-flight
 * Reading, long before any keyframe is cut, so it is what fills the opening ~30s of the wait.
 * Null until the scrape resolves (and forever, in video_upload mode — nothing was scraped).
 */
function extractSourceReceipt(row: Record<string, unknown>): SourceReceiptRow | null {
  try {
    const variants = row.variants as { source?: SourceReceiptRow } | null;
    const source = variants?.source;
    if (!source || typeof source !== "object") return null;
    if (!source.cover_url && !source.handle) return null;
    return source;
  } catch {
    return null;
  }
}

interface RosterEntry {
  archetype: string;
  label: string | null;
}

/**
 * WHO IS ABOUT TO WATCH THIS — resolved the SAME way the engine resolves the audience it
 * actually simulates (`/api/analyze` R1′b: open thread → `active_audience_id` → `getAudience`,
 * falling back to General). That mirroring is the whole correctness argument: the roster must
 * name the cast the fold will really run, or it is decoration.
 *
 * It used to read `row.society_id`. Nothing writes that column — the Read submit path never
 * sends `society_id` (composer.tsx sends only input_mode/content_type/tiktok_url), so it is
 * NULL on every live row and the roster event could never fire outside a fixture. Verified
 * against a real run (2026-07-14): row `iEbgUsLZRSFw`, society_id=null, zero roster events.
 * `society_id` is deliberately NOT written to fix this: it is the cohort key for the
 * niche-percentile RPC (`niche_percentiles_rpc.sql` groups by it), so populating it would
 * silently reshape niche rankings.
 *
 * General (uncalibrated) resolves to GENERAL_ROSTER — the 10 archetypes the fold simulates for
 * a General audience. That is the honest cast, not a stand-in: it is the same roster /home and
 * the Room already show, and `GENERAL_AUDIENCE.personas` is `[]` precisely because the cast
 * lives in the archetype list rather than in persona rows.
 *
 * Their REACTIONS are never sent here — those are what the Read is for.
 */
async function resolveRunRoster(
  supabase: SupabaseClient,
  userId: string,
  societyId: unknown,
): Promise<RosterEntry[]> {
  const toEntries = (
    personas: ReadonlyArray<{ archetype: string; label?: string | null }>,
  ): RosterEntry[] =>
    personas.map((p) => ({ archetype: p.archetype, label: p.label ?? null }));

  // An explicit society pin on the row still wins, for any caller that sets one.
  if (typeof societyId === "string" && societyId.length > 0 && societyId !== "general") {
    const pinned = await getAudience(supabase, societyId);
    if (pinned && pinned.personas.length > 0) return toEntries(pinned.personas);
  }

  // The thread's active audience — via the SAME shared helper every generative route uses, so
  // the Reading names the audience the engine folds and the resolution rule lives in one place.
  // getOpenThread (not createOpenThreadLazy): watching a Read must never create a thread.
  const thread = await getOpenThread(userId);
  const audience = thread
    ? await resolveThreadAudience(supabase, thread)
    : GENERAL_AUDIENCE;
  if (audience.personas.length > 0) return toEntries(audience.personas);

  // General — the archetype cast the fold runs when no calibrated audience is pinned.
  // (GENERAL_AUDIENCE.personas is [] by construction; the cast lives in the archetype list.)
  return GENERAL_ROSTER.map((archetype) => ({ archetype, label: null }));
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
/**
 * Wall-clock budget for the poll loop, NOT an attempt count.
 *
 * The old ceiling was 45 attempts ("90s, >60s engine SLA"), but a real Read runs ~120s (the live
 * moat run was 128s) — so EVERY Read outlived its own progress stream, hit "Stream timed out —
 * analysis still running", and only recovered because EventSource silently reconnects. The
 * watcher must outlive the work it is watching.
 *
 * Counting attempts would have been the same bug in a new place: each iteration also awaits a DB
 * read, and this route now reads a `variants` blob that GROWS across the run (up to 50 segments,
 * each with a signed URL). At 145 attempts the unbudgeted read latency alone (~50-100ms each) is
 * 7-15s of drift — enough to be force-killed by maxDuration (300s) mid-frame, losing the graceful
 * timeout this budget exists to give. A deadline absorbs that drift by construction.
 */
const POLL_BUDGET_MS = 280_000;
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
          const deadline = Date.now() + POLL_BUDGET_MS;
          // Phase 3 (Plan 08) — filmstrip polling state.
          // Track which segment indices already have keyframe_uri so we only
          // emit filmstrip_segment_ready ONCE per segment (delta-only emission).
          const knownKeyframeIndices = new Set<number>();
          // Emit the frame count once, the first poll that sees a seeded grid.
          let filmstripTotalSent = false;
          // Emit the scrape receipt once, the first poll that sees it.
          let sourceSent = false;
          // Emit the audience roster once (it is fixed for the run).
          let rosterSent = false;
          // Track last personas array reference for change detection.
          let lastPersonasJson = "";

          while (Date.now() < deadline) {
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

              // The ROSTER — who is about to watch this. Known before the run even starts (it is
              // the audience the user calibrated), but the in-flight Reading had no way to see it,
              // so the ~60s the audience sim takes was the emptiest stretch of the whole wait.
              // Emit it once and the wait can show the actual people it is simulating.
              //
              // Their REACTIONS are not known yet — those are what the Read is for. Only the cast
              // is sent here.
              if (!rosterSent) {
                rosterSent = true;
                try {
                  const roster = await resolveRunRoster(
                    supabase,
                    user.id,
                    freshRow.society_id,
                  );
                  if (roster.length > 0) send("roster", { personas: roster });
                } catch (err) {
                  // A roster we can't load costs the wait some texture, never the run.
                  log.info("roster load failed", { id, error: String(err) });
                }
              }

              // The source receipt — emitted once, as soon as the scrape lands. This is what the
              // user sees FIRST: the video we're about to read, with its author.
              if (!sourceSent) {
                const source = extractSourceReceipt(freshRow);
                if (source) {
                  sourceSent = true;
                  send("source", source);
                }
              }

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
              const filmstripSegs = extractFilmstripSegments(freshRow);

              // The extract route seeds the WHOLE grid (every idx, keyframe_uri null) before it
              // reads the first frame, so the total is known long before the frames arrive. Send
              // it once: the loading Reading draws that many empty slots and fills them in, which
              // is what makes the strip read as progress ("3 of 8") rather than as a growing pile.
              if (!filmstripTotalSent && filmstripSegs.length > 0) {
                filmstripTotalSent = true;
                send("filmstrip_plan", { total: filmstripSegs.length });
              }

              for (const seg of filmstripSegs) {
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
            // WR-01: check aborted before AND after the sleep so we exit
            // within milliseconds of a client disconnect rather than waiting
            // a full 2s interval before the while-condition is re-evaluated.
            await new Promise<void>((r) => {
              const t = setTimeout(r, SHORT_POLL_INTERVAL_MS);
              if (aborted.value) { clearTimeout(t); r(); }
            });
            if (aborted.value) break;
          }
          if (Date.now() >= deadline && !aborted.value) {
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
