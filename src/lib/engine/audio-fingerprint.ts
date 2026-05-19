/**
 * Phase 6 audio fingerprint stage (D-A4, D-F0, D-F1, D-F2, D-F3).
 *
 * Embeds the Gemini-emitted audio_description via gemini-embedding-001 (768-dim, SEMANTIC_SIMILARITY)
 * and queries the match_trending_sound_by_audio RPC (shipped by Plan 06-02) for cosine similarity
 * above threshold. Returns the best match (RPC clamps to LIMIT LEAST(match_count, 10) and orders by
 * similarity DESC, so matches[0] is the highest-similarity row) or null on any miss / failure.
 *
 * Graceful degradation contract (HARD-03 + Phase 1 D-04 + Phase 3 D-04 — additive only):
 *   This function NEVER throws. The aggregator and trends.ts fall back to the Jaro-Winkler caption
 *   match when this returns null (per D-F3).
 *
 * Failure semantics (WARNING 6 fix — mirrors src/lib/engine/wave0/content-type-detector.ts:210-219):
 *
 *   - SOFT short-circuit: no audio_description provided → log.debug only, NO Sentry.
 *   - SOFT failure: embedContent responded but emitted no usable embedding values → log.warn only, NO Sentry.
 *   - SOFT failure: Supabase RPC returned an `error` object (not a thrown exception) → log.warn only, NO Sentry.
 *   - SOFT outcome: RPC returned an empty match array (no row above threshold) → log.debug only, NO Sentry.
 *   - HARD failure: any exception thrown by embedContent / RPC / network / parsing is caught by the
 *     OUTER try/catch which calls Sentry.captureException with `{ tags: { stage: "audio_fingerprint" } }`.
 *
 * Pipeline integration: pipeline.ts (Plan 06-05) wraps this in timed("audio_fingerprint", ...) so the
 * stage emits its own SSE stage_start / stage_end pair via the timed() wrapper. This module does NOT
 * emit events itself.
 *
 * Cost: ~$0.0001 per call (gemini-embedding-001 on a 50-150 char description). The pgvector RPC is
 * sub-millisecond at the trending_sounds row counts (~hundreds).
 */

import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioFingerprintResult } from "./types";

const log = createLogger({ module: "audio_fingerprint" });

// Locked to gemini-embedding-001 per Plan 06-02 SUMMARY + RESEARCH §"State of the Art"
// (text-embedding-004 was deprecated 2026-01-14; the migration's vector(768) column is sized for this model).
const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

// 768-dim matches supabase/migrations/20260519000000_phase6_audio_fingerprint.sql (vector(768)).
const EMBEDDING_DIMENSIONALITY = 768;

// Default 0.80 per CONTEXT D-F1; env-overridable for Phase 12 benchmark tuning.
// Non-numeric / invalid env values fall back to 0.80 (fail-open) rather than NaN
// (which would silently disable all pgvector matching — see 06-REVIEW.md WR-01).
const _PARSED_SIMILARITY_THRESHOLD = Number(
  process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD ?? "0.80",
);
const SIMILARITY_THRESHOLD = Number.isFinite(_PARSED_SIMILARITY_THRESHOLD)
  ? _PARSED_SIMILARITY_THRESHOLD
  : 0.80;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Match an audio description against trending_sounds via pgvector cosine similarity.
 *
 * @param audioDescription - 50-150 char description from Gemini's audio_signals.audio_description
 *   (Plan 06-03 owns the prompt extension that produces this field). When null / empty / whitespace,
 *   returns null immediately without calling Gemini. SOFT short-circuit path — log.debug only.
 * @param supabase - Service client passed in by pipeline.ts (Plan 06-05 wires this in Wave 1).
 * @returns AudioFingerprintResult on a match above threshold; null on miss or any failure.
 *
 * Never throws — all errors are caught + logged. Sentry.captureException is ONLY invoked for
 * thrown exceptions (HARD failures); SOFT failures log via createLogger only. See file header for the
 * full Sentry-vs-warn asymmetry rationale (WARNING 6 fix).
 */
export async function matchAudioFingerprint(
  audioDescription: string | null | undefined,
  supabase: SupabaseClient,
): Promise<AudioFingerprintResult | null> {
  // SOFT short-circuit: no description means no fingerprint match. log.debug only — NOT a Sentry event.
  if (!audioDescription || audioDescription.trim().length === 0) {
    log.debug("No audio_description provided — skipping fingerprint match");
    return null;
  }

  try {
    const ai = getClient();

    const response = await ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: audioDescription,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONALITY,
        taskType: "SEMANTIC_SIMILARITY",
      },
    });

    // SOFT failure: Gemini responded but emitted no usable embedding. log.warn only, NO Sentry.
    const queryEmbedding = response.embeddings?.[0]?.values;
    if (!queryEmbedding || queryEmbedding.length === 0) {
      log.warn("embedContent returned no embedding values");
      return null;
    }

    // Supabase's TypeScript types declare `query_embedding: string` because pgvector wire-format is
    // a stringified array; passing a number[] at runtime works (the JS client serializes for us).
    // If database.types.ts later declares the arg as `number[]`, drop the double cast.
    const { data: matches, error } = await supabase.rpc(
      "match_trending_sound_by_audio",
      {
        query_embedding: queryEmbedding as unknown as string,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: 1,
      },
    );

    // SOFT failure: Supabase returned an error object (not a thrown exception). log.warn only, NO Sentry.
    if (error) {
      log.warn("pgvector match failed", { error: error.message });
      return null;
    }

    // SOFT outcome: no row matched above threshold. log.debug — empty matches are expected; not even a warn.
    const best = matches?.[0];
    if (!best) {
      log.debug("No match above threshold", { threshold: SIMILARITY_THRESHOLD });
      return null;
    }

    // Coerce trend_phase string → discriminated-union literal (RPC declares text, our type narrows).
    const phaseRaw = (best as { trend_phase?: string | null }).trend_phase ?? null;
    const trend_phase: AudioFingerprintResult["trend_phase"] =
      phaseRaw === "emerging" ||
      phaseRaw === "rising" ||
      phaseRaw === "peak" ||
      phaseRaw === "declining"
        ? phaseRaw
        : null;

    const result: AudioFingerprintResult = {
      sound_name: best.sound_name,
      sound_url: best.sound_url,
      similarity: Number(best.similarity),
      trend_phase,
      // Supabase numeric columns deserialize as string by default — coerce defensively.
      velocity_score: Number(best.velocity_score) || 0,
    };

    log.info("Audio fingerprint match", {
      sound_name: result.sound_name,
      similarity: result.similarity,
      trend_phase: result.trend_phase,
    });

    return result;
  } catch (error) {
    // HARD failure path — only thrown exceptions reach here. Sentry IS called per WARNING 6 convention.
    Sentry.captureException(error, { tags: { stage: "audio_fingerprint" } });
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Audio fingerprint failed", { error: message });
    return null;
  }
}
