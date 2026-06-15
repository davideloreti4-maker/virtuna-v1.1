---
phase: 01-foundation-shell
plan: 02
subsystem: ui
tags: [sidebar, app-shell, flat-warm, glass-strip, collapse, zustand, mobile-drawer, simulations]

# Dependency graph
requires:
  - phase: 01-01
    provides: Flat-warm @theme token SSOT (charcoal surface tokens bg-background-elevated/bg-surface-elevated, --shadow-float) consumed here to flatten the inline glass.
provides:
  - Lean flat-warm sidebar — Layer-B inline glass stripped (no 137deg gradient, no backdrop blur), dead affordances cut (Pinned/Projects/Boards/Running), history relabelled "Simulations"
  - Revived persistent+collapsible desktop sidebar (Cmd/Ctrl-\ icon rail, persisted via sidebar-store) + mobile slide-in drawer
  - app-shell main-content offset wired to the real sidebar width (0 mobile / rail / expanded) — content shifts, no overlap
  - SidebarAccountSelector extracted to its own file (@handle selector kept, D-12)
  - THEME-02 Layer B regression guard (Sidebar.glass-strip source-grep test)
affects: [01-03 home greeting + composer (shares the shell offset), 01-05 THEME-06 UAT gate (sidebar is half the reviewed shell)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline Raycast glass flattened to flat-warm: bg-background-elevated (sidebar charcoal) / bg-surface-elevated (popover) + shadow-float; NO backdrop-filter (matte target = no blur, Pitfall 4)"
    - "Persisted Zustand collapse revived by consuming isCollapsed/toggleCollapsed (store was already complete) instead of a hardcoded false"
    - "effectiveCollapsed = !isMobile && isCollapsed — mobile is always the isOpen-driven drawer, never the collapsed rail"
    - "Shell content offset computed in app-shell ('use client') from isCollapsed + useIsMobile, applied as marginLeft on <main>"

key-files:
  created:
    - src/components/sidebar/SidebarAccountSelector.tsx
    - src/components/sidebar/__tests__/Sidebar.collapse.test.tsx
    - src/components/sidebar/__tests__/Sidebar.glass-strip.test.tsx
  modified:
    - src/components/sidebar/Sidebar.tsx
    - src/components/app/app-shell.tsx
    - src/components/sidebar/__tests__/Sidebar.recent.test.tsx

key-decisions:
  - "Extracted SidebarAccountSelector into its own file (plan-sanctioned) to hold Sidebar.tsx under the 500-line CLAUDE.md budget (674 -> 497 lines)"
  - "New Simulation CTA + brand-mark + collapsed-rail clock all route to /home (the authed home created in plan 01-03); history rows KEPT routing to /analyze/[id] (RESEARCH A2 — no /s/[id] rename)"
  - "Wired the store/hook reads in Task 2 (glass+relabel) but added the Cmd-\\ keybind in Task 3, so each commit compiles independently"
  - "Relabelled the null-content fallback row 'Analysis ·' -> 'Simulation ·' (D-09 noun) and updated the pre-existing recent-test assertion to match"

patterns-established:
  - "Cheap source-grep regression guard for the no-glass invariant (Sidebar.glass-strip.test.tsx readFileSync + regex) — fast, no DOM"
  - "Collapsed icon-rail tooltips require a TooltipProvider ancestor; tests mirror (app)/layout.tsx by wrapping renders in TooltipProvider"

requirements-completed: [SHELL-05, SHELL-07, THEME-02, THEME-05]

# Metrics
duration: 10min
completed: 2026-06-13
---

# Phase 1 Plan 02: Flat-Warm Sidebar + Shell Offset Summary

**Reskinned the existing 756-line `Sidebar.tsx` into a lean flat-warm sidebar of past Simulations — stripped the 3 Layer-B inline-glass spots, cut the Pinned/Projects/Boards/Running dead affordances, relabelled "Recent" → "Simulations", revived the persisted Cmd-\ collapse (desktop icon rail / mobile drawer), and wired `app-shell.tsx` so main content shifts for the persistent desktop sidebar.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-13T17:24:11Z
- **Completed:** 2026-06-13T17:34:18Z
- **Tasks:** 3 (all `tdd="true"`)
- **Files:** 3 created, 3 modified

## Accomplishments

- **THEME-02 Layer B glass strip (D-06):** Flattened all 3 hardcoded inline-glass spots — the `<nav>` container (137deg gradient + `blur(5px)` + inset shine → `bg-background-elevated` + hairline), the account popover (`rgba(22,23,25,0.98)` + `blur(12px)` → `bg-surface-elevated` + `shadow-float`), and the mobile hamburger (137deg gradient + `blur(8px)` → `bg-background-elevated` + hairline + `shadow-float`). Also flattened the account-selector dropdown (`rgba(17,18,20,0.95)` → `bg-surface-elevated`). Zero `linear-gradient(137deg` and zero `backdropFilter` now remain in `Sidebar.tsx` — a token-only reskin could NOT have done this (Pitfall 4). A source-grep guard test (`Sidebar.glass-strip.test.tsx`) locks it.
- **Cut dead affordances (D-11):** Removed the "Boards" nav item (canvas retired), the Running stub comment, the entire Pinned section (incl. its collapsed-rail tooltip), and the Projects "Coming soon" placeholder. Dropped the now-dead `House`/`Star`/`Folder` icon imports and the `isOnBoard` variable. Rewrote the header doc comment to the lean composition.
- **Relabel + reskin (D-13):** "Recent" SectionLabel → **"Simulations"**; empty copy → **"No simulations yet."**; null-content fallback row → "Simulation ·"; collapsed-rail clock tooltip → "Simulations". Kept the score chips (`scoreTone`), the remix tag, `relativeTime`, and the `@handle` `SidebarAccountSelector` (D-12, extracted to its own file). History rows still route to the `/analyze/[id]` permalink (RESEARCH A2 — deliberately NOT renamed to `/s/[id]`).
- **Revived collapse (SHELL-05/07, D-14/D-15/D-16):** Replaced the hardcoded `effectiveCollapsed = false` with `!isMobile && isCollapsed` driven by the already-complete persisted `sidebar-store`. Added a Cmd/Ctrl-`\` keydown that `preventDefault()`s + `toggleCollapsed()` (cleaned up on unmount). Desktop collapses to a ~60px icon rail; mobile stays the `isOpen`-driven slide-in drawer with backdrop (never the rail). Collapse choice persists across reload via the unchanged `virtuna-sidebar` persist key.
- **Wired the shell offset (D-14):** `app-shell.tsx` became `"use client"` and now reads `isCollapsed` + `useIsMobile()` to compute `<main>`'s `marginLeft` — `0` on mobile (drawer overlay), rail-width + gutter when collapsed, 220px + gutter when expanded — so the persistent desktop sidebar shifts content instead of overlapping it. The margin transition is gated on `usePrefersReducedMotion` (THEME-05).
- **Tests:** Full sidebar suite green — `Sidebar.collapse.test.tsx` (keybind + desktop-rail/expanded/mobile-drawer branches), the extended `Sidebar.recent.test.tsx` (Simulations label + no Pinned/Projects/Boards + empty copy), `Sidebar.glass-strip.test.tsx`, and the pre-existing `Sidebar.a11y.test.tsx` = **4 files / 17 tests**. The broader app-component suite (16 files / 116 tests) still passes — no regression from the app-shell change.

## Task Commits

Each task committed atomically (TDD: RED then GREEN):

1. **Task 1: Wave-0 tests (RED)** — `491609c5` (`test`) — authored `Sidebar.collapse.test.tsx` + `Sidebar.glass-strip.test.tsx`, extended `Sidebar.recent.test.tsx`; 10 failed against the current sidebar.
2. **Task 2: Strip glass + cut dead nodes + relabel (GREEN 1)** — `3494cb2a` (`feat`) — flattened the 3 inline-glass spots, cut dead affordances, relabelled Simulations, extracted `SidebarAccountSelector`; glass-strip + recent + a11y green.
3. **Task 3: Revive collapse + wire app-shell (GREEN 2)** — `2caf1938` (`feat`) — Cmd-`\` keybind + store-driven `effectiveCollapsed` + app-shell `marginLeft` offset; full sidebar suite (17 tests) green.

**Plan metadata:** final `docs(01-02)` commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items).

## Files Created/Modified

- `src/components/sidebar/Sidebar.tsx` — Reskinned to flat-warm (no inline glass), lean (dead nodes cut), labelled "Simulations"; store-driven collapse + Cmd-`\` keybind; `SidebarAccountSelector` now imported from its own file. 756 → 497 lines.
- `src/components/sidebar/SidebarAccountSelector.tsx` — **Created.** The `@handle` TikTok/IG account switcher extracted verbatim (D-12), dropdown flattened to `bg-surface-elevated`.
- `src/components/app/app-shell.tsx` — `"use client"`; reads `isCollapsed` + `useIsMobile` to offset `<main>` `marginLeft` by the real sidebar width (was a static, unread `--sidebar-offset: 0px`).
- `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` — **Created.** Cmd/Ctrl-`\` toggle, plain-`\` no-op, desktop-rail vs expanded vs mobile-drawer branches; renders wrapped in `TooltipProvider`.
- `src/components/sidebar/__tests__/Sidebar.glass-strip.test.tsx` — **Created.** Source-grep guard: no 137deg gradient, no `backdropFilter`/`WebkitBackdropFilter`.
- `src/components/sidebar/__tests__/Sidebar.recent.test.tsx` — Extended: "Simulations" label, no Pinned/Projects/Boards, "No simulations yet." empty copy; fallback assertion updated "Analysis ·" → "Simulation ·".

## Decisions Made

- **Extract `SidebarAccountSelector`:** After the cuts the file was 674 lines (> the 500-line CLAUDE.md budget). The plan pre-authorized extracting `SidebarAccountSelector` in that case — done, bringing `Sidebar.tsx` to 497 lines.
- **Task 2/Task 3 store-wiring split:** Task 2 wires the `useSidebarStore`/`useIsMobile`/`usePrefersReducedMotion` reads + `effectiveCollapsed` (needed for the relabel section's collapsed branch) but defers the Cmd-`\` keybind to Task 3, so each commit compiles independently (no unused `toggleCollapsed`).
- **`/home` for the CTA, `/analyze/[id]` for rows:** New Simulation CTA + brand mark + collapsed-rail clock point at `/home` (the authed home built in 01-03 — a `router.push("/home")` string is safe before the route exists); history rows keep `/analyze/[id]` (the proven, IDOR-defended permalink — RESEARCH A2, no churn rename).
- **Sidebar geometry duplicated as constants in app-shell:** The expanded (220) / rail (60) / inset (12) widths are defined in `app-shell.tsx` to match `Sidebar.tsx`'s `w-[220px]`/`w-[60px]`/`left-3`. Kept simple (numeric constants) rather than introducing shared CSS vars; a future refactor could hoist them to `globals.css` if a third consumer appears.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Collapsed icon-rail test needed a TooltipProvider ancestor**
- **Found during:** Task 3 (running `Sidebar.collapse.test.tsx`).
- **Issue:** The collapsed-rail branch renders icon-only `NavItem`s wrapped in Radix `<Tooltip>`, which throws `Tooltip must be used within TooltipProvider` under happy-dom. The expanded/mobile branches don't render tooltips, so only the collapsed-rail test failed.
- **Fix:** Wrapped the test's `render` harness in `<TooltipProvider>` — mirroring how the real app mounts it in `src/app/(app)/layout.tsx` around `<AppShell>`. Not a component bug (production has the provider); a test-harness gap.
- **Files modified:** `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx`
- **Commit:** `2caf1938`

### Out-of-scope discoveries (logged, NOT fixed)

**2. Pre-existing `tsc --noEmit` errors in engine/board test files** — logged to `deferred-items.md` (item D2).
- A project-wide `tsc --noEmit` (run to confirm my edits type-check) surfaces type errors in `src/lib/engine/**/__tests__/*` + `src/components/board/verdict/__tests__/fixtures/*` — files this plan never touches (engine FROZEN 3.19.0). This plan's 6 files type-check with **0 errors**; the Vitest suite (esbuild) is green. Out of scope per the scope-boundary rule; deferred to an engine-test maintenance pass.

---

**Total deviations:** 1 auto-fixed (Rule 3 — test-harness TooltipProvider) + 1 out-of-scope item logged.
**Impact on plan:** None on scope. The TooltipProvider wrap is standard Radix test setup; the engine `tsc` noise is pre-existing and unrelated. Plan executed as written.

## TDD Gate Compliance

- **RED:** `test(01-02)` commit `491609c5` — 10 assertions failed against the current sidebar before any implementation.
- **GREEN:** `feat(01-02)` commits `3494cb2a` (glass-strip + recent green) and `2caf1938` (full suite green) followed.
- Gate sequence satisfied (test → feat). No REFACTOR commit needed (the extraction landed inside the Task 2 feat as a budget requirement).

## Known Stubs

None. No empty-data or placeholder UI introduced — the sidebar consumes real `useAnalysisHistory` data (unchanged), and the `@handle` selector consumes real `useSocialAccounts`. The "No simulations yet." copy is the genuine empty state, not a stub. All `[UAT]` charcoal/coral values are inherited from plan 01-01 and lock at the THEME-06 gate (plan 01-05).

## User Setup Required

None — no external service configuration. Visual flat-warm correctness is `[UAT]`, verified by the human at the THEME-06 gate (plan 01-05) on the built shell.

## Next Phase Readiness

- **Ready:** The lean flat-warm sidebar + the wired shell offset are live. Plan 01-03 (home greeting + composer) can render into a `<main>` that already shifts for the persistent desktop sidebar; the New Simulation CTA already points at `/home`.
- **Seam to 01-03:** The `/home` route does not exist yet — the sidebar CTA / brand mark / rail-clock route to it (safe string `href`), and 01-03 creates the page + repoints middleware (01-04). Until then those links 404; that is expected and resolves in 01-03/01-04.
- **Gate ahead:** This sidebar is half the surface the human reviews at the **THEME-06 human-UAT gate** (plan 01-05, blocking). The `[UAT]` charcoal/coral/serif values stay provisional until signed.

## Self-Check: PASSED

- `src/components/sidebar/Sidebar.tsx` — FOUND (modified; 497 lines, `isCollapsed`/`toggleCollapsed`/`useSidebarStore`, zero `linear-gradient(137deg`, zero `backdropFilter`, contains "Simulations", no `effectiveCollapsed = false`).
- `src/components/app/app-shell.tsx` — FOUND (modified; `"use client"`, reads `isCollapsed`, applies `marginLeft` offset).
- `src/components/sidebar/SidebarAccountSelector.tsx` — FOUND (created).
- `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` — FOUND (created).
- `src/components/sidebar/__tests__/Sidebar.glass-strip.test.tsx` — FOUND (created).
- Commit `491609c5` (Task 1) — FOUND in git log.
- Commit `3494cb2a` (Task 2) — FOUND in git log.
- Commit `2caf1938` (Task 3) — FOUND in git log.
- `npx vitest run src/components/sidebar` — 4 files / 17 tests pass (verified).

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-13*
