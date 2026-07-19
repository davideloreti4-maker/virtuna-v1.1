-- =========================================================================
-- Grounding tools §7 step 3 — expose the visual facets to retrieval
-- (docs/subsystems/grounding-tools.md)
--
-- The tool-loop spike (scripts/spike-tool-loop.ts, 2026-07-19) proved the
-- model is only as honest as the interface is expressive: asked for
-- greenscreen examples it answered "the corpus has no greenscreen tag" —
-- but 77 rows carry it under editing_style. The columns exist and are clean
-- (visual_hook: 6 values / 98.5%, editing_style: 30 values / 98.5%); the
-- RPCs simply never selected or filtered them.
--
-- Both match RPCs are recreated to:
--   1. RETURN visual_hook + editing_style (after `format`).
--   2. Accept three new optional facet gates: filter_format, filter_visual,
--      filter_editing (NULL = no constraint, same pattern as the existing five).
--
-- Adding params/OUT columns changes the function signature → DROP + CREATE
-- (CREATE OR REPLACE would create an OVERLOAD next to the old function).
-- VOLATILE + hnsw strict_order + the db-hygiene §5 search_path pin are
-- re-applied verbatim (DROP loses them).
--
-- NOTE on naming: visual_hook holds the visual SETTING (Sandcastles'
-- visual_layout_category — in_world_vlog / studio_set / greenscreen / …),
-- not a first-frame device. The tool layer exposes it as `visualSetting`;
-- the column name stays for compatibility. See grounding-tools.md §3.
--
-- Idempotent (DROP IF EXISTS + CREATE) — safe to re-run.
-- =========================================================================

-- =====================================================
-- 1. RPC: match_shared_teardowns
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
  filter_source_pool text,
  filter_format      text,
  filter_visual      text,
  filter_editing     text
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
  visual_hook        text,
  editing_style      text,
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
    t.visual_hook,
    t.editing_style,
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
    AND (filter_format      IS NULL OR t.format         = filter_format)
    AND (filter_visual      IS NULL OR t.visual_hook    = filter_visual)
    AND (filter_editing     IS NULL OR t.editing_style  = filter_editing)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- 2. RPC: match_personal_teardowns (same additions, kept in lockstep)
-- =====================================================
DROP FUNCTION IF EXISTS match_personal_teardowns(
  extensions.vector, uuid, int, text, text, text);

CREATE FUNCTION match_personal_teardowns(
  query_embedding   extensions.vector(768),
  match_user_id     uuid,
  match_count       int,
  filter_niche      text,
  filter_platform   text,
  filter_archetype  text,
  filter_format     text,
  filter_visual     text,
  filter_editing    text
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
  visual_hook        text,
  editing_style      text,
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
    p.visual_hook,
    p.editing_style,
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
    AND (filter_format    IS NULL OR p.format         = filter_format)
    AND (filter_visual    IS NULL OR p.visual_hook    = filter_visual)
    AND (filter_editing   IS NULL OR p.editing_style  = filter_editing)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
