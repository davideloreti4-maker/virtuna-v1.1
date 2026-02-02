# Architecture Research: Brand Deals & Affiliate Hub

**Project:** Virtuna v1.6 — Creator Monetization Hub
**Researched:** 2026-02-02
**Confidence:** HIGH (existing patterns clear, integration points well-defined)

## Executive Summary

The Brand Deals & Affiliate Hub integrates cleanly with Virtuna's existing architecture. The app already uses:
- **Zustand stores** for client-side state with localStorage persistence
- **Supabase** for authentication (ready to extend to database)
- **Component-first architecture** with clear separation (`/components/app/`, `/components/ui/`)
- **TypeScript strict mode** throughout

The new features (Wallet, Deal Marketplace, Levels, Affiliate Tracking) follow these same patterns. The primary architectural decision is **where data lives**: Zustand + localStorage for fast UI state vs. Supabase for persistent, cross-device, server-authoritative data.

**Recommendation:** Use Supabase as the source of truth for all monetization features. Zustand stores cache data locally and sync with Supabase, following the pattern established in the GitHub discussion on [Zustand with Supabase](https://github.com/pmndrs/zustand/discussions/2284).

---

## Database Schema

### Core Tables

```sql
-- Creator profile extension (links to auth.users)
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Level system
  current_level INTEGER DEFAULT 1,
  current_xp INTEGER DEFAULT 0,
  lifetime_xp INTEGER DEFAULT 0,

  -- Metrics that feed into levels
  total_followers INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,4) DEFAULT 0,
  content_quality_score INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Level definitions (static reference table)
CREATE TABLE levels (
  level INTEGER PRIMARY KEY,
  name TEXT NOT NULL,              -- e.g., "Rising Star", "Established Creator"
  xp_required INTEGER NOT NULL,    -- XP threshold to reach this level
  tier_access TEXT NOT NULL,       -- 'starter' | 'pro' | 'premium'
  perks JSONB DEFAULT '[]'         -- Array of perk descriptions
);

-- Deals (both aggregated and Virtuna-native)
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Deal identity
  source TEXT NOT NULL,            -- 'virtuna' | 'external_network_name'
  external_id TEXT,                -- ID from external source if aggregated

  -- Brand info
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  brand_category TEXT,             -- e.g., 'fashion', 'tech', 'beauty'

  -- Deal details
  title TEXT NOT NULL,
  description TEXT,
  tier TEXT NOT NULL,              -- 'starter' | 'pro' | 'premium'
  deal_type TEXT NOT NULL,         -- 'affiliate' | 'rev_share' | 'fixed_pay'

  -- Compensation
  commission_rate DECIMAL(5,2),    -- Percentage for affiliate/rev_share
  fixed_amount DECIMAL(10,2),      -- Fixed pay amount if applicable
  product_included BOOLEAN DEFAULT false,

  -- Requirements
  min_level INTEGER DEFAULT 1,
  min_followers INTEGER DEFAULT 0,
  min_engagement_rate DECIMAL(5,4) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active',    -- 'active' | 'paused' | 'expired'
  featured BOOLEAN DEFAULT false,  -- Show at top of marketplace

  -- Tracking
  affiliate_base_url TEXT,         -- Base URL for generating affiliate links

  -- Timestamps
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creator deal applications/enrollments
CREATE TABLE deal_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected' | 'active'

  -- Generated affiliate link for this creator
  affiliate_link TEXT,
  affiliate_code TEXT UNIQUE,      -- Short code for tracking

  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,

  UNIQUE(creator_id, deal_id)
);

-- Click tracking
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES deal_enrollments(id) ON DELETE CASCADE,

  -- Click metadata
  click_id TEXT UNIQUE NOT NULL,   -- Unique identifier for attribution
  ip_hash TEXT,                    -- Hashed IP for deduplication
  user_agent TEXT,
  referrer TEXT,

  -- Attribution window
  clicked_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ           -- When attribution window ends
);

-- Conversions
CREATE TABLE conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id TEXT REFERENCES affiliate_clicks(click_id),
  enrollment_id UUID REFERENCES deal_enrollments(id),

  -- Conversion details
  order_id TEXT,                   -- External order ID
  order_amount DECIMAL(10,2),
  commission_amount DECIMAL(10,2) NOT NULL,

  -- Status
  status TEXT DEFAULT 'pending',   -- 'pending' | 'approved' | 'paid' | 'rejected'

  converted_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ
);

-- Wallet transactions (earnings history)
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,

  -- Transaction details
  type TEXT NOT NULL,              -- 'earning' | 'payout' | 'adjustment'
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Source reference
  source_type TEXT,                -- 'conversion' | 'bonus' | 'payout'
  source_id UUID,                  -- Reference to conversion/payout

  description TEXT,

  -- Balance snapshot
  balance_after DECIMAL(10,2) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payouts
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,

  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  method TEXT,                     -- 'stripe' | 'paypal' | 'bank'

  status TEXT DEFAULT 'pending',   -- 'pending' | 'processing' | 'completed' | 'failed'

  -- External reference
  external_payout_id TEXT,

  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- XP events (for level progression)
CREATE TABLE xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,        -- 'deal_completed' | 'milestone' | 'bonus'
  xp_amount INTEGER NOT NULL,
  description TEXT,

  -- Reference to what triggered XP
  source_type TEXT,
  source_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes for Performance

```sql
-- Deal queries
CREATE INDEX idx_deals_tier ON deals(tier);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_featured ON deals(featured) WHERE featured = true;

-- Enrollment lookups
CREATE INDEX idx_enrollments_creator ON deal_enrollments(creator_id);
CREATE INDEX idx_enrollments_status ON deal_enrollments(status);

-- Click attribution
CREATE INDEX idx_clicks_click_id ON affiliate_clicks(click_id);
CREATE INDEX idx_clicks_expires ON affiliate_clicks(expires_at);

-- Wallet queries
CREATE INDEX idx_transactions_creator ON wallet_transactions(creator_id);
CREATE INDEX idx_transactions_created ON wallet_transactions(created_at DESC);

-- Level queries
CREATE INDEX idx_profiles_level ON creator_profiles(current_level);
```

### Row-Level Security (RLS)

```sql
-- Creators can only see their own profile
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_profile_self ON creator_profiles
  FOR ALL USING (user_id = auth.uid());

-- Deals are public to read
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_public_read ON deals
  FOR SELECT USING (status = 'active');

-- Enrollments only visible to owner
ALTER TABLE deal_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrollments_self ON deal_enrollments
  FOR ALL USING (creator_id IN (
    SELECT id FROM creator_profiles WHERE user_id = auth.uid()
  ));

-- Transactions only visible to owner
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_self ON wallet_transactions
  FOR ALL USING (creator_id IN (
    SELECT id FROM creator_profiles WHERE user_id = auth.uid()
  ));
```

---

## Component Architecture

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **WalletDashboard** | `components/app/wallet/wallet-dashboard.tsx` | Main wallet view with balance, charts |
| **TransactionList** | `components/app/wallet/transaction-list.tsx` | Scrollable transaction history |
| **TransactionItem** | `components/app/wallet/transaction-item.tsx` | Single transaction row |
| **BalanceCard** | `components/app/wallet/balance-card.tsx` | Current balance display |
| **EarningsChart** | `components/app/wallet/earnings-chart.tsx` | Time-series earnings visualization |
| **DealsMarketplace** | `components/app/deals/deals-marketplace.tsx` | Main deals browsing view |
| **DealCard** | `components/app/deals/deal-card.tsx` | Single deal display |
| **DealFilters** | `components/app/deals/deal-filters.tsx` | Tier, category, status filters |
| **DealDetail** | `components/app/deals/deal-detail.tsx` | Full deal view with apply action |
| **TierBadge** | `components/app/deals/tier-badge.tsx` | Premium/Pro/Starter indicator |
| **LevelProgress** | `components/app/levels/level-progress.tsx` | XP bar and level display |
| **LevelCard** | `components/app/levels/level-card.tsx` | Current level with perks |
| **LevelRoadmap** | `components/app/levels/level-roadmap.tsx` | All levels with unlock status |
| **AffiliateLink** | `components/app/affiliate/affiliate-link.tsx` | Copy-able link display |
| **ClickStats** | `components/app/affiliate/click-stats.tsx` | Click/conversion metrics |

### Modified Components

| Component | Modification |
|-----------|--------------|
| **Sidebar** | Add Wallet, Deals, Levels nav items |
| **AppShell** | Add routes for new pages |
| **SettingsPage** | Add Payouts section with payout method config |

### New Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard/wallet` | WalletDashboard | Earnings view |
| `/dashboard/deals` | DealsMarketplace | Browse/apply to deals |
| `/dashboard/deals/[id]` | DealDetail | Single deal view |
| `/dashboard/levels` | LevelRoadmap | Progression overview |

### New Stores

```typescript
// src/stores/wallet-store.ts
interface WalletState {
  balance: number;
  pendingEarnings: number;
  transactions: Transaction[];
  isLoading: boolean;

  // Actions
  fetchTransactions: () => Promise<void>;
  requestPayout: (amount: number) => Promise<void>;
}

// src/stores/deals-store.ts
interface DealsState {
  deals: Deal[];
  enrollments: Enrollment[];
  filters: DealFilters;
  isLoading: boolean;

  // Actions
  fetchDeals: () => Promise<void>;
  applyToDeal: (dealId: string) => Promise<void>;
  setFilters: (filters: Partial<DealFilters>) => void;
}

// src/stores/level-store.ts
interface LevelState {
  currentLevel: number;
  currentXP: number;
  xpToNextLevel: number;
  tierAccess: 'starter' | 'pro' | 'premium';
  levels: Level[];

  // Actions
  fetchProgress: () => Promise<void>;
}
```

---

## Data Flow

### Deal Aggregation Flow

```
External Sources (Cron Job)
         |
         v
+------------------+
| Vercel Cron Job  |  <-- Runs daily via vercel.json
| /api/cron/deals  |
+------------------+
         |
         | 1. Fetch from affiliate networks (API/scrape)
         | 2. Normalize to Deal schema
         | 3. Upsert to Supabase
         v
+------------------+
| Supabase: deals  |
+------------------+
         |
         | Zustand fetches on mount
         v
+------------------+
| deals-store.ts   |  <-- Caches in memory
+------------------+
         |
         v
+------------------+
| DealsMarketplace |  <-- Renders with filters
+------------------+
```

### Affiliate Click Tracking Flow

```
Creator shares link: https://virtuna.io/go/ABC123
                              |
                              v
+---------------------------+
| /api/affiliate/[code]     |  <-- API route
+---------------------------+
         |
         | 1. Generate unique click_id
         | 2. Record click in affiliate_clicks
         | 3. Set attribution cookie (30 days)
         | 4. Redirect to brand URL with click_id
         v
+---------------------------+
| Brand Website             |
+---------------------------+
         |
         | User converts (purchase)
         | Brand sends webhook/postback
         v
+---------------------------+
| /api/webhooks/conversion  |  <-- Receives conversion
+---------------------------+
         |
         | 1. Look up click_id
         | 2. Create conversion record
         | 3. Calculate commission
         | 4. Add to pending earnings
         | 5. Grant XP
         v
+---------------------------+
| Supabase: conversions     |
| Supabase: wallet_trans    |
| Supabase: xp_events       |
+---------------------------+
```

### Level Progression Flow

```
XP-granting events:
- Conversion approved
- First deal completed
- Milestones (10, 50, 100 conversions)
         |
         v
+---------------------------+
| xp_events table           |  <-- Record XP grant
+---------------------------+
         |
         | Supabase trigger or API
         v
+---------------------------+
| UPDATE creator_profiles   |  <-- Add XP, check level up
| SET current_xp = ...      |
+---------------------------+
         |
         | Real-time subscription
         v
+---------------------------+
| level-store.ts            |  <-- Updates UI
+---------------------------+
         |
         v
+---------------------------+
| LevelProgress component   |  <-- Shows animation if level up
+---------------------------+
```

### Wallet Sync Flow

```
+---------------------------+
| Supabase: wallet_trans    |  <-- Source of truth
+---------------------------+
         |
         | 1. Initial fetch on mount
         | 2. Real-time subscription for updates
         v
+---------------------------+
| wallet-store.ts           |  <-- Zustand cache
+---------------------------+
         |
         | Selector pattern
         v
+---------------------------+
| WalletDashboard           |  <-- Renders current state
| TransactionList           |
+---------------------------+
```

---

## Integration Points

### Existing Systems

| System | Integration Point | How |
|--------|-------------------|-----|
| **Auth (Supabase)** | User identity | `auth.uid()` in RLS, creator_profiles links to auth.users |
| **Settings Store** | Payout preferences | Add payout method to settings |
| **Sidebar** | Navigation | Add Wallet, Deals, Levels nav items |
| **AppShell** | Routing | Add new page routes |

### External Services

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **Affiliate Networks** | Deal aggregation | API calls from cron job |
| **Stripe Connect** | Payouts | Stripe SDK in API routes |
| **Supabase Realtime** | Live updates | Subscription in stores |

### API Routes Needed

```
/api/affiliate/[code]       - Redirect handler, click tracking
/api/webhooks/conversion    - Receive conversion postbacks
/api/cron/deals             - Aggregate deals (Vercel cron)
/api/deals/apply            - Apply to deal
/api/payouts/request        - Request payout
/api/wallet/transactions    - Fetch transaction history
```

---

## Suggested Build Order

Based on dependencies, build in this order:

### Phase 1: Database Foundation
1. Create Supabase tables (schema above)
2. Set up RLS policies
3. Create creator_profile on user signup (trigger)
4. Add levels reference data

**Dependencies:** None
**Outputs:** Database ready for all features

### Phase 2: Level System
1. Create level-store.ts
2. Create LevelProgress, LevelCard components
3. Add level display to sidebar/header
4. XP granting logic (backend functions)

**Dependencies:** Phase 1 (database)
**Outputs:** Working level display, XP foundation

### Phase 3: Wallet Core
1. Create wallet-store.ts
2. Create WalletDashboard, BalanceCard, TransactionList
3. Add wallet page route
4. Supabase real-time subscription

**Dependencies:** Phase 1 (database)
**Outputs:** View earnings, transaction history

### Phase 4: Deals Marketplace
1. Create deals-store.ts
2. Create DealsMarketplace, DealCard, DealFilters
3. Add deals page routes
4. Deal application flow

**Dependencies:** Phase 2 (level system for tier access)
**Outputs:** Browse deals, see locked/unlocked status

### Phase 5: Affiliate Tracking
1. Create click redirect API route
2. Create conversion webhook handler
3. Generate unique affiliate links
4. Attribution logic

**Dependencies:** Phase 4 (deal enrollments)
**Outputs:** Full tracking pipeline

### Phase 6: Deal Aggregation
1. Set up Vercel cron job
2. Create aggregation logic per source
3. Normalize and upsert deals
4. Add Virtuna affiliate as featured deal

**Dependencies:** Phase 4 (deals schema)
**Outputs:** Automated deal population

### Phase 7: Payouts
1. Stripe Connect integration
2. Payout request flow
3. Add payout method to settings
4. Payout status tracking

**Dependencies:** Phase 3 (wallet)
**Outputs:** Complete money flow

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Database Schema | HIGH | Standard patterns for affiliate/marketplace systems |
| Component Architecture | HIGH | Follows existing Virtuna patterns exactly |
| Data Flow | HIGH | Clear separation, Zustand + Supabase pattern documented |
| Integration Points | HIGH | Existing codebase clear, modification points obvious |
| Affiliate Tracking | MEDIUM | Webhook approach varies by network, may need per-network handling |
| Deal Aggregation | MEDIUM | Depends on which networks have APIs vs. require scraping |
| Payouts | MEDIUM | Stripe Connect setup straightforward, but compliance varies by region |

---

## Sources

- [Zustand with Supabase Discussion](https://github.com/pmndrs/zustand/discussions/2284)
- [How to use Zustand with Supabase and Next.js App Router](https://medium.com/@ozergklp/how-to-use-zustand-with-supabase-and-next-js-app-router-0473d6744abc)
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Affiliate Conversion Tracking - Tapfiliate](https://tapfiliate.com/blog/affiliate-conversion-tracking/)
- [DrawSQL Level Up Schema Template](https://drawsql.app/templates/level-up)
- [Best Practices for Supabase](https://www.leanware.co/insights/supabase-best-practices)
