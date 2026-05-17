# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Current Milestone: Engine Foundation

**Worktree:** `~/virtuna-engine-foundation/` (branch `milestone/engine-foundation`)
**Companion milestone "Brand Statement Landing" continues on main; this is parallel work.**

**Goal:** Build, train, and validate the Virtuna content intelligence engine. Ship measurable accuracy improvements *before* investing in polished UX. The follow-up milestone "Intelligence Surface" builds live audience viz, polished result card, mobile route, and concept mode on top of a *validated* engine.

**Why split into two milestones:** A new insight enabled it — we can build a labeled training corpus by scraping competitor videos with known real outcomes (viral / average / underperforming). This makes the engine **objectively measurable** before we invest in expensive UX. M1 ships when accuracy improves on the corpus by a target threshold. M2 ships when UX is polished.

**Engine architecture (all additive — no rewrite of existing pipeline.ts or aggregator.ts):**

```
Wave 0 (new): Content type + hierarchical niche detection (V3, ~$0.001)

Wave 1 (parallel, expanded):
 ├ Gemini hook segment (0-3s, 2.5 Pro)
 ├ Gemini body segment (2.5 Flash)
 ├ Gemini CTA segment (last 3s, 2.5 Flash)
 ├ Audio analysis + fingerprint match (folded into video calls)
 ├ Creator context (enriched with 9-card profile)
 ├ Rule scoring (existing)
 └ Benchmark retrieval (pgvector top-K similar competitor videos)

Wave 2: DeepSeek R1 synthesis (existing) + Trend enrichment (existing)

Wave 3 (new): 10 personas (FYP-weighted) on deepseek-chat V3
 - 6 FYP non-followers (demographically diverse) — TikTok pushes mostly to FYP
 - 2 niche-aligned discovery
 - 1 returning follower / loyalist
 - 1 cross-niche curiosity (cross-pollination signal)

Stage 9: Aggregator (extended via existing SignalAvailability pattern)
 New signals: personas (replaces single behavioral),
              audio, retrieval, hook decomp, platform-fit
 Platt calibration trained on the new corpus

Stage 10 (new): Self-critique pass
 V3 grades aggregator output for internal consistency,
 cross-references creator's wins/flops (Card 6)

Stage 11 (new): Counterfactual suggestions
 V3 generates "what if hook moved to 0:02" alternatives
```

**Pipeline gains `onStageEvent` callback** — SSE infrastructure ready for M2 viz consumption.

**Creator profile (9-card interview, modal on first upload click, individually skippable, truthfulness emphasized):**
1. **Card 0** — Target platform (TikTok / IG Reels / YT Shorts, multi-select)
2. **Card 1** — Niche (hierarchical: primary → sub-niche → micro-niche)
3. **Card 2** — Target audience (age, gender, geo, language)
4. **Card 3** — Goal + stage (growth / engagement / brand deals / conversion × new / growing / established)
5. **Card 4** — Content style (talking head / B-roll / edu / comedy / tutorial / vlog)
6. **Card 5** — Reference creators (1-3 aspirational)
7. **Card 6** — Past wins + flops (1-2 each)
8. **Card 7** — Posting cadence
9. **Card 8** — Pain points

Profile feeds the engine: persona allocation weighting, suggestion framing, benchmark pool filtering, self-critique grounding, platform-fit weighting.

**Training corpus (the unlock):**
- 500 videos, 30-day rolling
- Stratified: 100 viral, 200 average, 200 underperforming
- Multi-niche (beauty, fitness, edu, comedy, lifestyle, more)
- Outcome metadata: views, completion %, shares, comments, saves
- Powers: eval framework + ML classifier audit + Platt calibration training + regression detection across engine versions

**Cost per analysis (30s video):** ~$0.065 (~$0.05 off-peak DeepSeek discount). Full breakdown in REQUIREMENTS.md.

**Engine accuracy acceptance gate:** Engine v3 must demonstrate measurable improvement vs v2.1 baseline on corpus benchmark before this milestone ships. Target threshold set in Phase 1 after baseline measurement.

**Platform algorithm targets:** TikTok (primary), Instagram Reels (secondary), YouTube Shorts (tertiary). Per-platform algorithm-fit signal in aggregator.

