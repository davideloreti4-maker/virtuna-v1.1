-- =========================================================================
-- Grounded Generation — teardown cache read-back (gather-once / walk-many)
--
-- Rides with the embeddings producer (DashScope text-embedding-v3, 768d):
--
-- 1. hook_template becomes a FIRST-CLASS column on both teardown tables.
--    Today it lives only inside the `teardown` raw JSONB — read-back maps a
--    match row straight onto RetrievedExample, whose proof block needs the
--    [bracketed] fill-in-the-blank line. Backfilled from the JSONB.
--
-- 2. caption + hashtags are STORED at write. The §13 topical-embedding formula
--    is caption + hashtags + on-screen-text + spoken_hook + idea.angle — but the
--    extractor's raw JSONB never echoes its input, so without these columns a row
--    could not be (re-)embedded from itself (backfill + future re-embed jobs).
--
-- 3. Both match RPCs are recreated to also return hook_template (the receipt
--    line) and proof_captured_at (cheap freshness policy: read-back counts a
--    cached row as "good" only within a staleness window, TS-side). Adding OUT
--    columns changes the function signature's return type → DROP + CREATE
--    (CREATE OR REPLACE cannot change RETURNS TABLE).
--
-- Idempotent (IF NOT EXISTS / DROP IF EXISTS + CREATE) — safe to re-run.
-- =========================================================================

-- =====================================================
-- 1. New columns (both tables — documented column-shape convention)
-- =====================================================
ALTER TABLE public.outlier_teardowns
  ADD COLUMN IF NOT EXISTS hook_template text,
  ADD COLUMN IF NOT EXISTS caption       text,
  ADD COLUMN IF NOT EXISTS hashtags      text[];

ALTER TABLE public.personal_teardowns
  ADD COLUMN IF NOT EXISTS hook_template text,
  ADD COLUMN IF NOT EXISTS caption       text,
  ADD COLUMN IF NOT EXISTS hashtags      text[];

COMMENT ON COLUMN public.outlier_teardowns.hook_template IS
  'The spoken hook generalized into a reusable fill-in-the-blank with [bracketed variables] (§11b) — hoisted from the teardown JSONB so read-back can map straight onto the card receipt.';
COMMENT ON COLUMN public.outlier_teardowns.caption IS
  'Source-video caption, stored so the row is self-contained for the §13 topical-embedding formula (caption + hashtags + on-screen-text + spoken_hook + idea.angle) at backfill/re-embed time.';
COMMENT ON COLUMN public.outlier_teardowns.hashtags IS
  'Source-video hashtags (bare, no #) — same self-contained embedding rationale as caption.';

-- ── backfill hook_template from the raw JSONB (rows written before this migration) ──
UPDATE public.outlier_teardowns
   SET hook_template = NULLIF(btrim(teardown->>'hookTemplate'), '')
 WHERE hook_template IS NULL
   AND teardown ? 'hookTemplate';

UPDATE public.personal_teardowns
   SET hook_template = NULLIF(btrim(teardown->>'hookTemplate'), '')
 WHERE hook_template IS NULL
   AND teardown ? 'hookTemplate';

-- =====================================================
-- 2. RPC: match_shared_teardowns (recreate — adds hook_template + proof_captured_at)
-- =====================================================
DROP FUNCTION IF EXISTS match_shared_teardowns(
  extensions.vector, int, text, text, text, text, text);

