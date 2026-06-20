---
phase: 11-explore-audience-curated-discovery
plan: 07
subsystem: ui
tags: [explore, composer, sse, react, in-thread-skill, outlier-grid, audience]

# Dependency graph
requires:
  - phase: 11-05
    provides: useExploreStream (start/stop/reset/toBlocks/stages) + OutlierTile fit-bar/Track + OutlierGridBlockRenderer live wiring
  - phase: 11-06
    provides: ExploreThreadView (idle quick-actions + streaming/persisted grid + onRemix(reload)/onTrack handlers)
  - phase: 11-04
    provides: POST /api/tools/explore SSE route (Pulling outliers → Scoring for your audience)
  - phase: 11-02
    provides: tracked_accounts repo + GET/POST /api/tracked-accounts
provides:
  - "/explore is a live, selectable in-thread skill (skill pill enabled + /explore slash entry)"
  - "Composer mounts useExploreStream + ExploreThreadView with showExploreView unconditional (idle quick-actions show like chat)"
  - "handleSubmit explore branch (Pitfall-1-guarded — never arms pendingNavRef / never navigates to /analyze)"
  - "Persisted outlier-grid rehydration on mount + reloadOpenThread in-place (surfaces remix-card Read after a tile tap, no router.push)"
  - "Explore params Search popover (niche/accounts/time-window/serendipity) beside the audience control"
  - "hasTrackedAccounts mount fetch drives card-2 honest degrade"
affects: [12-library-acts-state-ia, 13-proactive-numen, 11-08-migration-push]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-thread skill composer-dispatch wiring (mirrors hooks/chat/remix branches): stream mount + showView gate + persisted load filter + handleSubmit branch + threadContent mount"
    - "Unconditional idle gate (showExploreView = activeTool === 'explore') for skills that own their idle state — second use after chat (D-07)"
    - "In-place open-thread reload (reloadOpenThread) re-filtering outlier-grid + remix-card to surface a chain-produced Read without navigation (RESEARCH Q2)"
    - "Explore-only params popover inside ComposerControls (onRunExplore prop) mirroring the audience/intent popover idiom"

key-files:
  created: []
  modified:
    - src/components/app/home/composer-controls.tsx
    - src/components/app/home/composer.tsx
    - src/components/app/home/__tests__/composer-controls.test.tsx

key-decisions:
  - "Params Search popover lives INSIDE ComposerControls (not composer.tsx): reuses the existing Popover shell + ctl class + Ico 'search' beside the audience control; onRunExplore prop lifts params to explore.start (Task 1 primary option)."
  - "Explore field-send maps the textarea value to the niche param (empty → un-niched pull); the params popover + idle quick-actions are the richer entry points. canSubmit for explore gates only on !submitting && !explore.isStreaming (field-send optional)."
  - "Pitfall 1 honored structurally: the explore branch calls explore.start({niche}) + return with NO pendingNavRef / NO stream.start; there is no router.push('/analyze') anywhere in composer.tsx (the navigate-on-id effect stays Test-exclusive, gated behind pendingNavRef.current)."
  - "reloadOpenThread re-filters BOTH outlier-grid AND remix-card on GET /api/threads/open — the remix-card filter is what surfaces the freshly-persisted Read after a tile Remix (in place, no navigation)."

patterns-established:
  - "Composer dispatch checklist for a new in-thread skill: import+mount stream, show*View gate, persisted load filter by block type, hasThread OR-chain entry, handleSubmit branch (return, never pendingNavRef), threadContent mount, submit Button loading."
  - "Honest degrade plumbing: hasTrackedAccounts mount fetch (silent on 401) → card-2 'Track an account first' disabled sub-state, never a fabricated competitor feed."

requirements-completed: [EXPLORE-01, EXPLORE-02, EXPLORE-04]

# Metrics
duration: 20min
completed: 2026-06-20
---

# Phase 11 Plan 07: Wire Explore into the Composer Summary

