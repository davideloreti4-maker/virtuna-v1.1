-- v2 Prediction Engine Schema Expansion
-- Adds behavioral predictions, feature vector, reasoning, and input mode tracking
-- to analysis_results. Adds evaluation tier and contribution tracking to rule_library.
-- All statements use IF NOT EXISTS for idempotent re-runs.

-- =====================================================
-- ANALYSIS RESULTS — 7 new columns for v2 prediction outputs
-- =====================================================

-- Behavioral predictions (completion_pct, share_pct, comment_pct, save_pct with percentiles)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS behavioral_predictions JSONB;

-- Feature vector — 26-signal backbone consumed by aggregator
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS feature_vector JSONB;

-- DeepSeek reasoning text (CoT output)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- Fatal flaw warnings from DeepSeek Step 4
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS warnings TEXT[] DEFAULT '{}';

-- Input mode discriminator (text, tiktok_url, video_upload)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS input_mode TEXT DEFAULT 'text' CHECK (input_mode IN ('text', 'tiktok_url', 'video_upload'));

-- Whether analysis included video content
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Gemini's contribution score for scoring breakdown
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS gemini_score NUMERIC(5,2);

-- =====================================================
-- RULE LIBRARY — 2 new columns for hybrid rule evaluation
-- =====================================================

-- Rule evaluation tier for hybrid rules (Phase 9: regex or semantic)
ALTER TABLE rule_library ADD COLUMN IF NOT EXISTS evaluation_tier TEXT DEFAULT 'regex' CHECK (evaluation_tier IN ('regex', 'semantic'));

-- Per-rule accuracy tracking (Phase 9: contribution metrics)
ALTER TABLE rule_library ADD COLUMN IF NOT EXISTS rule_contributions JSONB DEFAULT '{}';

-- =====================================================
-- NEW INDEXES for v2 query patterns
-- =====================================================

-- Index for filtering analyses by input mode
CREATE INDEX IF NOT EXISTS idx_analysis_results_input_mode ON analysis_results(input_mode) WHERE deleted_at IS NULL;

-- Index for video analyses (partial — only rows with video)
CREATE INDEX IF NOT EXISTS idx_analysis_results_has_video ON analysis_results(has_video) WHERE has_video = true AND deleted_at IS NULL;

-- Index for rule evaluation tier (partial — only active rules)
CREATE INDEX IF NOT EXISTS idx_rule_library_evaluation_tier ON rule_library(evaluation_tier) WHERE is_active = true;

-- =====================================================
-- EXPAND content_type CHECK constraint to include 'tiktok'
-- =====================================================

-- Drop existing constraint (safe — IF EXISTS)
ALTER TABLE analysis_results DROP CONSTRAINT IF EXISTS analysis_results_content_type_check;

-- Re-create with 'tiktok' added
ALTER TABLE analysis_results ADD CONSTRAINT analysis_results_content_type_check
  CHECK (content_type IN ('post', 'reel', 'story', 'video', 'thread', 'tiktok'));
