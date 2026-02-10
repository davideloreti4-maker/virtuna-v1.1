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

## Raycast Design Language Rules (Verified 2026-02-08)
- **Body**: #07080a bg, Inter font (single font, all weights), `letter-spacing: 0.2px`, antialiased
- **Borders**: Universal 6% (`white/[0.06]`), hover 10% (`white/[0.1]`). NOT 8% or 12%
- **Glass pattern**: `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` + `blur(5px)` + border 0.06 + inset shadow `rgba(255,255,255,0.15) 0 1px 1px 0 inset`
- **GlassPanel**: Zero-config component (4 props: children, className, style, as). Fixed 5px blur, 12px radius, Raycast gradient. No tint/blur/opacity/innerGlow/borderGlow props.
- **Modals/dialogs**: Solid opaque dark bg, NOT glass. Inset shadow: `rgba(255,255,255,0.1) 0 1px 0 0 inset`
- **Cards**: `bg-transparent`, border `rgba(255,255,255,0.06)`, `border-radius: 12px`, inset shadow `rgba(255,255,255,0.05) 0 1px 0 0 inset`
- **Card hover**: `bg-white/[0.02]` only. NO translate-y, NO border change
- **Buttons**: Primary = `shadow-button` (4-layer). Secondary = `bg-transparent border-white/[0.06]` hover `bg-white/[0.1]`. All sizes use 8px radius
- **Inputs**: `bg: rgba(255,255,255,0.05)`, border 0.05, radius 8px, height 42px
- **Radius scale**: 4/6/8/12/16/20/24px. Cards=12px, inputs=8px, buttons=8px, header=16px, modals=12px
- **Key token values**: surface=#18191a (NOT #18191c), muted=#848586 (NOT #6a6b6c), accent-foreground=#1a0f0a (dark brown)
- **Deleted components**: GradientGlow, GradientMesh, primitives/GlassCard -- not part of Raycast design language
- **Overall**: Clean, dark, minimal. No colored tinting, no glow effects. Color only for accents
- **Dev server cache**: Kill dev server + clear `.next/` + restart when CSS changes don't appear

## Conventions

- Raycast design language: 6% borders, 10% hover, 12px card radius, Inter font
- Server components by default, client only when interactive
- GSD workflow for planning — see `.planning/`
- Commit format: `type(phase): description`
