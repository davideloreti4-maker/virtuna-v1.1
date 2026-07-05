-- =========================================================================
-- Surface reaction cache — the pre-tested /start cards (daily-ideas + outliers).
--
-- The /start flagship shows cards "pre-tested on your people": a real per-audience
-- Flash sim behind each idea/outlier (Seams 1/2, docs/SURFACE-SEAM-SPEC.md). Simming
-- on every page load is too slow/costly, so one gen→sim batch per (user × audience ×
-- kind) is CACHED here and re-warmed lazily on the first /start visit of the day
-- (owner-chosen cadence, 2026-07-05): a stale/absent row → the client fires the refresh
-- route, which re-sims + upserts. Deterministic sim (temp:0+seed) ⇒ identical personas
-- for an unchanged card set; the TTL exists to pick up NEW outliers + audience switches.
--
-- `cards` holds the real sim output only — the video metadata (real scraped_videos data)
-- + `personas: [{archetype,verdict,quote}]` (the real Flash reaction). The glance-face and
-- the opened Room are DERIVED from `personas` at render (pure) — nothing fabricated is stored.
--
-- audience_key is the cache key, NOT an FK: the real audience UUID for a calibrated audience,
-- or the literal 'general' for the General baseline (which has no row). No FK ⇒ a deleted
-- audience just leaves a stale row the TTL/refresh reaps — the cache is disposable by design.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.surface_reactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- cache key: the audience UUID (as text) for a calibrated audience, or 'general'
  audience_key text        NOT NULL,
  -- which /start section this batch feeds
  kind         text        NOT NULL CHECK (kind IN ('outlier','idea')),
  -- the real card view-models: video metadata + the per-audience Flash personas (array)
  cards        jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- one cached batch per (user × audience × section) — upsert target
  UNIQUE (user_id, audience_key, kind)
);

COMMENT ON TABLE public.surface_reactions IS
  'Cache of the pre-tested /start cards (daily-ideas + outliers): one Flash sim batch per (user x audience x kind), re-warmed lazily on the first /start visit of the day. cards holds real video metadata + the real personas; the face/Room derive from personas. own-rows RLS.';

COMMENT ON COLUMN public.surface_reactions.audience_key IS
  'Cache key (NOT an FK): the audience UUID as text, or the literal ''general''. No FK — the cache is disposable; a deleted audience leaves a stale row the TTL reaps.';

-- ── RLS (own rows only — mirrors account_snapshots) ─────────────────────────────
ALTER TABLE public.surface_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surface_reactions_all_own ON public.surface_reactions;
CREATE POLICY surface_reactions_all_own ON public.surface_reactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Index (the cache read is by user + key + kind, covered by the UNIQUE) ────────
CREATE INDEX IF NOT EXISTS surface_reactions_user_idx
  ON public.surface_reactions (user_id, updated_at DESC);
