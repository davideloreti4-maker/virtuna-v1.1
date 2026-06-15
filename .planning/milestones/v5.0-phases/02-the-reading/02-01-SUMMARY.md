---
phase: 02-the-reading
plan: 01
subsystem: ui
tags: [react, svg, radix, sheet, vitest, vitest-axe, tailwind-v4, flat-warm, gauge, disclosure]

# Dependency graph
requires:
  - phase: 01-foundation-shell
    provides: "THEME-06 flat-warm tokens (--color-success/-warning/-error, --color-surface, --color-foreground, --color-border, --ease-out-cubic), useIsMobile/usePrefersReducedMotion hooks, vendored ui/sheet.tsx (Radix Dialog)"
provides:
  - "ScoreGauge — hand-rolled inline-SVG arc gauge; zone fill from bandTone SSOT; score is a Phase-4-drivable prop (READ-02)"
  - "DrillSheet — generic children-based disclosure container; bottom-mobile/right-desktop via useIsMobile; the Phase-3/5 mount point (READ-07)"
  - "src/components/reading/__tests__/ — Wave-0 test scaffold + shared makeReadingResult PredictionResult fixture all later reading plans reuse"
affects: [02-02, 02-03, 02-04, 02-05, phase-03-rich-visuals, phase-05-followup-demo]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies (RESEARCH Package Legitimacy Gate not triggered)
  patterns:
    - "Hand-rolled stroke-dasharray SVG gauge (no react-circular-progressbar) — fill is a prop, CSS transition gated on usePrefersReducedMotion"
    - "Generic children-based DrillSheet (no panel registry) — side switch internal via useIsMobile; callers own the child"
    - "Shared makeReadingResult fixture extends board fixtures.antiVirality + layers Apollo/heatmap/counterfactuals; cast as unknown as PredictionResult"
    - "axe scoped to the dialog element (not whole document) to avoid Radix focus-guard false positive under happy-dom"

key-files:
  created:
    - src/components/reading/score-gauge.tsx
    - src/components/reading/drill-sheet.tsx
    - src/components/reading/__tests__/fixtures/reading-fixture.ts
    - src/components/reading/__tests__/score-gauge.test.tsx
    - src/components/reading/__tests__/drill-sheet.test.tsx
  modified:
    - src/components/ui/sheet.tsx  # forward `side` as data-side (Rule 3 — enables data-[side=...] variants)

key-decisions:
  - "Gauge fill uses bandTone(score) SSOT — amber owns the WHOLE 40-69 band (RESEARCH correction #2), never red there"
  - "DrillSheet stays panel-agnostic (children-based, no registry) so Phase 3 + Phase 5 add panel TYPES without touching it"
  - "Forward `side` as data-side on the shared ui/sheet.tsx SheetContent so the documented data-[side=...] Tailwind variants work (additive, no other consumers)"
  - "Scope axe to the dialog (whole-doc trips a known Radix-under-happy-dom focus-guard false positive); aria-describedby={undefined} opts out of the unused-description warning"

patterns-established:
  - "Reading components live in src/components/reading/ (NOT the legacy app/simulation/ dir); flat-warm matte (no glow/shadow-lg/inset/blur)"
  - "Reuse pure helpers verbatim (bandTone, bandFromScore) — never re-derive thresholds; import the SSOT"
  - "All reading component tests import the shared makeReadingResult fixture; scenario helpers makeUnavailable/Partial/ApolloNull cover degraded states"

requirements-completed: [READ-02, READ-07]

# Metrics
duration: 9min
completed: 2026-06-14
---

# Phase 2 Plan 01: Reading Primitives (ScoreGauge + DrillSheet) Summary

