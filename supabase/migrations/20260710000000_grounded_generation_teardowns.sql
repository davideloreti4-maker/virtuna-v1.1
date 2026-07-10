-- =========================================================================
-- Grounded Generation §13 — the teardown corpus (LOCKED 2026-07-09)
--
-- The NET-NEW asset behind grounded generation: a durable, reusable teardown of
-- an outlier video (archetype + [slot] template + why-it-works + frozen proof
-- receipt). NONE of the shipped tables store a teardown — training_corpus /
-- engine_training_videos feed the SCORING engine (text-proxy, distrusted for
-- generation); scraped_videos / competitor_videos / account_posts hold raw rows.
--
-- Two tables unified by lifecycle, mirroring the shipped two-pool pattern:
--   outlier_teardowns   — SHARED (cross-user, service-role, no user_id, like
--                         training_corpus). Global dedup UNIQUE(platform,
--                         platform_video_id) = extract-once / cache-forever /
--                         every user benefits. source_pool ∈ the degradation
--                         ladder rungs (curated|competitor|scraped|expanded).
--   personal_teardowns  — PRIVATE (user_id NOT NULL, own-rows RLS, mirrors
--                         account_posts). Rung −1: the creator's own library,
--                         with owner-gated attribution + calibration columns.
--
-- Retrieval = two RPCs (match_shared_teardowns + match_personal_teardowns)
-- mirroring match_corpus_videos / match_scraped_videos — unioned + weighted in TS.
--
-- Design decisions baked in (§13):
--   [A] ONE topical embedding vector(768) (reuse the shipped 768/HNSW-cosine infra;
--       producer = DashScope text-embedding when vectors land — Qwen-only, NOT gemini) +
--       TYPED FACET COLUMNS. Structural embedding DEFERRED — Rung-2 structural
--       retrieval is a facet WHERE (archetype=X ∩ niche≠user), not a vector op.
--   Soft controlled vocab: facets/niche are free TEXT validated app-side against
--       a versioned TS enum (single SSOT) — NO DB CHECK. training_corpus's rigid
--       niche CHECK is what forced the edu↔education alias hack; the brief wants
--       vocab to GROW. (Engineering enums that are genuinely closed — source_pool,
--       hook_source, status — keep a CHECK; content taxonomy stays free.)
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE) — safe to re-run.
-- =========================================================================

-- update_updated_at_column() already exists (training_corpus migration, CREATE OR
-- REPLACE) — reused by both triggers below.

