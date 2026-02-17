-- competitor_intelligence: caches AI-generated analysis results per competitor
-- Analysis types: strategy (DeepSeek), viral (Gemini), hashtag_gap (Gemini), recommendations (DeepSeek)

CREATE TABLE competitor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('strategy', 'viral', 'hashtag_gap', 'recommendations')),
  insights JSONB NOT NULL,
  model_used TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, analysis_type, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE INDEX idx_intelligence_competitor_type ON competitor_intelligence(competitor_id, analysis_type);

-- RLS: visible if user tracks the competitor (matches competitor_snapshots/videos pattern)
ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence for tracked competitors"
  ON competitor_intelligence FOR SELECT
  TO authenticated
  USING (competitor_id IN (
    SELECT competitor_id FROM user_competitors WHERE user_id = (SELECT auth.uid())
  ));
