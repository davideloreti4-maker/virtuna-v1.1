# Virtuna — Project Instructions

## Identity

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase
- **Branding:** Flat-warm charcoal + coral-red accent + cream text + matte (migrated v5.0/v6.0; the old Raycast system is RETIRED)
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
| `~/virtuna-v1.1/` | `main` | **Trunk / command center.** Stays on `main` (✅ synced to `origin/main` 2026-06-29 — GSI v7.0 merged tip `b09c4f51`; reset clean, dropped stray auto-wip docs commit `120ea41b`). New milestones launch into their own sibling worktree. |
| `~/virtuna-refine/` | `lane/refine` | **🟢 ACTIVE — post-GSI refinement / debt lane (created 2026-06-29).** Persistent dev-server worktree for step-by-step UI/engine/debt fixes found while operating the app. Off `origin/main` (GSI-merged). Inventory SSOT = `docs/OPEN-DEBT-AUDIT-2026-06-29.md` (carried here). Cut a short branch per discrete fix → PR → merge, or batch atomic commits on the lane. |
| `~/virtuna-billing/` | `lane/billing-prod` | **✅ MERGED 2026-07-20 — billing production pass shipped to main (PR #341, merge `0b0284ce`).** Credits meter end-to-end (SSOT `src/lib/pricing.ts` · gate on every paid route · one honest 402 wall · $1-trial-once · password reset). Full suite 4231/0; E2E quota verified locally with `BILLING_ENFORCE_QUOTA=true`. **Enforcement stays OFF in prod** until the owner's Whop step — launch runbook `docs/PRICING.md`. Keep worktree for the Whop sandbox pass; retire after. |
| `~/virtuna-numen-gsi/` | `milestone/numen-gsi` | **✅ MERGED 2026-06-29 — v7.0 Numen GSI shipped to main (PR #91, `b09c4f51`) + archived (`6d83bfb1`).** Synthetic-population simulator (Profile/Simulate/Predict). Worktree retire-able once verified no stranded uncommitted work (audit flags `audience-presence.tsx` modified — verify/revert). Do NOT `git merge rework/engine-core`. |
| `~/virtuna-numen-surface/` | `milestone/numen-surface` | **PAUSED (v5.0, "old") — deprioritized vs GSI (2026-06-26).** Mobile-first rebrand + UX rework. Debt (Phase-3 smoke gate unrun + P5–7) stays in-worktree `.planning`. |
| `~/virtuna-mvp-ready/` | `milestone/mvp-ready` | **Merged + pruned (2026-06-11).** v4.1 Phase 1 (engine, ENGINE_VERSION 3.19.0) merged to main; P2–5 superseded by Numen Surface. Branch retained in `.git`. |
| `~/virtuna-engine-opt/` | `milestone/engine-opt` | **Merged (PR #17) + pruned (2026-06-11).** v4.0 Apollo engine audit remediation. |
| `~/virtuna-ui-opt/` | `milestone/ui-opt` | In progress |
| `~/virtuna-viral-remix/` | `milestone/viral-remix` | In progress (v3.2) |
| `~/virtuna-viral-remix-adapt/` | `milestone/viral-remix-adapt` | In progress |
| `~/virtuna-landing/` | `milestone/landing` | In progress |
| `~/virtuna-engine-rework/` | idle (was `rework/engine-core`) | **Track COMPLETE 2026-06-26 — all merged to main.** Production-readiness dissection/rework (audience signature, calibration, fold/model consolidation). Headline work landed via PRs #53–#58 (R1′ 2-model stack + live-validated fold, fold↔calibrated-audience unify, omni null-coercion, R2/R4 closes, tracked ledger). Worktree now idle; remaining engine debt is all lower-value (see `docs/WORKTREE-DEBT-LEDGER.md` §0 + `docs/DISSECTION-BACKLOG.md`: R3/R5/E2/G3/A6/A-T/S6). |
| `~/virtuna-ui-restrained/` | `design/ui-restrained` (merged) · `fix/tsc-clean-gate` (superseded) | **RETIRED 2026-06-25 — mission complete, worktree safe to remove.** Restrained de-Claude rebrand merged to main (PR #36, squash `46912461`): near-zero accent DOSAGE (liveness-only) lever, terracotta `#d97757`. Follow-ups ALL landed: P7 dead-code deletion (#45) + konva/react-konva dep removal (#46) + tsc gate→0 (#47). `fix/tsc-clean-gate` is fully superseded — every change landed via #43/#44/#45–47; verified branch-behind with zero stranded work — safe to `git worktree remove ~/virtuna-ui-restrained` + delete branch. LOCKED dosage rule in `docs/DESIGN-SYSTEM.md`; rules `.cursor/rules/ui-design.mdc`. |

> Keep this table current — but the **canonical map is now `docs/WORKTREE-DEBT-LEDGER.md`**
> (tracked, full branch survey). Last reconciled 2026-06-26: engine-rework COMPLETE + production-
> readiness sprint done (GAP-REMIX-01 #63, dead `/api/outcomes` cut #64, tsc 15→4); **GSI milestone
> scaffolded** at `~/virtuna-numen-gsi`; **trunk synced** to `origin/main`; the earlier branch-cleanup
> pruned 63→14 remote (incl. the new GSI branch); ui-restrained Cursor WT `cursor/27a9b701` kept —
> uncommitted edits, see ledger §6.

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
- **Tailwind v4 `--font-*` is the font-FAMILY namespace — never put weights there.** Declaring `--font-medium: 500` in `@theme` generates `.font-medium { font-family: 500 }`, which *shadows* Tailwind's built-in `.font-medium { font-weight: 500 }`. This silently flattened every weight in the app to 400 (616 usages / 223 files) until fixed 2026-07-10 (`c22cdf82`). `--font-serif` → Newsreader works precisely *because* it is a family. Weights belong to `--font-weight-*`, but the built-in `font-{medium,semibold,bold}` utilities already cover them — **just don't declare weight tokens.** Verify with: probe a `<div class="font-medium">` and assert `getComputedStyle(el).fontWeight === '500'`.
- **Lightning CSS strips backdrop-filter:** Apply via React inline styles (`style={{ backdropFilter: 'blur(Xpx)' }}`), not CSS classes.
- **`--color-hover` is an overlay tint, not a fill.** It is `rgba(255,255,255,0.05)`. Using it as `hover:bg-*` on an element that floats over scrolling content *replaces* the opaque fill with a translucent one and the content shows through. Use a solid tone for anything in the floating composer dock.
- **Dev server CSS caching:** Kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache when CSS changes don't appear.
- **Playwright screenshots hang on this app:** the ambient-room animations never settle, so `browser_take_screenshot` times out on its font/stability wait. Use raw Playwright with `animations: 'disabled'` + `caret: 'hide'` (and a tight `clip`), or verify via `getComputedStyle`/`getBoundingClientRect` instead.

## Setup

After clone: `git config core.hooksPath .githooks` (enables auto-push hook)

## Design System (current — flat-warm charcoal)

⚠️ The old "Raycast Design Language" section here was RETIRED in the v5.0/v6.0 migration.
**Source of truth: `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`.** Summary:
- **System:** flat-warm charcoal + cream text + coral-red accent + **matte** (no glass, no glow, no inset-shine)
- **Tokens:** bg `#1f1f1e` (`--charcoal-app`), cream text `#ece7de` (never `#fff`), accent **coral-red `#FF6363`** (`--color-accent`, dated 2026-07-07 — never the RETIRED `#FF7F50`, and NOT terracotta `#d97757`)
  - ⚠️ This line claimed bg `#262624` + terracotta `#d97757` until 2026-07-17. Both were stale and both misled a live design session. Verified against `globals.css:57`/`:120` **and** at runtime: `getComputedStyle(document.documentElement).getPropertyValue('--color-accent')` → `#ff6363`. When in doubt, measure — globals.css is the SSOT, this file is a summary of it.
- **Borders:** 6% (`white/[0.06]`), hover 10%. **Radius:** 4/6/8/12/16/20/24 (cards 12, inputs/buttons 8)
- **Type:** Inter for all chrome; Newsreader serif for voice-moments ONLY (greeting/hero)
- **Guard:** `reading/__tests__/reskin-matte.test.ts` asserts no **legacy** coral (`#FF7F50` / `rgba(255,127,80,…)`) and no glass/glow — keep green. It does NOT ban the current accent `#FF6363`; "no coral" is about the retired Raycast hue only
- **Dev server cache:** kill dev server + clear `.next/` + restart when CSS changes don't appear

## Conventions

- Flat-warm design system: see `docs/DESIGN-SYSTEM.md` (6% borders, 12px card radius, Inter chrome)
- Server components by default, client only when interactive
- GSD workflow for planning — see `.planning/`
- Commit format: `type(phase): description`
