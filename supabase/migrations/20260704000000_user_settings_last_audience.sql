-- user_settings.last_audience_id — the USER-level last-used Audience (The Room, PR-4 pre-req).
-- =========================================================================
-- Sibling to threads.active_audience_id (the per-THREAD pin, 20260619000000_audiences.sql).
-- Where the thread pin answers "what was THIS thread generating for", this answers
-- "what audience did the creator last pick, anywhere" — the default that survives a page
-- reload (the empty /home has no thread to read a pin from) + seeds surfaces / new threads.
--
-- NULL = General default (absence of override → the virtual GENERAL_AUDIENCE, regression-gate
-- free by construction). ON DELETE SET NULL mirrors the thread pin: deleting an Audience
-- degrades the user default to General gracefully rather than erroring.
-- Read via resolveUserAudience(supabase, userId); written by the presence switcher on every pick.
-- =========================================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS last_audience_id uuid NULL
    REFERENCES public.audiences(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_settings.last_audience_id IS
  'User-level last-used Audience default (The Room). NULL = General. Sibling to threads.active_audience_id (per-thread pin) — this survives reload + seeds new threads/surfaces. Set by the audience presence switcher on every selection; read via resolveUserAudience. ON DELETE SET NULL degrades to General when the Audience is deleted.';
