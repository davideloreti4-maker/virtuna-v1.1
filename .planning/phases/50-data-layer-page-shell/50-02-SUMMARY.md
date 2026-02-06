---
phase: 50
plan: 02
subsystem: page-shell
tags: [next.js, react, client-component, tabs, url-sync, sidebar]

dependency-graph:
  requires: [50-01]
  provides: [TrendingPage, TrendingClient, sidebar-trending-nav]
  affects: [51-01, 51-02, 52-01]

tech-stack:
  added: []
  patterns: [server-client-split, url-state-sync, suspense-boundary, controlled-tabs]

key-files:
  created:
    - src/app/(app)/trending/page.tsx
    - src/app/(app)/trending/trending-client.tsx
  modified:
    - src/components/app/sidebar.tsx

decisions:
  - id: D-50-02-01
    decision: "Use window.history.pushState for tab URL sync instead of router.push"
    rationale: "Shallow URL update — no server re-render, keeps tab switching instant"
  - id: D-50-02-02
    decision: "Unicode middle dots via JS expressions {\"\\u00B7\"} not JSX text"
    rationale: "JSX text does not interpret unicode escapes — renders literal \\u00B7"

metrics:
  completed: 2026-02-05
---

# Phase 50 Plan 02: Page Shell & Layout Summary

**One-liner:** Server/client page split at /trending with 3 category tabs (coral accent), URL sync via pushState, stats bar, skeleton/empty states, and sidebar nav item.

## What Was Done

### Task 1: Server page component and sidebar nav item (33deb8b)

**`src/app/(app)/trending/page.tsx`** (51 lines):
- Server component with `Metadata` (title, description)
- `searchParams` validation: Promise-based await, validates tab param against `VALID_TABS`
- Falls back to `"breaking-out"` for invalid/missing tab
- `Suspense` boundary with `TrendingPageSkeleton` fallback (heading + stats + tabs + 6-card grid skeleton)

**`src/components/app/sidebar.tsx`** (modified):
- Added `TrendingUp` import from lucide-react
- Added Trending `SidebarNavItem` before "Manage plan" in bottom nav
- Navigates to `/trending` on click, closes mobile menu

### Task 2: Client shell component (263929e)

**`src/app/(app)/trending/trending-client.tsx`** (226 lines):

- **Heading**: "Trending" h1 (visual size 3, font-display)
- **Stats bar**: Category counts with middle dots + aggregate "42 videos · 551.0M total views" in muted text
- **Category tabs** (controlled `CategoryTabs`):
  - Breaking Out (TrendingUp icon)
  - Trending Now (Flame icon)
  - Rising Again (RotateCcw icon)
  - Each shows count badge
  - Active tab: coral accent (bg-accent/10, text-accent, border-accent/20)
- **Sticky tab bar**: `position: sticky; top: 0; z-index: 10` with inline `backdropFilter: blur(12px)` (bypasses Lightning CSS stripping)
- **URL sync**: `window.history.pushState` on tab change (shallow, no server re-render) + `popstate` listener for browser back/forward
- **Skeleton flash**: 250ms loading state on tab switch
- **Content area**: `VideoPlaceholder` showing video count per category, `EmptyState` with Inbox icon for empty categories
- **Helper**: `formatCompactNumber()` for compact view counts (K/M/B)

### Task 3: Bug fix (54d2164)

Fixed `\u00B7` rendering as literal text in JSX — wrapped in JS expressions `{"\u00B7"}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3] Unicode escapes in JSX text**
- **Found during:** Visual verification via Playwright screenshot
- **Issue:** `\u00B7` in JSX text content renders literally instead of as middle dot character
- **Fix:** Wrapped in JS expressions: `{"\u00B7"}` instead of bare `\u00B7`
- **Commit:** 54d2164

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Clean, zero errors |
| /trending route resolves | 200 OK |
| Heading "Trending" | Renders in font-display |
| Stats bar | Category counts + total views with middle dots |
| 3 category tabs | Breaking Out, Trending Now, Rising Again |
| Active tab coral accent | bg-accent/10, text-accent |
| Tab switch URL sync | pushState updates ?tab= param |
| Browser back/forward | popstate listener syncs tab |
| Skeleton flash on switch | 250ms loading state |
| Sidebar nav item | "Trending" with TrendingUp icon |
| Min lines (page.tsx ≥20) | 51 lines |
| Min lines (client ≥100) | 226 lines |
| Backdrop filter | Inline styles (Lightning CSS workaround) |

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-50-02-01 | pushState for URL sync | Shallow update, no server re-render |
| D-50-02-02 | JS expressions for unicode in JSX | JSX text doesn't interpret escapes |

## Next Phase Readiness

**Blockers:** None
**Ready for:** Phase 51 (Video Feed & Cards) — page shell accepts tab content, data layer provides videos

## Commit Log

| Task | Commit | Message |
|------|--------|---------|
| 1 | 33deb8b | feat(50-02): server page component and sidebar nav item |
| 2 | 263929e | feat(50-02): trending page client shell with tabs, URL sync, and states |
| fix | 54d2164 | fix(50-02): render unicode middle dots as JS expressions in JSX |
