# Stack Research: Brand Deals & Affiliate Hub

**Project:** Virtuna v1.6
**Researched:** 2026-02-02
**Dimension:** Stack additions for affiliate aggregation, wallet tracking, and creator monetization

---

## Executive Summary

Use an **affiliate aggregator service** (Strackr or Affluent) rather than building individual network integrations. The major networks (ShareASale, CJ, Impact, Rakuten) have APIs, but they require individual integrations, rate limits, and approval processes. An aggregator provides 200+ networks through a single API for ~EUR50-100/month.

For wallet/earnings tracking, **Supabase is sufficient** with proper schema design and RPC functions for atomic transactions. Recharts (already installed) handles wallet visualizations. For eventual payouts, **Stripe Connect** is the recommended path due to its creator economy focus and global coverage.

**Key recommendation:** Start with mock data + UI, then integrate aggregator API in a later phase. The wallet UI and deal browsing can be built entirely with Supabase + existing stack.

---

## Affiliate Network APIs

### Major Networks with Publisher APIs

| Network | API Access | Key Limitations | Approval Required |
|---------|------------|-----------------|-------------------|
| **CJ Affiliate** | Full REST API via [Developer Portal](https://developers.cj.com) | No click-through stats via API; need manual report import | Personal Access Token required |
| **ShareASale** | REST API at `shareasale.com/x.cfm` | 200 requests/month limit; IP whitelist required | Token + Secret Key from dashboard |
| **Impact.com** | Full REST API via [Integrations Portal](https://integrations.impact.com) | Docs only accessible to current clients | Partner ID + API Key |
| **Rakuten Advertising** | [Affiliate APIs 1.0.0](https://developers.rakutenadvertising.com/documentation/en-US/affiliate_apis) | Client ID + Secret + Scope ID required | Publisher account required |
| **Awin** | API available | Similar authentication requirements | Publisher account required |

### API Capabilities Summary

All major networks provide:
- Product/deal search
- Commission rates and details
- Transaction/conversion reporting
- Link generation

**Critical gap:** Most networks don't provide real-time click tracking via API. Conversion data is typically available with 1-24 hour delay.

### Verdict: Don't Build Individual Integrations

Building direct integrations to 4-5 networks would require:
- 4-5 different authentication schemes
- Handling varied rate limits (ShareASale: 200/month vs others: varies)
- Maintaining integrations as APIs change
- Approval process for each network

**Estimated effort:** 2-3 weeks per network, ongoing maintenance.

---

## Aggregation Approaches

### Recommended: Affiliate Aggregator Services

| Service | Networks | API Access | Data Refresh | Pricing |
|---------|----------|------------|--------------|---------|
| **[Strackr](https://strackr.com)** | 271+ | Custom tier only | 10 min (custom) / 6hr (lower) | EUR10-50/mo, API: custom pricing |
| **[wecantrack](https://wecantrack.com)** | 350+ | Medium tier+ | Hourly | EUR59-299/mo |
| **[Affluent](https://www.affluent.io)** | 100s | Full API focus | Hourly | Custom pricing (enterprise) |
| **[Affilimate](https://affilimate.com)** | 100+ | Shopping/loyalty focus | Near real-time | Custom pricing |

### Strackr (Recommended for MVP)

**Why Strackr:**
- REST API with unified format across all networks
- Handles disparate network technologies (REST, SOAP, XML, file)
- Link Builder tool for generating trackable links
- Subid support for tracking user conversions
- EUR50/mo gets 6,000 transactions, 30 networks, 6hr refresh
- Custom tier gets API access + 10-min refresh

**Strackr API Capabilities:**
- `GET /transactions` - Conversion data with subid
- `GET /programs` - Available affiliate programs
- `GET /deals` - Promotional offers/coupons
- Link generation via Link Builder

**Integration pattern:**
```typescript
// Example: Fetch deals from Strackr
const deals = await fetch('https://api.strackr.com/v1/programs', {
  headers: { 'Authorization': `Bearer ${STRACKR_API_KEY}` }
});
```

### wecantrack (Alternative)

**When to consider:**
- Need 350+ networks (vs Strackr's 271)
- Need BigQuery integration for analytics
- Need ad platform integrations (Google Ads, Facebook, TikTok)

**Drawbacks:**
- Higher base price (EUR59/mo vs EUR50/mo)
- Click/session limits may constrain scale
- API only on Medium tier (EUR99/mo+)

### What NOT to Use

**Scraping:** Don't scrape affiliate networks. APIs exist and terms of service prohibit scraping. Legal risk with no benefit.

**Building custom aggregation:** The aggregator services exist because this is genuinely hard. 6+ months to build what Strackr/wecantrack already provide.

---

## Conversion/Click Tracking as Middleman

### How It Works

When Virtuna mediates affiliate links:

1. **User clicks deal in Virtuna** -> Hits Virtuna's tracking endpoint
2. **Virtuna logs click** -> Stores user ID, deal ID, timestamp, generates click_id
3. **Redirect to affiliate link** -> Click_id passed as subid parameter
4. **User converts** -> Network reports conversion with subid back to aggregator
5. **Aggregator webhook** -> Virtuna receives conversion with click_id
6. **Credit user wallet** -> Match click_id to user, credit earnings

### Implementation with Strackr/wecantrack

Both services support subid tracking (up to 6 subids):

```typescript
// Generate trackable link
const trackableUrl = `${affiliateUrl}&subid1=${userId}&subid2=${dealId}&subid3=${clickId}`;

// Store click
await supabase.from('clicks').insert({
  id: clickId,
  user_id: userId,
  deal_id: dealId,
  created_at: new Date()
});

// Later: webhook receives conversion
// Match click_id, credit wallet
```

### Server-Side Tracking (Recommended for 2026)

With cookie deprecation, server-side tracking is essential:

```typescript
// Next.js API route for click tracking
// /api/track/[dealId]/route.ts
export async function GET(req: Request, { params }: { params: { dealId: string } }) {
  const userId = await getCurrentUser();
  const clickId = generateClickId();

  // Log click server-side
  await logClick(userId, params.dealId, clickId);

  // Get trackable URL from aggregator
  const url = await getTrackableUrl(params.dealId, clickId);

  return Response.redirect(url);
}
```

---

## Wallet/Fintech Stack

### Database Schema (Supabase)

```sql
-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  pending_balance DECIMAL(10,2) DEFAULT 0.00,
  lifetime_earnings DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (immutable ledger)
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'credit', 'debit', 'pending_credit', 'pending_to_available', 'payout'
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  source VARCHAR(50), -- 'affiliate', 'referral', 'bonus', 'payout'
  reference_id UUID, -- click_id or payout_id
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic balance update via RPC
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount DECIMAL,
  p_source VARCHAR,
  p_reference_id UUID,
  p_description TEXT
) RETURNS wallet_transactions AS $$
DECLARE
  v_wallet wallets;
  v_transaction wallet_transactions;
BEGIN
  -- Lock wallet row
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  -- Update balance
  UPDATE wallets
  SET balance = balance + p_amount,
      lifetime_earnings = lifetime_earnings + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  -- Insert transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, balance_after, source, reference_id, description)
  VALUES (v_wallet.id, 'credit', p_amount, v_wallet.balance, p_source, p_reference_id, p_description)
  RETURNING * INTO v_transaction;

  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql;
```

### UI Components

**Already installed:** Recharts v3.7.0 - sufficient for wallet charts

**Recommended addition:** None required. Build wallet UI with:
- Recharts for balance charts, earnings trends
- Existing Radix primitives for transaction list
- Tailwind for Revolut-style card layouts

**Wallet UI patterns (from Revolut/fintech research):**
- Centralized dashboard with balance prominently displayed
- Transaction list with clear visual hierarchy
- Color-coded transaction types
- Pull-to-refresh pattern
- Skeleton loading states

---

## Payout Integration (Future Phase)

### Recommended: Stripe Connect

**Why Stripe Connect:**
- Used by Shopify, DoorDash, Instacart, Lyft
- 118+ countries supported
- Instant Payouts available (24x7)
- Handles KYC/compliance automatically
- Creator economy focus

**Pricing:**
- 2.9% + $0.30 per transaction (standard)
- 0.25% payout fee (capped at $25)
- Volume discounts available

**Integration complexity:** Medium - requires connected account onboarding flow

### Alternative: PayPal Payouts

**When to consider:**
- Users prefer PayPal
- Simpler integration for initial launch
- 15,000 payments per batch

**Pricing:** 2% per transaction

### NOT Recommended for MVP

- **Tipalti** - Enterprise focus, overkill for MVP
- **Payoneer** - Recent fee increases (2025), cost prohibitive
- **Wise** - Good for international, less suited for creator payouts

### Payout Timeline Recommendation

1. **Phase 1 (MVP):** Wallet UI only, no real payouts
2. **Phase 2:** Manual payouts via PayPal/Stripe dashboard
3. **Phase 3:** Stripe Connect integration for automated payouts

---

## Recommended Stack Additions

| Addition | Version | Purpose | Rationale |
|----------|---------|---------|-----------|
| **Strackr API** | - | Affiliate aggregation | 271+ networks, unified API, EUR50/mo |
| **@stripe/stripe-js** | ^4.x | Future payout integration | Industry standard, creator-focused |
| **stripe** | ^17.x | Server-side Stripe SDK | Payout API calls |

### Already Sufficient (No Addition Needed)

| Existing | Purpose | Why Sufficient |
|----------|---------|----------------|
| **Supabase** | Wallet storage, transactions | RPC functions for atomic ops, RLS for security |
| **Recharts** | Wallet visualizations | Already installed, full charting capability |
| **Zod** | API response validation | Already installed |
| **Zustand** | Client state for wallet cache | Already installed |

### Installation Command (When Ready)

```bash
# Stripe SDK (for future payout phase)
npm install stripe @stripe/stripe-js
```

---

## What NOT to Add

| Avoid | Reason |
|-------|--------|
| **Individual network SDKs** | Use aggregator instead |
| **Custom scraping solution** | Legal risk, maintenance burden |
| **Tremor/additional chart libraries** | Recharts already installed, sufficient |
| **Separate fintech database** | Supabase handles this fine with proper schema |
| **Complex event sourcing** | Overkill for wallet; simple transaction log sufficient |
| **Blockchain/crypto payments** | Complexity without user demand |
| **Real-time WebSocket for balance** | Polling sufficient for this use case |

---

## Integration with Existing Stack

### Fits Naturally

| Existing | New Feature | Integration |
|----------|-------------|-------------|
| Next.js App Router | API routes for click tracking | `/api/track/[dealId]` |
| Supabase Auth | Wallet user association | `wallets.user_id -> auth.users` |
| Supabase DB | Transaction storage | New tables with RLS |
| TypeScript | Aggregator API types | Zod schemas for API responses |
| Tailwind | Wallet UI | Existing design system |
| Recharts | Balance charts | Already imported |

### New Patterns Required

| Pattern | Description |
|---------|-------------|
| **Webhook handler** | `/api/webhooks/strackr` for conversion callbacks |
| **Server-side redirects** | Track clicks before redirecting to affiliate |
| **RPC functions** | Supabase functions for atomic wallet operations |
| **Background jobs** | Sync deal catalog from aggregator (Vercel Cron) |

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| **Aggregator recommendation** | HIGH | Multiple sources confirm Strackr/wecantrack capabilities; pricing verified |
| **Network API availability** | HIGH | Official documentation verified for CJ, ShareASale, Impact, Rakuten |
| **Wallet schema** | HIGH | Standard pattern; Supabase RPC docs verified |
| **Stripe Connect for payouts** | HIGH | Official docs, industry standard |
| **Strackr pricing** | MEDIUM | Pricing page verified, but API tier is "custom" |
| **Click tracking implementation** | MEDIUM | Pattern documented, but specifics depend on aggregator chosen |

---

## Sources

### Aggregator Services
- [Strackr Affiliate API](https://strackr.com/affiliate-api)
- [Strackr Pricing](https://strackr.com/pricing)
- [wecantrack Affiliate Aggregator](https://wecantrack.com/affiliate-aggregator/)
- [Affluent Affiliate API](https://www.affluent.io/affiliate-api/)

### Affiliate Network APIs
- [CJ Developer Portal](https://developers.cj.com/)
- [ShareASale API Building Blocks](https://help.shareasale.com/hc/en-us/articles/5375832636695-API-Building-Blocks)
- [Impact.com Integrations Portal](https://integrations.impact.com/)
- [Rakuten Affiliate APIs Documentation](https://developers.rakutenadvertising.com/documentation/en-US/affiliate_apis)

### Payout Platforms
- [Stripe Connect Documentation](https://docs.stripe.com/connect)
- [PayPal Payouts API](https://developer.paypal.com/docs/payouts/standard/integrate-api/)

### Fintech UI Patterns
- [Mobile Banking App Design: UX & UI Best Practices for 2026](https://www.purrweb.com/blog/banking-app-design/)
- [Top 10 Fintech UX Design Practices 2026](https://www.onething.design/post/top-10-fintech-ux-design-practices-2026)

### Supabase Patterns
- [Supabase Database Transactions Discussion](https://github.com/orgs/supabase/discussions/526)
- [Supabase Best Practices](https://www.leanware.co/insights/supabase-best-practices)
