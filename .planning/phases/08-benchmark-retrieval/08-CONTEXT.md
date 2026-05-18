# Phase 8: Benchmark Retrieval - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the first retrieval-augmented signal in the prediction pipeline. Three coupled artifacts:

1. **pgvector embedding storage** — enable the `vector` extension in Supabase, add an `embedding vector(768)` column + HNSW cosine-distance index to BOTH `training_corpus` AND `scraped_videos`. (Two pools, one for labeled-outcome retrieval and one for breadth/niche-coverage; see D-01.)

2. **Backfill embedding pipeline (one-time)** — Gemini `text-embedding-004` (768d) on `caption + hashtags + creator_handle + primary_niche_slug` for every row in both pools at the time Phase 8 ships. Idempotent script callable from the CLI (`pnpm tsx scripts/embed-corpus.ts`) for re-runs if the embedding subject formula changes. Backfill cost is trivial (<$1 total) — fits the milestone budget without revisiting it.

3. **Predict-time retrieval stage in Wave 1 parallel** — new `runBenchmarkRetrieval(payload, creatorContext, onStageEvent)` step alongside the existing Wave 1 siblings (gemini_video_analysis / audio_analysis / creator_context / rule_scoring). Embeds the input video's `(caption + hashtags + creator_handle + primary_niche_slug)` ONCE, runs two pgvector top-K queries (corpus first, scraped fallback), applies hierarchical filter relaxation (D-04), and returns a `retrieval_evidence` array of up to K=5 rich-shape items (D-02) plus a single `retrieval_score` in [0,1] for the aggregator (D-03). Emits its own `retrieval` stage_start + stage_end events (Phase 3 D-01 granularity). Wave 1 parallel placement is possible BECAUSE the embedding subject is text-only and does not depend on Gemini video analysis.

**Plus aggregator extension:**

4. **`retrieval` signal in aggregator + SignalAvailability** — extend `SignalAvailability` (Phase 3 D-07 forward-compat) with `retrieval: boolean`; aggregator includes the retrieval score at a LOW initial weight (~0.05 of overall). The actual weight is tuned by Phase 10 (ML Audit + Calibration + Aggregator Extension) using corpus benchmark evidence. Phase 8 ships the wiring + a defensible default; Phase 10 owns the calibration.

**Out of scope this phase:**
- Final weight calibration for the retrieval signal in the aggregator — Phase 10 owns this against corpus benchmark evidence.
- User-facing UI to render the retrieval_evidence on the prediction result page — M2 ("Intelligence Surface") milestone. Phase 8 ships the data shape; M2 designs the panel.
- Thumbnail capture for retrieval_evidence — deferred until M2 confirms the panel uses them (Apify scrape pipeline does not currently capture thumbnails — would require a separate plumbing pass).
- Embedding refresh / re-embedding pipeline on scraped_videos cron — Phase 8 ships the one-time backfill + per-insert embedding for new rows; full re-embedding-on-content-change is deferred until eval evidence shows drift.
- `competitor_videos.embedding` column — REQUIREMENTS-02 references it but D-01 rejects competitor_videos as the source pool. The column is NOT created in Phase 8; if a future phase wants per-user "videos like the ones you track" retrieval, that's a separate pool with its own column.
- Cross-language embedding evaluation — Phase 8 ships with default Gemini multilingual embedding; if eval shows underperformance on non-English captions, Phase 10 can revisit.

</domain>

<decisions>
## Implementation Decisions

### Source Pool (foundational — affects every downstream artifact)

- **D-01: Two-pool retrieval — `training_corpus` first, `scraped_videos` as breadth fallback.** Locks the central conflict between REQUIREMENTS-02 (which named `competitor_videos.embedding`) and the Phase 4 `taxonomy.ts` code comment (which named `scraped_videos`). Reasoning:
  - `training_corpus` (225 rows, Phase 1) is small but **carries bucket labels** (`viral` / `average` / `under`), which the bucket-weighted vote signal (D-03) reads directly. It covers only 5 niches (beauty, fitness, edu, comedy, lifestyle).
  - `scraped_videos` (Apify cron pool, system-wide, much larger) covers ALL 10 NICHE_TREE primaries and provides breadth when the corpus filter returns fewer than K matches or when the input video is in a non-Phase-1 niche (tech, gaming, fashion, music, food). It has engagement counters but NO bucket label — Phase 8 **derives bucket at retrieval time** using Phase 1's calibrated thresholds (`THRESHOLD_SNAPSHOTS["full.2026-05-11"]` in `src/lib/engine/corpus/thresholds.ts`) for the 5 calibrated niches, and an engagement-rate (views ÷ follower_count) percentile fallback for the other 5 niches.
  - `competitor_videos` is REJECTED as the retrieval source: it is RLS-scoped per user (would need to bypass RLS via service role anyway), per-user pool sizes are too small to reliably yield K=5 matches after filtering, and the use case described in the roadmap ("similar competitor videos as evidence") is fundamentally a system-wide pattern-match, not a personal-tracked-creator lookup.
  - Retrieval flow (D-04 expands on this): query training_corpus first with strict filter; if fewer than K matches, top up from scraped_videos with the same filter; if still <K, kick in hierarchical relaxation.

