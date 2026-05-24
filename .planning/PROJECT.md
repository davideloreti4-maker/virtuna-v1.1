# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Current Milestone: Landing v1

**Goal:** Ship a high-end SaaS-style animated landing page that converts TikTok creators AND impresses investors. Linear/Raycast-anchored aesthetic with OpusClip-grade conversion copy patterns. Replaces live landing page at root when shipped.

**Reference set:** Linear + Raycast (visual/structural anchor) · OpusClip (copy + conversion patterns, no aesthetic adoption).

**Audience strategy:** Single page converts creators (Starter/Pro signup) AND impresses investors (vision/science/trust). Equal priority — above-fold trust + below-fold demo serves both.

**Page structure (medium scroll, 7-8 sections):**
1. Hero (above-fold) — bold H1, brand stance, dual CTA
2. Interactive demo — user picks from 3-4 sample TikToks, scripted animated insight reveal (no real backend)
3. How it works — engine pipeline / data-flow (Linear-style diagram)
4. Three Surfaces bento — Prediction · Competitor Intelligence · Brand Deals
5. The Science — behavioral research moat, citation chips, dataset stats
6. Social proof stack — creator testimonials + product metrics (real or projected) + Numen Machines/partner logos
7. Pricing — full Starter/Pro table on-page
8. Final CTA + footer

**Stack additions (animation):**
- Magic UI (animated component library)
- Framer Motion / motion.dev (custom motion choreography)
- Aceternity UI (Linear/Raycast-aesthetic animated components)
- shadcn (already installed)
- Palette (pull in only if a section justifies it): GSAP ScrollTrigger, R3F/Three.js, tsParticles, Cult UI

**Demo strategy:** Scripted animated "insight reveal" — user picks from 3-4 sample TikToks, sees canned analysis play out (engine "thinking" → behavioral signals firing → confidence score emerging). No backend wiring.

**Content placeholders:** Platform screenshots/videos use placeholder assets during build; swap to real product captures in follow-up milestone. Copy treated as iterable — no upfront brand-spine lock phase.

**Trust signals (all in scope):** science/research moat · product metrics · creator testimonials · Numen Machines lockup + partner/PR logos.

**Out of scope this milestone:**
- Real wired prediction demo (scripted only)
- /about, /research, /manifesto supporting pages (CTAs may stub them)
- Lottie/Rive animations (no animator pipeline)
- Light mode

**Note on prior attempt:** v3.0 Brand Statement Landing (started 2026-05-10) was abandoned 2 of 6 phases in. Brand spine "Your audience, simulated." is no longer load-bearing — copy is fully open for iteration during build. Archive at `.planning/milestones/v3.0-brand-statement-landing/`.

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
- All 7 crons scheduled, end-to-end scrape→aggregate pipeline repaired -- Backend Reliability
- ML classifier rehabilitated with class weighting, real feature bridge, wired into 5-signal aggregator -- Backend Reliability
- Platt calibration conditionally wired into aggregator with is_calibrated metadata -- Backend Reliability
- Sentry + structured JSON logger (requestId, stage, duration_ms, cost_cents) across all engine modules -- Backend Reliability
- 203+ Vitest tests, >80% coverage on all engine modules -- Backend Reliability
- Hardened failure modes: calibration parsing, dual-LLM graceful degradation, circuit breaker mutex, creator profile trigger -- Backend Reliability

### Active (Landing v1 milestone)

<!-- REQ-IDs populated by REQUIREMENTS.md after this milestone's requirement-definition step. High-level scope below. -->

