-- =========================================================================
-- Phase 10 Plan 02 — Saved-shelf persistence: saved_items (SAVE-01/02)
--
-- A NEW typed FLAT table for cross-skill saved items. `user_bookmarks`
-- (user_id, video_id) is too narrow — keep it for Discover video bookmarks;
-- typed cross-skill saves (read/idea/hook/script/outlier/format) live here.
--
-- FLAT BY CONSTRUCTION (D-07): no folder_id, no tags. P12 EXTENDS (adds
-- watchlist/collection as SEPARATE tables/columns) — never reworks this shape.
--
-- snapshot jsonb = the saved block's props, so the shelf renders the same typed
-- renderer WITHOUT a re-fetch (thread↔shelf wiring seam, RESEARCH §5).
--
-- RLS own-rows-only mirrors the audiences idiom.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.saved_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Typed shelf (D-07): the typed renderer the shelf dispatches on.
  item_type   text        NOT NULL CHECK (item_type IN
                ('read','idea','hook','script','outlier','format')),
  -- analysis_id / message_id / video_id the item points at.
  ref_id      text,
  -- thread↔shelf wiring; deleting the thread degrades the saved item to thread-less.
  thread_id   uuid        REFERENCES public.threads(id) ON DELETE SET NULL,
  title       text,
  -- The saved block's props — so the shelf renders without re-fetch.
  snapshot    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.saved_items IS
  'Typed FLAT cross-skill shelf (SAVE-01/02, D-07). One row per saved block; snapshot carries the block props so the shelf renders without re-fetch. FLAT by construction — no folder_id, no tags. P12 EXTENDS with separate tables, never reworks this shape.';

COMMENT ON COLUMN public.saved_items.snapshot IS
  'The saved block''s props (jsonb) — the shelf renders the same typed renderer (item_type) directly from this, no re-fetch.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS saved_items_user_type_idx
  ON public.saved_items (user_id, item_type);

-- ── RLS (own rows only — mirrors audiences_all_own) ──────────────────────────
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_all_own ON public.saved_items;
CREATE POLICY saved_all_own ON public.saved_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
