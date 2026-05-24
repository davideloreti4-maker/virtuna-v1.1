# Phase 8: Benchmark Retrieval — Research

**Researched:** 2026-05-18
**Domain:** pgvector + Supabase + Gemini embeddings + Wave 1 pipeline integration
**Confidence:** HIGH (codebase + Context7 + official docs); LOW only on free-tier RPM numbers (not published)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (must research these, NOT alternatives)

- **D-01** Two-pool retrieval: `training_corpus` primary + `scraped_videos` fallback. Reject `competitor_videos` (RLS + size).
- **D-01a** User delegated source-pool decision to Claude. Future re-discussion allowed if Phase 10 evidence demands.
- **D-02** Rich `retrieval_evidence` shape (10 fields per item incl. `bucket_label`, `bucket_source`, `relaxed_to`).
- **D-03** Single `retrieval_score ∈ [0,1]` = `Σ similarity·bucket_value / Σ similarity` (viral=1.0, average=0.5, under=0.0).
- **D-03a** Bucket derivation: 5 calibrated niches use `THRESHOLD_SNAPSHOTS["full.2026-05-11"]`; 5 non-calibrated niches use engagement-rate percentile snapshot (P80/P40) computed once at backfill.
- **D-03b** Initial aggregator weight `retrieval: 0.05` with 0.95× proportional redistribution of existing weights. Phase 10 may retune.
- **D-04** Three-tier hierarchical relaxation: strict (niche+platform+tier) → relaxed_tier (niche+platform) → relaxed_platform (niche only). Stop at K=5; tag `relaxed_to`.
- **D-04a** Soft hashtag re-ranker: pull top-K×2 raw matches, +5% similarity bonus when hashtag overlaps `tag_filters`, re-sort, take K=5.
- **D-04b** `min_corpus_size` gate: if final pool size after Tier 3 < `benchmark_filters.min_corpus_size`, return evidence but null the score + `SignalAvailability.retrieval = false`. Emit `retrieval_pool_too_small` warning.
- **D-05** Gemini `text-embedding-004` (768d) via `@google/genai`. **⚠️ FLAG (see findings): model was shut down 2026-01-14.**
- **D-06** Subject text formula — byte-identical at backfill + predict time:
  `"[niche:{primary_slug}] @{handle}: {caption_or_empty}\n{space_joined_hashtags}"` (handle lowercased; caption max 500 chars; nulls → empty strings).
- **D-07** HNSW + cosine; `vector_cosine_ops`; verify m=16 / ef_construction=64 defaults.
- **D-08** One-time backfill CLI (idempotent) + auto-embed on insert in `scripts/build-corpus.ts` AND `/api/cron/scrape-trending` path (the webhook handler, actually).
- **D-09** Wave 1 parallel placement — `runBenchmarkRetrieval(payload, creatorContext, wave0Result, onStageEvent)` as sibling to `geminiPromise`/`audioPromise`/`creatorPromise`/`rulePromise`.
- **D-10** `SignalAvailability.retrieval: boolean`. True when ≥1 match survives + min_corpus_size gate passes; false otherwise.
- **D-11** New columns: `analysis_results.retrieval_evidence JSONB`, `analysis_results.retrieval_score NUMERIC(5,4)` nullable. No index on these columns.
- **D-12** Eval harness `bypassCache: true` inherits — bypass any future stage-level cache. (D-13 says no such cache, so this is forward-compat only.)
- **D-13** **NO stage-level retrieval cache.** Phase 3 prediction cache (L1/L2) covers re-uploads. Cross-user embedding cache deferred.
- **D-14** Engine version stays `"3.0.0-dev"`; Phase 12 bumps to `"3.0.0"`.
- **D-15** Cost telemetry: `stage_end.cost_cents` populated (negligible per call).
- **D-16** Backfill cost <$1 — within milestone budget.

### Claude's Discretion (research options, recommend)

- File organization under `src/lib/engine/retrieval/` — planner picks subset.
- CLI script location follows Phase 1 convention.
- Migration filename — single migration, planner names.
- Test surface — Vitest unit + integration; no live pgvector in CI.
- Auto-embed implementation — recommend (a) TS scrape handlers (keeps formula in TS).
- HNSW parameters — verify defaults against current pgvector docs.
- Zod schemas location — `types.ts` or sibling.
- Skip-filter for malformed scraped_videos rows (all-null caption+hashtags+author).
- Wave 1 timing — fits inside existing 3-5s envelope.
- Hashtag normalization — verify casing matches `tag_filters`.

### Deferred Ideas (OUT OF SCOPE — ignore completely)

- Thumbnail capture for evidence items
- OpenAI `text-embedding-3-small` upgrade evaluation
- Cross-language embedding evaluation
- Cross-user retrieval cache
- Retrieval refresh on content drift
- `competitor_videos.embedding` for personalized retrieval
- Phase 10 weight tuning
- Phase 10 source-pool re-evaluation
- HNSW parameter tuning beyond defaults
- Embedding dimension upgrade
- `min_corpus_size` per-niche revisit
- Aggregator soft-handling of `retrieval_pool_too_small`

</user_constraints>

<phase_requirements>
## Phase Requirements (RETRIEVAL-01..06)

| ID | Description | Research Support |
|----|-------------|------------------|
| RETRIEVAL-01 | `pgvector` extension installed in Supabase | §pgvector + Supabase Integration — exact `CREATE EXTENSION` SQL verified against current Supabase docs |
| RETRIEVAL-02 | Competitor video embedding pipeline (embeddings computed at scrape time, stored in `competitor_videos.embedding` column) | **CONFLICT WITH D-01.** Phase 8 implements two-pool (`training_corpus.embedding` + `scraped_videos.embedding`) per D-01 + D-08. REQUIREMENTS.md will be updated in plan execution to reflect the locked decision. Plan must include this REQUIREMENTS.md edit task. |
| RETRIEVAL-03 | Predict-time embedding of input video summary (`text-embedding-3-small` or Gemini embedding) | §Gemini Embedding — Gemini chosen per D-05. **Researcher flag: D-05's chosen model is `text-embedding-004` which was shut down 2026-01-14. Replacement model: `gemini-embedding-001` with `outputDimensionality: 768`. See §Critical Findings.** |
| RETRIEVAL-04 | Top-K similarity search (K=5) filtered by niche, platform, creator tier | §Query Pattern + §Hierarchical Relaxation — RPC + parameterized SQL function path verified |
| RETRIEVAL-05 | Similar videos returned as `retrieval_evidence` field on prediction (top 5 with similarity scores + outcomes) | §Migration Structure + §Aggregator Extension — JSONB column shape locked by D-02 |
| RETRIEVAL-06 | Backfill embedding pipeline for existing competitor videos (one-time job) | §Auto-embedding on Insert + §Backfill — `scripts/embed-corpus.ts` per Phase 1 CLI convention; "competitor videos" in REQUIREMENTS-06 is misnamed and refers to the two-pool per D-01 |

</phase_requirements>

## Critical Findings (READ FIRST — planner must address)

### 🚨 Finding 1: Gemini `text-embedding-004` was SHUT DOWN 2026-01-14

