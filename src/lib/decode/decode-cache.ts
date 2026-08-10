/**
 * decode-cache.ts — the corpus stops being a static library and becomes a CACHE OF DECODES.
 *
 * Spec D2: a decoded video never needs decoding again. Apify scrapes fresh on every request;
 * anything new is decoded once and written back, so the second creator asking about a niche hits
 * warm rows. This is what bounds the cost of Apify-first — per-video-ever, not per-request.
 *
 * Rows written here carry `source_pool: "scraped"` so accumulated rows stay distinguishable from
 * the original curated 532 (which are all `curated`; `scraped` had 0 rows before this landed).
 * The plan proposed `"live-scrape"`, but the table's CHECK constraint accepts only
 * `curated | competitor | scraped | expanded` — and Postgres rejects a bad value by RETURNING an
 * error, which a swallow-everything writer turns into a cache that silently stores nothing.
 * `status` is likewise constrained to `metadata | extracted | watched | failed`.
 *
 * Never throws: a cache miss costs a decode, a cache-write failure costs nothing at all. But a
 * returned error IS logged — see the note above.
 */

import type { LiveDecode } from "./live-decode";
import type { AuthorBaseline } from "@/lib/discover/author-baseline";
import { multiplierFor } from "@/lib/discover/author-baseline";
import { accountMultiplier, passesOutlierGate } from "@/lib/grounding/outlier-gate";
import { buildTeardownEmbeddingText } from "@/lib/grounding/embedder";

/** `outlier_teardowns.hook_source` CHECK: native_transcript | caption_fallback | omni. */
const HOOK_SOURCE: Record<LiveDecode["source"], string> = {
  transcript: "native_transcript",
  "caption-only": "caption_fallback",
};

interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
    upsert: (
      row: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => Promise<{ error?: unknown } | unknown>;
  };
}

interface CacheDeps {
  client?: SupabaseLike;
  /** The canonical corpus writer. Injected for tests; defaults to upsertOutlierTeardown. */
  upsertOutlier?: (client: unknown, row: Record<string, unknown>) => Promise<string>;
  /** Batch embedder. Injected for tests; defaults to embedTexts. */
  embedTextsFn?: (texts: string[]) => Promise<number[][]>;
  /**
   * Which niche query sourced this video, when the caller knows. Optional and nullable by the
   * pool's existing convention — the scrape path has no niche CLASSIFICATION (that is a
   * corpus-side backfill), so this is the query facet, not a derived label.
   */
  niche?: string | null;
}

function getClient(deps: CacheDeps): SupabaseLike {
  if (deps.client) return deps.client;
  // Lazy require — keeps the service-role client (and its key) out of any bundle that merely
  // imports the decode types. Same pattern as src/lib/scraping/index.ts.
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { createServiceClient } = require("@/lib/supabase/service");
  return createServiceClient() as SupabaseLike;
}

function loadUpsertOutlier() {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { upsertOutlierTeardown } = require("@/lib/grounding/corpus");
  return upsertOutlierTeardown as (c: unknown, row: Record<string, unknown>) => Promise<string>;
}

function loadEmbedTexts() {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const { embedTexts } = require("@/lib/grounding/embedder");
  return embedTexts as (texts: string[]) => Promise<number[][]>;
}

export async function getCachedDecode(
  platformVideoId: string,
  deps: CacheDeps = {},
): Promise<LiveDecode | null> {
  try {
    const { data } = await getClient(deps)
      .from("outlier_teardowns")
      .select("hook_template, teardown, spoken_hook, hook_source")
      .eq("platform_video_id", platformVideoId)
      .maybeSingle();
    if (!data) return null;

    const row = data as {
      hook_template?: string | null;
      teardown?: Record<string, string> | null;
      spoken_hook?: string | null;
      hook_source?: string | null;
    };
    const t = row.teardown ?? {};
    // A metadata-only corpus row (status 'metadata') has no decode to serve. Returning a
    // half-filled one would let the caller skip the decode it actually needs.
    if (!row.hook_template || !t.structure) return null;

    return {
      hookPattern: row.hook_template,
      structure: t.structure,
      theTurn: t.theTurn ?? "",
      emotionalBeat: t.emotionalBeat ?? "",
      spokenHook: row.spoken_hook ?? null,
      // Provenance comes from the stored column when present; the spoken_hook presence is only
      // a fallback for pre-existing corpus rows written before hook_source was populated.
      source:
        row.hook_source === "caption_fallback"
          ? "caption-only"
          : row.hook_source
            ? "transcript"
            : row.spoken_hook
              ? "transcript"
              : "caption-only",
    };
  } catch {
    return null;
  }
}

