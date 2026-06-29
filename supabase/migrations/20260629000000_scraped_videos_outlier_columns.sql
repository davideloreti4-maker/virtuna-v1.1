-- =========================================================================
-- Discover Feed Phase 1.1 — per-channel ingest outlier columns (scraped_videos)
--
-- ADD the three measured-signal columns the unified Videos feed filters/sorts on
-- (DISCOVER-FEED-PLAN Architecture decision 2). At per-channel ingest
-- (POST /api/channels/ingest) we compute these ONCE and store them on the row, so
-- the feed's score / engagement filters become plain WHEREs instead of per-request
-- arithmetic.
--
--   outlier_multiplier — views / channel-median-views (the "{n}×" badge value).
--                        MEASURED engagement arithmetic, NEVER a SIM score.
--   baseline_label     — the honest baseline the multiplier is measured "vs":
--                        'vs own' for a single-channel ingest, 'vs niche' for a
--                        corpus/niche pull. Mirrors RankedOutlier.baselineLabel.
--   engagement_rate    — (likes + comments + shares) / views, in [0, ~].
--
-- All three are NULLABLE + additive: existing trending rows (cron/webhook) keep
-- NULL until a later backfill, and no main-branch reader references them, so this
-- is fully backward-compatible. Idempotent (IF NOT EXISTS) — re-running is a no-op.
-- =========================================================================

ALTER TABLE public.scraped_videos
  ADD COLUMN IF NOT EXISTS outlier_multiplier NUMERIC,
  ADD COLUMN IF NOT EXISTS baseline_label     TEXT,
  ADD COLUMN IF NOT EXISTS engagement_rate    NUMERIC;

-- Honest-label guard: the multiplier baseline is only ever 'vs own' | 'vs niche'
-- (NULL allowed for un-scored rows). Wrapped so the migration stays idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scraped_videos_baseline_label_chk'
  ) THEN
    ALTER TABLE public.scraped_videos
      ADD CONSTRAINT scraped_videos_baseline_label_chk
      CHECK (baseline_label IS NULL OR baseline_label IN ('vs own', 'vs niche'));
  END IF;
END $$;

COMMENT ON COLUMN public.scraped_videos.outlier_multiplier IS
  'views / baseline-median-views — the measured "{n}x" outlier badge value (NOT a SIM score). Computed once at per-channel ingest. NULL for un-scored (legacy trending) rows.';
COMMENT ON COLUMN public.scraped_videos.baseline_label IS
  'Honest baseline the multiplier is measured against: ''vs own'' (single-channel ingest) | ''vs niche'' (corpus/niche pull). NULL when un-scored.';
COMMENT ON COLUMN public.scraped_videos.engagement_rate IS
  '(likes + comments + shares) / views, in [0, ~]. Computed once at per-channel ingest. NULL for un-scored rows.';

-- Feed read paths (Phase 2): the watched tab joins on creator_handle; the outlier
-- filter/sort reads outlier_multiplier desc. NULLS LAST keeps un-scored rows out of
-- the hot path for the score-ranked view.
CREATE INDEX IF NOT EXISTS idx_scraped_videos_creator_handle
  ON public.scraped_videos (creator_handle);
CREATE INDEX IF NOT EXISTS idx_scraped_videos_outlier_multiplier
  ON public.scraped_videos (outlier_multiplier DESC NULLS LAST);
