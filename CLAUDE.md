# Virtuna — Project Instructions

## Identity

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase
- **Branding:** Flat-warm charcoal + terracotta accent + cream text + matte (migrated v5.0/v6.0; the old Raycast/coral system is RETIRED)
- **Design system:** source of truth = `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`. ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (describe the dead Raycast system) — do not trust them
- **Repo:** https://github.com/davideloreti4-maker/virtuna-v1.1
- **Deployed:** Vercel

## Phase Numbering

Phases are milestone-scoped: each milestone numbers its phases 1-N.
Historical milestones (pre-2026-02-08) used global numbering 1-63.

## Worktrees

`~/virtuna-v1.1/` IS the repository — every other folder is a worktree hanging
off its single shared `.git`. Worktrees are not clones: a commit in one is
instantly visible to all; deleting a worktree folder keeps its branch + commits.

| Path | Branch | Role |
|------|--------|------|
| `~/virtuna-v1.1/` | `main` | **Trunk / command center.** Stays on `main`. New milestones launch from here; quick one-session fixes happen here on a short-lived branch. |
| `~/virtuna-numen-surface/` | `milestone/numen-surface` | **Active milestone (v5.0, scaffolded 2026-06-11).** Mobile-first rebrand + UX rework (oracle "Reading" thread replaces canvas board). Input: `.planning/NUMEN-SURFACE-VISION.md`. Next: define requirements + roadmap **in this worktree**. |
| `~/virtuna-mvp-ready/` | `milestone/mvp-ready` | **Merged + pruned (2026-06-11).** v4.1 Phase 1 (engine, ENGINE_VERSION 3.19.0) merged to main; P2–5 superseded by Numen Surface. Branch retained in `.git`. |
| `~/virtuna-engine-opt/` | `milestone/engine-opt` | **Merged (PR #17) + pruned (2026-06-11).** v4.0 Apollo engine audit remediation. |
| `~/virtuna-ui-opt/` | `milestone/ui-opt` | In progress |
| `~/virtuna-viral-remix/` | `milestone/viral-remix` | In progress (v3.2) |
| `~/virtuna-viral-remix-adapt/` | `milestone/viral-remix-adapt` | In progress |
| `~/virtuna-landing/` | `milestone/landing` | In progress |
| `~/virtuna-engine-rework/` | `rework/engine-core` | **Active (engine track).** Production-readiness dissection/rework (audience signature, calibration, scraping). ~8 commits ahead of main. Stays in `src/lib/**`, `src/app/api/**`, `supabase/**`, `docs/subsystems/**`, types — PLUS 2 UI-lane files (`src/components/audience/calibration-flow.tsx`, `audience-reveal.tsx`). Coordinate before UI edits there. |
| `~/virtuna-ui-restrained/` | `design/ui-restrained` | **Merged to main (PR #36, squash `46912461`, 2026-06-24).** Restrained de-Claude rebrand: **near-zero accent DOSAGE** (liveness-only) is the de-Claude lever, neutral cream primary actions. Accent hue = terracotta `#d97757` (signal-red `#e23b2d` was trialed then reverted; dosage kept). P0 thread + P1 audience + P2 library + accent-flood subtraction landed; suite green. LOCKED dosage rule in `docs/DESIGN-SYSTEM.md`; rules `.cursor/rules/ui-design.mdc`. Remote branch deleted; worktree retained for follow-up UI polish (P5–7 + chart/mobile batch). |

> Keep this table current — it's the map. Last reconciled 2026-06-24 (de-Claude
> rebrand `design/ui-restrained` merged to main via PR #36; remote branch deleted,
> worktree retained for UI-polish follow-ups; engine-rework active in parallel —
> see its UI-lane HOLD files above).

### How to work (don't repeat the multi-session-same-worktree mess)

**Rule: the trunk worktree never holds a long-lived branch.**

- **Multi-session milestone** (spans days) → its OWN worktree + branch.
  From `~/virtuna-v1.1/` on `main`: `/gsd-new-milestone` creates the sibling
  `~/virtuna-<name>/` worktree, branch, and clean scoped `.planning/`. Then
  `cd` there and work. One tmux tab per milestone worktree.
- **Quick fix** (one sitting) → in `~/virtuna-v1.1/`: `git switch -c fix/<thing>`
  off `main`, do the work (`/gsd-quick`), then PR + merge + delete the branch
  the same session. Trunk returns to clean `main`.
- **Always** run `git worktree list` + check your branch BEFORE launching `cc`.
- **Merge milestones promptly** — a milestone PR should land in days, not grow
  to dozens of commits across weeks.

## Known Technical Issues

- **Tailwind v4 oklch inaccuracy:** Very dark colors (L < 0.15) compile incorrectly in `@theme`. Use exact hex values for dark tokens.
- **Lightning CSS strips backdrop-filter:** Apply via React inline styles (`style={{ backdropFilter: 'blur(Xpx)' }}`), not CSS classes.
- **Dev server CSS caching:** Kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache when CSS changes don't appear.

## Setup

After clone: `git config core.hooksPath .githooks` (enables auto-push hook)

## Design System (current — flat-warm charcoal)

⚠️ The old "Raycast Design Language" section here was RETIRED in the v5.0/v6.0 migration.
**Source of truth: `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`.** Summary:
- **System:** flat-warm charcoal + cream text + terracotta accent + **matte** (no glass, no glow, no inset-shine)
- **Tokens:** bg `#262624`, cream text `#ece7de` (never `#fff`), accent terracotta `#d97757` (never `#FF7F50`)
- **Borders:** 6% (`white/[0.06]`), hover 10%. **Radius:** 4/6/8/12/16/20/24 (cards 12, inputs/buttons 8)
- **Type:** Inter for all chrome; Newsreader serif for voice-moments ONLY (greeting/hero)
- **Guard:** `reading/__tests__/reskin-matte.test.ts` asserts no coral/glass — keep green
- **Dev server cache:** kill dev server + clear `.next/` + restart when CSS changes don't appear

## Conventions

- Flat-warm design system: see `docs/DESIGN-SYSTEM.md` (6% borders, 12px card radius, Inter chrome)
- Server components by default, client only when interactive
- GSD workflow for planning — see `.planning/`
- Commit format: `type(phase): description`
