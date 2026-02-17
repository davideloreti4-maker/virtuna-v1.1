# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Requirements

### Validated

- Real Supabase auth with middleware enforcement, Google OAuth PKCE, deep link preservation -- MVP Launch
- Landing page with hero, hive demo (lazy-loaded), features, social proof, FAQ, pricing -- MVP Launch
- Progressive onboarding: TikTok @handle connect, goal personalization, 4-tooltip system -- MVP Launch
- Whop payments: embedded checkout, 7-day Pro trial, webhook handler, tier tracking -- MVP Launch
- TierGate: server-side FeatureGate (referrals), client-side TierGate (simulation results) -- MVP Launch
- Referral system: link generation, cookie persistence through OAuth, RLS policy, dashboard -- MVP Launch
- Mobile responsiveness audit, OG metadata via file convention, dead code cleanup -- MVP Launch
- All design tokens 1:1 aligned with Raycast.com (Inter font, hex gray scale, 6% borders, glass pattern) -- v2.3.5
- GlassPanel zero-config with Raycast neutral glass (5px blur, 12px radius) -- v2.3.5
- BRAND-BIBLE.md rewritten as Raycast Design Language reference -- v2.3.5
- Full regression audit (10 pages, 36+ components, zero regressions, WCAG AA) -- v2.3.5
- TikTok Creative Center-style trending feed with 3 category tabs -- v2.2
- VideoCard with GlassCard + HoverScale + GlassPill + velocity indicators -- v2.2
- Infinite scroll with skeleton loading states -- v2.2
- Video detail modal with TikTok embed iframe -- v2.2
- Bookmark system with Zustand + localStorage persistence -- v2.2
- "Saved" filter tab for bookmarked videos -- v2.2
- Design token extraction from raycast.com (100+ tokens) -- v2.0
- Two-tier token architecture (primitive -> semantic) in Tailwind v4 -- v2.0
- Coral scale (100-900) with WCAG AA compliance -- v2.0
- 36 production components (UI, Motion, Effects, Primitives) -- v2.0
- Glassmorphism effects (7 blur levels, noise, chromatic aberration) -- v2.0
- 7-page interactive showcase with live demos -- v2.0
- WCAG AA contrast compliance (5.4:1+ muted, 7.2:1 AAA buttons) -- v2.0
- Comprehensive documentation (8 docs + brand bible) -- v2.0
- Pixel-perfect societies.io clone (landing + app) -- v1.1
- Full auth flow with Supabase Auth -- v1.1
- Responsive design (desktop + mobile) -- v1.1
- Brand deals & affiliate page with three-tab layout (Deals / Affiliates / Earnings) -- v2.3
- Deal cards grid with filters, search, apply modal, and featured highlights -- v2.3
- Affiliate link cards with copy-to-clipboard, stats, and generate-from-products -- v2.3
- Earnings dashboard with count-up stats, area chart, and per-source breakdown -- v2.3
- Loading skeletons, responsive mobile layout, and keyboard accessibility -- v2.3
- v0 MCP-guided UI generation with design system consistency -- v2.3
- Competitor intelligence tracker with add/track/compare, real Apify scraping, AI insights -- Competitors Tool
- Database schema (4 tables, RLS, BIGINT, junction dedup) and daily cron re-scraping -- Competitors Tool
- Dashboard with card grid, table/leaderboard, sparklines, growth deltas -- Competitors Tool
- Detail pages with growth charts, engagement, content analysis, heatmap -- Competitors Tool
- Side-by-side comparison, self-benchmarking, sortable leaderboard -- Competitors Tool
- AI intelligence: strategy analysis, viral detection, hashtag gap, recommendations -- Competitors Tool
- Polish: stale indicators, error states with retry, mobile responsive -- Competitors Tool

### Active

- [ ] Schedule 6 orphaned cron jobs and fix data pipeline wiring
- [ ] Rehabilitate ML classifier to >75% accuracy and wire into aggregator
- [ ] Wire Platt calibration into live predictions
- [ ] Add Sentry + structured logging observability
- [ ] Build test coverage for all engine modules (vitest)
- [ ] Harden edge cases (calibration parsing, LLM double-failure, circuit breaker races)

### Parallel (other worktrees)

- [ ] Competitor search/discovery by name or niche — future
- [ ] Backend intelligence integration (connect prediction engine to frontend) — future
- [ ] External brand deals marketplace — future
- [ ] Trending page re-launch (when backend ready) — future

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Mobile native app -- web-first
- TikTok OAuth -- manual @handle input sufficient for MVP
- Sound design -- future polish

