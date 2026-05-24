/**
 * Phase 8 Plan 04 — runBenchmarkRetrieval orchestrator (Wave 1 sibling).
 *
 * Wires Plan 03 leaf modules (embedder + pgvector-client + re-ranker +
 * bucket-derivation) into a single Wave-1 stage with D-04 3-tier hierarchical
 * relaxation, D-04a soft hashtag re-ranker, D-04b min_corpus_size gate, and
 * D-09 graceful degradation.
 *
 * Self-emits stage_start / stage_end events — pipeline.ts MUST NOT wrap this in
 * timed("retrieval", ...) (would double-emit; see PATTERNS Critical Cross-File
 * Constraint #3).
 *
 * On any error: returns { evidence: [], score: null, availability: false,
 * cost_cents: <whatever-accrued> } — never throws (BENCH-05 invariant: retrieval
 * failure must NEVER break the prediction pipeline).
 */

import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import {
  emitStageStart,
  emitStageEnd,
  type StageEventCallback,
} from "@/lib/engine/events";
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import { getFollowerTier } from "@/lib/engine/corpus/follower-tier";
import type { CreatorContext } from "@/lib/engine/creator";
import type {
  ContentPayload,
  Wave0Result,
  BenchmarkRetrievalResult,
  RetrievalEvidenceItem,
} from "@/lib/engine/types";

import { buildSubjectText, embedQuery } from "./embedder";
import {
  matchTrainingCorpus,
  matchScrapedVideos,
  type MatchRow,
} from "./pgvector-client";
import { softRerank } from "./re-ranker";
import {
  deriveBucket,
  bucketValue,
  CORPUS_NICHE_ALIASES,
} from "./bucket-derivation";

const log = createLogger({ module: "retrieval.stage" });

/** D-02 — max evidence items returned. */
const K = 5;
/** D-04a over-fetch budget for the soft re-ranker. K * 2 = 10. */
const K_REC = 10;
/** D-02 — caption snippet length on RetrievalEvidenceItem. */
const CAPTION_SNIPPET_LEN = 160;

type Tier = "strict" | "niche+platform" | "niche_only";
type MatchWithTier = MatchRow & { relaxed_to: Tier };

const GRACEFUL_EMPTY: BenchmarkRetrievalResult = {
  evidence: [],
  score: null,
  availability: false,
  cost_cents: 0,
};

export interface RunBenchmarkRetrievalInput {
  payload: ContentPayload;
  creatorContext: CreatorContext;
  wave0Result: Wave0Result;
  supabase: SupabaseClient;
  onEvent?: StageEventCallback;
  requestId?: string;
}

/**
 * Wave 1 retrieval stage. Returns a BenchmarkRetrievalResult — never throws.
 *
 * Flow (D-04):
 *  1. Build subject text (D-06) + embed once (Gemini RETRIEVAL_QUERY).
 *  2. For each tier T1→T3, query training_corpus then scraped_videos until
 *     K_REC=10 raw matches are collected. Higher tiers preserved as more
 *     authoritative (no replacement once collected).
 *  3. Apply soft hashtag re-ranker (D-04a) → top K=5 items.
 *  4. Derive bucket per item (D-03a) — corpus carry-forward or threshold-based.
 *  5. D-04b gate: if total pool < min_corpus_size, score=null + availability=false
 *     (evidence preserved for transparency per CONTEXT D-04b).
 *  6. D-03 score: Σ(similarity_i · bucket_value(item_i)) / Σ(similarity_i).
 *
 * Note: similarity_score in the persisted RetrievalEvidenceItem is the RAW
 * cosine similarity (m.similarity), NOT softRerank's rerank_score (the +5%
 * hashtag bonus is for sorting only — see re-ranker.ts module comment).
 */