**`/explore` becomes a live, selectable in-thread skill: the pill is enabled, the chat-style unconditional idle gate shows the audience-derived quick-actions, the params popover + field-send drive `explore.start`, submits never navigate to `/analyze` (Pitfall 1 structurally guarded), persisted outlier-grids rehydrate, and a tile Remix surfaces the Read via in-place thread reload (no `router.push`).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-20T02:55:00Z (approx)
- **Completed:** 2026-06-20T03:15:00Z (approx)
- **Tasks:** 2
- **Files modified:** 3 (2 source + 1 test)

## Accomplishments
- Enabled the Explore skill pill (`SKILLS` `explore.enabled: false → true`) so `/explore` is selectable in the pill row and the `/` slash menu.
- Added an Explore-only "Search" params popover (niche/accounts/time-window segmented/serendipity slider/"Run Explore" apply) beside the audience control, reusing the THEME-06 `Popover` + input idiom; exposed via the new `onRunExplore` prop.
- Mounted `useExploreStream` + `<ExploreThreadView>` in the composer; `showExploreView` is unconditional (`activeTool === "explore"`) so the idle quick-actions render even with no content (mirrors `ChatThreadView`, D-07/EXPLORE-04).
- Added the Pitfall-1-guarded `handleSubmit` explore branch (`explore.start({ niche })` + `return`; never arms `pendingNavRef`, never calls `stream.start`, never navigates to `/analyze`).
- Rehydrated persisted `outlier-grid` blocks on mount and added `reloadOpenThread` (re-filters `outlier-grid` + `remix-card` from `GET /api/threads/open`) wired to `onThreadReload` — the in-place Read surface after a tile Remix (RESEARCH Q2, no `router.push`).
- Added the `hasTrackedAccounts` mount fetch (`GET /api/tracked-accounts`) to drive card-2's honest degrade.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable the Explore skill + params Search popover (composer-controls.tsx)** - `9bf45658` (feat)
2. **Task 2: Mount Explore stream + view + submit branch + reload (composer.tsx)** - `a0283d13` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `src/components/app/home/composer-controls.tsx` - `explore` skill `enabled: true`; new `ExploreParams` type + `onRunExplore` prop; the Explore-only "Search" params popover (niche/accounts/time-window segmented/serendipity slider/"Run Explore" terracotta apply), shown only when `activeTool === "explore"`, mirroring the audience/intent popover idiom.
- `src/components/app/home/composer.tsx` - `useExploreStream` mount + `exploreBlocks` + `persistedExploreBlocks` + `hasTrackedAccounts` state; `showExploreView` unconditional gate; explore added to `hasThread`; `outlier-grid` persisted-load filter; `hasTrackedAccounts` mount fetch; `reloadOpenThread` helper; the Pitfall-1-guarded `handleSubmit` explore branch; `canSubmit`/Button `loading`/aria-label for explore; `<ExploreThreadView>` mounted in `threadContent`; `onRunExplore` wired to `explore.start`.
- `src/components/app/home/__tests__/composer-controls.test.tsx` - updated the stale "not-yet-shipped skills disabled" test (see Deviations): Explore now asserts enabled + fires `onSelectTool("explore")`; Offer/Ad remain the disabled rows.

