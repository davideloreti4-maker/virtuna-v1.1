-- Phase 8: Benchmark Retrieval — pgvector + embeddings + analysis_results columns + RPC functions.
-- Per CONTEXT D-01 (two-pool), D-07 (HNSW + cosine), D-11 (analysis_results.retrieval_evidence/retrieval_score),
-- RESEARCH Finding 3 (scraped_videos schema gap: 4 columns added).
-- All statements use IF NOT EXISTS / CREATE OR REPLACE for idempotent re-runs.
--
-- AUDIT (2026-05-18): AUDIT SKIPPED — Supabase CLI not linked; using default CATEGORY_TO_NICHE_SLUG mapping per RESEARCH Finding 3 Strategy A.
-- (Phase 3 STATE.md line 148-149 confirms CLI is unlinked in this worktree. Live DB query
--  was not executable from this environment; default mapping covers the 10 NICHE_TREE
--  primary slugs. Unmapped categories stay NULL → excluded from retrieval pool — see D-04.)

-- =====================================================
-- 1. Enable pgvector
-- =====================================================
-- Standard Supabase pattern — extension lives in the `extensions` schema.
-- Column types use fully-qualified `extensions.vector(768)` (immune to search_path).
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =====================================================
-- 2. training_corpus — embedding column
-- =====================================================
-- D-05: gemini-embedding-001 (UPDATED from text-embedding-004 per RESEARCH Finding 1; same 768d).
-- D-07: HNSW + cosine; column dimension matches outputDimensionality=768.
ALTER TABLE training_corpus
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);

-- =====================================================
-- 3. training_corpus — HNSW index (cosine)
-- =====================================================
-- pgvector defaults: m=16, ef_construction=64. Made explicit so a Phase 10 retune is a code
-- review, not git archaeology. WITH clause is required to ensure deterministic build params
-- across environments.
CREATE INDEX IF NOT EXISTS training_corpus_embedding_hnsw
  ON training_corpus
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================
-- 4. scraped_videos — embedding + schema-gap columns (RESEARCH Finding 3)
-- =====================================================
-- Single multi-column ALTER TABLE (matches creator_profile_9card_columns.sql idiom).
-- All columns nullable for graceful degradation; D-04 filter logic treats NULL as
-- "exclude from retrieval pool" (see WHERE clauses in match_scraped_videos below).
ALTER TABLE scraped_videos
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(768),
  ADD COLUMN IF NOT EXISTS primary_niche TEXT,
  ADD COLUMN IF NOT EXISTS follower_tier TEXT
    CHECK (follower_tier IS NULL OR follower_tier IN ('nano','micro','mid','large','mega')),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creator_handle TEXT;

-- =====================================================
-- 5. One-time backfills on scraped_videos
-- =====================================================

-- 5a. Backfill creator_handle from existing author column (preserves D-06 subject text consistency).
-- Idempotent: WHERE creator_handle IS NULL guard prevents overwriting any pre-existing values.
UPDATE scraped_videos SET creator_handle = author WHERE creator_handle IS NULL AND author IS NOT NULL;

-- 5b. Backfill primary_niche from category using the default CATEGORY_TO_NICHE_SLUG mapping
-- (RESEARCH Finding 3 Strategy A). Unmapped categories stay NULL → excluded from retrieval pool.
-- Each UPDATE is idempotent: WHERE primary_niche IS NULL guards against re-runs and prevents
-- overwriting values set by future targeted backfills.
--
-- WR-02 — UPGRADE PROCEDURE (read before adding a new category→niche mapping):
--   1. Add a new UPDATE statement below mirroring the pattern (one row per primary slug).
--   2. If the new mapping should OVERRIDE existing primary_niche values (e.g.,
--      reclassifying "wellness" rows from lifestyle → fitness), the IS NULL guard
--      below will prevent the new UPDATE from taking effect on already-classified rows.
--      In that case, run a one-time targeted reset BEFORE re-applying the migration:
--        UPDATE scraped_videos SET primary_niche = NULL
--          WHERE primary_niche = 'lifestyle' AND category IN ('wellness');
--      Then re-run the migration so the new UPDATE clause picks up the now-NULL rows.
--   3. Mirror the same mapping change in src/app/api/webhooks/apify/route.ts
--      deriveNicheSlug() — these two paths are the SAME 10-slug whitelist and MUST
--      stay in sync, otherwise webhook-inserted rows will disagree with backfilled
--      rows. See REVIEW.md WR-02 for the full rationale.
UPDATE scraped_videos SET primary_niche = 'beauty'
  WHERE primary_niche IS NULL AND category IN ('beauty','makeup','skincare');
UPDATE scraped_videos SET primary_niche = 'fitness'
  WHERE primary_niche IS NULL AND category IN ('fitness','gym','workout');
UPDATE scraped_videos SET primary_niche = 'education'
  WHERE primary_niche IS NULL AND category IN ('education','learning','edu');
UPDATE scraped_videos SET primary_niche = 'comedy'
  WHERE primary_niche IS NULL AND category IN ('comedy','funny','humor');
UPDATE scraped_videos SET primary_niche = 'lifestyle'
  WHERE primary_niche IS NULL AND category IN ('lifestyle','vlog','daily');
UPDATE scraped_videos SET primary_niche = 'tech-gadgets'
  WHERE primary_niche IS NULL AND category IN ('tech','technology','gadgets');
UPDATE scraped_videos SET primary_niche = 'gaming'
  WHERE primary_niche IS NULL AND category IN ('gaming','game','esports');
