# Virtuna — Project Instructions

## Identity

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase
- **Branding:** Coral (#FF7F50), Raycast aesthetic
- **Design system:** 36 components, Raycast-extracted tokens — see `BRAND-BIBLE.md`
- **Repo:** https://github.com/davideloreti/virtuna
- **Deployed:** Vercel

## Phase Numbering

Phases are milestone-scoped: each milestone numbers its phases 1-N.
Historical milestones (pre-2026-02-08) used global numbering 1-63.

## Worktrees

| Path | Branch | Milestone |
|------|--------|-----------|
| `~/virtuna-v1.1/` | `main` | v2.1 (active) |
| `~/virtuna-landing-page/` | `milestone/landing-page` | Landing Page |

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