export async function storeDecode(
  video: {
    platformVideoId: string;
    videoUrl: string;
    caption: string;
    views: number;
    likes: number;
    hashtags?: string[];
    postedAt?: Date;
    coverUrl?: string;
    author?: { handle: string; fans: number; heart: number; videoCount: number };
  },
  decode: LiveDecode,
  baseline: AuthorBaseline,
  deps: CacheDeps = {},
): Promise<void> {
  try {
    // ── THE WARRANT ─────────────────────────────────────────────────────────
    // A scraped row has no human vouching for it, so the metric is the only thing that earns it
    // a place (retrieve.ts §warrant). The bar is applied on the DURABLE receipt — views ÷
    // followers — which Phase 1 made computable inline for the first time: `authorMeta.fans`
    // rides on every scraped item, so the per-survivor profile scrape §14 required is no longer
    // needed. An absent follower count admits the row (nothing is computable), exactly as the
    // orchestrator's `!g.durable || passesOutlierGate(...)` does.
    const durable = accountMultiplier(video.views, video.author?.fans);
    if (durable && !passesOutlierGate(durable.multiplier)) return;

    // The pool's basis when we have it, the live tile's basis when we do not. The label ALWAYS
    // travels with the number, and the two are never interchanged.
    const receipt = durable
      ? { multiplier: durable.multiplier, label: durable.baselineLabel }
      : { multiplier: multiplierFor(video, baseline), label: baseline.label };

    // ── REACHABILITY ────────────────────────────────────────────────────────
    // Retrieval is cosine over this vector. Without it the row is findable only by exact
    // platform_video_id — which is the one key nobody has when asking about a niche, so an
    // unembedded write-back fills a bucket nothing reads. Degrade-safe: an embed failure writes
    // NULL rather than losing the row (mirrors the orchestrator).
    const embedText = buildTeardownEmbeddingText({
      caption: video.caption,
      hashtags: video.hashtags ?? null,
      spokenHook: decode.spokenHook,
    });
    let embedding: number[] | null = null;
    if (embedText) {
      try {
        const embedFn = deps.embedTextsFn ?? loadEmbedTexts();
        embedding = (await embedFn([embedText]))[0] ?? null;
      } catch (e) {
        console.warn("[decode-cache] embed failed, writing NULL embedding:", e);
      }
    }

    // Delegate to the CANONICAL writer rather than hand-rolling a second upsert: it owns the
    // (platform, platform_video_id) conflict target and durableCover(), which rehosts the
    // ephemeral signed TikTok cover. Persisting that URL directly — as the first cut did —
    // stores a reference that expires.
    const upsert = deps.upsertOutlier ?? loadUpsertOutlier();
    await upsert(getClient(deps), {
      platform: "tiktok",
      platformVideoId: video.platformVideoId,
      videoUrl: video.videoUrl,
      coverUrl: video.coverUrl ?? null,
      creatorHandle: video.author?.handle ?? null,
      // Distinguishes accumulated rows from the original curated corpus (spec assumption 3).
      sourcePool: "scraped",
      views: video.views,
      followerCount: video.author?.fans ?? null,
      outlierMultiplier: receipt.multiplier,
      baselineLabel: receipt.label,
      postedAt: video.postedAt ? video.postedAt.toISOString() : null,
      niche: deps.niche ?? null,
      caption: video.caption,
      hashtags: video.hashtags ?? null,
      spokenHook: decode.spokenHook,
      hookSource: HOOK_SOURCE[decode.source],
      hookTemplate: decode.hookPattern,
      teardown: {
        structure: decode.structure,
        theTurn: decode.theTurn,
        emotionalBeat: decode.emotionalBeat,
      },
      embedding,
      status: "extracted",
    });
  } catch (e) {
    // Best-effort by contract — a ledger hiccup never costs the answer. Logged, not swallowed:
    // upsertOutlierTeardown THROWS on a returned Supabase error, and a silent catch here is how
    // a write-back cache reads as working while storing nothing.
    console.warn("[decode-cache] write-back failed:", e);
  }
}