## Decisions Made
- **Params popover placement = inside `ComposerControls`** (the plan's primary option): reuses the existing `Popover` shell, `ctl` class, and the already-defined `Ico name="search"`, sits beside the audience control, and only mounts for the Explore skill. The apply button lifts params via `onRunExplore` then closes the popover. The skill pill is never a submit (Pitfall 5).
- **Explore field-send → niche param**, `canSubmit` gates only on stream state (empty field allowed = un-niched pull). The params popover and the three idle quick-actions are the richer entry points; all three fire `explore.start` only on explicit user action (D-05 spine).
- **Pitfall 1 enforced structurally** — verified by grep: the explore branch has no `pendingNavRef`/`stream.start`, and `composer.tsx` contains no `router.push("/analyze")` literal (the navigate-on-id effect uses the gated `router.push(\`/analyze/${id}\`)`, fired only when `pendingNavRef.current` is armed in the Test path).
- **`reloadOpenThread` re-filters both `outlier-grid` and `remix-card`** so a tile Remix surfaces the persisted Read in place (RESEARCH Q2) while keeping the grid in sync — mirrors `handleDevelopRemix`'s fetch/flatten shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the stale composer-controls test that asserted Explore disabled**
- **Found during:** Task 2 (verification — running the composer test suites after the wiring)
- **Issue:** `composer-controls.test.tsx` had a test "renders not-yet-shipped skills disabled (Explore/Offer/Ad)" that asserted `explore` is `toBeDisabled()` and never fires `onSelectTool`. Task 1 deliberately flipped `explore.enabled` to `true` (the plan's EXPLORE-01 goal — "the Explore skill pill is enabled"), so the test encoded the old, now-incorrect contract and failed.
- **Fix:** Split the test — one case asserts Explore is enabled and fires `onSelectTool("explore")`; a second case keeps the disabled assertion for the remaining not-yet-shipped skills (Offer/Ad). Also corrected the stale top-of-file doc comment.
- **Files modified:** `src/components/app/home/__tests__/composer-controls.test.tsx`
- **Verification:** `npx vitest run` — composer-controls suite 12/12 pass; composer-navigate-guard 4/4 pass.
- **Committed in:** `a0283d13` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale test contract)
**Impact on plan:** The test update is a direct consequence of the plan's intended skill-enable; it realigns the test with the new contract. No scope creep, no production-code deviation. All other work executed exactly as written.

## Issues Encountered
- **happy-dom teardown noise:** running the composer/explore suites prints `DOMException [AbortError]` / `DetachedWindow` traces from in-flight `fetch` calls aborted on unmount (the WR-05 `isMountedRef`/abort pattern's expected teardown). These are not test failures — the pass/fail summaries confirm all suites green. Filtered out of the reported output.

## Verification
- `npx tsc --noEmit` — no new non-test source errors (pre-existing errors are all in `__tests__`/`fixtures` of unrelated engine/board/marketing files, out of scope).
- `npm run build` — ✓ Compiled successfully (route tree includes `/home`, `/api/tools/explore`, `/api/tracked-accounts`).
- Plan verification greps: explore `enabled: true` ✓; explore branch has no `pendingNavRef`/`stream.start` ✓; `reloadOpenThread` + `/api/threads/open` present ✓; no `router.push("/analyze")` literal ✓; `<ExploreThreadView` mounted ✓.
- Test suites: composer-controls (12) ✓, composer-navigate-guard (4) ✓, composer (✓), composer-layout (✓), home (✓), explore-thread-view (✓), explore-rank (✓), explore-runner (✓), all `src/hooks/queries` (25) ✓.

## User Setup Required
None - no external service configuration required. (The `tracked_accounts` table live-push + types regen is the separately-scheduled BLOCKING wave 11-08.)

## Next Phase Readiness
- Explore is now reachable end-to-end in `/home`: pick `/explore` (or a quick-action / params "Run Explore" / field-send) → SSE pull + audience-fit grid → tap "Remix → Read" → existing remix chain produces the adapted concept + real SIM reaction + Read, surfaced in place.
- **Blocker for full live function (already tracked):** 11-08 must run the live `tracked_accounts` migration push + `database.types.ts` regen + engine regression gate. Until then the "+ Track account" write hits a table that exists only in the migration file, and `hasTrackedAccounts` reads `{ accounts }` against the not-yet-pushed table (degrades safely to `false`).
- `timeWindow` is accepted into the params/route contract but not yet threaded into the pull (honest no-op per 11-04) — a future follow-up, never faked.

## Self-Check: PASSED

- FOUND: `src/components/app/home/composer.tsx`
- FOUND: `src/components/app/home/composer-controls.tsx`
- FOUND commit: `9bf45658` (Task 1)
- FOUND commit: `a0283d13` (Task 2)

---
*Phase: 11-explore-audience-curated-discovery*
*Completed: 2026-06-20*
