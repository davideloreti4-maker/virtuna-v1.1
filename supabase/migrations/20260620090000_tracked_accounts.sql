-- =========================================================================
-- Phase 11 Plan 02 — Explore watchlist input: tracked_accounts (EXPLORE-05 / D-08)
--
-- The durable, flat-typed watchlist rail the Explore "+ Track account" write
-- persists into — the Explore PRODUCER half. A tracked account is an input
-- HANDLE, not a saved block snapshot, so it is a NEW dedicated table (not an
-- overload of saved_items, whose migration comment explicitly says "P12 EXTENDS
-- with separate tables, never reworks this shape").
--
-- FLAT BY CONSTRUCTION (D-08): no folder_id, no tags, no CMS. P12 surfaces and
-- manages it (Library) with NO rework. One row per (user, platform, handle);
-- the UNIQUE constraint makes Track idempotent.
--
-- RLS own-rows-only mirrors the saved_items idiom (saved_all_own).
--
-- NOT applied to the live DB in this plan — the live-prod push + database.types.ts
-- regen is the BLOCKING final wave (11-08), mirroring prior phases (07-06, 10-07).
-- EXPLORE-06 (comment seeding) is DEFERRED again (D-09) — no comments table here.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.tracked_accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        text        NOT NULL DEFAULT 'tiktok'
                    CHECK (platform IN ('tiktok','instagram','youtube')),
  -- the @handle the creator tracks (no '@', lowercased)
  handle          text        NOT NULL,
  -- the outlier tile this was tracked from (provenance)
  source_video_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- idempotent track — no dup rows
  UNIQUE (user_id, platform, handle)
);

COMMENT ON TABLE public.tracked_accounts IS
  'Flat-typed watchlist input State (EXPLORE-05 / D-08, the Explore PRODUCER half). FLAT by construction — no folder_id, no tags, no CMS. P12 surfaces/manages it (Library) with no rework. One row per (user, platform, handle); UNIQUE makes Track idempotent.';

COMMENT ON COLUMN public.tracked_accounts.handle IS
  'The @handle the creator tracks — stored without the leading ''@'', lowercased.';

COMMENT ON COLUMN public.tracked_accounts.source_video_id IS
  'The outlier tile this account was tracked from (provenance) — nullable.';

-- ── RLS (own rows only — mirrors saved_all_own) ──────────────────────────────
ALTER TABLE public.tracked_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracked_all_own ON public.tracked_accounts;
CREATE POLICY tracked_all_own ON public.tracked_accounts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tracked_accounts_user_idx
  ON public.tracked_accounts (user_id);
