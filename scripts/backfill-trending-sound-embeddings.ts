/**
 * Phase 6 Plan 06-04 — One-time backfill script (D-F4 first mechanism, WARNING 3 fix).
 *
 * Iterates `trending_sounds WHERE audio_embedding IS NULL` and runs the FULL D-F4 pipeline
 * per row — NO synthetic descriptions:
 *
 *   (a) download `sound_url` (≤MAX_DOWNLOAD_BYTES, ≤DOWNLOAD_TIMEOUT_MS)
 *   (b) upload the audio blob to the Gemini Files API (mimeType derived from response Content-Type,
 *       fallback to "audio/mpeg")
 *   (c) call Gemini 2.5 Flash with an audio-only description prompt → 50-150 char `audio_description`
 *   (d) embed the description via gemini-embedding-001 (768-dim, taskType=SEMANTIC_SIMILARITY)
 *   (e) UPDATE trending_sounds row with `audio_embedding` + `audio_description`
 *
 * Each step is NON-FATAL: a failure at any step skips this row's embedding update but the
 * trending_sounds row remains unchanged (audio_embedding stays NULL). The next invocation will
 * pick it up again — the `.is("audio_embedding", null)` filter makes this script idempotent and
 * resumable on failure.
 *
 * Gemini Files API cleanup runs in a best-effort path AFTER each row (success or failure) to
 * avoid leaking the Files API quota.
 *
 * Run: `pnpm tsx scripts/backfill-trending-sound-embeddings.ts`
 *
 * Cost (per CONTEXT D-F4): ~$0.0005/sound × ~50 sounds/day ≈ $0.025/day.
 * Per-row pacing = 200ms (two Gemini calls per row → predictable cost; avoids burst rate limits).
 *
 * Security (per <threat_model> T-06-11, T-06-13, T-06-14b):
 *   - Uses SUPABASE_SERVICE_ROLE_KEY from .env.local; never deployed; never logged.
 *   - Bounded download (MAX_DOWNLOAD_BYTES + DOWNLOAD_TIMEOUT_MS) prevents runaway costs from a
 *     malicious / oversized CDN response.
 *   - MIME type defaults to "audio/mpeg" if Content-Type is missing or non-audio.
 */

import { config } from "dotenv";
import { resolve } from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

config({ path: resolve(__dirname, "../.env.local") });

const RATE_LIMIT_MS = 200;
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const DOWNLOAD_TIMEOUT_MS = 10_000;
const GEMINI_AUDIO_MODEL = "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONALITY = 768;
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

