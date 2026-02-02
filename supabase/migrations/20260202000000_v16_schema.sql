-- v1.6 Brand Deals & Affiliate Hub Schema
-- All money amounts stored as INTEGER (cents)
-- Status fields use TEXT + CHECK (not ENUM) for flexibility
-- RLS uses (SELECT auth.uid()) pattern for 94%+ performance improvement

-- =====================================================
-- CREATOR PROFILES
-- =====================================================
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  -- Social handles
  tiktok_handle TEXT,
  instagram_handle TEXT,
  youtube_handle TEXT,
  twitter_handle TEXT,
  -- Follower counts
  tiktok_followers INTEGER DEFAULT 0,
  instagram_followers INTEGER DEFAULT 0,
  youtube_subscribers INTEGER DEFAULT 0,
  twitter_followers INTEGER DEFAULT 0,
  -- Engagement and niches
  engagement_rate NUMERIC(5,2),
  niches TEXT[] DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_creator_profiles_user_id ON creator_profiles(user_id);

-- =====================================================
-- DEALS
-- =====================================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Brand info
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  brand_category TEXT,
  -- Deal details
  title TEXT NOT NULL,
  description TEXT,
  -- Compensation (cents for amounts)
  compensation_type TEXT NOT NULL CHECK (compensation_type IN ('fixed', 'rev_share', 'hybrid')),
  compensation_fixed_cents INTEGER,
  compensation_rev_share_percent NUMERIC(5,2),
  -- Requirements
  min_followers INTEGER DEFAULT 0,
  min_engagement_rate NUMERIC(5,2),
  required_platforms TEXT[] DEFAULT '{}',
  required_niches TEXT[] DEFAULT '{}',
  -- Deliverables
  content_count INTEGER DEFAULT 1,
  content_types TEXT[] DEFAULT '{}',
  deadline_days INTEGER,
  -- Access control
  tier_required TEXT NOT NULL DEFAULT 'starter' CHECK (tier_required IN ('starter', 'pro')),
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived')),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_tier ON deals(tier_required);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- =====================================================
-- DEAL ENROLLMENTS
-- =====================================================
CREATE TABLE deal_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'accepted', 'rejected', 'active', 'completed', 'cancelled')),
  application_note TEXT,
  deliverables_completed INTEGER DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- One application per creator per deal
  UNIQUE(deal_id, user_id)
);

CREATE INDEX idx_deal_enrollments_deal_id ON deal_enrollments(deal_id);
CREATE INDEX idx_deal_enrollments_user_id ON deal_enrollments(user_id);
CREATE INDEX idx_deal_enrollments_status ON deal_enrollments(status);

-- =====================================================
-- WALLET TRANSACTIONS (IMMUTABLE LEDGER)
-- =====================================================
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- Transaction details (positive = credit, negative = debit)
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deal_payment', 'affiliate_commission', 'withdrawal', 'adjustment')),
  -- Balance snapshot (immutable ledger pattern)
  balance_after_cents INTEGER NOT NULL,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  -- Reference to source
  reference_type TEXT CHECK (reference_type IN ('deal_enrollment', 'affiliate_conversion', 'manual')),
  reference_id UUID,
  -- Additional info
  description TEXT,
  metadata JSONB,
  -- Timestamp (NO updated_at - ledger is immutable)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);

-- Immutability trigger: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_wallet_transaction_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions table is immutable. UPDATE and DELETE operations are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_transactions_immutable
  BEFORE UPDATE OR DELETE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_wallet_transaction_mutation();

-- =====================================================
-- AFFILIATE CLICKS
-- =====================================================
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  link_code TEXT NOT NULL,
  -- Click metadata
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  -- Device info
  device_type TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX idx_affiliate_clicks_creator_id ON affiliate_clicks(creator_id);
CREATE INDEX idx_affiliate_clicks_program_id ON affiliate_clicks(program_id);
CREATE INDEX idx_affiliate_clicks_link_code ON affiliate_clicks(link_code);
CREATE INDEX idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at DESC);

-- =====================================================
-- AFFILIATE CONVERSIONS
-- =====================================================
CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id UUID REFERENCES affiliate_clicks(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL,
  -- Conversion details
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('signup', 'purchase', 'subscription')),
  conversion_value_cents INTEGER NOT NULL,
  commission_cents INTEGER NOT NULL,
  -- Timestamps
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  attributed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Additional data
  metadata JSONB
);

CREATE INDEX idx_affiliate_conversions_creator_id ON affiliate_conversions(creator_id);
CREATE INDEX idx_affiliate_conversions_click_id ON affiliate_conversions(click_id);
CREATE INDEX idx_affiliate_conversions_converted_at ON affiliate_conversions(converted_at DESC);