export async function runBenchmarkRetrieval(
  input: RunBenchmarkRetrievalInput,
): Promise<BenchmarkRetrievalResult> {
  const { payload, creatorContext, wave0Result, supabase, onEvent, requestId } =
    input;
  const startTs = emitStageStart(onEvent, "retrieval", 1);
  let costCents = 0;

  try {
    // D-09 graceful guard — niche unknown means retrieval is not viable.
    // D-17: niche shape changed from { primary, ... } to { primary_slug, ... }
    const primary = wave0Result.niche?.primary_slug ?? null;
    if (!primary) {
      log.info("Retrieval skipped — no niche primary from Wave 0");
      emitStageEnd(onEvent, "retrieval", 1, startTs, {
        cost_cents: 0,
        ok: true,
      });
      return GRACEFUL_EMPTY;
    }

    // D-04 filter dimensions. Card 0 platform defaults to 'tiktok' per CONTEXT.
    const platform = creatorContext.target_platforms?.[0] ?? "tiktok";
    const followerTier = getFollowerTier(creatorContext.follower_count) ?? null;

    // D-06 — subject text + Gemini embedding (single call per prediction).
    const subject = buildSubjectText({
      primary_slug: primary,
      creator_handle: payload.creator_handle ?? null,
      caption: payload.content_text ?? null,
      hashtags: payload.hashtags ?? null,
    });
    const { vector, cost_cents: embedCost } = await embedQuery(subject);
    costCents += embedCost;

    // Niche alias direction (RESEARCH lines 1026-1028 + 1074):
    //  - training_corpus stores 'edu' (per migration CHECK constraint)
    //  - scraped_videos stores NICHE_TREE form ('education')
    const corpusNiche = CORPUS_NICHE_ALIASES[primary] ?? primary;

    // D-04 — 3-tier hierarchical relaxation.
    const collected: MatchWithTier[] = [];
    const seenIds = new Set<string>();

    const tiers: Array<{
      tag: Tier;
      platform: string | null;
      followerTier: string | null;
    }> = [
      { tag: "strict", platform, followerTier }, // T1 — niche+platform+tier
      { tag: "niche+platform", platform, followerTier: null }, // T2 — drop tier
      { tag: "niche_only", platform: null, followerTier: null }, // T3 — drop platform+tier
    ];

    for (const tier of tiers) {
      if (collected.length >= K_REC) break;
      const need = K_REC - collected.length;

      // Corpus first (D-01 — labeled-outcome retrieval is more authoritative).
      try {
        const corpusRows = await matchTrainingCorpus(supabase, {
          embedding: vector,
          count: need,
          niche: corpusNiche,
          platform: tier.platform,
          followerTier: tier.followerTier,
        });
        for (const r of corpusRows) {
          if (seenIds.has(r.source_id)) continue;
          seenIds.add(r.source_id);
          collected.push({ ...r, relaxed_to: tier.tag });
          if (collected.length >= K_REC) break;
        }
      } catch (err) {
        log.warn("matchTrainingCorpus failed within tier", {
          tier: tier.tag,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      if (collected.length >= K_REC) break;

      // Scraped fallback (D-01 — breadth/niche-coverage).
      const remaining = K_REC - collected.length;
      try {
        const scrapedRows = await matchScrapedVideos(supabase, {
          embedding: vector,
          count: remaining,
          niche: primary,
          platform: tier.platform,
          followerTier: tier.followerTier,
        });
        for (const r of scrapedRows) {
          if (seenIds.has(r.source_id)) continue;
          seenIds.add(r.source_id);
          collected.push({ ...r, relaxed_to: tier.tag });
          if (collected.length >= K_REC) break;
        }
      } catch (err) {
        log.warn("matchScrapedVideos failed within tier", {
          tier: tier.tag,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // D-04a soft hashtag re-ranker — sorts by boosted similarity, returns top K.
    const reranked = softRerank(collected, primary, K);

    // D-04b gate. Note: total candidate POOL (collected.length) — NOT the
    // surviving K. A small pool means low statistical confidence regardless of
    // how good the top matches look.
    const taxNode = NICHE_TREE.find((n) => n.slug === primary);
    const minCorpusSize = taxNode?.benchmark_filters?.min_corpus_size ?? 0;
    const poolTooSmall = collected.length < minCorpusSize;

    // Build evidence items (D-02 shape).
    const evidence: RetrievalEvidenceItem[] = reranked.map((m) => {
      const { bucket_label, bucket_source } = deriveBucket({
        source_pool: m.source_pool,
        bucket_label: m.bucket_label,
        niche: m.niche,
        views: m.views,
        likes: m.likes,
        shares: m.shares,
        comments: m.comments,
        saves: m.saves,
      });
      return {
        source_pool: m.source_pool,
        source_id: m.source_id,
        // RAW cosine — re-rank bonus is sort-key only (D-04a). Persisting
        // the boosted value would pollute D-03's bucket-vote denominator.
        similarity_score: m.similarity,
        video_url: m.video_url,
        creator_handle: m.creator_handle,
        caption_snippet: m.caption
          ? m.caption.slice(0, CAPTION_SNIPPET_LEN)
          : null,
        views: m.views,
        likes: m.likes,
        shares: m.shares,
        comments: m.comments,
        saves: m.saves,
        hashtags: m.hashtags ?? [],
        posted_at: m.posted_at,
        bucket_label,
        bucket_source,
        relaxed_to: m.relaxed_to,
      };
    });

    // D-03 score formula: similarity-weighted bucket vote.
    //   score = Σ(similarity_i · bucket_value(bucket_i)) / Σ(similarity_i)
    // null when zero evidence OR D-04b pool-too-small gate fires.
    let score: number | null = null;
    if (evidence.length > 0 && !poolTooSmall) {
      const numerator = evidence.reduce(
        (s, e) => s + e.similarity_score * bucketValue(e.bucket_label),
        0,
      );
      const denominator = evidence.reduce(
        (s, e) => s + e.similarity_score,
        0,
      );
      score = denominator > 0 ? numerator / denominator : null;
    }

    const availability = score !== null;
    if (poolTooSmall) {
      log.warn("retrieval_pool_too_small", {
        niche: primary,
        pool_size: collected.length,
        min_corpus_size: minCorpusSize,
      });
    }

    emitStageEnd(onEvent, "retrieval", 1, startTs, {
      cost_cents: costCents,
      ok: true,
    });
    log.info("Retrieval complete", {
      evidence_count: evidence.length,
      score,
      availability,
      cost_cents: +costCents.toFixed(6),
    });
    return { evidence, score, availability, cost_cents: costCents };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.warn("Retrieval stage failed; degrading gracefully", { error: msg });
    Sentry.captureException(error, {
      tags: {
        stage: "retrieval",
        source: "retrieval-stage",
        requestId: requestId ?? "unknown",
      },
    });
    emitStageEnd(onEvent, "retrieval", 1, startTs, {
      cost_cents: costCents,
      ok: false,
      warning: msg,
    });
    return { ...GRACEFUL_EMPTY, cost_cents: costCents };
  }
}