- [ ] Hero (above-fold) — bold H1, brand stance, dual CTA, animated visual
- [ ] Interactive demo (viewport 2) — user picks from 3-4 sample TikToks, scripted animated insight reveal
- [ ] How it works (viewport 3) — engine pipeline diagram, Linear-style motion
- [ ] Three Surfaces bento (viewport 4) — Prediction · Competitor Intelligence · Brand Deals
- [ ] The Science (viewport 5) — behavioral-research moat, citation chips, dataset stats
- [ ] Social proof (viewport 6) — creator testimonials + product metrics + Numen Machines/partner logos
- [ ] Pricing (viewport 7) — full Starter/Pro table on-page
- [ ] Final CTA + footer (viewport 8)
- [ ] Stack additions installed and integrated (Magic UI + Framer Motion + Aceternity UI + shadcn core; GSAP/R3F/tsParticles/Cult UI on-demand)
- [ ] Mobile responsive — single-column stack across all viewports
- [ ] Reference-set fidelity bar met (Linear + Raycast aesthetic, OpusClip conversion patterns)
- [ ] Launch: replace live landing page at root

### Backlog (deferred from prior milestones)

<!-- Items deferred during prior milestone churn; reactivate selectively in future milestones. -->

- [ ] History view connected to real prediction results
- [ ] Video upload pipeline (Supabase Storage → Gemini video analysis)
- [ ] TikTok URL extraction (Apify scrape → video content → Gemini)
- [ ] In-app prediction viz rebuild (replaces current hive — visual metaphor locked in Brand Statement Landing milestone, implementation deferred)
- [ ] DeepSeek reasoning exposed in results UI
- [ ] Niche/hashtag fields functional in prediction flow
- [ ] Data integrity (is_calibrated migration, reasoning field storage)
- [ ] Outcomes feedback loop (auto-scrape posted content after 48h)
- [ ] Analytics dashboard (confidence distributions, cost trends, model drift)
- [ ] Trending page re-launch with real backend data

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
- Real wired prediction demo on landing -- scripted animated reveal only for Landing v1
- /about, /research, /manifesto supporting pages -- CTAs may stub them, full pages deferred
- Lottie/Rive animations -- no animator pipeline in place
- Brand-spine "Your audience, simulated." as locked anchor -- v3.0 attempt abandoned, copy fully iterable in Landing v1
- Reviving paused `milestone/landing-page` branch or `milestone/landing-page-redesign` -- starting fresh on `milestone/landing` worktree

## Context

**Current state:** Prediction Engine Integration milestone in progress (started 2026-02-20). Backend Reliability shipped (2026-02-18). Prediction engine fully wired, tested, and hardened on the backend.
- ~43,000 LOC TypeScript (+20k lines from backend reliability work)
- Tech stack: Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth, Whop payments, Recharts, d3-hierarchy, d3-quadtree, @sentry/nextjs, Vitest
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
- Calibration has no outcome data yet (wired conditionally, degrades gracefully)
- 68 console.* calls remain in non-engine files (API routes, client components)

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
| Zero-dependency structured logger (not pino/winston) | Good -- edge-runtime compatible, no bundle impact |
| Client-side cost aggregation (not SQL RPC) | Good -- avoids migration for read-only admin endpoint |
| Class weights capped at 3x minimum | Good -- prevents ML overfitting to rare tiers |
| Per-instance circuit breaker mutex (not distributed) | Good -- matches serverless-per-instance scope |
| Global aggregate test coverage (not per-file) | Good -- avoids over-testing low-value branches |

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

## Current State

**Shipped:** UI Dashboard (2026-03-18), Prediction Engine Integration (2026-02-27), Backend Reliability (2026-02-18), Prediction Engine v2 (2026-02-17), Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Current milestone:** Landing v1 — high-end animated SaaS landing page from scratch (started 2026-05-24)

**Abandoned:** Brand Statement Landing v3.0 (2026-05-10, 2 of 6 phases done) — archived at `.planning/milestones/v3.0-brand-statement-landing/`. Brand-spine philosophy retired.

**Paused:** None

**Future milestones:**
- In-app prediction viz rebuild
- /about, /research, /manifesto supporting pages
- External brand deals marketplace
- Competitor search/discovery by name or niche
- Real wired prediction demo on landing (replace scripted reveal)

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-24 — Started Landing v1 milestone (high-end animated SaaS landing, Linear/Raycast aesthetic + OpusClip conversion patterns)*
