-- =========================================================================
-- N1 — Creator voice sample
-- Adds writing_voice_sample TEXT (nullable) to creator_profiles.
--
-- This column stores a verbatim writing sample the creator wants the
-- generation engine to emulate (style/rhythm/tone only — NOT content).
-- Fed into Ideas/Hooks/Script/Remix via the "voice" KC role.
-- Chat is excluded (base-heavy mode; creator voice would dilute Q&A grounding).
--
-- Design decisions:
--   - TEXT (no length constraint in SQL) — UI enforces a soft cap of 1 000
--     graphemes via VoiceSampleInput; assembler enforces the hard BUNDLE_CHAR_CAP.
--   - NULL is the cold-start default (no voice sample → role silently omitted).
--   - Does NOT bump ENGINE_VERSION (text-path-only; scoring pipeline untouched).
--   - IF NOT EXISTS guard makes the migration re-runnable / idempotent.
-- =========================================================================

ALTER TABLE public.creator_profiles
  ADD COLUMN IF NOT EXISTS writing_voice_sample TEXT NULL;

COMMENT ON COLUMN public.creator_profiles.writing_voice_sample IS
  'Creator-supplied verbatim writing sample. The generation engine emulates its STYLE, rhythm, and tone only — never its specific content or claims. NULL = cold-start (role silently omitted). Set via the profile interview Card 9 (VoiceSampleInput). Honesty-spine aligned: instruction header in formatVoice() explicitly forbids content reuse.';
