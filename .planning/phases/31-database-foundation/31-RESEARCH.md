# Phase 25: Database Foundation - Research

**Researched:** 2026-02-02
**Domain:** Supabase PostgreSQL schema design for creator monetization (deals, wallet, profiles, affiliates)
**Confidence:** HIGH

## Summary

This research investigates Supabase/PostgreSQL schema design patterns for implementing the v1.6 creator monetization hub, covering wallet transactions, deal management, creator profiles, enrollments, and affiliate tracking. The CONTEXT.md decisions (single currency USD, integer cents storage, immutable ledger pattern, last-click attribution, 30-day cookie window) align with industry best practices.

The standard approach uses PostgreSQL with Row Level Security (RLS) for data access control, integer storage for monetary values (cents), database triggers to enforce immutable ledger patterns, and PostgreSQL functions called via RPC for atomic multi-table operations. Status/workflow fields should use text columns with CHECK constraints rather than PostgreSQL ENUMs for easier schema evolution.

**Primary recommendation:** Create all schema in a single migration file with RLS enabled from day one. Use integer (cents) for money, text + CHECK for statuses, database triggers to prevent ledger updates/deletes, and generate TypeScript types after schema creation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.93.1 | Database client | Already installed, official client |
| @supabase/ssr | 0.8.0 | Server-side auth | Already installed, Next.js App Router compatible |
| Supabase CLI | >=1.8.1 | Migrations & type generation | Official tooling for schema management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Database types | Generated | Type-safe queries | After every schema change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Text + CHECK | PostgreSQL ENUM | ENUM prevents value removal without table recreation; CHECK constraints more flexible for evolving statuses |
| Integer (cents) | NUMERIC(12,2) | NUMERIC slightly more precise but slower; Integer sufficient for USD with max ~$21M per transaction |
| Trigger-based immutability | Application-layer enforcement | Triggers enforce at database level regardless of access method |

**Installation:**
```bash
# Supabase CLI (if not installed globally)
npm i supabase@">=1.8.1" --save-dev

# Link to project
npx supabase link --project-ref qyxvxleheckijapurisj
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
├── migrations/           # Timestamped SQL migration files
│   └── 20260202_v16_schema.sql
├── seed.sql              # Test data for local development
└── schemas/              # Declarative schema files (optional)

src/
├── lib/
│   └── supabase/
│       ├── client.ts     # Browser client (existing)
│       ├── server.ts     # Server client (existing)
│       └── middleware.ts # Auth middleware (existing)
├── types/
│   └── database.types.ts # Generated from Supabase CLI
```

### Pattern 1: Immutable Ledger with Trigger Protection
**What:** Prevent UPDATE/DELETE on wallet_transactions table via database trigger
**When to use:** Any table requiring audit trail / immutable history
**Example:**
```sql
-- Source: PostgreSQL documentation + Supabase community patterns
CREATE OR REPLACE FUNCTION prevent_wallet_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is immutable. Use INSERT for corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_wallet_immutability
BEFORE UPDATE OR DELETE ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_mutation();
```

