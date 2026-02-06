# Virtuna — Project Instructions

## Identity

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase
- **Branding:** Coral (#FF7F50), Raycast aesthetic
- **Design system:** 36 components, Raycast-extracted tokens — see `BRAND-BIBLE.md`
- **Repo:** https://github.com/davideloreti/virtuna
- **Deployed:** Vercel

## Phase Number Registry

Global sequential numbering across all milestones. No gaps, no overlaps.

| Milestone | Phases | Status |
|-----------|--------|--------|
| v1.1 Pixel-Perfect Clone | 1-10 | Shipped |
| v1.2 Visual Accuracy | 11-14 | Shipped |
| v1.3.2-v1.7 (archived) | 15-38 | Archived |
| v2.0 Design System | 39-44 | Shipped |
| v2.1 Dashboard Rebuild | 45-49 | Active (main) |
| v2.2 Trending Page UI | 50-52 | Shipped |
| v2.3 Brand Deals | 53-57 | Shipped |
| v3.1 Landing Page | 58-63 | Active (worktree) |
| **Next available** | **64** | — |

## Worktrees

| Path | Branch | Milestone |
|------|--------|-----------|
| `~/virtuna-v1.1/` | `main` | v2.1 (active) |
| `~/virtuna-v3.1-landing-page/` | `milestone/v3.1-landing-page` | v3.1 |

## Known Technical Issues

- **Tailwind v4 oklch inaccuracy:** Very dark colors (L < 0.15) compile incorrectly in `@theme`. Use exact hex values for dark tokens.
- **Lightning CSS strips backdrop-filter:** Apply via React inline styles (`style={{ backdropFilter: 'blur(Xpx)' }}`), not CSS classes.
- **Dev server CSS caching:** Kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache when CSS changes don't appear.

## Setup

After clone: `git config core.hooksPath .githooks` (enables auto-push hook)

## Conventions

- Raycast design language: 6% borders, 10% hover, 12px card radius, Inter font
- Server components by default, client only when interactive
- GSD workflow for planning — see `.planning/`
- Commit format: `type(phase): description`
