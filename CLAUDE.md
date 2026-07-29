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

**Live inventory — re-measured 2026-07-29 (15 worktrees).** Counts are `git cherry main <branch>`
(**patch-id**, so a lane whose work merged reads 0 even when its tip looks ahead). ⚠️ Do NOT use
`git rev-list --count main..br` for this — it counts rebased/merged commits as unmerged.

| Path | Branch | Role |
|------|--------|------|
| `~/virtuna-v1.1/` | `main` | **Trunk / command center.** Stays on `main` (✅ synced to `origin/main` 2026-07-29, tip `896ba6b9` — PR #407 reactivated Discover + Library and folded the outlier pull into the hub). Never holds a long-lived branch. |
| `~/virtuna-composer/` | `feat/price-account-read` | **🟢 ACTIVE — pricing lane (2026-07-29), owned by a SECOND SESSION.** 1 unique commit, open **PR #406**: prices `/api/account-read` at 5 credits and gates the route. Leave it alone unless you are that session. |
| `~/virtuna-platform/` | `lane/platform-surface` | **MERGED (#402) — 0 unique commits.** Was the platform-surface + ＋door docs lane; its work is all on `main`. Retire the folder when convenient. ⚠️ if you revive it, set `NEXT_PUBLIC_AMBIENT_V2=true` in its `.env.local` or you render the LEGACY room. |
| `~/virtuna-onboarding/` | `milestone/onboarding` | 2 unique (2026-07-27). #387/#388 landed the demo entitlement + /go rebuild. ⚠️ **the old "carries ~1.4k uncommitted lines of /go-v2 work" note was TRUE on 2026-07-27 and is now FALSE** — verified clean 2026-07-29. Owns port 3000. |
| `~/virtuna-audience-sim-v2/` | `feat/audience-sim-v2` | 20 unique (2026-07-17). Audience simulation v2 — verify against the shipped ambient-v2 before reviving. |
| `~/virtuna-e2e-audit/` | `audit/e2e-walkthrough` | 17 unique, **docs only** (2026-07-26). The 3 code blockers (F-019/F-017/F-021) already landed on `main`. |
| `~/virtuna-thread-cards/` | `feat/thread-cards` | 12 unique (2026-07-21). |
| `~/virtuna-explore-b/` | `feat/per-persona-ideas-script` | 3 unique (2026-07-16). |
| `~/virtuna-grounding-tools/` | `feat/grounding-reference-cards` | 2 unique (2026-07-20). One of a 5-branch grounding cluster; the rest are branch-only, no worktree. |
| `~/virtuna-polish/` | `polish/cards-next` | 2 unique (2026-06-27). |
| `~/virtuna-start-composer/` | `design/start-composer-v2` | 2 unique (2026-07-20). |
| `~/virtuna-ui-opt/` | `milestone/ui-opt` | 2 unique (2026-06-01) — stale, candidate for retirement. |
| `~/virtuna-prod/` | `docs/handoff-make-card-polish` | 1 unique (2026-07-27, incl. archived p4-live sketches). |
| `~/virtuna-explore-c/` | `docs/handoff-read-family-cards` | **0 unique** (2026-07-19) — merged; retire the folder. |
| `~/virtuna-the-room/` | `docs/pillars-handoff` | **0 unique** (2026-07-06) — merged; retire the folder. |

**Retired 2026-07-27** (worktree removed, **branch + commits kept** in `.git`): `lane/refine` · `lane/billing-prod` · `lane/launch-prep` · `lane/shell` · `lane/frame` · `lane/cursor-ui` · `lane/maven-offer` · `lane/skill-cards-prod` · `fix/whop-api-drift` · `milestone/numen-gsi` · `milestone/numen-surface` · `milestone/numen-landing` · `milestone/numen-tools` · `milestone/landing` · `milestone/viral-remix` · `milestone/viral-remix-adapt` · `milestone/ambient-room-v2` · `reconcile/reading-pr19` · `verify/main-state` · `final-verify` · 3 spikes · `rework/engine-core` (idle) · 3 superseded audience branches (below).

> ⚠️ **Three audience branches are SUPERSEDED — never merge them.** `feat/audience-brain-panel`
> (324 behind), `design/ambient-audience-ui` (264 behind), `design/audience-rework` (245 behind,
> PR #343 **closed** 2026-07-27). Their work shipped via **#339** (ambient audience production
> pass), **#317** (Audience rebuild) and **#312**; every file existing only on them was *deliberately
> deleted* from `main`. Merging would resurrect ~51k lines of dead code. Branches retained for history.
>
> ⚠️ **`lane/door-arm` is SUPERSEDED — never merge it (2026-07-29).** It holds the *duplicate*
> phases 5+6 of the ＋door lane, built by a second session at the same hour as the version that
> shipped. `main` took the OTHER implementation (`69414a16`) and then reconciled the difference in
> PR #403 (`407741a1`), whose own message settles it: *"Everything else that session shipped is
> better and stands; this is only the delta."* Merging would resurrect the rejected build. Its one
> branch-only file (`dev/cards/__tests__/room-simulate.test.tsx`) is superseded coverage — `main`
> tests the same component at `audience-lens/v2/__tests__/sim-door.test.tsx`. Retained for history,
> and because §0.1 of the ＋door handoff cites it.
>
> **Also superseded, retained for history:** `lane/composer-chrome` (shipped as `6392ff85`; its
> branch-only `composer-ask-credit-wall.test.tsx` covers the composer `ask` verb that **#398
> deleted** — the path no longer exists on `main`), `lane/composer-pill` (shipped as #398
> `5006f9c3`, zero branch-only files), `verify-main` (docs only).
>
> **Deleted 2026-07-29** — the only two that were provably lossless (`git cherry` showed every
> commit already in `main` by patch-id): `fix/thread-stop-double-run` · `docs/lane2-preconditions`.
> Everything else keeps its branch: the house rule is retire the WORKTREE, keep the commits.
>
> 🔑 **How to tell if a branch is dead:** `git diff --stat main...br` (three-dot) shows what the branch
> *added since it forked* — it says NOTHING about whether `main` already has it, and reads as huge
> pending work when the branch is actually stale. Two-dot `git diff main br` is no better: it reports
> main's own newer code as giant DELETIONS, so a merged lane looks like it is removing 5k lines.
> **The sharp tool is `git cherry -v main <branch>`** — patch-id, so `-` means "already in main"
> regardless of rebase or squash. Corroborate a `+` with `comm -13` of the two `git ls-tree` file
> lists (what exists ONLY on the branch) and a title grep against `git log main`; a lane that merged
> via PR reads `+` purely because merging shifted its patch-ids.
>
> Canonical historical map: `docs/WORKTREE-DEBT-LEDGER.md` (tracked, full branch survey) — note it
> predates this reconcile and still lists the retired worktrees above.

### How to work (don't repeat the multi-session-same-worktree mess)

**Rule: the trunk worktree never holds a long-lived branch.**

- **Multi-session milestone** (spans days) → its OWN worktree + branch.
  From `~/virtuna-v1.1/` on `main`: `/gsd-new-milestone` creates the sibling
  `~/virtuna-<name>/` worktree, branch, and clean scoped `.planning/`. Then
  `cd` there and work. One tmux tab per milestone worktree.
- **Incremental lane** (step-by-step fixes/polish on one surface) → sibling
  worktree + `lane/<surface>` branch off `main`: `git worktree add ~/virtuna-<name>
  -b lane/<name> main`. Batch atomic commits on the lane, or cut a short branch
  per discrete fix → PR → merge.
- **Quick fix** (one sitting) → in `~/virtuna-v1.1/`: `git switch -c fix/<thing>`
  off `main`, do the work (`/gsd-quick`), then PR + merge + delete the branch
  the same session. Trunk returns to clean `main`.
- **Always** run `git worktree list` + check your branch BEFORE launching `cc`.
- **Read refs with `git rev-parse`, never `git log --oneline`.** In this environment the one-line
  log **omits merge commits**, so `main` displays as the last squashed commit while HEAD is really
  the merge above it. §0.1 of the ＋door handoff blames three same-hour collisions on exactly this,
  and it recurred 2026-07-29 (`main` read as `95aa0d16`; it was the merge `896ba6b9`). It is not a
  git config — `git show --no-patch --format=%p <sha>` and `git rev-parse` report the truth.
- **`main` moves while you work.** A branch cut at session start can be dozens of commits stale by
  the time you commit — 41 on 2026-07-29. Re-check `git rev-list --count HEAD..main` before opening
  a PR, and rebase; do not assume the base you forked from is still the tip.
- **A new worktree is not ready to run.** It needs its own `npm install`
  (~278M) and its own `.env.local` — neither is shared. Copy `.env.local` from
  trunk, then add whatever flags that lane needs.
- **One dev server per port.** Concurrent worktrees collide on :3000 — pass
  `--port 300X` and check with `lsof -ti:3000` first, or you will spend an hour
  debugging the wrong running app.
- **Merge milestones promptly** — a milestone PR should land in days, not grow
  to dozens of commits across weeks.
- **Prune on merge.** Removing a worktree keeps its branch + commits, so retire
  the folder the moment its branch lands. Left alone this reached 43 worktrees /
  ~24 GB, most of them fully merged.

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
