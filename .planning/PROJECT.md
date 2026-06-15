# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Current Milestone: v5.0 Numen Rework

**Goal:** Rework the existing UI/UX into the Numen vision — collapse the product to **one thread per video (a "Reading")**, mobile-first — by **rethemeing + restructuring the existing board/app components** (NOT a ground-up rebuild). Presentation-layer only; engine frozen at 3.19.0.

**Target features (v1):**
- Home (serif greeting + universal composer) + reskinned sidebar (reuse `useAnalysisHistory`); ingestion via the composer (`+` upload / paste-URL auto-detect); two layouts (centered empty → bottom-pinned active)
- Consolidated Reading thread: hero (`overall_score` + go/no-go gate + watch-through % + persona cloud) → 3 driver rows (Hook / Retention = *where they drop* / Shareability) → Fix First → deeper-read → **all rich board visuals kept as drill-downs**
- Stage-reveal (blocks materialize as each engine stage completes)
- Flat-warm visual system + token migration (retire Raycast glass; warm-dark matte; serif voice / sans data; coral evolved; score zones green/amber/red)
- Basic text follow-up (reuse "Ask the expert" chat as the thread tail)
- First-run live demo Reading on a known viral video

**Locked constraints:** Reuse `src/components/board/**` visuals as drill-downs (transplant off Konva, reskin). Do NOT reuse the `milestone/numen-surface` `numen/`+`reading/` kit (reference only). Konva retired; `/analyze` left dormant (not deleted). Score-forward, **no prose narration**. Engine **FROZEN 3.19.0** — no `lib/engine/` changes. The flat-warm visual system is **HUMAN-UAT-GATED** (locked only after human review). Component & motion libraries (Radix / shadcn / MagicUI / Aceternity / motion (Framer Motion)) permitted at executor discretion, subject to the flat-warm + calm-motion taste bar. Full brief: `.planning/NUMEN-REWORK-BRIEF.md`.

**Deferred (not v1):** agentic tools (Apify competitor analysis — "the moat"), in-thread monetization, desktop dense-instrument (Konva successor).

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
- `pnpm exec tsc --noEmit` returns 0 errors app-wide; `user_settings` migration confirmed live — v3.1
- Smoke runner cost field renamed `cost_cents_estimated`; billing API deferred while omni-plus is free — v3.1
- VERIF-04 all 5 sub-items closed: WR-04/WR-05 verified, IN-01 timer leaks fixed, IN-02 pgvector.ts centralized, IN-03 SSRF guard on processSoundEmbedding (T-06-13 closed) — v3.1
- Platt calibration removed entirely (corpus ≠ production distribution); engine passes raw weighted-sum score — v3.1

### Active — Intelligence Surface drop (3-milestone bundle)

#### M2-I: Result Surface — active in `~/virtuna-result-surface/`

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
- [ ] Watermark detection (pre-flight on upload)
- [ ] Trending sounds for my niche (surface audio fingerprint engine data)
- [ ] Idea generator (niche + wins/flops + trends → 5 video ideas)
- [ ] Steal-this-playbook (competitor video → personalized pattern)

#### M2-III: Compounding Intelligence — pending (forks after M2-I lands)

- [ ] Hook archetype library (taxonomy of viral hook patterns)
- [ ] Trend velocity / lifecycle prediction
- [ ] Outcome feedback loop (auto-scrape posted content after 48h — promoted from backlog)
- [ ] Wins/flops trend dashboard ("am I getting better?")

### Deferred (from abandoned landing milestones)

- [ ] Landing page rebuild — brand spine + 7-viewport narrative arc (carried from Brand Statement Landing). Deferred until product story settles via Intelligence Surface.
- [ ] Brand-spine codification ("Your audience, simulated.") across deck, social bios, future surfaces
- [ ] Visual metaphor lock for prediction (behavioral simulation + engine pipeline)
- [ ] Replace plagiarized Artificial Societies copy across all customer-facing surfaces

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
- Reviving paused `milestone/landing-page` branch -- starting fresh per Brand Statement Landing milestone; old branch abandoned
- "Viral" and "AI" in landing H1 / brand spine -- overused; weakens $100M+ venture positioning
- Maximalist motion-template aesthetic (animated beams everywhere, neon glow) -- conflicts with Anthropic/Linear/Raycast vibe

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
| Stand down the Numen Surface ground-up rebuild; retheme existing components instead (v5.0) | New -- ground-up proved too costly for the payoff; rich board visuals reused as drill-downs, not rebuilt |
| Visual system human-UAT-gated + component/motion libs (Radix/shadcn/MagicUI/Aceternity/motion+Framer Motion) permitted (v5.0) | New -- nail the flat-warm look exactly via human review; libs allowed at executor discretion within the taste bar |

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

