-- =====================================================
-- WAITLIST (landing email capture, CTA-02 / PROOF-01)
-- =====================================================
-- Persistence backbone for the landing CTA (records the signup) and the live
-- social-proof count. Security model:
--   * anon may INSERT (anyone can join the waitlist), but there is NO SELECT/
--     UPDATE/DELETE policy -> RLS default-deny hides every row from the anon key
--     (emails are never harvestable).
--   * The live count is read ONLY via waitlist_count(), a SECURITY DEFINER
--     aggregate that returns a bare bigint and never any row/email. This mirrors
--     the in-repo compute_niche_percentiles precedent (20260531000001) for
--     "count over RLS-hidden rows": the function runs as the definer so it can
--     aggregate rows the caller's RLS would otherwise hide, while exposing only
--     a scalar count. search_path is pinned per Supabase linter guidance so the
--     definer body cannot be repurposed via schema resolution.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT NOT NULL DEFAULT 'landing',  -- 'landing-hero' | 'landing-footer-cta'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constrain source to known attribution values (keeps data clean + backstops
-- the server-side literal allowlist in the Wave-3 signup action).
ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_source_check
  CHECK (source IN ('landing-hero', 'landing-footer-cta', 'landing'));

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- INSERT-ONLY for anon: anyone may add themselves. No SELECT/UPDATE/DELETE
-- policy exists, so those operations are implicitly denied to anon (RLS
-- default-deny). The UNIQUE(email) constraint + a 23505 -> dup-as-success
-- mapping in the action prevent enumeration leaks.
CREATE POLICY "Anyone can join the waitlist"
  ON public.waitlist FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Aggregate-count read that bypasses RLS safely: returns ONLY a bigint count,
-- never any row/email. Mirrors compute_niche_percentiles (SECURITY DEFINER,
-- aggregate-only). search_path pinned per Supabase linter guidance.
CREATE OR REPLACE FUNCTION public.waitlist_count()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM public.waitlist;
$$;

-- Default EXECUTE is granted to PUBLIC, but be explicit (and revoke nothing else):
GRANT EXECUTE ON FUNCTION public.waitlist_count() TO anon, authenticated;
