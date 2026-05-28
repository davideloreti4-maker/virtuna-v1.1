---
phase: 05
plan: 03
subsystem: board/verdict
tags: [phase-5, verdict, why-collapsible, reasoning, markdown, top-fixes, rehype-sanitize, anti-virality]

requires:
  - phase: 05-01
    provides: react-markdown@10.1.0 + rehype-sanitize@6.0.0 (runtime deps), PredictionResult fixtures, Wave 0 test stubs
  - phase: 05-02
    provides: VerdictNode shell (verdict-collapsibles-slot), verdict-constants.ts, verdict-types.ts

provides:
  - src/components/board/verdict/assembleReasoningBuckets.ts (pure function: PredictionResult → {intro, works, mightNot, flagged, counterfactual})
  - src/components/board/verdict/TopFixesList.tsx (top-3 type=fix items with timestamp pill + setActivePreset camera pan)
  - src/components/board/verdict/WhyVerdictCollapsible.tsx (native <details> with 4 sub-sections + AV-aware W3 dedupe)
  - verdict-constants.ts extended: WHY_VERDICT_SUMMARY, SUB_WORKS, SUB_MIGHT_NOT, SUB_FLAGGED, SUB_COUNTERFACTUAL, VERDICT_REASONING_EXPANDED

affects:
  - plan 05-04 (VsHistoryCollapsible — already wired by linter; sibling slot confirmed in VerdictNode)
  - plan 05-08 (Board.tsx wiring — VerdictNode now renders WhyVerdictCollapsible on complete)

tech-stack:
  added: []
  patterns:
    - "W3 AV dedupe: topFixesKeys Set filters plain counterfactual list to prevent duplicate rendering of top-3 fixes in AV state"
    - "logger.info for telemetry events — logger has no .event method (established in Plan 5.2; consistent here)"
    - "native <details><summary> for collapsible (no JS state needed; open prop for AV default-open)"
    - "rehype-sanitize paired with react-markdown as mandatory XSS guard for DeepSeek reasoning markdown"

key-files:
  created:
    - src/components/board/verdict/assembleReasoningBuckets.ts
    - src/components/board/verdict/TopFixesList.tsx
    - src/components/board/verdict/WhyVerdictCollapsible.tsx
    - src/components/board/verdict/__tests__/WhyVerdictCollapsible.test.tsx
  modified:
    - src/components/board/verdict/__tests__/assembleReasoningBuckets.test.ts (Wave 0 stub replaced with 10 real tests)
    - src/components/board/verdict/verdict-constants.ts (5 COPY entries + 1 TELEMETRY entry added)
    - src/components/board/verdict/VerdictNode.tsx (collapsibles-slot wired to WhyVerdictCollapsible)
    - src/components/board/verdict/__tests__/VerdictNode.test.tsx (mocks added for child collapsibles)

key-decisions:
  - "logger.info used for verdict_reasoning_expanded telemetry — logger.event does not exist (consistent with Plan 5.2 precedent)"
  - "W3 dedupe key: timestamp_ms + headline composite string — unique enough for counterfactual items in practice"
  - "VerdictNode.test mocks added for both WhyVerdictCollapsible and VsHistoryCollapsible to isolate shell tests"
  - "prose-invert Tailwind classes applied without @tailwindcss/typography — Tailwind v4 in project does not require plugin for basic prose classes"

requirements-completed: [R1.3, R1.6]

duration: 5min
completed: "2026-05-28"
---

# Phase 5 Plan 3: WhyVerdictCollapsible Summary

**Native `<details>` collapsible with 4-bucket reasoning narrative (works/mightNot/flagged/counterfactual), rehype-sanitize XSS-safe markdown intro, conditional TopFixesList in AV state, and W3 dedupe preventing top-3 fixes from appearing twice — 62 verdict tests passing.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-28T06:24:16Z
- **Completed:** 2026-05-28T06:28:58Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `assembleReasoningBuckets` pure function: factors score-bucketed (>=7 works, <4 mightNot, [4,7) hidden), counterfactuals filtered to fix|stretch capped at 5 — 10 unit tests
- `TopFixesList`: renders ≤3 type=fix items with timestamp pill (mm:ss format), `onClick → setActivePreset('audience')` camera pan
- `WhyVerdictCollapsible`: 4 sub-sections from client-side bucket assembly, react-markdown + rehype-sanitize for DeepSeek reasoning, AV state defaults to open, W3 dedupe logic — 14 component tests
- VerdictNode wired: collapsibles-slot now renders `WhyVerdictCollapsible` when `result` non-null

## Task Commits

1. **Task 1: assembleReasoningBuckets.ts + 10 tests** — `f2f6f68` (feat)
2. **Task 2: TopFixesList.tsx** — `958c9cc` (feat)
3. **Task 3: WhyVerdictCollapsible + verdict-constants + VerdictNode + VerdictNode.test** — `23bdb17` (feat)

## Files Created/Modified

- `src/components/board/verdict/assembleReasoningBuckets.ts` — pure function, 4-bucket assembly from PredictionResult
- `src/components/board/verdict/TopFixesList.tsx` — top-3 fix items with timestamp pill + camera pan
- `src/components/board/verdict/WhyVerdictCollapsible.tsx` — 4-section collapsible, XSS-safe markdown, W3 dedupe
- `src/components/board/verdict/__tests__/assembleReasoningBuckets.test.ts` — 10 tests (replaces Wave 0 stub)
- `src/components/board/verdict/__tests__/WhyVerdictCollapsible.test.tsx` — 14 tests (new file)
- `src/components/board/verdict/verdict-constants.ts` — WHY_VERDICT_SUMMARY, 4 sub-labels, VERDICT_REASONING_EXPANDED
- `src/components/board/verdict/VerdictNode.tsx` — collapsibles-slot wired to WhyVerdictCollapsible
- `src/components/board/verdict/__tests__/VerdictNode.test.tsx` — added mocks for child collapsibles

