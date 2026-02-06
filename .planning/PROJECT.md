# Virtuna

## What This Is

A social media intelligence platform with a Raycast-quality design system foundation. Built as a Next.js application with 36 production components, 100+ design tokens, and comprehensive documentation — enabling rapid, consistent UI development.

## Core Value

Raycast-quality design system enabling rapid, consistent UI development with coral (#FF7F50) branding.

## Requirements

### Validated

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

### Active

- [ ] Backend integration for brand deals/affiliate data
- [ ] Additional page UI milestones

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Style Dictionary / Tokens Studio pipeline -- manual export sufficient
- Real-time Figma sync -- manual reference sufficient
- Mobile native exports -- web-only
- Sound design -- future polish

## Context

**Current state:** v2.3 Brand Deals & Affiliate Page shipped (2026-02-06).
- ~23,000 LOC TypeScript/CSS (up from 26,311 base + ~10,700 added in v2.3)
- Tech stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth, Recharts
- 36 design system components + 30+ brand deals page components/hooks
- v0 MCP validated as UI generation tool for design-system-guided output
- Worktree: ~/virtuna-v2.3-brand-deals (branch: milestone/v2.3-brand-deals)
- 7-page showcase at /showcase
- 8 documentation files in docs/
- BRAND-BIBLE.md at repo root
- Deployed to Vercel

**Known issues:**
- --text-3xl is 30px vs Raycast 32px (intentional, flagged)
- 227 hardcoded values flagged for review (many intentional)
- Responsive showcase clipping on mobile
- Touch target threshold relaxed to 32x24px (desktop-first)
- 800ms hardcoded skeleton delay (should use Suspense with real data)

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
| v0 MCP for v2.3 UI generation | Good -- design system docs ensured consistent output |
| Solid surface cards over glass for grids | Good -- smooth scroll performance |
| Color semantics (orange/green/blue) from Brand Bible | Good -- consistent across all 3 tabs |
| Lifted state for applied deals/active links | Good -- state survives tab switches |
| Recharts v3 with function content tooltip | Good -- type-safe dark-mode chart |

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

## Shipped: v2.3 Brand Deals & Affiliate Page (2026-02-06)

**Delivered:** Three-tab brand deals page with filterable deal cards, affiliate link management, earnings dashboard — 43/43 requirements, 30+ components, full a11y.

**Parallel milestones:**
- v2.1 Dashboard Rebuild (main worktree)
- v2.2 Trending Page (separate worktree)

**Future milestones:**
- Backend integration for brand deals/affiliate data
- Additional page UI design

---
*Last updated: 2026-02-06 after v2.3 milestone shipped*
