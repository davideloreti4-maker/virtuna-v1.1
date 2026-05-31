-- Extends compute_niche_percentiles to return a 10-bin score histogram.
-- Privacy: histogram contains AGGREGATE BIN COUNTS ONLY — same privacy class
-- as count. No individual rows are ever returned. Min-cohort HAVING guard
-- (default 5) and requesting-user exclusion are preserved from v1.
-- When cohort < min OR no society_id the route receives 0 rows → niche=null.

-- Drop the old signature first (RETURN TABLE shape changed; can't
-- CREATE OR REPLACE with a different return column list).
DROP FUNCTION IF EXISTS public.compute_niche_percentiles(text, uuid, int);

CREATE FUNCTION public.compute_niche_percentiles(
  p_society_id      TEXT,
  p_exclude_user_id UUID    DEFAULT NULL,
  p_min_cohort_size INT     DEFAULT 5
)
RETURNS TABLE(median NUMERIC, p75 NUMERIC, count BIGINT, histogram INT[])
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Raw cohort rows (same filters as v1)
  cohort AS (
    SELECT overall_score
    FROM   public.analysis_results
    WHERE  society_id   = p_society_id
      AND  deleted_at   IS NULL
      AND  overall_score IS NOT NULL
      AND  (p_exclude_user_id IS NULL OR user_id <> p_exclude_user_id)
  ),
  -- Aggregate stats; HAVING enforces min-cohort privacy guard
  agg AS (
    SELECT
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY overall_score) AS median,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY overall_score) AS p75,
      count(*)                                                     AS count
    FROM cohort
    HAVING count(*) >= p_min_cohort_size
  ),
  -- Count per decile bin (0=[0-10), 1=[10-20), …, 9=[90-100])
  bins AS (
    SELECT
      LEAST(9, GREATEST(0, floor(overall_score / 10)::int)) AS b,
      count(*) AS c
    FROM cohort
    GROUP BY 1
  ),
  -- Dense 10-element array; missing bins default to 0
  hist AS (
    SELECT array_agg(coalesce(bins.c, 0) ORDER BY s.b)::int[] AS histogram
    FROM   generate_series(0, 9) AS s(b)
    LEFT JOIN bins ON bins.b = s.b
  )
  SELECT agg.median, agg.p75, agg.count, hist.histogram
  FROM   agg, hist;
$$;
