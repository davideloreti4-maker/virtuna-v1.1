/**
 * grounding/embedder.ts — the teardown-corpus embedding producer.
 *
 * DashScope `text-embedding-v3` (Qwen platform, OpenAI-compatible endpoint via the
 * shared qwen client) at 768 dims — matching the shipped vector(768) HNSW columns.
 * NOT gemini: the gemini-named engine embedders (engine/{retrieval,corpus}/embedder.ts)
 * are dead/deferred; this module is the §13 [A] producer they pointed at.
 *
 * buildTeardownEmbeddingText is the SINGLE SOURCE OF TRUTH for the row-side subject
 * text (§13 [A] LOCKED formula: caption + hashtags + on-screen-text + spoken_hook +
 * idea.angle — topic signal only; structural facets stay OUT, they are columns).
 * Cache-write, backfill, and any future re-embed job MUST all go through it —
 * cosine ranking degrades silently if row texts drift. The query side embeds the
 * raw search query (asymmetric retrieval — standard for topic search).
 */

import type OpenAI from "openai";
import { getQwenClient } from "@/lib/engine/qwen/client";

/** DashScope text-embedding model (env-overridable; v3 supports 768-dim output). */
export const GROUNDING_EMBEDDING_MODEL =
  process.env.QWEN_EMBEDDING_MODEL ?? "text-embedding-v3";
/** Must match the migration's extensions.vector(768) columns + HNSW indexes. */
export const GROUNDING_EMBEDDING_DIM = 768;
/** DashScope caps text-embedding batch input at 10 strings per request. */
const BATCH_LIMIT = 10;
/** Keep each subject text well under the 8192-token input cap. */
const TEXT_MAX_CHARS = 2000;

/** Row-side fields feeding the §13 topical formula. All optional — skip empties. */
export interface TeardownEmbeddingInput {
  caption?: string | null;
  hashtags?: string[] | null;
  /** On-screen text — only the (future) omni watch tier fills this; empty today. */
  onScreenText?: string | null;
  spokenHook?: string | null;
  ideaAngle?: string | null;
}

/**
 * §13 [A] LOCKED topical subject text. Segments joined by newline, empties skipped,
 * hashtags space-joined with # prefixes. Returns "" when NO segment has signal —
 * callers must not embed an empty text (skip the row instead).
 */
export function buildTeardownEmbeddingText(input: TeardownEmbeddingInput): string {
  const tags = (input.hashtags ?? [])
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const segments = [
    input.caption?.trim() ?? "",
    tags,
    input.onScreenText?.trim() ?? "",
    input.spokenHook?.trim() ?? "",
    input.ideaAngle?.trim() ?? "",
  ].filter(Boolean);
  return segments.join("\n").slice(0, TEXT_MAX_CHARS);
}

/**
 * Embed a batch of texts (chunked to the DashScope 10-per-request cap, chunks in
 * parallel). Returns vectors aligned 1:1 with `texts`. Throws on API failure or a
 * dimension mismatch — callers own degradation (cache-write degrades to embedding
 * NULL; read-back degrades to the scrape path).
 */
export async function embedTexts(
  texts: string[],
  deps: { client?: OpenAI } = {},
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = deps.client ?? getQwenClient();

  const chunks: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    chunks.push(texts.slice(i, i + BATCH_LIMIT));
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      client.embeddings.create({
        model: GROUNDING_EMBEDDING_MODEL,
        input: chunk,
        dimensions: GROUNDING_EMBEDDING_DIM,
        encoding_format: "float",
      }),
    ),
  );

  const vectors: number[][] = [];
  for (const res of results) {
    // DashScope returns data with `index` per item — order within a chunk is preserved,
    // but sort defensively before concatenating.
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const item of sorted) vectors.push(item.embedding);
  }

  if (vectors.length !== texts.length) {
    throw new Error(
      `embedTexts: expected ${texts.length} vectors, got ${vectors.length}`,
    );
  }
  for (const v of vectors) {
    if (v.length !== GROUNDING_EMBEDDING_DIM) {
      throw new Error(
        `embedTexts: expected ${GROUNDING_EMBEDDING_DIM}-dim vectors, got ${v.length}`,
      );
    }
  }
  return vectors;
}

/** Embed ONE query string (read-back side). Throws on failure — caller degrades. */
export async function embedQueryText(
  text: string,
  deps: { client?: OpenAI } = {},
): Promise<number[]> {
  const [vector] = await embedTexts([text], deps);
  if (!vector) throw new Error("embedQueryText: no vector returned");
  return vector;
}
