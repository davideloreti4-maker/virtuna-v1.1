# Virtuna

## What This Is

A social media intelligence platform for TikTok creators. Helps creators predict viral content, discover brand deals, and earn through an affiliate engine. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens, coral #FF7F50 branding). Two-tier SaaS model (Starter/Pro) with Whop payments integration, progressive onboarding, and in-product referral program.

## Core Value

AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

## Current Milestone: v6.0 Numen Studio

**Goal:** Open Numen past "analyze a recorded video" into a creator **studio** — generation tools where every output is **tested on a synthetic audience (SIM-1) before the creator acts on it** — plus general open chat with no prior video. Generation is the surface; **SIM-1-on-everything is the moat.** Builds on the v5.0 Reading surface and reuses its typed-block renderers.

**Target features (v1):**
- **De-risk (resolved by owner experience — no gate phase):** text-only SIM-1 Flash predicts relative pull, improving with the right data/context/framing (winning framing calibrated inside ENGINE-01); Knowledge-Core general-use generative rebuild committed unconditionally (the long pole); Remix-reuse scout deferred with Remix to v6.1.
- **Foundation:** thread-model generalization (nullable `reading_id` + `type` discriminator → grounded vs open threads); **SIM-1 Flash** text-mode engine path (personas react to text, no video); composer as the **universal door**; open chat thread.
- **Knowledge-Core rebuild (THE value):** restructure from scratch to serve generation across modes — a shared generative base + per-mode slices (Ideas, Hooks) + general chat. Content/curation workstream first, code second.
- **Ideas → Hooks moat chain:** Ideas (auto from profile / seeded) → idea cards with SIM-1 Flash viability hint → "Develop this →" → Hooks (N ranked hook cards, each with a Flash pull-score + archetype) → "Test full →" → **Test** (the existing Reading, unchanged). Content-first, scores-stream; Flash auto-fills, Max explicit.
- **Compact creator profile / onboarding:** 3-tier grounding (A persistent cards · B per-request input · C link-social→Apify metadata prefill); cold-start → platform baselines.

**Locked constraints:** **Engine OPEN; validated behavior PROTECTED by a regression gate** (not frozen) — text-mode / generation / KC / fold refactors permitted; keep the engine suite green, preserve same-video score-identity on the SIM-1 Max (video) path, and bump `ENGINE_VERSION` on deliberate scoring changes. Qwen-only. Rich UI via the **fixed numen-rework typed-renderer library** — NOT model-generated UI (craft trap), NOT plain text (loses the moat). Flat-warm visual system (THEME-06) is the design SSOT. Inline-scoring committed (no spike gate — owner-confirmed text-Flash fidelity; winning framing calibrated in ENGINE-01). Discuss input (EXPLORATORY, walk through every section): `.planning/NUMEN-TOOLS-VISION.md`.

**Deferred (v6.1+):** **Scripts** and **Remix** tools (Remix revives `milestone/viral-remix` prior art); in-thread monetization; brand-profile entity; RAG over creator history; desktop dense-instrument.

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
| Open Numen into a creator studio: generation tools + SIM-1-on-everything as the moat (v6.0) | New -- pre-production is the highest-leverage creator moment; reuse the audience-sim earlier ("test before you shoot") |
| v6.0 v1 scope = Foundation + Ideas→Hooks chain + open chat; defer Scripts + Remix to v6.1 | New -- prove the moat via the cleanest chain with least surface; Remix is not greenfield (revive viral-remix) |
| Engine OPEN for v6.0; SIM-1 Max video-scoring protected by a regression gate, not frozen (v6.0) | New -- v5.0's "no engine changes" was a presentation-milestone scope device; v6.0 does additive engine work, so freeze → regression gate (suite green + same-video score-identity + `ENGINE_VERSION` bump on deliberate changes) |
| Knowledge-Core ground-up generative rebuild as the foundation (v6.0) | New -- today's KC is a scoring brain; generation needs generative craft (different shape) — THE value, the long pole |
| Rich tool output via fixed numen-rework typed-renderer library, NOT model-generated UI (v6.0) | New -- generative UI was the craft trap hit twice on landing; reuse the Reading block library |

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

**Shipped:** **v5.0 Numen Rework (2026-06-15)** — presentation-layer rework to one-thread-per-video "Reading"; flat-warm THEME-06 system; board visuals transplanted off Konva into drill-downs; 27/28 v1 reqs (DEMO-01 deferred); engine frozen 3.19.0. Landed on `main` (#20, #21). **Landing v2 (2026-06-15)** — refined Numen marketing landing (Foundation→Proof&Conversion); landed on `main` (#22). *(Both shipped but not yet archived to `.planning/milestones/` — pending a `/gsd-complete-milestone` hygiene pass on `main`.)* **v4.1 MVP Ready — Phase 1 engine (2026-06-11, ENGINE_VERSION 3.19.0)** merged + closed early. **v4.0 Apollo (2026-06-06)** — engine rearchitected into a 3-call knowledge-grounded expert (Omni verbatim → fold ∥ Apollo reasoner); insight the hero, score an honest band, E2E ~312s→~62–74s. Result Surface (2026-05-28), v3.1 Engine Hardening (2026-05-25), Engine Foundation v3.0.0 (2026-05-24), UI Dashboard (2026-03-18), Prediction Engine Integration (2026-02-27), Backend Reliability (2026-02-18), Prediction Engine v2 (2026-02-17), Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Current milestone:** **v6.0 Numen Studio** — active in `~/virtuna-numen-tools/` (`milestone/numen-tools`), started 2026-06-16 from trunk. Opens Numen from single-video analyzer into a creator studio: generation tools (Ideas → Hooks) where **every output is tested on a synthetic audience (SIM-1) before the creator acts** + open chat. Generation is the surface; SIM-1-on-everything is the moat. Builds on the v5.0 Reading surface (reuses its typed-block renderers). v1 = de-risk spikes (SIM-1 Flash text-fidelity gates the build) → foundation (thread-model generalize + Flash text-mode + open chat) → **Knowledge-Core generative rebuild (THE value, the long pole)** → the Ideas→Hooks moat chain landing on Test. **Engine open; SIM-1 Max video-scoring protected by a regression gate** (not frozen) — new work = Flash text-mode + generation + KC rebuild. Scripts + Remix deferred to v6.1. Discuss input (EXPLORATORY): `.planning/NUMEN-TOOLS-VISION.md`; identity: `.planning/MILESTONE.md`.

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
*Last updated: 2026-06-16 — v6.0 Numen Studio launched from trunk via `/gsd-new-milestone` (worktree `~/virtuna-numen-tools/`, branch `milestone/numen-tools`). Opens Numen into a creator studio: Ideas→Hooks generation tools where every output is SIM-1-tested before the creator acts, + open chat. v1 = spikes → foundation → Knowledge-Core generative rebuild → the moat chain; Scripts + Remix deferred to v6.1; engine unfrozen for v6.0 (SIM-1 Max video-scoring protected by a regression gate). Prior: v5.0 Numen Rework + Landing v2 both shipped to main (pending archival). Next: define REQUIREMENTS.md + ROADMAP.md in this worktree.*
