-- =========================================================================
-- §P AudienceSignature — make the audience REAL (live-validated, BUILD step 1)
--
-- Adds the two JSONB columns the real-signature path writes at calibration:
--   - creator_persona : PER-AUDIENCE creator card (Sandcastles' 3 fields, AUTO-derived
--                       from scrape + transcripts + watchNotes). NOT profile-level —
--                       a creator may run multiple accounts with distinct voices (P.8).
--   - signature       : the frozen AudienceSignature (engagement_profile, interest_tags,
--                       what_resonates/falls_flat, 10 reactors w/ reaction_frame+evidence,
--                       derived persona_weights, summary, provenance). Read everywhere
--                       on the hot path; never re-derived (P.1 bake-once / P.7 determinism).
--
-- ADDITIVE, NOT a rename (guardrail): the legacy `profile`/`personas` columns + the 4
-- weight cols stay UNTOUCHED so existing consumers + the General-regression gate are
-- byte-stable. The signature supersedes `profile` for new calibrated audiences only;
-- General + presets never carry a signature (gate free by construction, D-17).
--
-- Idempotent (IF NOT EXISTS) — matches the 20260619000000_audiences.sql idiom.
-- DO NOT alter analysis_results, creator_persona_weights, or the weight cols/CHECK.
-- =========================================================================

ALTER TABLE public.audiences
  ADD COLUMN IF NOT EXISTS creator_persona jsonb,
  ADD COLUMN IF NOT EXISTS signature       jsonb;

COMMENT ON COLUMN public.audiences.creator_persona IS
  'PER-AUDIENCE creator card (§P.8): content_description / context / writing_style_sample / format_signature. Auto-derived at calibration from scrape + transcripts + omni-flash watchNotes, editable. NULL for General/presets/legacy rows. Distinct from creator_profiles.writing_voice_sample (profile-level).';

COMMENT ON COLUMN public.audiences.signature IS
  'Frozen AudienceSignature (§P.14): the real, scrape-derived audience model (engagement-derived temperature_mix + 10 reactor personas w/ reaction_frame, interest_tags, what_resonates/falls_flat, derived persona_weights, summary, provenance). Baked ONCE at calibration (temp 0 + seed), read on every skill run, never re-derived on the hot path. NULL for General/presets — the regression gate stays free by construction (D-17).';
