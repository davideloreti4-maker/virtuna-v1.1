---
phase: 01-foundation-shell
plan: 03
subsystem: ui
tags: [home, composer, serif-greeting, tiktok-url, video-upload, two-layout, permalink-seam, app-router, flat-warm]

# Dependency graph
requires:
  - phase: 01-01
    provides: --font-serif (Newsreader) consumed by the greeting's font-serif utility; flat-warm charcoal surfaces (bg-surface-elevated) + --shadow-float consumed by the centered composer.
  - phase: 01-02
    provides: The reskinned sidebar's New Simulation CTA / brand mark / rail clock already route to /home (a safe href before this plan); this plan creates the route they target. The wired app-shell offset means the home renders into a <main> that shifts for the persistent desktop sidebar.
provides:
  - Authed /home route (app group, server page) — the new default authed landing surface (the landing REPOINT itself is plan 01-04); inherits the (app) layout getUser gate + AppShell
  - HomeGreeting — the serif voice moment (font-serif Newsreader, name italic from useProfile, isLoading name-less form, NumenMark stele glyph coral via text-accent)
  - Composer — the slim universal composer: TikTok-only URL check (D-21) + VideoUpload (bare) upload + the lifted submit->create->navigate loop; two-layout (data-layout centered/pinned)
  - The SHELL-06 permalink seam preserved — composer navigates to the existing /analyze/[id] (NOT renamed); what renders above the pinned composer is Phase 2
  - Wave-0 home/composer/two-layout test suite (16 tests) as the SHELL-01/02/03/04 + THEME-04 regression guard
