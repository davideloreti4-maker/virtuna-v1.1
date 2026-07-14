/**
 * POST /api/filmstrip/extract
 *
 * Dedicated Vercel API route that isolates ffmpeg-static from the main Next.js
 * bundle (Pitfall 1 workaround — next.config.ts marks ffmpeg-static external).
 *
 * Security boundaries:
 *   - Bearer token gate (FILMSTRIP_EXTRACT_SECRET) — T-03-07-01
 *   - Zod body validation with segment cap (max 50) — T-03-07-05
 *   - SSRF deny-list on videoUrl — T-03-07-03
 *
 * Called exclusively by queue.ts triggerFilmstripGeneration (fire-and-forget from pipeline).
 * Runs inline processing and persists keyframe_uri into analyses.analysis_results JSONB
 * so Plan 08 SSE route can emit filmstrip_segment_ready events.
 *
 * maxDuration=300 accommodates long-form videos; filmstrip latency does NOT count
 * against the 60s engine SLA (pipeline doesn't await this route).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWriteStream } from "fs";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { extractFrameAtTimestamp } from "@/lib/engine/filmstrip/extract";
import { uploadFrameAndGetSignedUrl } from "@/lib/engine/filmstrip/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import type { Json } from "@/types/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = createLogger({ module: "api.filmstrip.extract" });

// =====================================================
// Request body schema (T-03-07-05: max 50 segments)
// =====================================================

const SegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end: z.number().min(0),
  visual_event: z.string().max(200).optional(),
  audio_event: z.string().max(200).optional(),
});

const BodySchema = z.object({
  // Analysis IDs are either legacy UUIDs (`5958d1c6-…`) or modern 12-char nanoids
  // (`WPk976kozfWs`, route.ts `nanoid(12)`). A bare `.uuid()` here rejected every
  // nanoid id with a 400 before extraction ran, so the `filmstrips` bucket never
  // filled and keyframes never persisted (live or permalink replay). Mirror the
  // GET /api/analyze/[id]/filmstrips ParamsSchema: url-safe charset only, since
  // this value is interpolated into the storage path `<analysisId>/<idx>.jpg`.
  analysisId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/u, 'analysisId must be url-safe id'),
  videoUrl: z.string().url(),
  segments: z.array(SegmentSchema).min(1).max(50), // T-03-07-05: cap pathological inputs
});

// =====================================================
// Incremental segment persistence
// =====================================================

interface FilmstripSegmentRow {
  idx: number;
  keyframe_uri: string | null;
}

/**
 * Build a persister that publishes filmstrip segments to the row AS THEY ARE EXTRACTED.
 *
 * Reads the row's existing segments ONCE (lazily, on first publish), then keeps the merged
 * array in memory and upserts by idx — so each call costs one small `patch_analysis_variants`
 * RPC, not a re-read. The patch touches ONLY `filmstrip_segments`, so it cannot clobber
 * craft / apollo / remix written concurrently by the score / remix flows (Bug #7 lost-update).
 *
 * Never throws: a failed publish is logged and the extraction carries on. A frame that fails
 * to publish is a frame the loading Reading won't paint — it is not a reason to fail the run.
 */
function createSegmentPersister(analysisId: string, log: ReturnType<typeof createLogger>) {
  const supabase = createServiceClient();
  let merged: FilmstripSegmentRow[] | null = null;

  return async function publish(updates: FilmstripSegmentRow[]): Promise<void> {
    if (merged === null) {
      const { data: row, error } = await supabase
        .from("analysis_results")
        .select("variants")
        .eq("id", analysisId)
        .single();

      if (error || !row) {
        log.error("filmstrip: failed to read analysis_results row", {
          analysisId,
          error: error?.message,
        });
        return;
      }

      const variants = (row.variants ?? {}) as Record<string, unknown>;
      merged = Array.isArray(variants.filmstrip_segments)
        ? [...(variants.filmstrip_segments as FilmstripSegmentRow[])]
        : [];
    }

    for (const update of updates) {
      const at = merged.findIndex((s) => s.idx === update.idx);
      // A seed (`keyframe_uri: null`) must never overwrite a frame we already published —
      // otherwise a re-seed would blank the strip the user is watching fill up.
      if (at >= 0) {
        if (update.keyframe_uri !== null) merged[at] = update;
      } else {
        merged.push(update);
      }
    }

    const { error: writeError } = await supabase.rpc("patch_analysis_variants", {
      p_id: analysisId,
      p_patch: { filmstrip_segments: merged } as unknown as Json,
      // secret-authed service job (no session user) — keys on id, as the prior write did.
    });

    if (writeError) {
      log.error("filmstrip: failed to persist keyframe_uri to variants", {
        analysisId,
        error: writeError.message,
      });
    }
  };
}

// =====================================================
// SSRF deny-list (T-03-07-03)
// Supabase-signed video URLs are external by design — this blocks internal ranges.
// =====================================================

const SSRF_DENY_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^::1$/,                                // IPv6 loopback
  /^::ffff:/i,                            // CR-03: IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  /^fc00:/i,                              // CR-03: IPv6 unique-local fc00::/7
  /^fd[0-9a-f]{2}:/i,                    // CR-03: IPv6 unique-local fd00::/8
  /^fe80:/i,                              // CR-03: IPv6 link-local fe80::/10
  /^10\.\d+\.\d+\.\d+$/,                // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.0.0/12
  /^192\.168\.\d+\.\d+$/,               // 192.168.0.0/16
  /^169\.254\.\d+\.\d+$/,               // 169.254.0.0/16 (link-local / AWS IMDS)
  /^0\.0\.0\.0$/,
  /^metadata\.google\.internal$/i,       // CR-03: GCP metadata hostname
];

