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
import { extractFrameAtTimestamp } from "@/lib/engine/filmstrip/extract";
import { uploadFrameAndGetSignedUrl } from "@/lib/engine/filmstrip/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

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
  analysisId: z.string().uuid(),
  videoUrl: z.string().url(),
  segments: z.array(SegmentSchema).min(1).max(50), // T-03-07-05: cap pathological inputs
});

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

  try {
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const buffer = await extractFrameAtTimestamp(videoUrl, segment.t_start);

      if (!buffer) {
        log.warn("filmstrip frame extraction failed", { analysisId, segmentIdx: i, t_start: segment.t_start });
        results.push({ idx: i, keyframe_uri: null });
        continue;
      }

      const uri = await uploadFrameAndGetSignedUrl(analysisId, i, buffer);
      results.push({ idx: i, keyframe_uri: uri });

      if (uri) {
        log.info("filmstrip segment ready", { analysisId, segmentIdx: i });
      }
    }

    // ---- Persist keyframe_uri into analysis_results.variants JSONB ----
    //
    // DB schema note: the plan originally referenced `analyses.analysis_results.heatmap`
    // but no `heatmap` column exists in the `analysis_results` table (Plan 03 migration
    // created the filmstrips bucket only). The `variants` JSONB column is available and
    // currently unused — we use it as the filmstrip state store so Plan 08 can read and
    // emit filmstrip_segment_ready SSE events.
    //
    // Structure written: { filmstrip_segments: [{ idx, keyframe_uri }] }
    const successResults = results.filter((r) => r.keyframe_uri !== null);
    if (successResults.length > 0) {
      const supabase = createServiceClient();

      // Read current variants to merge (preserve other keys if any)
      const { data: analysisRow, error: readError } = await supabase
        .from("analysis_results")
        .select("variants")
        .eq("id", analysisId)
        .single();

      if (readError || !analysisRow) {
        log.error("filmstrip: failed to read analysis_results row", {
          analysisId,
          error: readError?.message,
        });
      } else {
        const currentVariants = (analysisRow.variants ?? {}) as Record<string, unknown>;
        const existingSegments = Array.isArray(currentVariants.filmstrip_segments)
          ? (currentVariants.filmstrip_segments as Array<{ idx: number; keyframe_uri: string | null }>)
          : [];

        // Merge new results into existing segments array (upsert by idx)
        const merged = [...existingSegments];
        for (const result of successResults) {
          const existing = merged.findIndex((s) => s.idx === result.idx);
          if (existing >= 0) {
            merged[existing] = result;
          } else {
            merged.push(result);
          }
        }

        const updatedVariants = {
          ...currentVariants,
          filmstrip_segments: merged,
        };

        const { error: writeError } = await supabase
          .from("analysis_results")
          .update({ variants: updatedVariants })
          .eq("id", analysisId);

        if (writeError) {
          log.error("filmstrip: failed to persist keyframe_uri to variants", {
            analysisId,
            error: writeError.message,
          });
        } else {
          log.info("filmstrip: keyframe_uris persisted to variants", {
            analysisId,
            count: successResults.length,
          });
        }
      }
    }

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
  }
}
