-- =========================================================================
-- Remix shoot sheet (phase 1) — public.remix_blueprints
--
-- Holds the source's timed structural skeleton plus the adapted script, so
-- phase 5's revise_remix can rewrite a sheet without re-resolving the source
-- video — which is impossible anyway: derive-and-drop deletes the source mp4
-- on every run, so the perception in `blueprint` is the ONLY surviving record
-- of what the source actually did, second by second.
--
-- ── id is TEXT, not uuid ────────────────────────────────────────────────────
-- The runner mints it with nanoid(12), matching the analysis ids used
-- everywhere else in this codebase. A `.uuid()` validator on /api/remix/adapt
-- once rejected every real id with a 400; do not "correct" this to uuid.
--
-- ── Who reads and writes this table ─────────────────────────────────────────
-- Both phase-1 call sites go through src/lib/remix/blueprint-repo.ts on the
-- SERVICE client, which bypasses RLS: POST /api/tools/remix/run writes,
-- GET /api/remix/blueprint/[id] reads. Ownership on the read is enforced by
-- the repo's `user_id` predicate, not by the policy below.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.remix_blueprints (
  id              text        PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Provenance breadcrumb for phase 5, which reopens the sheet from its thread.
  -- SET NULL, never CASCADE: deleting a thread must not destroy the only record
  -- of a source video we can no longer re-fetch.
  thread_id       uuid        REFERENCES public.threads(id) ON DELETE SET NULL,
  -- The clip dedupe key (phase 4). /feed serves the same ~520 curated rows to
  -- every user, so clips must be keyed by SOURCE VIDEO, not by remix run, or
  -- storage grows with runs instead of with the corpus.
  source_video_id text,
  -- SourceBlueprint — duration_s, words_per_second, has_speech, beats[].
  blueprint       jsonb       NOT NULL,
  -- AdaptedBeat[][] — one entry per ranked variant, in the runner's card order.
  -- Defaults to '[]' because a concept may legitimately carry no script.
  script          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Phase 4. Written by nothing and read by nothing in phase 1; here so the
  -- clip lane does not need a second hand-applied migration.
  clip_uris       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.remix_blueprints IS
  'Remix shoot sheet (phase 1). Timed source skeleton + adapted per-variant script. Written by POST /api/tools/remix/run and read by GET /api/remix/blueprint/[id], both via the service client. id is a nanoid(12) text, never a uuid.';

COMMENT ON COLUMN public.remix_blueprints.source_video_id IS
  'The source post URL as the runner resolved it. Phase 4 dedupe key — note it is a URL, not a canonical platform video id, so two spellings of the same video will not collide yet.';

-- The read path is by primary key, so these three serve the LATER queries:
-- a user's sheets, a thread's sheets, and phase 4's clip dedupe by source.
CREATE INDEX IF NOT EXISTS remix_blueprints_user_id_idx
  ON public.remix_blueprints (user_id);

CREATE INDEX IF NOT EXISTS remix_blueprints_thread_id_idx
  ON public.remix_blueprints (thread_id);

CREATE INDEX IF NOT EXISTS remix_blueprints_source_video_idx
  ON public.remix_blueprints (source_video_id);

-- ── RLS (own rows only) ─────────────────────────────────────────────────────
-- Defence in depth, NOT the phase-1 access control: every phase-1 query runs on
-- the service client and bypasses this entirely. It exists so that the day a
-- user-scoped client reads this table, it reads only its owner's rows —
-- and so RLS is never off on a table holding per-user content.
--
-- No INSERT/UPDATE/DELETE policy: nothing but the service role writes here, and
-- granting a client write access to a row phase 5 rewrites is not wanted.
ALTER TABLE public.remix_blueprints ENABLE ROW LEVEL SECURITY;

-- DROP first: Postgres has no CREATE POLICY IF NOT EXISTS, so without this the
-- whole migration errors on a second paste — and this one is applied by hand.
DROP POLICY IF EXISTS remix_blueprints_select_own ON public.remix_blueprints;
CREATE POLICY remix_blueprints_select_own ON public.remix_blueprints
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