-- =====================================================
-- 1. outlier_teardowns — SHARED (the map; cross-user cache)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.outlier_teardowns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── identity / global dedup (extract once / cache forever) ──
  platform           text NOT NULL DEFAULT 'tiktok',
  platform_video_id  text NOT NULL,
  video_url          text,
  cover_url          text,                              -- ephemeral CDN image, display-only
  creator_handle     text,

  -- ── source (which ladder rung produced this row) ──
  source_pool        text NOT NULL
                       CHECK (source_pool IN ('curated','competitor','scraped','expanded')),
  source_id          uuid,                              -- soft ref (spans 3 raw tables) — NOT an FK
  trust_weight       numeric NOT NULL DEFAULT 1.0,      -- curated > competitor > scraped

  -- ── frozen proof snapshot (the stable receipt) ──
  views              bigint,
  follower_count     bigint,                            -- for views÷followers (finding #2 durable metric)
  outlier_multiplier numeric,                           -- the "{n}×" badge (measured, NEVER a SIM score)
  baseline_label     text,                              -- honest baseline: 'vs own'|'vs niche'|'vs followers'|'vs account'
                                                        -- free TEXT (no CHECK) — the metric basis is still evolving (finding #2)
  engagement_rate    numeric,                           -- (likes+comments+shares)/views
  posted_at          timestamptz,
  proof_captured_at  timestamptz,                       -- when the multiplier snapshot was frozen
  refreshed_at       timestamptz,                       -- last re-pull of the live metrics

  -- ── typed facets (power Rung-2 structural retrieval as indexed WHEREs) ──
  --     soft vocab: free TEXT, validated app-side vs the versioned TS enum (no DB CHECK)
  niche              text,
  subniche           text,
  hook_archetype     text,
  format             text,
  visual_hook        text,
  editing_style      text,
  signature_series   text,

  -- ── extracted teardown (hoist hot fields, JSON the rest for forward-compat) ──
  spoken_hook        text,
  hook_source        text
                       CHECK (hook_source IS NULL OR hook_source IN ('native_transcript','caption_fallback','omni')),
  idea               jsonb,                             -- {seed, angle, belief, reality, evidence}
  template           jsonb,                             -- {name, slots:[{key,label,example}], skeleton:[beats], guidance}
  why_it_works       text,
  teardown           jsonb,                             -- full teardown (forward-compatible superset)

  -- ── retrieval / meta ──
  embedding          extensions.vector(768),            -- topical (caption+hashtags+on-screen-text+spoken_hook+idea.angle)
  extraction_tier    text,                              -- §9 cost ladder rung (metadata|caption|transcript|watch|omni)
  extraction_version text,                              -- prompt/schema version (e.g. 'v1')
  model              text,                              -- e.g. 'qwen3.7-plus'
  status             text NOT NULL DEFAULT 'metadata'
                       CHECK (status IN ('metadata','extracted','watched','failed')),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- global dedup: one teardown per video, shared across every user + ladder rung
  UNIQUE (platform, platform_video_id)
);

COMMENT ON TABLE public.outlier_teardowns IS
  'SHARED cross-user teardown cache (§13). One row per outlier video, global dedup UNIQUE(platform, platform_video_id) = extract-once/cache-forever. source_pool = degradation-ladder rung. Service-role only (no user_id, RLS-enabled/no-policy like training_corpus).';
COMMENT ON COLUMN public.outlier_teardowns.source_id IS
  'Soft ref to the originating raw row (scraped_videos | competitor_videos | account_posts). Plain uuid, NOT an FK — the source spans three tables.';
COMMENT ON COLUMN public.outlier_teardowns.outlier_multiplier IS
  'Measured views÷baseline "{n}×" receipt value (NEVER a SIM score). baseline_label states the honest basis.';
COMMENT ON COLUMN public.outlier_teardowns.baseline_label IS
  'Honest basis for outlier_multiplier. Free TEXT (no CHECK) — the durable receipt is moving to a per-account basis (finding #2): views÷followers / views÷account-median.';

-- ── indexes ──
CREATE INDEX IF NOT EXISTS outlier_teardowns_embedding_hnsw
  ON public.outlier_teardowns
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- facet WHEREs (Rung-2 structural retrieval) — partial btrees, planner-combined with the vector predicate
CREATE INDEX IF NOT EXISTS idx_outlier_teardowns_niche
  ON public.outlier_teardowns (niche) WHERE niche IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outlier_teardowns_archetype
  ON public.outlier_teardowns (hook_archetype) WHERE hook_archetype IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outlier_teardowns_pool_status
  ON public.outlier_teardowns (source_pool, status);
CREATE INDEX IF NOT EXISTS idx_outlier_teardowns_creator
  ON public.outlier_teardowns (creator_handle);

-- ── RLS: system-wide, service-role only (no policies → all non-service access denied) ──
ALTER TABLE public.outlier_teardowns ENABLE ROW LEVEL SECURITY;

-- ── trigger ──
DROP TRIGGER IF EXISTS outlier_teardowns_updated_at ON public.outlier_teardowns;
CREATE TRIGGER outlier_teardowns_updated_at
  BEFORE UPDATE ON public.outlier_teardowns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. personal_teardowns — PRIVATE (Rung −1; the creator's own library)
-- =====================================================
-- Same content/facet columns as outlier_teardowns; NO source_pool (always own).
-- Adds owner-gated attribution (§11e: explicit link > implicit match) + calibration.
CREATE TABLE IF NOT EXISTS public.personal_teardowns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ── identity / per-user dedup ──
  platform           text NOT NULL DEFAULT 'tiktok',
  platform_video_id  text NOT NULL,
  video_url          text,
  cover_url          text,
  creator_handle     text,

  -- ── owner-gated attribution (soft refs — plain uuid, FK deferred like account_posts.pillar_id) ──
  source_account_id  uuid,                              -- which connected account this post belongs to
  planned_post_id    uuid,                              -- the plan that produced it (if any)
  outcome_id         uuid,                              -- the reconciled outcome (if any)

  -- ── frozen proof snapshot ──
  views              bigint,
  follower_count     bigint,
  outlier_multiplier numeric,
  baseline_label     text,
  engagement_rate    numeric,
  posted_at          timestamptz,
  proof_captured_at  timestamptz,
  refreshed_at       timestamptz,

  -- ── typed facets (soft vocab, no CHECK) ──
  niche              text,
  subniche           text,
  hook_archetype     text,
  format             text,
  visual_hook        text,
  editing_style      text,
  signature_series   text,

  -- ── extracted teardown ──
  spoken_hook        text,
  hook_source        text
                       CHECK (hook_source IS NULL OR hook_source IN ('native_transcript','caption_fallback','omni')),
  idea               jsonb,
  template           jsonb,
  why_it_works       text,
  teardown           jsonb,

  -- ── calibration (own-outcome loop, §11e) ──
  predicted_band     text,                              -- what the SIM predicted (soft vocab)
  actual_outcome     jsonb,                             -- reconciled reality (forward-compatible)

  -- ── retrieval / meta ──
  embedding          extensions.vector(768),
  extraction_tier    text,
  extraction_version text,
  model              text,
  status             text NOT NULL DEFAULT 'metadata'
                       CHECK (status IN ('metadata','extracted','watched','failed')),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- one row per (user × platform × video)
  UNIQUE (user_id, platform, platform_video_id)
);

COMMENT ON TABLE public.personal_teardowns IS
  'PRIVATE per-user teardown library (§13, Rung −1). Own-rows RLS (mirrors account_posts). Same shape as outlier_teardowns minus source_pool, plus owner-gated attribution (source_account_id/planned_post_id/outcome_id) + calibration (predicted_band/actual_outcome). Recency-weighted at query on posted_at.';
COMMENT ON COLUMN public.personal_teardowns.source_account_id IS
  'Which connected account this post belongs to. Plain uuid soft ref (FK deferred, mirrors account_posts.pillar_id).';

-- ── indexes ──
CREATE INDEX IF NOT EXISTS personal_teardowns_embedding_hnsw
  ON public.personal_teardowns
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- the retrieval RPC reads a user's rows, recency-weighted
CREATE INDEX IF NOT EXISTS personal_teardowns_user_posted_idx
  ON public.personal_teardowns (user_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_personal_teardowns_user_niche
  ON public.personal_teardowns (user_id, niche) WHERE niche IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personal_teardowns_user_archetype
  ON public.personal_teardowns (user_id, hook_archetype) WHERE hook_archetype IS NOT NULL;

-- ── RLS: own rows only (mirrors account_posts) ──
ALTER TABLE public.personal_teardowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_teardowns_all_own ON public.personal_teardowns;
CREATE POLICY personal_teardowns_all_own ON public.personal_teardowns
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── trigger ──
DROP TRIGGER IF EXISTS personal_teardowns_updated_at ON public.personal_teardowns;
CREATE TRIGGER personal_teardowns_updated_at
  BEFORE UPDATE ON public.personal_teardowns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. RPC: match_shared_teardowns
-- =====================================================
-- Mirrors match_corpus_videos: VOLATILE (set_config is VOLATILE), HNSW iterative
-- scan for selective filters, cosine order-by. Facet filters are nullable = drop
-- the filter when NULL. exclude_niche powers Rung-2 (archetype match ∩ niche≠user).
CREATE OR REPLACE FUNCTION match_shared_teardowns(
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
  niche              text,
  hook_archetype     text,
  format             text,
  spoken_hook        text,
  hook_source        text,
  idea               jsonb,
  template           jsonb,
  why_it_works       text
)
LANGUAGE plpgsql
VOLATILE  -- set_config is VOLATILE (matches match_corpus_videos WR-01)
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
    t.niche,
    t.hook_archetype,
    t.format,
    t.spoken_hook,
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
-- 4. RPC: match_personal_teardowns
-- =====================================================
-- The private pool. user_id is REQUIRED (never dropped) — the row-owner scope.
-- Called with the service client (RLS bypassed) so the user_id predicate is the
-- guard; app code passes the authenticated user's id.
CREATE OR REPLACE FUNCTION match_personal_teardowns(
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
  niche              text,
  hook_archetype     text,
  format             text,
  spoken_hook        text,
  hook_source        text,
  idea               jsonb,
  template           jsonb,
  why_it_works       text,
  predicted_band     text,
  actual_outcome     jsonb
)
LANGUAGE plpgsql
VOLATILE
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
    p.niche,
    p.hook_archetype,
    p.format,
    p.spoken_hook,
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
