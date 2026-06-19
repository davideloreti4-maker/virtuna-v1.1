---
phase: 10-account-read-saved-shelf-recalibration-flywheel
plan: 04
subsystem: ui
tags: [react, next, react-query, supabase, saved-shelf, chain-handoffs, zod]

# Dependency graph
requires:
  - phase: 10-02
    provides: "shelf-repo.ts typed saved_items CRUD (listSavedItems/createSavedItem/deleteSavedItem)"
provides:
  - "GET/POST/DELETE /api/saved — auth-first, session-scoped typed shelf CRUD"
  - "use-saved-items hook — list query + create/delete optimistic mutations"
  - "SaveAffordance — reusable Save→Saved✓ button mounted on hook/idea/script/remix output cards"
  - "SavedItemCard — typed shelf card with CHAIN_HANDOFFS launch + Remove confirmation"
  - "SavedShelf + (app)/saved/ surface — flat typed-item grid with type-filter chips and empty state"
  - "Sidebar Saved nav item (/saved) with accent active indicator"
affects: [10-05, 10-06, P12-library]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Act→State save: thread card snapshot (block props) POSTed to flat shelf; renders without re-fetch"
    - "State→Act launch: shelf item resolves its launch CTA from the CHAIN_HANDOFFS SSOT (no one-off wiring)"
    - "Flat shelf (D-07): ?type= and filter chips are client-side flat filters, never folders"

key-files:
  created:
    - src/app/api/saved/route.ts
    - src/hooks/queries/use-saved-items.ts
    - src/components/thread/save-affordance.tsx
    - src/components/saved/saved-item-card.tsx
    - src/components/saved/saved-shelf.tsx
    - src/app/(app)/saved/page.tsx
  modified:
    - src/lib/queries/query-keys.ts
    - src/components/thread/hook-card-block.tsx
    - src/components/thread/idea-card-block.tsx
    - src/components/thread/script-card-block.tsx
    - src/components/thread/remix-card-block.tsx
    - src/components/app/sidebar.tsx

key-decisions:
  - "Remix output saved as item_type 'hook' — the SavedItemType enum has no 'remix'; a remix is an adapted hook"
  - "item_type→SkillId launch map: idea→idea, hook→hooks, script→script, outlier→discover; read/format have no P10 launch (P12 extends)"
  - "zod validation failures on POST surface as 400 (client error), not 500"

patterns-established:
  - "SaveAffordance(item_type, snapshot=block.props) is the single Act→State seam reused across every output card"
  - "launchHandoffFor(item_type) resolves the canonical Use-in-thread CTA from handoffsFor() — adding a skill needs no card edit"

requirements-completed: [SAVE-01, SAVE-02]

# Metrics
duration: ~25min
completed: 2026-06-19
---

# Phase 10 Plan 04: Saved Shelf Summary

**Flat, typed Saved shelf (D-07) with full thread↔shelf wiring — any hook/idea/script/remix output saves a snapshot to `/api/saved`, and any shelf item launches back into a thread via the CHAIN_HANDOFFS SSOT, all on existing infra with zero new packages.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-19
- **Completed:** 2026-06-19
- **Tasks:** 3
- **Files modified:** 12 (6 created, 6 modified)

## Accomplishments
- `/api/saved` GET/POST/DELETE — auth-first `getUser()`, `user_id` always session-derived (never from body), delegates to `shelf-repo`; `snapshot` persisted so the shelf renders the same typed renderer without a re-fetch; `?type=` is a flat filter.
- `use-saved-items` react-query hook mirroring `use-bookmarks` — list query + create/delete mutations with optimistic cache updates across all saved-list variants.
- `SaveAffordance` (Act→State): reusable Save→"Saved ✓" button, cream-secondary check (never coral), mounted on hook/idea/script/remix output cards carrying `snapshot = block.props`.
- `SavedItemCard` (State→Act): neutral charcoal-chip type tag + title + muted timestamp + accent "Use in thread →" launch resolved from CHAIN_HANDOFFS (hook→"Test full →", idea→"Develop →") + overflow Remove with "Remove from shelf?" confirmation that never deletes the original.
- `SavedShelf` + `(app)/saved/page.tsx`: auth-gated surface inside the (app) route group (AppShell owns `<main>`; no nested `<main>`), H1 + subtitle, flat type-filter chip row (client filter, not folders), responsive flat grid, calm "Nothing saved yet" empty state.
- Sidebar "Saved" nav item (BookmarkSimple → `/saved`) with the standard accent active indicator.

## Task Commits

Each task was committed atomically:

