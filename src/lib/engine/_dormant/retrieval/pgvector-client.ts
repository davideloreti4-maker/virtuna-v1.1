/**
 * Phase 8 — Supabase RPC wrappers for pgvector top-K cosine retrieval.
 *
 * Two functions, one per pool:
 *  - matchTrainingCorpus → calls RPC `match_corpus_videos` (Plan 01 migration)
 *  - matchScrapedVideos  → calls RPC `match_scraped_videos`  (Plan 01 migration)
 *
 * Both accept a nullable platform + nullable followerTier; the SQL functions
 * implement the `IS NULL OR x = filter` guard so D-04 Tier 2/3 hierarchical
 * relaxation works without alternate function variants.
 *
 * No retry/backoff here — RPC failures are surfaced via thrown Error; the
 * caller (Plan 04 retrieval-stage.ts) wraps in try/catch + graceful degradation
 * per Phase 1 D-rule.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One row returned by either RPC. `bucket_label` is populated for training_corpus
 * (Phase 1 labels) and NULL for scraped_videos (Plan 04 derives at retrieval time
 * via bucket-derivation.ts). `follower_count` is NULL for scraped_videos.
 */
export interface MatchRow {
  source_id: string;
  similarity: number;
  source_pool: "training_corpus" | "scraped_videos";
  video_url: string | null;
  creator_handle: string | null;
  caption: string | null;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number | null;
  hashtags: string[];
  posted_at: string | null;
  bucket_label: "viral" | "average" | "under" | null;
  niche: string;
  follower_count: number | null;
}

/**
 * D-04 filter dimensions:
 *  - niche: required — gates the entire candidate space (never relaxed)
 *  - platform: nullable — D-04 Tier 3 drops this
 *  - followerTier: nullable — D-04 Tier 2/3 drop this
 *
 * Note: for training_corpus, `niche` must be the corpus form ('edu' not 'education').
 * The caller is responsible for applying CORPUS_NICHE_ALIASES from bucket-derivation.ts
 * at the boundary.
 */
export interface MatchOptions {
  embedding: number[];
  count: number;
  niche: string;
  platform: string | null;
  followerTier: string | null;
}

export async function matchTrainingCorpus(
  supabase: SupabaseClient,
  opts: MatchOptions,
): Promise<MatchRow[]> {
  const { data, error } = await supabase.rpc("match_corpus_videos", {
    query_embedding: opts.embedding,
    match_count: opts.count,
    filter_niche: opts.niche,
    filter_platform: opts.platform,
    filter_follower_tier: opts.followerTier,
  });
  if (error) {
    throw new Error(`match_corpus_videos RPC failed: ${error.message}`);
  }
  return (data ?? []) as MatchRow[];
}

export async function matchScrapedVideos(
  supabase: SupabaseClient,
  opts: MatchOptions,
): Promise<MatchRow[]> {
  const { data, error } = await supabase.rpc("match_scraped_videos", {
    query_embedding: opts.embedding,
    match_count: opts.count,
    filter_niche: opts.niche,
    filter_platform: opts.platform,
    filter_follower_tier: opts.followerTier,
  });
  if (error) {
    throw new Error(`match_scraped_videos RPC failed: ${error.message}`);
  }
  return (data ?? []) as MatchRow[];
}
