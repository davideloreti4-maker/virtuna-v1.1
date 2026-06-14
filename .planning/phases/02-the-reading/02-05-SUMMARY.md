---
phase: 02-the-reading
plan: 05
subsystem: ui
tags: [react, next-app-router, layout, tanstack-query, apollo, honesty-gate, read-10, flat-warm, tdd]

# Dependency graph
requires:
  - phase: 02-the-reading (02-01)
    provides: ScoreGauge + DrillSheet (generic children-based mount point) + shared makeReadingResult/makeUnavailable/makePartial/makeApolloNull fixtures
  - phase: 02-the-reading (02-02)
    provides: PersonaCloud (dots-only, omits on empty personas) + ThumbnailStrip + AntiViralityHeader re-export
  - phase: 02-the-reading (02-03)
    provides: DriverRows (dimensions/dropT/onRowTap) + bandTone/zone-token SSOT
  - phase: 02-the-reading (02-04)
    provides: FixFirstList (fixes/rewrites) + DeeperRead (dimensions) + RewriteItem
  - phase: 01-foundation-shell
    provides: (app) AppShell 760px column + auth gate + usePermalinkAnalysis single-source hook + the /analyze dormant route shell
provides:
  - "Reading container (reading.tsx) — single usePermalinkAnalysis subscription, dual-read, D-13 honesty gate FIRST, locked vertical IA (READ-01), hero-owned watch% rendered exactly once (READ-04), one DrillSheet driven by a closed-union panel state with native D-12 content"
  - "src/components/reading/index.ts barrel — Reading + all leaves exported for Phase-3/4/5 reuse"
  - "/analyze layout restructured (Landmine 0): mounts <Reading/> in place of the Konva <Board>; board sources + route files preserved dormant"
  - "READ-10 no-cut-data regression guard (reading.no-cut-data.test.tsx) — asserts every banned cut/jargon field stays out of the DOM, including all drill panels"
