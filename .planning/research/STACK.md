# Technology Stack

**Project:** Virtuna v3.0 MVP Launch
**Researched:** 2026-02-13
**Scope:** Stack ADDITIONS only -- existing stack (Next.js 16, React 19, Tailwind v4, Supabase Auth, Zustand, Zod v4, framer-motion, @whop/checkout) is validated and not re-evaluated.

## Current State Assessment

The codebase already has substantial infrastructure for several of the target features:

| Feature Area | What Exists | What's Missing |
|-------------|-------------|----------------|
| Whop Payments | `@whop/checkout` ^0.0.52, checkout modal, webhook handler, cron sync, subscription API, tier config | `@whop/sdk` for typed API calls (currently raw `fetch`), trial configuration, `affiliateCode` prop on checkout embed |
| TikTok Connect | Nothing | Full OAuth flow, token management, profile data fetching |
| Affiliate/Referral | DB schema (affiliate_clicks, affiliate_conversions, wallet_transactions), mock data, UI components | Backend logic for referral code generation, click tracking API, conversion attribution, Whop affiliateCode passthrough |
| Landing Page | 11 landing components exist (hero, features, stats, FAQ, etc.), framer-motion ^12.29.3, react-intersection-observer ^10.0.2 | Interactive demo (mini hive canvas + analysis preview), pricing section with checkout integration |

## Recommended Stack Additions

### 1. Whop Server SDK (Replace Raw Fetch)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@whop/sdk` | ^0.0.25 | Typed Whop API client | Replaces raw `fetch()` calls in checkout/route.ts and cron/sync-whop/route.ts with typed methods, automatic retries (2x default), and proper error types. The existing webhook handler uses manual Svix verification which works fine, but the SDK's `webhooks.unwrap()` is cleaner. |

