-- Whop subscription tracking table
-- Links Supabase users to Whop memberships and manages tier state

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  -- Whop linkage (set via webhook metadata)
  whop_user_id TEXT,
  whop_membership_id TEXT,
  whop_product_id TEXT,
  -- Tier state
  virtuna_tier TEXT NOT NULL DEFAULT 'free' CHECK (virtuna_tier IN ('free', 'starter', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  current_period_end TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_user_subscriptions_whop_user_id ON user_subscriptions(whop_user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

-- RLS: users read own, server writes via service role
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (user_id = (SELECT auth.uid()));
