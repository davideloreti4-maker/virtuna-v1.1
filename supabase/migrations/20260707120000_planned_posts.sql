-- =========================================================================
-- Planned posts — the creator's REAL content calendar. A planned post is a
-- pre-tested idea (a warmed /start idea card) SNAPSHOTTED onto a specific day.
--
-- Why snapshot instead of referencing the ideas cache: the daily-ideas batch
-- (surface_reactions, kind='idea') is a rolling 18h cache — it re-warms and the
-- ids churn. A scheduled post must survive that, so we freeze the idea's title,
-- format, and its REAL Flash reaction (`personas`) onto the row at schedule time.
-- tone / stop-rate / the verbatim reaction the calendar renders are all derived
-- from those frozen personas (personasToCardFace), and "See the room" replays
-- the exact same cast — so a post planned today still reads true next month.
--
-- Producer: the /calendar workspace (schedule / move / unschedule server actions).
-- Keyed to the OWNER with own-rows RLS (mirrors account_posts / content_pillars).
--
-- status is an enum-ish text ('scheduled' now) left open so a future 'draft'
-- state slots in without a schema break (two-state v1: idea → scheduled).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.planned_posts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- the day this post is planned for (date only — no time-of-day yet)
  scheduled_date date        NOT NULL,
  -- the source idea's stable id (LiveIdeaCard.contentId) — dedupe + link back to
  -- the warmed batch / the Room while the idea is still cached
  content_id     text        NOT NULL,
  title          text        NOT NULL,
  -- the format pill — matches LiveIdeaCard.type
  format         text        NOT NULL DEFAULT 'Reel'
                   CHECK (format IN ('Reel','Carousel')),
  -- FROZEN Flash reaction (ReactionPersona[]) → tone/stop/reason + the Room, so the
  -- post reads true after the ideas cache churns
  personas       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- two-state v1 (idea → scheduled); 'draft' reserved for later, no schema break
  status         text        NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','draft')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- one placement per (user × idea): re-scheduling the same idea MOVES it (upsert),
  -- never double-books it across two days
  UNIQUE (user_id, content_id)
);

COMMENT ON TABLE public.planned_posts IS
  'The creator''s real content calendar: pre-tested ideas snapshotted onto days (title/format/personas frozen so a plan survives the ideas-cache churn). Producer: /calendar schedule/move/unschedule actions. own-rows RLS.';

-- ── RLS (own rows only — mirrors account_posts / content_pillars) ────────────────
ALTER TABLE public.planned_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planned_posts_all_own ON public.planned_posts;
CREATE POLICY planned_posts_all_own ON public.planned_posts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Index ────────────────────────────────────────────────────────────────────
-- the workspace reads a user's plan by date window (current month + forward)
CREATE INDEX IF NOT EXISTS planned_posts_user_date_idx
  ON public.planned_posts (user_id, scheduled_date);
