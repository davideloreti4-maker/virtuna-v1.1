-- =========================================================================
-- The edit tool's takes and jobs (worker plan, Task 6; X41, X42, X43)
--
-- A take is a video a creator uploaded straight to R2 (X43: its source at
-- u/<user>/takes/<take>/source, its copies beside it). A job is one run of the
-- worker on Modal: the analysis of a take, or the render of an edit (the job's
-- `input` keeps the edit it rendered; there is no edits table yet, X42).
--
-- ── Who writes ──────────────────────────────────────────────────────────────
-- The app writes a take when its upload is signed and a job when it asks for
-- one, both with the SERVICE client; the worker writes everything after that,
-- with the service key over PostgREST. Nobody else writes: RLS is on with one
-- SELECT policy per table (a creator reads their own rows) and no other policy,
-- so a session can read its takes and jobs and change nothing.
--
-- ── Why updated_at is set by a trigger ──────────────────────────────────────
-- A running job that has not been touched for two minutes reads as failed
-- (X41); the worker touches it every 30 s while it runs. The trigger stamps
-- every UPDATE with the database's clock, so a worker that forgets to set it,
-- or sets it wrong, cannot make a dead job look alive.
--
-- ── Values ──────────────────────────────────────────────────────────────────
-- edit_takes.status: uploading → analysing → ready | failed.
-- edit_jobs.status:  queued → running → done | failed; `stage` and `progress`
-- (0..1) say how far a running job is; `call_id` is the Modal call that runs it.
-- An analyse job names its take; a render job names none.
-- `bytes` is bigint: a take may be up to 2 GB, past int4.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.edit_takes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'uploading'
                           CHECK (status IN ('uploading', 'analysing', 'ready', 'failed')),
  -- The file's name as the creator's device gave it.
  name         text        NOT NULL,
  -- The size the app signed the upload for; the worker refuses a source in R2 of any other size.
  bytes        bigint      NOT NULL CHECK (bytes > 0),
  source_path  text        NOT NULL,
  -- Measured once on the worker (N5): the take's and both copies' facts, and the length it is stored with.
  facts        jsonb,
  words        jsonb,
  -- The rest of the analysis: the copies' keys in R2, pauses, faces, loudness, language.
  analysis     jsonb,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.edit_takes IS
  'The edit tool''s takes: a video uploaded to R2 and its analysis (worker plan, Task 6). Service-role writes; a creator reads their own rows.';

CREATE TABLE IF NOT EXISTS public.edit_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('analyse', 'render')),
  take_id      uuid        REFERENCES public.edit_takes(id) ON DELETE CASCADE,
  -- A render job's edit (and its cover frame); an analyse job needs none.
  input        jsonb,
  status       text        NOT NULL DEFAULT 'queued'
                           CHECK (status IN ('queued', 'running', 'done', 'failed')),
  stage        text,
  progress     real        NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  result       jsonb,
  error        text,
  call_id      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edit_jobs_take_for_analyse CHECK ((kind = 'analyse') = (take_id IS NOT NULL))
);

COMMENT ON TABLE public.edit_jobs IS
  'The edit worker''s jobs: a take analysed or an edit rendered (worker plan, Task 6; X41). Service-role writes; a creator reads their own rows.';

-- A creator's takes and jobs, newest first.
CREATE INDEX IF NOT EXISTS edit_takes_user_created_idx ON public.edit_takes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS edit_jobs_user_created_idx ON public.edit_jobs (user_id, created_at DESC);
-- A take's jobs, and the cascade when a take is deleted.
CREATE INDEX IF NOT EXISTS edit_jobs_take_idx ON public.edit_jobs (take_id) WHERE take_id IS NOT NULL;

-- ── updated_at, on every update ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.edit_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS edit_takes_updated_at ON public.edit_takes;
CREATE TRIGGER edit_takes_updated_at
  BEFORE UPDATE ON public.edit_takes
  FOR EACH ROW
  EXECUTE FUNCTION public.edit_touch_updated_at();

DROP TRIGGER IF EXISTS edit_jobs_updated_at ON public.edit_jobs;
CREATE TRIGGER edit_jobs_updated_at
  BEFORE UPDATE ON public.edit_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.edit_touch_updated_at();

-- ── RLS: a creator reads their own rows; only the service role writes ───────
ALTER TABLE public.edit_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS edit_takes_select_own ON public.edit_takes;
CREATE POLICY edit_takes_select_own ON public.edit_takes
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS edit_jobs_select_own ON public.edit_jobs;
CREATE POLICY edit_jobs_select_own ON public.edit_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
