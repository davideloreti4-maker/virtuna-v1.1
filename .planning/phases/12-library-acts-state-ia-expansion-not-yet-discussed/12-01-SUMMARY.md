---
phase: 12-library-acts-state-ia
plan: 01
subsystem: ui
tags: [sidebar, navigation, ia, phosphor-icons, nextjs, react, vitest, happy-dom]

# Dependency graph
requires:
  - phase: 05-open-chat-test-reframe
    provides: single-conversation thread model (the "Thread" noun the CTA + history now name literally)
  - phase: 07-audience-manager
    provides: the Audience NavItem + /audience surface the Library item sits beside
  - phase: 10-account-read-saved-shelf-flywheel
    provides: the SavedShelf store + /saved surface that Library will repoint to (Plan 12-02)
provides:
  - "Library NavItem in the active studio sidebar (Books icon) routing to /library, matte non-coral active state"
  - "isOnLibrary = pathname.startsWith('/library') derived flag"
  - "Literal four-noun nav: New Thread (CTA) + Settings · Audience · Library top group"
  - "Relabeled history section: 'Thread' header + 'No threads yet.' empty state + 'Thread' collapsed tooltip/aria-label"
  - "Updated sidebar test suite (a11y/recent/collapse) asserting the relabel + new Library item"
affects: [12-02-library-surface, 12-library-acts-state-ia, acts-state-ia, sidebar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-accent nav discipline: only 'New Thread' carries coral; Library/Settings/Audience share the matte white/[0.06] active state"
    - "Additive-not-restructure sidebar extension: new NavItem reuses the shipped NavItem verbatim, no new responsive logic"

key-files:
  created: []
  modified:
    - src/components/sidebar/Sidebar.tsx
    - src/components/sidebar/__tests__/Sidebar.a11y.test.tsx
    - src/components/sidebar/__tests__/Sidebar.recent.test.tsx
    - src/components/sidebar/__tests__/Sidebar.collapse.test.tsx

key-decisions:
  - "Library icon = Books from @phosphor-icons/react (reads as 'saved collection', distinct from the history ClockCountdown)"
  - "Library NavItem passes NO accent prop — matte active state, preserving the one-accent-per-nav rule (coral stays on New Thread)"
  - "Relabel scope kept to the sidebar only (D-01 discretion): source copy + in-file doc comments + the three sidebar test files that referenced the relabeled strings"
  - "Singular per-row 'Simulation · {when}' history-row fallback left UNCHANGED (D-13 row behavior preserved); only the plural 'Simulations' section noun was relabeled"

patterns-established:
  - "Pattern: nav noun relabel keeps SectionLabel size/style fixed — only its text changes (inherited shipped 10px uppercase semibold)"
  - "Pattern: a11y test anchors the New Thread CTA by regex (/^New Thread\\b/) because its accessible name includes the ⌘N badge"

requirements-completed: [IA-01]

# Metrics
duration: 4min
completed: 2026-06-20
---

# Phase 12 Plan 01: Library Nav Item & Acts/State IA Relabel Summary

**Added a Library NavItem (Books icon → /library, matte active state) to the active studio sidebar and relabeled the copy so the four nav nouns read literally Thread · Audience · Library · Settings — additive + relabel only, all shipped D-12/D-13 behavior preserved.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-20T15:18:45Z
- **Completed:** 2026-06-20T15:26:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Library `NavItem` (icon `Books`) added to the top group after Audience (order: Settings · Audience · Library), routing to `/library` with a matte `bg-white/[0.06]` active state — **not** coral (one-accent rule intact; coral stays on "New Thread").
- `isOnLibrary = pathname.startsWith("/library")` derived flag added alongside `isOnSettings`/`isOnAudience`.
- Relabeled the literal four nouns: primary CTA `New Simulation` → `New Thread` (icon/accent/⌘N/new-thread behavior unchanged); history `SectionLabel` `Simulations` → `Thread`; empty state `No simulations yet.` → `No threads yet.`; collapsed-rail tooltip + `aria-label` `Simulations` → `Thread`.
- Shipped D-12 (Settings/Audience/@handle cluster) and D-13 (history list, score/remix chips, `/analyze/[id]` routing, `data-testid` row values) behavior fully preserved.
- Sidebar test suite updated and green: a11y test now asserts the four literal nouns incl. the new Library button; recent/collapse tests assert the new "Thread" copy. 4 files / 20 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Library NavItem + relabel the four nouns in Sidebar.tsx** - `473cddfb` (feat)
2. **Task 2: Update sidebar tests for the relabel + new Library item** - `50ca34f7` (test)

**Plan metadata:** see final `docs(12-01)` commit.

## Files Created/Modified
- `src/components/sidebar/Sidebar.tsx` - Added `Books` import + Library NavItem (no accent) + `isOnLibrary` flag; relabeled CTA/section-label/empty-state/collapsed-tooltip copy and the in-file doc comments.
- `src/components/sidebar/__tests__/Sidebar.a11y.test.tsx` - Added a test asserting the four literal nav nouns (incl. Library button); `New Thread` matched by anchored regex (its a11y name carries the ⌘N badge).
- `src/components/sidebar/__tests__/Sidebar.recent.test.tsx` - History section header `Simulations` → `Thread`; empty state `No simulations yet.` → `No threads yet.`; D-13 row assertions unchanged.
- `src/components/sidebar/__tests__/Sidebar.collapse.test.tsx` - `Simulations` → `Thread` section-label assertions across the collapsed-hidden / expanded / mobile-drawer branches.

## Decisions Made
- **Library icon = `Books`** (from the two planner-offered options `Books`/`BookmarkSimple`) — reads as a saved collection and is visually distinct from the history `ClockCountdown`.
- **No `accent` prop on the Library NavItem** — matte active state identical to Settings/Audience; coral here would have broken the nav's one-accent rule (UI-SPEC §Color).
- **Relabel scope = sidebar only** (D-01 / CONTEXT discretion) — extended to the file's own doc comments and the three sidebar test files that asserted the relabeled strings, nothing wider.

## Deviations from Plan

None - plan executed exactly as written.

(Two items worth noting that fall inside the plan's stated scope, not deviations:
1. The plan's Task-1 acceptance criteria require `grep -c 'Simulations'` and `grep -c 'New Simulation'` to return **0** in `Sidebar.tsx`. To satisfy this exactly, three in-file **doc comments** that still said "Simulations"/"New Simulation" were relabeled alongside the rendered copy — the plan calls for relabeling and these are sidebar-internal strings.
2. `Sidebar.collapse.test.tsx` was edited. The plan permits this explicitly: "Do NOT modify `Sidebar.collapse.test.tsx` ... unless they reference the relabeled strings" — it asserted the `Simulations` section label in three places, so it was in scope.)

## Issues Encountered
- **a11y matcher precision:** the new `getByRole('button', { name: 'New Thread' })` initially failed because the CTA button's accessible name is computed as `"New Thread ⌘N"` (the ⌘N badge `<span>` is part of the name). Fixed by anchoring the matcher with `/^New Thread\b/` rather than weakening it — a precise assertion, verified against the rendered accessible-roles dump.
- **Acceptance-grep vs. negative assertion:** a `queryByText('New Simulation')`-is-absent assertion I first added contained the literal substring `New Simulation`, which tripped the blunt `grep -rc 'New Simulation\|...'` acceptance check (it counts substrings regardless of negate-context). Removed the redundant negative line — the positive `New Thread`/`Thread`/`Library` assertions already prove the relabel — so the mechanical AC returns 0 across both files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **Plan 12-02 dependency made explicit:** `/library` does **not** exist yet — the route is created in Plan 12-02 (it repoints/renames the P10 `/saved` SavedShelf surface). Until 12-02 lands, tapping the Library nav item routes to `/library` and 404s. This plan is the *consumer* of that route; the nav item is intentionally wired ahead of the surface (documented in the plan's `<artifacts_produced>`).
- Source + unit-test + build layers all green. The literal-four-noun **visual** check is owned by Plan 12-02's checkpoint (after `/library` exists), not here.
- No `ENGINE_VERSION` bump (UI/IA/text-path only); regression posture untouched.

## Self-Check: PASSED

- FOUND: 12-01-SUMMARY.md
- FOUND: src/components/sidebar/Sidebar.tsx + all 3 modified test files
- FOUND: commit 473cddfb (Task 1, feat)
- FOUND: commit 50ca34f7 (Task 2, test)

---
*Phase: 12-library-acts-state-ia-expansion-not-yet-discussed*
*Completed: 2026-06-20*
