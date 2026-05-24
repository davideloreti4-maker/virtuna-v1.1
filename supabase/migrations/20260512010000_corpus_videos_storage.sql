-- Corpus Videos Storage (Stage 2 of corpus-video persistence flow)
--
-- Adds:
--   1. `corpus-videos` Storage bucket — private, service-role only, mp4-only.
--   2. `training_corpus.video_storage_path` column — points to the bucket object
--      key (e.g. "full.2026-05-11/7635681666480033045.mp4"). NULL until the
--      Stage 2 upload script (scripts/upload-corpus-videos.ts) backfills it.
--
-- Rationale: corpus videos need persistent storage so the eval harness can run
-- in `video_upload` mode (pipeline.ts:236-254) against archived bytes instead
-- of re-fetching from TikTok (slow, fragile — videos go private/get deleted).
-- Stage 1 (download to .planning/videos-cache/) is operator-local. Stage 2
-- mirrors those bytes into Supabase Storage and records the path per row.
--
-- OPERATOR NOTE: Supabase projects default to a 50 MB upload limit at the
-- project level. The largest corpus video is ~66 MB. Raise the project upload
-- limit in the Supabase dashboard (Project Settings → Storage → File upload
-- limit) before running the upload script if the default is still in place.
-- The bucket-level file_size_limit below (200 MB) only constrains uploads
-- ABOVE the project-level cap.

-- =====================================================
-- STORAGE BUCKET — corpus-videos (private)
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'corpus-videos',
  'corpus-videos',
  false,
  209715200, -- 200 MB
  ARRAY['video/mp4']
) ON CONFLICT (id) DO NOTHING;

-- No storage.objects policies for this bucket — service-role only (bypasses RLS).
-- Anon/authenticated reads are denied by default since RLS is enabled on
-- storage.objects and no SELECT policy grants access for bucket_id = 'corpus-videos'.

-- =====================================================
-- TRAINING_CORPUS — add video_storage_path
-- =====================================================
ALTER TABLE training_corpus
  ADD COLUMN IF NOT EXISTS video_storage_path TEXT;

COMMENT ON COLUMN training_corpus.video_storage_path IS
  'Object key inside the corpus-videos Storage bucket. Format: ${corpus_version}/${platform_video_id}.mp4. NULL when the video could not be downloaded (TikTok deletion/region lock) or has not yet been uploaded by scripts/upload-corpus-videos.ts.';
