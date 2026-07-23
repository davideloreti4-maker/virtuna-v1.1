-- =========================================================================
-- Ambient Audience v2 — Phase D persistence: threads.sim_seals
--
-- The sealed-sim verdicts for a thread, so a MEASURED "would-stop %" survives
-- a reload (today it is in-session client state only). ONE jsonb column on the
-- existing thread row — no new table, RLS inherited from `threads`.
--
-- Shape: { [trimmed stimulus (concept) text] : { pct, band, at } }
--   - key   = the card's concept text, trimmed (content-addressed — the client
--             re-matches by the same text; positional card ids are NOT stable).
--   - pct   = 0..100 would-stop % (the honest aggregateFlash "N/10 stop" as %).
--   - band  = "Strong" | "Mixed" | "Weak" (nullable — the qualitative aggregate).
--   - at    = ISO timestamp the seal was written.
--
-- Written by POST /api/tools/react on a DELIBERATE Overview sim (persist:true);
-- type-to-room never sets it. Read on rehydration (GET /api/threads/open) →
-- the composer feeds it to the v2 Overview as the `measured` seals.
-- =========================================================================

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS sim_seals jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.threads.sim_seals IS
  'Ambient v2 Phase D sealed-sim verdicts, keyed by the trimmed stimulus (concept) text → { pct, band, at }. Written by /api/tools/react on a deliberate Overview sim (persist:true); read on rehydrate so the Overview seal survives reload. RLS inherited from the thread row.';
