import { createHash } from "node:crypto";
import { createCache } from "@/lib/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import { ENGINE_VERSION } from "@/lib/engine/version";
import type { AnalysisInput, PredictionResult, SignalAvailability } from "@/lib/engine/types";

const log = createLogger({ module: "prediction-cache" });

/** 24h TTL — matches CONTEXT D-09. */
export const L1_TTL_MS = 24 * 60 * 60 * 1000;

const L1 = createCache<PredictionResult>(L1_TTL_MS);

/**
 * Composite cache key — three-part per CONTEXT D-10.
 * Format: `${contentHash}::${ENGINE_VERSION}::${userId}` — string template for debuggability.
 * user_id scoping is the T-03-01 mitigation (cross-tenant leakage prevented at key level).
 */
export function cacheKey(contentHash: string, userId: string): string {
  return `${contentHash}::${ENGINE_VERSION}::${userId}`;
}

/**
 * Deterministic SHA-256 of the input. Per CONTEXT D-10:
 * - video_upload mode → hash of buffer bytes
 * - tiktok_url mode → hash of trimmed URL string
 * - text mode → hash of trimmed content_text
 * Uses node:crypto built-in (zero deps, hardware-accelerated per RESEARCH standard stack).
 */
export function computeContentHash(input: AnalysisInput, videoBuffer?: Buffer): string {
  const h = createHash("sha256");
  if (input.input_mode === "video_upload") {
    if (videoBuffer) {
      h.update(videoBuffer);
    } else if (input.video_storage_path) {
      // No buffer in new signed-URL path — hash the storage path instead.
      h.update(input.video_storage_path.trim());
    }
    return h.digest("hex");
  }
  if (input.input_mode === "tiktok_url" && input.tiktok_url) {
    h.update(input.tiktok_url.trim());
    return h.digest("hex");
  }
  h.update((input.content_text ?? "").trim());
  return h.digest("hex");
}

/**
 * Two-tier lookup: L1 in-memory → L2 Supabase analysis_results SELECT.
 * Returns null on cache miss; <2s typical (CONTEXT D-09 SC#4 target).
 * Per CONTEXT D-15: opts.bypass=true → skip-read.
 */
export async function lookupPredictionCache(
  contentHash: string,
  userId: string,
  opts: { bypass?: boolean } = {},
): Promise<PredictionResult | null> {
  if (opts.bypass) {
    log.debug("cache bypass — read skipped", { contentHash, userId });
    return null;
  }

  const key = cacheKey(contentHash, userId);

  // L1
  const l1 = L1.get(key);
  if (l1) {
    log.debug("cache hit L1", { key });
    return l1;
  }

  // L2 — Supabase analysis_results scoped by (user_id, content_hash, engine_version) within TTL
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - L1_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("user_id", userId)            // CRITICAL — keep filter even with service role (ASVS V4)
    .eq("content_hash", contentHash)
    .eq("engine_version", ENGINE_VERSION)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    log.warn("L2 cache lookup error", { error: error.message });
    return null;
  }
  if (!data) {
    log.debug("cache miss", { key });
    return null;
  }

  const hydrated = rowToPredictionResult(data);
  L1.set(key, hydrated);
  log.debug("cache hit L2 — hydrated L1", { key });
  return hydrated;
}

/**
 * Write a fresh PredictionResult to L1. L2 write is handled by the route's existing INSERT.
 * Per CONTEXT D-15: opts.bypass=true → skip-write (Pitfall 6).
 */
export function populatePredictionCache(
  contentHash: string,
  userId: string,
  result: PredictionResult,
  opts: { bypass?: boolean } = {},
): void {
  if (opts.bypass) {
    log.debug("cache bypass — write skipped", { contentHash, userId });
    return;
  }
  const key = cacheKey(contentHash, userId);
  L1.set(key, result);
  log.debug("cache populated", { key });
}

/**
 * Hydrate a PredictionResult from a raw analysis_results row.
 * JSONB columns (behavioral_predictions, feature_vector, signal_availability) come back as `Json`
 * (≈ unknown); we spread the raw row first then rebuild typed fields on top so the explicit
 * field rebuilds (with defaults) win over `null` JSONB values from the DB.
 * Per RESEARCH Pitfall 5 + Open Question 2.
 */
export function rowToPredictionResult(row: Record<string, unknown>): PredictionResult {
  return {
    // Spread raw row first so unknown columns (Json fields) flow through;
    // explicit fields below override with proper defaults where the DB column may be null.
    ...(row as unknown as Partial<PredictionResult>),
    overall_score: row.overall_score as number,
    confidence: row.confidence as PredictionResult["confidence"],
    engine_version: row.engine_version as string,
    gemini_model: row.gemini_model as string,
    deepseek_model: row.deepseek_model as string,
    behavioral_predictions: row.behavioral_predictions as PredictionResult["behavioral_predictions"],
    feature_vector: row.feature_vector as PredictionResult["feature_vector"],
    factors: row.factors as PredictionResult["factors"],
    suggestions: row.suggestions as PredictionResult["suggestions"],
    signal_availability: (row.signal_availability ?? {
      behavioral: false, gemini: false, ml: false, rules: false, trends: false,
    }) as SignalAvailability,
  } as PredictionResult;
}

/** Test-only — reset L1 between tests. */
export function __resetL1(): void {
  L1.clear();
}
