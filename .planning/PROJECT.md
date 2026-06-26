# Virtuna

## What This Is

Numen — a **synthetic-population simulator**: the foresight layer for any decision. Three domain-general primitives — **PROFILE** (evidence → a population), **SIMULATE** (population + stimulus → reactions), **PREDICT** (reactions → a scored verdict) — that chain in one live pipeline. Today pointed at one vertical (TikTok creators, the "Socials" anchor pack); being generalized so users can define arbitrary populations + stimuli. Next.js 15 / TypeScript strict / Tailwind v4 / Supabase; flat-warm charcoal design system with a terracotta accent (the Raycast/coral system is RETIRED). SIM-1 engine (Flash text / Max video, auto-selected). Whop payments, two-tier SaaS.

## Core Value

A calibrated, interrogable synthetic population you can run any stimulus through and get back a grounded, honest (**Validated** vs **Directional**) read — the ownable category that generation (OpenAI/Anthropic) doesn't own. For creators today: whether content will resonate, and why. Generalizing to recruiters, conversations, customers — any audience the user can author or ground from evidence.

## Current Milestone: v7.0 Numen GSI

**Goal:** Turn Numen's socials-locked engine into a domain-blind synthetic-population simulator — extract Socials into Pack #1 behind a pluggable engine, then ship the General surface (Profile / Simulate / Predict over user-built audiences) with **Profile-a-chat → Simulate-reply** as the on-ramp wow. The creator (Socials) experience stays byte-identical; generality lives *behind* the Audience picker.

**Target features (v1):**
- **Engine/pack seam** — a `DomainPack` abstraction; Socials becomes Pack #1; the engine goes domain-blind
- **Pluggable scoring** — the success criterion is supplied by the pack/user; *wrap* the frozen Apollo/virality math as Pack #1's scorer (don't refactor it)
- **General SIM** — generalize `audiences` (drop the socials enums + 4-weight lock) into a domain-agnostic population on the signature substrate
- **Profile verb** — build a person/panel audience from uploaded evidence (chat/doc) → Profile card → saved to a General library
- **Simulate verb (General)** — run a stimulus through a General audience → reaction-distribution card
- **Predict verb** — analyst-panel scenario reasoning → probability / factors / confidence gauge; **always Directional** (assumptions + receipts, never an oracle)
- **Inbox widening** — accept text + file uploads (`.txt` / doc / screenshot), not just video/URL
- **Audience-as-front-door UI** — promote the Audience picker to the primary context-setter; Mode-scoped skills; generalize the ambient reactor
- **Validated/Directional trust badge** in the UI

**Locked constraints:** Creator composer untouched — generality lives *behind* the Audience picker. *Wrap*, don't refactor, the socials scoring math (it becomes Pack #1's scorer). The Phase 0 signature substrate (AudienceSignature, 2-model stack, fold↔calibrated-audience unify) is already on `main` — do **NOT** `git merge rework/engine-core` (content already landed; merge replays as conflicts/dupes). SIM-1 is a visible engine badge, never a user choice. Open-world prediction stays **OUT** (no owned population → no moat). Input vision (EXPLORATORY — walk every section, a brief wins where it conflicts): `.planning/NUMEN-GSI-VISION.md`.

**Deferred (not v7.0):** the SIM marketplace + rev-share flywheel; Anchor Pack #2 (Marketing); self-calibration (Directional→Validated promotion via user-uploaded outcomes).

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

**Shipped:** **v6.0 Numen Studio — creator suite P1–14 (2026-06-21, merged to main).** **v5.0 Numen Rework (2026-06-15)** — presentation-layer rework to the one-thread-per-video "Reading" + flat-warm charcoal reskin. **v4.1 MVP Ready — Phase 1 engine (2026-06-11, ENGINE_VERSION 3.19.0)** merged to main + milestone closed early (P2–5 superseded by Numen Rework). **v4.0 Apollo (2026-06-06)** — engine rearchitected from a ~25-call score-and-fabrication machine into a 3-call knowledge-grounded expert (Omni verbatim → fold ∥ Apollo reasoner); insight is the hero, score demoted to an honest band, E2E ~312s→~62–74s, ENGINE_VERSION 3.8.0. Result Surface (2026-05-28), v3.1 Engine Hardening (2026-05-25), Engine Foundation v3.0.0 (2026-05-24), UI Dashboard (2026-03-18), Prediction Engine Integration (2026-02-27), Backend Reliability (2026-02-18), Prediction Engine v2 (2026-02-17), Competitors Tool (2026-02-17), MVP Launch (2026-02-16), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**Current milestone:** **v7.0 Numen GSI** — active in `~/virtuna-numen-gsi/` (`milestone/numen-gsi`), started 2026-06-26. Generalize the socials-locked engine into a domain-blind synthetic-population simulator: engine/pack seam (Socials → Pack #1), pluggable scoring, `audiences` → general SIM, then the General surface (Profile / Simulate / Predict) with Profile-a-chat → Simulate-reply as the on-ramp wow. Creator core untouched; marketplace deferred. Phase 0 (signature substrate) already on `main`. Input vision: `.planning/NUMEN-GSI-VISION.md`. Requirements + roadmap defined via `/gsd-new-milestone` (this run).

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
*Last updated: 2026-06-26 — v7.0 Numen GSI milestone started. Reframes Numen as a synthetic-population simulator (Profile / Simulate / Predict): extract Socials into Pack #1 behind a domain-blind engine, make scoring pluggable, generalize `audiences` → general SIM, then ship the General surface with Profile-a-chat → Simulate-reply as the wow. Creator core byte-identical; marketplace + Pack #2 deferred. Phase 0 signature substrate already merged to main (do NOT `git merge rework/engine-core`). What This Is / Core Value refreshed off the retired Raycast/coral framing. Requirements + roadmap generated this run. Prior: v6.0 Numen Studio shipped 2026-06-21.*
