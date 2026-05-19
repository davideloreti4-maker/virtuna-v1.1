import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

// Vercel route segment config (06-REVIEW.md WR-03):
// The inline D-F4 embedding pipeline runs ~5s per sound (download + upload + describe +
// embed + update). At a 50-sound ceiling per tick that is a ~4-minute worst case — well
// over Vercel's default 10s hobby / 60s pro ceiling. Lifting maxDuration to 300s gives
// the cron headroom; per-row failure isolation in this route prevents one slow sound
// from blocking the whole batch even within the budget.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const log = createLogger({ module: "cron/calculate-trends" });

// =====================================================
// Phase 6 (D-F4) — inline embedding pipeline constants
// =====================================================
//
// Mirrors scripts/backfill-trending-sound-embeddings.ts (Plan 06-04). The cron path
// processes newly-upserted rows where `audio_embedding IS NULL`; the backfill script
// processes existing rows under the same predicate. Both paths share the FULL D-F4
// pipeline semantics (download → upload → describe → embed → update + cleanup).
//
// Cost ceiling per CONTEXT D-F4: ~$0.0005/sound × ~50 sounds/day ≈ $0.025/day.
// All steps are NON-FATAL (Pitfall 4): any per-row failure logs + continues; the
// route response shape is unchanged.

const GEMINI_AUDIO_MODEL = "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONALITY = 768;
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const DOWNLOAD_TIMEOUT_MS = 10_000;
const DEFAULT_MIME_TYPE = "audio/mpeg";

const AUDIO_DESCRIPTION_PROMPT = `
You are analyzing a short audio clip (likely a trending TikTok sound). Produce a 50-150 character
description capturing the audio's distinguishing features so it can be matched against other
sounds via semantic similarity.

Include where applicable:
- Genre (hip-hop, pop, dance, ambient, voice-only, etc.)
- Tempo (slow / mid / upbeat) or BPM range if obvious
- Vocal/instrumental (vocal-led / instrumental / sampled vocal hook)
- Mood (energetic / mellow / dramatic / quirky)
- Distinctive elements (lyrical hook, specific instrument, samples)

Examples:
- "upbeat hip-hop track, 90 BPM, sampled female vocal hook 'oh la la'"
- "mellow lo-fi instrumental, slow tempo, jazzy piano, no vocals"
- "energetic pop, ~120 BPM, English female lead vocals, dance beat"

Return JSON: { "audio_description": "..." }
`.trim();

const AUDIO_DESCRIPTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    audio_description: { type: Type.STRING },
  },
  required: ["audio_description"],
};

// Memoized Gemini client. Returns null when GEMINI_API_KEY is missing — the cron then
// skips the embedding extension entirely (Test 5 contract: response shape preserved).
let geminiClient: GoogleGenAI | null = null;
let geminiClientKey: string | undefined = undefined;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  // Re-instantiate if env key changed between tests (test isolation).
  if (geminiClient && geminiClientKey === apiKey) return geminiClient;
  geminiClient = new GoogleGenAI({ apiKey });
  geminiClientKey = apiKey;
  return geminiClient;
}

/**
 * Inline embedding download — mirrors scripts/backfill-trending-sound-embeddings.ts:downloadAudio.
 * Returns null on any failure (HTTP non-200, oversized, timeout, malformed). Caller continues.
 */
async function safeDownloadAudio(
  soundUrl: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(soundUrl, { signal: controller.signal });
    if (!response.ok) {
      log.warn("Inline embedding download HTTP non-200", {
        sound_url: soundUrl,
        status: response.status,
      });
      return null;
    }
    const rawContentType = response.headers.get("content-type") ?? DEFAULT_MIME_TYPE;
    const mimeType = rawContentType.split(";")[0]?.trim() || DEFAULT_MIME_TYPE;
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      log.warn("Inline embedding download oversized (Content-Length)", {
        sound_url: soundUrl,
        contentLength,
      });
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      log.warn("Inline embedding download oversized (body)", {
        sound_url: soundUrl,
        bytes: arrayBuffer.byteLength,
      });
      return null;
    }
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch (err) {
    log.warn("Inline embedding download failed", {
      sound_url: soundUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload audio to Gemini Files API + run audio-only describe call. Mirrors
 * scripts/backfill-trending-sound-embeddings.ts:describeAudioWithGemini.
 *
 * The carrier-pattern lets the caller run Files API cleanup even if describe throws
 * AFTER the upload succeeded (Files API quota leak protection).
 */
async function describeAudioWithGemini(
  ai: GoogleGenAI,
  buffer: Buffer,
  mimeType: string,
  carrier: { uploadedName: string | null },
): Promise<{ description: string }> {
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
  carrier.uploadedName = uploadResult.name ?? null;
  const fileUri = uploadResult.uri;
  if (!fileUri) throw new Error("Gemini Files API upload returned no URI");

  const generation = await ai.models.generateContent({
    model: GEMINI_AUDIO_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri, mimeType } },
          { text: AUDIO_DESCRIPTION_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: AUDIO_DESCRIPTION_SCHEMA,
    },
  });

  const rawText = generation.text ?? "{}";
  const parsed = JSON.parse(rawText) as { audio_description?: unknown };
  if (
    typeof parsed.audio_description !== "string" ||
    parsed.audio_description.trim().length === 0
  ) {
    throw new Error("Gemini emitted no audio_description");
  }
  return { description: parsed.audio_description.trim().slice(0, 280) };
}

async function embedDescriptionWithGemini(
  ai: GoogleGenAI,
  description: string,
): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: description,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONALITY,
      taskType: "SEMANTIC_SIMILARITY",
    },
  });
  const vector = result.embeddings?.[0]?.values;
  if (!vector || vector.length === 0) {
    throw new Error("embedContent returned no vector");
  }
  return vector;
}