type TrendingSoundRow = {
  id: string;
  sound_name: string;
  sound_url: string | null;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadAudio(
  soundUrl: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(soundUrl, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[backfill] Download HTTP ${response.status} for ${soundUrl}`);
      return null;
    }

    const rawContentType = response.headers.get("content-type") ?? DEFAULT_MIME_TYPE;
    const mimeType = rawContentType.split(";")[0]?.trim() || DEFAULT_MIME_TYPE;

    // Pre-check Content-Length (cheap reject for oversized clips).
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_DOWNLOAD_BYTES) {
      console.warn(
        `[backfill] Sound too large (${contentLength} bytes), skipping ${soundUrl}`,
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      console.warn(
        `[backfill] Sound body exceeded cap (${arrayBuffer.byteLength} bytes), skipping ${soundUrl}`,
      );
      return null;
    }
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  } catch (err) {
    console.warn(
      `[backfill] Download failed for ${soundUrl}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload + describe an audio buffer via Gemini. Returns the uploaded resource name in a
 * mutable carrier so the caller can run cleanup even when this function throws mid-flow
 * (the analyzer call may fail AFTER the upload succeeded — without leaking the Files
 * API quota).
 */
async function describeAudioWithGemini(
  ai: GoogleGenAI,
  buffer: Buffer,
  mimeType: string,
  carrier: { uploadedName: string | null },
): Promise<{ description: string }> {
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
  // Stash the uploaded name on the carrier ASAP so the caller can run cleanup
  // even if a subsequent step inside this function throws.
  carrier.uploadedName = uploadResult.name ?? null;
  const fileUri = uploadResult.uri;
  if (!fileUri) {
    throw new Error("Gemini Files API upload returned no URI");
  }

  // Poll for ACTIVE state before generateContent (mirrors gemini.ts:444-455 +
  // smoke-test-gemini-audio.ts:236-252). Without this, video/audio uploads that
  // are still in PROCESSING state cause generateContent to return a 400
  // "File ... is not in an ACTIVE state and usage is not allowed". Small audio
  // files occasionally return ACTIVE synchronously, but anything ≥ a few MB
  // typically needs ~2-15 s of processing.
  //
  // Only poll when upload explicitly returned state=PROCESSING. If state is
  // undefined (mocked SDK in tests, or older SDK responses) or already ACTIVE,
  // skip the poll — the smoke test and gemini.ts both treat undefined as
  // "trust the upload" rather than forcing a poll.
  let fileState: string | undefined = uploadResult.state;
  if (fileState === "PROCESSING") {
    if (!carrier.uploadedName) {
      throw new Error("Gemini Files API upload returned no resource name");
    }
    const POLL_INTERVAL_MS = 1000;
    const POLL_TIMEOUT_MS = 60_000;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
        throw new Error(
          `Gemini Files API still in PROCESSING after ${POLL_TIMEOUT_MS}ms (name=${carrier.uploadedName})`,
        );
      }
      await sleep(POLL_INTERVAL_MS);
      const info = await ai.files.get({ name: carrier.uploadedName });
      fileState = info.state ?? "PROCESSING";
    }
    if (fileState !== "ACTIVE") {
      throw new Error(
        `Gemini Files API processing failed (state=${fileState}, name=${carrier.uploadedName})`,
      );
    }
  }

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
  // Defensive truncate (matches downstream Zod max). 280 char ceiling absorbs
  // a verbose Gemini response without rejecting the row.
  const description = parsed.audio_description.trim().slice(0, 280);
  return { description };
}

async function embedDescription(
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

async function cleanupUploadedFile(
  ai: GoogleGenAI,
  uploadedName: string | null,
): Promise<void> {
  if (!uploadedName) return;
  try {
    await ai.files.delete({ name: uploadedName });
  } catch {
    // best-effort — Gemini Files API cleanup failures must never abort the run.
  }
}

export async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error("[backfill] Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  let processedCount = 0;
  let skippedCount = 0;
  let cursor: string | null = null;

  while (true) {
    // Idempotent + resumable via WHERE audio_embedding IS NULL + ORDER BY id ASC + cursor.
    // Per-row pagination (limit 1) is intentional — each row makes 2 Gemini calls; DB batching
    // wouldn't help when the concurrency bottleneck is the embedding/audio-analysis call.
    let query = supabase
      .from("trending_sounds")
      .select("id, sound_name, sound_url")
      .is("audio_embedding", null)
      .order("id", { ascending: true })
      .limit(1);
    if (cursor) {
      query = query.gt("id", cursor);
    }
    const { data: rows, error: fetchError } = await query;
    if (fetchError) {
      console.error("[backfill] Fetch failed:", fetchError.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) {
      console.log(
        `[backfill] Done — processed ${processedCount} sounds, skipped ${skippedCount}`,
      );
      break;
    }

    const row = rows[0] as TrendingSoundRow;
    cursor = row.id;

    // Step 0: sound_url precondition (NON-FATAL — skip this row, advance cursor)
    if (!row.sound_url) {
      console.warn(`[backfill] Row id=${row.id} has no sound_url; skipping`);
      skippedCount += 1;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Step (a): download (NON-FATAL on failure)
    const downloaded = await downloadAudio(row.sound_url);
    if (!downloaded) {
      skippedCount += 1;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Steps (b) + (c): upload + describe (NON-FATAL; cleanup ALWAYS runs after).
    // The carrier object captures uploadedName as soon as the Files API upload returns,
    // so cleanup can run even when generateContent throws afterwards.
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
      console.warn(
        `[backfill] Audio analysis failed for row id=${row.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    if (!description) {
      // Cleanup even when describe failed mid-way (uploadedName may have been set).
      await cleanupUploadedFile(ai, carrier.uploadedName);
      skippedCount += 1;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Step (d): embed (NON-FATAL)
    let vector: number[] | null = null;
    try {
      vector = await embedDescription(ai, description);
    } catch (err) {
      console.warn(
        `[backfill] Embed failed for row id=${row.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Cleanup Gemini Files API resource regardless of embed outcome.
    await cleanupUploadedFile(ai, carrier.uploadedName);

    if (!vector) {
      skippedCount += 1;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    // Step (e): upsert audio_embedding + audio_description (NON-FATAL; next run retries this row)
    const { error: updateError } = await supabase
      .from("trending_sounds")
      .update({
        // pgvector accepts number[] at runtime; database.types declares string for serialization.
        audio_embedding: vector as unknown as string,
        audio_description: description,
      })
      .eq("id", row.id);
    if (updateError) {
      console.warn(
        `[backfill] Update failed for row id=${row.id}:`,
        updateError.message,
      );
      skippedCount += 1;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    processedCount += 1;
    console.log(
      `[backfill] Processed id=${row.id} sound_name="${row.sound_name}" (description ${description.length} chars)`,
    );
    await sleep(RATE_LIMIT_MS);
  }
}

// CLI guard — auto-run only when invoked directly (not when imported by tests).
// Works under tsx (CJS interop) AND under raw node. Tests import { main } and call it explicitly.
if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error("[backfill] Fatal:", err);
    process.exit(1);
  });
}
