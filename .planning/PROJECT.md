# Virtuna

## What This Is

An AI-powered social media intelligence platform that predicts content performance before posting. Built as a Next.js application with a Raycast-quality design system (36 components, 100+ tokens), dual-model AI prediction engine (Gemini Flash-Lite + DeepSeek R1), real-time trending data pipeline, and full API backend. All design tokens are 1:1 aligned with Raycast.com (except coral #FF7F50 branding).

## Core Value

AI-powered content intelligence that tells creators whether their content will resonate — and exactly why — before they post.

## Requirements

### Validated

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

- ✓ Supabase database with 5 tables, RLS policies, type generation, and 15+ seeded rules -- v1.0
- ✓ Dual-model AI prediction engine (Gemini Flash-Lite + DeepSeek R1) with circuit breaker -- v1.0
- ✓ Trending data pipeline (Apify scraper, webhook, trend calculator, rule validator) -- v1.0
- ✓ API routes with SSE-streaming analysis, cursor pagination, server-only keys -- v1.0
- ✓ TanStack Query v5 replacing all mock data imports across every page -- v1.0
- ✓ Simulation theater with real SSE events and 4.5s minimum duration -- v1.0
- ✓ Results card with AI scores, factors, personas, suggestions, and variants -- v1.0
- ✓ Outcome tracking (predicted vs actual comparison, delta calculation) -- v1.0
- ✓ ML scaffolding (retrain cron stub, adaptive weight fields, env guardrails) -- v1.0

### Active

**Current Milestone: Prediction Engine v2**

**Goal:** Transform the prediction engine from ~40-55% accuracy to ~75-85% through TikTok-aligned prompts, full video analysis, 10-stage pipeline with FeatureVector backbone, behavioral predictions, ML training on 5000 scraped videos, and calibration infrastructure.

**Target features:**
- TikTok-aligned Gemini factors (Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge)
- Full video analysis via Gemini (30s TikTok ~$0.008)
- DeepSeek V3.2-reasoning with 5-step CoT and behavioral predictions
- 10-stage pipeline with FeatureVector backbone and Creator Context
- New aggregation formula (behavioral 45% + gemini 25% + rules 20% + trends 10%)
- Hybrid semantic + regex rules with per-rule accuracy tracking
- ML model trained on scraped video data
- Platt scaling calibration
- Video upload + TikTok URL input modes
- Results UI with factor breakdown, behavioral predictions, before/after suggestions, persona quotes
- Rate limiting, caching, partial failure recovery

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Style Dictionary / Tokens Studio pipeline -- manual export sufficient
- Real-time Figma sync -- manual reference sufficient
- Mobile native exports -- web-only
- Sound design -- future polish

## Context

**Current state:** v1.0 Backend Foundation shipped (2026-02-13). All frontend milestones complete through v2.3.5. Backend fully functional.
- ~31,870 LOC TypeScript (backend foundation worktree)
- Tech stack: Next.js 15 (App Router), TypeScript strict, Tailwind CSS v4, Supabase (Auth + DB + RLS), TanStack Query v5, Zustand, Recharts, d3-hierarchy, d3-quadtree
- AI: Gemini 2.5 Flash-Lite (`@google/genai`), DeepSeek R1 (OpenAI-compatible), Zod schema validation
- Data: Apify scraper cron, webhook handler, trend calculator, rule validator, 4 cron jobs in vercel.json
- 36 design system components, 100+ design tokens (all Raycast-accurate)
- All pages wired to real API endpoints via TanStack Query (trending, deals, analysis, outcomes)
- Simulation theater with SSE events interleaved across pipeline stages, 4.5s minimum duration
- Deployed to Vercel

**Known issues:**
- --text-3xl is 30px vs Raycast 32px (intentional, flagged)
- GlassCard (ui/card.tsx) uses bg-white/5 instead of bg-transparent (functional, not pixel-perfect)
- Card hover uses simple bg-white/2% instead of Raycast ::after radial gradient
- --shadow-button-secondary token defined but not consumed
- Responsive showcase clipping on mobile
- Touch target threshold relaxed to 32x24px (desktop-first)
- Pre-existing blur="none" TypeScript errors in loading-phases.tsx (not valid GlassCard prop)
- Saved tab on trending still uses mock getAllVideos() until bookmark API exists
- Modal prev/next navigation disabled on trending video detail
- Analysis history limited to 50 rows (no cursor pagination)
- viewResult() compatibility shim in test-store (sidebar/forms still read from Zustand)

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
| Inter as sole font (replace Satoshi/Funnel Display) | Good -- 1:1 Raycast match, simpler loading |
| GlassPanel zero-config (4 props, fixed values) | Good -- consistent Raycast glass everywhere |
| Cards use bg-transparent (not gradient) | Good -- matches Raycast live audit |
| 5 WCAG AA normal-text failures accepted (status colors) | Acceptable -- all pass large-text AA |
| v0 MCP for v2.3 UI generation | Good -- design system docs ensured consistent output |
| Solid surface cards over glass for grids | Good -- smooth scroll performance |
| Color semantics (orange/green/blue) from Brand Bible | Good -- consistent across all 3 tabs |
| Lifted state for applied deals/active links | Good -- state survives tab switches |
| Recharts v3 with function content tooltip | Good -- type-safe dark-mode chart |
| Zustand persist for sidebar state | Good -- SSR-safe, replaces manual _hydrate |
| Zod v4 for form validation (no react-hook-form) | Good -- simple forms don't need form library |
| Canvas 2D for hive (not SVG) | Good -- 1000+ nodes at 60fps |
| d3-hierarchy + d3-quadtree for hive | Good -- deterministic layout + O(log n) hit detection |
| Ref-based animation state (not useState) | Good -- avoids re-renders during 60fps loop |
| Pointer Events for pinch-to-zoom | Good -- unified across mouse/touch/pen |
| Inline styles for backdrop-filter | Good -- workaround for Lightning CSS stripping |
| All backend in Next.js API routes (no Edge Functions) | Good -- simpler deployment, single runtime |
| TanStack Query for server state, Zustand unchanged for client | Good -- clean separation |
| Gemini 2.5 Flash-Lite (not deprecated 2.0 Flash) | Good -- future-proof from day one |
| Inline pipeline in SSE route (not runPredictionPipeline wrapper) | Good -- enables natural SSE interleaving |
| 4.5s theater minimum via async onSuccess + useRef cancel guard | Good -- prevents stale transitions |
| DB-to-UI mapper pattern in src/lib/mappers/ | Good -- clean shape conversion |
| Cursor-based pagination (base64url encoded) | Good -- scalable, no offset drift |
| Circuit breaker for DeepSeek (3 failures → Gemini fallback) | Good -- graceful degradation |

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

**Shipped:** v1.0 Backend Foundation (2026-02-13), v2.1 Dashboard Rebuild (2026-02-08), v2.3.5 Design Token Alignment (2026-02-08), v2.3 Brand Deals (2026-02-06), v2.2 Trending Page (2026-02-06), v2.0 Design System (2026-02-05)

**In progress:** Prediction Engine v2 (worktree at ~/virtuna-prediction-engine-v2/)

**Parallel milestones:**
- Landing Page (worktree at ~/virtuna-landing-page/) — landing, onboarding, pricing/payments, UI polish
- Prediction Engine v2 (worktree at ~/virtuna-prediction-engine-v2/) — engine overhaul, video analysis, ML training

---
*Last updated: 2026-02-16 after Prediction Engine v2 milestone started*
