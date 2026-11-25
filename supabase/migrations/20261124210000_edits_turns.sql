-- =========================================================================
-- The editor's edits and their turns (editor screens, slice A, Task 1;
-- spec 2026-11-24-editor-screens-design.md §6)
--
-- An edit is one take being edited by its creator: its chat, the take, its
-- title, the look of the cut shown, the style profile its last cut used, the
-- turn the creator is at (`head`), and the export of the turn shown.
-- A turn is one step: the first cut or a cut in another look (`cut`), a change
-- the agent made (`change`), a word or the captions set by hand (`direct`), or
-- an answer that changed nothing (`said`, with no `doc`). `doc` is the whole
-- edit after the turn (3 to 20 KB). A run is a turn that holds a doc and the
-- `said` answers directly after it. `head` only ever rests on the last turn of
-- a run, so it may be a `said` turn; the turn shown is the last one at or
-- before `head` that holds a doc. Undo and Redo move `head` to the end of the
-- run before or after. A new turn is made at `head` + 1 and drops every turn
-- after `head`. An edit keeps at most 300 turns.
-- `at` (the film frame a request was about) and `kept` (findings put away) are
-- written from slice B; in slice A they stay null and '[]'.
--
-- ── Who writes ──────────────────────────────────────────────────────────────
-- Only the app's routes, with the SERVICE client, after checking the edit is
-- the signed-in creator's. A creator reads their own rows through RLS (a turn
-- through its edit) and writes nothing, as `edit_takes` and `edit_jobs`.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.edits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id    uuid,
  take_id      uuid        NOT NULL,
  title        text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- A preset's id, 'house', 'video' (a reference's style) or 'words'; null before the first cut.
  look         text        CHECK (look IS NULL OR look ~ '^[a-z][a-z-]{0,39}$'),
  style        jsonb,
  head         integer     CHECK (head IS NULL OR (head >= 1 AND head <= 300)),
  export_job   uuid,
  export_turn  integer     CHECK (export_turn IS NULL OR (export_turn >= 1 AND export_turn <= 300)),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edits_take_owner_fkey FOREIGN KEY (take_id, user_id) REFERENCES public.edit_takes (id, user_id) ON DELETE CASCADE,
  CONSTRAINT edits_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.threads (id) ON DELETE SET NULL,
  CONSTRAINT edits_export_job_fkey FOREIGN KEY (export_job) REFERENCES public.edit_jobs (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.edits IS
  'The editor''s edits: a take being edited, its chat, title, look and the turn shown (editor screens, slice A). Service-role writes; a creator reads their own rows.';

CREATE TABLE IF NOT EXISTS public.edit_turns (
  edit_id     uuid        NOT NULL,
  n           integer     NOT NULL CHECK (n >= 1 AND n <= 300),
  kind        text        NOT NULL CHECK (kind IN ('cut', 'change', 'direct', 'said')),
  request     text        CHECK (request IS NULL OR char_length(request) <= 500),
  at          integer     CHECK (at IS NULL OR (at >= 0 AND at <= 5400)),
  say         text        NOT NULL,
  findings    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  kept        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  doc         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (edit_id, n),
  CONSTRAINT edit_turns_edit_id_fkey FOREIGN KEY (edit_id) REFERENCES public.edits (id) ON DELETE CASCADE,
  CONSTRAINT edit_turns_said_has_no_doc CHECK ((kind = 'said') = (doc IS NULL))
);

COMMENT ON TABLE public.edit_turns IS
  'The editor''s turns: each step of an edit, the edit after it (doc) and what was said (editor screens, slice A). Service-role writes; a creator reads the turns of their own edits.';

-- A creator's edits, newest first; then one index for each key to another
-- table's row: an edit's chat, its take, its export's job. (A turn's key to
-- its edit is covered by the turns' primary key.)
CREATE INDEX IF NOT EXISTS edits_user_created_idx ON public.edits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edits_thread_idx ON public.edits (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS edits_take_idx ON public.edits (take_id, user_id);
CREATE INDEX IF NOT EXISTS edits_export_job_idx ON public.edits (export_job) WHERE export_job IS NOT NULL;

-- ── updated_at, on every update (the function the edit tool's tables share) ──
DROP TRIGGER IF EXISTS edits_updated_at ON public.edits;
CREATE TRIGGER edits_updated_at
  BEFORE UPDATE ON public.edits
  FOR EACH ROW
  EXECUTE FUNCTION public.edit_touch_updated_at();

-- ── RLS: a creator reads their own rows; only the service role writes ───────
ALTER TABLE public.edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edits_select_own ON public.edits;
CREATE POLICY edits_select_own ON public.edits
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS edit_turns_select_own ON public.edit_turns;
CREATE POLICY edit_turns_select_own ON public.edit_turns
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.edits e WHERE e.id = edit_turns.edit_id AND e.user_id = (SELECT auth.uid())));

-- ── Grants narrowed to what is used (as 20261120130000_edit_takes_jobs_grants.sql) ──
REVOKE ALL ON TABLE public.edits, public.edit_turns FROM anon;
REVOKE ALL ON TABLE public.edits, public.edit_turns FROM authenticated;
GRANT SELECT ON TABLE public.edits, public.edit_turns TO authenticated;
