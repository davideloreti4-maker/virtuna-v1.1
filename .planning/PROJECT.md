# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Status: M2 (Intelligence Surface) + Landing v1 active in parallel

**Most recently shipped:**
- **Engine Hardening v3.1** (2026-05-25) — TS hygiene (966 → 0 errors, `user_settings` ripped out), DashScope billing smoke runner wired, M1 verification debt closed (WR-04/05 cron N+1 + audio_description bounds, IN-01/02 try-finally + pgvector cast, IN-03 SSRF `sound_url` allowlist). Platt calibration dropped entirely (text-vs-video path mismatch — not salvageable). Audio fingerprint deferred to M3.
- **Engine Foundation v3.0.0** (2026-05-24) — 13-phase Qwen-only backend: video segmentation, multi-persona simulation, benchmark retrieval, creator profile, SSE pipeline, two-tier cache.

**Active milestones:**

| Milestone | Worktree | Status |
|-----------|----------|--------|
| **Landing v1** — 11-phase animated landing page (Linear/Raycast + OpusClip conversion patterns), built at `/v3`, cutover to root in Phase 11 | `~/virtuna-landing/` | **Active — Phase 3 next** (Phases 1-2 done 2026-05-25) |
| **M2-I: Result Surface** — polished result card, live persona viz, mobile route, share/export, reshoot script, optimal post time, WOW onboarding | `~/virtuna-result-surface/` | **Active — Phase 1 next** (started 2026-05-24) |
| **M2-II: Iteration & Niche Intelligence** — concept mode, A/B variants, cross-platform repurposing, watermark detection, trending sounds, idea generator, steal-this-playbook | TBD | Forks after M2-I lands |

**M3 starts in parallel with M2 UX phases** — engine quality pass + compounding intelligence + new surfaces. See M3 section in requirements below.

**Milestone structure decision (2026-05-25):** M2-III (Compounding Intelligence) moved to M3. Outcome feedback loop and wins/flops trend are data-gated by real M2-I usage — shipping them before creators have used Result Surface produces an empty compounding loop. M2 engine debt (stratified validation, threshold re-tuning, audio fingerprint, rules rebuild) also moved to M3 — none of it gates M2 UX.

**Abandoned landing predecessors (see MILESTONES.md):** Brand Statement Landing (2026-05-11), Landing Page Redesign (2026-05-24), Linear Landing Clone (2026-05-24) — all superseded by Landing v1.

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
- TS hygiene: 966 → 0 errors, `user_settings` dead routes ripped out, `database.types.ts` regenerated from live schema -- Engine Hardening v3.1
- DashScope International billing wired into smoke runner -- Engine Hardening v3.1
- M1 verification debt closed: WR-04 cron N+1 bulk pre-fetch, WR-05 audio_description bounds flattened, IN-01 try/finally clearTimeout, IN-02 pgvector cast helper, IN-03 `sound_url` SSRF allowlist -- Engine Hardening v3.1

### Active

#### Landing v1 — `~/virtuna-landing/` (branch `milestone/landing`)

- [x] Phase 1: Foundation + Scaffold — `/v3` route, MotionConfig, LandingHeader, sitemap/robots
- [x] Phase 2: Hero + Final CTA + Vision Beat — WordRotate, ShimmerButton, Spotlight, VisionBeat, LandingFooter
- [ ] Phase 3: Above-Fold Credibility Hook — thin logo bar + "Backed by" microcopy below CTAs
- [ ] Phase 4: Interactive Demo — sample picker, 4-stage loader, animated insight reveal
- [ ] Phase 5: How It Works Pipeline — AnimatedBeam horizontal (desktop) / TracingBeam vertical (mobile)
- [ ] Phase 6: Bento + Dashboard Reveal — asymmetric BentoGrid 3 cells + MacbookScroll
- [ ] Phase 7: Comparison vs Alternatives — positioning grid
- [ ] Phase 8: The Science — StickyScroll + citation chips + dataset stats
- [ ] Phase 9: Social Proof — Logo Marquee + AnimatedTestimonials
- [ ] Phase 10: Pricing + FAQ — 2-col Starter/Pro + FAQ accordion
- [ ] Phase 11: Polish + SEO + A11y + Perf + Cutover — Lighthouse ≥90, `/v3` overwrites root (Davide approval gate)