## Context

**Current state:** MVP Launch shipped (2026-02-16). All frontend product features complete.
- ~23,170 LOC TypeScript (after 121k lines of dead code cleanup)
- Tech stack: Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth, Whop payments, Recharts, d3-hierarchy, d3-quadtree
- 36 design system components, 100+ tokens (all Raycast-accurate)
- Real auth with middleware enforcement, Google OAuth PKCE
- Progressive onboarding with goal personalization
- Two-tier payments (Starter/Pro) with 7-day trial via Whop
- Referral program with cookie persistence
- Canvas-based hive visualization: 1300+ nodes, 60fps
- Trending page at /trending with TikTok-style video feed
- Deployed to Vercel

**Known issues / blockers before go-live:**
- Whop plan IDs need creation in Whop dashboard
- Referral bonus amount undecided (business decision)
- Whop sandbox never tested end-to-end
- Analyze button routes to /viral-predictor which doesn't exist yet

## Key Decisions

| Decision | Outcome |
|----------|---------|
| Coral #FF7F50 as brand color | Good -- distinctive identity |
| Two-tier token architecture | Good -- clean separation, maintainable |
| Tailwind v4 @theme block | Good -- native CSS variable integration |
| Dark gray tokens in hex (not oklch) | Good -- workaround for Tailwind v4 compilation inaccuracy |
| Custom Select (no Radix Select) | Good -- simpler, full keyboard nav |
| sugar-high for syntax highlighting | Good -- zero client JS |
| React.useId() for InputField IDs | Good -- fixed SSR hydration mismatch |
| accent-foreground: #1a0f0a dark brown | Good -- 7.2:1 AAA contrast on coral |
| gray-500: #848586 for muted text | Good -- 5.4:1 AA contrast on dark bg |
| Inter as sole font | Good -- 1:1 Raycast match |
| GlassPanel zero-config | Good -- consistent Raycast glass |
| Cards use bg-transparent | Good -- matches Raycast live audit |
| Canvas 2D for hive (not SVG) | Good -- 1000+ nodes at 60fps |
| Server actions with useActionState for auth | Good -- simpler than client-side Supabase |
| Middleware redirects to /login (not landing) | Good -- better UX for returning users |
| Deferred response creation for OAuth cookies | Good -- solved cookie persistence through redirects |
| useSubscription hook with polling | Good -- tier refresh without page reload |
| Server-side FeatureGate + client-side TierGate split | Good -- accommodates Next.js server/client boundary |
| Referral cookie set after getUser() | Good -- survives Supabase setAll response re-creation |
| Junction table deduplication for shared competitor profiles | Good -- scrape once, serve all trackers |
| BIGINT for all metric counters | Good -- viral creators exceed MAX_INT |
| Apify Clockworks behind ScrapingProvider abstraction | Good -- swappable scraping backend |
| DeepSeek for strategy/recommendations, Gemini for viral/hashtag | Good -- cost-effective dual-model |
| 7-day TTL + scrape-date staleness for AI cache | Good -- auto-invalidates stale insights |
| Server-side analytics pre-computation | Good -- minimal client bundle |
| CSS grid heatmap (not Recharts) | Good -- lighter than chart library for grid layout |
| URL searchParams for comparison state | Good -- server re-render on selection change |

## Constraints

- Coral #FF7F50 is the brand color (non-negotiable)
- Dark-mode first (light mode deferred)
- Raycast.com as design reference (except coral)
- WCAG AA minimum for all text/background combinations
- TypeScript strict mode, no `any`

## Repository

- GitHub: https://github.com/davideloreti4-maker/virtuna-v1.1
- Local: ~/virtuna-v1.1
- Vercel: https://virtuna-v11.vercel.app

## Current Milestone: Backend Reliability

**Goal:** Fix, wire, and harden the prediction engine — the core pipeline works but significant infrastructure is disconnected or non-functional.

**Target outcomes:**
- All 7 crons scheduled and running (6 orphaned + 1 existing)
- ML classifier accuracy >75% (currently 31%) and wired into scoring
- Platt calibration conditional on outcome data availability
- Sentry error tracking + structured JSON logging
- >80% test coverage on engine modules
- Graceful degradation on all failure modes

## Current State

**Shipped:** Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Active:** Backend Reliability (worktree at ~/virtuna-backend-reliability/)

**Future milestones:**
- Backend intelligence integration (connect prediction engine to frontend)
- External brand deals marketplace
- Trending page re-launch (when backend ready)
- Competitor search/discovery by name or niche

---
*Last updated: 2026-02-17 after Backend Reliability milestone started*