**Confidence:** HIGH -- verified via [npm](https://www.npmjs.com/package/@whop/sdk) and [Whop docs](https://docs.whop.com/developer/api/getting-started)

**Integration notes:**
- Initialize in `src/lib/whop/sdk.ts` with `WHOP_API_KEY` env var
- Replace raw fetch in `src/app/api/whop/checkout/route.ts` with `client.checkoutSessions.create()`
- Replace raw fetch in `src/app/api/cron/sync-whop/route.ts` with `client.memberships.retrieve()`
- Can replace manual webhook verification in `src/lib/whop/webhook-verification.ts` with `client.webhooks.unwrap()`
- Does NOT replace `@whop/checkout` -- that's the frontend embed component, separate package

**What NOT to do:** Do not add `@whop-apps/sdk` -- that's for building Whop platform apps, not external integrations.

### 2. TikTok OAuth (Manual Implementation, No New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Manual OAuth 2.0 | N/A (native) | TikTok account connection | TikTok Login Kit is standard OAuth 2.0. Supabase Auth does NOT have a built-in TikTok provider (confirmed via [GitHub issue #199](https://github.com/supabase/auth/issues/199)). Adding Auth.js/NextAuth would create a parallel auth system conflicting with the existing Supabase Auth setup. Manual OAuth is 2 route handlers + 1 utility. |

**Confidence:** HIGH -- verified TikTok not in Supabase's [supported providers list](https://supabase.com/docs/guides/auth/social-login), confirmed Auth.js Supabase adapter uses separate `next_auth` schema (conflicts with existing auth)

**Implementation pattern:**
```
1. /api/auth/tiktok/authorize   -- generates state, redirects to TikTok
2. /api/auth/tiktok/callback    -- exchanges code for tokens, stores in tiktok_connections table
3. TikTok authorization URL: https://www.tiktok.com/v2/auth/authorize/
4. Token exchange endpoint: https://open.tiktokapis.com/v2/oauth/token/
5. User info endpoint: https://open.tiktokapis.com/v2/user/info/
```

**Required scopes:**
- `user.info.basic` -- display name, avatar, open_id (table stakes)
- `user.info.profile` -- bio, verification status (valuable for creator profiles)
- `user.info.stats` -- follower count, likes count, video count (critical for the product)

**Production constraint:** TikTok requires HTTPS callback URLs, domain must be registered and approved by TikTok team. Development requires deployed preview URL (no localhost). Submit for review immediately.

**What NOT to do:**
- Do NOT add `next-auth` / Auth.js -- it creates a parallel auth system with its own `next_auth` DB schema, conflicting with Supabase Auth
- Do NOT use Supabase's `signInWithOAuth` for TikTok -- TikTok is not a supported provider
- This is account LINKING, not authentication -- the user is already signed in via Supabase Auth, we're just connecting their TikTok account for data access

### 3. No New Libraries for Affiliate/Referral System

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No additions | N/A | Referral tracking | The database schema already has `affiliate_clicks` and `affiliate_conversions` tables. The Whop checkout embed already accepts an `affiliateCode` prop. This is purely server-side logic (route handlers + Supabase queries) with no library dependencies. |

**Confidence:** HIGH -- verified `affiliateCode` prop exists on [WhopCheckoutEmbed](https://docs.whop.com/payments/checkout-embed), DB schema confirmed in `database.types.ts`

**Implementation approach:**
- Generate referral codes with `crypto.randomBytes(4).toString('hex')` -- no library needed
- New Supabase tables: `referral_links`, `referral_conversions` (separate from brand-deal affiliate tables)
- Track clicks via `/api/referral/[code]` route handler with redirect + server-set cookie
- Attribute conversions in Whop webhook handler when `affiliateCode` is present
- Pass `affiliateCode` prop to existing `CheckoutModal` component
- Whop's built-in affiliate system handles commission payouts (30-day window, configurable rates)

**What NOT to do:**
- Do NOT build custom commission payout logic -- Whop handles this natively
- Do NOT add analytics libraries for click tracking -- Supabase + a simple route handler is sufficient for MVP
- Do NOT reuse existing `affiliate_clicks`/`affiliate_conversions` tables for Virtuna referrals -- those are semantically for brand-deal affiliates. Create new `referral_links`/`referral_conversions` tables.

### 4. No New Libraries for Landing Page

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| No additions | N/A | Landing page with interactive demo | Already have framer-motion ^12.29.3 (animations), react-intersection-observer ^10.0.2 (scroll triggers), @react-three/fiber + @react-three/drei + @splinetool/react-spline (3D if needed). The interactive demo is a stripped-down Canvas 2D component reusing existing d3-hierarchy logic. |

**Confidence:** HIGH -- all libraries already installed and in use

**Mini hive demo approach:**
- Extract a lightweight version of the existing Canvas hive component (already renders 1300+ nodes at 60fps)
- Reduce to ~50 nodes with pre-computed positions (no d3 dependency needed for static demo)
- Use framer-motion `whileInView` for scroll-triggered animations on sections
- Use react-intersection-observer for lazy loading heavy sections

**What NOT to do:**
- Do NOT add GSAP -- framer-motion already handles everything needed
- Do NOT add Lottie -- not worth the complexity for this landing page
- Do NOT import the full HiveCanvas component with all interaction hooks -- create a separate lightweight HiveDemo

### 5. Contextual Tooltips (Custom, No New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom (Zustand + Framer Motion) | N/A | First-visit tooltips | Contextual tooltips are independent per-element, not sequential tours. NextStepjs is sequential. A lightweight custom component using Zustand persist + Framer Motion (both already installed) is simpler and more flexible. |

**What NOT to do:**
- Do NOT add NextStepjs -- overkill for independent contextual tooltips
- Do NOT add Onborda -- requires shadcn/ui which is not our design system
- Do NOT add Intro.js -- jQuery-era API, no Next.js optimizations

## Recommended Stack (Summary)

### New Dependencies

| Package | Version | Category | Size Impact |
|---------|---------|----------|-------------|
| `@whop/sdk` | ^0.0.25 | Server-side | Minimal (server-only, tree-shakes) |

**Total new packages: 1**

### Already Installed (Leverage These)

| Package | Current Version | Use For |
|---------|----------------|---------|
| `@whop/checkout` | ^0.0.52 | Embedded checkout with `affiliateCode` prop |
| `framer-motion` | ^12.29.3 | Landing page animations, scroll triggers, tooltip animations |
| `react-intersection-observer` | ^10.0.2 | Lazy loading, section visibility |
| `d3-hierarchy` | ^3.1.2 | Mini hive demo data generation |
| `d3-quadtree` | ^3.0.1 | Mini hive demo hit detection |
| `zod` | ^4.3.6 | Form validation (onboarding flow, referral inputs) |
| `zustand` | ^5.0.10 | Onboarding state, tooltip dismissal tracking, referral state |
| `@supabase/ssr` | ^0.8.0 | Server-side auth, session management |
| `@supabase/supabase-js` | ^2.93.1 | Database queries, auth |
| `recharts` | ^3.7.0 | Referral dashboard charts |

## Environment Variables

### New (Required)

| Variable | Purpose | Where Used |
|----------|---------|------------|
| `TIKTOK_CLIENT_KEY` | TikTok OAuth client ID | `/api/auth/tiktok/*` route handlers |
| `TIKTOK_CLIENT_SECRET` | TikTok OAuth client secret | `/api/auth/tiktok/callback` |

### Existing (Verify Configured)

| Variable | Purpose | Status |
|----------|---------|--------|
| `WHOP_API_KEY` | Whop API authentication | Used in checkout + cron routes |
| `WHOP_WEBHOOK_SECRET` | Webhook signature verification | Used in webhook handler |
| `WHOP_PRODUCT_ID_STARTER` | Starter plan product ID | Used in config.ts |
| `WHOP_PRODUCT_ID_PRO` | Pro plan product ID | Used in config.ts |
| `CRON_SECRET` | Cron endpoint auth | Used in sync-whop route |
| `NEXT_PUBLIC_APP_URL` | App base URL for redirects | Used in checkout route |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| TikTok OAuth | Manual OAuth 2.0 routes | Auth.js + TikTok provider | Creates parallel auth system with separate `next_auth` DB schema; conflicts with existing Supabase Auth; adds ~3 packages for what's 2 route handlers |
| TikTok OAuth | Manual OAuth 2.0 routes | Supabase custom OIDC (upcoming) | Not yet released as of 2026-02-13; "early 2026" per Supabase discussions; can migrate later when available |
| Whop API | `@whop/sdk` | Continue with raw `fetch()` | Raw fetch works (proven by existing code) but lacks types, auto-retry, and proper error handling; SDK is <1 dependency |
| Referral codes | `crypto.randomBytes` | nanoid / uuid | No need for a library to generate 8-character referral codes |
| Landing animations | framer-motion | GSAP | Already installed and used throughout; GSAP adds 60kb+ for no benefit |
| Checkout embed | `@whop/checkout` | Custom Stripe integration | Whop is the chosen payment platform; already integrated with working modal |
| Tooltips | Custom (Zustand + Framer Motion) | NextStepjs | Sequential tour library, not independent contextual tooltips |
| Referral tracking | Custom (Supabase) | GrowSurf / Rewardful | External SaaS adds cost + complexity. DB schema already exists. Simple one-time bonus does not need a platform |
| Email sequences | Skip for MVP | Resend / Loops | Not needed yet. In-app onboarding first |

## Database Schema Additions

New tables needed (Supabase migrations):

```sql
-- Referral links for Virtuna's referral program
CREATE TABLE referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  code VARCHAR(16) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Referral conversions (tracks successful signups via referral)
CREATE TABLE referral_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code VARCHAR(16) NOT NULL,
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  bonus_cents INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' -- pending, credited, expired
);

-- TikTok account connections (separate from creator_profiles for token security)
CREATE TABLE tiktok_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  tiktok_open_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  follower_count INTEGER,
  likes_count INTEGER,
  video_count INTEGER,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

-- Onboarding state (add columns to existing creator_profiles)
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS
  onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS
  onboarding_step INTEGER DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS
  creator_goal TEXT DEFAULT NULL;
```

**Note:** The existing `affiliate_clicks` and `affiliate_conversions` tables are for brand-deal affiliates. The new `referral_links` and `referral_conversions` tables are for the Virtuna user-refers-user program. Keep them separate to avoid semantic confusion. The `tiktok_connections` table stores sensitive OAuth tokens separately from `creator_profiles` (which has public profile data).

## Whop Plan Configuration (Dashboard, Not Code)

The 7-day Pro trial is configured in the Whop dashboard, NOT in code:

1. Create two plans in Whop dashboard:
   - **Starter** -- monthly renewal, $19/mo, no trial
   - **Pro** -- monthly renewal, $49/mo, `trial_period_days: 7`
2. Copy plan IDs to `WHOP_PRODUCT_ID_STARTER` and `WHOP_PRODUCT_ID_PRO` env vars
3. The existing checkout flow automatically handles trials -- Whop's embed shows the trial UI when the plan has a trial configured

Alternatively, plans can be created via `@whop/sdk`:
```typescript
const plan = await whop.plans.create({
  company_id: "biz_xxx",
  product_id: "prod_xxx",
  plan_type: "renewal",
  billing_period: 30,
  initial_price: 0, // $0 for trial
  renewal_price: 4900, // $49.00
  trial_period_days: 7,
  title: "Pro Monthly",
});
```

## Installation

```bash
# Single new dependency
npm install @whop/sdk
```

No dev dependencies needed. No configuration changes to Next.js, Tailwind, or TypeScript.

## Sources

- [@whop/sdk npm](https://www.npmjs.com/package/@whop/sdk) -- v0.0.25, published 2026-02-08
- [@whop/checkout npm](https://www.npmjs.com/package/@whop/checkout) -- v0.0.52, already installed
- [Whop Embed Checkout docs](https://docs.whop.com/payments/checkout-embed) -- affiliateCode prop, sessionId, theme
- [Whop Webhooks docs](https://docs.whop.com/developer/guides/webhooks) -- Standard Webhooks spec, unwrap() method
- [Whop Accept Payments docs](https://docs.whop.com/developer/guides/accept-payments) -- checkout configuration creation
- [Whop Create Plan API](https://docs.whop.com/api-reference/plans/create-plan) -- trial_period_days parameter
- [Whop Affiliate Program docs](https://docs.whop.com/manage-your-business/growth-marketing/affiliate-program) -- built-in affiliate system, 30-day payout window
- [TikTok Login Kit for Web](https://developers.tiktok.com/doc/login-kit-web) -- OAuth 2.0 authorization flow
- [TikTok API Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes) -- user.info.basic, user.info.profile, user.info.stats
- [Auth.js TikTok provider](https://authjs.dev/getting-started/providers/tiktok) -- confirms TikTok OAuth works but requires Auth.js
- [Supabase Auth TikTok request](https://github.com/supabase/auth/issues/199) -- confirms no built-in TikTok support
- [Supabase Social Login docs](https://supabase.com/docs/guides/auth/social-login) -- supported provider list (no TikTok)
- [framer-motion npm](https://www.npmjs.com/package/framer-motion) -- v12.34.0 latest (project has ^12.29.3, compatible)
- [Whop API Getting Started](https://docs.whop.com/developer/api/getting-started) -- SDK initialization pattern
