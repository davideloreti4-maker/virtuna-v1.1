-- Phase 2 D-27 — projects table for future Workspace milestone.
-- Phase 2 ships SCHEMA ONLY. No UI surface. Sidebar Projects section is a
-- collapsed "Coming soon" placeholder (plan 2.5).
--
-- Idempotent: safe to run twice. RLS enabled with user_id ownership.
-- Pitfall 8 mitigation: partial unique index prevents duplicate "My Boards".

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#FF7F50',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_projects_user_archived
  ON public.projects (user_id) WHERE archived = FALSE;

-- Pitfall 8: prevents double-seed race when default project is lazy-created.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_default
  ON public.projects (user_id) WHERE name = 'My Boards' AND archived = FALSE;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_user_read" ON public.projects;
CREATE POLICY "projects_user_read" ON public.projects
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_user_insert" ON public.projects;
CREATE POLICY "projects_user_insert" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_user_update" ON public.projects;
CREATE POLICY "projects_user_update" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "projects_user_delete" ON public.projects;
CREATE POLICY "projects_user_delete" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Add nullable FK to analysis_results.
-- ON DELETE SET NULL: deleting a project does NOT cascade-delete analyses.
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS project_id UUID NULL
  REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_results_project
  ON public.analysis_results (project_id);

-- Seed: every user with at least one analysis gets a "My Boards" project.
-- ON CONFLICT: the partial unique index above no-ops when name='My Boards'
-- already exists for the user.
INSERT INTO public.projects (user_id, name, color)
SELECT DISTINCT user_id, 'My Boards', '#FF7F50'
FROM public.analysis_results
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill: attach every analysis_results row to its user's default project.
UPDATE public.analysis_results ar
   SET project_id = p.id
  FROM public.projects p
 WHERE p.user_id = ar.user_id
   AND p.name = 'My Boards'
   AND p.archived = FALSE
   AND ar.project_id IS NULL;
