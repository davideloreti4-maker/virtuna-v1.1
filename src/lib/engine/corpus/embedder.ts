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



// RESEARCH Finding 1: D-05's text-embedding-004 was shut down 2026-01-14.
// gemini-embedding-001 is the GA replacement; outputDimensionality: 768 preserves D-05's 768-d intent.
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
export const EMBEDDING_DIM = 768;

// Cost: gemini-embedding-001 = $0.15/M input tokens, 0 output.
// Conservative estimate: text.length / 4 chars per token.
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

// DEFERRED to M2: embedding model migration required (gemini-embedding-001 → DashScope).
// embedQuery and embedBatch throw to trigger caller's graceful degradation (retrieval weight=0 in Phase 13).
function getClient(): never {
  throw new Error("Embedding deferred to M2 — re-embedding job required for new model");
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


// DEFERRED to M2: embedQuery and embedBatch always throw — retrieval weight=0 so callers
// degrade gracefully. Re-enable after DashScope embedding model migration + DB re-embed.

export async function embedQuery(
  _text: string,
): Promise<{ vector: number[]; cost_cents: number }> {
  getClient(); // throws — unreachable below
}

export async function embedBatch(
  texts: string[],
): Promise<{ vectors: number[][]; cost_cents: number }> {
  if (texts.length === 0) return { vectors: [], cost_cents: 0 };
  getClient(); // throws — unreachable below
}
