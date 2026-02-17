-- Content Intelligence Platform Schema
-- Tables: scraped_videos, trending_sounds, analysis_results, outcomes, rule_library, usage_tracking
-- RLS uses (SELECT auth.uid()) pattern for performance
-- Status fields use TEXT + CHECK (not ENUM) for flexibility

-- =====================================================
-- SHARED TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCRAPED VIDEOS (Apify pipeline output)
-- =====================================================
CREATE TABLE scraped_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  author TEXT,
  author_url TEXT,
  description TEXT,
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  sound_name TEXT,
  sound_url TEXT,
  hashtags TEXT[] DEFAULT '{}',
  category TEXT,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_video_id)
);

CREATE INDEX idx_scraped_videos_category ON scraped_videos(category);
CREATE INDEX idx_scraped_videos_platform ON scraped_videos(platform);
CREATE INDEX idx_scraped_videos_created_at ON scraped_videos(created_at DESC);
CREATE INDEX idx_scraped_videos_non_archived ON scraped_videos(created_at DESC) WHERE archived_at IS NULL;

CREATE TRIGGER scraped_videos_updated_at
  BEFORE UPDATE ON scraped_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRENDING SOUNDS (aggregated from scraped_videos)
-- =====================================================
CREATE TABLE trending_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sound_name TEXT NOT NULL UNIQUE,
  sound_url TEXT,
  video_count INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  growth_rate NUMERIC(10,4) DEFAULT 0,
  velocity_score NUMERIC(10,4) DEFAULT 0,
  trend_phase TEXT CHECK (trend_phase IN ('emerging', 'rising', 'peak', 'declining')),
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trending_sounds_velocity ON trending_sounds(velocity_score DESC);
CREATE INDEX idx_trending_sounds_trend_phase ON trending_sounds(trend_phase);

CREATE TRIGGER trending_sounds_updated_at
  BEFORE UPDATE ON trending_sounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ANALYSIS RESULTS (user analysis output)
-- =====================================================
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reel', 'story', 'video', 'thread')),
  society_id TEXT,
  overall_score NUMERIC(5,2),
  confidence NUMERIC(5,4),
  factors JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  personas JSONB DEFAULT '[]',
  variants JSONB DEFAULT '[]',
  insights TEXT,
  conversation_themes JSONB DEFAULT '[]',
  gemini_model TEXT,
  deepseek_model TEXT,
  engine_version TEXT,
  latency_ms INTEGER,
  cost_cents NUMERIC(10,4),
  rule_score NUMERIC(5,2),
  trend_score NUMERIC(5,2),
  ml_score NUMERIC(5,2),
  score_weights JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_user_id ON analysis_results(user_id);
CREATE INDEX idx_analysis_results_created_at ON analysis_results(user_id, created_at DESC);
CREATE INDEX idx_analysis_results_non_deleted ON analysis_results(user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER analysis_results_updated_at
  BEFORE UPDATE ON analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- OUTCOMES (actual performance vs predicted)
-- =====================================================
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analysis_results(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actual_views BIGINT,
  actual_likes BIGINT,
  actual_shares BIGINT,
  actual_engagement_rate NUMERIC(10,6),
  predicted_score NUMERIC(5,2),
  actual_score NUMERIC(5,2),
  delta NUMERIC(5,2),
  platform TEXT,
  platform_post_url TEXT,
  deleted_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outcomes_user_id ON outcomes(user_id);
CREATE INDEX idx_outcomes_analysis_id ON outcomes(analysis_id);

CREATE TRIGGER outcomes_updated_at
  BEFORE UPDATE ON outcomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RULE LIBRARY (scoring rules for content analysis)
-- =====================================================
CREATE TABLE rule_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('hook', 'retention', 'platform', 'audio', 'text', 'timing', 'creator')),
  pattern TEXT,
  score_modifier INTEGER,
  platform TEXT,
  evaluation_prompt TEXT,
  weight NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  accuracy_rate NUMERIC(5,4),
  sample_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rule_library_category ON rule_library(category);
CREATE INDEX idx_rule_library_active ON rule_library(is_active) WHERE is_active = true;

CREATE TRIGGER rule_library_updated_at
  BEFORE UPDATE ON rule_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- USAGE TRACKING (tier-gated analysis limits)
-- =====================================================
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'monthly')),
  analysis_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period_start, period_type)
);

CREATE INDEX idx_usage_tracking_user_period ON usage_tracking(user_id, period_start, period_type);

CREATE TRIGGER usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- Using (SELECT auth.uid()) wrapper for performance
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE scraped_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- scraped_videos: Public read for non-archived videos (writes via service role only)
CREATE POLICY "Anyone can view non-archived scraped videos"
  ON scraped_videos FOR SELECT
  USING (archived_at IS NULL);

-- trending_sounds: Public read (writes via service role only)
CREATE POLICY "Anyone can view trending sounds"
  ON trending_sounds FOR SELECT
  USING (true);

-- analysis_results: User-scoped read/write
CREATE POLICY "Users can view their own non-deleted analysis results"
  ON analysis_results FOR SELECT
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own analysis results"
  ON analysis_results FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own analysis results"
  ON analysis_results FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- outcomes: User-scoped read/write
CREATE POLICY "Users can view their own non-deleted outcomes"
  ON outcomes FOR SELECT
  USING (user_id = (SELECT auth.uid()) AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own outcomes"
  ON outcomes FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own outcomes"
  ON outcomes FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- rule_library: Public read for active rules only (writes via service role only)
CREATE POLICY "Anyone can view active rules"
  ON rule_library FOR SELECT
  USING (is_active = true);

-- usage_tracking: User-scoped read (writes via service role only)
CREATE POLICY "Users can view their own usage"
  ON usage_tracking FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- =====================================================
-- ADD UPDATED_AT TRIGGER TO EXISTING TABLES
-- =====================================================

-- user_subscriptions has updated_at column but no trigger
CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