1. **Task 1: Saved-items API + query hook (SAVE-01)** - `b00acdcd` (feat)
2. **Task 2: Save affordance on thread cards + Use-in-thread launch (SAVE-02)** - `5a2763fa` (feat)
3. **Task 3: Saved surface + sidebar nav item (SAVE-01)** - `45093b72` (feat)

## Files Created/Modified
- `src/app/api/saved/route.ts` - GET/POST/DELETE typed shelf CRUD, auth-first, session-scoped, zod-validated via shelf-repo
- `src/hooks/queries/use-saved-items.ts` - list query + create/delete optimistic mutations
- `src/components/thread/save-affordance.tsx` - reusable Save→Saved✓ button (cream check, never coral)
- `src/components/saved/saved-item-card.tsx` - typed shelf card; CHAIN_HANDOFFS launch + Remove confirm
- `src/components/saved/saved-shelf.tsx` - flat grid + type-filter chips + empty state
- `src/app/(app)/saved/page.tsx` - auth-gated server component, plain content div (no nested main)
- `src/lib/queries/query-keys.ts` - added `saved` query-key namespace
- `src/components/thread/{hook,idea,script,remix}-card-block.tsx` - mounted SaveAffordance in each CTA footer
- `src/components/app/sidebar.tsx` - Saved nav item + simplified active-state to `pathname.startsWith(item.href)`

## Decisions Made
- **Remix → item_type 'hook':** the `SavedItemType` enum (`read|idea|hook|script|outlier|format`) has no 'remix'. A remix output is an adapted hook, so it saves as `hook` and inherits the hook launch CTA.
- **item_type → SkillId launch map:** `idea→idea`, `hook→hooks`, `script→script`, `outlier→discover`. `read`/`format` have no launch CTA in P10's minimal set — their cards render without a "Use in thread →" (P12 extends). Per-type labels: hook→"Test full →", idea→"Develop →".
- **POST 400 vs 500:** zod validation failures surface as 400 (client error); unexpected failures as 500.
- **Launch model:** mirrors DiscoverClient — POST the snapshot anchor to the resolved endpoint (or, for context-mediated `endpoint: null` handoffs, just navigate), then `router.push("/home")` where the open thread rehydrates.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed react-hooks/exhaustive-deps in SavedShelf**
- **Found during:** Task 3 (Saved surface)
- **Issue:** `const items = data?.items ?? []` outside `useMemo` created a new array each render, making the memo deps unstable (lint warning).
- **Fix:** Moved the `items` derivation inside the `useMemo` callback; deps are now `[data, filter]`.
- **Files modified:** src/components/saved/saved-shelf.tsx
- **Verification:** `npx eslint src/components/saved/saved-shelf.tsx` → No issues found.
- **Committed in:** 45093b72 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/lint)
**Impact on plan:** Trivial lint correctness fix. No scope creep. All touched files lint clean.

## Issues Encountered
- saved_items migration is written but NOT pushed (deferred to Plan 07 per wave context). All code is written against `shelf-repo`'s `(supabase as any)` interim casts (tagged `TODO(10-07)`); no DB push performed. The shelf will function end-to-end once Plan 07 pushes the migration and regenerates types.

## Known Stubs
None that block the plan goal. The `read`/`format` shelf cards intentionally render without a "Use in thread →" launch (no chain-handoff origin exists for them in P10's minimal set) — this is the documented D-07 "P12 extends" seam, not a broken stub. SAVE-01/02 (save any output, list flat, launch the wired types) are fully functional.

## Threat Surface Scan
No new security surface beyond the plan's `<threat_model>`. `/api/saved` is auth-first with session-derived `user_id` (T-10-09), zod enum validation on item_type (T-10-10 application layer; DB CHECK lands with the Plan 07 migration). Zero new npm packages (T-10-SC).

## User Setup Required
None - no external service configuration required. (DB migration push is tracked work for Plan 07, not user setup.)

## Next Phase Readiness
- The Act→State / State→Act connective tissue is live: Plan 05 (Account Read card) can mount `<SaveAffordance item_type="read" ... />` directly with zero new wiring.
- Shelf is fully P12-extendable: new skills appear via CHAIN_HANDOFFS; new item types extend the flat enum without reworking the surface.
- Blocker for true end-to-end: saved_items migration push (Plan 07) — until then the shelf relies on shelf-repo's interim casts against an as-yet-unmigrated table.

## Self-Check: PASSED
All 6 created files exist on disk; all 3 task commits (b00acdcd, 5a2763fa, 45093b72) present in git log.

---
*Phase: 10-account-read-saved-shelf-recalibration-flywheel*
*Completed: 2026-06-19*
