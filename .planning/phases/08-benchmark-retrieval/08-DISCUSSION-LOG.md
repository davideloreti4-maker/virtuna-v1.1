# Phase 8: Benchmark Retrieval - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 8-Benchmark Retrieval
**Areas discussed:** Source pool, Evidence shape, Aggregator signal, Filter fallback

---

## Source Pool

| Option | Description | Selected |
|--------|-------------|----------|
| scraped_videos (general pool) | Apify-scraped general TikTok pool, system-wide, large coverage, has outcomes but no bucket label. Matches taxonomy.ts code comment. | |
| training_corpus (labeled 225) | Phase 1 corpus, 5 niches stratified viral/avg/under with bucket labels. Smaller — niche+platform+tier filter may often return <5 matches. | |
| Both (corpus first, scraped fallback) | Query corpus first; top up from scraped_videos when <K. Best of labeled-outcome + breadth. Two embedding columns to maintain. | ✓ (Claude's call) |
| competitor_videos (per-user) | RLS-scoped per-user tracked competitors. Original REQUIREMENTS-02 target. Per-user pool too small; conflicts with taxonomy.ts comment. | |

**User's choice:** "what do you think is the best decision to make here" — user delegated to Claude.
**Notes:** Claude selected "Both (corpus first, scraped fallback)." Reasoning surfaced in CONTEXT.md D-01: bucket-weighted vote signal (chosen below) needs labels — only training_corpus has them; but 225 rows × niche+platform+tier filter often returns <5 — scraped_videos provides breadth AND covers the 5 non-Phase-1 niches (tech, gaming, fashion, music, food). Bucket for scraped_videos matches is derived from Phase 1 calibrated thresholds (5 niches) or engagement-rate percentiles (other 5 niches). REQUIREMENTS-02 reference to `competitor_videos.embedding` is superseded by this decision; CONTEXT.md flags it for plan-time edit.

---

## Evidence Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (IDs + similarity + outcomes) | Smallest payload: id + similarity + raw view/like/share/comment/save counts. No creator handles, no captions. | |
| Rich evidence (recommended) | id + similarity + video_url + creator_handle + caption_snippet + outcomes + hashtags + bucket_label_if_corpus + posted_at. Enough to render a "similar videos" panel without DB joins. | ✓ |
| Rich + thumbnails | Same as Rich plus thumbnail URLs. Requires thumbnail capture from Apify scraper (currently not captured). | |

**User's choice:** Rich evidence (default — recommended).
**Notes:** Locked the data shape now even though the UI surface ships in M2 milestone. Thumbnails explicitly deferred (Apify pipeline doesn't currently capture them). CONTEXT.md D-02 freezes the TypeScript shape; M2 reads it for panel rendering.

---

## Aggregator Signal

| Option | Description | Selected |
|--------|-------------|----------|
| Bucket-weighted vote (recommended) | Similarity-weighted average of bucket values (viral=1, avg=0.5, under=0). Single retrieval_score in [0,1]. Interpretable, aligned with Phase 1 labeling. | ✓ |
| Distance-only signal | Average similarity score of top-K. Measures "in-distribution" but doesn't use outcomes. Weaker predictive signal. | |
| Evidence only — no aggregator signal | Skip SC#5 entirely; retrieval evidence ships as UI surface only. Defer signal contribution to Phase 10. | |

**User's choice:** Bucket-weighted vote (recommended).
**Notes:** Strong signal that retrieval IS a v3 predictive signal, not just sidebar evidence. CONTEXT.md D-03 locks the formula; D-03a adds bucket derivation for scraped_videos matches (Phase 1 thresholds for 5 calibrated niches, engagement-rate percentile fallback for the other 5); D-03b sets initial aggregator weight = 0.05 with proportional ×0.95 redistribution of other weights — Phase 10 will tune.

---

## Filter Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Hierarchical relaxation (recommended) | Strict (niche+platform+tier) → relax tier → relax platform → niche only. Always return up to K results, tagged with `relaxed_to`. | ✓ |
| Strict + warning | Only return matches passing all 3 filters. Empty + warning when <K. | |
| Niche-only filter from day one | Skip platform+tier filters at this phase entirely. Larger pool but less precise (mixes nano + mega creators in same niche). | |

**User's choice:** Hierarchical relaxation (recommended).
**Notes:** Each retrieved item carries `relaxed_to: "strict" | "niche+platform" | "niche_only" | null` indicating which relaxation tier surfaced it. Provides transparency for eval harness to quantify relaxation frequency by niche+platform+tier combo.

---

## Claude's Discretion

The following were not surfaced to the user (consistent with the user's "non-technical, ask user about what the engine DOES not how it's built" preference, carried from Phase 2/3/4 D-rules):

- **Embedding model:** Gemini `text-embedding-004` (768d) — reuses existing GEMINI_API_KEY + @google/genai SDK; no new dependency. Alternative OpenAI text-embedding-3-small (1536d) deferred to Phase 10 evaluation if quality is insufficient.
- **Embedding subject text formula:** locked canonical form `"[niche:{slug}] @{handle}: {caption}\n{hashtags}"` (truncate caption to 500 chars; empty strings for nulls). Must be byte-identical at backfill + predict time for cosine similarity to be meaningful.
- **Pipeline placement:** Wave 1 parallel (sibling to gemini_video_analysis / audio_analysis / creator_context / rule_scoring) — possible because the embedding subject is text-only and doesn't depend on Gemini video analysis output.
- **Index type:** HNSW with cosine distance (`vector_cosine_ops`), m=16 / ef_construction=64 pgvector defaults.
- **Storage columns:** `embedding vector(768)` added to BOTH training_corpus and scraped_videos. `analysis_results.retrieval_evidence JSONB` + `analysis_results.retrieval_score NUMERIC(5,4)`. NO `competitor_videos.embedding` column (REQUIREMENTS-02 superseded).
- **Backfill + auto-embedding on insert:** one-time CLI script `scripts/embed-corpus.ts` (idempotent) + extend `scripts/build-corpus.ts` and `/api/cron/scrape-trending` insert paths to embed on insert.
- **No stage-level retrieval cache:** Phase 3's content-hash prediction cache covers re-uploads; cross-user retrieval cache deferred to Phase 10+ based on hit-rate data.
- **Eval harness `bypassCache` semantics inherited:** retrieval is recomputed on every eval prediction.
- **Soft hashtag re-ranker:** `benchmark_filters.tag_filters` from Phase 4 D-14 used as +5% similarity boost, not hard filter.
- **`min_corpus_size` gate on signal contribution:** below threshold → evidence still returned, but `retrieval_score = null` + `retrieval_pool_too_small` warning + `SignalAvailability.retrieval = false`.
- **File organization:** new modules under `src/lib/engine/retrieval/` (embedder, bucket-derivation, pgvector-client, retrieval-stage, re-ranker) — planner may collapse if files are small.
- **Test surface:** Vitest 80% on new modules; mock supabase + Gemini SDK; integration test for stage event emission; no live pgvector call in CI.

## Deferred Ideas

The following came up during analysis and are noted for future phases:

- **Thumbnail capture for retrieval_evidence** — Apify pipeline currently doesn't capture; deferred to M2 design phase or later.
- **OpenAI text-embedding-3-small upgrade** — fallback if Gemini quality is insufficient; Phase 10 evaluation.
- **Cross-language embedding evaluation** — if Spanish/Portuguese TikTok captions underperform; Phase 10 evaluation.
- **Cross-user retrieval cache** — deferred until hit-rate data exists post-launch.
- **Retrieval refresh on content drift** — embedding subject is static (no view-count input); revisit if a future phase introduces caption editing.
- **`competitor_videos.embedding` for personalized "videos like the ones you track" retrieval** — separate phase if M2 wants this affordance.
- **Phase 10 retrieval signal weight tuning** — 0.05 is the v3.0-dev starting point.
- **Phase 10 source-pool re-evaluation** — if two-pool produces inconsistent signals.
- **HNSW parameter tuning** — m=32 / ef_construction=200 if recall@5 underperforms.
- **Embedding dimension upgrade (768 → 1536)** — bundled with OpenAI swap evaluation.
- **`min_corpus_size` recalibration** — if Phase 8 eval shows the gate firing too often.
- **Aggregator soft-handling of `retrieval_pool_too_small`** — beyond null-redistribution; Phase 10 territory.