affects: [01-04 middleware/auth-callback landing repoint to /home, 01-05 THEME-06 UAT gate (the home empty+active is half the reviewed shell), phase-02-the-simulation (renders the thread above the bottom-pinned composer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slim composer reuses validated sub-parts (VideoUpload bare, TikTok regex, the Board navigate-on-id loop) instead of reusing ContentForm wholesale (Pitfall 5 — no intent/tier/3-tab/IG)"
    - "Two-layout = one component, position driven by useParams().id (mirrors ContentForm's isOnResultRoute) and surfaced on a stable data-layout attribute (centered|pinned) so tests are not brittle to styling"
    - "navigate-on-id effect lifted verbatim from Board.tsx L300-307 (null->string analysisId transition fires router.push(/analyze/[id])) — replicated, NOT imported (home is not the Konva board)"
    - "Client TikTok regex mirrors the SERVER trust-boundary regex at /api/analyze L465 — client is a fast UX reject, server stays the boundary (two-layer validation, not weakened)"
    - "Greeting loading state renders the name-less form, never the [Name] placeholder (RESEARCH Open Q3)"
    - "VideoUpload always mounted, the + control toggles its visibility (hidden class), so the file input is always part of the composer DOM"

key-files:
  created:
    - src/app/(app)/home/page.tsx
    - src/components/app/home/home-greeting.tsx
    - src/components/app/home/composer.tsx
    - src/components/app/home/__tests__/home.test.tsx
    - src/components/app/home/__tests__/composer.test.tsx
    - src/components/app/home/__tests__/composer-layout.test.tsx
  modified: []

key-decisions:
  - "Imported useAnalysisStream from @/hooks/queries/use-analysis-stream (the actual hook path, mirroring Board.tsx) — the plan read_first named use-analyze.ts, but the live submit/navigate hook is use-analysis-stream.ts (use-analyze.ts is the older non-streaming hook)"
  - "VideoUpload always mounted + visibility-toggled (not conditionally rendered on the + click), so the upload file input is always in the composer DOM and the staged preview never hides; a staged file forces it visible"
  - "Submit enabled when a valid TikTok URL OR a staged upload exists; empty input is neutral (no error), a non-empty non-TikTok URL shows the D-21 reject + disables submit"
  - "Greeting copy kept [UAT] verbatim ('Ready to simulate your audience, [Name]?' / name-less while loading) — locks at the THEME-06 human gate (plan 01-05)"
  - "Kept /analyze/[id] as the permalink target (RESEARCH A2 / anti-pattern) — composer navigates there; no /s/[id] rename"

patterns-established:
  - "Home client pieces (HomeGreeting + Composer) are composed by a thin server page; the page is covered structurally (file-presence + build) and the client pieces by happy-dom unit tests — mirrors the analyze ResultCard server/client split"
  - "London-style composer tests mock useAnalysisStream/useProfile/next-navigation/useIsMobile/usePrefersReducedMotion + a stub supabase client; the route id is a mutable module-level var driving the layout branch"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-06, THEME-04, THEME-05]

# Metrics
duration: 5min
completed: 2026-06-13
---

# Phase 1 Plan 03: Clean Authed Home + Slim Two-Layout Composer Summary

**Built the clean authed `/home` (serif greeting + NumenMark stele + centered composer, no chips / no demo / no Simulation list) and the slim two-layout composer — a TikTok-only URL check + VideoUpload upload + the proven submit→create→navigate loop lifted from `Board.tsx`, centered when empty and bottom-pinned on the `/analyze/[id]` permalink — with a 16-test Wave-0 suite green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-13T17:41:23Z
- **Completed:** 2026-06-13T17:47:13Z
- **Tasks:** 3 (all `tdd="true"`)
- **Files:** 6 created, 0 modified

## Accomplishments

- **Slim composer (SHELL-02/03/04, D-21/D-22/D-24)** — built `composer.tsx` as a genuinely new, simplified composer (RESEARCH Pitfall 5: did NOT reuse `ContentForm`). It reuses only the validated sub-parts: a TikTok-only client regex (`/^https?:\/\/(www\.|vm\.)?tiktok\.com\//i`, mirroring the server trust boundary at `/api/analyze` L465), `VideoUpload` (bare) verbatim for the `+` upload, and the submit→create→navigate loop lifted from `Board.tsx` L300-345. A non-TikTok URL (YouTube **or** Instagram) shows the exact D-21 copy and keeps submit disabled — the slim composer intentionally rejects the Instagram that `ContentForm`'s `SOCIAL_URL_PATTERN` allowed. NO intent selector, NO model-tier picker, NO 3-mode tabs, NO Instagram acceptance.
- **Two-layout position (SHELL-04 / D-24)** — one component, position read off `useParams().id` (mirroring `ContentForm`'s `isOnResultRoute`) and surfaced on a stable `data-layout` attribute: `centered` (no Simulation, the empty home — floats with `--shadow-float`) → `pinned` (a Simulation exists, the permalink route). The placeholder swaps `"Paste a TikTok link or drop a video…"` → `"Ask about this simulation…"` accordingly (the active follow-up *behavior* is Phase 5; here it is the input + placeholder).
- **Submit→navigate seam (SHELL-06)** — replicated `Board`'s navigate-on-id effect (the `analysisId` null→string transition fires `router.push('/analyze/${id}')`) plus a slim `handleSubmit` that posts the TikTok URL or the uploaded `video_storage_path` through `stream.start()`. The id originates server-side (POST `/api/analyze` → SSE `started{id}`). The permalink stays the existing `/analyze/[id]` (RESEARCH A2 — NOT renamed); what renders above the pinned composer is Phase 2.
- **Authed home route (SHELL-01)** — created `(app)/home/page.tsx`, a server page that inherits the `(app)` layout's `getUser()` gate (redirect `/login`) + the `AppShell` sidebar, and composes the greeting + centered composer in the ~760px readable column (D-17). NO starter chips (D-18), NO demo affordance (D-25), NO Simulation list (the sidebar owns history). The production build emits the route as `ƒ /home` (server-rendered on demand — born auth-gated, never public; T-03-04).
- **Serif greeting (THEME-04, D-19/D-20)** — `home-greeting.tsx` renders the `NumenMark` stele glyph (coral via parent `text-accent`, not an asterisk) above a `font-serif` (Newsreader, wired in 01-01) `<h1>` at ~38px desktop / ~28px mobile, with the name italic (`<em>`) from `useProfile()`. While `isLoading` (or when the profile has no name) it renders the name-less `"Ready to simulate your audience?"` — never the `[Name]` placeholder (RESEARCH Open Q3). All copy `[UAT]`.
- **Tests** — authored the 3 Wave-0 suites first (RED on unresolved imports), then made them green: `home.test.tsx` (7 — serif greeting, NumenMark glyph, composer present, no chips/demo/list, never "Reading"), `composer.test.tsx` (6 — TikTok-enable, non-TikTok + IG reject with the exact D-21 copy, no `start` on invalid, VideoUpload mounted), `composer-layout.test.tsx` (3 — centered vs pinned vs active placeholder). **16 tests green.** Clean `tsc --noEmit` + `eslint` on every new source file; full `pnpm run build` succeeds.

## Task Commits

Each task committed atomically (TDD: RED then GREEN):

1. **Task 1: Wave-0 tests (RED)** — `4f0caa32` (`test`) — the 3 home/composer/layout scaffolds; 3 suites fail on unresolved `../composer` / `../home-greeting` imports until Tasks 2-3 land.
2. **Task 2: Slim composer (GREEN 1)** — `5be92b30` (`feat`) — TikTok-only URL + VideoUpload upload + lifted navigate loop + two-layout signal; `composer.test.tsx` + `composer-layout.test.tsx` green (9/9).
3. **Task 3: /home route + serif greeting (GREEN 2)** — `38789dd0` (`feat`) — authed server page + serif greeting + NumenMark; `home.test.tsx` green (7/7); full home suite 16/16; build emits `ƒ /home`.

**Plan metadata:** final `docs(01-03)` commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified

- `src/app/(app)/home/page.tsx` — **Created.** Authed server page (inherits `getUser` gate + `AppShell`); composes `HomeGreeting` + `Composer` centered in the ~760px column. No chips, no demo, no list. 33 lines.
- `src/components/app/home/home-greeting.tsx` — **Created.** `"use client"` serif voice moment: `font-serif` ~38/28px, name italic from `useProfile`, `isLoading` name-less form (no `[Name]` flash), `NumenMark` glyph coral via `text-accent`. 56 lines.
- `src/components/app/home/composer.tsx` — **Created.** `"use client"` slim composer: TikTok-only URL check (D-21), `VideoUpload` bare upload, lifted submit→create→navigate loop, `data-layout` centered/pinned. No `ContentForm`/intent/tier/IG. 250 lines.
- `src/components/app/home/__tests__/home.test.tsx` — **Created.** SHELL-01/THEME-04: serif greeting + glyph + composer + no chips/demo/list (7 tests).
- `src/components/app/home/__tests__/composer.test.tsx` — **Created.** SHELL-02/03/D-21: TikTok-enable + non-TikTok/IG reject with exact copy + VideoUpload mounted (6 tests).
- `src/components/app/home/__tests__/composer-layout.test.tsx` — **Created.** SHELL-04/D-24: centered vs pinned + active placeholder (3 tests).

## Decisions Made

- **`useAnalysisStream` import path:** Imported from `@/hooks/queries/use-analysis-stream` (the actual live hook, mirroring `Board.tsx`). The plan's `<read_first>` named `use-analyze.ts`, but that is the older non-streaming hook; the submit/navigate loop the plan describes lives in `use-analysis-stream.ts` (and is re-exported via the `@/hooks/queries` barrel). No deviation — the plan's *intent* (use the hook that surfaces `stream.start`/`stream.analysisId`) is exactly satisfied.
- **VideoUpload always mounted, `+` toggles visibility:** Rather than conditionally rendering `VideoUpload` only after the `+` click, it is always mounted and the `+` toggles a `hidden` class (a staged file forces it visible). This keeps the upload file input always part of the composer DOM (the plan's "the + control mounts VideoUpload") and means a staged preview never disappears. Satisfies the test asserting the upload input is present.
- **Submit-enable rule:** Enabled iff a valid TikTok URL OR a staged upload exists. Empty input = neutral (no error, disabled); a non-empty non-TikTok URL = the D-21 reject + disabled. This keeps the empty home calm (no premature error) while enforcing D-21.
- **Permalink not renamed:** The composer navigates to the existing `/analyze/[id]` (RESEARCH A2 / anti-pattern — no `/s/[id]` churn).
- **Greeting copy `[UAT]`:** Kept verbatim from the UI-SPEC (D-19); locks at THEME-06 (plan 01-05).

## Deviations from Plan

None — the plan executed exactly as written. (The `useAnalysisStream` import-path and the VideoUpload always-mount are documented under Decisions Made as faithful interpretations of the plan's intent, not deviations from it. No bugs, missing functionality, or blocking issues were encountered.)

## TDD Gate Compliance

- **RED:** `test(01-03)` commit `4f0caa32` — the 3 suites fail on unresolved imports (`../composer`, `../home-greeting`) before any component exists. (Import-resolution RED is the correct first state for a from-scratch component plan; no test passed unexpectedly.)
- **GREEN:** `feat(01-03)` commits `5be92b30` (composer green, 9/9) then `38789dd0` (home green, 7/7; full suite 16/16) followed.
- Gate sequence satisfied (test → feat → feat). No REFACTOR commit needed.

## Known Stubs

None that block the plan's goal. The composer's active-state input (placeholder `"Ask about this simulation…"`) is a deliberate, plan-sanctioned forward seam: the input + placeholder ship now (SHELL-04 two-layout), but the **follow-up chat behavior is Phase 5 (CHAT-01/02)** — explicitly out of P1 scope per the plan and the UI-SPEC. It is not an unwired data stub. All `[UAT]` greeting/visual values are inherited design provisionals (D-08) that lock at the THEME-06 gate (plan 01-05). No empty-data-to-UI stubs were introduced.

## Threat Flags

None. This plan adds no new network endpoint, auth path, or schema — the composer posts through the existing `/api/analyze` (the server TikTok regex at L465 and the content-length validation remain the trust boundary; the client check is UX only, T-03-01). Upload reuses `VideoUpload`'s existing MP4/MOV + 200MB validation verbatim (T-03-02). The permalink restore stays on the existing IDOR-defended `/api/analysis/[id]` (T-03-03). `/home` is born inside the `(app)` group, inheriting the server `getUser()` gate (T-03-04) — never public.

## User Setup Required

None — no external service configuration. The home empty state (greeting + composer + stele) and the active layout (composer bottom-pinned) are the surface the human reviews at the THEME-06 gate (plan 01-05); visual/flat-warm/serif correctness is `[UAT]`, signed there.

## Next Phase Readiness

- **Ready:** `/home` exists and renders the clean greeting + centered composer; the composer's submit→navigate seam to `/analyze/[id]` is wired; the two-layout `data-layout` signal is live. The sidebar's New Simulation CTA / brand mark / rail clock (built in 01-02, already pointing at `/home`) now resolve to a real page.
- **Seam to 01-04:** The authed-landing **repoint** (middleware `/analyze`→`/home` + the `auth/callback` `?? "/dashboard"` default → `/home`, RESEARCH Open Q2) is plan 01-04's job — this plan creates the destination route; it does NOT yet change where login lands. Until 01-04, authed users still land on `/analyze`; `/home` is reachable directly + via the sidebar links.
- **Seam to Phase 2:** The composer is bottom-pinned on `/analyze/[id]` via its `data-layout` signal; what renders ABOVE it (the Simulation thread / result IA) is Phase 2. The permalink id + `usePermalinkAnalysis` restore plumbing already exist.
- **Gate ahead:** The home is half the surface the human reviews at the **THEME-06 human-UAT gate** (plan 01-05, blocking). The greeting micro-copy + serif size perception + flat-warm hues stay `[UAT]` until signed.

## Self-Check: PASSED

- `src/app/(app)/home/page.tsx` — FOUND (created; renders `HomeGreeting` + `Composer`, no chips/demo/list; build emits `ƒ /home`).
- `src/components/app/home/home-greeting.tsx` — FOUND (created; `font-serif`, `useProfile`, `NumenMark`, isLoading name-less path).
- `src/components/app/home/composer.tsx` — FOUND (created; `tiktok` regex, `VideoUpload`, `router.push(\`/analyze/${id}\`)`, `data-layout`; no `ContentForm` import).
- `src/components/app/home/__tests__/home.test.tsx` — FOUND (created; 7 tests).
- `src/components/app/home/__tests__/composer.test.tsx` — FOUND (created; 6 tests).
- `src/components/app/home/__tests__/composer-layout.test.tsx` — FOUND (created; 3 tests).
- Commit `4f0caa32` (Task 1) — FOUND in git log.
- Commit `5be92b30` (Task 2) — FOUND in git log.
- Commit `38789dd0` (Task 3) — FOUND in git log.
- `npx vitest run src/components/app/home` — 3 files / 16 tests pass (verified).
- `pnpm run build` — exits 0; route `ƒ /home` emitted (verified).

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-13*
