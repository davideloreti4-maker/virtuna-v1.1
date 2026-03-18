# External Integrations

**Analysis Date:** 2026-02-22

## APIs & External Services

**AI/Intelligence:**
- Google Gemini AI (gemini-2.5-flash-lite)
  - What it's used for: Viral video explanation and hashtag gap analysis
  - SDK/Client: `@google/genai` v1.41.0
  - Implementation: `src/lib/ai/gemini.ts`
  - Auth: `GEMINI_API_KEY` env var
  - Response format: JSON with Zod validation

- DeepSeek AI (deepseek-chat via OpenAI-compatible API)
  - What it's used for: Strategy analysis and content recommendations
  - SDK/Client: `openai` v6.22.0 (OpenAI-compatible endpoint)
  - Implementation: `src/lib/ai/deepseek.ts`
  - Auth: `DEEPSEEK_API_KEY` env var
  - Base URL: `https://api.deepseek.com`
  - Response format: JSON with Zod validation, includes retry logic

**Web Scraping:**
- Apify (TikTok Scraper)
  - What it's used for: Scraping trending TikTok data and competitor content
  - SDK/Client: `apify-client` v2.22.1
  - Webhook handler: `src/app/api/webhooks/apify/route.ts`
  - Cron trigger: `src/app/api/cron/scrape-trending/route.ts`
  - Auth: `APIFY_TOKEN` env var
  - Webhook verification: `APIFY_WEBHOOK_SECRET` env var
  - Default actor: `clockworks~tiktok-scraper` (configurable via `APIFY_ACTOR_ID`)
  - Webhook signature verification: HMAC-SHA256 in `src/lib/whop/webhook-verification.ts`
  - Data stored in Supabase with fields:
    - `apify_dataset_id` - Result dataset ID
    - `apify_run_id` - Actor run ID

