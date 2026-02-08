# Virtuna

## What This Is

A social media intelligence platform with a Raycast-quality design system foundation. Built as a Next.js application with 36 production components, 100+ design tokens, and comprehensive documentation — enabling rapid, consistent UI development. All design tokens are 1:1 aligned with Raycast.com (except coral #FF7F50 branding).

## Core Value

Raycast-quality design system enabling rapid, consistent UI development with coral (#FF7F50) branding.

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

### Active

- [ ] Floating glassmorphic sidebar (GlassPanel, always visible, pushes content)
- [ ] Dashboard forms rebuilt with design system components (ContentForm, SurveyForm, TestTypeSelector)
- [ ] All dashboard modals rebuilt with design system (CreateSociety, DeleteTest, LeaveFeedback, SocietySelector)
- [ ] Results panel rebuilt with design system (ImpactScore, AttentionBreakdown, Variants, Insights, Themes)
- [ ] Top bar rebuilt (ContextBar, FilterPills, LegendPills)
- [ ] LoadingPhases simulation progress rebuilt with design system
- [ ] Mobile nav updated for floating sidebar
- [ ] Hive node visualization (center thumbnail + 3-layer node hierarchy)
- [ ] Node click interaction (glow/scale + info card)
- [ ] Node hover interaction (highlight connected nodes)

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Style Dictionary / Tokens Studio pipeline -- manual export sufficient
- Real-time Figma sync -- manual reference sufficient
- Mobile native exports -- web-only
- Sound design -- future polish

## Context

**Current state:** v2.3.5 Design Token Alignment shipped (2026-02-08).
- ~32,100 LOC TypeScript/CSS
- Tech stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth
- 36 design system components across 4 families, 100+ design tokens (all Raycast-accurate)
- Inter font throughout (Funnel Display/Satoshi removed)
- Zero-config GlassPanel with Raycast neutral glass
- GradientGlow, GradientMesh, primitives/GlassCard deleted (not Raycast patterns)
- BRAND-BIBLE.md rewritten as Raycast Design Language reference
- Trending page at /trending with TikTok-style video feed
- Dashboard has ~30 app components with hardcoded styles (pre-design-system)
- 7-page showcase at /showcase
- 8 documentation files in docs/
- Deployed to Vercel

**Known issues:**
- --text-3xl is 30px vs Raycast 32px (intentional, flagged)
- GlassCard (ui/card.tsx) uses bg-white/5 instead of bg-transparent (functional, not pixel-perfect)
- Card hover uses simple bg-white/2% instead of Raycast ::after radial gradient
- --shadow-button-secondary token defined but not consumed
- Responsive showcase clipping on mobile
- Touch target threshold relaxed to 32x24px (desktop-first)
- Analyze button routes to /viral-predictor which doesn't exist yet (tech debt)

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

**Shipped:** v2.3.5 Design Token Alignment (2026-02-08)

**In progress:** v2.1 Dashboard Rebuild (main branch, phases 45-46 complete)

**Future milestones:**
- v3.1 Landing Page (worktree at ~/virtuna-v3.1-landing-page/)
- v2.3 Brand Deals page
- Trending page backend (Apify, AI classification, TanStack Query)

---
*Last updated: 2026-02-08 after v2.3.5 milestone*