**Two foundational presentation primitives — a hand-rolled zone-colored SVG arc ScoreGauge (READ-02) and a generic children-based DrillSheet disclosure container (READ-07, the Phase-3/5 mount point) — plus the Wave-0 reading test scaffold with a shared PredictionResult fixture, all on the locked flat-warm system with zero new dependencies.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-14T17:58:34Z
- **Completed:** 2026-06-14T18:08:07Z
- **Tasks:** 3 (5 commits — TDD task 2 split RED/GREEN + a typing fix)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- **ScoreGauge** (READ-02, D-01): flat stroked inline-SVG arc, 270° dial (`-rotate-[225deg]`), fill zone-colored by `bandTone()` SSOT (≥70 green / 40-69 amber / <40 red), centered Inter 36px/600/tabular-nums number + `bandFromScore()` band word; motion gated on `usePrefersReducedMotion`; `score` is a Phase-4-drivable prop (no internal stream); matte (no glow/halo/filter).
- **DrillSheet** (READ-07, D-09/D-11): generic `children`-based container = the single most-reused decision in the milestone (Phase 3 rich charts AND Phase 5 chat both mount here). Bottom sheet on mobile / right drawer on desktop via `useIsMobile`; flat-warm reskin (charcoal `bg-surface`, hairline border, `shadow-none`, no inner shine, no blur); required `SheetTitle` for a11y; panel-agnostic (no registry, no panelId switch baked in).
- **Wave-0 scaffold**: `src/components/reading/__tests__/` + shared `makeReadingResult()` fixture (extends board `fixtures.antiVirality`, layers Apollo §4 reasoning with 6 dimensions 0-100, 2 rewrites, heatmap personas, `weighted_top_dropoff_t: 8` seconds, `weighted_completion_pct: 0.57`, 3+ fixes) + scenario helpers `makeUnavailableResult`/`makePartialResult`/`makeApolloNullResult` for the D-13 degraded states.
- **Tests:** 14 new (7 gauge + 7 sheet), all green; full suite **1981 passed** (was 1967 at Phase-1 baseline), 0 failures.

## Task Commits

1. **Task 1: Wave-0 test scaffold + shared reading fixture** — `6a6e30fa` (test)
2. **Task 2 (RED): failing ScoreGauge test** — `5af795e0` (test)
3. **Task 2 (GREEN): ScoreGauge implementation** — `c50677eb` (feat)
4. **Task 2 (fix): vitest 4 vi.fn typing on the gauge mock** — `7aec2f32` (fix)
5. **Task 3: DrillSheet + test + ui/sheet data-side** — `399f191f` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_TDD task 2 ran RED → GREEN as separate commits; no REFACTOR needed (implementation was already minimal). The typing fix is a follow-on Rule-1 correction to the committed test file._

## Files Created/Modified
- `src/components/reading/score-gauge.tsx` (108 lines) — hero arc gauge; `bandTone` zone fill, `bandFromScore` band word, Phase-4 prop, matte, reduced-motion-gated.
- `src/components/reading/drill-sheet.tsx` (65 lines) — generic disclosure container; `useIsMobile` side switch, flat-warm, panel-agnostic, the Phase-3/5 mount point.
- `src/components/reading/__tests__/fixtures/reading-fixture.ts` (180 lines) — `makeReadingResult` + 3 scenario helpers; the shared test foundation for all reading plans.
- `src/components/reading/__tests__/score-gauge.test.tsx` (78 lines) — 7 tests (zone fill 85/55/30, amber-not-red at 55, aria-label, tabular-nums number, both motion branches, axe).
- `src/components/reading/__tests__/drill-sheet.test.tsx` (105 lines) — 7 tests (children render open / hidden closed, dialog named by title, Esc + close-button fire onOpenChange, side desktop/mobile, axe).
- `src/components/ui/sheet.tsx` (modified, +1 line) — forward `side` as `data-side` on `SheetContent`.