CREATE FUNCTION match_shared_teardowns(
  query_embedding    extensions.vector(768),
  match_count        int,
  filter_niche       text,
  exclude_niche      text,
  filter_platform    text,
  filter_archetype   text,
  filter_source_pool text
)
RETURNS TABLE (
  id                 uuid,
  similarity         float,
  platform           text,
  platform_video_id  text,
  video_url          text,
  cover_url          text,
  creator_handle     text,
  source_pool        text,
  trust_weight       numeric,
  views              bigint,
  follower_count     bigint,
  outlier_multiplier numeric,
  baseline_label     text,
  engagement_rate    numeric,
  posted_at          timestamptz,
  proof_captured_at  timestamptz,
  niche              text,
  hook_archetype     text,
  format             text,
  spoken_hook        text,
  hook_template      text,
  hook_source        text,
  idea               jsonb,
  template           jsonb,
  why_it_works       text
)
LANGUAGE plpgsql
VOLATILE  -- set_config is VOLATILE (matches match_corpus_videos WR-01)
SET search_path = public, extensions, pg_temp  -- re-apply the db-hygiene §5 pin (DROP loses it)
AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan','strict_order', true);

  RETURN QUERY
  SELECT
    t.id,
    (1 - (t.embedding <=> query_embedding))::float AS similarity,
    t.platform,
    t.platform_video_id,
    t.video_url,
    t.cover_url,
    t.creator_handle,
    t.source_pool,
    t.trust_weight,
    t.views,
    t.follower_count,
    t.outlier_multiplier,
    t.baseline_label,
    t.engagement_rate,
    t.posted_at,
    t.proof_captured_at,
    t.niche,
    t.hook_archetype,
    t.format,
    t.spoken_hook,
    t.hook_template,
    t.hook_source,
    t.idea,
    t.template,
    t.why_it_works
  FROM public.outlier_teardowns t
  WHERE t.embedding IS NOT NULL
    AND t.status IN ('extracted','watched')
    AND (filter_niche       IS NULL OR t.niche          = filter_niche)
    AND (exclude_niche      IS NULL OR t.niche IS DISTINCT FROM exclude_niche)
    AND (filter_platform    IS NULL OR t.platform       = filter_platform)
    AND (filter_archetype   IS NULL OR t.hook_archetype = filter_archetype)
    AND (filter_source_pool IS NULL OR t.source_pool    = filter_source_pool)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 3. RPC: match_personal_teardowns (recreate — same additions)
-- =====================================================
DROP FUNCTION IF EXISTS match_personal_teardowns(
  extensions.vector, uuid, int, text, text, text);

CREATE FUNCTION match_personal_teardowns(
  query_embedding   extensions.vector(768),
  match_user_id     uuid,
  match_count       int,
  filter_niche      text,
  filter_platform   text,
  filter_archetype  text
)
RETURNS TABLE (
  id                 uuid,
  similarity         float,
  platform           text,
  platform_video_id  text,
  video_url          text,
  cover_url          text,
  creator_handle     text,
  views              bigint,
  follower_count     bigint,
  outlier_multiplier numeric,
  baseline_label     text,
  engagement_rate    numeric,
  posted_at          timestamptz,
  proof_captured_at  timestamptz,
  niche              text,
  hook_archetype     text,
  format             text,
  spoken_hook        text,
  hook_template      text,
  hook_source        text,
  idea               jsonb,
  template           jsonb,
  why_it_works       text,
  predicted_band     text,
  actual_outcome     jsonb
)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions, pg_temp  -- re-apply the db-hygiene §5 pin (DROP loses it)
AS $$
BEGIN
  PERFORM set_config('hnsw.iterative_scan','strict_order', true);

  RETURN QUERY
  SELECT
    p.id,
    (1 - (p.embedding <=> query_embedding))::float AS similarity,
    p.platform,
    p.platform_video_id,
    p.video_url,
    p.cover_url,
    p.creator_handle,
    p.views,
    p.follower_count,
    p.outlier_multiplier,
    p.baseline_label,
    p.engagement_rate,
    p.posted_at,
    p.proof_captured_at,
    p.niche,
    p.hook_archetype,
    p.format,
    p.spoken_hook,
    p.hook_template,
    p.hook_source,
    p.idea,
    p.template,
    p.why_it_works,
    p.predicted_band,
    p.actual_outcome
  FROM public.personal_teardowns p
  WHERE p.user_id = match_user_id
    AND p.embedding IS NOT NULL
    AND p.status IN ('extracted','watched')
    AND (filter_niche     IS NULL OR p.niche          = filter_niche)
    AND (filter_platform  IS NULL OR p.platform       = filter_platform)
    AND (filter_archetype IS NULL OR p.hook_archetype = filter_archetype)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
