/**
 * Phase 8 — Soft re-ranker for retrieval matches (D-04a).
 *
 * Pure module — no IO, no logger, no Sentry. Takes raw top-K*2 cosine matches,
 * boosts items whose hashtags overlap with the taxonomy's tag_filters for the
 * input video's primary niche, re-sorts, returns top K.
 *
 * IMPORTANT: the bonus is for SORTING ONLY. The original `similarity` field is
 * NEVER mutated — D-02 says `RetrievalEvidenceItem.similarity_score` is the
 * ORIGINAL cosine similarity, not the boosted score. Leaking the bonus into
 * persisted items would pollute D-03's bucket-vote denominator.
 *
 * Hashtag normalization: lowercase + strip leading `#`. Taxonomy `tag_filters`
 * are lowercase without `#` (verified in src/lib/niches/taxonomy.ts); item
 * hashtags may have either form depending on the scrape path.
 */

import { NICHE_TREE } from "@/lib/niches/taxonomy";
import type { MatchRow } from "./pgvector-client";

/** D-04a — +5% per spec ("small re-ranking bonus, e.g. +5%"). */
export const HASHTAG_BONUS = 0.05;

type RelaxedTier = "strict" | "niche+platform" | "niche_only";

/**
 * D-04a soft re-ranker.
 *
 * Caller passes top-K*2 raw matches (from hierarchical relaxation across
 * training_corpus + scraped_videos), the input video's primary niche, and the
 * desired K. Returns up to K items sorted descending by re-ranked similarity.
 *
 * Edge cases handled inline:
 *  - empty matches → empty array
 *  - K=0 → empty array
 *  - niche not in NICHE_TREE → no items get bonus (pass-through sort by similarity)
 *  - item.hashtags null/empty → no overlap → no bonus
 *  - similarity + bonus > 1 → capped at 1 (cosine range is [0,1])
 */
export function softRerank(
  matches: Array<MatchRow & { relaxed_to: RelaxedTier }>,
  inputNiche: string,
  K: number,
): Array<MatchRow & { relaxed_to: RelaxedTier; rerank_score: number }> {
  const niche = NICHE_TREE.find((n) => n.slug === inputNiche);
  const tagFilters = new Set(
    (niche?.benchmark_filters?.tag_filters ?? []).map((t) => t.toLowerCase()),
  );

  const scored = matches.map((m) => {
    const tags = (m.hashtags ?? []).map((t) =>
      t.toLowerCase().replace(/^#/, ""),
    );
    const hasOverlap = tags.some((t) => tagFilters.has(t));
    const rerank_score = hasOverlap
      ? Math.min(1, m.similarity + HASHTAG_BONUS)
      : m.similarity;
    return { ...m, rerank_score };
  });

  scored.sort((a, b) => b.rerank_score - a.rerank_score);
  return scored.slice(0, K);
}
