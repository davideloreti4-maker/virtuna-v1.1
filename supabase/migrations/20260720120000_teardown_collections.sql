-- =========================================================================
-- Sandcastles collection taxonomy → queryable (docs/subsystems/grounding-tools.md)
--
-- WHY THIS EXISTS
--
-- Every one of the 524 curated teardowns carries `teardown.__collections`: the
-- Sandcastles library's own two-level taxonomy, 1-3 memberships per video,
-- 105 named collections across 4 categories. Extraction promoted a handful of
-- scalar fields to columns and left this array unread by anything.
--
-- Three of the four categories were effectively already promoted:
--   formats        (22) ≈ the `format` column (20 values)
--   editing_styles (30) = the `editing_style` column, exact match
--   signature_series(6) — NOTE the `signature_series` COLUMN is a DIFFERENT field
--                         (148 distinct free-text values, per-video series names)
--
-- The fourth was not promoted at all, and it is the one creators ask for:
--
--   visual_hooks — 47 named FIRST-FRAME TECHNIQUES in 5 families, on 154 videos.
--     "3P Crash Zoom" · "Camera Whip" · "Match Cut" · "Framebreaker" · "Mirror"
--     · "Fridge POV" · "Speed Ramp Effect" · "Unusual First Image/Scene" · …
--
-- 🔴 `visual_hooks` and the `visual_hook` COLUMN are different axes wearing the
-- same name. The column holds the SETTING (greenscreen / studio_set / faceless —
-- Sandcastles' visual_layout_category); these are the TECHNIQUES. The previous
-- migration (20260719150000) already flagged the naming collision and still
-- surfaced only the setting, because the collections array was never opened. So
-- "show me videos with a good visual hook" had no axis to land on — not because
-- the concept is fuzzy, but because the one field encoding it was invisible.
--
-- SHAPE: a join table, not columns. Membership is genuinely multi-valued —
-- 4 videos carry two visual_hooks techniques, 1 two formats, 1 two editing_styles.
-- Columns would silently drop the second, which is the class of quiet data loss
-- this corpus work keeps finding. A join table also makes the taxonomy
-- AGGREGATABLE, which is what `corpus_stats` (§7 step 6) will need.
--
-- All four categories are stored even though only visual_hooks is newly exposed:
-- the backfill is the expensive part conceptually (reading the jsonb correctly),
-- and re-running it later to add a category nobody stored is pure waste.
--
-- Idempotent: CREATE IF NOT EXISTS + TRUNCATE-and-refill + DROP/CREATE the RPC.
-- =========================================================================

-- =====================================================
-- 1. The taxonomy table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.teardown_collections (
  teardown_id  uuid NOT NULL REFERENCES public.outlier_teardowns(id) ON DELETE CASCADE,
  category     text NOT NULL,          -- visual_hooks | formats | editing_styles | signature_series
  subcategory  text,                   -- the FAMILY, e.g. 'Subject Motion' (NULL for formats/signature)
  name         text NOT NULL,          -- display name, e.g. 'Camera Whip'
  slug         text NOT NULL,          -- filterable key, e.g. 'camera-whip'
  family_slug  text,                   -- filterable family key, e.g. 'subject-motion'
  collection_uuid uuid,
  PRIMARY KEY (teardown_id, category, slug)
);

COMMENT ON TABLE public.teardown_collections IS
  'Sandcastles library taxonomy, unpacked from outlier_teardowns.teardown->__collections. '
  'category=visual_hooks holds first-frame TECHNIQUES — a different axis from the '
  'outlier_teardowns.visual_hook column, which holds the SETTING.';

-- Slug helper: lower, non-alphanumerics collapse to a single dash, trimmed.
-- IMMUTABLE so it can be used in the backfill and re-derived identically later.
CREATE OR REPLACE FUNCTION public.slugify_collection(txt text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- =====================================================
-- 2. Backfill from the jsonb (full refill — the array is the source of truth)
-- =====================================================
TRUNCATE public.teardown_collections;

INSERT INTO public.teardown_collections
  (teardown_id, category, subcategory, name, slug, family_slug, collection_uuid)
SELECT DISTINCT ON (t.id, coll->>'category', public.slugify_collection(coll->>'name'))
  t.id,
  coll->>'category',
  NULLIF(coll->>'subcategory', ''),
  coll->>'name',
  public.slugify_collection(coll->>'name'),
  NULLIF(public.slugify_collection(coll->>'subcategory'), ''),
  NULLIF(coll->>'uuid', '')::uuid
FROM public.outlier_teardowns t,
     LATERAL jsonb_array_elements(t.teardown->'__collections') AS coll
WHERE t.teardown ? '__collections'
  AND jsonb_typeof(t.teardown->'__collections') = 'array'
  AND coalesce(coll->>'name', '') <> ''
  AND coalesce(coll->>'category', '') <> '';

CREATE INDEX IF NOT EXISTS teardown_collections_lookup
  ON public.teardown_collections (category, slug);
CREATE INDEX IF NOT EXISTS teardown_collections_family
  ON public.teardown_collections (category, family_slug);
CREATE INDEX IF NOT EXISTS teardown_collections_teardown
  ON public.teardown_collections (teardown_id);

-- Read-only reference data, same posture as the corpus itself: the service role
-- reads it through the RPC; no client-side access path exists or should.
ALTER TABLE public.teardown_collections ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. RPC: match_shared_teardowns + the two technique gates
-- =====================================================
-- Adding params changes the signature → DROP + CREATE (CREATE OR REPLACE would
-- leave an overload beside the old one). VOLATILE default, hnsw strict_order and
-- the db-hygiene §5 search_path pin are re-applied verbatim — DROP loses them.
DROP FUNCTION IF EXISTS match_shared_teardowns(
  extensions.vector, int, text, text, text, text, text, text, text, text);

CREATE FUNCTION match_shared_teardowns(
  query_embedding       extensions.vector(768),
  match_count           int,
  filter_niche          text,
  exclude_niche         text,
  filter_platform       text,
  filter_archetype      text,
  filter_source_pool    text,
  filter_format         text,
  filter_visual         text,
  filter_editing        text,
  filter_hook_technique text DEFAULT NULL,
  filter_hook_family    text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, similarity double precision, platform text, platform_video_id text,
  video_url text, cover_url text, creator_handle text, source_pool text,
  trust_weight numeric, views bigint, follower_count bigint,
  outlier_multiplier numeric, baseline_label text, engagement_rate numeric,
  posted_at timestamptz, proof_captured_at timestamptz, niche text,
  hook_archetype text, format text, visual_hook text, editing_style text,
  spoken_hook text, hook_template text, hook_source text,
  idea jsonb, template jsonb, why_it_works text,
  -- NEW: the technique this row was filed under, so a card can name it. Aggregated
  -- because a row may carry two; NULL when the row is in no visual_hooks collection.
  hook_techniques text[]
)
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  PERFORM set_config('hnsw.iterative_scan','strict_order', true);

  RETURN QUERY
  SELECT
    t.id,
    (1 - (t.embedding <=> query_embedding))::float AS similarity,
    t.platform, t.platform_video_id, t.video_url, t.cover_url, t.creator_handle,
    t.source_pool, t.trust_weight, t.views, t.follower_count,
    t.outlier_multiplier, t.baseline_label, t.engagement_rate,
    t.posted_at, t.proof_captured_at, t.niche, t.hook_archetype, t.format,
    t.visual_hook, t.editing_style, t.spoken_hook, t.hook_template, t.hook_source,
    t.idea, t.template, t.why_it_works,
    (SELECT array_agg(tc.name ORDER BY tc.name)
       FROM public.teardown_collections tc
      WHERE tc.teardown_id = t.id AND tc.category = 'visual_hooks') AS hook_techniques
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
    -- The technique gates. EXISTS rather than a join so a row carrying two
    -- techniques is returned ONCE, not duplicated into the similarity ranking.
    AND (filter_hook_technique IS NULL OR EXISTS (
          SELECT 1 FROM public.teardown_collections tc
           WHERE tc.teardown_id = t.id
             AND tc.category = 'visual_hooks'
             AND tc.slug = filter_hook_technique))
    AND (filter_hook_family IS NULL OR EXISTS (
          SELECT 1 FROM public.teardown_collections tc
           WHERE tc.teardown_id = t.id
             AND tc.category = 'visual_hooks'
             AND tc.family_slug = filter_hook_family))
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;
