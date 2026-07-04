# Handoff — UI Polish Lane (next session)

**Date:** 2026-07-04
**Worktree:** `~/virtuna-surfaces` · branch `milestone/surfaces`
**Prev session:** post-`#122` hardening + cohesion + `/start` composer parity — **all merged to main**

---

## 1. Where things stand

The Surfaces milestone shipped to main (PR `#122`). This session landed **two follow-up PRs to main**:

| PR | What | Commit on main |
|----|------|----------------|
| `#126` | Hardening: greened a stale honesty-spine test (`explore-thread-view` D-02) + **pinned drift-prone deps** (`recharts` 3.9.1, `@phosphor-icons/react` 2.1.10). Header cohesion: 9 surfaces → one canonical H1. Radial single-source: `SURFACE_RADIAL_BG`. | `7800bd8b` |
| `#128` | `/start` composer parity with the canonical composer: verb-appropriate placeholder, paperclip attach, mic removed. **Verified live.** | `78c79586` |

- **main tip:** `78c79586`  ·  **`milestone/surfaces` tip:** `b7c924e1`
- `milestone/surfaces` shows "4 ahead of main" but its **content is identical to main** (the 4 commits were squash-merged as `#126`/`#128`). Next session can work on `milestone/surfaces` (same tree as main) or cut fresh off `origin/main` — either is fine.
- **Full suite:** 3051 passed / 0 failed / 29 skipped. `tsc` clean. Tree clean. Memory updated.

---

## 2. Next session — two goals

### Goal A — Juno→Maven stale-string sweep (quick, #2)

The app was renamed **Juno → Maven** (memory: `numen-brand-architecture`) but stale `"Juno"` strings remain in-code. Confirmed: `/start` page `<title>` renders **"Start | Juno"**. (A `"Juno…"` mic-toast was already removed in `#128`.)

**Action:** `grep -rn "Juno" src/` → sweep **user-facing** strings (page `<title>` metadata, toasts, copy) → "Maven". Skip code identifiers / comments that don't ship. One small PR. Memory: `juno-maven-stale-strings`.

### Goal B — UI polish across ALL surfaces (the big one, #3)

**Owner's words:** "almost all of the UI surfaces are currently unrefined and unpolished." Wants to **discuss + decide which surfaces + what "polished" means** at the start, then work through them.

**Already done this milestone — DO NOT redo:**
- H1 cohesion — every surface is on the canonical H1 treatment (see §4).
- Radial backdrop single-sourced to `SURFACE_RADIAL_BG` (4 hero surfaces).

**Surfaces to audit/polish** (`src/app/(app)/<name>/`):
`start` · `feed` · `calendar` · `library` · `analytics` · `grow` · `competitors` · `referrals` · `audience` · `discover` · `settings` · `saved` · `home` (thread) · `analyze` (result route)

> ⚠️ `home` (thread) + the composer are **The Room's** territory (separate worktree `~/virtuna-the-room`). Surfaces session owns everything **besides** the thread. Polish thread-owned files only if clearly cosmetic + coordinate.

**Recommended approach:**
1. **Discuss/audit first** (owner asked). Spin the dev server (§3), walk each surface authed, capture gaps: spacing rhythm, type hierarchy, empty/loading states, density, cohesion, mobile. Produce a prioritized list.
2. **Polish one surface at a time:** audit → edit → **verify LIVE (screenshot)** → commit → frozen-branch PR → squash-merge. Don't blind-sweep — each surface is designed for its job (memory: `ui-ship-design-grade`).

---

## 3. Environment / gotchas (READ FIRST)

- **Dev server:** `NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev -p 3001`
  - `npm run dev`'s 768 MB heap **OOMs**; the `npx next` wrapper breaks dev. Use the binary directly.
  - `:3000` is **The Room's** worktree — use **`:3001`**.
- **Auth for visual verify:** `npx tsx e2e/create-test-user.ts` → then log in at `/login` with `e2e-test@virtuna.local` / `e2e-test-password-2026` (has a calibrated "Fitness Creators" audience; requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, present). Then drive Playwright to `/start`, etc.
- **Tests:** `node ./node_modules/vitest/vitest.mjs run` — **`npm test` / `npx vitest` print a FAKE `PASS(0)` via an rtk shim; don't trust them.**
- **Typecheck:** `node ./node_modules/typescript/bin/tsc --noEmit` — repo has some pre-existing `__tests__` `Audience.mode` TS errors (out of build path); filter output to your touched files.
- **Deps:** `package-lock.json` is **gitignored** → pin **exact** versions in `package.json`, never `^` (this drift broke the build; memory: `deps-pinning-gitignored-lockfile`).
- **Git:** auto-push hook is **ON** (a commit pushes to origin). The **auto-wip daemon** can co-opt `milestone/surfaces` → for a clean PR, freeze a dedicated branch at your SHA (`git branch fix/<x> <sha>` → push → PR), never reset/force-push a live branch.
- **Merge to main:** frozen branch → `gh pr create --base main` → `gh pr merge <n> --squash --delete-branch` (the `#126`/`#128` pattern).

---

## 4. Design system (source of truth)

- **SSOT:** `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. ⚠️ `BRAND-BIBLE.md`, `docs/tokens.md`, `docs/components.md` are STALE (dead Raycast system) — ignore.
- **System:** flat-warm charcoal — bg `#262624`, cream text `#ece7de` (never `#fff`), accent terracotta `#d97757` (never `#FF7F50`), **matte** (no glass/glow/inset-shine).
- **Borders:** 6% (`white/[0.06]`), hover 10%. **Radius:** cards 12, inputs/buttons 8.
- **Type:** Inter for chrome; Newsreader serif for voice-moments only (greeting/hero).
- **Canonical H1:** `text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]` — or the `<SurfaceHeader>` component (`src/components/surfaces/surface-header.tsx`).
- **Radial backdrop:** `SURFACE_RADIAL_BG` (`src/components/surfaces/surface-canvas.ts`).
- **Surface icons:** `src/components/surfaces/icons.tsx` (lucide, stroke-only, one system).
- **Guard test (keep green):** `reading/__tests__/reskin-matte.test.ts` (asserts no coral/glass).

---

## 5. Other open threads (not this session's focus)

- **OAuth/Composio ingestion** — the real depth lever (Directional→real stats on /start + /analytics). Gated on owner provisioning Composio. Memory: `oauth-profile-ingestion`.
- **The graft** — swap /start·/calendar·/grow mock content → real, once The Room lands ambient atoms. Gated. Memory: `numen-surface-vision-competitive`.