UPDATE scraped_videos SET primary_niche = 'fashion-style'
  WHERE primary_niche IS NULL AND category IN ('fashion','style','outfit');
UPDATE scraped_videos SET primary_niche = 'music-performance'
  WHERE primary_niche IS NULL AND category IN ('music','song','dance');
UPDATE scraped_videos SET primary_niche = 'food-cooking'
  WHERE primary_niche IS NULL AND category IN ('food','cooking','recipe','eat');

-- =====================================================
-- 6. scraped_videos — HNSW index + btree on primary_niche
-- =====================================================
-- HNSW index uses same defaults as training_corpus (m=16, ef_construction=64).
CREATE INDEX IF NOT EXISTS scraped_videos_embedding_hnsw
  ON scraped_videos
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Partial btree index on the new niche column — Postgres planner combines this with the
-- HNSW vector predicate when the WHERE clause is selective on primary_niche.
CREATE INDEX IF NOT EXISTS idx_scraped_videos_primary_niche
  ON scraped_videos(primary_niche) WHERE primary_niche IS NOT NULL;

-- =====================================================
-- 7. analysis_results — retrieval_evidence + retrieval_score columns (D-11)
-- =====================================================
-- retrieval_evidence JSONB DEFAULT '[]' — legacy rows (Phase 1-7) read as empty array, not NULL.
-- retrieval_score NUMERIC(5,4) — nullable per D-03/D-04b semantics (null when min_corpus_size
-- gate trips or no matches survive hierarchical relaxation).
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS retrieval_evidence JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS retrieval_score NUMERIC(5,4);

-- =====================================================
-- 8. RPC: match_corpus_videos
-- =====================================================
-- NOTE (corpus niche slug mismatch — RESEARCH lines 1026-1028):
--   training_corpus.niche only accepts {beauty, fitness, edu, comedy, lifestyle} per the
--   CHECK constraint in 20260512000000_training_corpus.sql. NICHE_TREE uses 'education'
--   (full word). This function expects `filter_niche` to be the corpus-form ('edu' not
--   'education'); Plan 03's bucket-derivation.ts handles the alias (CORPUS_NICHE_ALIASES).
--   The migration intentionally does NOT change the constraint — the alias lives in TS.
--
-- nullable platform/tier filters per RESEARCH Option A (lines 829-841): filter_niche is the
-- ONE filter never relaxed in D-04 (always required, since it gates the entire candidate
-- space); filter_platform + filter_follower_tier accept NULL to drop the filter at Tier 2/3.
CREATE OR REPLACE FUNCTION match_corpus_videos(
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
-- WR-01: marked VOLATILE (not STABLE) because set_config is itself VOLATILE.
-- Marking the wrapper STABLE was technically allowed by Postgres but defeated
-- the planner's caching contract and was inconsistent with the body. VOLATILE
-- is the honest contract: the function reads-and-writes a session GUC.
--
-- Long-term: prefer ALTER ROLE service_role SET hnsw.iterative_scan='strict_order'
-- so the GUC is set once per role rather than per RPC; that change is held until
-- Phase 10+ infra hardening because it requires a separate Supabase migration
-- against the live role.
VOLATILE
AS $$
BEGIN
  -- Defensive setting: HNSW iterative scan for small selective filters (RESEARCH line 381).
  -- Required for pgvector 0.8.0+ to iterate further into the graph when filtered candidate
  -- counts are below match_count. Set as LOCAL so it doesn't leak to outer transactions.
  -- Caveat: when this function is called from inside an outer explicit transaction,
  -- LOCAL is the txn lifetime — the setting WILL persist for the rest of that outer
  -- txn (Postgres SET LOCAL semantics). The earlier comment "doesn't leak to outer
  -- transactions" was misleading. In practice the RPC is invoked as a single
  -- statement from the application layer, so the outer-txn case does not arise.
  PERFORM set_config('hnsw.iterative_scan','strict_order', true);

  RETURN QUERY
  SELECT
    tc.id AS source_id,
    (1 - (tc.embedding <=> query_embedding))::float AS similarity,
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
    tc.bucket AS bucket_label,
    tc.niche,
    tc.follower_count
  FROM training_corpus tc
  WHERE tc.embedding IS NOT NULL
    AND tc.niche = filter_niche
    AND (filter_platform IS NULL OR tc.platform = filter_platform)
    AND (filter_follower_tier IS NULL OR tc.follower_tier = filter_follower_tier)
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 9. RPC: match_scraped_videos
-- =====================================================
-- Parallel function for the scraped_videos pool. Differences from match_corpus_videos:
--   - source_pool tagged 'scraped_videos'
--   - sv.description aliased AS caption (training_corpus uses `caption` directly; scraped_videos uses `description`)
--   - saves, bucket_label, follower_count always NULL (scraped_videos has no `saves` / `bucket` / `follower_count` columns)
--   - Filters on sv.primary_niche (new column added in §4); archived_at IS NULL guard preserves D-04 soft-delete pattern
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
-- WR-01: VOLATILE (see comment on match_corpus_videos above).
VOLATILE
AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan','strict_order', true);

  RETURN QUERY
  SELECT
    sv.id AS source_id,
    (1 - (sv.embedding <=> query_embedding))::float AS similarity,
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
    AND (filter_platform IS NULL OR sv.platform = filter_platform)
    AND (filter_follower_tier IS NULL OR sv.follower_tier = filter_follower_tier)
  ORDER BY sv.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
