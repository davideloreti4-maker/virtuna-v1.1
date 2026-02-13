# External Integrations

**Analysis Date:** 2026-02-13

## APIs & External Services

**Payments & Subscriptions:**
- Whop - Payment processing and subscription management
  - SDK/Client: `@whop/checkout` 0.0.52
  - Auth: `WHOP_WEBHOOK_SECRET` (webhook signature verification)
  - Config: `WHOP_PRODUCT_ID_STARTER`, `WHOP_PRODUCT_ID_PRO`
  - Implementation: `src/lib/whop/config.ts`, `src/lib/whop/subscription.ts`, `src/lib/whop/webhook-verification.ts`
  - Webhook endpoint: `src/app/api/webhooks/whop/route.ts`
  - Checkout endpoint: `src/app/api/whop/checkout/route.ts`
  - Cron sync: `src/app/api/cron/sync-whop/route.ts`
  - Events: `membership.went_valid`, `membership.went_invalid`, `membership.payment_failed`

**Image Services:**
- Picsum Photos - Placeholder images
  - Remote patterns configured in `next.config.ts`
  - Hostnames: `picsum.photos`, `fastly.picsum.photos`

**3D Graphics:**
- Spline - 3D design/animation platform
  - SDK: `@splinetool/react-spline` 4.1.0
  - Used for 3D visualizations in landing/marketing pages

## Data Storage

**Databases:**
- Supabase (PostgreSQL 17)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` 2.93.1 with SSR support (`@supabase/ssr` 0.8.0)
  - Clients:
    - Browser: `src/lib/supabase/client.ts` (createBrowserClient)
    - Server: `src/lib/supabase/server.ts` (createServerClient)
    - Middleware: `src/lib/supabase/middleware.ts` (session refresh)
  - Types: Auto-generated database types in `src/types/database.types.ts`
  - Local dev: Supabase CLI with `supabase/config.toml`
  - Migrations: `supabase/migrations/`
  - Key tables: `user_subscriptions`, `affiliate_clicks`, `affiliate_conversions`, `creator_profiles`

**File Storage:**
- Supabase Storage (configured in `supabase/config.toml`)
  - Max file size: 50MiB
  - S3 protocol enabled for local dev
  - Public assets served via Next.js `public/` directory

**Caching:**
- None detected (relies on Next.js built-in caching and Supabase realtime)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built into Supabase platform)
  - Implementation: `@supabase/ssr` for cookie-based session management
  - Middleware: `src/middleware.ts` handles session refresh on all routes
  - Site URL: `http://127.0.0.1:3000` (local), configurable via `NEXT_PUBLIC_APP_URL`
  - JWT expiry: 3600s (1 hour)
  - Refresh token rotation: enabled
  - Email signup: enabled (confirmations disabled for local dev)
  - Social providers: None configured (Apple/Google/etc available but disabled in config)

**Authorization:**
- Supabase Row Level Security (RLS) on database tables
- Service role client used for webhook handlers (bypasses RLS)
- Tier-based access control via `user_subscriptions.virtuna_tier` (free/starter/pro)
  - Logic: `src/lib/whop/config.ts` (`hasAccessToTier`, `TIER_HIERARCHY`)

## Monitoring & Observability

**Error Tracking:**
- None configured (console logging only)

**Logs:**
- Server-side: `console.log`, `console.error`, `console.warn` in API routes and server components
- Client-side: Browser console

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js deployment platform, mentioned in CLAUDE.md and README.md)

**CI Pipeline:**
- GitHub Actions - PR review automation
  - Workflow: `.github/workflows/claude-pr-review.yml`
  - Trigger: PR opened/synced or @claude comment
  - Action: Anthropic Claude Code Review (`anthropics/claude-code-action@v1`)
  - Permissions: contents:write, pull-requests:write, issues:write

## Environment Configuration

**Required env vars:**

Public (client-accessible):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_APP_URL` - Application base URL (defaults to http://localhost:3000)

Private (server-only):
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key (for webhook handlers)
- `WHOP_WEBHOOK_SECRET` - Whop webhook signature verification secret
- `WHOP_PRODUCT_ID_STARTER` - Whop product ID for Starter tier
- `WHOP_PRODUCT_ID_PRO` - Whop product ID for Pro tier

Optional (local dev):
- `OPENAI_API_KEY` - For Supabase Studio AI features (configured in `supabase/config.toml`)

**Secrets location:**
- Local: `.env.local` (gitignored)
- Production: Vercel environment variables (configured via dashboard)
- Example: `.env.local.example` (committed)

## Webhooks & Callbacks

**Incoming:**
- `/api/webhooks/whop` - Whop subscription webhooks (POST)
  - Events: membership lifecycle (went_valid, went_invalid, payment_failed)
  - Verification: Svix signature verification (`src/lib/whop/webhook-verification.ts`)
  - Actions: Upserts `user_subscriptions` table with tier and status

**Outgoing:**
- None detected

**Cron Jobs:**
- `/api/cron/sync-whop` - Periodic Whop subscription sync endpoint
  - Trigger: External cron service (Vercel Cron or similar)
  - Purpose: Keep subscription state in sync with Whop platform

## Development Tools

**Local Database:**
- Supabase local stack via Docker
  - API port: 54321
  - DB port: 54322
  - Studio port: 54323
  - Inbucket (email testing): 54324
  - Realtime enabled
  - Configured via `supabase/config.toml`

**Extraction/Testing:**
- Playwright for UI extraction and testing
  - Config: `extraction/playwright.config.ts`
  - Scripts: `extraction/scripts/` (capture sessions, generate GIFs)
  - Commands: `npm run extraction`, `extraction:auth`, `extraction:all`, `extraction:ui`, `extraction:gifs`

---

*Integration audit: 2026-02-13*
