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
| `~/virtuna-engine-rework/` | idle (was `rework/engine-core`) | **Track COMPLETE 2026-06-26 — all merged to main.** Production-readiness dissection/rework (audience signature, calibration, fold/model consolidation). Headline work landed via PRs #53–#58 (R1′ 2-model stack + live-validated fold, fold↔calibrated-audience unify, omni null-coercion, R2/R4 closes, tracked ledger). Worktree now idle; remaining engine debt is all lower-value (see `docs/WORKTREE-DEBT-LEDGER.md` §0 + `docs/DISSECTION-BACKLOG.md`: R3/R5/E2/G3/A6/A-T/S6). |
| `~/virtuna-ui-restrained/` | `design/ui-restrained` (merged) · `fix/tsc-clean-gate` (superseded) | **RETIRED 2026-06-25 — mission complete, worktree safe to remove.** Restrained de-Claude rebrand merged to main (PR #36, squash `46912461`): near-zero accent DOSAGE (liveness-only) lever, terracotta `#d97757`. Follow-ups ALL landed: P7 dead-code deletion (#45) + konva/react-konva dep removal (#46) + tsc gate→0 (#47). `fix/tsc-clean-gate` is fully superseded — every change landed via #43/#44/#45–47; verified branch-behind with zero stranded work — safe to `git worktree remove ~/virtuna-ui-restrained` + delete branch. LOCKED dosage rule in `docs/DESIGN-SYSTEM.md`; rules `.cursor/rules/ui-design.mdc`. |

> Keep this table current — but the **canonical map is now `docs/WORKTREE-DEBT-LEDGER.md`**
> (tracked, full branch survey). Last reconciled 2026-06-26 (engine-rework track COMPLETE,
> PRs #53–#59 merged; full branch-cleanup pass — PR #42 closed, 4 retired worktrees removed,
> 49 branches pruned → **63→13 remote** (unmerged ones `archive/*`-tagged on origin); the lone
> ui-restrained Cursor WT `cursor/27a9b701` kept — it has uncommitted edits, see ledger §6).

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