function isPrivateHostname(hostname: string): boolean {
  return SSRF_DENY_PATTERNS.some((pat) => pat.test(hostname));
}

// =====================================================
// Source download (race fix)
// The pipeline fire-and-forgets this route at wave_0_complete, but the main
// /api/analyze route deletes the source video from the `videos` bucket at
// `complete` (retention opt-out default). extractFrameAtTimestamp seeks the
// remote URL once *per frame*, so a slow extraction can outlive the signed URL
// and 404 mid-loop. Download the video to a temp file once up front and extract
// every frame locally — extraction then no longer depends on the source object
// surviving deletion (and local seeking is faster than N remote range sessions).
// =====================================================

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // /tmp + memory guard

/**
 * Stream `url` to a temp file. Returns `{ path, dir }` on success (caller must
 * `rm(dir, { recursive })`), or null on any failure so the caller can fall back
 * to per-frame remote seeking. Never throws.
 */
async function downloadToTempFile(
  url: string,
  analysisId: string,
): Promise<{ path: string; dir: string } | null> {
  let dir: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      log.error("filmstrip: source download failed", { analysisId, status: res.status });
      return null;
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared && declared > MAX_VIDEO_BYTES) {
      log.error("filmstrip: source too large to buffer", { analysisId, declared });
      return null;
    }
    dir = await mkdtemp(join(tmpdir(), "filmstrip-"));
    const path = join(dir, "source");
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>),
      createWriteStream(path),
    );
    return { path, dir };
  } catch (err) {
    log.error("filmstrip: source download error", {
      analysisId,
      error: err instanceof Error ? err.message : String(err),
    });
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    return null;
  }
}

// =====================================================
// POST handler
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ---- Auth gate (T-03-07-01) ----
  const authHeader = request.headers.get("authorization");
  const secret = process.env.FILMSTRIP_EXTRACT_SECRET;
  const expected = `Bearer ${secret ?? ""}`;

  if (!secret || authHeader !== expected) {
    log.warn("filmstrip extract auth failed", { hasHeader: !!authHeader });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ---- Parse + validate body ----
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { analysisId, videoUrl, segments } = parsed.data;

  // ---- SSRF guard on videoUrl (T-03-07-03) ----
  try {
    const parsedUrl = new URL(videoUrl);
    if (isPrivateHostname(parsedUrl.hostname)) {
      log.warn("filmstrip SSRF denied", { hostname: parsedUrl.hostname, analysisId });
      return NextResponse.json({ error: "bad request: private URL denied" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "bad request: invalid URL" }, { status: 400 });
  }

  // ---- Extraction loop ----
  // pipeline.ts already fire-and-forgot this route — we process inline.
  // maxDuration=300 gives us up to 5 minutes for all segments.
  const results: Array<{ idx: number; keyframe_uri: string | null }> = [];

  // Download once; fall back to per-frame remote seeking if the download fails.
  let temp: { path: string; dir: string } | null = null;

  // The frames are the ONLY honest proof-of-work the in-flight Reading can show while the
  // engine runs (~2 min): they are real frames of the user's own video. That means WHEN they
  // reach the DB is a UX decision, not just a persistence one — the loading skeleton polls this
  // row (GET /api/analyze/[id]/stream) and renders each frame as it lands.
  //
  // So we persist INCREMENTALLY (once per frame) instead of once after the loop. The old
  // single write at the end meant every frame appeared in one burst, minutes in — the strip
  // could never "fill up" while the video was being read, which is the whole point of showing
  // it. patch_analysis_variants patches ONLY the filmstrip_segments key, so N small patches are
  // as safe against concurrent craft/apollo/remix writers as the one big one was (Bug #7).
  const persist = createSegmentPersister(analysisId, log);

  try {
    // Seed the full grid up front (every idx, keyframe_uri: null). This is what lets the client
    // show "0 of 8" — i.e. HOW MANY frames are coming — from the first poll, instead of only
    // learning the total once the last one lands. Consumers are already null-safe
    // (resolveKeyframeUrl skips null uris; the stream route only emits segments that have one).
    await persist(segments.map((_, i) => ({ idx: i, keyframe_uri: null })));

    temp = await downloadToTempFile(videoUrl, analysisId);
    const frameSource = temp?.path ?? videoUrl;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const buffer = await extractFrameAtTimestamp(frameSource, segment.t_start);

      if (!buffer) {
        log.warn("filmstrip frame extraction failed", { analysisId, segmentIdx: i, t_start: segment.t_start });
        results.push({ idx: i, keyframe_uri: null });
        continue;
      }

      const uri = await uploadFrameAndGetSignedUrl(analysisId, i, buffer);
      results.push({ idx: i, keyframe_uri: uri });

      if (uri) {
        // Publish THIS frame before extracting the next one — the watching Reading paints it now.
        await persist([{ idx: i, keyframe_uri: uri }]);
        log.info("filmstrip segment ready", { analysisId, segmentIdx: i });
      }
    }

    // Every successful frame is already in the row (published one-by-one above). Failed frames
    // keep the seeded `keyframe_uri: null`, which is exactly what they are: a segment we could
    // not read. Nothing left to write here.
    const successResults = results.filter((r) => r.keyframe_uri !== null);
    log.info("filmstrip: keyframe_uris persisted to variants", {
      analysisId,
      count: successResults.length,
    });

    return NextResponse.json({
      ok: true,
      segments_processed: results.length,
      segments_succeeded: successResults.length,
    });
  } catch (err) {
    log.error("filmstrip extract route error", {
      analysisId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  } finally {
    if (temp) await rm(temp.dir, { recursive: true, force: true }).catch(() => {});
  }
}
