/**
 * Phase 8 — Gemini embedding wrapper + D-06 subject-text formula.
 *
 * Single source of truth for the embedding subject text used at backfill time
 * (Plan 05 + Path 1/Path 2 auto-embed) and predict time (Plan 04 retrieval-stage).
 * buildSubjectText MUST produce byte-identical output across paths — cosine
 * similarity is only meaningful when both sides go through this function.
 *
 * Model: gemini-embedding-001 (768d) — RESEARCH Finding 1 supersedes D-05's
 * deprecated text-embedding-004 (shut down 2026-01-14). outputDimensionality:
 * 768 preserves D-05's 768d intent and the migration's vector(768) columns.
 */

import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "retrieval.embedder" });

// RESEARCH Finding 1: D-05's text-embedding-004 was shut down 2026-01-14.
// gemini-embedding-001 is the GA replacement; outputDimensionality: 768 preserves D-05's 768-d intent.
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
export const EMBEDDING_DIM = 768;

// Cost: gemini-embedding-001 = $0.15/M input tokens, 0 output.
// Conservative estimate: text.length / 4 chars per token.
const INPUT_PRICE_PER_TOKEN = 0.15 / 1_000_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;
const SYNC_BATCH_LIMIT = 100;
const CAPTION_MAX_CHARS = 500;

/**
 * WR-03: classify Gemini API errors as transient vs permanent.
 * Permanent (4xx / shape) errors throw immediately so the caller's graceful-empty
 * path fires fast instead of burning MAX_RETRIES * RETRY_BASE_DELAY_MS of latency
 * on errors that retrying cannot fix.
 *
 * Transient = network failures + rate-limit / quota (RESOURCE_EXHAUSTED, 429, 503)
 *           + the response-shape errors thrown below (those are usually retried
 *             successfully on the next attempt when the SDK delivered a partial
 *             batch).
 * Permanent = 4xx auth/permission errors (401, 403), 400 malformed-input errors,
 *             and explicit invalid-argument errors that retrying will not fix.
 */
export function isTransientGeminiError(err: unknown): boolean {
  const e = err instanceof Error ? err : null;
  const msg = (e?.message ?? String(err)).toLowerCase();
  const cause =
    e?.cause && typeof e.cause === "object"
      ? String((e.cause as Error).message ?? e.cause).toLowerCase()
      : "";

  // Permanent — bail out immediately.
  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("unauthorized") ||
    msg.includes("permission_denied") ||
    msg.includes("invalid argument") ||
    msg.includes("invalid_argument") ||
    msg.includes("400 ") ||
    msg.includes("bad request")
  ) {
    return false;
  }

  // Transient — retry with backoff.
  if (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("deadline_exceeded") ||
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("und_err_") ||
    cause.includes("econnreset") ||
    cause.includes("etimedout") ||
    cause.includes("und_err_")
  ) {
    return true;
  }

  // Embedding-batch shape mismatch — retry once in case the SDK delivered
  // a partial batch (rare, but observed in early gemini-embedding-001 traffic).
  if (msg.includes("embedding batch shape unexpected") || msg.includes("embedding batch dim unexpected")) {
    return true;
  }

  // Unknown — be conservative and treat as transient so we don't lose retries
  // on legitimate but unclassified network blips. Cost of one extra attempt
  // is bounded; cost of dropping a valid retry is a backfill failure.
  return true;
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * D-06 subject text — SINGLE SOURCE OF TRUTH.
 * MUST be byte-identical at backfill time (Plans 05 + Path 1/Path 2 auto-embed)
 * and predict time (Plan 04 retrieval-stage).
 *
 * Formula: "[niche:{primary_slug}] @{handle}: {caption_or_empty}\n{space_joined_hashtags}"
 *  - primary_slug from training_corpus.niche OR Phase 4 wave0Result.niche.primary
 *    at predict time. (training_corpus uses 'edu'; predict-time uses 'education'
 *    — the alias inverts at backfill in orchestrator.ts per RESEARCH lines 1074.)
 *  - handle: lowercase; empty string when null
 *  - caption: max 500 chars; empty string when null
 *  - hashtags: each prefixed with #, space-joined; empty string when null
 *
 * Cosine similarity is meaningful ONLY when both sides go through this function.
 * Do NOT inline the formula.
 */