- **D-01a: User delegated this decision to Claude.** During discussion the user answered "what do you think is the best decision to make here" — the rationale above is Claude's recommendation. Future re-discussion is allowed if Phase 10's eval evidence shows the two-pool approach is producing inconsistent retrieval scores between corpus-only and scraped-only matches.

### Retrieval Evidence Shape (D-02 — locked)

- **D-02: Rich evidence — interpretable on the prediction result page without joins.** Each `retrieval_evidence` item carries the fields needed to render a "similar videos" panel (M2 surface) without further DB lookups:
  ```ts
  type RetrievalEvidenceItem = {
    source_pool: "training_corpus" | "scraped_videos";
    source_id: string;                              // UUID from the source table
    similarity_score: number;                       // cosine similarity in [0,1]
    video_url: string | null;
    creator_handle: string | null;
    caption_snippet: string | null;                 // first ~160 chars
    views: number;
    likes: number;
    shares: number;
    comments: number;
    saves: number | null;
    hashtags: string[];
    posted_at: string | null;                       // ISO date
    bucket_label: "viral" | "average" | "under";    // direct from corpus row OR derived from thresholds (D-03)
    bucket_source: "corpus" | "derived";            // provenance — corpus_known vs threshold-derived
    relaxed_to: "strict" | "niche+platform" | "niche_only" | null;  // which filter tier produced this match (D-04)
  };
  ```
  Stored on the `analysis_results.retrieval_evidence` column (new JSONB column added in Phase 8 migration). Thumbnails explicitly excluded (deferred). Max 5 items per prediction.

### Aggregator Signal (D-03 — bucket-weighted vote, low initial weight)

- **D-03: Single `retrieval_score` in [0,1] from similarity-weighted bucket vote.** Computed inside the retrieval stage and surfaced both as a top-level `retrieval_score: number` on the pipeline result AND folded into the existing `aggregateScores()` pathway via the `SignalAvailability` mechanism. Formula:
  ```
  bucket_value[viral]   = 1.0
  bucket_value[average] = 0.5
  bucket_value[under]   = 0.0

  retrieval_score = sum( similarity_i * bucket_value(item_i) )
                  ─────────────────────────────────────────────
                                 sum( similarity_i )
  ```
  for i over the up-to-K returned items. Range [0,1]. Returns `null` (and `SignalAvailability.retrieval = false`) when zero matches survive all hierarchical relaxation steps. Aggregator soft-handles null retrieval via existing `selectWeights()` redistribution logic — no special-case code.

- **D-03a: Bucket derivation for scraped_videos matches.** For the 5 calibrated niches (beauty, fitness, edu, comedy, lifestyle), use Phase 1's `THRESHOLD_SNAPSHOTS["full.2026-05-11"]` directly: `views >= viralFloor` → `viral`; `views <= underCeiling` → `under`; else `average`. For the 5 non-Phase-1 niches (tech, gaming, fashion, music, food), use a fallback that buckets by **engagement rate** percentile: compute `engagement_rate = (likes + shares + comments + saves) / max(views, 1)`, P80+ → `viral`, P40- → `under`, else `average`, percentiles computed once over the entire scraped_videos pool at backfill time and snapshotted as a `NON_CORPUS_ENGAGEMENT_PERCENTILES` constant in `src/lib/engine/retrieval/bucket-derivation.ts`. Both paths mark `bucket_source: "derived"` in the evidence item (D-02).

- **D-03b: Initial aggregator weight = 0.05 (LOW, Phase 10 will tune).** Phase 8's job is to ship the wiring + a defensible default. The aggregator's existing `SCORE_WEIGHTS` table gets a new `retrieval: 0.05` entry with redistribution from the other weights:
  ```
  behavioral 0.33 (was 0.35)
  gemini     0.24 (was 0.25)
  ml         0.14 (was 0.15)
  rules      0.14 (was 0.15)
  trends     0.10
  retrieval  0.05  ← new
  ```
  Redistribution is proportional (multiply each existing weight by 0.95). Phase 10 re-tunes the entire vector against corpus benchmark MAE; Phase 8's numbers are the v3.0-dev starting point, not load-bearing. **Phase 10 may move the weight up, down, or to zero — that is expected.** The locked matrix value here is the dev placeholder.

### Filter Behavior (D-04 — hierarchical relaxation)

- **D-04: Three-tier hierarchical relaxation; always return what's available.** Filter dimensions are derived from Phase 4 Wave 0 outputs + creator context:
  - **Tier 1 (strict):** `primary_niche = wave0Result.niche.primary` AND `platform = creatorContext.platforms[0]` AND `follower_tier = creatorContext.follower_tier`. (Platform from Card 0 — defaults to `"tiktok"` when Card 0 is empty. Tier from `creator_profiles.follower_tier` or derived from follower_count.)
  - **Tier 2 (relaxed_tier):** drop the tier filter; keep niche + platform.
  - **Tier 3 (relaxed_platform):** keep only niche; drop platform + tier.
  Each retrieved item is tagged with `relaxed_to` indicating which tier surfaced it (D-02). Stop as soon as we have K=5 matches; do NOT mix relaxation levels in a single query — query tier N, if <K, append tier N+1 query results to bring total to K (preserving the higher-tier matches as more authoritative).

