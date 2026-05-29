-- Cross-user niche cohort percentiles for the Verdict "vs niche" comparison.
-- Returns AGGREGATE STATS ONLY (median, p75, count) — never individual rows.
-- Privacy guards: minimum cohort size (default 5) via HAVING, and the calling
-- user is excluded from their own cohort. Called from the comparisons route via
-- the service-role client (the user-scoped client + RLS would otherwise hide
-- other users' rows).

CREATE OR REPLACE FUNCTION public.compute_niche_percentiles(
  p_society_id TEXT,
  p_exclude_user_id UUID DEFAULT NULL,
  p_min_cohort_size INT DEFAULT 5
)
RETURNS TABLE(median NUMERIC, p75 NUMERIC, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    percentile_cont(0.5)  WITHIN GROUP (ORDER BY overall_score) AS median,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY overall_score) AS p75,
    count(*) AS count
  FROM public.analysis_results
  WHERE society_id = p_society_id
    AND deleted_at IS NULL
    AND overall_score IS NOT NULL
    AND (p_exclude_user_id IS NULL OR user_id <> p_exclude_user_id)
  HAVING count(*) >= p_min_cohort_size;
$$;
