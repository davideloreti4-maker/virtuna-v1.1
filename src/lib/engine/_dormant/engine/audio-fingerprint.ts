/**
 * Phase 6 audio fingerprint stage.
 *
 * DEFERRED to M2: embedding model migration required (gemini-embedding-001 → DashScope
 * tongyi-embedding-vision-flash). Changing the model invalidates all existing pgvector data in
 * trending_sounds — a one-time re-embedding job is needed before re-enabling this stage.
 *
 * Graceful degradation contract (HARD-03): this function NEVER throws and always returns null.
 * Audio weight (5%) redistributes via selectWeights() automatically when this returns null.
 */

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioFingerprintResult } from "./types";

const log = createLogger({ module: "audio_fingerprint" });

export async function matchAudioFingerprint(
  _audioDescription: string | null | undefined,
  _supabase: SupabaseClient,
): Promise<AudioFingerprintResult | null> {
  // DEFERRED to M2 — re-embedding job required before this stage can use DashScope embeddings.
  log.debug("Audio fingerprint deferred to M2");
  return null;
}