**Out of scope this milestone (deferred to "Intelligence Surface" milestone):**
- Live audience simulation viz (SSE-driven hive extension)
- Polished result card (retention curve, persona panels, hook decomp UI, similar videos panel, reasoning narrative)
- Mobile-first analysis route
- Concept mode (text-only "predict my hook idea")
- A/B variant generation
- Hook archetype library
- Trend velocity / lifecycle prediction
- Cross-platform repurposing analysis
- Comparative baseline display
- Watermark detection UI
- Emotion arc visualization
- Anti-virality / don't-post-yet UI

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

### Active (Engine Foundation milestone — this worktree)

- [ ] Training corpus built (500 stratified competitor videos with known outcomes, 30-day rolling, multi-niche)
- [ ] Engine evaluation harness: predictions vs actual outcomes, per-signal contribution analysis, calibration drift, regression detection
- [ ] 9-card creator interview modal (mandatory first-time, individually skippable, modal on first upload click)
- [ ] `creator_profiles` table schema + edit-from-settings flow
- [ ] Pipeline `onStageEvent` callback + SSE infrastructure in /api/analyze
- [ ] Engine versioning + prediction provenance instrumented
- [ ] Caching layer (content hash, persona prompts via DeepSeek input cache, niche taxonomy)
- [ ] Wave 0: content type classifier + hierarchical niche detector (V3)
- [ ] Video segmentation via native Gemini videoMetadata (Pro hook + Flash body/CTA, parallel)
- [ ] Multi-modal hook decomposition (visual / audio / text / speech sub-scores + coherence + cognitive load)
- [ ] Audio analysis stage (real, fills no-op) + audio fingerprint match against trending sounds DB
- [ ] Wave 3: 10-persona audience simulation on V3 with FYP-weighted allocation (6 FYP + 2 niche + 1 loyalist + 1 cross-niche)
- [ ] Benchmark retrieval: pgvector setup, embedding pipeline, top-K similar competitor videos
- [ ] Platform algorithm-fit signal (TikTok / IG Reels / YT Shorts specific weighting + creator-tier awareness)
- [ ] Self-critique pass on aggregator output (V3, references creator wins/flops)
- [ ] Counterfactual suggestions (V3, free for all tiers)
- [ ] ML classifier audit on corpus benchmark + Platt calibration training (is_calibrated finally true)
- [ ] Aggregator extension via SignalAvailability pattern (new signals + dynamic weights + engine v3.0 tag)
- [ ] Existing /api/analyze + video-upload component integrated with new engine
- [ ] Storage retention policy (auto-delete uploads after 30 days unless opted-in)
- [ ] Existing onboarding integration (new 9-card profile complements existing TikTok handle + goal personalization)
- [ ] Full accuracy benchmark run vs v2.1 baseline (acceptance gate before ship)

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

**Current milestone (this worktree):** Engine Foundation — engine accuracy + creator profile + training corpus (started 2026-05-11)
  - Phase 01 (Training Corpus & Eval Foundation): VERIFIED 2026-05-12 — 7/7 plans, baseline macro_f1=0.294, v3 target ≥0.338
  - Phase 02 (Creator Profile & 9-Card Interview): code-complete 2026-05-18 — 6/6 plans, migration live, 5/5 ROADMAP SCs verified in code, 8 HUMAN-UAT items pending browser confirmation

**Parallel milestone (main worktree):** Brand Statement Landing — landing-page rebuild + brand-spine codification (Phase 2 complete on main)

**Paused:** None

**Future milestones:**
- Intelligence Surface — live audience viz, polished result card, mobile route, concept mode (built on validated Engine Foundation)
- In-app prediction viz rebuild (uses visual metaphor locked in Brand Statement Landing)
- /about, /research, /manifesto supporting pages (extend brand spine)
- External brand deals marketplace
- Competitor search/discovery by name or niche

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
*Last updated: 2026-05-11 — Started Engine Foundation milestone in `~/virtuna-engine-foundation/` worktree (engine accuracy + creator profile + training corpus). Brand Statement Landing continues on main worktree.*