### Pattern 2: RLS with Performance Optimization
**What:** Row-level security with wrapped function calls for caching
**When to use:** All user-facing tables
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security
-- Wrap auth.uid() in SELECT for 94%+ performance improvement
CREATE POLICY "Users can view own transactions"
ON wallet_transactions FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Add index on user_id for 100x+ improvement on large tables
CREATE INDEX idx_wallet_transactions_user_id
ON wallet_transactions(user_id);
```

### Pattern 3: Atomic Multi-Table Operations via RPC
**What:** Use PostgreSQL functions for transactional operations
**When to use:** Wallet balance updates, deal enrollments, any multi-table writes
**Example:**
```sql
-- Source: Supabase discussions + PostgREST documentation
-- All operations in function are automatically wrapped in transaction
CREATE OR REPLACE FUNCTION record_wallet_transaction(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_type TEXT,
  p_description TEXT
)
RETURNS wallet_transactions AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_result wallet_transactions;
BEGIN
  -- Get current balance (lock row for update)
  SELECT balance_cents INTO v_current_balance
  FROM wallet_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_new_balance := COALESCE(v_current_balance, 0) + p_amount_cents;

  -- Insert immutable transaction record
  INSERT INTO wallet_transactions (
    user_id, amount_cents, type, description,
    balance_before_cents, balance_after_cents
  )
  VALUES (
    p_user_id, p_amount_cents, p_type, p_description,
    COALESCE(v_current_balance, 0), v_new_balance
  )
  RETURNING * INTO v_result;

  -- Upsert balance
  INSERT INTO wallet_balances (user_id, balance_cents)
  VALUES (p_user_id, v_new_balance)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_cents = v_new_balance,
    updated_at = NOW();

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Pattern 4: Status Fields with CHECK Constraints
**What:** Use TEXT with CHECK constraint instead of ENUM for workflow states
**When to use:** Any status/state field that may evolve
**Example:**
```sql
-- Source: https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived'))
);

-- Easy to add new status without table lock
ALTER TABLE deals DROP CONSTRAINT deals_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_status_check
  CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived', 'new_status'));
```

### Anti-Patterns to Avoid
- **Using PostgreSQL ENUM for status fields:** Removing values requires table recreation and locks
- **Storing money as FLOAT/DOUBLE:** Precision errors ($25,474,937.47 becomes $25,474,936.32)
- **Skipping RLS during development:** Security holes are hard to retrofit
- **Application-level ledger immutability:** Can be bypassed; database triggers are authoritative
- **Using `auth.uid()` directly in policies:** Wrap in `(SELECT auth.uid())` for performance
- **Missing indexes on RLS-checked columns:** 100x+ performance penalty

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-table transactions | Manual try/catch with rollback | PostgreSQL functions via RPC | Functions auto-wrapped in transactions, RAISE triggers rollback |
| Type generation | Manual TypeScript interfaces | `npx supabase gen types typescript` | Stays in sync with schema automatically |
| Row-level security | Middleware auth checks | Supabase RLS policies | Database-level enforcement, can't be bypassed |
| UUID generation | Application-side UUID | `gen_random_uuid()` in PostgreSQL | Native, performant, no client dependency |
| Timestamps | Application-side `new Date()` | `DEFAULT NOW()` / `DEFAULT CURRENT_TIMESTAMP` | Database time is authoritative |
| Balance snapshots | Calculating balance from sum | Store balance_after on each transaction | O(1) lookup vs O(n) aggregation |

**Key insight:** PostgreSQL is the source of truth. Push data integrity, transactions, and security to the database layer. The application should be stateless regarding these concerns.

## Common Pitfalls

### Pitfall 1: Floating Point Money Storage
**What goes wrong:** Rounding errors accumulate, $12.34 stored as $12.339999...
**Why it happens:** IEEE-754 floating point cannot represent most decimal fractions exactly
**How to avoid:** Store as INTEGER in cents (1234 for $12.34), divide by 100 for display
**Warning signs:** Small discrepancies in transaction summaries, failing balance reconciliations

### Pitfall 2: Missing RLS on New Tables
**What goes wrong:** Data exposed to all authenticated users
**Why it happens:** RLS is opt-in, not default
**How to avoid:** Always include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after CREATE TABLE
**Warning signs:** Users seeing other users' data, no policies in Supabase dashboard

### Pitfall 3: Mutable Ledger Records
**What goes wrong:** Audit trail broken, balance inconsistencies
**Why it happens:** UPDATE/DELETE allowed on transaction tables
**How to avoid:** Create trigger to raise exception on UPDATE/DELETE; use correcting entries instead
**Warning signs:** Transactions with updated_at != created_at, negative corrections without offset entries

