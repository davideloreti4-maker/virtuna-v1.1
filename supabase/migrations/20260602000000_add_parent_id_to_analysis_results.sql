-- Phase: Viral Remix (v3.2) — Plan 05-01
-- Adds the `parent_id` column to analysis_results for remix lineage tracking.
-- Nullable FK: points to the source remix analysis a developed child was created from (D-07/D-08).
-- Null for all ordinary score analyses; no backfill needed (historical rows stay null).
-- ON DELETE SET NULL: deleting a source row nulls the child pointer instead of erroring (referential integrity, D-08).
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS parent_id TEXT NULL REFERENCES public.analysis_results(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.analysis_results.parent_id IS
  'Nullable lineage pointer to the source remix analysis a developed child was created from (D-07/D-08). Null for all ordinary analyses (score or remix). Set at insert time when a creator clicks "Develop & predict" on an Adapt concept; the value is the id of the parent remix analysis row. No backfill — all historical rows are null. FK with ON DELETE SET NULL ensures deleting a source row does not orphan-error the child.';