export function buildSubjectText(input: {
  primary_slug: string | null;
  creator_handle: string | null;
  caption: string | null;
  hashtags: string[] | null;
}): string {
  const slug = input.primary_slug ?? "";
  const handle = (input.creator_handle ?? "").toLowerCase();
  const caption = (input.caption ?? "").slice(0, CAPTION_MAX_CHARS);
  const tags = (input.hashtags ?? []).map((h) => `#${h}`).join(" ");
  return `[niche:${slug}] @${handle}: ${caption}\n${tags}`;
}

function estimateCostCents(texts: string[]): number {
  const totalTokens = texts.reduce(
    (sum, t) => sum + Math.ceil(t.length / 4),
    0,
  );
  return totalTokens * INPUT_PRICE_PER_TOKEN * 100;
}

/**
 * Predict-time path. Single embedding, RETRIEVAL_QUERY task type
 * (asymmetric retrieval — queries optimized differently from documents).
 *
 * Throws on shape mismatch (caller catches and degrades gracefully via the
 * retrieval-stage's outer try/catch per Phase 1 graceful-degradation D-rule).
 */
export async function embedQuery(
  text: string,
): Promise<{ vector: number[]; cost_cents: number }> {
  const ai = getClient();
  const start = performance.now();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [text],
    config: {
      outputDimensionality: EMBEDDING_DIM,
      taskType: "RETRIEVAL_QUERY",
    },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding response shape unexpected: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}`,
    );
  }
  const cost_cents = estimateCostCents([text]);
  const duration_ms = Math.round(performance.now() - start);
  log.info("Embedded query", {
    duration_ms,
    dims: values.length,
    cost_cents: +cost_cents.toFixed(6),
  });
  Sentry.addBreadcrumb({
    category: "engine.retrieval.embedder",
    message: "Embedded query",
    level: "info",
    data: {
      duration_ms,
      cost_cents: +cost_cents.toFixed(6),
    },
  });
  return { vector: values, cost_cents };
}

/**
 * Backfill / batch path. Sync batch of ≤100 texts, RETRIEVAL_DOCUMENT task type.
 * Wraps a retry loop with linear backoff for transient errors. Caller (orchestrator,
 * apify webhook handler, embed-corpus.ts) is expected to wrap in try/catch — embed
 * failures should not block insert paths (additive-only milestone constraint).
 */
export async function embedBatch(
  texts: string[],
): Promise<{ vectors: number[][]; cost_cents: number }> {
  if (texts.length === 0) return { vectors: [], cost_cents: 0 };
  if (texts.length > SYNC_BATCH_LIMIT) {
    throw new Error(
      `embedBatch: sync batch limit is ${SYNC_BATCH_LIMIT}; got ${texts.length}. Split caller-side.`,
    );
  }

  const ai = getClient();
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: {
          outputDimensionality: EMBEDDING_DIM,
          taskType: "RETRIEVAL_DOCUMENT",
        },
      });
      const vectors = (response.embeddings ?? []).map((e) => e.values ?? []);
      if (vectors.length !== texts.length) {
        throw new Error(
          `Embedding batch shape unexpected: ${vectors.length} embeddings for ${texts.length} texts`,
        );
      }
      for (const v of vectors) {
        if (v.length !== EMBEDDING_DIM) {
          throw new Error(
            `Embedding batch dim unexpected: got ${v.length}, expected ${EMBEDDING_DIM}`,
          );
        }
      }
      const cost_cents = estimateCostCents(texts);
      return { vectors, cost_cents };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // WR-03: don't retry permanent errors (401/403/400/invalid_argument) —
      // they will never succeed and just burn MAX_RETRIES * RETRY_BASE_DELAY_MS
      // of latency before the caller's graceful-empty path fires.
      if (!isTransientGeminiError(lastError)) break;
      if (attempt === MAX_RETRIES) break;
      const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  Sentry.captureException(lastError, {
    tags: { stage: "retrieval", source: "embedBatch" },
  });
  throw lastError ?? new Error("embedBatch failed");
}