#### M2-I: Result Surface — `~/virtuna-result-surface/` (branch `milestone/result-surface`)

- [ ] Polished result card with 8 panels (retention, personas, hook decomp, similar videos, narrative, emotion arc, baseline, anti-virality)
- [ ] Live audience simulation viz (SSE-driven, 60fps on iPhone 13+)
- [ ] Mobile-first analysis route (Lighthouse ≥90)
- [ ] Share & export (Satori-generated images + public permalinks)
- [ ] Reshoot script generator (packages engine counterfactuals + A/B variants)
- [ ] Optimal post-time recommendation (new engine signal)
- [ ] First-analysis WOW onboarding (tutorial overlay + paced verdict reveal)

#### M2-II: Iteration & Niche Intelligence — pending (forks after M2-I lands)

- [ ] Concept mode (text-only "predict my hook idea")
- [ ] A/B variant generation flow
- [ ] Cross-platform repurposing (TikTok→Reels/Shorts)
- [ ] Watermark detection (pre-flight on upload, TF.js)
- [ ] Trending sounds for my niche (surface audio fingerprint engine data)
- [ ] Idea generator (niche + wins/flops + trends → 5 video ideas)
- [ ] Steal-this-playbook (competitor video → personalized pattern)

#### M3: Engine Quality + Compounding Intelligence + New Surfaces — active in parallel with M2 UX

**Engine quality debt (carried from M1/v3.1, none gate M2 UX):**
- [ ] Plans 06/07 stratified validation rerun under Qwen with fresh per-video diffs + score-band stratification
- [ ] Wave 3 persona simulation threshold re-tuning (≥7/10 trigger) under Qwen
- [ ] Wave 4 `platform_fit` numeric threshold re-tuning under Qwen
- [ ] Rebuild rule scoring from video transcript signal (not text-mode captions)
- [ ] Audio fingerprint re-enable: `embedder.ts` + `audio-fingerprint.ts` + D-F4 cron at `/api/cron/calculate-trends` + unskip 17 deferred tests (Phase 16 deferred from Engine Hardening)

**Compounding intelligence (data-gated by M2-I real usage):**
- [ ] Outcome feedback loop — auto-scrape posted videos 48h after analysis, capture real engagement, feed back into corpus
- [ ] Wins/flops trend dashboard — creator accuracy trend over time ("am I getting better?")
- [ ] Hook archetype library — taxonomy of viral hook patterns by niche
- [ ] Trend velocity / lifecycle prediction — is this trend rising, peak, or dying?

**New surfaces:**
- [ ] History view connected to real prediction results (currently no-op)
- [ ] Trending page re-launch with real backend data (currently mock)
- [ ] Analytics dashboard (confidence distributions, cost trends, model drift)
- [ ] In-app prediction viz rebuild (visual metaphor locked in Landing v1 / Brand Statement Landing)
- [ ] `/about`, `/research`, `/manifesto` supporting pages (Numen Machines lab credibility)
- [ ] External brand deals marketplace (real partnerships, not mock data)
- [ ] Competitor search/discovery by name or niche (currently manual add only)
- [ ] Weekly intelligence report (email, needs scale data)

### Backlog (undated, reactivate selectively)

- [ ] Video upload pipeline via Supabase Storage (currently direct-to-Qwen)
- [ ] TikTok URL extraction (Apify scrape → video → Qwen)
- [ ] Niche/hashtag fields functional in prediction flow
- [ ] iOS Capacitor wrapper (App Store submission, ~1 week, no native LLM)
- [ ] Ultra tier (future model upgrade path)
- [ ] Brand-fit predictor (separate brand-deals milestone rewrite)
- [ ] Series planner / content calendar
- [ ] Coaching feed / niche leaderboard

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Mobile native app -- web-first
- TikTok OAuth -- manual @handle input sufficient for MVP
- Sound design -- future polish
- Reviving paused `milestone/landing-page` branch -- starting fresh per Brand Statement Landing milestone; old branch abandoned
- "Viral" and "AI" in landing H1 / brand spine -- overused; weakens $100M+ venture positioning
- Maximalist motion-template aesthetic (animated beams everywhere, neon glow) -- conflicts with Anthropic/Linear/Raycast vibe