async function cleanupGeminiFile(
  ai: GoogleGenAI,
  uploadedName: string | null,
): Promise<void> {
  if (!uploadedName) return;
  try {
    await ai.files.delete({ name: uploadedName });
  } catch {
    // best-effort — Files API cleanup failures must never abort the cron.
  }
}

/**
 * FULL D-F4 pipeline for one row (Inline embedding — FAILURE-TOLERANT per Pitfall 4).
 *
 * Idempotency: checks `trending_sounds.audio_embedding` for the row first. If non-null,
 * skips the entire pipeline (the row was already embedded by a prior cron tick or by
 * scripts/backfill-trending-sound-embeddings.ts).
 *
 * Each step is non-fatal. Any failure logs + returns; next cron tick retries.
 */
async function processSoundEmbedding(
  ai: GoogleGenAI,
  supabase: SupabaseClient,
  row: { sound_name: string; sound_url: string | null },
): Promise<void> {
  if (!row.sound_url) return;

  // Idempotency check — skip rows that already have an embedding (Test 7 contract).
  // Cheap single-row read; no second Gemini call wasted on already-embedded rows.
  try {
    const { data: existing } = await supabase
      .from("trending_sounds")
      .select("audio_embedding")
      .eq("sound_name", row.sound_name)
      .maybeSingle();
    if (existing?.audio_embedding != null) {
      return;
    }
  } catch {
    // Idempotency-check failure is non-fatal — fall through and attempt embedding.
  }

  // Step (a): download (NON-FATAL on failure).
  const downloaded = await safeDownloadAudio(row.sound_url);
  if (!downloaded) return;

  // Steps (b) + (c): upload + describe (NON-FATAL; cleanup ALWAYS runs after).
  let description: string | null = null;
  const carrier: { uploadedName: string | null } = { uploadedName: null };
  try {
    const result = await describeAudioWithGemini(
      ai,
      downloaded.buffer,
      downloaded.mimeType,
      carrier,
    );
    description = result.description;
  } catch (err) {
    log.warn("Inline embedding audio analysis failed — continuing", {
      sound_name: row.sound_name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (!description) {
    await cleanupGeminiFile(ai, carrier.uploadedName);
    return;
  }

  // Step (d): embed (NON-FATAL).
  let vector: number[] | null = null;
  try {
    vector = await embedDescriptionWithGemini(ai, description);
  } catch (err) {
    log.warn("Inline embedding embed failed — continuing", {
      sound_name: row.sound_name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cleanup Files API resource regardless of embed outcome (carrier captured name in describe).
  await cleanupGeminiFile(ai, carrier.uploadedName);

  if (!vector) return;

  // Step (e): UPDATE trending_sounds with audio_embedding + audio_description.
  // pgvector accepts number[] at runtime; database.types declares string for serialization.
  try {
    const { error: updateErr } = await supabase
      .from("trending_sounds")
      .update({
        audio_embedding: vector as unknown as string,
        audio_description: description,
      })
      .eq("sound_name", row.sound_name);
    if (updateErr) {
      log.warn("Inline embedding update failed — continuing", {
        sound_name: row.sound_name,
        error: updateErr.message,
      });
    }
  } catch (err) {
    log.warn("Inline embedding update threw — continuing", {
      sound_name: row.sound_name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * GET /api/cron/calculate-trends
 *
 * Aggregates scraped_videos into trending_sounds with velocity scores.
 * Runs hourly via Vercel Cron.
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const twentyFourHoursAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    ).toISOString();
    const fortyEightHoursAgo = new Date(
      now.getTime() - 48 * 60 * 60 * 1000
    ).toISOString();

    // Fetch non-archived videos with sound names from the last 48h
    const { data: videos, error: fetchError } = await supabase
      .from("scraped_videos")
      .select(
        "sound_name, sound_url, views, likes, shares, created_at"
      )
      .is("archived_at", null)
      .not("sound_name", "is", null)
      .gte("created_at", fortyEightHoursAgo)
      .order("created_at", { ascending: false });

    if (fetchError) {
      log.error("Fetch error", { error: fetchError.message });
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ processed: 0, message: "No recent videos" });
    }

    // Aggregate by sound_name
    const soundMap = new Map<
      string,
      {
        sound_url: string | null;
        video_count: number;
        total_views: number;
        recent_views: number; // last 24h
        older_views: number; // 24-48h
        first_seen: string;
        last_seen: string;
      }
    >();

    for (const video of videos) {
      const name = video.sound_name!;
      const existing = soundMap.get(name);
      const views = video.views ?? 0;
      const isRecent = video.created_at! >= twentyFourHoursAgo;

      if (existing) {
        existing.video_count++;
        existing.total_views += views;
        if (isRecent) existing.recent_views += views;
        else existing.older_views += views;
        if (video.created_at! < existing.first_seen)
          existing.first_seen = video.created_at!;
        if (video.created_at! > existing.last_seen)
          existing.last_seen = video.created_at!;
        if (!existing.sound_url && video.sound_url)
          existing.sound_url = video.sound_url;
      } else {
        soundMap.set(name, {
          sound_url: video.sound_url,
          video_count: 1,
          total_views: views,
          recent_views: isRecent ? views : 0,
          older_views: isRecent ? 0 : views,
          first_seen: video.created_at!,
          last_seen: video.created_at!,
        });
      }
    }

    // Calculate velocity scores and trend phases, then upsert
    const trendRecords = Array.from(soundMap.entries()).map(
      ([sound_name, data]) => {
        // Growth rate: (recent - older) / max(older, 1) — avoids division by zero
        const growth_rate =
          data.older_views > 0
            ? (data.recent_views - data.older_views) / data.older_views
            : data.recent_views > 0
              ? 1.0
              : 0;

        // Velocity score: combines video count, views, and growth
        const velocity_score =
          Math.log10(Math.max(data.total_views, 1)) *
          data.video_count *
          (1 + Math.max(growth_rate, 0));

        // Determine trend phase based on growth rate, velocity, and absolute volume
        const trend_phase = classifyTrendPhase(growth_rate, velocity_score, data.total_views);

        return {
          sound_name,
          sound_url: data.sound_url,
          video_count: data.video_count,
          total_views: data.total_views,
          growth_rate: Math.round(growth_rate * 1000) / 1000,
          velocity_score: Math.round(velocity_score * 100) / 100,
          trend_phase,
          first_seen: data.first_seen,
          last_seen: data.last_seen,
          metadata: { calculated_at: now.toISOString() },
        };
      }
    );

    // Upsert in batches
    const BATCH_SIZE = 50;
    let upsertedCount = 0;

    // Phase 6 (D-F4) — Gemini client resolved ONCE outside the loop. null when
    // GEMINI_API_KEY is missing → embedding extension is skipped entirely (Test 5
    // contract: response shape preserved). Failure-tolerant: the embedding extension
    // is FIRE-AND-FORGET per Pitfall 4 — any per-row failure logs + continues; the
    // route response shape is unchanged. Idempotent: rows where audio_embedding is
    // already populated skip the pipeline (processSoundEmbedding's IS NULL check).
    const ai = getGeminiClient();

    for (let i = 0; i < trendRecords.length; i += BATCH_SIZE) {
      const batch = trendRecords.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("trending_sounds")
        .upsert(batch, { onConflict: "sound_name" });

      if (error) {
        log.error("Upsert error", { offset: i, error: error.message });
        // Skip embedding for this batch — the rows weren't upserted.
        continue;
      }

      upsertedCount += batch.length;

      // Phase 6 (D-F4) — inline embedding pipeline per row. Skipped entirely if no
      // Gemini client (missing GEMINI_API_KEY). All step-level failures are logged
      // + swallowed inside processSoundEmbedding; the outer try/catch here is
      // defense-in-depth (an unexpected throw inside processSoundEmbedding must
      // never propagate to the route response — Pitfall 4 fire-and-forget contract).
      if (ai) {
        for (const row of batch) {
          try {
            await processSoundEmbedding(ai, supabase, row);
          } catch (err) {
            log.warn("Inline embedding fatal (unexpected) — continuing", {
              sound_name: row.sound_name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    log.info("Processed videos into sounds", {
      videoCount: videos.length,
      soundCount: trendRecords.length,
      upsertedCount,
    });

    return NextResponse.json({
      processed: videos.length,
      sounds: trendRecords.length,
      upserted: upsertedCount,
    });
  } catch (error) {
    log.error("Failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function classifyTrendPhase(
  growthRate: number,
  velocityScore: number,
  totalViews: number
): string {
  // High absolute volume with modest growth = peak (not declining) — SIG-02
  if (totalViews >= 500_000 && growthRate >= -0.2) return "peak";
  if (growthRate > 0.5 && velocityScore < 50) return "emerging";
  if (growthRate > 0.3 && velocityScore >= 50) return "rising";
  if (growthRate >= -0.1 && growthRate <= 0.3 && velocityScore >= 100)
    return "peak";
  return "declining";
}
