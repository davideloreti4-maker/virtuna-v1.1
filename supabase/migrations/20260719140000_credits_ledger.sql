-- CREDITS — the ledger learns prices (owner-locked 2026-07-19).
--
-- The meter moves from "count Readings" to "sum credits": every paid action writes one
-- reading_events row stamped with its CREDIT_COSTS price (a Reading 10, a script 2, a hooks
-- pack 1...), and the quota check sums `credits` instead of counting rows. The plans sell the
-- same capacity as before (50 Readings → 500 credits), the unit just got finer so the
-- generation skills can draw from the same pool.
--
-- DEFAULT 10 is a statement about HISTORY, not a convenience: every row written before this
-- column existed was a full Reading (score or remix decode — the only two writers), and a
-- full Reading costs exactly 10 credits. The backfill is therefore exact, not approximate.
-- New writers always stamp `credits` explicitly (lib/billing/record-usage.ts).
--
-- Safe on a live DB: an ADD COLUMN with a constant default is metadata-only on Postgres 11+,
-- and the app's quota check falls back gracefully while either half is missing (RPC absent →
-- row count × 10; table absent → legacy analysis_results count).

ALTER TABLE reading_events
  ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 10
  CHECK (credits >= 0);

COMMENT ON COLUMN reading_events.credits IS
  'The price of this action in credits, stamped at delivery (CREDIT_COSTS in src/lib/pricing.ts). Pre-credits rows carry the default 10 — they were all full Readings. A later price change never rewrites history.';

-- THE HOT-PATH SUM — "credits spent since <window start>", run on every paid route before
-- any engine spend. An RPC because the sum must happen server-side: fetching rows to add
-- them up in the app would transfer a month of events per request AND silently truncate at
-- PostgREST's page size, under-counting exactly when it matters (the heaviest users).
--
-- SECURITY INVOKER (the default): when called with a user's session, RLS on reading_events
-- scopes the sum to their own rows regardless of p_user_id; the service role passes any
-- p_user_id. STABLE: reads only, so the planner may cache within a statement.
CREATE OR REPLACE FUNCTION public.credits_used_since(p_user_id UUID, p_since TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(SUM(credits), 0)::BIGINT
  FROM public.reading_events
  WHERE user_id = p_user_id
    AND billed
    AND created_at >= p_since
$$;

COMMENT ON FUNCTION public.credits_used_since(UUID, TIMESTAMPTZ) IS
  'Σ credits over billed ledger rows since p_since — the quota meter (lib/billing/quota.ts). RLS applies for user sessions (SECURITY INVOKER).';