- **D-04a: Use `taxonomy.find(p => p.slug === primary).benchmark_filters.tag_filters` as a soft re-ranker, not a hard filter.** Phase 4 D-14 locked per-niche hashtag preference lists. Use them to re-rank the top-K`*`2 raw cosine matches: items whose hashtags overlap with `tag_filters` get a small re-ranking bonus (e.g., +5% to similarity). Hard filter on `primary_niche` (slug equality) — soft preference on hashtag overlap. Avoids excluding semantically similar videos that happen to use atypical hashtags.

- **D-04b: `min_corpus_size` from `benchmark_filters` gates the retrieval signal contribution, not the evidence.** If the candidate pool for the input video's primary niche (after Tier 3 relaxation) has fewer than `benchmark_filters.min_corpus_size` videos, retrieval evidence is still returned (for transparency) but `retrieval_score` returns `null` + `SignalAvailability.retrieval = false`. Prevents low-confidence signals from polluting the aggregator. Emits a `retrieval_pool_too_small` pipeline warning carrying the niche slug + actual pool size.

### Embedding Pipeline (Claude's Discretion)

- **D-05: Gemini `text-embedding-004` (768d).** Reuses the existing `GEMINI_API_KEY` env var and `@google/genai` SDK — no new dependency, no new billing account, no new env var. 768-dimensional float vectors map naturally to a single `vector(768)` pgvector column. Free quota covers backfill comfortably; per-prediction embedding fits inside Gemini rate limits when scoped to one call/prediction. Rationale honors Phase 4 D-rule signal (user instinct: "modern + cheap unless evidence demands more"). Alternative considered + rejected: OpenAI `text-embedding-3-small` (1536d, $0.02/M) — requires adding `OPENAI_API_KEY` env + a separate billing account. Acceptable for Phase 10 re-evaluation if Gemini embedding quality underperforms in eval, but starting cost-minimal.

- **D-06: Embedding subject text.** Single canonical formula across backfill + predict-time (must be byte-identical for cosine similarity to be meaningful):
  ```
  "[niche:{primary_slug}] @{handle}: {caption_or_empty}\n{space_joined_hashtags}"
  ```
  - `primary_slug` from training_corpus.niche OR Phase 4 wave0Result.niche.primary at predict time.
  - `handle` = `creator_handle`, lowercased; empty string when null.
  - `caption_or_empty` = caption, max 500 chars (truncate longer); empty string when null.
  - `space_joined_hashtags` = `hashtags.map(h => "#" + h).join(" ")`; empty when null.

  Text-only construction means retrieval can fire in Wave 1 PARALLEL (does not depend on Gemini video analysis). Locked here so backfill and predict-time produce vectors in the same space.

- **D-07: HNSW index with cosine distance.** `CREATE INDEX … USING hnsw (embedding vector_cosine_ops)` on both `training_corpus.embedding` and `scraped_videos.embedding`. Modern default for pgvector at the corpus sizes we have (225 + scraped pool). m=16 / ef_construction=64 (pgvector library defaults); planner verifies these against current pgvector docs.

- **D-08: One-time backfill script + on-insert auto-embedding.** New CLI: `scripts/embed-corpus.ts` (idempotent — skips rows where `embedding` is non-null) handles the one-time backfill. New behavior at row-insert time for both tables (training_corpus inserts via `scripts/build-corpus.ts`, scraped_videos inserts via `/api/cron/scrape-trending` and the Apify webhook handler): compute embedding inline and store on insert. **Important:** the existing scrape paths are Phase 1 / Phase 0 territory; Phase 8's plan must extend them WITHOUT breaking the existing flow (additive-only milestone constraint).

### Pipeline Integration & Versioning

- **D-09: Wave 1 parallel placement.** `runBenchmarkRetrieval(payload, creatorContext, wave0Result, onStageEvent)` runs alongside `runGeminiVideoAnalysis()`, `runAudioAnalysis()`, `fetchCreatorContext()` resolution, and `runRuleScoring()` inside the existing Wave 1 `Promise.all(...)`. Reads:
  - `payload.caption` + `payload.hashtags` + `payload.creator_handle` (input video metadata)
  - `wave0Result.niche.primary` (already computed PRE-Wave-1 per Phase 4 D-16)
  - `creatorContext.platforms[0]` + `creatorContext.follower_tier` (already pre-fetched per Phase 4 D-17)

  Emits `retrieval` stage_start + stage_end events with `wave: 1`, `cost_cents` populated (one embedding call ≈ negligible cents at Gemini pricing). Graceful degradation per Phase 1 D-rule: catches all errors, returns `{ evidence: [], score: null, availability: false }`, emits a `retrieval_failed` warning.

