---
phase: 12-library-acts-state-ia
plan: 02
subsystem: ui
tags: [nextjs, react, library, saved-items, chain-handoff, acts-state, redirect]

# Dependency graph
requires:
  - phase: 10-account-read-saved-shelf-recalibration-flywheel
    provides: SavedShelf, SavedItemCard, SaveAffordance, useSavedItems/useSaveItem/useDeleteSavedItem, saved_items table + /api/saved route, ITEM_TYPE_TO_SKILL (incl. outlier→discover), the /saved surface
  - phase: 05-open-chat-test-reframe
    provides: CHAIN_HANDOFFS SSOT + handoffsFor, createOpenThreadLazy (server-side open-thread guarantee), /home open-thread rehydration
  - phase: 08-discover-remix-read
    provides: MultiAudienceReadBlockRenderer (the flagship Read card), the discover→remix handoff that powers a saved Outlier's launch
  - phase: 12-library-acts-state-ia (plan 01)
    provides: the literal four-noun sidebar nav (Library NavItem → /library, matte non-coral active)
provides:
  - "/library route — the canonical Library State home (relabeled SavedShelf over the same saved_items store)"
  - "/saved → /library redirect (deep-link preservation; the redirect IS the route)"
  - "SaveAffordance item_type='read' mounted on the flagship multi-audience Read card (last savable noun that was missing it)"
  - "read-only fallback launch in SavedItemCard — a saved Read renders 'Use in thread →' routing to /home (no re-generation endpoint)"
  - "Library-relabeled copy across SavedShelf (heading/subtitle/loading/error/empty) and SavedItemCard (Remove dialog + toast)"
