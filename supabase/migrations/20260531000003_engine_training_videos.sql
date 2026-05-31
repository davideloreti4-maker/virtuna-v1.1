-- =========================================================================
-- 1:1 E2E learning loop — engine_training_videos
-- Created: 2026-05-31
--
-- INTENT (replaces reliance on `training_corpus`, which feeds the engine CAPTION
-- TEXT only — a different engine than users hit, hence untrusted):
--   Scrape real social videos as RAW FILES, run each through the EXACT SAME
--   end-to-end path a user experiences (input_mode='video_upload' →
--   runPredictionPipeline: full vision + audio + personas + rules), capture the
--   engine's BLIND content feature_vector, and verify it against the REAL
--   performance the video actually achieved. The (blind feature_vector → real
--   outcome) pairs are the honest, inference-valid training set.
--
-- WHY A NEW TABLE, NOT training_corpus columns:
--   training_corpus is a text/metadata proxy whose data quality is distrusted.
--   This loop is video-file-native and 1:1 with production inference; it gets a
--   clean home so its quality bar is independent.
--
-- STALENESS DISCIPLINE: label off PERCENTILE-WITHIN-NICHE, never absolute views.
--   real_views is kept for the percentile computation + audit, never as a label.
--
-- Additive + idempotent. RLS: service-role only (system data, no user_id).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.engine_training_videos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ---- provenance / dedup ----
  platform              TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id     TEXT NOT NULL,
  video_url             TEXT,
  creator_handle        TEXT,
  posted_at             TIMESTAMPTZ,
  scraped_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ---- the raw video file (1:1 with user video_upload mode) ----
  -- Stored in the SAME `videos` bucket the pipeline reads (pipeline.ts:499
  -- `storage.from("videos")`), under a `training/` prefix — e.g.
  -- "training/<platform_video_id>.mp4". This guarantees the engine downloads it
  -- byte-identically to a real user upload; a separate bucket would not be read.
  video_storage_path    TEXT,
  duration_seconds      INTEGER,

  -- ---- niche ----
  society_id            TEXT,                 -- niche bucket (aligns with analysis_results.society_id)
  niche                 TEXT,

  -- ---- REAL outcome (ground truth, scraped from the platform) ----
  real_views            BIGINT,
  real_likes            BIGINT,
  real_comments         BIGINT,
  real_shares           BIGINT,
  real_saves            BIGINT,
  real_completion_pct   NUMERIC(5,2),
  follower_count        BIGINT,
  real_percentile       NUMERIC(5,2),         -- views percentile within (niche, cohort) — the label basis
  real_bucket           TEXT
    CHECK (real_bucket IS NULL OR real_bucket IN ('viral', 'average', 'under')),

  -- ---- ENGINE prediction (BLIND 1:1 E2E run on the raw file) ----
  engine_feature_vector JSONB,                -- content-derived FeatureVector from the pipeline
  engine_overall_score  NUMERIC(5,2),         -- 0-100
  engine_predicted_bucket TEXT
    CHECK (engine_predicted_bucket IS NULL OR engine_predicted_bucket IN ('viral', 'average', 'under')),
  engine_prediction     JSONB,                -- optional full PredictionResult snapshot (audit)
  engine_version        TEXT,
  engine_evaluated_at   TIMESTAMPTZ,

  -- ---- derived training signal ----
  prediction_error      NUMERIC(6,3),         -- |engine_percentile - real_percentile| or bucket distance
  bucket_match          BOOLEAN,              -- engine_predicted_bucket == real_bucket
  status                TEXT NOT NULL DEFAULT 'scraped',
                          -- 'scraped' | 'predicted' | 'labeled' | 'failed'

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (platform, platform_video_id)
);

-- Predict sweep: rows scraped but not yet run through the engine.
CREATE INDEX IF NOT EXISTS engine_training_videos_scraped_idx
  ON public.engine_training_videos (scraped_at)
  WHERE status = 'scraped';

-- Retrain read path: labeled rows by niche.
CREATE INDEX IF NOT EXISTS engine_training_videos_labeled_idx
  ON public.engine_training_videos (society_id, engine_evaluated_at)
  WHERE status = 'labeled';

-- updated_at trigger (reuses the shared function from training_corpus migration).
DROP TRIGGER IF EXISTS engine_training_videos_updated_at ON public.engine_training_videos;
CREATE TRIGGER engine_training_videos_updated_at
  BEFORE UPDATE ON public.engine_training_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---- RLS: service-role only (training infra; no user-owned rows) ----
ALTER TABLE public.engine_training_videos ENABLE ROW LEVEL SECURITY;
-- No policies → anon + authenticated denied; service role (cron/CLI) bypasses RLS.

COMMENT ON TABLE public.engine_training_videos IS
  '1:1 E2E learning loop. Raw social videos run through the exact production pipeline (video_upload mode) BLIND, paired with real platform outcomes. Train on engine_feature_vector → real_bucket. Distinct from text-proxy training_corpus.';

-- =========================================================================
-- Storage: REUSE the existing private `videos` bucket (the one user uploads +
-- the pipeline already use). Training videos go under the `training/` prefix.
-- No new bucket — co-locating in `videos` is exactly what makes the run 1:1.
-- Service role (ingest/predict cron) writes; the pipeline reads via service role.
-- =========================================================================