**Source:** [Google Developers Blog — Gemini Embedding GA](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) [VERIFIED]; [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog) [VERIFIED]; multiple SDK migration issues (firebase/genkit#4551, mem0ai/mem0#3942) [VERIFIED].

**Today (2026-05-18) is 4 months past the shutdown date.** CONTEXT.md D-05 locks the use of `text-embedding-004` (768d) via `@google/genai` v1.41.0. As of 2026-01-14, that model returns an error.

**Replacement model:** `gemini-embedding-001` (GA, "state-of-the-art")
- Same `embedContent` endpoint shape — backward-compatible API surface
- Default output dimension is **3072** (NOT 768)
- Supports MRL (Matryoshka Representation Learning) — output dimension is configurable via `outputDimensionality` parameter
- Setting `outputDimensionality: 768` yields a 768-d vector with documented 0.26% quality loss vs 3072 ([TokenMix blog 2026](https://tokenmix.ai/blog/gemini-embedding-001-dimensions-pricing-guide-2026)) — well within tolerance for D-05's chosen 768d.
- Cost: $0.15 / 1M input tokens, $0.075 / 1M batch. Free tier exists (specific RPM not published).
- Supports `taskType` parameter — pass `RETRIEVAL_DOCUMENT` at backfill, `RETRIEVAL_QUERY` at predict-time for asymmetric retrieval optimization (documented improvement).

**Planner action required:**
1. Use `gemini-embedding-001` (not `text-embedding-004`) with `config: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' }` for backfill and `config: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' }` at predict-time.
2. Document this divergence from CONTEXT.md D-05 in the plan SUMMARY: "D-05 model upgraded from `text-embedding-004` (shut down 2026-01-14) to `gemini-embedding-001` with `outputDimensionality: 768` — preserves D-05 intent (Gemini, 768d, existing SDK) without requiring a deprecated model."
3. **This is a research-flagged divergence from a locked decision.** Surface in discuss-phase output for user awareness — but the locked decision is structurally impossible to execute as written. The 768-d / Gemini SDK / no-new-dep intent is preserved.

### 🚨 Finding 2: `@google/genai` is at v2.4.0 — installed v1.41.0 is 1 major behind

**Source:** `npm view @google/genai version` [VERIFIED]; `pnpm-lock.yaml` shows `@google/genai@1.41.0` [VERIFIED in repo].

The installed SDK works — `embedContent` is present in v1.41.0 per Context7 docs — and supports `gemini-embedding-001` (model selection is server-side, not SDK-pinned). **Phase 8 should NOT upgrade the SDK in this phase** (additive-only milestone constraint BENCH-05). Track SDK upgrade as a separate concern for a future milestone.

The v1.41 → v2.x migration is documented as a non-trivial breaking change in the SDK (chat session API changes, files API changes per googleapis/js-genai release notes). Out of scope for Phase 8.

### 🚨 Finding 3: `scraped_videos` schema MISSING fields that D-04 filters on

**Source:** `src/types/database.types.ts` lines for `scraped_videos.Row` [VERIFIED in repo].

`scraped_videos` columns (today):
```
id, platform, platform_video_id, video_url, author, author_url, description,
views, likes, shares, comments, sound_name, sound_url, hashtags, category,
duration_seconds, metadata, archived_at, created_at, updated_at
```

Notably ABSENT (vs what D-04's tier-1 filter needs):
- ❌ `creator_handle` — uses `author` instead
- ❌ `primary_niche` — uses `category` (a TEXT field, NOT slug-normalized; doesn't match NICHE_TREE slugs)
- ❌ `follower_count` / `follower_tier` — never captured (clockworks scraper limitation)
- ❌ `posted_at` — `created_at` is when the row was scraped, not when the TikTok was posted
- ❌ `saves` — never captured (apidojo/clockworks limitation; same as `training_corpus.completion_pct` known gap)

**Implications for Phase 8 planner:**

| D-04 Tier | Filters | training_corpus has? | scraped_videos has? |
|-----------|---------|---------------------|---------------------|
| Tier 1 (strict) | niche + platform + tier | ✅ niche, platform; ⚠️ follower_tier nullable | ❌ no niche slug, no tier, ✅ platform |
| Tier 2 (relaxed_tier) | niche + platform | ✅ both | ❌ no niche slug, ✅ platform |
| Tier 3 (relaxed_platform) | niche | ✅ | ❌ no niche slug |

**Two strategies the planner picks from:**

**Strategy A: Plan adds the missing columns to `scraped_videos` (lightweight migration).**
- ADD COLUMN `primary_niche TEXT` — derive from `category` mapping or from hashtag inference at backfill time (similar to how Phase 4 niche detector classifies inputs). Run a one-time backfill SQL update that maps existing `category` values to NICHE_TREE slugs based on a category→slug lookup table.
- ADD COLUMN `follower_tier TEXT CHECK (...)` — NULL for now (clockworks doesn't capture); set when apidojo migration completes (carry-forward blocker in STATE.md).
- ADD COLUMN `posted_at TIMESTAMPTZ` — backfill NULL (cron-scraped posts; future cron writes set it from Apify item metadata).
- ADD COLUMN `creator_handle TEXT` — alias of `author`; backfill `UPDATE ... SET creator_handle = author`.

This is the cleanest path. Filter dimensions become uniform across both pools.

**Strategy B: Use what's available; degrade gracefully on `scraped_videos`.**
- Tier 1 query on `scraped_videos`: only filter by `platform` (no niche, no tier — those columns don't exist). Effectively skip Tier 1 for scraped_videos and start at Tier 2/3 effectively.
- Pro: zero migration burden on scraped_videos.
- Con: scraped_videos retrieval becomes much noisier — many off-niche items returned. Defeats D-04's hierarchical-relaxation intent for the fallback pool.

**Recommendation: Strategy A.** The migration is small (3 ALTER TABLE statements, one UPDATE), keeps the filter logic uniform across pools, and matches the D-04 design intent. The category→niche-slug mapping is a small constant table:

```ts
// scripts/migrate-scraped-videos-niche.ts (one-time)
const CATEGORY_TO_NICHE_SLUG: Record<string, string> = {
  beauty: "beauty",
  makeup: "beauty",
  skincare: "beauty",
  fitness: "fitness",
  gym: "fitness",
  comedy: "comedy",
  funny: "comedy",
  // ... etc, derived from existing scraped_videos.category distinct values
  // unmapped categories → NULL (skipped in retrieval pool)
};
```

The planner should run `SELECT DISTINCT category FROM scraped_videos` first to size the mapping before committing values.

### 🚨 Finding 4: `creator_profiles` has NO `follower_tier` column — derive from `tiktok_followers`

**Source:** `src/types/database.types.ts` `creator_profiles.Row` [VERIFIED]; `src/lib/engine/corpus/follower-tier.ts` `getFollowerTier()` [VERIFIED].

D-04 says "Tier from `creator_profiles.follower_tier` or derived from follower_count." The DB has no such column. **All retrieval calls must derive at query time** via `getFollowerTier(creatorContext.follower_count)`. The util is already exported. No DB change needed for this — just code wiring.

### 🚨 Finding 5: D-03a percentile snapshot for non-calibrated niches has a chicken-and-egg

**Source:** D-03a + Phase 1 corpus calibration flow [VERIFIED in CONTEXT.md].

`THRESHOLD_SNAPSHOTS["full.2026-05-11"]` covers 5 niches (beauty/fitness/edu/comedy/lifestyle). D-03a says compute engagement-rate percentiles for the 5 NEW niches (tech/gaming/fashion/music/food) **once at backfill time**, snapshot in `NON_CORPUS_ENGAGEMENT_PERCENTILES`.

But: at Phase 8 backfill, `scraped_videos` is populated for SOME niches (whatever `category` was, today it's hashtag-derived from `SCRAPER_HASHTAGS` env) but NOT necessarily evenly across the 10 NICHE_TREE primaries. **The plan must check pool size per non-calibrated niche before snapshotting** — if `tech-gadgets` has only 12 videos, computing P80/P40 is noise. Fallback: tag those niches `bucket = "average"` for all scraped_videos hits until pool grows enough. Document the threshold (e.g., "≥30 rows per niche → compute percentile snapshot; <30 → all marked 'average'").

This snapshot should live as a CONSTANT in code (committed to git) — NOT a runtime DB read — per the D-03a spec ("snapshotted as a `NON_CORPUS_ENGAGEMENT_PERCENTILES` constant").

---

## Approach Overview

Phase 8 ships RAG infrastructure: pgvector storage, an embedding pipeline (one-time backfill + on-insert auto-embed), a Wave 1 parallel retrieval stage, and an aggregator hook.

**Architecture (4 layers, top to bottom):**

```
┌─────────────────────────────────────────────────────────────────┐
│ runPredictionPipeline (pipeline.ts)                            │
│  └─ Wave 1 Promise.all([gemini, audio, creator, rules, RETRIEVAL])  ← NEW sibling
│       │                                                          │
│       └─ runBenchmarkRetrieval(payload, creatorContext, wave0Result, onStageEvent)
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ stage emits `retrieval` start/end events
┌─────────────────────────────────────────────────────────────────┐
│ retrieval-stage.ts — orchestration (NEW)                        │
│  1. embed(subject text)  ─── one Gemini call                    │
│  2. hierarchical relax(corpus → scraped, T1 → T2 → T3) until K=5 matches      │
│  3. soft re-rank by hashtag overlap (D-04a)                     │
│  4. derive bucket per item (corpus_known | derived)             │
│  5. compute score (similarity-weighted bucket vote, D-03)       │
│  6. min_corpus_size gate (D-04b) — null score if pool < gate    │
│  7. return { evidence, score, availability }                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Aggregator extension (aggregator.ts)                            │
│  - SCORE_WEIGHTS += { retrieval: 0.05 }, others ×0.95           │
│  - SignalAvailability += { retrieval: boolean }                 │
│  - selectWeights() handles null retrieval via existing redist   │
│  - PredictionResult.retrieval_score + .retrieval_evidence       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Persistence — analysis_results columns:                         │
│  - retrieval_evidence JSONB (D-02 shape, max 5 items)           │
│  - retrieval_score NUMERIC(5,4) NULL when unavailable           │
│  - signal_availability.retrieval (existing column, new key)     │
└─────────────────────────────────────────────────────────────────┘

Parallel: backfill + auto-embed paths
┌─────────────────────────────────────────────────────────────────┐
│ scripts/embed-corpus.ts (NEW) — idempotent CLI backfill         │
│  - reads rows with embedding IS NULL                            │
│  - batches subject-text construction (D-06)                     │
│  - calls Gemini embed in batches of N (planner picks N≤100)     │
│  - upserts embedding column                                     │
│                                                                  │
│ scripts/build-corpus.ts (EXTEND) — embed inline on insert       │
│ src/app/api/webhooks/apify/route.ts (EXTEND) — embed on upsert  │
│  (the actual scraped_videos write path; NOT scrape-trending     │
│  which just kicks the actor)                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Primary recommendation:** Use `gemini-embedding-001` (not `text-embedding-004`), declare embedding columns as `vector(768)`, HNSW with `vector_cosine_ops` using defaults `m=16, ef_construction=64`. Query via a single Postgres RPC function `match_corpus_videos(...)` parameterized by all filter dimensions + tier level (1/2/3). Iterate tiers in TypeScript until K=5 results accumulate. Apply soft re-ranker in-memory on the top-K×2 set. Derive bucket per item by checking row pool + falling back to threshold map.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| `vector` extension + embedding columns + HNSW indexes | Database / Storage | — | DDL belongs in migrations, not code |
| Embedding subject-text construction (D-06) | API / Backend (TS lib) | — | Single source of truth; same formula at backfill + predict |
| Gemini API embedding call | API / Backend (server) | — | API key only present server-side |
| pgvector top-K cosine query w/ filters | Database / Storage (Postgres function) | API / Backend (RPC caller) | Push filter+vector predicate to DB planner (pre-filter); JS calls via `.rpc()` |
| Hierarchical relaxation (D-04) orchestration | API / Backend (TS) | — | Loop logic + tier tagging is application logic |
| Soft re-ranker (D-04a) | API / Backend (TS, in-memory) | — | Tiny array (≤10 items); no DB round-trip needed |
| Bucket derivation (D-03a) | API / Backend (TS, lookup constant) | — | Threshold snapshots are constants in `src/lib/engine/...` |
| Aggregator score formula | API / Backend (TS, `aggregator.ts`) | — | Existing layer, additive extension |
| Backfill CLI | API / Backend (Node script, server-side) | — | Service-role auth required; offline batch job |
| Auto-embed on insert | API / Backend (existing scrape paths) | — | Co-located with the insert path so embedding cannot drift from subject formula |

---

## Standard Stack

### Core (already in repo — NO new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.41.0 (installed; 2.4.0 latest) | Gemini embedding API call | Already used for `analyzeWithGemini` + `analyzeVideoWithGemini`; reuse client construction pattern |
| `@supabase/supabase-js` | 2.93.1 | DB client; `.rpc()` for pgvector query | Already used everywhere; service-role client in `service.ts` |
| `zod` | 4.3.6 | Validate `RetrievalEvidenceItem` shape + Gemini response | Project standard at LLM boundaries |
| pgvector | server-side extension; latest is 0.8.2 | Vector storage + HNSW + cosine | Supabase managed Postgres supports it [VERIFIED via Supabase docs] |
| Vitest | 4.0.18 | Unit + integration tests | Project standard; 80% coverage threshold |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/nextjs` | 10.39.0 | Error capture at stage boundary | Reuse pattern from existing stages |
| `nanoid` | 5.1.6 | (Not directly used) | Pipeline already imports for `requestId` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gemini-embedding-001` (D-05 honored) | OpenAI `text-embedding-3-small` 1536d | Per CONTEXT D-05 rationale: requires `OPENAI_API_KEY` + separate billing. Rejected. Tracked as Phase 10 deferred. |
| HNSW (D-07 honored) | IVFFlat | HNSW is pgvector's documented default for new indexes (Supabase + pgvector official docs both call out HNSW first). IVFFlat needs rebuild on growth, slower queries. Reject. |
| Raw SQL via `.rpc(SQL_TEXT)` | Stored function + `.rpc('fn_name', params)` | `.rpc('fn_name', params)` is documented Supabase pattern — pre-binds filters at the planner level, sanitizes input. Use stored function approach. |
| `text-embedding-004` (D-05) | `gemini-embedding-001` with `outputDimensionality: 768` | **Forced — D-05 model was shut down 2026-01-14.** Preserves D-05 intent (Gemini, 768d, existing SDK). |

**Installation:** No `pnpm add` step. pgvector enabled via Supabase migration. Note D-05 update.

**Version verification (executed 2026-05-18):**
- `@google/genai` installed: **1.41.0** (pnpm-lock.yaml line 1411 confirms) — sufficient; supports `embedContent` per Context7 docs [VERIFIED]
- pgvector latest: **0.8.2** (pgvector GitHub README via Context7) [VERIFIED]
- HNSW supported in pgvector ≥0.5.0; pre-filtering improvements + iterative scans added in 0.8.0 [VERIFIED]
- Supabase manages pgvector version; it's auto-current on Free/Pro tiers [VERIFIED via Supabase docs]

---

## pgvector + Supabase Integration

### Enable Extension (migration syntax)

```sql
-- Standard Supabase pattern — extension lives in the `extensions` schema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

[CITED: https://supabase.com/docs/guides/database/extensions/pgvector] [VERIFIED 2026-05-18]

**Schema note:** Supabase recommends `extensions` schema for the extension; column types can use the bare type name `vector(768)` if `search_path` includes `extensions`, OR the fully-qualified `extensions.vector(768)`. The Supabase docs sample uses `extensions.vector(384)` for the column. **Recommendation: use fully-qualified `extensions.vector(768)` in column DDL** — explicit, immune to search_path changes, matches official sample. [CITED: Supabase Vector Columns docs]

**No dashboard step required.** `CREATE EXTENSION` works via SQL migration. Phase 3's pattern of "user applied migration via Studio SQL editor" (STATE.md line 139) still applies — operator workflow is acceptable. The migration file is committed regardless of who runs it.

### Add Columns

```sql
ALTER TABLE training_corpus
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

ALTER TABLE scraped_videos
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);
```

Adding to existing tables is safe — NULL by default. `IF NOT EXISTS` for idempotent re-runs (matches existing project migration style — see `20260517120000_phase3_pipeline_columns.sql`).

### Add Missing Filter Columns to `scraped_videos` (Finding 3, Strategy A)

```sql
-- Phase 8 GAP closure: add columns the D-04 filter expects.
ALTER TABLE scraped_videos
  ADD COLUMN IF NOT EXISTS primary_niche TEXT,
  ADD COLUMN IF NOT EXISTS follower_tier TEXT
    CHECK (follower_tier IS NULL OR follower_tier IN ('nano','micro','mid','large','mega')),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creator_handle TEXT;

-- Backfill creator_handle from existing author column.
UPDATE scraped_videos
  SET creator_handle = author
  WHERE creator_handle IS NULL AND author IS NOT NULL;

-- primary_niche backfill: see Strategy A in Finding 3. The category→slug mapping
-- is a one-time SQL UPDATE inside the migration, based on the planner's
-- `SELECT DISTINCT category` audit. Unmapped rows stay NULL (excluded from
-- retrieval pool at query time).
```

### Add `analysis_results` Columns (D-11)

```sql
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS retrieval_evidence JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS retrieval_score NUMERIC(5,4);
```

`retrieval_score` is nullable per D-03/D-04b semantics. `retrieval_evidence` defaults to `'[]'` so legacy rows (Phase 1-7) read as empty array, not NULL. No index added (D-11 says read pattern is single-row-by-id; agreed — `analysis_results` already has cache_lookup index for the L2 path).

### HNSW Index

```sql
-- One per pool, cosine distance opclass per D-07
CREATE INDEX IF NOT EXISTS training_corpus_embedding_hnsw
  ON training_corpus
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS scraped_videos_embedding_hnsw
  ON scraped_videos
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

[VERIFIED: pgvector README via Context7] — Defaults `m=16, ef_construction=64` confirmed against pgvector 0.8.x docs. WITH clause may be omitted to use defaults; documented explicitly per D-07 to make values visible in the migration history (so a Phase 10 retune is a code review, not git archaeology).

**Important caveat (pgvector 0.8 + filtered queries):** HNSW pre-filtering changed in pgvector 0.8.0 with `iterative_scan` support. With small selective filters (Tier 1: niche+platform+tier on a 225-row corpus), the planner may iterate further into the graph to find K=5 results. For Phase 8's small corpus (training_corpus = 225, scraped_videos = few thousand), filtering is NOT performance-sensitive — but set `SET LOCAL hnsw.iterative_scan = strict_order` at the start of each retrieval query inside the RPC function as a defensive measure. [CITED: pgvector 0.8.0 release notes]

### Distance Operator Semantics

| Operator | Computes | Range | Use for cosine? |
|----------|----------|-------|-----------------|
| `<=>` | **cosine distance** (1 − cosine similarity) | [0, 2] | ✅ YES per D-07 |
| `<->` | Euclidean L2 distance | [0, ∞] | ❌ No |
| `<#>` | Negative inner product | (-∞, 0] | ❌ No |

**Similarity in [0,1]:** Convert cosine distance to similarity with `1 - (embedding <=> query)`. This is what the `RetrievalEvidenceItem.similarity_score` field stores.

**Order:** `ORDER BY embedding <=> query ASC LIMIT K` (closest = smallest distance = first).

[VERIFIED via Supabase Vector Columns docs + pgvector README]

---

## Gemini Embedding via `@google/genai` (D-05 — UPDATED model)

### Model + SDK Call (canonical pattern)

```typescript
// src/lib/engine/retrieval/embedder.ts (NEW)
import { GoogleGenAI } from "@google/genai";
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "retrieval.embedder" });

// D-05 model — UPDATED per research Finding 1.
// text-embedding-004 shut down 2026-01-14. gemini-embedding-001 is GA replacement.
// outputDimensionality: 768 preserves D-07's vector(768) column.
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
const EMBEDDING_DIM = 768;

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
 * D-06 subject formula — single source of truth.
 * MUST be byte-identical at backfill time and predict time.
 */
export function buildSubjectText(input: {
  primary_slug: string | null;
  creator_handle: string | null;
  caption: string | null;
  hashtags: string[] | null;
}): string {
  const slug = input.primary_slug ?? "";
  const handle = (input.creator_handle ?? "").toLowerCase();
  const caption = (input.caption ?? "").slice(0, 500);
  const tags = (input.hashtags ?? []).map(h => `#${h}`).join(" ");
  return `[niche:${slug}] @${handle}: ${caption}\n${tags}`;
}

/** Single embedding (predict-time path). */
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
      taskType: "RETRIEVAL_QUERY", // optimize for asymmetric predict-time retrieval
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Embedding response shape unexpected: got ${values?.length ?? 0} dims, expected ${EMBEDDING_DIM}`,
    );
  }

  // Cost telemetry — gemini-embedding-001 priced $0.15/M input tokens, 0 output.
  // Conservative token estimate: text length / 4 chars per token.
  const estTokens = Math.ceil(text.length / 4);
  const cost_cents = (estTokens * 0.15 / 1_000_000) * 100;

  log.info("Embedded query", {
    duration_ms: Math.round(performance.now() - start),
    dims: values.length,
    est_tokens: estTokens,
    cost_cents: +cost_cents.toFixed(6),
  });
  return { vector: values, cost_cents };
}

/** Batch embedding (backfill-time path). Pass `RETRIEVAL_DOCUMENT` task type. */
export async function embedBatch(
  texts: string[],
): Promise<{ vectors: number[][]; cost_cents: number }> {
  const ai = getClient();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      outputDimensionality: EMBEDDING_DIM,
      taskType: "RETRIEVAL_DOCUMENT",
    },
  });

  const vectors = (response.embeddings ?? []).map(e => e.values ?? []);
  if (vectors.length !== texts.length) {
    throw new Error(
      `Embedding batch shape unexpected: ${vectors.length} embeddings for ${texts.length} texts`,
    );
  }

  const estTokens = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  // Batch API is 50% off — but only when called via batch endpoint, NOT here.
  // This is sync batching via contents[]; same per-token rate as single.
  const cost_cents = (estTokens * 0.15 / 1_000_000) * 100;

  return { vectors, cost_cents };
}
```

### Batch Limits

- **Sync (`contents: [...]`):** Limit is **100 strings per call** [CITED: googleapis/python-genai#427]. Backfill at 225 corpus rows fits in 3 batches; scraped_videos at low thousands fits in tens of batches.
- **Async Batch API:** Available with 50% pricing discount, queueable up to enqueued-token limits per tier (Tier 1: 500K tokens). Phase 8 backfill volume doesn't justify the added complexity — sync batches of ≤100 is fine.
- **Token limit per text:** 2048 tokens [VERIFIED: gemini-embedding-001 docs]. Subject text formula caps caption at 500 chars (~125 tokens) + niche label + handle + tags — well under limit.

[VERIFIED: Google Developers Blog GA announcement; Gemini API docs]

### Free Tier Rate Limits

[LOW confidence — Google does not publish per-tier embedding RPM in the public docs as of 2026-05]. Various community sources say free tier has 10M TPM ([aifreeapi.com](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)); RPM is "not separately listed for embeddings" but typical free-tier model RPM is 5-15 RPM. **Backfill (~225 + thousands of rows) at 100 texts/call is at most 30-50 API calls total — fits comfortably within any plausible free tier.** Predict-time embedding is one call per prediction — negligible.

**Planner action:** Add a soft retry-with-backoff wrapper around `embedBatch()` for the backfill script. If a 429 is encountered, sleep 60s and retry. Three retries then bail. This matches the existing gemini.ts retry pattern (MAX_RETRIES=2, exponential backoff).

### Output Normalization

`gemini-embedding-001` returns NORMALIZED vectors when `outputDimensionality ≤ 3072` (it normalizes by default for non-3072 dimensions per the [GA announcement](https://developers.googleblog.com/gemini-embedding-available-gemini-api/)). This matches what cosine distance expects. **No client-side normalization needed.** [VERIFIED]

If a future model returns unnormalized vectors, normalize client-side before insert:
```ts
function normalize(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return mag === 0 ? v : v.map(x => x / mag);
}
```

### Error Shape

```typescript
try {
  const result = await ai.models.embedContent({...});
} catch (e) {
  // Gemini errors: { name, message, status, code }
  // Common: 400 INVALID_ARGUMENT (text too long), 429 RESOURCE_EXHAUSTED (rate limit),
  // 503 UNAVAILABLE (transient), 401 UNAUTHENTICATED (bad API key).
}
```

Wrap callers in the same try/catch + Sentry.captureException pattern from `gemini.ts:382-399`.

---

## Query Pattern for Top-K with Filters

### Strategy: Stored Postgres Function + `.rpc()` Call

Per Supabase docs: "PostgREST does not currently support pgvector similarity operators" — so the canonical pattern is a stored function called via `.rpc()`. [CITED: https://supabase.com/docs/guides/ai/semantic-search]

This also lets the Postgres planner combine the vector predicate with the WHERE filter, which is critical for HNSW + small selective filters (Finding 3 implications).

### Migration: Create the RPC function

```sql
-- src/migrations/<timestamp>_phase8_pgvector.sql
-- (after the ALTER TABLE statements above)

CREATE OR REPLACE FUNCTION match_corpus_videos(
  query_embedding extensions.vector(768),
  match_count int,
  filter_niche text,
  filter_platform text,
  filter_follower_tier text  -- nullable; pass NULL to disable
)
RETURNS TABLE (
  source_id uuid,
  similarity float,
  source_pool text,
  video_url text,
  creator_handle text,
  caption text,
  views bigint,
  likes bigint,
  shares bigint,
  comments bigint,
  saves bigint,
  hashtags text[],
  posted_at timestamptz,
  bucket_label text,
  niche text,
  follower_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Defensive setting: HNSW iterative scan for small selective filters.
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);

  RETURN QUERY
  SELECT
    tc.id AS source_id,
    1 - (tc.embedding <=> query_embedding) AS similarity,
    'training_corpus'::text AS source_pool,
    tc.video_url,
    tc.creator_handle,
    tc.caption,
    tc.views,
    tc.likes,
    tc.shares,
    tc.comments,
    tc.saves,
    tc.hashtags,
    tc.posted_at,
    tc.bucket AS bucket_label,  -- training_corpus has the label directly
    tc.niche,
    tc.follower_count
  FROM training_corpus tc
  WHERE tc.embedding IS NOT NULL
    AND tc.niche = filter_niche
    AND tc.platform = filter_platform
    AND (filter_follower_tier IS NULL OR tc.follower_tier = filter_follower_tier)
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Parallel function for scraped_videos pool.
CREATE OR REPLACE FUNCTION match_scraped_videos(
  query_embedding extensions.vector(768),
  match_count int,
  filter_niche text,
  filter_platform text,
  filter_follower_tier text
)
RETURNS TABLE (
  source_id uuid,
  similarity float,
  source_pool text,
  video_url text,
  creator_handle text,
  caption text,           -- aliased from description
  views bigint,
  likes bigint,
  shares bigint,
  comments bigint,
  saves bigint,           -- always NULL on scraped_videos (column doesn't exist)
  hashtags text[],
  posted_at timestamptz,
  bucket_label text,      -- always NULL — derived in TS
  niche text,
  follower_count bigint   -- always NULL — scraped_videos doesn't capture
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan', 'strict_order', true);

  RETURN QUERY
  SELECT
    sv.id AS source_id,
    1 - (sv.embedding <=> query_embedding) AS similarity,
    'scraped_videos'::text AS source_pool,
    sv.video_url,
    sv.creator_handle,
    sv.description AS caption,
    sv.views,
    sv.likes,
    sv.shares,
    sv.comments,
    NULL::bigint AS saves,
    sv.hashtags,
    sv.posted_at,
    NULL::text AS bucket_label,
    sv.primary_niche AS niche,
    NULL::bigint AS follower_count
  FROM scraped_videos sv
  WHERE sv.embedding IS NOT NULL
    AND sv.archived_at IS NULL
    AND sv.primary_niche = filter_niche
    AND sv.platform = filter_platform
    AND (filter_follower_tier IS NULL OR sv.follower_tier = filter_follower_tier)
  ORDER BY sv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Why two functions, not one with `UNION ALL`?**
- Phase 8 must STOP retrieving from corpus first (more authoritative) and only top up from scraped_videos. A UNION would force evaluation of both pools in parallel before checking corpus saturation. Two functions keep the early-exit explicit.
- Different filter behaviors per pool: training_corpus has labeled `bucket` directly; scraped_videos needs in-TS bucket derivation.
- Easier per-pool index tuning (you can `EXPLAIN ANALYZE` each independently).

### Calling from TS

```typescript
// src/lib/engine/retrieval/pgvector-client.ts (NEW)
import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface MatchOptions {
  embedding: number[];
  count: number;
  niche: string;
  platform: string;
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
  if (error) throw new Error(`match_corpus_videos RPC failed: ${error.message}`);
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
  if (error) throw new Error(`match_scraped_videos RPC failed: ${error.message}`);
  return (data ?? []) as MatchRow[];
}
```

[CITED: Supabase semantic search docs] — passing the vector as a JSON number array works; supabase-js serializes it to the `vector` type accepted by the RPC parameter.

---

## Hierarchical Relaxation Implementation Pattern

### Most Elegant Pattern: Tier-Sequential with Early Exit

Per D-04: "Stop as soon as we have K=5 matches; do NOT mix relaxation levels in a single query — query tier N, if <K, append tier N+1 query results."

```typescript
// src/lib/engine/retrieval/retrieval-stage.ts (NEW)

type Tier = "strict" | "niche+platform" | "niche_only";
const K = 5;
const K_REC = 10; // K*2 for D-04a re-ranker over-fetch

interface TierConfig {
  tag: Tier;
  followerTier: string | null;  // null = drop the filter
}

const TIERS: TierConfig[] = [
  { tag: "strict",          followerTier: "USE" },          // sentinel
  { tag: "niche+platform",  followerTier: null },           // drop tier filter
  { tag: "niche_only",      followerTier: null },           // (platform also dropped — see below)
];

async function retrieveWithRelaxation(
  supabase: SupabaseClient,
  embedding: number[],
  niche: string,
  platform: string,
  followerTier: string | null,
): Promise<MatchRow[]> {
  const collected: Array<MatchRow & { relaxed_to: Tier }> = [];
  const seenIds = new Set<string>();

  // Tier 1: strict (niche + platform + tier)
  // Tier 2: relaxed_tier (niche + platform; tier=null)
  // Tier 3: relaxed_platform (niche only; tier=null + we drop platform — see Strategy note below)
  for (const tier of TIERS) {
    if (collected.length >= K_REC) break;

    const tierForQuery = tier.tag === "strict" ? followerTier : null;
    const platformForQuery = tier.tag === "niche_only" ? null : platform;

    // Pool order: training_corpus FIRST, scraped_videos to top up.
    const need = K_REC - collected.length;
    for (const matcher of [matchTrainingCorpus, matchScrapedVideos]) {
      if (collected.length >= K_REC) break;
      const remaining = K_REC - collected.length;
      const rows = await matcher(supabase, {
        embedding,
        count: remaining,
        niche,
        platform: platformForQuery as string,  // RPC accepts NULL via a separate function variant — see note
        followerTier: tierForQuery,
      });
      for (const r of rows) {
        if (seenIds.has(r.source_id)) continue;  // dedupe across pools/tiers
        seenIds.add(r.source_id);
        collected.push({ ...r, relaxed_to: tier.tag });
      }
    }
  }

  return collected.slice(0, K_REC);
}
```

**Strategy note — Tier 3 dropping platform:**
The RPC function I sketched above requires `filter_platform` as a non-null arg. Tier 3 wants to drop it. **Two clean options:**

**Option A: Make `filter_platform` nullable in the RPC.**
```sql
WHERE ... AND (filter_platform IS NULL OR tc.platform = filter_platform)
```
Cleaner — fewer functions, planner can still optimize.

**Option B: Separate RPC functions per tier.**
Less DRY but each function's query plan is locked.

**Recommendation: Option A.** All three filters (niche, platform, tier) accept nullable values; the RPC body uses the `IS NULL OR x = filter` pattern. Niche is the ONE filter never relaxed in D-04 (always required, since it gates the entire candidate space). Have a separate `filter_niche text NOT NULL` and pass the others as optional.

### Tagging `relaxed_to`

Each accumulator entry gets the tier tag at insertion time. After re-ranking, the tag flows to `RetrievalEvidenceItem.relaxed_to` (D-02).

### Edge cases

- **Tier 1 already returns ≥ K_REC items:** Tier 2 + Tier 3 never run. `relaxed_to: "strict"` for all.
- **Tier 1 returns 0; Tier 2 returns 3; Tier 3 returns 2:** Final 5 items have mixed `relaxed_to` (`niche+platform` for 3, `niche_only` for 2). Re-ranker re-sorts by similarity-with-bonus, but `relaxed_to` stays per-item.
- **Niche not in NICHE_TREE:** Defensively return `{ evidence: [], score: null, availability: false }` + emit warning. NICHE_TREE is the universe.
- **`min_corpus_size` check:** AFTER relaxation, before computing score. Count the total candidate pool size after Tier 3 — NOT just the surviving K=5. The gate is "the niche has enough labeled corpus to trust the signal at all"; D-04b spec.

---

## Soft Re-ranker (Hashtag Overlap)

```typescript
// src/lib/engine/retrieval/re-ranker.ts (NEW)
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import type { MatchRow } from "./pgvector-client";

const HASHTAG_BONUS = 0.05; // D-04a — +5% per spec

/**
 * D-04a: re-rank top-K*2 raw matches by hashtag overlap with the taxonomy's
 * tag_filters for the input video's primary niche. Items with overlap get
 * +5% to similarity, then list is re-sorted, then top K kept.
 *
 * Edge cases:
 *  - empty tag_filters (niche not in NICHE_TREE): pass-through, no bonus
 *  - item with empty/null hashtags: no overlap → no bonus
 *  - all items overlap: same relative order (all get +0.05), no behavior change
 *  - no items overlap: same relative order (no one gets +0.05), no behavior change
 */
export function softRerank(
  matches: Array<MatchRow & { relaxed_to: string }>,
  inputNiche: string,
  K: number,
): Array<MatchRow & { relaxed_to: string; rerank_score: number }> {
  const niche = NICHE_TREE.find(n => n.slug === inputNiche);
  const tagFilters = new Set(niche?.benchmark_filters.tag_filters ?? []);

  const scored = matches.map(m => {
    const tags = (m.hashtags ?? []).map(t => t.toLowerCase().replace(/^#/, ""));
    const hasOverlap = tags.some(t => tagFilters.has(t));
    const rerank_score = hasOverlap
      ? Math.min(1, m.similarity + HASHTAG_BONUS)
      : m.similarity;
    return { ...m, rerank_score };
  });

  scored.sort((a, b) => b.rerank_score - a.rerank_score);
  return scored.slice(0, K);
}
```

**Hashtag normalization note:** The taxonomy `tag_filters` are LOWERCASE without `#` prefix (verified by reading `src/lib/niches/taxonomy.ts` — e.g. `"skincareroutine"`, `"grwm"`). Scraped/corpus `hashtags[]` columns store WITHOUT `#` prefix in some paths and WITH in others — defensively `.replace(/^#/, "")` and `.toLowerCase()` at compare time. Document this in re-ranker comments.

**Important:** the final `RetrievalEvidenceItem.similarity_score` field per D-02 is **the original cosine similarity, NOT the re-rank score.** The bonus is a sorting heuristic only — it must not leak into the persisted item (otherwise it pollutes the bucket-vote denominator in D-03). Verified by reading D-02 carefully ("`similarity_score: number; // cosine similarity in [0,1]`").

---

## Bucket Derivation Logic

```typescript
// src/lib/engine/retrieval/bucket-derivation.ts (NEW)
import { getThresholds } from "@/lib/engine/corpus/thresholds";

const CALIBRATED_NICHES = new Set([
  "beauty", "fitness", "education", "comedy", "lifestyle",
]);

/**
 * D-03a percentile snapshot for non-calibrated niches.
 * Computed once at backfill time per Phase 8 plan.
 *
 * IMPORTANT: This constant is updated at backfill time by `scripts/embed-corpus.ts`
 * after computing P80/P40 of engagement_rate across the scraped_videos pool per
 * niche. Until backfill runs, values are placeholders — DO NOT ship without
 * running the percentile-snapshot computation.
 */
export const NON_CORPUS_ENGAGEMENT_PERCENTILES: Record<
  string,
  { p80: number; p40: number }
> = {
  "food-cooking":      { p80: 0,  p40: 0 },  // TODO: backfill
  "tech-gadgets":      { p80: 0,  p40: 0 },  // TODO: backfill
  "gaming":            { p80: 0,  p40: 0 },  // TODO: backfill
  "fashion-style":     { p80: 0,  p40: 0 },  // TODO: backfill
  "music-performance": { p80: 0,  p40: 0 },  // TODO: backfill
};

export interface BucketDerivation {
  bucket_label: "viral" | "average" | "under";
  bucket_source: "corpus" | "derived";
}

interface DeriveInput {
  source_pool: "training_corpus" | "scraped_videos";
  bucket_label: "viral" | "average" | "under" | null;  // already-known if source_pool=training_corpus
  niche: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number | null;
}

// Note: D-03a uses the same niche names used in NICHE_TREE (10 slugs) but the
// corpus version uses 5 abbreviated niches: "edu" not "education". Map at boundary.
const CORPUS_NICHE_ALIASES: Record<string, string> = {
  "education": "edu",
};

/**
 * D-03a: derive (or carry forward) bucket label per evidence item.
 *  - training_corpus matches: use bucket column directly (bucket_source = "corpus")
 *  - scraped_videos in calibrated niche: use THRESHOLD_SNAPSHOTS["full.2026-05-11"]
 *  - scraped_videos in non-calibrated niche: use NON_CORPUS_ENGAGEMENT_PERCENTILES
 *
 * All scraped_videos paths emit bucket_source: "derived".
 */
export function deriveBucket(input: DeriveInput): BucketDerivation {
  if (input.source_pool === "training_corpus" && input.bucket_label) {
    return { bucket_label: input.bucket_label, bucket_source: "corpus" };
  }

  // scraped_videos path
  const isCalibrated = CALIBRATED_NICHES.has(input.niche);

  if (isCalibrated) {
    const corpusKey = CORPUS_NICHE_ALIASES[input.niche] ?? input.niche;
    const thresholds = getThresholds("full.2026-05-11");
    const t = thresholds[corpusKey as keyof typeof thresholds];
    if (!t) {
      // niche not in snapshot — fall back to average
      return { bucket_label: "average", bucket_source: "derived" };
    }
    if (input.views >= t.viralFloor) return { bucket_label: "viral", bucket_source: "derived" };
    if (input.views <= t.underCeiling) return { bucket_label: "under", bucket_source: "derived" };
    return { bucket_label: "average", bucket_source: "derived" };
  }

  // Non-calibrated: engagement rate percentile snapshot
  const percentiles = NON_CORPUS_ENGAGEMENT_PERCENTILES[input.niche];
  const engagementRate =
    (input.likes + input.shares + input.comments + (input.saves ?? 0)) /
    Math.max(input.views, 1);

  if (!percentiles || (percentiles.p80 === 0 && percentiles.p40 === 0)) {
    // backfill hasn't computed snapshot yet — bucket=average is the safe default
    return { bucket_label: "average", bucket_source: "derived" };
  }
  if (engagementRate >= percentiles.p80) return { bucket_label: "viral", bucket_source: "derived" };
  if (engagementRate <= percentiles.p40) return { bucket_label: "under", bucket_source: "derived" };
  return { bucket_label: "average", bucket_source: "derived" };
}
```

**Per-niche-corpus check (chicken-and-egg from Finding 5):**

```typescript
// At backfill time, scripts/embed-corpus.ts also writes the percentiles snapshot.
// Pseudo-code:
const PERCENTILE_MIN_POOL_SIZE = 30;
for (const niche of NON_CALIBRATED_NICHES) {
  const rows = await supabase.from("scraped_videos")
    .select("views, likes, shares, comments")
    .eq("primary_niche", niche)
    .gt("views", 0);
  if (rows.length < PERCENTILE_MIN_POOL_SIZE) {
    console.warn(`Niche ${niche}: only ${rows.length} rows; using p80=p40=0 (bucket=average fallback)`);
    continue;
  }
  const rates = rows.map(r => (r.likes + r.shares + r.comments) / Math.max(r.views, 1)).sort((a,b)=>a-b);
  const p80 = rates[Math.floor(rates.length * 0.8)];
  const p40 = rates[Math.floor(rates.length * 0.4)];
  // emit code-block to paste into bucket-derivation.ts
  console.log(`  "${niche}": { p80: ${p80}, p40: ${p40} },`);
}
```

The pattern mirrors Phase 1's `scripts/calibrate-thresholds.ts` (already in repo) — generate code, paste into the constant, commit to git. Snapshot is committed; runtime reads from code.

### Note: corpus niche slug mismatch

`training_corpus.niche` accepts only `{beauty, fitness, edu, comedy, lifestyle}` per the migration CHECK constraint (line 60 of `20260512000000_training_corpus.sql`). `NICHE_TREE` uses `education` (full word, see taxonomy.ts:115). At retrieval time, when filtering training_corpus by an input niche from NICHE_TREE, map `education → edu` (see `CORPUS_NICHE_ALIASES` above). For `scraped_videos.primary_niche` (new column), use the NICHE_TREE slug directly — no alias.

---

## Auto-embedding on Insert Pattern

### Two insert paths to extend (D-08)

**Path 1: `scripts/build-corpus.ts` → `bucketAndPersist()` in `src/lib/engine/corpus/orchestrator.ts:319-358`**

The DB row construction at line 319-342 builds `dbRows` BEFORE the upsert. Insert embedding computation between line 342 (build dbRows) and line 355 (upsert):

```typescript
// orchestrator.ts — extend bucketAndPersist (or split into bucketEmbedAndPersist)
// AFTER existing dbRows construction, BEFORE upsert:

import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";

const BATCH = 50; // batch size for Gemini embed (<=100 per API)

const dbRowsWithEmbeddings = [];
for (let i = 0; i < dbRows.length; i += BATCH) {
  const slice = dbRows.slice(i, i + BATCH);
  const texts = slice.map(r => buildSubjectText({
    primary_slug: r.niche === "edu" ? "education" : r.niche,  // reverse alias for embedding
    creator_handle: r.creator_handle,
    caption: r.caption,
    hashtags: r.hashtags,
  }));
  try {
    const { vectors } = await embedBatch(texts);
    for (let j = 0; j < slice.length; j++) {
      dbRowsWithEmbeddings.push({ ...slice[j], embedding: vectors[j] });
    }
  } catch (err) {
    log.warn("Embedding batch failed; inserting row with embedding=null", {
      offset: i,
      error: err instanceof Error ? err.message : String(err),
    });
    for (const r of slice) {
      dbRowsWithEmbeddings.push({ ...r, embedding: null });
    }
  }
}
```

**Subtle point:** the corpus niche alias inverts at embedding time — `training_corpus` stores `"edu"` but the canonical subject text per D-06 uses the NICHE_TREE slug `"education"`. **Predict-time will use `"education"`**, so backfill MUST embed with `"education"` too for cosine to be meaningful. The alias only applies at filter time (Postgres-side WHERE clauses). Document this load-bearing detail in `embedder.ts`.

**Path 2: `src/app/api/webhooks/apify/route.ts:67-99` (scraped_videos upsert)**

The handler builds `records[]` at line 67-90, then upserts at line 95. Insert embedding step:

```typescript
// webhooks/apify/route.ts — between records build and upsert
import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";
import { CATEGORY_TO_NICHE_SLUG } from "@/lib/engine/retrieval/category-mapping"; // NEW

const recordsWithEmbeddings = [];
const BATCH = 50;
for (let i = 0; i < records.length; i += BATCH) {
  const slice = records.slice(i, i + BATCH);
  const textInputs = slice.map(r => ({
    primary_slug: r.primary_niche,    // already mapped in the records build above
    creator_handle: r.creator_handle ?? r.author,
    caption: r.description,
    hashtags: r.hashtags,
  }));
  const texts = textInputs.map(buildSubjectText);
  try {
    const { vectors } = await embedBatch(texts);
    for (let j = 0; j < slice.length; j++) {
      recordsWithEmbeddings.push({ ...slice[j], embedding: vectors[j] });
    }
  } catch {
    // Embedding failure does NOT break the scrape pipeline — null embedding,
    // backfill catches up next CLI run.
    for (const r of slice) {
      recordsWithEmbeddings.push({ ...r, embedding: null });
    }
  }
}

// Then upsert as before, with recordsWithEmbeddings.
```

**Important:** webhook handler must also populate the new `primary_niche` and `creator_handle` columns (Finding 3). The records build at line 67-90 needs:

```typescript
{
  // existing fields ...
  creator_handle: item.authorMeta?.name ?? null,
  primary_niche: deriveNicheFromCategory(payload.scrape_hashtags, item.hashtags), // NEW
  posted_at: item.createTimeISO ?? null,  // if Apify provides; else null
}
```

The `deriveNicheFromCategory` helper is the same category→slug mapping from Finding 3's Strategy A; for cron-scraped rows, the active hashtag set (`payload.scrape_hashtags`) is a strong niche signal.

### Why not Postgres trigger + edge function?

CONTEXT D-08 mentions option (b) as an alternative. **Rejected for two reasons:**
1. Subject formula (D-06) lives in TS. A trigger+edge function would either duplicate the formula (drift risk) or call out to a TS endpoint (latency + auth complexity). Single source of truth wins.
2. Embedding failures need observability via Sentry. TS pathways already wrap in Sentry. Edge function path adds another point of failure to monitor.

### Idempotent backfill CLI

```typescript
// scripts/embed-corpus.ts (NEW) — per Phase 1 convention (config + tsconfig-paths setup)
async function main() {
  // SAME shape as scripts/build-corpus.ts — config({path: ".env.local"}), register tsconfig-paths.
  const supabase = createServiceClient();

  for (const table of ["training_corpus", "scraped_videos"] as const) {
    let offset = 0;
    const PAGE = 200;  // page through; embed 50/batch within each page
    let totalEmbedded = 0;

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("id, caption, description, creator_handle, author, hashtags, niche, primary_niche")
        .is("embedding", null)
        .order("id")
        .range(offset, offset + PAGE - 1);
      if (error || !data || data.length === 0) break;

      // ... build subject texts, embed in 50-batches, update rows
      // Update via .update({ embedding: vec }).eq("id", id)

      offset += PAGE;
      totalEmbedded += data.length;
    }
    console.log(`Embedded ${totalEmbedded} rows in ${table}`);
  }

  // For non-calibrated niches: compute + emit NON_CORPUS_ENGAGEMENT_PERCENTILES code block.
  // (See Finding 5 pseudo-code above.)
}
```

Idempotency: skip rows where `embedding IS NOT NULL`. Re-running after a code change to the subject formula (D-06) requires a manual flag: `--re-embed-all` would `UPDATE ... SET embedding = NULL` before iterating. **Document this caveat in the script's `--help`** — the planner should explicitly warn that re-embedding ALL rows is a multi-minute operation that costs cents but burns rate-limit quota.

### Skip rows with all-null fields

CONTEXT.md mentions: "Pre-existing scraped_videos rows without `creator_handle` or `hashtags` — embedding formula (D-06) treats null fields as empty strings. Planner verifies no scraped_videos row currently has all four input fields null."

In the backfill: `if (!caption && !creator_handle && (!hashtags || hashtags.length === 0)) skip` — embedding `"[niche:tech-gadgets] @: \n"` is meaningless (only the niche slug carries signal). Log + skip + count in a "could not embed (insufficient text)" bucket. Make this an at-most-N-per-niche skip so a future audit can confirm the count is small.

---

## Migration Structure & Filename

### Single migration file (recommended)

```
supabase/migrations/<YYYYMMDDHHMMSS>_phase8_pgvector.sql
```

Following the project pattern (`20260517120000_phase3_pipeline_columns.sql` = phase 3 columns), naming would be e.g. `20260520000000_phase8_pgvector.sql` (using a date ≥ today). The planner picks the actual timestamp.

### File content (full migration)

```sql
-- Phase 8: Benchmark Retrieval — pgvector + embeddings + analysis_results columns.
-- Per CONTEXT D-07, D-11. All statements use IF NOT EXISTS for idempotent re-runs.

-- =====================================================
-- Enable pgvector
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =====================================================
-- training_corpus — embedding column + HNSW index
-- =====================================================
ALTER TABLE training_corpus
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

CREATE INDEX IF NOT EXISTS training_corpus_embedding_hnsw
  ON training_corpus
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================
-- scraped_videos — embedding + missing filter columns + HNSW index
-- =====================================================
ALTER TABLE scraped_videos
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
  ADD COLUMN IF NOT EXISTS primary_niche TEXT,
  ADD COLUMN IF NOT EXISTS follower_tier TEXT
    CHECK (follower_tier IS NULL OR follower_tier IN ('nano','micro','mid','large','mega')),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creator_handle TEXT;

-- One-time backfill of creator_handle from author
UPDATE scraped_videos
  SET creator_handle = author
  WHERE creator_handle IS NULL AND author IS NOT NULL;

-- One-time backfill of primary_niche from category — planner audits DISTINCT
-- categories first and fills the UPDATE statements. Example:
-- UPDATE scraped_videos SET primary_niche = 'beauty'
--   WHERE primary_niche IS NULL AND category IN ('beauty','makeup','skincare');
-- ... etc. Unmapped: stays NULL → excluded from retrieval pool.

CREATE INDEX IF NOT EXISTS scraped_videos_embedding_hnsw
  ON scraped_videos
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard btree index on the new niche column (planner combines with vector predicate)
CREATE INDEX IF NOT EXISTS idx_scraped_videos_primary_niche
  ON scraped_videos(primary_niche) WHERE primary_niche IS NOT NULL;

-- =====================================================
-- analysis_results — retrieval_evidence + retrieval_score columns (D-11)
-- =====================================================
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS retrieval_evidence JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS retrieval_score NUMERIC(5,4);

-- =====================================================
-- RPC functions (called from src/lib/engine/retrieval/pgvector-client.ts)
-- =====================================================
-- match_corpus_videos(...): see Query Pattern section above
-- match_scraped_videos(...): see Query Pattern section above
-- (Full SQL in this file — too long to repeat here)
```

### How to apply

Following Phase 3's pattern (STATE.md line 139): user-applied via Supabase Studio SQL editor; types regenerated via `supabase gen types typescript --linked > src/types/database.types.ts`. The migration file is committed to git regardless. **The plan must include a task to update `database.types.ts` after running the migration** — Phase 3 had this as a separate step (commit 39cadb3 in STATE.md).

### Why a single migration

- All Phase 8 schema is interconnected (RPC depends on column types, indexes on column existence)
- One commit = one deployable migration boundary
- Matches Phase 3's pattern (single file)
- Easy rollback (DROP EXTENSION VECTOR CASCADE drops all dependent objects)

---

## Wave 1 Integration (concrete pipeline.ts diff sketch)

### Diff approach

Edit `src/lib/engine/pipeline.ts` between lines 332-431 (Wave 1 block). Add `runBenchmarkRetrieval` as a 5th sibling.

```typescript
// pipeline.ts — additions inside runPredictionPipeline, before Wave 1 Promise.all

import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage";
import type { BenchmarkRetrievalResult } from "./retrieval/types";

// ... existing pipeline body ...

// Stage 6.5: Benchmark Retrieval — NON-CRITICAL (fallback with warning per D-09 graceful degradation)
const retrievalPromise = (async (): Promise<BenchmarkRetrievalResult> => {
  try {
    return await timed("retrieval", timings, () =>
      runBenchmarkRetrieval({
        payload,
        creatorContext,
        wave0Result,
        supabase,
      }),
      { wave: 1, onEvent: onStageEvent }
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "retrieval", requestId } });
    warnings.push(
      `Retrieval unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "retrieval", duration_ms: 0 });
    return { evidence: [], score: null, availability: false };
  }
})();

// Then change the Promise.all destructure:
const [geminiResult, audioResult, , ruleResult, retrievalResult] = await timed(
  "wave_1",
  timings,
  () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise, retrievalPromise]),
  { wave: 1, onEvent: onStageEvent }
);
```

### Add to PipelineResult

```typescript
export interface PipelineResult {
  // ... existing fields ...
  retrievalResult: BenchmarkRetrievalResult; // NEW
}
```

### Stage event name

Use `"retrieval"` as the stage name (D-09 says the stage emits `retrieval` start/end events). Matches the naming convention `gemini_analysis`, `audio_analysis`, `creator_context`, `rule_scoring` — single word or snake_case identifier.

### `runBenchmarkRetrieval` self-emit?

Note: in Phase 4, Wave 0 detectors emit their OWN stage events (`wave_0_content_type`, `wave_0_niche_detector`) — see `niche-detector.ts:54`. But the orchestrator (`wave0.ts`) does NOT emit; the detectors do.

For Phase 8, the cleanest path matches what Wave 1 currently does: the OUTER `timed("retrieval", ...)` wrapper around `runBenchmarkRetrieval()` IS the stage event emitter — the function itself does not call `emitStageStart/End`. This is consistent with `gemini_analysis`, `creator_context`, `rule_scoring` — they're wrapped by `timed()` in pipeline.ts and don't self-emit.

**Reasoning:** Wave 0 self-emits because there are TWO detectors emitting INDEPENDENTLY inside the Promise.allSettled — orchestrator-level emit can't disambiguate. Phase 8 retrieval is ONE stage, one emit pair — `timed()` wrapper suffices.

### `creatorContext` passing

`creatorContext` is already in scope at line 286 of pipeline.ts (pre-fetched per Phase 4 D-17/D-18). Pass it as a property of the options bag.

### `wave0Result.niche.primary` access

D-09 says retrieval reads `wave0Result.niche.primary`. Wave 0 runs BEFORE Wave 1 (line 310: `const wave0Result = await runWave0(...)`). At Wave 1 entry, `wave0Result` is fully resolved. Inside `runBenchmarkRetrieval`, handle the null case:

```typescript
const primary = wave0Result.niche?.primary ?? null;
if (!primary) {
  // Niche unknown — retrieval not viable. Per D-04 graceful degradation:
  return { evidence: [], score: null, availability: false };
}
```

### Pipeline test compatibility

Existing `src/lib/engine/__tests__/pipeline.test.ts` asserts stage event names + counts. Adding `"retrieval"` to the Wave 1 emit set is an additive change to those assertions. **The planner's task is to update the test alongside the pipeline diff**, NOT mock-out retrieval to preserve old assertions. Phase 4 set this precedent (added 2 new Wave 0 stages to the assertion list).

---

## Aggregator Extension (concrete aggregator.ts diff sketch)

### Three changes to `aggregator.ts`

**Change 1: SCORE_WEIGHTS table (D-03b)** — lines 31-37

```typescript
const SCORE_WEIGHTS = {
  behavioral: 0.33,  // was 0.35 → 0.35 × 0.95
  gemini:     0.24,  // was 0.25 → 0.25 × 0.95
  ml:         0.14,  // was 0.15 → 0.15 × 0.95
  rules:      0.14,  // was 0.15 → 0.15 × 0.95
  trends:     0.10,  // was 0.10 → 0.10 × 0.95 = 0.095 ≈ 0.10 (rounded)
  retrieval:  0.05,  // NEW
} as const;
```

**⚠️ Rounding check:** the locked D-03b numbers (0.33, 0.24, 0.14, 0.14, 0.10, 0.05) sum to **1.00 exactly**. The "× 0.95" rule actually gives 0.3325, 0.2375, 0.1425, 0.1425, 0.095, 0.05 = 1.0 sum. The rounded values in CONTEXT D-03b are the LOCKED truth; the math is a derivation rationale. Use the rounded values verbatim.

**Change 2: SCORE_WEIGHT_KEYS** — line 43

```typescript
const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends", "retrieval"] as const;
```

This is load-bearing — see the PATTERNS Critical Cross-File Constraint #3 comment at line 39-42. Adding `retrieval` to the keys list means it participates in weight redistribution. **Validate:** this is DESIRED for retrieval, unlike Phase 4's `content_type`/`niche` which are provenance-only.

**Change 3: SignalAvailability + setting** — types.ts line 198-206 + aggregator.ts line 330-349

In `types.ts`:
```typescript
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;
  niche: boolean;
  retrieval: boolean;  // NEW Phase 8 — D-10
}
```

In `aggregator.ts` (line 330-349 in `aggregateScores()`):
```typescript
const availability: SignalAvailability = {
  // ... existing ...
  retrieval: pipelineResult.retrievalResult.availability,  // NEW
};
```

The `selectWeights()` redistribution logic (lines 59-102) iterates `SCORE_WEIGHT_KEYS` — adding `retrieval` to that array means when `availability.retrieval = false`, its 0.05 weight redistributes to the other 5 sources proportionally. **This is the locked D-04b behavior** (min_corpus_size gate fails → retrieval = false → weights redistribute).

### `selectWeights()` return type update

Lines 60-62:
```typescript
export function selectWeights(
  availability: SignalAvailability
): { behavioral: number; gemini: number; ml: number; rules: number; trends: number; retrieval: number } {
```

And line 86:
```typescript
const result = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0, retrieval: 0 };
```

### overall_score formula update

Line 386-392 currently:
```typescript
behavioral_score * weights.behavioral +
  gemini_score * weights.gemini +
  (mlScore ?? 0) * weights.ml +
  ruleResult.rule_score * weights.rules +
  trendEnrichment.trend_score * weights.trends
```

Add (note: D-03 retrieval_score is [0,1], must scale × 100 to match other scores in [0,100]):
```typescript
+ ((pipelineResult.retrievalResult.score ?? 0) * 100) * weights.retrieval
```

The `?? 0` handles `availability.retrieval = false` → `score = null` → `selectWeights` already zeroed `weights.retrieval` → product is 0. Double-safety.

### PredictionResult schema (D-11)

Add to `types.ts` PredictionResult interface (line 142-187):
```typescript
retrieval_score: number | null;        // [0,1], null when availability.retrieval = false
retrieval_evidence: RetrievalEvidenceItem[];  // D-02 shape, max 5 items
```

And to the assemble at line 519-545:
```typescript
const result: PredictionResult = {
  // ... existing ...
  retrieval_score: pipelineResult.retrievalResult.score,
  retrieval_evidence: pipelineResult.retrievalResult.evidence,
};
```

### Phase 4 pattern reference (additive provenance keys vs weight keys)

Phase 4 added `content_type` + `niche` keys to `SignalAvailability` but EXPLICITLY filtered them out of `selectWeights` (line 65-69 + line 442-451 — see the line 39-42 critical comment).

**Phase 8 is different:** `retrieval` IS a weight-bearing signal. Add to BOTH `SignalAvailability` AND `SCORE_WEIGHT_KEYS`. The Phase 4 filter pattern doesn't apply here.

### Confidence calculation (line 115-160)

The current `calculateConfidence` does NOT consider retrieval availability. **Decision: don't modify** for Phase 8. Phase 8 is additive (BENCH-05 — 203 tests pass unchanged); the confidence formula is invariant to the new signal. Phase 10 can extend confidence math.

### Tests to update

- `aggregator.test.ts` — assertions on `selectWeights` output shape now expect 6 keys; existing tests for missing signals need a `retrieval: true` value injected (else `selectWeights` redistributes its 0.05 unexpectedly)
- New test cases: retrieval=false redistribution math (0.05 → other 5 weights proportionally)

This is the trickiest part. The Phase 4 plan had the same pattern — added new keys to availability, existing tests had to specify the new keys. The plan must inventory every `availability: SignalAvailability` literal in tests and inject `retrieval: true` (the unchanged behavior).

---

## Validation Architecture (Nyquist)

> Required since `workflow.nyquist_validation: true` per `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | (project root) `vite.config.ts` or `vitest.config.ts` — planner verifies |
| Quick run command | `pnpm test src/lib/engine/retrieval/__tests__/<file>.test.ts -t '<name>' --run` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| RETRIEVAL-01 | pgvector extension + columns + HNSW index | smoke | `psql ... -c "\dx vector"` + `\d training_corpus` + `\di+ training_corpus_embedding_hnsw` | ❌ Wave 0 (post-migration smoke test) |
| RETRIEVAL-02 | Embedding pipeline (embed at scrape + at backfill) | unit | `pnpm test src/lib/engine/retrieval/__tests__/embedder.test.ts --run` | ❌ Wave 0 |
| RETRIEVAL-02b | D-06 byte-identical formula | unit | (above; specific test case `buildSubjectText is deterministic and byte-identical for same inputs`) | ❌ Wave 0 |
| RETRIEVAL-03 | Predict-time embed <1s + top-K=5 with filter | integration | `pnpm test src/lib/engine/retrieval/__tests__/retrieval-stage.test.ts --run` (mocked Gemini + Supabase RPC) | ❌ Wave 0 |
| RETRIEVAL-04 | Hierarchical relaxation: T1→T2→T3 + K=5 dedup | unit | (above; specific test cases for tier transitions, mixed-tier final 5) | ❌ Wave 0 |
| RETRIEVAL-04b | Soft re-ranker: bonus, edge cases | unit | `pnpm test src/lib/engine/retrieval/__tests__/re-ranker.test.ts --run` | ❌ Wave 0 |
| RETRIEVAL-04c | Bucket derivation: corpus_known, calibrated, non-calibrated | unit | `pnpm test src/lib/engine/retrieval/__tests__/bucket-derivation.test.ts --run` | ❌ Wave 0 |
| RETRIEVAL-04d | min_corpus_size gate behavior | unit | (in retrieval-stage.test.ts; specific cases) | ❌ Wave 0 |
| RETRIEVAL-05 | retrieval_evidence + retrieval_score on PredictionResult | integration | (extend aggregator.test.ts) | ⚠️ exists; add test cases |
| RETRIEVAL-05b | Aggregator weight redistribution with retrieval=false | unit | (extend aggregator.test.ts) | ⚠️ exists; add test cases |
| RETRIEVAL-06 | Backfill CLI idempotency + percentile snapshot computation | manual + smoke | `pnpm tsx scripts/embed-corpus.ts --help` + dry-run sanity | manual-only (CLI E2E too expensive to automate) |
| BENCH-05 | 203 existing tests pass unchanged | regression | `pnpm test` (full suite, no new failures) | ✅ existing |

### Sampling Rate

- **Per task commit:** `pnpm test src/lib/engine/retrieval/__tests__ --run` (≈ 5s — only the new retrieval tests)
- **Per wave merge:** `pnpm test` (full suite — must pass before merging worker branches)
- **Phase gate:** Full suite green before `/gsd-verify-work`. ZERO failing tests. Coverage thresholds met (project default 80%).

### Wave 0 Gaps

- [ ] `src/lib/engine/retrieval/__tests__/embedder.test.ts` — D-06 formula determinism, batch shape, error wrapping
- [ ] `src/lib/engine/retrieval/__tests__/retrieval-stage.test.ts` — orchestration + tier relaxation + min_corpus_size gate + graceful degradation
- [ ] `src/lib/engine/retrieval/__tests__/re-ranker.test.ts` — D-04a math, edge cases (empty tags, empty filters)
- [ ] `src/lib/engine/retrieval/__tests__/bucket-derivation.test.ts` — D-03a all branches
- [ ] `src/lib/engine/retrieval/__tests__/pgvector-client.test.ts` — RPC error wrapping + mock shape
- [ ] Aggregator test cases — `retrieval` availability flag + weight redistribution
- [ ] Pipeline test cases — `retrieval` stage event emission

### Sampling points + edge cases per branch (per § Validation Strategy generator request)

**(a) Subject-text formula (D-06)**
- Sampling: `buildSubjectText` unit tests
- Edge cases: null caption, empty hashtags, missing handle, very long caption (>500 chars), non-ASCII chars, caption with newlines (formula uses `\n` as separator — collision risk; document)
- Failure modes: nullable input not handled → exception
- Parity test seeds: identical (slug, handle, caption, hashtags) tuples → byte-identical output strings (cosine requires this)

**(b) SQL filter + relaxation transition**
- Sampling: integration test of `retrieveWithRelaxation` against mocked supabase.rpc
- Edge cases: Tier 1 returns 5 (skip T2/T3), Tier 1 returns 0 (use T2), all tiers return 0 (return empty), niche not in corpus (still queries scraped_videos), pool empty entirely
- Failure modes: RPC rejection wrapped + caught (return empty), dedup not working (same id from T1 and T2)
- Parity test seeds: deterministic mock data → deterministic relaxed_to tagging on final 5

**(c) Bucket derivation function**
- Sampling: branch-by-branch unit test
- Edge cases: training_corpus row with `bucket` = null (corrupt data — fall back to derived), calibrated niche but threshold map missing (return "average"), non-calibrated niche with snapshot=0 (fallback), engagement rate exactly at p80 / p40 boundary, views = 0
- Failure modes: division by zero on `views=0` (use `Math.max(views, 1)`)
- Parity test seeds: deterministic input → deterministic bucket; verify both `corpus` and `derived` source values

**(d) Re-ranker hashtag math (D-04a)**
- Sampling: unit tests of `softRerank` over fixed input arrays
- Edge cases: K_REC = 0 (empty array), K_REC = 1 (no re-sorting possible), all items have overlap (same relative order preserved), no items have overlap (same order, no bonus), hashtags are uppercase / `#`-prefixed (normalization)
- Failure modes: original similarity field mutated (bug — should be immutable; bonus only used for sorting)
- Parity test seeds: fixed input + fixed input niche → fixed re-ranked output

**(e) Final score formula (D-03)**
- Sampling: unit test of `computeRetrievalScore`
- Edge cases: zero matches (return null), all matches viral (score = 1.0), all matches under (score = 0.0), one viral + one under with equal similarity (score = 0.5), single match (score = bucket_value), denominator zero protection
- Failure modes: division by zero, NaN propagation, score outside [0,1]
- Parity test seeds: fixed (sim, bucket) tuples → fixed score

**Failure modes per branch (overall)**

| Branch | Failure | Detection | Recovery |
|--------|---------|-----------|----------|
| Embedding API error | Gemini 429/500/timeout | try/catch + Sentry | Return `{ evidence: [], score: null, availability: false }` + warning |
| Supabase RPC error | RPC throws or returns error | rpc-client wrapper | Same as above |
| Embedding column null | All rows have NULL embedding (backfill not run) | RPC returns 0 rows | Same — graceful empty result |
| primary_niche null on scraped_videos | Pre-migration row | Excluded by `WHERE primary_niche = filter` | Just smaller pool |
| Subject formula change | Embeddings stale vs new formula | Cosine similarity drops; no detection | Re-run backfill script with `--re-embed-all` |
| Pool < min_corpus_size | Niche too new / underpopulated | `retrieval_score = null` + warning | Aggregator redistributes weight |

---

## Test Surface & Mocking Patterns

### Vitest patterns established in repo

**Pattern 1: Mock `@google/genai` (gemini.test.ts:lines for `vi.mock("@google/genai")`)**
```typescript
const mockGenerate = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate, embedContent: mockGenerate /* NEW */ };
    this.files = { upload: vi.fn(), get: vi.fn(), delete: vi.fn() };
  });
  return { GoogleGenAI: MockGoogleGenAI, Type: { OBJECT: "OBJECT", /* ... */ } };
});
```

For Phase 8, extend the mock with `embedContent` returning a deterministic vector:
```typescript
mockEmbedContent.mockResolvedValueOnce({
  embeddings: [{ values: new Array(768).fill(0).map((_, i) => Math.sin(i)) }],
});
```

**Pattern 2: Mock service Supabase client (creator.test.ts pattern)**
```typescript
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(/* ... */),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "match_corpus_videos") return { data: MOCK_MATCHES.training, error: null };
      if (fn === "match_scraped_videos") return { data: MOCK_MATCHES.scraped, error: null };
      return { data: null, error: { message: "unknown rpc" } };
    }),
  })),
}));
```

**Pattern 3: Test parallel-stage code (pipeline.test.ts)**
- Mock all sibling stages to resolve immediately with canned values
- Assert ALL stage events fire (in any order due to parallelism) using `toHaveBeenCalledWith(...)` with discriminated event payloads
- Use `Promise.all` (real) — don't fake timers; the parallelism is observable via mock call order

### No live pgvector in CI

Per CONTEXT.md Claude's Discretion: "NO live pgvector call in CI (mock the supabase client; live DB integration test acceptable if cheap)."

**Recommendation:** All Vitest tests mock `.rpc()` returns. A separate `pnpm` script for manual integration testing against a Supabase preview branch (not gated in CI):
```json
"scripts": {
  "test:retrieval:live": "EMBED_LIVE=1 pnpm tsx scripts/test-retrieval-live.ts"
}
```

### Testing the migration

**SQL migration tests:**
- Phase 3 pattern (STATE.md): migration applied via Supabase Studio SQL editor, then `pnpm supabase gen types typescript --linked > src/types/database.types.ts` regenerates types.
- A manual smoke test post-migration (planner adds to phase plan):
  1. `\dx vector` — extension installed
  2. `\d training_corpus` — `embedding` column exists, type `extensions.vector(768)`
  3. `\di+ training_corpus_embedding_hnsw` — index exists, HNSW type
  4. Insert a sample row with a hand-crafted vector; query against itself; expect similarity = 1.0
  5. Run RPC `match_corpus_videos(<query>, 5, 'beauty', 'tiktok', null)` — expect ≤5 rows ordered by distance

No automated DDL test in Vitest (mocking DDL is meaningless). Manual smoke test in the plan SUMMARY.

### Mocking the embedder in tests that don't care

For tests of `retrieval-stage.ts` (orchestration) that don't care about Gemini specifically:
```typescript
vi.mock("../retrieval/embedder", () => ({
  embedQuery: vi.fn(async () => ({ vector: new Array(768).fill(0.1), cost_cents: 0.0001 })),
  buildSubjectText: vi.fn(() => "test subject text"),
}));
```

This is much cleaner than mocking the whole Gemini SDK call chain.

---

## Performance Budget & Risks

### Per-prediction budget

Per SC #3: "Predict-time embedding of input video summary completes in <1s and queries top-K=5 with niche + platform + tier filter."

| Step | Typical | Worst case |
|------|---------|------------|
| `buildSubjectText` (in-memory) | <1 ms | <1 ms |
| `embedQuery` (Gemini API call, 1 short text) | 200-400 ms | 800 ms (network jitter) |
| `matchTrainingCorpus` RPC (~225 rows, HNSW, small filter) | <20 ms | <50 ms |
| `matchScrapedVideos` RPC (low thousands, HNSW, small filter) | <30 ms | <80 ms |
| 2× more RPC calls if relaxation triggers (T2 + T3) | ≤80 ms additional | ≤160 ms additional |
| `softRerank` (in-memory ≤10 items × constant Set lookup) | <1 ms | <1 ms |
| `deriveBucket` per item × 5 (in-memory lookup) | <1 ms | <1 ms |
| `computeScore` (5-item reduce) | <1 ms | <1 ms |

**Total typical:** ~250 ms
**Total worst case:** ~1.0 s (right at the SC boundary)

If Gemini embedding latency consistently exceeds 800 ms (rare), Phase 10 can introduce a stage-level embedding cache. NOT a Phase 8 concern (D-13).

### Wave 1 envelope

Wave 1's current slowest sibling is `gemini_video_analysis` (3-5 s — verified in CONTEXT.md). Adding a ~500 ms retrieval call as a parallel sibling does NOT extend the wave duration (Promise.all gates on the slowest, not the sum). Wave 1 envelope unchanged.

### Cost budget (D-15, D-16)

- Backfill: 225 corpus + ~few thousand scraped (assume 3000). 3225 texts × ~125 tokens each = ~400K tokens. At $0.15/M = ~$0.06 total. Well under D-16's <$1 budget.
- Predict-time: 1 embed per prediction × ~125 tokens = $0.0000188 = 0.00188¢. **At 500 predictions per benchmark run, that's <1¢.** Phase 12's $0.075/prediction milestone budget is unaffected.

### Risks

1. **Backfill subject formula change after embedding.** If D-06 changes, ALL embeddings are invalid for similarity. Mitigation: lock D-06 in code with a comment block + corpus_version-style versioning. A future formula change requires `pnpm tsx scripts/embed-corpus.ts --re-embed-all`.

2. **scraped_videos primary_niche backfill quality.** Category → slug mapping is hand-coded. Wrong mappings produce off-topic retrieval. Mitigation: planner audits `SELECT DISTINCT category` before encoding the mapping; unmapped categories stay NULL (excluded, not wrong).

3. **min_corpus_size gate firing too often.** Per Phase 4 D-14, `min_corpus_size` is 15-25 per niche. With training_corpus at 225 across 5 niches (~45 each), the gate is in safe territory for calibrated niches. For non-calibrated niches relying on `scraped_videos`, this depends on scrape coverage. Mitigation: track `retrieval_pool_too_small` warning rate in eval harness; Phase 10 can revisit.

4. **Bucket derivation for sparse scraped_videos niches.** If `tech-gadgets` has fewer than 30 rows, percentile snapshot is unreliable → all marked "average" → retrieval score is uninformative. Mitigation: documented fallback (Finding 5); plan for eval-harness telemetry on "% items marked 'average' via fallback path" so Phase 10 has a tuning lever.

5. **Single-pool fall-through risk.** D-01 says corpus first, scraped_videos fallback. If corpus pool is empty for the input niche (e.g., a non-Phase-1 niche), retrieval relies entirely on scraped_videos. The `min_corpus_size` gate (D-04b) is the safety valve.

6. **HNSW recall@5.** With small corpus (225 rows) and small selective filters, the HNSW graph traversal can return suboptimal results. pgvector 0.8's `hnsw.iterative_scan = strict_order` mitigates. Worst case: a single Phase 10 eval shows recall@5 < 80% — the planner can switch to a different index strategy (or even sequential scan, which is fast at 225 rows). Tracked as Phase 10 deferred.

---

## Code Examples (verified patterns from official sources)

### Example 1: Enable pgvector + create vector column

```sql
-- Source: https://supabase.com/docs/guides/database/extensions/pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  embedding extensions.vector(384)
);
```

### Example 2: HNSW index with cosine

```sql
-- Source: pgvector README (Context7 — /pgvector/pgvector)
CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### Example 3: Postgres RPC for top-K with filter

```sql
-- Source: https://supabase.com/docs/guides/ai/semantic-search
create or replace function match_documents (
  query_embedding extensions.vector(512),
  match_threshold float,
  match_count int,
  filter_category text
)
returns setof documents
language sql as $$
  select *
  from documents
  where documents.category = filter_category
    and documents.embedding <=> query_embedding < 1 - match_threshold
  order by documents.embedding <=> query_embedding asc
  limit least(match_count, 200);
$$;
```

### Example 4: Calling RPC from supabase-js

```ts
// Source: https://supabase.com/docs/guides/ai/semantic-search
const { data: documents } = await supabase.rpc('match_documents', {
  query_embedding: embedding,
  match_threshold: 0.78,
  match_count: 10,
  filter_category: 'blog',
});
```

### Example 5: Gemini embedContent via @google/genai

```typescript
// Source: Context7 — /googleapis/js-genai
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.embedContent({
  model: "gemini-embedding-001",  // updated from text-embedding-004
  contents: ["What is the capital of France?"],
  config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY" },
});

const vector = response.embeddings![0].values!;  // 768 numbers, normalized
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| IVFFlat indexes | HNSW indexes | pgvector 0.5+ (2023) | HNSW is the default; better recall, no rebuild on growth |
| `text-embedding-004` | `gemini-embedding-001` | 2026-01-14 (shutdown) | **D-05 model is dead — see Finding 1** |
| Single dimension models | MRL (Matryoshka) | gemini-embedding-001 release | Truncate from 3072 → 768 with 0.26% quality loss |
| pgvector pre-filter limitations | `hnsw.iterative_scan` | pgvector 0.8.0 | Filter+vector queries with small selective WHERE clauses now performant |
| `task_type` parameter | Prompt-based (deprecated in v2 embedding models) | gemini-embedding-2 (preview) | gemini-embedding-001 still supports taskType; gemini-embedding-2 doesn't |

**Deprecated/outdated:**
- Phase 8 CONTEXT.md D-05's `text-embedding-004`: dead since 2026-01-14. Replace with `gemini-embedding-001 + outputDimensionality: 768`.
- The Apify cron handler's lack of `primary_niche` / `creator_handle` / `posted_at` is a 2024-era schema gap that's never been addressed (carry-forward from STATE.md "completion_pct = null" pattern). Phase 8 closes the gap minimally.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@google/genai` v1.41.0 supports calling `model: "gemini-embedding-001"` despite predating that model's GA | Stack / Embedding | Embedding call returns 404 — fallback: upgrade SDK to ≥1.45 (which Context7 confirms supports the model). Validate at first call in dev. |
| A2 | `scraped_videos` row count is in the low thousands today (not tens of thousands) | Performance Budget | Larger pool = longer HNSW build + larger backfill cost. Validate with `SELECT count(*) FROM scraped_videos` before plan finalization. |
| A3 | Apify webhook item has `createTimeISO` field for `posted_at` backfill | Migration | If absent, posted_at stays NULL — D-04 tier 1 platform-time filter not impacted (tier doesn't filter on age) |
| A4 | Free-tier Gemini RPM is sufficient for 30-50 backfill batch calls in a session | Performance | If 429 rate-limited, soft retry with backoff handles it; worst case backfill runs over 2-3 sessions |
| A5 | Subject-text formula's `\n` separator collides with literal newlines in captions (`caption.includes('\n')`) but is acceptable noise | D-06 implementation | Cosine similarity is robust to small textual noise; the niche label + hashtags dominate the embedding signal |
| A6 | `primary_niche` column on `scraped_videos` can be backfilled via a deterministic category→slug map without LLM classification | Finding 3 Strategy A | If categories are too messy / sparse, the planner may need a small DeepSeek classify pass (would be expensive — last resort) |
| A7 | `gemini-embedding-001` returns normalized vectors when `outputDimensionality: 768` (per GA announcement) | embedder.ts | If not normalized, similarity math gives wrong direction. Validate by computing norm of first response: `Math.sqrt(values.reduce((s,x)=>s+x*x,0))` should equal 1.0 within float epsilon. |
| A8 | The locked weight redistribution math (0.33, 0.24, 0.14, 0.14, 0.10, 0.05) sums to exactly 1.00 | aggregator.ts D-03b | If sum < 1.0, overall_score is biased low; if > 1.0, biased high. Verified by hand: 0.33+0.24+0.14+0.14+0.10+0.05 = 1.00. ✅ |
| A9 | Existing `aggregator.test.ts` tests all explicitly construct `SignalAvailability` literals (rather than using a helper factory) | Test surface | Adding `retrieval` key requires touching every test. If a factory exists, one-line update suffices. Plan should verify upfront with `grep "SignalAvailability =" src/lib/engine/__tests__/`. |
| A10 | Bucket-derivation fallback "all average" for unknown niches doesn't poison the retrieval signal | bucket-derivation.ts | If non-calibrated niche pools yield all-average buckets, `retrieval_score = 0.5` for those niches regardless of similarity — uninformative. Mitigation: log + Phase 10 can revisit |

---

## Open Questions for Planner

1. **Migration approach: Supabase CLI push vs Studio SQL editor**
   - What we know: Phase 3 pattern (STATE.md line 139) — user applied via Studio SQL editor. Migration file committed regardless.
   - What's unclear: does the Phase 8 plan need an explicit instruction for the user to run `pnpm supabase gen types typescript --linked > src/types/database.types.ts` after applying the migration?
   - Recommendation: yes. Make this a checkpoint task between Wave 1 (migrations + types) and Wave 2 (downstream code that uses the types).

2. **Empty NON_CORPUS_ENGAGEMENT_PERCENTILES at first ship**
   - What we know: backfill script computes these and emits a code block; planner pastes into `bucket-derivation.ts`.
   - What's unclear: do we ship with `0,0` placeholders and run the backfill in a second commit, or do we hold the migration until percentiles are computed?
   - Recommendation: ship with placeholders (graceful "average" fallback), backfill script regenerates after embedding pass, planner commits the snapshot.

3. **`scraped_videos.primary_niche` backfill via SQL UPDATE vs separate script**
   - What we know: category column is freeform TEXT; mapping is hand-coded.
   - What's unclear: should it be a SQL UPDATE inside the Phase 8 migration (less flexible) or a one-time TS script (more controllable, easier to dry-run)?
   - Recommendation: one-time TS script `scripts/backfill-scraped-niches.ts` — runnable separately, with `--dry-run` flag to preview category coverage. Phase 8 migration just adds the column; script populates it. Audit `SELECT DISTINCT category` first.

4. **Whether to upgrade `@google/genai` to ≥1.45 in Phase 8**
   - What we know: v1.41.0 supports `embedContent` API surface per Context7; supports model parameter (server-side selection). v2.4.0 is latest.
   - What's unclear: does v1.41 actually accept the model string `"gemini-embedding-001"` without complaint? (Server-side rejection if SDK validates model whitelist.)
   - Recommendation: dev-time validation. Make Wave 0 of the plan a 5-line smoke script: `npx tsx -e 'import { GoogleGenAI } from "@google/genai"; const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); const r = await ai.models.embedContent({ model: "gemini-embedding-001", contents: ["hi"], config: { outputDimensionality: 768 } }); console.log(r.embeddings![0].values!.length);'` — if it returns 768, ship as-is. If not, upgrade SDK to 1.45 minimum in a separate task.

5. **Should `runBenchmarkRetrieval` self-emit stage events (Wave 0 pattern) or rely on `timed()` wrapper (Wave 1 pattern)?**
   - What we know: Wave 0 detectors self-emit (`niche-detector.ts:54`); Wave 1 stages are wrapped by `timed()` in pipeline.ts.
   - What's unclear: D-09 says retrieval emits `stage_start + stage_end` events — both patterns produce this.
   - Recommendation: use the Wave 1 `timed()` pattern (consistent with siblings; no extra emit code in `retrieval-stage.ts`). Update RESEARCH if user prefers otherwise.

6. **Bucket source for training_corpus rows from a niche slug NOT in {beauty/fitness/edu/comedy/lifestyle}**
   - What we know: training_corpus CHECK constraint allows only those 5. There can't be a row in another niche.
   - What's unclear: edge case — what if user-supplied input video is `niche: "tech-gadgets"`? Tier 1 query against training_corpus with `WHERE niche = 'tech-gadgets'` returns 0 rows. Fall through to scraped_videos (which CAN have tech-gadgets, post-migration).
   - Recommendation: this is the EXPECTED two-pool behavior (D-01). Tests must explicitly cover the "non-Phase-1-niche → corpus returns 0 → scraped takes over" path.

7. **What does `nyquist_validation: true` actually require beyond what the Validation Architecture section captures?**
   - What we know: `.planning/config.json` has the flag. Researcher's job: produce the Nyquist section above.
   - What's unclear: does the planner have additional Nyquist-specific instructions?
   - Recommendation: planner reads the planner's own gsd-planner instructions for Nyquist details. The research's Nyquist section is the input.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `@google/genai` (npm) | Embedding calls | ✓ | 1.41.0 (latest 2.4.0) | None — fail closed if missing |
| `@supabase/supabase-js` | DB / RPC | ✓ | 2.93.1 | None |
| `zod` | Schema validation | ✓ | 4.3.6 | None |
| `vitest` | Tests | ✓ | 4.0.18 | None |
| `pgvector` extension | DB layer | ✗ (must enable via migration) | latest server-side 0.8.x | None — must enable |
| `GEMINI_API_KEY` env | Embedding calls | ✓ (existing — used by gemini.ts) | — | None — fail closed |
| `SUPABASE_SERVICE_ROLE_KEY` env | Service client | ✓ (existing) | — | None |
| `APIFY_TOKEN` env | webhook handler | ✓ (existing) | — | Skip auto-embed on insert if missing |

**Missing dependencies with no fallback:**
- pgvector extension on Supabase (one-time enable via migration — included in Phase 8 migration)

**Missing dependencies with fallback:**
- None

---

## Security Domain

> Required since `security_enforcement` is enabled (absent in config = enabled by default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing `verifyCronAuth()` for cron-route; service-role key in env (not exposed) |
| V3 Session Management | no | Phase 8 has no user-session surface; service-role only |
| V4 Access Control | yes | training_corpus + scraped_videos system-wide tables; RLS bypassed via service role; this is INTENTIONAL per CONTEXT.md (D-01 rationale) |
| V5 Input Validation | yes | Zod on `RetrievalEvidenceItem` + `BenchmarkRetrievalResult`; Gemini response validated; RPC parameters all typed at the rpc-client wrapper |
| V6 Cryptography | no | No new crypto |
| V8 Data Protection | yes | No PII added to retrieval evidence (creator handles are PUBLIC TikTok handles; same as existing scraped_videos.author exposure) |

### Known Threat Patterns for {Next.js + Supabase + pgvector}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via RPC params | Tampering | parameterized RPC call (supabase.rpc(name, {…})) — Postgres binds args, never string-interps |
| Embedding poisoning (malicious caption) | Spoofing | subject formula treats caption as opaque data; no template injection at the SDK call site |
| Vector exfiltration via crafted queries | Information disclosure | service-role calls only; RLS bypassed by design (system-wide tables); no user-controllable filter values escape sanitization |
| Cost-budget DoS via embed flooding | Denial of service | predict-time embed is 1-per-prediction; rate-limited by existing /api/analyze auth; backfill is offline CLI (no public surface) |
| `retrieval_evidence` JSONB injection | Tampering | written ONLY by service role; no user write path to analysis_results.retrieval_evidence |
| Stale embedding signal | Tampering / integrity | subject formula locked in code; re-embed flag in CLI gates a full pool refresh |

**No new attack surface introduced by Phase 8 beyond existing scraped_videos exposure.** training_corpus rows are public TikTok content (same privacy class as scraped_videos already exposes via `/api/trending`).

---

## Sources

### Primary (HIGH confidence)
- **Context7 `/pgvector/pgvector`** — HNSW index creation, default parameters (m=16, ef_construction=64), distance operators, iterative_scan, 0.8.x features
- **Context7 `/googleapis/js-genai`** — `embedContent` method signature, response shape (embeddings[].values), batch via contents array
- **Supabase docs** — [Vector Columns](https://supabase.com/docs/guides/ai/vector-columns), [Semantic Search](https://supabase.com/docs/guides/ai/semantic-search), [HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes), [pgvector extension](https://supabase.com/docs/guides/database/extensions/pgvector)
- **Google Developers Blog** — [Gemini Embedding GA announcement](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) — deprecation timeline, MRL, dimensions
- **Codebase verification** — `pnpm-lock.yaml` (genai version), `src/types/database.types.ts` (column inventory), all 30+ files read in research

### Secondary (MEDIUM confidence)
- [TokenMix gemini-embedding-001 guide 2026](https://tokenmix.ai/blog/gemini-embedding-001-dimensions-pricing-guide-2026) — pricing, 768 dim quality tradeoff verified
- [AI Free API rate limits](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits) — free tier TPM (10M); RPM not officially published
- [pgvector blog — DBA part 2](https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/) — recent 2026 HNSW guidance

### Tertiary (LOW confidence — flagged for validation)
- Free-tier embedding RPM (no official number; community sources vary) — A4 assumption
- @google/genai v1.41 actually accepting `gemini-embedding-001` model string at runtime — A1 assumption (recommend dev-time smoke test)

---

## Metadata

**Confidence breakdown:**
- pgvector + Supabase integration: **HIGH** — multi-source verified (official docs + Context7 + repo style examples)
- Gemini embedding choice: **HIGH** on model + dimensions + API; **MEDIUM** on free-tier RPM specifics (not load-bearing)
- Hierarchical relaxation pattern: **HIGH** — derived from CONTEXT.md D-04 + standard tier patterns
- Bucket derivation: **HIGH** — direct read of existing thresholds + D-03a
- Aggregator extension: **HIGH** — codebase pattern is explicit (Phase 4 added 2 keys; Phase 8 adds 1 weight-bearing key)
- Schema gap risk (Finding 3): **HIGH** — verified by reading database.types.ts directly
- Phase 12 budget impact: **HIGH** — math is deterministic; <1¢ added per prediction

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days for stable areas; Gemini model deprecation watch — re-verify before any future Phase 8-adjacent work)

**Two critical user-facing items that need escalation to discuss-phase:**
1. **D-05 model is dead.** `text-embedding-004` shut down 2026-01-14. Plan must use `gemini-embedding-001 + outputDimensionality: 768`. Functionally equivalent; preserves D-05 intent (Gemini, 768d, no new dep).
2. **`scraped_videos` schema gap.** Three filter columns (`primary_niche`, `follower_tier`, `posted_at`) + `creator_handle` are missing. Plan must include their addition + a category→niche-slug backfill mapping. Strategy A documented.

These two items are NOT ambiguities — they are concrete delta-from-locked-decisions that the planner needs to surface in the plan SUMMARY and that the user may want to ratify before execution.