## Decisions Made
- **Gauge zone fill = `bandTone()` SSOT, amber spans the whole 40-69 band** (RESEARCH correction #2). Tested explicitly: score=55 → `var(--color-warning)` and asserted *not* `var(--color-error)`. Re-deriving thresholds would risk drift from the engine bands.
- **DrillSheet is children-based, not a panel registry.** The caller (a row, the cloud, a chat trigger) owns which panel; DrillSheet owns only the surface + side switch + a11y. This is the minimum API that keeps the Phase-3/5 seam open.
- **Ephemeral open/close for v1** (no `?panel=` URL sync). UI-SPEC sanctions ephemeral; the shallow-sync is a downgradeable enhancement deferred to the container plan (02-05). When added, the param must be validated against the closed allow-list before opening (Security V5 / threat T-02-01) — DrillSheet itself stays panel-agnostic so it never reflects a raw param.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forward `side` as `data-side` on the shared `ui/sheet.tsx` SheetContent**
- **Found during:** Task 3 (DrillSheet)
- **Issue:** The vendored `SheetContent` consumed `side` only for className branching and did NOT emit it as a data attribute. The DrillSheet's documented flat-warm Tailwind variants (`data-[side=bottom]:max-h-[85vh]`, `data-[side=bottom]:rounded-t-[16px]`) depend on a `data-side` attribute to take effect, and the test asserts the rendered side. Without it the mobile bottom-sheet sizing/radius silently no-op'd.
- **Fix:** Added `data-side={side}` to `SheetPrimitive.Content`. Additive, non-breaking — verified there are **no other `ui/sheet` consumers** in the repo and no existing sheet tests; the new attribute only enables the documented pattern.
- **Files modified:** src/components/ui/sheet.tsx
- **Verification:** DrillSheet test "opens to the right on desktop and the bottom on mobile" passes; full suite 1981 green (no regression).
- **Committed in:** 399f191f (Task 3 commit)

**2. [Rule 1 - Bug] vitest 4 `vi.fn` type signature on the gauge mock**
- **Found during:** Task 2/3 (post-implementation `tsc --noEmit` sweep)
- **Issue:** `vi.fn<[], boolean>()` uses the vitest-3 two-type-arg form; vitest 4 takes a single function-type argument, producing 5 strict-tsc errors (TS2558/TS2345) in `score-gauge.test.tsx`. Runtime was green (JS transform tolerated it) but the project runs `tsc` strict + CLAUDE.md mandates a clean typecheck.
- **Fix:** `vi.fn<() => boolean>()`.
- **Files modified:** src/components/reading/__tests__/score-gauge.test.tsx
- **Verification:** `tsc --noEmit` reports zero `reading/` errors; tests still 7/7 green.
- **Committed in:** 7aec2f32

**3. [Rule 2 - Missing a11y] axe scoping + `aria-describedby={undefined}` on DrillSheet**
- **Found during:** Task 3 (DrillSheet)
- **Issue:** (a) Axing the whole document tripped a known Radix-under-happy-dom false positive — the portal-level `data-radix-focus-guard` sentinel spans are reported as aria-hidden-focusable (real browsers handle them correctly). (b) Radix logged a non-fatal "Missing Description" dev warning because no `SheetDescription` was provided.
- **Fix:** Scoped the axe assertion to the dialog element (the component's own a11y surface). Added `aria-describedby={undefined}` on SheetContent to explicitly opt out of the description requirement (the title names the dialog).
- **Files modified:** src/components/reading/drill-sheet.tsx, src/components/reading/__tests__/drill-sheet.test.tsx
- **Verification:** axe test green; Radix description warning gone; `getByRole('dialog', { name })` confirms the accessible name.
- **Committed in:** 399f191f (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 a11y). **Impact on plan:** All necessary for correctness/a11y/the documented flat-warm variants. No scope creep — the `ui/sheet.tsx` change is a single additive attribute the plan's own UI-SPEC reskin presupposes.

## Issues Encountered
- **Pre-existing `tsc` errors in unrelated test files (out of scope, NOT fixed).** The `tsc --noEmit` sweep surfaced **12 strict-typecheck errors across 6 files this plan never touched** (`lib/engine/wave3/__tests__/*`, `lib/engine/__tests__/stage10-critique` + `flop-warning`, and `board/verdict/__tests__/fixtures/prediction-result.ts`) — several from the known `test: changes` git-autocommit. Per the executor SCOPE BOUNDARY rule these are logged to `.planning/phases/02-the-reading/deferred-items.md`, not fixed. **Zero production-code tsc errors**; all of this plan's new files are tsc-clean. A green `tsc` gate (if required before milestone merge) needs a separate typecheck-cleanup task.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **02-02/03/04 (parallel content blocks)** are unblocked: they import `makeReadingResult` from the shared fixture and compose `ScoreGauge` / open `DrillSheet`.
- **02-05 (container)** will own the single `useState<{open, panelId}>` that drives one `DrillSheet`, mount `<Reading/>` in `analyze/layout.tsx`, and (optionally) add the downgradeable `?panel=` shallow-sync — validating the param against the closed allow-list before opening (threat T-02-01).
- **Phase 3** mounts rich charts (RetentionChart, PersonaGraph) into the same `DrillSheet` surface — no structural change needed (the children-based contract holds).
- **Phase 4** drives `ScoreGauge`'s `score` prop from `useAnalysisStream`; the `stroke-dasharray` transition makes the fill glide 0→score with no rewrite.
- Sidebar score-chip token unification (Phase-1 follow-up) is still pending — not in this plan's scope.

## Self-Check: PASSED

All 5 created files verified on disk; all 5 task commits verified in git log
(`6a6e30fa`, `5af795e0`, `c50677eb`, `7aec2f32`, `399f191f`). Reading test suite
14/14 green; full suite 1981 passed / 0 failed; zero production-code tsc errors.

---
*Phase: 02-the-reading*
*Completed: 2026-06-14*
