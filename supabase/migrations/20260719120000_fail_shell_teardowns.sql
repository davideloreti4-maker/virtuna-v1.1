-- Shell-row guard (2026-07-19)
--
-- The sandcastles-import-v1 batch carried 8 rows whose source video had no
-- analysis upstream (raw teardown->>'failure_reason' is set). They imported as
-- "shells": embedding present + full raw teardown, but NULL across every
-- extracted field (spoken_hook, idea, why_it_works, template, facets).
--
-- Because they were written with status='extracted', the retrieval RPCs
-- (match_shared_teardowns / match_personal_teardowns gate on
-- status IN ('extracted','watched')) could return them from vector search as
-- content-free ghosts: similarity hit, nothing to render, no receipt.
--
-- Fix: mark them 'failed' (already in the status CHECK). Zero code changes —
-- the existing RPC gate excludes them. Idempotent: the status='extracted'
-- predicate makes re-runs touch 0 rows.
--
-- Verified pre-migration: exactly 8 rows match all predicates below, and the
-- same 8 are the only rows with a non-empty raw failure_reason.

UPDATE public.outlier_teardowns
SET status = 'failed'
WHERE source_pool = 'curated'
  AND status = 'extracted'
  AND spoken_hook IS NULL
  AND idea IS NULL
  AND why_it_works IS NULL
  AND nullif(teardown->>'failure_reason', '') IS NOT NULL;