## Context

**Current state (2026-05-25):** Engine Foundation v3.0.0 + Engine Hardening v3.1 shipped to main. Two active worktrees: Landing v1 (P3 next) + Result Surface (P1 next). M3 engine quality work starts in parallel.
- Tech stack: Next.js 15 (App Router), TypeScript strict, Tailwind v4, Supabase, Qwen-Omni (DashScope International), Recharts, d3-hierarchy, d3-quadtree, @sentry/nextjs, Vitest, Magic UI + Aceternity (landing only)
- Engine v3.0.0: Qwen-only pipeline, SSE `onStageEvent`, two-tier prediction cache, 9-card creator profile, 10-persona Wave 3 simulation, pgvector benchmark retrieval (video-mode disabled pending M3 re-embed)
- 36 design system components, 100+ tokens (Raycast-accurate)
- Real Supabase auth (Google OAuth PKCE), two-tier Whop payments (Starter/Pro), referral program
- Canvas hive viz: 1300+ nodes, 60fps
- Deployed to Vercel

**Known blockers before public go-live:**
- Whop plan IDs need creation in Whop dashboard
- Referral bonus amount undecided (business decision)
- Whop sandbox never tested end-to-end
- Result Surface (M2-I) not yet shipped — analysis flow not polished
- Landing v1 not yet shipped — live landing still the old page
- 68 console.* calls remain in non-engine files (API routes, client components) — tech debt

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
| DeepSeek for strategy/recommendations, Gemini for viral/hashtag | Good -- cost-effective dual-model (pre-v3.0; now Qwen-only) |
| Qwen-only migration (DashScope International) | Good -- eliminated Gemini Files API outages + HEVC issues + DeepSeek hang risk; single model, simpler pipeline |
| Platt calibration dropped entirely (Engine Hardening v3.1) | Good -- text-vs-video path mismatch made calibration a category error; removed `applyPlattScaling` + `platt_parameters` table |
| user_settings dead routes ripped out (Engine Hardening v3.1) | Good -- 966 TS errors cleared; table never existed in live Supabase |
| Audio fingerprint deferred to M3 (Engine Hardening v3.1) | Good -- sound-driven trend-riding is secondary signal; not blocking M2 UX |
| M2-III (Compounding Intelligence) moved to M3 | Good -- outcome feedback loop + wins/flops trend are data-gated by M2-I real usage; shipping earlier produces empty pipelines |
| M2 engine debt moved to M3 | Good -- none of it gates M2 UX; Wave 3/4 threshold re-tuning benefits from real usage data anyway |
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

**Shipped:** Engine Hardening v3.1 (2026-05-25), Engine Foundation v3.0.0 (2026-05-24), UI Dashboard (2026-03-18), Prediction Engine Integration (2026-02-27), Backend Reliability (2026-02-18), Prediction Engine v2 (2026-02-17), Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Active:**
- Landing v1 — `~/virtuna-landing/` (branch `milestone/landing`). Phase 3 next. 11 phases total.
- M2-I: Result Surface — `~/virtuna-result-surface/` (branch `milestone/result-surface`). Phase 1 next. 7 phases total.
- M3 engine quality work — starts in parallel, no dedicated worktree yet.

**Abandoned (2026-05):** Brand Statement Landing, Landing Page Redesign, Linear Landing Clone — worktrees deleted 2026-05-25, branches retained in git history; see MILESTONES.md.

**Worktrees (as of 2026-05-25):**
- `~/virtuna-v1.1/` — main
- `~/virtuna-engine-foundation/` — milestone/engine-foundation (merged, retained)
- `~/virtuna-engine-hardening/` — milestone/engine-hardening (shipped, retained)
- `~/virtuna-landing/` — milestone/landing (active)
- `~/virtuna-result-surface/` — milestone/result-surface (active)

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
*Last updated: 2026-05-25 — Engine Hardening v3.1 shipped. Milestone restructure: M2 = M2-I (Result Surface) + M2-II (Iteration & Niche Intelligence) only. M2-III (Compounding Intelligence) moved to M3 (data-gated by real M2-I usage). All M2 engine debt moved to M3 (none gates M2 UX). Landing v1 active in parallel. 7 stale worktrees removed.*
