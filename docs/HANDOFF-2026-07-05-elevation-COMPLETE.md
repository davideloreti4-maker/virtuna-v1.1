# Handoff — Premium-elevation sweep COMPLETE · what's next

**Date:** 2026-07-05 · **Worktree:** `~/virtuna-surfaces` · **Work off `origin/main`** (`git fetch origin && git switch -c <branch> origin/main`)
**Status:** ✅ The propagate sweep is **done and merged**. `main` tip = **`7e5d2755`**. All 5 surfaces live-verified in-browser on the true main state.

---

## 1. What shipped (all merged to `main`)

The premium-elevation mandate ("make the flat surfaces feel like something a big company would ship") is delivered across the whole owned surface set. The bar = **Hybrid**: matte-depth scale + a motion language + tone-zone sectioning, **near-zero accent kept**. Reference impl remains `src/components/surfaces/start-page.tsx`.

| Surface | PR | Merge | The move |
|---|---|---|---|
| **/start** | #154 | `7d21f482` | (prior session) system codified + LOCKED — the bar-setter |
| **/grow** | #155 | `b8165114` | 3 tabs zoned · adaptive stat tiles ("trend builds daily") · Numbers dead-half → honest Content-mix zone · Referrals locked-preview upsell |
| **/feed** | #158 | `9193b094` | designed cover **poster** (fixes 403 blank-gray covers) · `.elev-lift` · removed dead "Status — coming soon" stub |
| **/calendar** | #159 | `6aa341e0` | rail **defaults to today** (kills empty placeholder + closes dead space) · grid→tone-zone so planned cells pop · `/start` tone legend |
| **/audience** | #160 | `8187a1cc` | **trust-badge contradiction fixed** (owner Option A) · list + **detail view** depth · folded seed `feat/audience-polish` |
| **/library** | #162 | `7e5d2755` | light touch — `.elev-lift` + stronger proof bars |

**The `/audience` badge fix (owner-approved Option A):** cards showed "Validated" (top, model tier) AND "no evidence — Directional" (bottom, per-persona receipts) at once. The bottom ungrounded line now reads **"personas modeled · receipts pending"** — describes evidence state, drops the tier word. Tier logic + grounded receipts + template line unchanged. `honesty-render` test updated.

**The locked patterns** (SSOT = `src/app/globals.css` `@theme` + `docs/DESIGN-SYSTEM.md`): `.elev-rest` (static cards) / `.elev-lift` (interactive) · tone-zones (`rounded-2xl bg-[#252320] px-4 py-4`, no border/shadow, `mt-4`) · drop `SURFACE_RADIAL_BG` per surface · near-zero accent. Guard = `src/components/reading/__tests__/reskin-matte.test.ts` (`HYBRID_DEPTH_SURFACES` now covers every touched file; **35 green**).

---

## 2. Backlog — what a fresh session picks up (prioritized)

1. **`/feed` Competitors tab** *(the one real gap)* — scoped OUT of #158 because it's the folded-in old `/competitors` surface, **empty for the test user**, and its populated grid/table (`competitors-client.tsx` → `CompetitorGrid`/`CompetitorTable` + `competitor-empty-state.tsx`) can't be verified without data. **First:** seed a competitor for the test user (Add Competitor, or a DB row), then elevate it to the bar like the rest.
2. **`/feed` mobile filter ordering** — on mobile the full filter rail renders **above** the grid (pre-existing). Quick win: default `showFilters` to `false` on mobile (or move it behind the toggle) so the grid isn't buried. `feed-client.tsx`.
3. **Mechanical cleanups (batchable, low-risk):**
   - Sage-green raw hex `#8ea68a` → tokenize to `--color-positive` (~9 files: stat-row, analytics-view, grow-view, etc.).
   - Numen→Maven copy rebrand (still in `/audience` copy, logo, marketing).

**Before starting the backlog:** review the deploy / the `*-after.png` + `verify-*.png` screenshots in the worktree root — decide whether the bar's been hit or a surface wants another pass. That decision should drive the session, not a guess.

---

## 3. Environment / gotchas (unchanged)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001` (`npm run dev` OOMs; `npx next` wrapper breaks dev; `:3000` is The Room's). Currently RUNNING on `:3001`.
- **Auth:** `npx tsx e2e/create-test-user.ts` → `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (calibrated "Fitness Creators" + `test` audience + 9 library items + mock July calendar).
- **Tests:** `node ./node_modules/vitest/vitest.mjs run <path>` — **`npm test`/`npx vitest` print a FAKE `PASS(0)`.** Guards: `reskin-matte.test.ts` (35) + `audience/__tests__/honesty-render.test.tsx` (11).
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` (filter to touched files — repo has pre-existing `*.test.ts` errors out of build path).
- **Prod build (before merge):** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next build` — **kill the dev server first** (port + `.next` conflict).
- **Merge:** Vercel check fails env-wide → `gh pr merge <n> --squash --delete-branch --admin` after a local build passes. The `--admin` local-checkout step errors `'main' is used by worktree ~/virtuna-v1.1` — **cosmetic**; the server merge still lands (verify `gh pr view <n> --json state` == MERGED). **Owner approved auto-merge cadence** for this sweep.
- **Deps:** `package-lock.json` gitignored → pin **exact** versions, never `^`.
- **Auto-wip daemon:** commit promptly; if it grabs a dirty tree, branch your clean commit to a new ref + new PR (never reset/force-push under a live committer).
- **Don't touch The Room's territory** — the thread reading view / dock / `surface-reactions` / shared `ReadingSection`/`StatTile` (a concurrent session refactors these; they merged after this sweep branched — that's why a mid-sweep branch showed unrelated diffs vs `main`).

---

## 4. Memory (primary channel — read first)

`premium-design-elevation` (this mandate + full progress, marked COMPLETE) · `design-system-current` · `ui-ship-design-grade` · `surfaces-ia-rationalization` · `juno-maven-stale-strings` · `deps-pinning-gitignored-lockfile` · `auto-wip-daemon-hazard` · `vitest-rtk-shim` · `ui-verify-needs-browser-pass`.
