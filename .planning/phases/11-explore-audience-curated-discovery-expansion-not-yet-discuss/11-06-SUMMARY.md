---
phase: 11-explore-audience-curated-discovery
plan: 06
subsystem: ui
tags: [explore, thread-view, react, discover, remix, chain-handoff, quick-actions, sse, vitest]

# Dependency graph
requires:
  - phase: 11-05
    provides: "useExploreStream (start/stop/reset/toBlocks/stages); OutlierGridBlockRenderer upgraded to forward onRemix/onTrack/remixPendingId/trackPendingId/trackedIds; OutlierTile fit-bar + '+ Track account' affordance"
  - phase: 11-04
    provides: "POST /api/tools/explore SSE route (the pull this view's quick-actions trigger via the composer)"
  - phase: 11-02
    provides: "tracked_accounts table + POST /api/tracked-accounts (the Track write target)"
  - phase: 08-03
    provides: "discover→remix CHAIN_HANDOFFS entry (/api/tools/remix/run) reused verbatim for the tile tap"
  - phase: 05-03
    provides: "ChatThreadView idle-ownership precedent (a skill view that always shows + owns its empty state)"
provides:
  - "ExploreThreadView — the Explore in-thread surface: owns idle quick-actions, renders the streaming + persisted outlier grid with live onRemix/onTrack handlers, owns handleRemix (verbatim discover→remix + in-place thread reload) + handleTrack (POST /api/tracked-accounts)"
  - "ExploreQuickActionParams type — the quick-action params shape the composer forwards to useExploreStream.start"
  - "9-test behaviour lock (idle 3-card render, card-2 honesty degrade, no-auto-fire, tap-runs-preset, no-fabricated-reaction, loading-no-fake-%, error tap-to-retry)"
affects: [11-07, library-watchlist-p12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thread view owns its own idle state (clone of ChatThreadView idle-ownership) + renders the grid via OutlierGridBlockRenderer DIRECTLY (not MessageBlocks) because MessageBlocks does not forward handler props"
    - "Tile tap reuses the shipped discover→remix chain verbatim, then surfaces the persisted remix-card via an onThreadReload callback (in-place thread reload, never router.push — in-thread skills render in /home)"

key-files:
  created:
    - src/components/thread/explore-thread-view.tsx
    - src/components/thread/explore-thread-view.test.tsx
  modified: []

key-decisions:
  - "Render the grid via OutlierGridBlockRenderer directly (not MessageBlocks): MessageBlocks only forwards `block`, never onRemix/onTrack — so the only way to wire the live handlers this view owns is a direct mount of the renderer for both streaming + persisted blocks"
  - "No useRouter import at all: handleRemix surfaces the remix-card via onThreadReload (RESEARCH Q2) — the view structurally cannot navigate (grep-proof against router.push regression)"
  - "trackedIds keyed by trackHandle (the unique account identity), trackPendingId/remixPendingId keyed by platformVideoId (the per-tile identity) — matches the OutlierGridBlockRenderer prop contract from 11-05"
  - "Card-2 degrade is a disabled button with the 'Track an account first' sub-line and onClick omitted (undefined) — no pull can fire (honesty, D-02); the real sub-copy 'Recent posts from accounts you track' is asserted ABSENT in that state"

patterns-established:
  - "Pattern: an in-thread skill view that owns idle quick-actions + live grid handlers, with the on-tap real reaction inherited free from a reused downstream chain card (no reaction UI on the grid)"

requirements-completed: [EXPLORE-01, EXPLORE-02, EXPLORE-04, EXPLORE-05]

# Metrics
duration: 14min
completed: 2026-06-20
---

# Phase 11 Plan 06: ExploreThreadView — idle quick-actions + grid + onRemix(reload)/onTrack Summary

**ExploreThreadView: an in-thread Explore surface that owns 3 audience-derived idle quick-action cards (card-2 honesty-degrades without tracked accounts), renders the streaming + persisted outlier grid with live Remix/Track handlers, and reuses the shipped discover→remix chain verbatim — surfacing the remix-card via an in-place thread reload (no router.push), with the real persona reaction inherited free from the remix-card's LensTrigger.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-06-20T02:40:00Z (approx)
- **Completed:** 2026-06-20
- **Tasks:** 1
- **Files modified:** 2 (both created)

## Accomplishments
- **Idle ownership (EXPLORE-04 / D-07):** ExploreThreadView owns its idle/empty state (cloning the ChatThreadView precedent), rendering the LOCKED heading "Find what your audience would actually bite on." + body + 3 audience-derived quick-action cards. The cards run a preset pull ONLY on tap — they never auto-fire on render.
- **Honesty degrade (D-02):** Card 2 "What competitors shipped" degrades to a quiet disabled "Track an account first" sub-state when no tracked accounts exist — never a fabricated competitor feed. The real sub-line is asserted absent in that state by the test suite.
- **In-thread tap → Remix → Read (EXPLORE-02 / D-04/D-05, RESEARCH Q2):** `handleRemix` launches the existing `discover→remix` chain verbatim (`handoffsFor("discover").find(h => h.to === "remix")` → POST `{ url, platform }`) and, on success, surfaces the persisted remix-card by reloading the open thread in place via `onThreadReload` — NOT `router.push` (the view imports no router, so it structurally cannot navigate). The on-tap real persona reaction rides the reused remix-card's LensTrigger downstream — this view adds NO reaction UI to the grid.
- **Track write (EXPLORE-05 / D-08):** `handleTrack` POSTs `/api/tracked-accounts` (`{ platform, handle, source_video_id }`) and marks the tile tracked (adds `trackHandle` to `trackedIds`).
- **Grid + progress + error:** ProgressChecklist while streaming + the no-fake-% loading lead line ("Pulling outliers and scoring them for your audience… this can take a few minutes."); streaming + persisted grid rendered via `OutlierGridBlockRenderer` directly (so the live handlers + per-tile pending/tracked state reach the tiles); SkillRunError with tap-to-retry ("nothing was charged").
- **Behaviour lock:** a 9-test suite covers idle 3-card render, card-2 degrade (+ absent real sub-copy), no-auto-fire, tap-runs-matching-preset, disabled-card-fires-nothing, no-fabricated-blockquote, streaming-loading-line, and error tap-to-retry.

## Task Commits

Each task was committed atomically:

1. **Task 1: ExploreThreadView — idle quick-actions + grid + onRemix(reload)/onTrack** - `11c79f95` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) — see the docs commit below.

