-- =========================================================================
-- analysis_chats — "Ask the expert" conversation log (260607-00u)
-- =========================================================================
-- Persists per-analysis user/assistant chat turns so conversations replay
-- on /analyze/[id] permalink reload.  Zero engine spend: the chat endpoint
-- grounds answers ONLY on the already-persisted analysis_results row.
-- =========================================================================

COMMENT ON SCHEMA public IS 'Standard Supabase public schema';

-- ── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analysis_chats (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  text         NOT NULL REFERENCES public.analysis_results(id) ON DELETE CASCADE,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text         NOT NULL CHECK (role IN ('user', 'assistant')),
  content      text         NOT NULL,
  scope        text,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analysis_chats IS
  '"Ask the expert" chat log — one row per message turn (user or assistant) for each analysis conversation.';

-- ── Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS analysis_chats_analysis_id_created_at_idx
  ON public.analysis_chats (analysis_id, created_at);

-- ── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.analysis_chats ENABLE ROW LEVEL SECURITY;

-- SELECT: user can read their own chat turns where they also own the analysis.
DROP POLICY IF EXISTS analysis_chats_select_own ON public.analysis_chats;
CREATE POLICY analysis_chats_select_own ON public.analysis_chats
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.analysis_results
       WHERE analysis_results.id = analysis_chats.analysis_id
         AND analysis_results.user_id = auth.uid()
    )
  );

-- INSERT: user can only write turns for analyses they own; user_id must match
-- session (enforced server-side too — never trusted from request body).
DROP POLICY IF EXISTS analysis_chats_insert_own ON public.analysis_chats;
CREATE POLICY analysis_chats_insert_own ON public.analysis_chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.analysis_results
       WHERE analysis_results.id = analysis_chats.analysis_id
         AND analysis_results.user_id = auth.uid()
    )
  );
