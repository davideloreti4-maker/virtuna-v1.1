---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: "08"
subsystem: ui
tags: [next.js, react, sse, tailwind, supabase, playwright, vitest, result-surface]

requires:
  - phase: 01-02
    provides: useAnalysisStream hook (D-02 locked 9-key shape), panel-mapping module (D-06)
  - phase: 01-03
    provides: GET /api/analyze/[id]/stream EventSource endpoint (D-04)
  - phase: 01-07
    provides: Database types regen + as-never cast cleanup

provides:
  - /analyze form page (server component shell + AnalyzeClient wrapper)
  - /analyze/[id] result page (server component with SSR DB fetch + ResultCard client)
  - ResultCard client component (10 GlassPanel slots, panelReady gating, data-* E2E hooks)
  - PanelSkeleton primitive (idle/loading/error states)
  - 8 result-card.test.tsx assertions (6 lifecycle + 2 B3 wiring proofs)
  - E2E spec with 1 real test() + 2 fixme (W7 ceiling satisfied)

affects:
  - Phase 3-5 panel implementations (inherit PANEL_LABEL, data-panel-id contract)
  - P7 E2E strengthening (auth fixture + seeded DB for Tests 2+3)
  - P6 permalink /r/<slug> (separate route, not this plan)

tech-stack:
  added: []
  patterns:
    - Server shell + client wrapper pattern (page.tsx + client.tsx)
    - GlassPanel zero-config wrapper div for data-* attribute forwarding
    - useAnalysisStream initialData Pitfall #3 short-circuit gate
    - B3 real-value panel wiring (optimal_post + emotion_arc)
    - Playwright page.route() SSE intercept for E2E without live backend

key-files:
  created:
    - src/app/(app)/analyze/page.tsx
    - src/app/(app)/analyze/analyze-client.tsx
    - src/app/(app)/analyze/[id]/page.tsx
    - src/app/(app)/analyze/[id]/result-card.tsx
    - src/app/(app)/analyze/[id]/result-card-skeleton.tsx
    - src/app/(app)/analyze/__tests__/result-card.test.tsx
    - e2e/result-surface-stream.spec.ts
    - src/lib/engine/panel-mapping.ts (brought from Plan 02 commits)
    - src/hooks/queries/use-analysis-stream.ts (brought from Plan 02 commits)
    - src/test/fixtures/completed-prediction.ts (brought from Plan 01 commits)
    - src/test/fixtures/stage-events.ts (brought from Plan 01 commits)
  modified:
    - src/lib/engine/types.ts (added emotion_arc, anti_virality_gated, optimal_post_window fields)

key-decisions:
  - "ContentForm wiring via onSubmit prop — maps ContentFormData to AnalysisStreamInput in AnalyzeClient; no ContentForm fork needed"
  - "GlassPanel data-* attribute forwarding via wrapper div — GlassPanel has 4-prop zero-config interface, cannot accept data-* directly"
  - "phase=error test uses vi.spyOn(useAnalysisStreamModule) mock — ResultCard doesn't call start() itself, so fetch-based trigger doesn't work"
  - "E2E Test 1 implemented as real test() using page.route() SSE intercept — bypasses backend requirement while satisfying W7 ceiling"
  - "Upstream Plan 02 files brought via git show from object store — wave orchestrator hasn't merged yet; files needed for compilation"
  - "XSS escaping convention for P3-P5: all panel content uses React JSX (auto-escaped), never dangerouslySetInnerHTML"

patterns-established:
  - "Panel data-panel-id/data-panel-ready on wrapper div (not GlassPanel) — E2E hook contract D-11"
  - "Server page returns null when !user (defensive, layout already redirects)"
  - "Row scoped by .eq('user_id', user.id) on all analysis_results queries — IDOR mitigation"
  - "Vitest mock via vi.spyOn(module, 'hookName').mockReturnValue() for hooks that don't expose test triggers"

requirements-completed: [R2.1]

duration: ~20min
completed: "2026-05-24"
---

# Phase 01 Plan 08: /analyze Route Scaffold + ResultCard Skeleton Summary

**10-slot GlassPanel ResultCard with panelReady gating + SSE stream wiring, /analyze form → /analyze/[id] navigation, B3 proofs for optimal_post and emotion_arc panels**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-24T12:54:00Z
- **Completed:** 2026-05-24T13:05:00Z
- **Tasks:** 4 (T1, T2, T3, T4 gate)
- **Files created/modified:** 12

## Accomplishments

