-- =========================================================================
-- threads + messages — generalized thread/message persistence (01-02)
-- =========================================================================
-- Adds:
--   public.threads  — generalized thread wrapper (grounded | open)
--                     nullable reading_id UUID FK → analysis_results(id)
--   public.messages — one row per message; body = typed-blocks JSONB array
--
-- Design: D-12 (Reading stays the artifact; the thread WRAPS it),
--         D-13 (JSONB typed-blocks array per message row),
--         D-14 (block types validated at rehydration by the registry),
--         D-15 (lazy idempotent grounded-thread creation via UNIQUE partial index).
--
-- RLS mirrors analysis_chats pattern verbatim:
--   threads: user_id = auth.uid()
--   messages: EXISTS (SELECT 1 FROM threads WHERE id = thread_id AND user_id = auth.uid())
--
-- analysis_results is NEVER altered by this migration (D-12 protects Max path).
-- =========================================================================

COMMENT ON SCHEMA public IS 'Standard Supabase public schema';

-- =========================================================================
-- TABLE: public.threads
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.threads (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('grounded', 'open')),
  -- reading_id: TEXT to match analysis_results.id's REAL column type on the
  -- live DB (text storing UUID-format strings) — same as analysis_chats.analysis_id.
  -- The plan's Pitfall #3 ("id is uuid") was incorrect; live apply rejected a uuid FK.
  -- Nullable + SET NULL: deleting a Reading nulls the pointer, never errors.
  reading_id  text        NULL REFERENCES public.analysis_results(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.threads IS
  'Generalized thread wrapper. type=grounded points at a Reading via nullable reading_id; type=open has reading_id null. One thread per user per Reading (UNIQUE partial index).';

COMMENT ON COLUMN public.threads.reading_id IS
  'TEXT FK to analysis_results(id) (text on the live DB). NULL for open threads. ON DELETE SET NULL so deleting a Reading orphans its thread without erroring. Uniqueness enforced by the partial index below (D-15).';

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Partial UNIQUE: exactly one grounded thread per Reading per ... (global, not
-- per-user — reading_id is globally unique across threads because Readings are
-- user-scoped already).  D-15 idempotency backstop.
CREATE UNIQUE INDEX IF NOT EXISTS threads_reading_id_unique_idx ON public.threads (reading_id) WHERE reading_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS threads_user_id_idx
  ON public.threads (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- SELECT: own threads only.
DROP POLICY IF EXISTS threads_select_own ON public.threads;
CREATE POLICY threads_select_own ON public.threads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: user_id must match session (server-side enforcement; never trusted from body).
DROP POLICY IF EXISTS threads_insert_own ON public.threads;
CREATE POLICY threads_insert_own ON public.threads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: own threads only.
DROP POLICY IF EXISTS threads_update_own ON public.threads;
CREATE POLICY threads_update_own ON public.threads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================================
-- TABLE: public.messages
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid        NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  -- body: typed-blocks JSONB array — each element {type, props}.
  -- One atomic row per message (D-13); blocks validated by registry on rehydration (D-14).
  body        jsonb       NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS
  'One row per message turn in a thread. body is a typed-blocks JSONB array [{type, props}]; blocks validated by the renderer registry on rehydration (D-14).';

COMMENT ON COLUMN public.messages.body IS
  'Typed-blocks JSON array. Each element: {type: string, props: object}. Validated against BLOCK_REGISTRY schema on both write and rehydration (D-14).';

-- ── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS messages_thread_id_created_at_idx
  ON public.messages (thread_id, created_at);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT: gated by thread ownership (mirrors analysis_chats pattern for chats).
DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads
       WHERE threads.id = messages.thread_id
         AND threads.user_id = auth.uid()
    )
  );

-- INSERT: same thread-ownership EXISTS subquery.
DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.threads
       WHERE threads.id = messages.thread_id
         AND threads.user_id = auth.uid()
    )
  );