affects: [12-03 (Compare entry point that surfaces the Read card live), 13-proactive-numen, future Library/saved-content work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-rename-with-redirect: a relabeled surface gets a clean canonical URL (/library) while the old route (/saved) is retained ONLY as a next/navigation redirect — one store, no duplicate mount, bookmarks preserved"
    - "No-endpoint State→Act fallback: a noun that is RE-OPENED (not re-generated) launches via router.push('/home') with no CHAIN_HANDOFFS entry and no fabricated endpoint — scoped strictly to the `read` type (honesty spine: a saved Read is a record)"

key-files:
  created:
    - "src/app/(app)/library/page.tsx — the /library route (LibraryPage), in-shell content div rendering SavedShelf over the shipped saved_items store"
  modified:
    - "src/components/saved/saved-shelf.tsx — Saved→Library copy relabel (heading, subtitle, loading, error, unfiltered empty-state)"
    - "src/app/(app)/saved/page.tsx — converted to a redirect('/library') stub"
    - "src/components/thread/multi-audience-read-block.tsx — SaveAffordance item_type='read' mount at the card foot"
    - "src/components/saved/saved-item-card.tsx — read-only /home fallback launch + Remove copy relabel (dialog title/body + success toast)"

key-decisions:
  - "Picked the physical-rename-with-redirect option (CONTEXT D-03 discretion) for a clean canonical /library URL; /saved retained as a redirect stub, not deleted"
  - "A saved Read launches via router.push('/home') with NO endpoint — honesty spine: a Read is a record, re-opening the open thread is the honest action (D-04); did NOT fabricate a Read re-generation route"
  - "The read fallback is scoped to item_type==='read' ONLY (isReadFallback = !handoff && item.item_type==='read'); the outlier launch keeps its shipped discover→remix handoff path UNCHANGED"
  - "Read-card Save title derived from the lead audience name + band ('{name} — {band} Read') for a human-readable Library label; snapshot=block.props so the shelf re-renders the same typed renderer without a re-fetch (mirrors account-read-block)"
  - "Relabeled the SavedItemCard success toast + JSDoc 'shelf'→'Library' alongside the dialog copy for surface-name consistency (the dialog title/body were the plan-named strings; toast+comment kept consistent)"

patterns-established:
  - "Pattern: route-rename-with-redirect — relabel the component copy, clone the page wrapper to the new canonical URL, convert the old route to a next/navigation redirect; single store throughout"
  - "Pattern: read-only no-endpoint launch fallback — re-open the open thread at /home for a record-type noun, gated to that one type, never a fabricated re-generation endpoint"

requirements-completed: [LIB-01, LIB-03]

# Metrics
duration: 12min
completed: 2026-06-20
---

# Phase 12 Plan 02: Library & Acts/State IA Summary

**Landed the Library State home at /library (relabeled SavedShelf over the same saved_items store, with a /saved→/library redirect) and closed the LIB-03 two-way loop — the flagship Read card is now savable and a saved Read launches back into the open thread — by EXTENDING shipped P5/P8/P10 infrastructure with zero new store, mechanic, or endpoint.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-20T15:29:03Z
- **Completed:** 2026-06-20T15:41:45Z
- **Tasks:** 2 auto + 1 human-verify checkpoint (3 total)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- **`/library` is the canonical Library surface** — the shipped `SavedShelf` relabeled `Saved`→`Library` (heading, subtitle, loading, error, unfiltered empty-state), rendering the SAME flat typed grid + noun-type filter chips over the SAME `saved_items` store. No second store, no folder/tag/CMS UI.
- **`/saved` → `/library` redirect** preserves deep links (the old route is now a `next/navigation` `redirect("/library")` stub — no duplicate shelf mount).
- **LIB-03 loop closed.** The flagship multi-audience Read card now mounts `<SaveAffordance item_type="read">` (the last savable noun that was missing the Act→State affordance), and a saved Read renders a `Use in thread →` control that re-opens the open thread at `/home` — without fabricating a Read re-generation endpoint.
- **Saved Outliers/Ideas/Hooks/Scripts keep their shipped launches unchanged** — `ITEM_TYPE_TO_SKILL` (incl. `outlier:"discover"`), `LAUNCH_LABEL`, `anchorFromSnapshot`, the Remove/AlertDialog flow, and `CHAIN_HANDOFFS` as the SSOT are all untouched.
- **Remove copy relabeled** `shelf`→`Library` (dialog title + body + success toast) per 12-UI-SPEC §Destructive.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create /library route, relabel SavedShelf → Library, redirect /saved** — `06520f82` (feat)
2. **Task 2: Complete LIB-03 — Save the Read card + launch a saved Read into the open thread** — `84d56bc3` (feat)
3. **Task 3: Verify the literal four-noun nav + Library surface + the save↔use loop** — human-verify checkpoint, APPROVED (coordinator Playwright UAT, authed @e2e_creator on :3000)

**Plan metadata:** see final docs commit below.

## Files Created/Modified
- `src/app/(app)/library/page.tsx` (created) — the `/library` route (`LibraryPage`); in-shell `max-w-5xl` content div + the shipped `await createClient()`/`getUser()` auth guard, renders `<SavedShelf />`.
- `src/components/saved/saved-shelf.tsx` — `Saved`→`Library` copy: H1 `Library`, the new subtitle, `Loading your library…`, `Couldn't load your library…`, `Nothing in your Library yet`. `FILTERS` array, `useSavedItems` hook, component export all unchanged.
- `src/app/(app)/saved/page.tsx` — converted to a `redirect("/library")` server-component stub (deep-link preservation).
- `src/components/thread/multi-audience-read-block.tsx` — `SaveAffordance` import + a `<SaveAffordance item_type="read" title={…} snapshot={block.props}>` mount in a provenance/save row at the card foot; title = lead audience `{name} — {band} Read`.
- `src/components/saved/saved-item-card.tsx` — `isReadFallback` flag + `handleUseRead` (`router.push("/home")`) + a `read`-scoped `Use in thread →` render branch; Remove dialog title/body + success toast relabeled to `Library`.

## Decisions Made
- **Route-rename-with-redirect (D-03 discretion):** chose the clean canonical `/library` URL with a `/saved` redirect stub over an in-place alias, per the CONTEXT discretion to pick the physical-rename option. Single store throughout.
- **Saved Read launches with NO endpoint (D-04, honesty spine):** a Read is a record, so the honest action is to re-open the open thread (`/home`) — `createOpenThreadLazy` guarantees an open thread exists server-side on the next skill action, so `/home` always rehydrates without an error path. Did not invent a Read re-generation route.
- **Read fallback strictly scoped to `read`:** `isReadFallback = !handoff && item.item_type === "read"`. The outlier path resolves its handoff via the unchanged `launchHandoffFor` (`outlier:"discover"` → `discover→remix`), so it was left exactly as shipped.
- **Toast + JSDoc relabel for consistency:** the plan named the dialog title/body as the relabel targets; the `"Removed from shelf"` success toast and the affordance JSDoc were relabeled to `Library` in the same file for surface-name consistency (also required to satisfy the AC `grep -c 'Remove from shelf?' == 0`).

## Deviations from Plan

None — plan executed exactly as written. No deviation rules (1–4) were triggered: no bugs, no missing critical functionality, no blocking issues, no architectural changes. Build stayed green and the thread `__tests__` suite stayed green at every step.

The toast/JSDoc relabel (noted above) is in-scope surface-name consistency for the file being edited, not unplanned work — it is required for the Task-2 acceptance criterion that `'Remove from shelf?'` resolves to a count of 0.

## Issues Encountered
None during planned work. Two acceptance-criterion `grep` count targets were initially mismatched and reconciled within scope:
- **Task 1 AC `useSavedItems` count:** the AC expected `grep -c == 1` but the shipped (untouched) file legitimately has 2 matches — the `import` line + the single hook call. The substantive invariant (exactly ONE `useSavedItems()` invocation, single store, no second store introduced) holds and is unchanged from the shipped baseline. The AC's count target did not account for the import line; no code change was warranted.
- **Task 2 AC `'Remove from shelf?'` count:** initially 1 (a JSDoc header comment still carried the old wording). Relabeled the comment + the success toast to `Library`, bringing the count to 0 — required by the AC and consistent with the user-facing relabel.

## Verification-time Observations (non-blocking — coordinator UAT)

Recorded from the coordinator's Playwright UAT (authed @e2e_creator, dev server on :3000, full save↔use loop exercised, zero console errors). These are observations to carry forward, **not** defects fixed in this plan:

1. **`Formats` filter chip always renders.** The Task-3 plan note said the `Formats` chip should appear "only if format items exist", but the shipped `FILTERS` array renders it unconditionally (this matches the pre-existing P10 `saved-shelf.tsx` behavior, which this plan was told to keep — "the `Formats` chip stays rendered … UI-SPEC note"). The conditional-render refinement is a follow-up; flagged for a future Library polish pass.
2. **Saved-card date renders in machine locale** (e.g. de-DE `"20. Juni 2026"`). This is `new Date(...).toLocaleDateString(undefined, …)` honoring the environment locale — an environment cosmetic, not a code defect.
3. **Read-card Save button could not be clicked "live"** because the `MultiAudienceReadBlockRenderer` currently surfaces only via the Compare entry point shipping in **12-03**. Its card-render + launch half is fully UAT-verified here via a seeded `read` item (POST `/api/saved` → rendered as a `Read`-tagged card with a working `Use in thread →` CTA → navigated to `/home`; seed cleaned up via DELETE 200). Coverage is complete for everything 12-02 can surface today; the live in-thread Save click becomes exercisable once 12-03 lands the Compare entry point.

## User Setup Required
None — no external service configuration required (no new endpoint, no env var, no migration; `saved_items` was already pushed in P10).

## Next Phase Readiness
- **Library State home is live and the Acts/State spine is whole:** every saved noun is now actionable back into the single open thread (saved Read → `/home`; Ideas/Hooks/Scripts/Outliers via shipped handoffs).
- **12-03 dependency satisfied:** the flagship Read card's Save + launch half is shipped and UAT-verified via a seeded item; 12-03's Compare entry point is what surfaces the card live in-thread, at which point the Save click is exercisable end-to-end.
- **No blockers introduced.** Carry-over from prior phases is unchanged: the Phase 11 → 11-08 BLOCKING `tracked_accounts` migration push + types regen + engine regression gate is still open (unrelated to this plan; the Library surface does not touch `tracked_accounts`).
- **Follow-up (cosmetic):** the `Formats`-chip conditional-render and the date-locale display are candidates for a future Library polish pass.

## Self-Check: PASSED

- All 5 task files + the SUMMARY verified present on disk.
- Both task commits verified in git history: `06520f82`, `84d56bc3`.

---
*Phase: 12-library-acts-state-ia*
*Completed: 2026-06-20*
