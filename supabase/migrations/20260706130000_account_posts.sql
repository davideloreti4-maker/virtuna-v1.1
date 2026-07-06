-- =========================================================================
-- Own-account per-post archive — the caption + engagement history behind
-- content pillars (the creator's recurring themes).
--
-- The refresh-account-snapshots cron ALREADY scrapes the creator's recent
-- videos (clockworks/tiktok-scraper) to sum recent_views; those VideoData items
-- carry each post's caption + posted_at + real engagement, which were discarded.
-- This table persists them so we can cluster captions into named content pillars
-- and derive each pillar's REAL share / cadence / tone from the creator's actual
-- posting mix (not fabricated fixtures).
--
-- Producer: refresh-account-snapshots cron (daily upsert of the recent window,
-- best-effort — isolated from the snapshot write). Keyed to the OWNER with
-- own-rows RLS (mirrors account_snapshots).
--
-- pillar_id is a nullable plain uuid here (NO FK yet): the content_pillars table
-- lands in the pillars-clustering migration, which adds the FK + assigns posts.
-- Until then every post stays unassigned (null).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.account_posts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform      text        NOT NULL DEFAULT 'tiktok'
                  CHECK (platform IN ('tiktok','instagram','youtube')),
  handle        text        NOT NULL,               -- owner @handle (no '@', lowercased)
  -- the platform's stable video id (clockworks platformVideoId) — upsert key
  post_id       text        NOT NULL,
  caption       text        NOT NULL DEFAULT '',    -- the post's words → pillar clustering
  posted_at     timestamptz,                        -- nullable: a scrape may omit it
  -- real engagement (BIGINT — viral posts exceed MAX_INT)
  views         bigint      NOT NULL DEFAULT 0,
  likes         bigint      NOT NULL DEFAULT 0,
  comments      bigint      NOT NULL DEFAULT 0,
  shares        bigint      NOT NULL DEFAULT 0,
  saves         bigint      NOT NULL DEFAULT 0,
  hashtags      text[]      NOT NULL DEFAULT '{}',   -- clustering signal
  is_pinned     boolean     NOT NULL DEFAULT false,  -- excluded from cadence (skews recency)
  -- the assigned content pillar (null until clustering; FK added in the pillars migration)
  pillar_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),  -- first seen
  updated_at    timestamptz NOT NULL DEFAULT now(),  -- last re-scrape
  -- one row per (user × platform × post) — upsert target
  UNIQUE (user_id, platform, post_id)
);

COMMENT ON TABLE public.account_posts IS
  'Own-account per-post archive (caption + engagement) behind content pillars. Producer: refresh-account-snapshots cron (persists the recent videos it already scrapes). own-rows RLS.';

COMMENT ON COLUMN public.account_posts.pillar_id IS
  'Assigned content pillar (null until clustering). Plain uuid here; the FK to content_pillars is added in the pillars-clustering migration.';

-- ── RLS (own rows only — mirrors account_snapshots) ─────────────────────────────
ALTER TABLE public.account_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_posts_all_own ON public.account_posts;
CREATE POLICY account_posts_all_own ON public.account_posts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- the pillar builder reads a user's recent window, newest first
CREATE INDEX IF NOT EXISTS account_posts_user_posted_idx
  ON public.account_posts (user_id, posted_at DESC);
-- incremental clustering scans a user's unassigned posts
CREATE INDEX IF NOT EXISTS account_posts_user_pillar_idx
  ON public.account_posts (user_id, pillar_id);