### Pitfall 4: Slow RLS Policies on Large Tables
**What goes wrong:** Queries timeout on tables with >100k rows
**Why it happens:** Missing indexes, function calls on every row
**How to avoid:**
1. Wrap `auth.uid()` in SELECT: `(SELECT auth.uid())`
2. Add indexes on policy-checked columns
3. Always include filters in client queries
**Warning signs:** 171ms+ query times, full table scans in EXPLAIN output

### Pitfall 5: ENUM Type for Evolving Statuses
**What goes wrong:** Can't remove deprecated status values without table recreation
**Why it happens:** PostgreSQL has no `ALTER TYPE ... DROP VALUE`
**How to avoid:** Use TEXT + CHECK constraint instead of ENUM
**Warning signs:** Need to add/remove status values, migration requires `DROP TYPE` and full data migration

### Pitfall 6: Affiliate Attribution Without Click Storage
**What goes wrong:** Can't debug conversion discrepancies, no audit trail
**Why it happens:** Only storing conversions, not originating clicks
**How to avoid:** Store every click with metadata (timestamp, referrer, UTM, device), link conversions back to clicks
**Warning signs:** "Where did this conversion come from?" questions unanswerable

## Code Examples

### Table Creation with RLS
```sql
-- Source: Supabase official documentation
CREATE TABLE creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  tiktok_handle TEXT,
  instagram_handle TEXT,
  youtube_handle TEXT,
  twitter_handle TEXT,
  tiktok_followers INTEGER DEFAULT 0,
  instagram_followers INTEGER DEFAULT 0,
  youtube_subscribers INTEGER DEFAULT 0,
  twitter_followers INTEGER DEFAULT 0,
  niches TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS immediately
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY;

-- Policies with optimized function calls
CREATE POLICY "Users can view own profile"
ON creator_profiles FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own profile"
ON creator_profiles FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own profile"
ON creator_profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Performance index
CREATE INDEX idx_creator_profiles_user_id ON creator_profiles(user_id);
```

### Wallet Transactions with Immutability
```sql
-- Source: Modern Treasury patterns + Supabase RLS docs
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'adjustment')),
  source_type TEXT CHECK (source_type IN ('deal', 'affiliate', 'bonus', 'withdrawal', 'adjustment')),
  source_id UUID, -- References deal_enrollments or affiliate_conversions
  description TEXT,
  balance_before_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Note: NO updated_at - this table is immutable
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
ON wallet_transactions FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- INSERT only via RPC function to enforce balance calculation
CREATE POLICY "No direct inserts"
ON wallet_transactions FOR INSERT
TO authenticated
WITH CHECK (FALSE); -- Force use of RPC function

-- Immutability trigger
CREATE OR REPLACE FUNCTION prevent_wallet_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is immutable. Create a correction entry instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_wallet_immutability
BEFORE UPDATE OR DELETE ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_mutation();

CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
```

### Deals Table with Structured Data
```sql
-- Source: Supabase patterns for JSONB vs normalized columns
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  brand_category TEXT,
  title TEXT NOT NULL,
  description TEXT,
  -- Compensation (flexible structure)
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
  required_tier TEXT NOT NULL DEFAULT 'starter' CHECK (required_tier IN ('starter', 'pro', 'premium')),
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'archived')),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Public read for active deals (browse marketplace)
CREATE POLICY "Anyone can view active deals"
ON deals FOR SELECT
USING (status = 'active');

-- Only service role can modify (admin operations)
-- No INSERT/UPDATE/DELETE policies for authenticated users

CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_required_tier ON deals(required_tier);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
```

