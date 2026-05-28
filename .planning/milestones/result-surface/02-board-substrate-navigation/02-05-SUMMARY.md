---
phase: 02-board-substrate-navigation
plan: 5
subsystem: navigation/sidebar
tags: [sidebar, navigation, zustand, keyboard-shortcuts, accessibility, responsive]
dependency_graph:
  requires:
    - plan: 2.1
      provides: Board.tsx, board-types.ts, analyze routes
    - plan: 2.8
      provides: dashboard-redirect, hive-deletion
  provides:
    - src/components/sidebar/Sidebar.tsx
    - src/stores/sidebar-store.ts (isCollapsed extensions)
    - src/stores/__tests__/sidebar-store.test.ts
  affects:
    - src/components/app/app-shell.tsx
    - plan: 2.4 (board-store Running section wire-up, deferred)
tech_stack:
  added: []
  patterns:
    - Zustand persist store extension (isCollapsed + toggleCollapsed)
    - Phosphor icon with Tooltip in icon-only collapsed mode
    - CSS transition on sidebar width (150ms ease-out-cubic)
    - Dynamic main padding-left based on collapsed/expanded state
key_files:
  created:
    - src/components/sidebar/Sidebar.tsx
    - src/stores/__tests__/sidebar-store.test.ts
  modified:
    - src/stores/sidebar-store.ts
    - src/components/app/app-shell.tsx
decisions:
  - "New Sidebar placed in src/components/sidebar/ (not in /app/) — aligns with CONTEXT.md §code_context recommendation for new shared components"
  - "isCollapsed defaults false (expanded) — persisted in 'virtuna-sidebar' localStorage key alongside isOpen"
  - "Sidebar width: 220px expanded / 52px collapsed — 52px chosen over spec 40px to ensure 44px min-touch-target on NavItems"
  - "Main content offset: 236px expanded / 68px collapsed (sidebar + 16px gap) — same formula as prior sidebar offset"
  - "Running section is a stub — wired when board-store (plan 2.4) provides streaming state"
  - "Account popover implemented inline (not Sheet) — simpler, same visual weight as Claude sidebar pattern"
  - "app-shell.tsx imports Sidebar from new path, keeps TopBarAccountChip and AuthGuard wiring intact"
metrics:
  duration: "12m"
  completed: "2026-05-26"
  tasks_completed: 4
  files_created: 2
  files_modified: 2
  tests_added: 10
---

# Phase 02 Plan 05: Sidebar Restructure Summary

**One-liner:** Seven-section sidebar with collapsible icon-only mode (⌘\), recent boards from history, Projects placeholder, Account dropdown — replacing the old nav structure per D-11 and D-12.

## What Was Built

### Task 1 — sidebar-store extension

Extended `src/stores/sidebar-store.ts` with two new fields:

```ts
isCollapsed: boolean           // desktop icon-only mode (default: false)
toggleCollapsed: () => void    // ⌘\ shortcut handler
setCollapsed: (v: boolean) => void
```

Both new fields are persisted in the existing `'virtuna-sidebar'` localStorage key (Zustand persist middleware). State is independent — `isCollapsed` and `isOpen` do not affect each other.

### Task 2 — new Sidebar component

Created `src/components/sidebar/Sidebar.tsx` with:

**Sections (top → bottom):**

| Section | Behavior |
|---------|----------|
| ⊕ New analysis | Coral accent CTA, `⌘N` shortcut hint in expanded mode, routes to `/analyze` |
| Navigate | Boards (`/analyze`), Trending (`/trending`), Settings (`/settings`); `aria-current="page"` on active item |
| Running | Stub — invisible until board-store (plan 2.4) exposes streaming state |
| ⭐ Pinned | Empty state stub: "No pinned boards yet." (pinning UI deferred) |
| 🕐 Recent | `useAnalysisHistory()` data, top 8 boards, loading skeleton, active board highlighted |
| 📁 Projects | Static placeholder: "Projects · Coming soon" badge |
| 👤 Account | `useProfile()` data, user initials avatar, Settings + Log out links in popover |

