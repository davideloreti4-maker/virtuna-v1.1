-- =========================================================================
-- Content pillars — the creator's recurring themes (Honest confessionals,
-- Money & cost, …), clustered from their own posts' captions.
--
-- The clustering job (src/lib/content-pillars/cluster.ts) reads a user's
-- account_posts captions and, on first run, asks the model to name 3–6 themes
-- and assign each post to one. The NAMES are FROZEN once written (a re-cluster
-- classifies NEW posts into existing pillars; it never re-words them) so the
-- creator's vocabulary is stable across runs — a re-worded label reads as flaky.
--
-- Producer: the refresh-account-snapshots cron (after persisting posts). Keyed
-- to the OWNER with own-rows RLS (mirrors account_posts / account_snapshots).
--
-- This migration also promotes account_posts.pillar_id (a plain uuid from the
-- account_posts migration) to a real FK → content_pillars(id) ON DELETE SET NULL,
-- so deleting a pillar just unassigns its posts (they re-classify next run).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.content_pillars (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- the theme label — FROZEN once written (re-cluster classifies into it, never renames)
  name        text        NOT NULL,
  -- stable display order (the pillar rail renders in this order)
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- one pillar per name per user (dedupe on create)
  UNIQUE (user_id, name)
);

COMMENT ON TABLE public.content_pillars IS
  'The creator''s recurring content themes, clustered from their own posts. Names are frozen once written (re-cluster classifies new posts, never renames). Producer: refresh-account-snapshots cron. own-rows RLS.';

-- ── RLS (own rows only — mirrors account_posts) ─────────────────────────────────
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_pillars_all_own ON public.content_pillars;
CREATE POLICY content_pillars_all_own ON public.content_pillars
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS content_pillars_user_idx
  ON public.content_pillars (user_id, sort_order);

-- ── Promote account_posts.pillar_id → real FK ───────────────────────────────────
ALTER TABLE public.account_posts
  DROP CONSTRAINT IF EXISTS account_posts_pillar_fk;
ALTER TABLE public.account_posts
  ADD CONSTRAINT account_posts_pillar_fk
  FOREIGN KEY (pillar_id) REFERENCES public.content_pillars(id) ON DELETE SET NULL;