affects: [03-rich-visuals, 04-stage-reveal, 05-follow-up-demo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source container: the brain calls usePermalinkAnalysis ONCE; every leaf takes data as props (the InsightHeroFrame per-leaf re-subscribe is severed). Data source stays abstracted so Phase 4 swaps in the live-stream hook without a rewrite."
    - "D-13 honesty short-circuit BEFORE composition: no-id→inert, loading→calm state, !data(with id)→error, analysis_unavailable→CouldNotAnalyze — the fabricated 0 never reaches ScoreGauge. partial_analysis annotates; apollo-null degrades rows/deeper while hero/gate resolve from overall_score."
    - "Hero-owned watch% (READ-04): the CONTAINER computes averageWatchThrough (fallback heatmap.weighted_completion_pct×100) and renders {n}% watch OUTSIDE PersonaCloud, so it survives the empty-personas path where the cloud omits itself."
    - "Landmine-0 layout inversion: the Reading mounts from analyze/layout.tsx (not the page), keeping one instance across submit→/analyze/[id]; [id]/page.tsx stays metadata-only."
    - "READ-10 assert-absent guard: extend the healthy fixture with EVERY banned field carrying distinctive sentinels, render the full thread + open every panel, assert none reach the DOM — the whitelist discipline made into a standing regression test."

key-files:
  created:
    - src/components/reading/reading.tsx
    - src/components/reading/index.ts
    - src/components/reading/__tests__/reading.test.tsx
    - src/components/reading/__tests__/reading.degraded.test.tsx
    - src/components/reading/__tests__/reading.no-cut-data.test.tsx
  modified:
    - src/app/(app)/analyze/layout.tsx

key-decisions:
  - "No-id /analyze stays inert (returns null) while id-present-but-data-null is a real load error — disambiguated by `id`, so the Phase-1 composer shell owns the no-id screen AND a permalink fetch failure shows the error state (both required by the same container)."
  - "panelId is a closed union (hook|retention|shareability|personas) mapped through a PANEL_TITLE allow-list — never a reflected key (threat T-02-12)."
  - "Native D-12 drill content reads ONLY whitelisted fields: Hook=hook_decomposition modality sub-scores + weakest_modality (falls back to the hook dimension's lever/evidence when decomposition absent); Retention=dropoff_segment_indices→segments text list; Shareability=share_pull lever+evidence; Personas=persona attention-mean list (the Phase-3 PersonaGraph seam)."
  - "dropT reads data.weighted_top_dropoff_t (the canonical top-level path the existing DriverRows test asserts) with data.heatmap?.weighted_top_dropoff_t as a fallback — reconciles the plan action text (heatmap path) with the live DriverRows contract."

patterns-established:
  - "The Reading container is the ONLY usePermalinkAnalysis subscriber in the namespace; children are pure prop-driven leaves (verified: the two hook tokens in reading.tsx are the import + the single call)."
  - "READ-10 whitelist discipline is enforced AND regression-guarded: no component under src/components/reading spreads raw PredictionResult into JSX (grep clean), and the no-cut-data test fails loudly if any banned field ever leaks."

requirements-completed: [READ-01, READ-03, READ-04, READ-08, READ-10]

# Metrics
duration: 11min
completed: 2026-06-14
---

# Phase 2 Plan 05: The Reading Container + /analyze Restructure Summary

**The integration wave that makes the Reading real on /analyze/[id] — a single-source container that fetches once, runs the D-13 honesty gate FIRST (the fabricated 0 never reaches the gauge), composes the Wave-2 blocks in the locked vertical order with watch% hero-owned and rendered exactly once, drives one DrillSheet of native panel content, and inverts the /analyze layout from the Konva Board mount to the Reading mount — all under a standing READ-10 no-cut-data guard.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-14T18:47:56Z
- **Completed:** 2026-06-14T18:59:04Z
- **Tasks:** 3 (Task 1 TDD)
- **Files modified:** 6 (5 created, 1 restructured)

## Accomplishments
- `reading.tsx` container — the brain: ONE `usePermalinkAnalysis`, dual-read (`variants.apollo ?? apollo_reasoning`), D-13 gate first, locked IA, hero-owned watch% once, one DrillSheet with native D-12 content, READ-10 whitelist reads only, no prose (D-15).
- `/analyze` layout inverted (Landmine 0): `<Reading/>` replaces `<Board/>`; `[id]/page.tsx` metadata-only; board sources + route files preserved dormant; `npm run build` clean (exit 0).
- READ-10 standing regression guard — every banned cut/jargon field proven absent from the full thread and every drill panel.
- Full suite green at **2035 passed / 0 failed** (was 2019) — +16 tests (13 container + 3 no-cut-data).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reading container — single source, D-13 gate first, locked IA, one DrillSheet (READ-01/03/04/08)** - `96fb1bde` (feat) [TDD: container + tests written and verified together; both test files green before commit]
2. **Task 2: Restructure /analyze layout to mount `<Reading/>` (Landmine 0)** - `d8ea5c32` (feat)
3. **Task 3: READ-10 no-cut-data enforcement + full-suite green gate** - `39882308` (test)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `src/components/reading/reading.tsx` (391 lines) — the container: single source, dual-read, D-13 gate, locked vertical composition, hero-owned watch%, one DrillSheet + native panel content (Hook/Retention/Shareability/Personas), D-13 states (loading/error/CouldNotAnalyze).
- `src/components/reading/index.ts` — barrel: `Reading` + all leaves (ScoreGauge, PersonaCloud, ThumbnailStrip, AntiViralityHeader, DriverRows, FixFirstList, RewriteItem, DeeperRead, DrillSheet).
- `src/app/(app)/analyze/layout.tsx` (34 lines) — Landmine-0 inversion: mounts `<Reading/>` (was `<Board/>`), keeps `<Suspense>` + sr-only metadata children.
- `src/components/reading/__tests__/reading.test.tsx` — composition order (READ-01), hero+watch%-once (READ-04), gate-above-gauge, empty-personas degraded watch%, disclosure (READ-07), a11y.
- `src/components/reading/__tests__/reading.degraded.test.tsx` — D-13: unavailable short-circuit (no gauge, no fabricated 0), partial annotation, apollo-null degrade, error state, no-id inert, loading.
- `src/components/reading/__tests__/reading.no-cut-data.test.tsx` — READ-10 assert-absent guard across the full thread + every drill panel.

## Decisions Made
- **No-id vs failed-fetch disambiguation by `id`:** `!id && !data` → inert (Phase-1 composer shell owns the screen); `id && !data` → `ReadingError` ("This Simulation didn't load"). The same container serves the dormant `/analyze` route AND a real permalink failure.
- **`dropT` path reconciliation:** reads `data.weighted_top_dropoff_t` (the top-level SECONDS field the existing DriverRows test asserts) with `data.heatmap?.weighted_top_dropoff_t` as a fallback — honors both the live DriverRows contract and the plan's heatmap-path action text.
- **Native drill content (D-12)** reads only whitelisted fields; the Hook panel falls back to the hook dimension's lever/evidence when `hook_decomposition` is absent, so the panel is never empty when Apollo data exists.

## Deviations from Plan

### Reconciliations (faithful-intent, no scope change)

**1. [Rule 3 - Blocking] `dropoff_segment_indices` lives on the top-level PredictionResult, not HeatmapPayload**
- **Found during:** Task 1 (RetentionPanel native content)
- **Issue:** The plan's interface lists `heatmap.segments[]` for the Retention drill; `dropoff_segment_indices` is a top-level `PredictionResult` field (types.ts L393), not a `HeatmapPayload` member — reading `heatmap.dropoff_segment_indices` would not type-check.
- **Fix:** RetentionPanel takes `dropIndices={data.dropoff_segment_indices}` from the top level, falling back to all `heatmap.segments` when absent.
- **Files modified:** src/components/reading/reading.tsx
- **Verification:** tsc clean; disclosure test opens the Retention panel without throw.
- **Committed in:** `96fb1bde`

**2. [Acceptance-grep intent] Single-source grep floor is 2 (import + call), not 1**
- **Found during:** Task 1 verification
- **Issue:** The acceptance criterion `grep -c "usePermalinkAnalysis\|useAnalysisStream" reading.tsx` expects `1`; the irreducible minimum for a single subscription is the `import` line + the one call site = **2 matching lines**. I reworded the JSDoc to remove the bare hook tokens so the count is exactly import(1)+call(1)=2 with zero noise.
- **Fix:** comment wording only; the single-source invariant holds (exactly one call; `useAnalysisStream` appears nowhere; children take props).
- **Verification:** `grep -n` shows only line 10 (import) + line 96 (call). `grep -c "<DrillSheet"` = 1.
- **Committed in:** `96fb1bde`

### Out-of-scope (logged, NOT fixed — SCOPE BOUNDARY)

- **`fix-first.test.tsx:3` unused `within` import (TS6133):** introduced by Plan 02-04 (`1890a5de`), not this plan. Typecheck-only — `npm test` green, `npm run build` clean (exit 0), so non-blocking. Logged to `deferred-items.md` for the typecheck-cleanup task.

---

**Total deviations:** 2 reconciliations (1 blocking type-path correction, 1 comment-grep alignment), 0 behavioral changes. 1 out-of-scope item logged.
**Impact on plan:** No scope creep. The container ships exactly the locked IA + honesty + READ-10 discipline the plan specifies.

## Issues Encountered
- **Watch%-once assertion via raw textContent was unreliable:** the cloud's `sr-only` per-persona "{n}% watch-through" mirror and merged textContent (adjacent numbers concatenate without separators) made a `/\d+% watch/` regex over `container.textContent` count 4 (healthy) / mangle digits. **Resolved** by asserting the caption ELEMENT (`data-testid="reading-watch"` appears exactly once + its text is `^\d+% watch$`) and proving no other `p|span` renders a standalone `^\d+% watch$` caption — a precise "hero-owned, rendered once" check that ignores the distinct a11y "watch-through" string. The component was correct throughout; only the test's matching strategy was tightened.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Phase 3 (Rich Visuals as Drill-Downs, READ-09) is unblocked:** the single `DrillSheet` is the mount point — Phase 3 swaps each native panel (`PanelContent`) for the rich chart and mounts the full Konva-free `PersonaGraph` in the Personas seam, with no container rewrite. The cloud's `onOpen` and each row's `onRowTap` already drive the closed-union panel state.
- **Phase 4 (Stage-Reveal) is unblocked:** the data source is abstracted behind `usePermalinkAnalysis` — Phase 4 swaps in `useAnalysisStream` at the container only; `ScoreGauge`'s `score` prop + CSS transition already glide 0→value when the stream drives it.
- **The /analyze thread is live:** `/analyze/[id]` renders the vertical Reading inside the AppShell 760px column; `/analyze` (no id) keeps the Phase-1 composer shell; build is clean.

## Self-Check: PASSED

- All 5 created files present + the restructured `analyze/layout.tsx` mounts `<Reading/>`.
- All 3 task commits exist in git (`96fb1bde`, `d8ea5c32`, `39882308`).
- Full suite green (2035 passed / 0 failed); build clean (exit 0).

---
*Phase: 02-the-reading*
*Completed: 2026-06-14*