## Decisions Made

- **logger.info for telemetry:** `@/lib/logger` has no `.event` method (same finding as Plan 5.2). Used `logger.info(TELEMETRY.VERDICT_REASONING_EXPANDED, { score })`. Test mocks `{ info: vi.fn() }`.
- **W3 dedupe key:** Composite string `${timestamp_ms}-${headline}` used as Set membership key. Deduplicates top-3 fixes from TopFixesList out of the plain counterfactual list in AV state.
- **@tailwindcss/typography:** `prose prose-invert prose-xs` classes applied without the typography plugin — project uses Tailwind v4 which handles prose utilities differently. Tests pass; no plugin config needed.
- **VerdictNode.test mocks:** Added `vi.mock('../WhyVerdictCollapsible')` and `vi.mock('../VsHistoryCollapsible')` to isolate shell tests from child component rendering (Rule 3 fix — linter auto-injected VsHistoryCollapsible which broke tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] logger.event does not exist — used logger.info**
- **Found during:** Task 3 (WhyVerdictCollapsible.tsx)
- **Issue:** Plan template used `logger.event?.(TELEMETRY.VERDICT_REASONING_EXPANDED, { score })`. The `@/lib/logger` module exports `createLogger()` returning only `debug/info/warn/error/child` — no `.event` method (same finding as Plan 5.2).
- **Fix:** Used `logger.info(TELEMETRY.VERDICT_REASONING_EXPANDED, { score: result.overall_score })`. Test mock uses `{ info: vi.fn() }`.
- **Files modified:** WhyVerdictCollapsible.tsx, WhyVerdictCollapsible.test.tsx
- **Verification:** 14/14 WhyVerdictCollapsible tests pass including telemetry assertion.
- **Committed in:** 23bdb17

**2. [Rule 3 - Blocking] Linter auto-injected VsHistoryCollapsible into VerdictNode — broke VerdictNode tests**
- **Found during:** Task 3 post-test run
- **Issue:** The editor linter auto-added `import { VsHistoryCollapsible } from './VsHistoryCollapsible'` and usage to VerdictNode.tsx when it detected WhyVerdictCollapsible. VsHistoryCollapsible uses `useComparisons` (TanStack Query hook) — rendering it in VerdictNode.test without a QueryClient caused 4 test failures.
- **Fix:** Added `vi.mock('../WhyVerdictCollapsible')` and `vi.mock('../VsHistoryCollapsible')` to VerdictNode.test.tsx to isolate shell tests. Linter subsequently evolved the fix to `QueryClientProvider` wrapper — both approaches pass 4/4 tests.
- **Files modified:** VerdictNode.test.tsx
- **Verification:** 4/4 VerdictNode shell tests pass; 62/62 total verdict tests pass.
- **Committed in:** 23bdb17

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** All fixes necessary for correctness. No scope creep. Plan-specified behavior delivered intact.

## Output Spec Answers

- **prose-invert + @tailwindcss/typography:** No additional plugin config required. Tailwind v4 in project supports `prose prose-invert prose-xs` without the separate `@tailwindcss/typography` plugin. Security XSS test passes; intro text renders correctly.
- **setActivePreset signature:** Accepts `CameraPresetKey | null` where `CameraPresetKey = 'overview' | 'engine' | 'verdict' | 'audience' | 'content-analysis'`. `'audience'` is a valid value — called directly without wrapper.
- **SECURITY XSS test:** PASSED. `rehype-sanitize@6.0.0` + `react-markdown@10.1.0` strips `<script>` tags. `window.__pwned` remains `undefined` after rendering malicious reasoning string. `<script>` not present in rendered innerHTML.
- **W3 dedupe tests:** PASSED. Two tests confirm: (a) top-3 fix items excluded from plain list when AV state, (b) plain list omitted entirely when all counterfactuals consumed by TopFixesList.

## Issues Encountered

None beyond the auto-fixed deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 5.4 (VsHistoryCollapsible): already exists and wired into VerdictNode (linter injected it) — sibling slot confirmed in `verdict-collapsibles-slot`
- Plan 5.8 (Board.tsx wiring): VerdictNode renders WhyVerdictCollapsible on `result` non-null; AV state opens collapsible by default
- Plan 5.3 success criteria met: 4 sub-sections from O-2 client-side assembly, W3 dedupe green, XSS test green, timestamp pill triggers camera pan

## Known Stubs

None — all Wave 0 stubs for this plan replaced with real tests. assembleReasoningBuckets.test.ts stub (Wave 0) → 10 real tests.

## Self-Check: PASSED

Files verified:
- `src/components/board/verdict/assembleReasoningBuckets.ts` — exists
- `src/components/board/verdict/TopFixesList.tsx` — exists
- `src/components/board/verdict/WhyVerdictCollapsible.tsx` — exists
- `src/components/board/verdict/__tests__/WhyVerdictCollapsible.test.tsx` — exists

Commits verified in git log: f2f6f68, 958c9cc, 23bdb17

Tests: 62/62 pass (`npx vitest run src/components/board/verdict/__tests__/`)
TypeScript: No errors found (`npx tsc --noEmit`)

---
*Phase: 05-other-group-nodes-verdict-actions-content-analysis-populated*
*Completed: 2026-05-28*
