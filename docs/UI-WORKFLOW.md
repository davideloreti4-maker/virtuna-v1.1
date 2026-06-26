# UI Workflow (Cursor) — canonical reference

How to run UI work in Cursor worktrees without colliding with other tracks
(engine-rework especially) or hitting the false-green / branch-pollution traps
we've already paid for. Read this before starting a UI session.

## TL;DR flow

```
~/virtuna-v1.1 (main, clean)
  → Cursor "New Worktree" off main
  → cp .env.local + link node_modules        # see Per-worktree setup
  → plan (Cursor plan-mode) → build
  → PR to main → merge → git worktree remove + delete branch
```

One PR-unit's worktree lives **days, not weeks.** Merge promptly, delete promptly.

## Per-worktree setup checklist (these bit us)

When Cursor's **New Worktree** creates `~/virtuna-<task>/`, before anything else:

1. **Secrets** — `cp ~/virtuna-v1.1/.env.local .`
   `.env.local` is gitignored, so a fresh worktree has no Supabase keys. Without
   it the dev server won't boot and visual verification can't run.

2. **Deps** — worktrees do **not** share `node_modules`. Either:
   - `pnpm install`, or
   - symlink the trunk's: `ln -s ~/virtuna-v1.1/node_modules ./node_modules`

   Skip this and `tsc` / `vitest` silently run as stubs — the exact **false-green**
   that hides real failures. (Vitest also prints fake `PASS(0)`/`FAIL(0)`; run
   `node ./node_modules/vitest/vitest.mjs run` to get a real result.)

3. **Auto-push hook (optional)** — `git config core.hooksPath .githooks`
   Enables the post-commit auto-push so Web Claude sessions can see the branch.
   **But read the auto-wip hazard below before relying on hooks.**

## Lane safety — who owns what

UI work stays in **`src/components/`** (plus `src/app/**` page/layout/CSS, and
`docs/` for design docs). That's the UI lane.

The **engine-rework** track (`~/virtuna-engine-rework`, `rework/engine-core`)
owns:
- `src/lib/**`
- `src/app/api/**`
- `supabase/**`
- types / `docs/subsystems/**`
- **PLUS two HOLD files in the UI tree** — coordinate before touching:
  - `src/components/audience/calibration-flow.tsx`
  - `src/components/audience/audience-reveal.tsx`

If a UI task genuinely needs an engine file or a HOLD file, ping the engine track
first — don't edit across the lane silently.

## Guardrails

- **Plan-mode first** in Cursor, then build. (You already do this — keep it.)
- **Auto-wip daemon: never run it inside an active design/UI worktree.** It
  co-opts the live branch — it's what polluted `fix/tsc-clean-gate` with a
  `chore(auto-wip)` commit. Keep auto-wip to the **trunk only**, or off during
  design sessions.
  - If a live-session branch does get polluted, separate it **non-destructively**:
    branch your clean commit to a new ref + new PR, close the old one. Never
    reset / force-push a branch another committer is live on.
- **Design system is locked.** Source of truth = `src/app/globals.css` (`@theme`)
  + `docs/DESIGN-SYSTEM.md`. Flat-warm charcoal: bg `#262624`, cream text
  `#ece7de` (never `#fff`), accent terracotta `#d97757` (never coral/`#FF7F50`),
  6% borders, 12px card radius, Inter chrome / Newsreader for voice-moments only.
  Accent is **near-zero dosage** (liveness only) — that's the de-Claude lever.
  `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are **STALE** (dead
  Raycast system) — don't trust them.
- **Keep the guard test green** — `reading/__tests__/reskin-matte.test.ts`
  asserts no coral/glass.
- **Verify visually.** UI change → run dev server + screenshot or browser-check.
  Never ship on "should work."
- **Dev server CSS caching:** when CSS changes don't appear, kill dev server +
  clear `.next/` + `node_modules/.cache/` + browser cache, restart.

## Worktree hygiene

`git worktree list` currently shows ~18 worktrees — that sprawl is how stale
branches hide. After a UI PR merges:

```
git worktree remove ~/virtuna-<task>
git branch -d <branch>            # -D if it was squash-merged
```

Trunk (`~/virtuna-v1.1`) stays on clean `main` and never holds a long-lived
branch.