## Files Created/Modified
- `src/components/thread/explore-thread-view.tsx` - NEW: `ExploreThreadView` (+ `ExploreQuickActionParams`). Owns the idle 3-card quick-action screen, the streaming/persisted grid (via `OutlierGridBlockRenderer` directly), `handleRemix` (verbatim discover→remix + `onThreadReload`), `handleTrack` (POST `/api/tracked-accounts`), ProgressChecklist + loading line, and SkillRunError. No `useRouter` import (cannot navigate — RESEARCH Q2). No reaction UI on the grid (D-02).
- `src/components/thread/explore-thread-view.test.tsx` - NEW: 9 happy-dom tests locking idle quick-actions, the card-2 honesty degrade, no-auto-fire-on-render, tap-runs-preset, the no-fabricated-reaction honesty spine, the loading lead line, and error tap-to-retry.

## Decisions Made
- **Render the grid via `OutlierGridBlockRenderer` directly, not through `MessageBlocks`.** `MessageBlocks` only passes `block` to each renderer — it never forwards `onRemix`/`onTrack`. Since this view OWNS those handlers (the whole point of the plan), the only correct wiring is a direct mount of `OutlierGridBlockRenderer` for both streaming and persisted blocks, supplying the handler + per-tile pending/tracked props (the props 11-05 added to that renderer). The plan's "supplying the grid block's onRemix + onTrack via the OutlierGridBlockRenderer props path" language anticipated this.
- **No `useRouter` import at all.** `handleRemix` surfaces the remix-card via `onThreadReload` (the composer re-fetches the open thread, mirroring `handleDevelopRemix`). Omitting the router import makes the "no router.push" honesty constraint structurally enforced, not just convention.
- **`trackedIds` keyed by `trackHandle`; pending state keyed by `platformVideoId`.** Matches the `OutlierGridBlockRenderer` contract from 11-05 (tracked off `trackHandle ∈ trackedIds`, trackPending off `platformVideoId`).
- **Card-2 degrade omits `onClick` (undefined) + disables the button.** Two-layer guard so no pull can fire from the degraded card; the test asserts both the disabled state AND that `onQuickAction` is not called on a degraded-card tap.

## Deviations from Plan

None - plan executed exactly as written. The single auto task built `ExploreThreadView` + its test per the plan's `<action>` spec; all verification gates (test suite, reuse-not-fork grep, no-router.push grep, no-blockquote grep, tsc-clean-for-touched-files) pass.

## Issues Encountered
- **Verification grep false positives (resolved by inspection):** the plan's `grep router.push` and `grep blockquote|LensTrigger` checks matched COMMENTS in the file (which document "NOT router.push" and "the real reaction rides the reused remix-card's LensTrigger downstream"). Confirmed by inspection that all matches are comment-only and there is no `useRouter`/`next/navigation` import and no `<blockquote>`/reaction markup in the JSX — the constraints hold. No code change needed.
- **Pre-existing app-wide tsc errors (out of scope):** a full `npx tsc --noEmit` reports 46 errors, all in pre-existing `__tests__/` fixture files (engine/flash/threads/runners) unrelated to this plan. None are in any file this plan touched (`explore-thread-view.tsx`/`.test.tsx` are clean). Already logged in this phase's `deferred-items.md` (during 11-05) — not re-fixed here per the scope-boundary rule.

## User Setup Required
None - no external service configuration required. (The Track write target `/api/tracked-accounts` + its `tracked_accounts` table land live in the BLOCKING migration wave 11-08, per 11-02; this view's POST is wired and will function once that wave pushes.)

## Next Phase Readiness
- **Ready for 11-07** (composer wiring): `ExploreThreadView` is built and tested. 11-07 mounts it in `composer.tsx`, supplies `audience` + `hasTrackedAccounts` + `onThreadReload` + `onQuickAction` (wired to `useExploreStream.start`) + `onRetry`, and gates `showExploreView` unconditionally on `activeTool === "explore"` (mirroring chat) so the idle screen shows. The composer's Explore submit branch must NEVER arm `pendingNavRef`/call `stream.start` (Pitfall 1).
- **Contract for the composer:** props are `{ persistedBlocks, streamingBlocks, stages, isStreaming, error, platform, audience, hasTrackedAccounts, onQuickAction, onRetry?, onThreadReload? }`. `onQuickAction` receives `ExploreQuickActionParams` ({ niche?, accounts?, timeWindow?, serendipity? }) — pass straight through to `useExploreStream.start`.

## Self-Check: PASSED

- FOUND: src/components/thread/explore-thread-view.tsx
- FOUND: src/components/thread/explore-thread-view.test.tsx
- FOUND: .planning/phases/11-explore-audience-curated-discovery-expansion-not-yet-discuss/11-06-SUMMARY.md
- FOUND commit: 11c79f95

---
*Phase: 11-explore-audience-curated-discovery*
*Completed: 2026-06-20*
