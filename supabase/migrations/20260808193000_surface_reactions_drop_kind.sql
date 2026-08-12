-- =========================================================================
-- v8 Phase 2 (the shelf): the daily-surface cache learns a third section.
-- surface_reactions.kind gains 'drop' — the six pre-scored remix-first drop
-- cards on the v8 /home arrival (one cached batch per user × audience × day,
-- same TTL + upsert machinery as 'outlier'/'idea'). Additive-only: existing
-- rows and both existing kinds are untouched.
-- Applied via the SQL editor path (ledger drift — db push is unsafe here).
-- =========================================================================
ALTER TABLE public.surface_reactions
  DROP CONSTRAINT surface_reactions_kind_check;
ALTER TABLE public.surface_reactions
  ADD CONSTRAINT surface_reactions_kind_check
  CHECK (kind IN ('outlier', 'idea', 'drop'));