- /analyze server page + AnalyzeClient wrapper: form submits via useAnalysisStream.start(), navigates to /analyze/[id] on analysisId + phase=analyzing
- /analyze/[id] server page: SSR fetch scoped by user_id (IDOR defense), passes row to ResultCard
- ResultCard: 10 GlassPanel slots, panelReady gating, data-panel-id/data-panel-ready for E2E, B3 wiring for optimal_post + emotion_arc panels
- PanelSkeleton: 3 visual states (idle/loading/error), reuses existing Skeleton component
- 8 result-card.test.tsx assertions all pass including B3 proofs
- E2E spec: 1 real test() with page.route() SSE intercept + 2 test.fixme (W7: ≤2 fixme, ≥1 real)
- Full vitest suite: 74 files, 996 tests, 0 failures

## Task Commits

1. **T1: /analyze form page + AnalyzeClient + upstream deps** - `b6877fb` (feat)
2. **T2: /analyze/[id] server page + ResultCard + PanelSkeleton** - `9fa2f18` (feat)
3. **T3: result-card.test.tsx 8 assertions + E2E spec W7 real test** - `064570d` (feat)
4. **T4: Phase 1 final verification gate** — verification-only, no new files

## Files Created/Modified

- `src/app/(app)/analyze/page.tsx` — server shell, metadata, Suspense wrapper
- `src/app/(app)/analyze/analyze-client.tsx` — ContentForm → useAnalysisStream.start() → router.push
- `src/app/(app)/analyze/[id]/page.tsx` — SSR fetch analysis_results with user_id scoping
- `src/app/(app)/analyze/[id]/result-card.tsx` — 10-panel GlassPanel grid with panelReady gating + B3 wiring
- `src/app/(app)/analyze/[id]/result-card-skeleton.tsx` — PanelSkeleton (idle/loading/error states)
- `src/app/(app)/analyze/__tests__/result-card.test.tsx` — 8 concrete assertions (filled from 7 it.todo stubs)
- `e2e/result-surface-stream.spec.ts` — 1 real test() + 2 test.fixme (W7 satisfied)
- `src/lib/engine/panel-mapping.ts` — PANEL_IDS, STAGE_TO_PANEL, panelReadyFromStages (from Plan 02)
- `src/hooks/queries/use-analysis-stream.ts` — D-02 locked 9-key hook (from Plan 02)
- `src/test/fixtures/completed-prediction.ts` — COMPLETED_PREDICTION + IN_FLIGHT_ROW
- `src/test/fixtures/stage-events.ts` — STAGE_EVENT_SEQUENCE + encodeSSE helper
- `src/lib/engine/types.ts` — added emotion_arc, anti_virality_gated, optimal_post_window to PredictionResult

## ContentForm Wiring Approach

ContentForm accepts `onSubmit: (data: ContentFormData) => void`. AnalyzeClient maps this to `useAnalysisStream.start()` by converting ContentFormData fields to AnalysisStreamInput. No fork of ContentForm was needed — option (a) from the plan (prop-based wiring). The mapping:
- `input_mode` → `input_mode`
- `caption` → `content_text` (text mode)
- `tiktok_url` → `tiktok_url` (URL mode)
- `video_caption` → `content_text` (video mode)
- `niche` → `niche`

## GlassPanel + Skeleton Import Paths

- GlassPanel: `@/components/primitives/GlassPanel` (named export `GlassPanel`)
- Skeleton: `@/components/ui/skeleton` (named export `Skeleton`)
- GlassPanel zero-config interface (4 props: children, className, style, as) does NOT forward data-* attributes. Solution: outer div wrapper carries data-panel-id and data-panel-ready; GlassPanel renders inside it.

## XSS Escaping Convention for P3-P5 Panel Implementations

**MANDATORY for P3-P5**: All panel content that renders dynamic data (factors[].rationale, reasoning narrative, persona reasoning, DeepSeek output) MUST use React's default JSX escaping — render as `{value}` or `<p>{value}</p>`, NEVER `dangerouslySetInnerHTML`. The B3 panels (optimal_post, emotion_arc) set this precedent: `JSON.stringify()` for structured data, template literal for summary lines, both rendered as text nodes.

## E2E Deferral Notes for P7

