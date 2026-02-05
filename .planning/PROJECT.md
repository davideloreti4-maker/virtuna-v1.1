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

### Active

(None -- define with `/gsd:new-milestone`)

### Out of Scope

- Light mode theme variant -- dark-mode first, defer to v2.1+
- Storybook integration -- showcase sufficient for now
- Style Dictionary / Tokens Studio pipeline -- manual export sufficient
- Real-time Figma sync -- manual reference sufficient
- Mobile native exports -- web-only
- Sound design -- future polish

## Context

**Current state:** Shipped v2.0 Design System Foundation (2026-02-05).
- 26,311 LOC TypeScript/CSS
- Tech stack: Next.js 14+ (App Router), TypeScript strict, Tailwind CSS v4, Supabase Auth
- 36 components across 4 families, 100+ design tokens
- 7-page showcase at /showcase
- 8 documentation files in docs/
- BRAND-BIBLE.md at repo root
- Deployed to Vercel

**Known issues:**
- --text-3xl is 30px vs Raycast 32px (intentional, flagged)
- 227 hardcoded values flagged for review (many intentional)
- Responsive showcase clipping on mobile
- Touch target threshold relaxed to 32x24px (desktop-first)

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

---
*Last updated: 2026-02-05 after v2.0 milestone*
