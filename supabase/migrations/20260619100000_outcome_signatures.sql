-- =========================================================================
-- Phase 10 Plan 02 — Flywheel persistence: outcome_signatures (FLYWHEEL-01/02)
--
-- A NEW sibling table — it does NOT touch the contested `outcomes` table
-- (Pitfall 1: two conflicting `outcomes` defs exist; leave both alone).
--
-- One row per realized outcome signature: the PREDICTED disposition vector
-- (pinned at SIM time) vs the REALIZED one (from a scraped/creator-supplied
-- post), plus per-channel provenance and the raw metrics it was derived from.
--
-- Design (verbatim from 10-RESEARCH.md §4):
--   - analysis_id is TEXT, not uuid — analysis_results.id is TEXT (STATE FK note).
--     FK semantics only; NOT unique (re-reports allowed).
--   - audience_id uuid REFERENCES audiences ON DELETE SET NULL (Pitfall 6 pin).
--   - source allows 'paste_url' | 'drift_scrape' (the drift half folds into the
--     same PROPOSE path — D-01).
--   - RLS own-rows-only mirrors the audiences idiom (auth.uid()=user_id).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.outcome_signatures (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- FK semantics: analysis_results.id is TEXT on the live DB (STATE note) — NOT uuid, NOT unique.
  analysis_id         text,
  -- Audience pin (Pitfall 6): which audience this outcome reconciles against.
  audience_id         uuid        REFERENCES public.audiences(id) ON DELETE SET NULL,
  platform_post_url   text,
  posted_at           timestamptz,
  -- PREDICTED disposition vector — pinned at SIM time, normalized shares.
  -- {scanner, skeptic, collector, connector, converter, lurker}
  predicted_vector    jsonb       NOT NULL,
  -- REALIZED disposition vector — partial; only channels with a signal (honesty spine).
  realized_vector     jsonb,
  -- Per-channel provenance: {saves:"public_scrape", retention:"creator_supplied", ...}
  realized_provenance jsonb,
  -- Raw metrics the realized vector was derived from
  -- {views, likes, comments, shares, saves, watch_through_pct, link_clicks}
  raw_metrics         jsonb,
  -- 'paste_url' (outcome capture) | 'drift_scrape' (audience-drift cron, same PROPOSE path)
  source              text        NOT NULL DEFAULT 'paste_url'
                        CHECK (source IN ('paste_url','drift_scrape')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.outcome_signatures IS
  'One realized outcome signature per reported post: predicted (SIM-time) vs realized disposition vector + per-channel provenance + raw metrics. Sibling table — never touches the contested outcomes table (Pitfall 1). source=drift_scrape rows come from the audience-drift cron and run through the same reconcile path.';

COMMENT ON COLUMN public.outcome_signatures.analysis_id IS
  'analysis_results.id (TEXT on the live DB — STATE FK note). NOT unique: re-reports of the same analysis are allowed.';
COMMENT ON COLUMN public.outcome_signatures.realized_vector IS
  'Partial disposition vector — only channels with a realized signal. A channel with no signal is EXCLUDED, never zero-filled (honesty spine, Pitfall 3).';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS outcome_signatures_user_idx
  ON public.outcome_signatures (user_id);
CREATE INDEX IF NOT EXISTS outcome_signatures_audience_idx
  ON public.outcome_signatures (audience_id);

-- ── RLS (own rows only — mirrors audiences_all_own) ──────────────────────────
ALTER TABLE public.outcome_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS os_all_own ON public.outcome_signatures;
CREATE POLICY os_all_own ON public.outcome_signatures
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