- **D-10: `SignalAvailability.retrieval: boolean` extension.** Extends `SignalAvailability` interface (Phase 3 D-07 forward-compat) and the matching JSONB persistence shape. `true` when at least one match survived all relaxation tiers AND `min_corpus_size` gate (D-04b) passed; `false` otherwise. Phase 3 D-07's missing-key default-to-false rule covers backward compat.

- **D-11: `retrieval_evidence` JSONB column + `retrieval_score` column on `analysis_results`.** New migration adds both. JSONB shape per D-02; `retrieval_score` is `NUMERIC(5,4)` nullable. Index NOT added on these columns (read pattern is "fetch single row by id" — no scan).

- **D-12: Eval harness inherits `bypassCache: true` semantics.** Phase 3 D-15 introduced the `bypassCache?: boolean` pipeline option; Phase 8 extends its semantics to also bypass any stage-level retrieval cache (if planner introduces one — see D-13). Every eval-harness prediction produces fresh embedding + fresh retrieval. Prediction cache (Phase 3 D-09) is the only caching layer for retrieval results today — D-13 keeps it that way.

- **D-13: NO stage-level retrieval cache.** Phase 8 does NOT introduce its own per-stage cache layer. The Phase 3 content-hash L1/L2 prediction cache already covers re-uploaded-by-same-user. Cross-user retrieval cache (embed same caption from two users → same result) is a Phase 10+ optimization once we have hit-rate data. Predict-time embedding cost is too low to justify the complexity now (single Gemini embedding call per prediction).

- **D-14: Engine version stays `"3.0.0-dev"` (Phase 3 D-05).** Phase 8 ships under the existing milestone-dev label; Phase 12's acceptance gate flips to `"3.0.0"`. No version-string change in this phase.

### Cost & Telemetry

- **D-15: Cost telemetry.** Retrieval stage_end events carry `cost_cents`:
  - Gemini text-embedding-004 per call ≈ negligible (free tier; conservative budget 0.005¢/call if billed)
  - pgvector queries: server-side compute, accounted under existing Supabase plan
  Total Phase 8 per-prediction cost ≈ <0.01¢ added to the ~$0.065 milestone budget — comfortably within budget.

- **D-16: Backfill cost is one-time + bounded.** Training_corpus = 225 embeddings ≈ free. Scraped_videos at current pool size (~hundreds to low thousands) ≈ <$1 total even at OpenAI's $0.02/M. Documented in the plan; no separate budget approval needed.

### Claude's Discretion

- **File organization** — Phase 8 outputs likely live under `src/lib/engine/retrieval/`:
  - `embedder.ts` (Gemini SDK wrapper + subject-text formula helper)
  - `bucket-derivation.ts` (D-03a logic + the non-corpus engagement-percentile constant)
  - `pgvector-client.ts` (Supabase RPC wrappers for the cosine queries, or raw SQL via `supabase.rpc()` — planner picks)
  - `retrieval-stage.ts` (`runBenchmarkRetrieval` orchestration)
  - `re-ranker.ts` (D-04a soft hashtag re-ranking)
  Or some subset of those, collapsed if files would be small. Planner picks.