**Shipped:** **v4.1 MVP Ready — Phase 1 engine (2026-06-11, ENGINE_VERSION 3.19.0)** merged to main + milestone closed early (P2–5 superseded by Numen Rework). **v4.0 Apollo (2026-06-06)** — engine rearchitected from a ~25-call score-and-fabrication machine into a 3-call knowledge-grounded expert (Omni verbatim → fold ∥ Apollo reasoner); insight is the hero, score demoted to an honest band, E2E ~312s→~62–74s, ENGINE_VERSION 3.8.0. Result Surface (2026-05-28), v3.1 Engine Hardening (2026-05-25), Engine Foundation v3.0.0 (2026-05-24), UI Dashboard (2026-03-18), Prediction Engine Integration (2026-02-27), Backend Reliability (2026-02-18), Prediction Engine v2 (2026-02-17), Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Current milestone:** **v5.0 Numen Rework** — active in `~/virtuna-numen-rework/` (`milestone/numen-rework`), started 2026-06-13. Presentation-layer UI/UX rework to the Numen vision: one-thread-per-video "Reading", flat-warm reskin, reuse of the existing board/app components. Engine frozen 3.19.0. Visual system human-UAT-gated; component libs (Radix/shadcn/MagicUI/Aceternity) permitted. Full brief: `.planning/NUMEN-REWORK-BRIEF.md`.
- **Phase 1: Foundation & Shell — Complete (2026-06-14).** Flat-warm `@theme` token SSOT (charcoal/cream/terracotta-coral, Newsreader serif), reskinned collapsible "Simulations" sidebar (glass stripped), new authed `/home` (serif greeting + two-layout composer + NumenMark, no chips), authed landing repointed to `/home`. THEME-06 visual system **locked** via live human-UAT gate. 13/13 reqs verified; full suite 1967 green; post-review fixes incl. an OAuth open-redirect (CR-01).
- **Phase 2: The Reading — Complete (2026-06-14).** The consolidated one-thread-per-video Reading on `/analyze/[id]` (Board mount inverted to `<Reading>` in `analyze/layout.tsx`, Konva board retired-not-deleted). Locked vertical IA: hero (ScoreGauge zone-colored via `bandTone()`, NO prose; AntiViralityHeader gate banner; hero-owned watch% rendered once; static PersonaCloud) → 3 driver rows (Hook/Retention-where-they-drop/Shareability, NEW 0-100 component not the 0-10 FactorBars) → Fix First (timestamped fixes + real-clipboard hook rewrites + "N more →") → Deeper read (clarity/substance/credibility). READ-10 no-cut-data guard + D-13 honest degradation. 9/9 reqs verified; full suite 2041 green; build clean; opus code review found+fixed a fabricated-`0%`-watch honesty hole (CR-01) + 5 warnings. Next: Phase 3 — Rich Visuals as Drill-Downs.

**Apollo north star (now live):** expert insight is the hero, not the score; the moat is Brain 1's distilled knowledge (Chase Hughes) grounded at inference via a cached system prompt — not fine-tuning, not RAG.

**Abandoned (2026-05):** Brand Statement Landing, Landing Page Redesign, Linear Landing Clone — all worktrees retained on disk for reference; see MILESTONES.md.

**Future milestones (post-Intelligence Surface drop):**
- iOS Capacitor wrapper — wrap Next.js webapp as Capacitor iOS app, App Store submission (~1 week, no native LLM)
- Landing rebuild — deferred until Intelligence Surface drop completes
- /about, /research, /manifesto supporting pages
- Weekly intelligence report (email) — needs scale data
- Brand-fit predictor (separate brand-deals milestone rewrite)
- External brand deals marketplace
- Competitor search/discovery by name or niche
- Ultra tier (Gemini 3.1 Pro + DeepSeek V4 Pro, 30s latency cap)

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
*Last updated: 2026-06-14 — v5.0 Numen Rework: Phase 2 (The Reading) complete. The consolidated Reading thread ships on `/analyze/[id]` (hero gauge + driver rows + Fix First + Deeper read; READ-10 honesty guard; opus review caught+fixed CR-01 fabricated-0% watch); 9/9 reqs, suite 2041 green, engine still frozen 3.19.0. Phases 1–2 of 5 done. Next: Phase 3 — Rich Visuals as Drill-Downs (transplant board visuals off Konva into the disclosure surfaces). Prior: v4.1 MVP Ready Phase 1 (engine) merged + closed early 2026-06-11.*