- **Test 2** (Pitfall #3 completed-analysis revisit): requires seeded completed-analysis row in Supabase + auth fixture at `e2e/auth/state.json`. P7 adds `auth.setup.ts` flow.
- **Test 3** (connection drop → reconnecting): requires Playwright CDP network condition simulation. P7 implements after reconnect ladder is validated.
- **Test 1** is REAL via `page.route()` intercepting POST `/api/analyze` with canned SSE body. Auth state required (e2e/auth/state.json). If auth fixture is absent in CI, test may fail at `/analyze` navigation — document as known CI dependency.

## Phase 1 Verification Results (T4 Gate)

| Check | Result |
|-------|--------|
| `vitest run` (full suite) | PASS — 74 files, 996 tests, 0 failed |
| `tsc --noEmit` | PASS — 0 errors |
| `npm run lint` (all modified files) | PASS — 0 errors from plan-08 files; pre-existing warnings unrelated to this plan |
| `playwright test --list` (dry run) | PASS — 4 tests collected (1 real + 2 fixme + 1 setup) |
| Manual smoke check | SKIPPED — dev server not running in this worktree (parallel execution context) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upstream Plan 02 files not in worktree history**
- **Found during:** Task T1 setup
- **Issue:** `use-analysis-stream.ts`, `panel-mapping.ts`, `completed-prediction.ts`, `stage-events.ts` were committed on other agent worktree branches (Plans 01-02, 01-01) and not yet in this worktree's history. Wave orchestrator merges these after the wave completes.
- **Fix:** Used `git show <hash>:path` to extract each file from the git object store and write it directly. Commits used: `b4e7cbc` (panel-mapping), `a04bfbd` (use-analysis-stream), `c29d5a0` (fixtures), `34f6872` (stubs).
- **Files created:** 4 upstream dependency files + result-card.test.tsx stub + e2e stub
- **Verification:** TypeScript compiles clean after files written; all imports resolve

**2. [Rule 1 - Bug] phase=error test required mock instead of fetch trigger**
- **Found during:** Task T3 (result-card.test.tsx)
- **Issue:** Test 5 (phase=error → alert + Retry) attempted to trigger error via fetch returning 500. But ResultCard doesn't call `start()` — it only renders based on hook state. The mutation never fires.
- **Fix:** Used `vi.spyOn(useAnalysisStreamModule, 'useAnalysisStream').mockReturnValue()` to inject `phase: 'error'` directly into the component, bypassing the need to trigger the mutation.
- **Files modified:** `src/app/(app)/analyze/__tests__/result-card.test.tsx`
- **Verification:** Test passes; alert role and Retry button both found in DOM

**3. [Rule 2 - Missing Critical] Added Phase 1 type fields to PredictionResult**
- **Found during:** Task T2 (result-card.tsx TypeScript check)
- **Issue:** `result?.optimal_post_window` and `result?.emotion_arc` access in result-card.tsx caused TypeScript errors — these fields not on `PredictionResult` in this worktree (Plans 04, 05, 06 added them on other branches).
- **Fix:** Added `emotion_arc`, `anti_virality_gated`, `optimal_post_window` as optional fields to `PredictionResult` in `src/lib/engine/types.ts`.
- **Files modified:** `src/lib/engine/types.ts`
- **Verification:** `tsc --noEmit` reports 0 errors

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for compilation and test correctness. The upstream-files deviation is a known wave-parallel execution artifact; the wave orchestrator merges these on completion.

## Known Stubs

The following intentional stubs exist per plan specification (to be replaced in Phase 3-5):
- 8 non-B3 panels in `result-card.tsx` render `"Panel content placeholder — implemented in Phase 3-5"` — this IS the plan-specified behavior, not an unintended stub. Plans 03-05 replace each with real panel content.

## Threat Flags

No new threat surface beyond what's documented in the plan's threat model (T-01-RC-XSS, T-01-RC-IDOR, T-01-RC-meta-leak, T-01-RC-deeplink-replay). All IDOR mitigations applied: `.eq("user_id", user.id)` on analysis_results query.

## Issues Encountered

- GlassPanel zero-config interface doesn't accept data-* attributes — resolved via wrapper div pattern (documented in GlassPanel section above)
- `AnalysisStreamInitialData` type not exported from use-analysis-stream hook — used `// eslint-disable-next-line` + `as any` cast since the hook's internal type is compatible (permissive union)

## Next Phase Readiness

- Phase 3-5 panel implementations can import PANEL_IDS + PANEL_LABEL contract and replace placeholder copy per panel
- P6 permalink /r/<slug> can reuse the same ResultCard component with a completed initialData
- P7 E2E strengthening: implement auth.setup.ts → then Tests 2+3 become implementable

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Completed: 2026-05-24*