- **CLI script location** — `scripts/embed-corpus.ts` per Phase 1 convention. Planner verifies the convention.
- **Migration filename** — single migration covering: pgvector extension enable + `training_corpus.embedding` + `scraped_videos.embedding` + HNSW indexes on both + `analysis_results.retrieval_evidence` + `analysis_results.retrieval_score` + `analysis_results.signal_availability.retrieval` (covered by Phase 3's existing JSONB column — no column add). Planner picks naming.
- **Test surface** — Vitest unit tests for: embedder subject formula determinism, bucket derivation for calibrated AND non-calibrated niches, hierarchical relaxation tier transitions, soft re-ranker hashtag overlap math, `min_corpus_size` gate, retrieval_score formula edge cases (all-viral, all-under, mixed, empty), graceful-degradation null return. Integration test for retrieval stage emitting correct start+end events. NO live pgvector call in CI (mock the supabase client; live DB integration test acceptable if cheap).
- **Auto-embedding on row insert (D-08)** — planner picks between: (a) extend the existing TS scrape handlers to embed before inserting; (b) add a Supabase database function + trigger that calls an edge function for embedding; (c) batch-embed in a separate post-scrape cron. Recommendation: (a) — keeps the embedding logic in TS where the formula lives, avoids splitting the source of truth.
- **HNSW index parameters** — `m=16`, `ef_construction=64` are pgvector defaults. Planner verifies against current pgvector docs (the parameters may have been retuned in a later library version).
- **Zod schemas** — `RetrievalEvidenceItemSchema`, `BenchmarkRetrievalResultSchema`, in `src/lib/engine/types.ts` (or a sibling `retrieval-types.ts` if `types.ts` is getting unwieldy). Planner picks.
- **Pre-existing scraped_videos rows without `creator_handle` or `hashtags`** — embedding formula (D-06) treats null fields as empty strings. Planner verifies no scraped_videos row currently has all four input fields null (would yield a meaningless embedding); if any exist, plan adds a filter to skip them in the backfill script.
- **Wave 1 timing budget** — Wave 1 today is gated by the slowest of {Gemini video analysis ~3-5s, DeepSeek call ~1-2s}. A 200-500ms embedding + pgvector query trivially fits inside that envelope. Planner can verify with a quick perf test on a sample row but no special optimization is required.
- **Hashtag normalization** — caption_snippet should preserve case; hashtags are usually lowercase by convention but planner should verify the existing taxonomy `tag_filters` match the on-disk hashtag casing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 8: Benchmark Retrieval" — phase goal, depends-on Phase 3, 5 success criteria (#1 pgvector + embedding column + index; #2 backfill of existing competitor videos; #3 predict-time embedding <1s + top-K=5 with niche+platform+tier filter; #4 retrieval_evidence + similarity + outcomes stored on prediction; #5 retrieval signal in aggregator at low initial weight).
- `.planning/REQUIREMENTS.md` §"Benchmark Retrieval (pgvector)" (RETRIEVAL-01..06) — 6 requirements. **Conflict resolution:** REQUIREMENTS-02 says `competitor_videos.embedding` but Phase 8 D-01 overrides this to `training_corpus.embedding` + `scraped_videos.embedding`. REQUIREMENTS.md to be edited in Phase 8 plan execution to reflect the locked decision.
- `.planning/REQUIREMENTS.md` §"Acceptance Benchmark" (BENCH-01..06) — milestone-level gates; Phase 8 must not break BENCH-03 (cost ≤$0.075) or BENCH-05 (no regressions in existing 203 tests).
- `.planning/PROJECT.md` §"Engine architecture" — Wave 1 parallel block already documented to include "Benchmark retrieval (pgvector top-K similar competitor videos)" — Phase 8 fills this slot.
- `.planning/STATE.md` — milestone progress; Phase 4 done, Phase 3 in progress on a separate worktree (`virtuna-engine-foundation-p3`).

### Prior Phase Context (Carry-Forward)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — Phase 1 corpus (225 rows, 5 niches: beauty/fitness/edu/comedy/lifestyle); bucket labels (viral/average/under); calibrated thresholds at `THRESHOLD_SNAPSHOTS["full.2026-05-11"]` consumed by D-03a for scraped_videos bucket derivation in the 5 calibrated niches; graceful-degradation pattern; eval harness bypassCache semantics.
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — D-10 (hardcoded TS taxonomy module) — extended in Phase 4 with `benchmark_filters`; Phase 8 reads `taxonomy.find(p => p.slug === primary).benchmark_filters.tag_filters` for D-04a soft re-ranking and `.min_corpus_size` for D-04b gating. Card 0 (target platform) + follower_tier inform D-04 filter dimensions.
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` — D-01 stage event granularity (Phase 8's retrieval stage emits its own pair); D-07 SignalAvailability forward-compat (Phase 8 adds `retrieval` key); D-15 bypassCache pipeline option (Phase 8 inherits); D-09 prediction cache (Phase 8 leverages — no stage-level cache needed); D-05 engine_version `"3.0.0-dev"` unchanged.
- `.planning/phases/04-wave-0-content-type-niche-detection/04-CONTEXT.md` — D-13 / D-14 persona + benchmark_filters mappings on NICHE_TREE (load-bearing for Phase 8); D-16 Wave 0 runs BEFORE Wave 1 (Phase 8 reads `wave0Result.niche.primary` at Wave 1 entry); D-17 creator context pre-fetched (Phase 8 reads `creatorContext.platforms` + `.follower_tier` without re-fetching); D-22 eval harness bypass semantics inherited by Phase 8.

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript strict, Vitest 80%, Next.js 15 App Router; `@google/genai` v1.41.0 (Phase 8 uses `text-embedding-004` model); Supabase Postgres (Phase 8 enables `vector` extension).
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline wave structure (Phase 8 adds a Wave 1 sibling); existing Wave 1 parallel `Promise.all` orchestration.
- `.planning/codebase/INTEGRATIONS.md` — Gemini SDK usage patterns; Supabase service client usage; Apify scrape pipeline (Phase 8's D-08 extends inserts).

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/pipeline.ts` lines 227–340 — `runPredictionPipeline()` Wave 1 orchestration; Phase 8 adds `runBenchmarkRetrieval(...)` as a sibling inside the existing Wave 1 `Promise.all(...)` block. Reads `wave0Result.niche.primary` + `creatorContext` already in scope.
- `src/lib/engine/aggregator.ts` lines 25–35 — `SCORE_WEIGHTS` constant. Phase 8 adds `retrieval: 0.05` and proportionally redistributes existing weights ×0.95 per D-03b.
- `src/lib/engine/aggregator.ts` lines 197–203 — `SignalAvailability` interface (Phase 3 D-07). Phase 8 adds `retrieval: boolean` key.
- `src/lib/engine/types.ts` — `PredictionResult` shape; Phase 8 adds `retrieval_score: number | null` + `retrieval_evidence: RetrievalEvidenceItem[]` fields plus matching Zod schemas.
- `src/lib/engine/corpus/thresholds.ts` — `THRESHOLD_SNAPSHOTS["full.2026-05-11"]`. Phase 8 D-03a reads this for the 5 calibrated niches' bucket derivation on scraped_videos matches.
- `src/lib/niches/taxonomy.ts` — `NICHE_TREE` with Phase 4 `benchmark_filters` populated. Phase 8 D-04a reads `tag_filters`; D-04b reads `min_corpus_size`.
- `src/lib/engine/wave0.ts` — `runWave0()` output `wave0Result.niche.primary` is the slug Phase 8 filters on.
- `src/lib/engine/creator.ts` — `CreatorContext.platforms` + `.follower_tier` (Phase 2 D-19 extension). Phase 8 filter dimensions.
- `src/lib/engine/events.ts` — `emitStageStart` / `emitStageEnd` helpers; Phase 8's retrieval stage reuses unchanged.
- `src/lib/engine/cache/prediction-cache.ts` — L1/L2 prediction cache (Phase 3). Phase 8 reads this PRE-pipeline (existing path); no Phase 8 modification needed.
- `src/lib/cache.ts` — `createCache<T>(ttlMs)` factory; NOT used by Phase 8 (D-13 — no stage-level cache).
- `scripts/build-corpus.ts` — Phase 1 corpus build CLI; Phase 8's D-08 extends insert path to compute embedding inline.
- `src/app/api/cron/scrape-trending/` — scraped_videos insert pathway from Apify cron; Phase 8's D-08 extends inserts to compute embedding inline.
- `supabase/migrations/20260213000000_content_intelligence.sql` — `scraped_videos` table definition; Phase 8 adds `embedding vector(768)` column via new migration.
- `supabase/migrations/20260512000000_training_corpus.sql` — `training_corpus` table definition; Phase 8 adds `embedding vector(768)` column via new migration.
- `supabase/migrations/20260216000000_v2_schema_expansion.sql` — `analysis_results` v2 columns pattern; Phase 8's new columns (`retrieval_evidence` JSONB + `retrieval_score` NUMERIC) follow the same `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` idiom.

### Phase 8 Outputs (will be created or extended)
- `src/lib/engine/retrieval/embedder.ts` (new) — Gemini `text-embedding-004` wrapper + subject-text formula helper (D-06).
- `src/lib/engine/retrieval/bucket-derivation.ts` (new) — D-03a logic + `NON_CORPUS_ENGAGEMENT_PERCENTILES` constant for the 5 non-Phase-1 niches.
- `src/lib/engine/retrieval/pgvector-client.ts` (new) — Supabase RPC / raw SQL wrappers for cosine queries against training_corpus + scraped_videos.
- `src/lib/engine/retrieval/retrieval-stage.ts` (new) — `runBenchmarkRetrieval()` orchestration including hierarchical relaxation (D-04).
- `src/lib/engine/retrieval/re-ranker.ts` (new) — D-04a hashtag soft re-ranking.
- `src/lib/engine/aggregator.ts` (extended) — SCORE_WEIGHTS table updated per D-03b; `SignalAvailability.retrieval` added per D-10.
- `src/lib/engine/types.ts` (extended) — `RetrievalEvidenceItem`, `BenchmarkRetrievalResult`, `retrieval_score` + `retrieval_evidence` fields on `PredictionResult`; matching Zod schemas.
- `src/lib/engine/pipeline.ts` (extended) — Wave 1 parallel block adds `runBenchmarkRetrieval(...)` call.
- `scripts/embed-corpus.ts` (new) — idempotent CLI for one-time backfill + re-runs.
- `scripts/build-corpus.ts` (extended) — auto-embed on insert per D-08.
- `src/app/api/cron/scrape-trending/route.ts` (extended) — auto-embed on insert per D-08 (or its handler if logic lives elsewhere — planner verifies path).
- `supabase/migrations/<timestamp>_phase8_pgvector.sql` (new) — single migration: `CREATE EXTENSION IF NOT EXISTS vector` + `ALTER TABLE training_corpus ADD COLUMN embedding vector(768)` + same on scraped_videos + HNSW indexes on both + `ALTER TABLE analysis_results ADD COLUMN retrieval_evidence JSONB` + `... retrieval_score NUMERIC(5,4)`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`@google/genai` SDK** — already used for Gemini video calls; Phase 8 reuses for `text-embedding-004` (same client, different model). No new dependency.
- **`THRESHOLD_SNAPSHOTS["full.2026-05-11"]`** (`src/lib/engine/corpus/thresholds.ts`) — Phase 1's calibrated viralFloor + underCeiling per Phase 1 niche; Phase 8 D-03a reads directly for scraped_videos bucket derivation in the 5 calibrated niches.
- **`NICHE_TREE` + `benchmark_filters`** (`src/lib/niches/taxonomy.ts`, populated by Phase 4 D-14) — `tag_filters` for re-ranking, `min_corpus_size` for signal-contribution gate.
- **Wave 1 `Promise.all` orchestration** (`src/lib/engine/pipeline.ts` lines ~227–340) — Phase 8 adds a sibling to the existing parallel block; no orchestration redesign.
- **`emitStageStart` / `emitStageEnd`** (`src/lib/engine/events.ts`) — Phase 8 reuses unchanged.
- **`SignalAvailability` forward-compat pattern** (Phase 3 D-07) — Phase 8 adds the `retrieval` key via the same additive path used by Phase 4's `content_type` + `niche` keys.
- **`bypassCache` pipeline option** (Phase 3 D-15) — Phase 8 inherits semantics; eval harness predictions run without cached retrieval.
- **`SCORE_WEIGHTS` redistribution helper** (`aggregator.ts` `selectWeights()`) — Phase 8's null-retrieval graceful-handling rides this existing pathway; no new redistribution code.
- **Service-role Supabase client** (`createServiceClient()`) — Phase 8's pgvector queries use this (RLS bypass needed for training_corpus + scraped_videos system-wide reads).
- **Zod validation pattern at LLM boundaries** (`src/lib/engine/types.ts`) — Phase 8 adds `RetrievalEvidenceItemSchema` + `BenchmarkRetrievalResultSchema`.
- **`createLogger({ module: "..." })`** — every new retrieval file logs under its own module name.

### Established Patterns
- **Graceful degradation in engine stages** (Phase 1 D-rule) — Phase 8 retrieval stage catches all errors, returns `{ evidence: [], score: null, availability: false }`, emits `retrieval_failed` warning.
- **Vitest 80% coverage threshold** — new retrieval modules need tests; mock the Gemini embedder and supabase client.
- **`@sentry/nextjs` capture at error boundaries** — preserved at the retrieval stage boundary.
- **`timed()` wrapper at every pipeline boundary** (Phase 3) — Phase 8's retrieval stage uses it for cost+duration accounting.
- **Additive-only milestone constraint** — Phase 8 adds new columns + a new pipeline stage + new aggregator entry; touches NO existing pipeline logic beyond adding the new sibling + the SCORE_WEIGHTS redistribution.
- **Insert-time side effects** (Phase 2 D-rule on `addCompetitor` source-aware tracking) — Phase 8's auto-embedding on insert (D-08) follows the same pattern.

### Integration Points
- **`pipeline.ts` Wave 1 ⟷ retrieval stage** — Phase 8 adds `runBenchmarkRetrieval(...)` to the Wave 1 `Promise.all([...])` block. Reads `wave0Result.niche.primary` + `creatorContext` already pre-fetched by Phase 4 D-17.
- **Retrieval stage ⟷ embedder** — single Gemini embedding call per prediction; subject text from D-06 formula.
- **Retrieval stage ⟷ pgvector** — two parallel queries (training_corpus + scraped_videos) at each relaxation tier; results merged and ranked.
- **Retrieval stage ⟷ aggregator** — `retrieval_score` + `signal_availability.retrieval` populated; aggregator's existing `selectWeights()` handles redistribution when `retrieval = false`.
- **`retrieval_evidence` ⟷ DB** — written to new `analysis_results.retrieval_evidence` JSONB column; M2 milestone reads it for UI rendering.
- **Backfill script ⟷ Gemini API** — one-time job; idempotent (skips rows where embedding is non-null); rate-limited (planner verifies Gemini batch size).
- **Scrape pipelines ⟷ embedder** — `scripts/build-corpus.ts` (training_corpus inserts) + scraped_videos cron paths auto-embed on insert per D-08; the embedding formula (D-06) is the single source of truth.
- **Eval harness ⟷ retrieval stage** — `bypassCache: true` forces fresh retrieval on every eval run; benchmark accuracy reflects real engine behavior.

### NO changes to (preserved by additive-only constraint)
- Existing Wave 1 sibling stages (`runGeminiVideoAnalysis`, `runAudioAnalysis`, `fetchCreatorContext` resolution, `runRuleScoring`) — Phase 8 only adds a sibling to the parallel block.
- Phase 3's content-hash prediction cache (L1/L2) — Phase 8 leverages without modification.
- Phase 4's Wave 0 stub orchestration — Phase 8 reads `wave0Result.niche.primary` as a downstream consumer; does not touch Wave 0.
- `taxonomy.ts` `NICHE_TREE` data — Phase 8 reads `benchmark_filters` as-is; no taxonomy changes.
- `competitor_videos` table — explicitly NOT extended with `embedding` (REQUIREMENTS-02 supersedes).
- Existing Wave 2 (DeepSeek synthesis + trend enrichment) — untouched.
- ML scorer + calibration pipeline — Phase 10 territory.

</code_context>

<specifics>
## Specific Ideas

- **User delegated the source-pool decision to Claude.** When asked "training_corpus vs scraped_videos vs both vs competitor_videos," the user replied "what do you think is the best decision to make here." Claude's recommendation: two-pool (training_corpus first, scraped_videos fallback) — locked as D-01. Future re-discussion is allowed if Phase 10 eval evidence shows the two-pool approach produces inconsistent retrieval signals; researcher/planner should treat the two-pool design as the default but not as inviolable.

- **User explicitly chose "Rich evidence" shape for retrieval_evidence (D-02).** This is the strongest signal that Phase 8 must capture enough fields per item to render a "similar videos" panel WITHOUT requiring M2-time DB joins. The shape is load-bearing for M2 — researcher/planner should treat field additions as a Phase 8 problem (i.e., add now if useful for downstream, not later). Thumbnail capture is the only explicit deferral; if M2's panel design wants thumbnails, that's a separate phase.

- **User explicitly chose "Bucket-weighted vote" for the aggregator signal (D-03).** This is the strongest signal that retrieval IS a predictive signal in v3, not just evidence on the side. The formula (similarity-weighted bucket vote) is interpretable, aligned with Phase 1's labeling vocabulary, and provides a natural calibration anchor for Phase 10. The "low initial weight" wording is in SC#5 — D-03b implements it as 0.05, but Phase 10 may tune.

- **User explicitly chose "Hierarchical relaxation" for filter fallback (D-04).** Strong preference for "always return what's available" over strict-with-warnings or niche-only. The relaxation tagging (`relaxed_to` field) preserves transparency — eval harness can quantify how often relaxation kicks in by niche+platform+tier combo.

- **User remains non-technical (carried from Phase 2/3/4 D-rules).** All schema choices, SDK choices (Gemini vs OpenAI), index types (HNSW vs IVFFlat), migration structure, file organization decisions are Claude's discretion in this CONTEXT.md. User-facing decisions (what gets retrieved, what users see in evidence, how the signal contributes) were surfaced explicitly. Researcher/planner should preserve this division on follow-ups.

</specifics>

<deferred>
## Deferred Ideas

- **Thumbnail capture for retrieval_evidence** — Phase 8 ships without thumbnails because the Apify scrape pipeline does not currently capture them. If M2's "similar videos" panel design wants thumbnails, that's a Phase X plumbing pass extending the Apify actor + storage migration. Track for M2 design phase.

- **OpenAI text-embedding-3-small upgrade evaluation** — Phase 8 starts on Gemini text-embedding-004 to minimize dependencies. If Phase 10's eval shows the retrieval signal underperforms (e.g., MAE doesn't move), the planner can swap to OpenAI's text-embedding-3-small (1536d) — costs ~$0.02/M tokens but is widely regarded as strong. Re-embedding cost is bounded; column dimension swap is a migration.

