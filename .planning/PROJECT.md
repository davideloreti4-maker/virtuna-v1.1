# Virtuna

## What This Is

A social media intelligence platform with a Raycast-quality design system foundation. Built as a Next.js application with 36 production components, 100+ design tokens, and comprehensive documentation — enabling rapid, consistent UI development.

## Core Value

Raycast-quality design system enabling rapid, consistent UI development with coral (#FF7F50) branding.

## Requirements

### Validated

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

- [ ] Raycast-style landing page redesign presenting Virtuna as social media intelligence platform
- [ ] Hero section with abstract design system visuals + bold messaging + "Get started" CTA
- [ ] Feature sections with product screenshots (trending page, dashboard) and descriptions
- [ ] New navbar with Virtuna branding and navigation links
- [ ] Footer with links and social links
- [ ] Responsive design (desktop + mobile)
- [ ] Built with v0 generation per section, step by step

### Out of Scope

- Light mode theme variant -- dark-mode first, defer later
- Storybook integration -- showcase sufficient for now
- Style Dictionary / Tokens Studio pipeline -- manual export sufficient
- Real-time Figma sync -- manual reference sufficient
- Mobile native exports -- web-only
- Sound design -- future polish

## Context

**Current state:** v2.2 Trending Page UI shipped (2026-02-06).
- ~32,400 LOC TypeScript/CSS
- Tech stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth
- 36 design system components across 4 families, 100+ design tokens
- NEW: Trending page at /trending with TikTok-style video feed
- NEW: 14 trending-specific components (VideoCard, VideoGrid, VideoDetailModal, TikTokEmbed, etc.)
- NEW: Bookmark store with localStorage persistence
- Dashboard has ~30 app components with hardcoded styles (pre-design-system)
- 7-page showcase at /showcase
- 8 documentation files in docs/
- BRAND-BIBLE.md at repo root
- Deployed to Vercel

**Known issues:**
- --text-3xl is 30px vs Raycast 32px (intentional, flagged)
- 227 hardcoded values flagged for review (many intentional)
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

## Current Milestone: v3.1 Landing Page Redesign

**Goal:** Replace the societies.io clone landing page with a Raycast-style landing page that presents Virtuna as a social media intelligence platform.

**Target features:**
- Raycast-style landing page with hero, features, and CTA sections
- Hero with abstract design system visuals (glass cards, gradients) + bold messaging
- Feature sections showcasing product screenshots (trending page, dashboard)
- New navbar with Virtuna branding and navigation links
- Footer with links and socials
- Primary CTA: "Get started" → signup/dashboard
- Built entirely with existing Raycast design system via v0 generation per section

**Approach:** Dedicated v0 generation workflow — each section generated individually, reviewed, iterated, then assembled into the final page.

## Current State

**Shipped:** v2.2 Trending Page UI (2026-02-06), v2.0 Design System (2026-02-05)

**In progress:** v2.1 Dashboard Rebuild (main branch, Phase 47 at 4/5)

**Future milestones:**
- v2.3 Brand Deals page
- Trending page backend (Apify, AI classification, TanStack Query)
- Remix system (multi-step wizard, storyboard generation)

---
*Last updated: 2026-02-06 after v3.1 milestone started*