**Monetization/Subscriptions:**
- Whop (Product checkout and subscription)
  - What it's used for: Tier-based access control (free/starter/pro)
  - SDK/Client: `@whop/checkout` v0.0.52
  - Configuration: `src/lib/whop/config.ts`
  - Product IDs: Environment vars `WHOP_PRODUCT_ID_STARTER` and `WHOP_PRODUCT_ID_PRO`
  - Webhook handler: `src/app/api/webhooks/whop/route.ts`
  - Cron sync: `src/app/api/cron/sync-whop/route.ts` (every 12 hours)
  - Subscription status tracking: `src/types/database.types.ts` has whop_user_id, whop_membership_id, whop_product_id fields
  - Tier mapping: `mapWhopProductToTier()` function converts product IDs to tier names
  - Webhook verification: HMAC in `src/lib/whop/webhook-verification.ts`

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` env var
  - Client library: `@supabase/supabase-js` v2.93.1
  - SSR helper: `@supabase/ssr` v0.8.0
  - Browser client: `src/lib/supabase/client.ts` (uses `createBrowserClient`)
  - Server client: `src/lib/supabase/server.ts`
  - Service client: `src/lib/supabase/service.ts`
  - Middleware helper: `src/lib/supabase/middleware.ts` (SSR session update)
  - Migrations: `supabase/migrations/` directory
    - Schema: users, profiles, tiktok_accounts, competitors, analysis results, bookmarks, teams, referrals, affiliate_links, subscriptions
  - Auto-generated types: `src/types/database.types.ts`

**File Storage:**
- Local filesystem only
  - Images served from `public/` directory
  - Remote images allowed from: `picsum.photos`, `fastly.picsum.photos`

**Caching:**
- None explicitly configured
- TanStack Query (React Query) provides client-side caching
- Vercel Edge caching available but not configured

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built into Supabase)
  - Implementation: `src/lib/supabase/middleware.ts` for session management
  - Middleware: `src/middleware.ts` refreshes session on every request
  - Client hook: `src/hooks/queries/use-profile.ts`
  - Session stored in Supabase user table
  - Row-level security (RLS) policies for data access

**Tier-Based Access Control:**
- Whop product ID determines user tier (free/starter/pro)
- Tier validation: `src/lib/whop/config.ts` has `hasAccessToTier()` helper
- Tier hierarchy: free (0) < starter (1) < pro (2)

## Monitoring & Observability

**Error Tracking:**
- Sentry
  - SDK: `@sentry/nextjs` v10.39.0
  - Configuration: `sentry.server.config.ts` and `sentry.edge.config.ts`
  - DSN: `NEXT_PUBLIC_SENTRY_DSN` env var
  - Environment: Set from `NODE_ENV`
  - Trace sample rate: 100% in development, 10% in production
  - Server config: `sendDefaultPii: false`
  - Next.js integration: Automatic instrumentation

**Logs:**
- Console logging in development
- Logger utility: `src/lib/logger.ts` with module-based logging
- Sentry captures errors and traces
- Vercel collects function logs

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js deployment platform)
  - Deployment triggers: Git push to main/branches
  - Environment variables: Configured in Vercel dashboard
  - Edge functions: Available for middleware

**CI Pipeline:**
- GitHub Actions
  - Config: `.github/` directory (not detailed in exploration)
  - Typical: TypeScript build check, linting, tests on PR

**Cron Jobs:**
- Vercel Cron (see `vercel.json`):
  - 7 scheduled jobs running at intervals from hourly to monthly
  - See STACK.md for schedule details

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry data source name
- `SENTRY_ORG` - Sentry organization
- `SENTRY_PROJECT` - Sentry project
- `GEMINI_API_KEY` - Google Gemini API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `APIFY_TOKEN` - Apify API token
- `APIFY_WEBHOOK_SECRET` - Apify webhook signature secret
- `APIFY_ACTOR_ID` - Apify actor ID (optional, defaults to `clockworks~tiktok-scraper`)
- `WHOP_PRODUCT_ID_STARTER` - Whop Starter tier product ID
- `WHOP_PRODUCT_ID_PRO` - Whop Pro tier product ID
- `NODE_ENV` - Development or production

**Secrets location:**
- `.env.local` - Local development secrets (git-ignored)
- Vercel dashboard - Production secrets
- Template: `.env.example`

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/apify` - Apify actor completion notification
  - Payload validation: HMAC-SHA256 signature verification
  - Updates dataset with scraped TikTok trending data
  - Triggered by Apify actor on completion

- `POST /api/webhooks/whop` - Whop subscription status changes
  - Payload validation: HMAC-SHA256 signature verification
  - Updates user subscription tier and status
  - Triggered by Whop on purchase, cancellation, renewal

**Outgoing:**
- No external webhooks triggered from Virtuna
- Apify webhook URL (incoming only): `https://domain/api/webhooks/apify`
- Whop webhook URL (incoming only): `https://domain/api/webhooks/whop`

## API Endpoints

**Analytics/Intelligence:**
- `GET /api/analysis/*` - Analysis endpoints
- `GET /api/trending/*` - Trending data endpoints
- `POST /api/intelligence/*` - Intelligence processing endpoints

**User Data:**
- `GET/POST /api/profile/*` - User profile management
- `GET/POST /api/bookmarks/*` - Bookmark management
- `GET/POST /api/outcomes/*` - Outcome tracking
- `GET/POST /api/team/*` - Team management

**Subscriptions/Monetization:**
- `GET/POST /api/subscription/*` - Subscription status
- `POST /api/whop/*` - Whop checkout integration
- `GET/POST /api/affiliate-links/*` - Affiliate link management
- `GET /api/earnings/*` - Earnings dashboard

**System:**
- `GET /api/cron/*` - Cron job endpoints (Vercel cron only)
- `POST /api/webhooks/*` - Webhook handlers

---

*Integration audit: 2026-02-22*