- **Cross-language embedding evaluation** — Gemini embedding is multilingual by default. If eval harness shows underperformance on non-English captions (Spanish, Portuguese in the Latin American TikTok corpus), Phase 10 can evaluate language-specific embedding models or pre-translate captions.

- **Cross-user retrieval cache** — multiple users uploading similar caption text would benefit from a cross-user embedding cache. Phase 8 explicitly defers (D-13). Track for post-launch when hit-rate data exists.

- **Retrieval refresh on content drift** — Phase 8 embeds rows once at insert time. If scraped_videos rows are updated (e.g., view count refresh from cron), embeddings are NOT recomputed (the subject text doesn't change with view count). If a future phase introduces caption editing or hashtag updates on scraped_videos, the embedding refresh policy needs revisiting.

- **competitor_videos.embedding for personalized retrieval** — REQUIREMENTS-02's original target. If a future phase wants "videos like the ones you specifically track" as a distinct evidence panel (separate from system-wide pattern-matching), `competitor_videos.embedding` becomes its own phase. Track for "Intelligence Surface" or later.

- **Phase 10 retrieval signal weight tuning** (D-03b) — initial weight 0.05 is the v3.0-dev starting point. Phase 10 re-tunes against corpus benchmark MAE. Track as a Phase 10 input.

- **Phase 10 source-pool re-evaluation** (D-01a) — if two-pool produces inconsistent signals between corpus-only and scraped-only matches, Phase 10 can collapse to single-pool. Track as a Phase 10 input.

- **HNSW parameter tuning** — m=16 / ef_construction=64 are pgvector library defaults. If retrieval recall@5 underperforms in eval, the planner can revisit (m=32 / ef_construction=200 is the common quality upgrade at the cost of index build time). Track as a Phase 10 quality lever.

- **Embedding dimension upgrade (768 → 1536)** — if Gemini embedding swap to OpenAI happens, column type changes from `vector(768)` to `vector(1536)`. Single migration + full re-embed. Tracked alongside the OpenAI evaluation deferral above.

- **`min_corpus_size` per-niche values from Phase 4** — Phase 4 D-14 locked min_corpus_size values per primary niche. If Phase 8's eval shows the gate (D-04b) firing too often (i.e., signal is null too often), revisit either the embedded pool size (backfill more scraped_videos for thin niches) or relax the gate values. Track for Phase 10.

- **Aggregator soft-handling of `retrieval_pool_too_small` warning** — Phase 8 emits the warning + nulls the signal; aggregator's `selectWeights()` redistributes. Future phase could introduce e.g. "downweight other low-signal stages when retrieval is unavailable" if eval evidence supports it. Track for Phase 10 aggregator extension.

</deferred>

---

*Phase: 8-Benchmark Retrieval*
*Context gathered: 2026-05-18*
