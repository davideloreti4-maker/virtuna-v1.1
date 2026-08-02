-- =========================================================================
-- Library rework phase 2 — library_projects (+ saved_items.project_id)
--
-- The Library's organizing model: manual folders over saved OUTPUTS. Single
-- membership, no tags, no nesting (owner decision, 2026-08-02). Threads stay in
-- the sidebar; a saved row deep-links back to the thread that produced it.
--
-- ⚠️ NOT the `public.projects` table. That one predates this work
-- (20260526100000_add_projects.sql), has ZERO code references, and still holds
-- two live seeded 'My Boards' rows whose default colour is #FF7F50 — the RETIRED
-- Raycast coral. Reviving it would mean inheriting that data and that default;
-- this is a fresh table in the saved_items RLS idiom, and `projects` is left
-- exactly as it is.
--
-- This EXTENDS saved_items with a nullable column, which is the path its own
-- migration sanctioned ("P12 EXTENDS with separate tables/columns"). saved_items
-- stays flat by construction: project_id NULL means Unfiled, and that is the
-- default for every row that exists today.
--
-- ON DELETE SET NULL on project_id is deliberate: deleting a project UNFILES its
-- items, it never deletes saved work. Unsaving is the only path that removes a row.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.library_projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Trimmed length is what the API validates, so the constraint checks the same thing.
  name        text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Touched when an item is filed in or out, so "updated 2 days ago" is honest.
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.library_projects IS
  'Library projects — manual folders over saved_items outputs (single membership, no tags, no nesting). Distinct from the dead public.projects table, which is unreferenced and seeded with retired-coral My Boards rows.';

-- The shelf lists projects most-recently-touched first.
CREATE INDEX IF NOT EXISTS library_projects_user_updated_idx
  ON public.library_projects (user_id, updated_at DESC);

-- One project name per user, case- and whitespace-insensitive: "Launch video" and
-- "launch video " are the same folder to a human, so the picker must not offer both.
CREATE UNIQUE INDEX IF NOT EXISTS library_projects_user_name_uniq
  ON public.library_projects (user_id, lower(btrim(name)));

-- ── RLS (own rows only — mirrors saved_all_own) ──────────────────────────────
ALTER TABLE public.library_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS library_projects_all_own ON public.library_projects;
CREATE POLICY library_projects_all_own ON public.library_projects
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── saved_items.project_id — NULL = Unfiled ─────────────────────────────────
ALTER TABLE public.saved_items
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.library_projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.saved_items.project_id IS
  'Owning library project, or NULL for Unfiled. ON DELETE SET NULL — deleting a project unfiles its items and never deletes saved work.';

CREATE INDEX IF NOT EXISTS saved_items_project_idx
  ON public.saved_items (project_id) WHERE project_id IS NOT NULL;