**Desktop collapse (D-12):** `⌘\` keyboard shortcut bound via `useEffect` + `document.addEventListener('keydown')`. Width transitions 220px ↔ 52px in 150ms. Icon-only mode shows `Tooltip` labels (side="right") on all NavItems and section icons.

**Mobile:** Hamburger `List` icon exported as `SidebarHamburger`. Sidebar slides as full-height overlay (transform-x) with black/50 backdrop. Close via backdrop tap or internal close button.

**Accessibility:** All NavItems use `aria-current="page"`, Tooltip labels in collapsed mode, Account button uses `aria-expanded`. Focus rings via existing button/icon patterns.

### Task 3 — AppShell update

Updated `src/components/app/app-shell.tsx` to:
- Import `Sidebar` + `SidebarHamburger` from new `@/components/sidebar/Sidebar`
- Replace `SidebarToggle` with `SidebarHamburger`
- Dynamic `padding-left` on `<main>`:
  - Mobile closed: `pl-0`
  - Desktop expanded: `md:pl-[236px]`
  - Desktop collapsed: `md:pl-[68px]`
- CSS var `--sidebar-offset` updated to match

### Task 4 — sidebar-store tests

10 unit tests in `src/stores/__tests__/sidebar-store.test.ts` covering:
- Initial state (isOpen: true, isCollapsed: false)
- toggle/open/close
- toggleCollapsed/setCollapsed
- State independence (collapsed/open don't affect each other)
- Action contract (all 5 functions exported)

localStorage mocked via `vi.stubGlobal` to isolate from Zustand persist.

## Tests

| File | Tests | Status |
|------|-------|--------|
| `stores/__tests__/sidebar-store.test.ts` | 10 | GREEN |
| **Total new** | **10** | **All pass** |

Full worktree suite: 86/88 test files pass (1 pre-existing skip, 1 pre-existing failure in `anti-virality.test.ts` — not caused by this plan; see Deviations).

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `404c2c9` | feat | extend sidebar-store with isCollapsed + toggleCollapsed |
| `f2465c5` | feat | new Sidebar component — 7 sections, collapsible, ⌘\ |
| `0364626` | feat | wire new Sidebar in AppShell, dynamic main offset |
| `909a493` | test | sidebar-store unit tests (10 passing) |

## Deviations from Plan

### Auto-fixed Issues

None.

### Scope Notes

**1. Running section — stub (intentional, not a bug)**
The "Running" section (visible only during streaming) requires `useBoardStore` from plan 2.4 to read streaming state. Board-store doesn't exist yet. The section is intentionally omitted from the rendered output — the collapsed variant also omits it. Plan 2.4 must add it once the board-store lands.

**2. Pre-existing anti-virality test failure**
`src/lib/engine/__tests__/anti-virality.test.ts` fails 1 test (PROVENANCE JSDoc marker check) — this failure exists in the worktree's baseline before this plan. Not caused by plan 2.5 changes.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Running section | `Sidebar.tsx` | L122-L128 | Requires board-store (plan 2.4) to provide streaming state |
| Pinned boards | `Sidebar.tsx` | L212-L217 | Pinning UI not implemented yet; shows empty state text |
| Account "Log out" | `Sidebar.tsx` | L471 | Routes to `/login` — actual Supabase `signOut()` wired in settings page; sidebar defers to that pattern |

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. Sidebar reads existing `useAnalysisHistory()` and `useProfile()` queries (already RLS-protected). `⌘\` keyboard shortcut fires `toggleCollapsed()` with no side effects.

## Self-Check: PASSED

- [x] `src/components/sidebar/Sidebar.tsx` exists on disk
- [x] `src/stores/__tests__/sidebar-store.test.ts` exists on disk
- [x] `src/stores/sidebar-store.ts` modified (isCollapsed added)
- [x] `src/components/app/app-shell.tsx` modified (imports new Sidebar)
- [x] Commits `404c2c9`, `f2465c5`, `0364626`, `909a493` in git log
- [x] TypeScript: 0 errors
- [x] Tests: 10 new tests pass