### Affiliate Click Tracking
```sql
-- Source: Attribution modeling patterns
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL,
  referrer_url TEXT,
  landing_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  device_type TEXT,
  user_agent TEXT,
  ip_hash TEXT, -- Hashed for privacy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clicks"
ON affiliate_clicks FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE INDEX idx_affiliate_clicks_user_id ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_tracking_code ON affiliate_clicks(tracking_code);
CREATE INDEX idx_affiliate_clicks_created_at ON affiliate_clicks(created_at DESC);

CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id UUID NOT NULL REFERENCES affiliate_clicks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  order_value_cents INTEGER,
  commission_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ
);

ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversions"
ON affiliate_conversions FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE INDEX idx_affiliate_conversions_user_id ON affiliate_conversions(user_id);
CREATE INDEX idx_affiliate_conversions_click_id ON affiliate_conversions(click_id);
```

### TypeScript Type Generation
```bash
# Generate types after schema creation
npx supabase gen types typescript --project-id qyxvxleheckijapurisj --schema public > src/types/database.types.ts
```

```typescript
// src/lib/supabase/client.ts - Updated with types
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostgreSQL ENUM for statuses | TEXT + CHECK constraint | 2023-2024 industry shift | Easier migrations, no table locks for status changes |
| NUMERIC/DECIMAL for money | INTEGER in cents | 2020s fintech standard | Better performance, simpler math, Modern Treasury pattern |
| Application-level auth checks | Database RLS policies | Supabase default | Can't bypass, consistent across all access paths |
| Manual type definitions | CLI-generated types | Supabase CLI 1.8+ | Always in sync, catches schema drift |
| Views for computed data | Materialized views for perf | PostgreSQL 9.3+ | Cached computation, refresh on schedule |

**Deprecated/outdated:**
- PostgreSQL `money` type: Locale-dependent, doesn't handle fractional cents
- Direct SQL transactions from client: Use RPC functions instead
- Manual migration tracking: Use Supabase CLI migration system

## Open Questions

1. **Soft deletes vs hard deletes for enrollments**
   - What we know: CONTEXT.md says "soft deletes via deleted_at where business logic requires history"
   - What's unclear: Should canceled enrollments use soft delete or status change?
   - Recommendation: Use status = 'cancelled' with timestamp, reserve deleted_at for data cleanup operations

2. **Wallet balance as table vs computed view**
   - What we know: Immutable ledger stores balance_after on each transaction
   - What's unclear: Should wallet_balances be a table or a view on latest transaction?
   - Recommendation: Use table for performance (indexed lookups), update atomically in RPC function

3. **Affiliate cookie storage mechanism**
   - What we know: 30-day attribution window, last-click model
   - What's unclear: Cookie storage handled by frontend or database timestamp comparison?
   - Recommendation: Store expires_at in database, frontend passes click_id in conversion request, database validates window

## Sources

### Primary (HIGH confidence)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS syntax, performance optimization, policy patterns
- [Supabase Type Generation](https://supabase.com/docs/guides/api/rest/generating-types) - CLI commands, TypeScript setup
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) - Migration workflow, file structure
- [Supabase Enum Management](https://supabase.com/docs/guides/database/postgres/enums) - ENUM syntax, limitations
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - Trigger syntax for immutability

### Secondary (MEDIUM confidence)
- [Crunchy Data: Working with Money](https://www.crunchydata.com/blog/working-with-money-in-postgres) - Integer vs NUMERIC comparison
- [Crunchy Data: ENUMs vs CHECK](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres) - Status field patterns
- [Modern Treasury: Integers for Cents](https://www.moderntreasury.com/journal/floats-dont-work-for-storing-cents) - Fintech money storage standard
- [Supabase Discussions: Transactions](https://github.com/orgs/supabase/discussions/526) - RPC transaction patterns

### Tertiary (LOW confidence)
- General affiliate tracking patterns from Tapfiliate, Trackdesk documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Supabase setup, official CLI tooling
- Architecture: HIGH - Patterns from Supabase official docs and PostgreSQL documentation
- Pitfalls: HIGH - Well-documented in multiple authoritative sources

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain, Supabase/PostgreSQL patterns don't change frequently)
