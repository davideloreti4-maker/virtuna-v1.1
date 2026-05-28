---
phase: "05"
plan: "E2E-STREAMING-FIX"
subsystem: "streaming-ux"
tags: ["ux", "streaming", "persistence", "navigation", "toast"]
dependency_graph:
  requires: []
  provides: ["analysis_results row always has overall_score after pipeline", "URL reflects analysis ID", "streaming progress visible to user"]
  affects: ["Board.tsx", "InputDrawer.tsx", "use-analysis-stream.ts", "route.ts"]
tech_stack:
  added: []
  patterns: ["explicit DB UPDATE before SSE complete", "useRef null-transition guard", "persistent toast with action"]
key_files:
  created: []
  modified:
    - src/app/api/analyze/route.ts
    - src/app/api/analyze/__tests__/route.test.ts
    - src/components/board/InputDrawer.tsx
    - src/components/board/__tests__/InputDrawer.test.tsx
    - src/components/board/Board.tsx
    - src/components/board/__tests__/Board.test.tsx
    - src/hooks/queries/use-analysis-stream.ts
    - src/components/board/verdict/verdict-constants.ts
    - src/app/(app)/analyze/__tests__/result-card.test.tsx
    - src/components/board/audience/__tests__/use-audience-choreography.test.ts
    - src/components/board/audience/__tests__/use-audience-choreography.streaming.test.ts
decisions:
  - "UPDATE added after UPSERT as safety net — UPSERT conflict-resolution anomaly was root cause of null score"
  - "router.push (hard nav) over replaceState — triggers Board permalinkQuery refetch, fixes multi-instance stream mismatch"
  - "toast duration=0 — persistent until explicitly dismissed, not auto-expiring during 90s analysis"
  - "prevAnalysisIdRef initialized from stream.analysisId (not null) — prevents spurious nav on permalink-replay"
metrics:
  duration: "~35 min"
  completed: "2026-05-28"
  tasks: 3
  files_modified: 11
---

# Phase 05 E2E Streaming Fix Summary

Three E2E-flow UX bugs fixed, discovered during Playwright UAT against milestone/result-surface.

## One-liner

Three-bug streaming fix: DB persistence guarantee via explicit UPDATE, URL routing via router.push on stream start, persistent progress toast with Cancel during 60-120s analysis wait.

## Commits

| Hash | Message |
|------|---------|
| 60f6537 | fix(05-ux): persist pipeline result to analysis_results row |
| 5bfd305 | fix(05-ux): hard-redirect to /analyze/[id] on stream start |
| 8ecc891 | fix(05-ux): streaming progress toast + Cancel button |

## Fix 1 — Persist pipeline result (overall_score=null bug)

**Root cause:** POST /api/analyze SSE path had a placeholder INSERT at start (overall_score=null sentinel) and an UPSERT at pipeline completion. The UPSERT was expected to overwrite the null, but a conflict-resolution anomaly caused the final values to be silently dropped, leaving overall_score=null in Supabase after 3+ minute pipeline run.

**Fix:** Added an explicit `analysis_results.update(...)` call immediately before `send("complete", finalResult)`. This is a targeted UPDATE (not UPSERT) that guarantees overall_score and all score columns are written even if the earlier UPSERT had issues. Non-fatal: UPDATE failure is logged but stream still emits event:complete.

**Columns updated:** overall_score, confidence, factors, suggestions, reasoning, warnings, retrieval_evidence, retrieval_score, behavioral_predictions, feature_vector, gemini_score, rule_score, trend_score, ml_score, score_weights, signal_availability, updated_at.

**Schema note:** `insights` column is `string | null` (not Json) in analysis_results — omitted from UPDATE. `warnings` is `string[]` — cast correctly.

**Tests added (route.test.ts):**
- SSE path calls update() with overall_score before event:complete
- JSON path does NOT call update() (uses buildInsertRow INSERT)
- UPDATE failure is non-fatal — stream still emits event:complete

## Fix 2 — Navigate to /analyze/[id] on stream start

**Root cause:** InputDrawer and Board each instantiate `useAnalysisStream()` separately (no shared context). When InputDrawer's stream sees `event:started {id}`, Board's separate instance never receives it because it has a different POST in-flight tracking. Board's permalinkQuery (TanStack useQuery) only fires when the URL contains `/analyze/[id]`. URL was updated via `window.history.replaceState` in Board.tsx (which doesn't trigger a re-render or query refetch).

**Fix:** Added `useRouter` + `useRef<string | null>` in InputDrawer. When `stream.analysisId` transitions from `null` → `string`, calls `router.push('/analyze/{id}')`. This triggers a React navigation which causes Board's `useParams()` to update, enabling the `permalinkQuery`, which fetches the row and passes `initialData` to `useAnalysisStream`. Ref initialized from current `stream.analysisId` to avoid spurious push on permalink-replay mounts.

**Tests added (InputDrawer.test.tsx):**
- router.push called with /analyze/abc123 when analysisId transitions null→string
- router.push NOT called when analysisId was already set on mount (no false transition)

## Fix 3 — Streaming progress feedback (60-120s dead silence)

**Root cause:** During the 60-120s analysis window, the drawer closes but Verdict shows "Calculating…" with no visible progress indication, no Cancel option, and the URL stays at /analyze. Users have no feedback that the app is working.

**Fix (three-part):**

1. **abort() method on useAnalysisStream:** New method that calls `abortRef.current?.abort()`, closes `eventSourceRef.current`, and sets phase to `'idle'`. Previously only cleanup-on-unmount existed; no cancel path for in-flight streams.

2. **Persistent progress toast in Board.tsx:** When stream.phase transitions into `analyzing | reconnecting | polling` and boardState was not already `'streaming'`, show a persistent toast (duration=0, so it never auto-dismisses). Title: "Analyzing your video". Description: "This usually takes about 90 seconds — you can keep using the app." Toast dismissed automatically when phase becomes `complete` or `error`. Cancel action button calls `stream.abort()` + `dismiss(toastId)`.

3. **COPY_CALCULATING_STAGE constant in verdict-constants.ts:** Added for future use by VerdictNode to show live stage slug in "Calculating…" placeholder.

**Tests added (Board.test.tsx):**
- Board renders "Analyzing your video" toast when stream.phase is 'analyzing'
- Cancel button in toast calls stream.abort()

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added abort() method to use-analysis-stream.ts**
- Found during: Fix 3
- Issue: Plan said "if abort() missing, add it" — it was missing from the D-02 9-key return shape
- Fix: Added `abort` key to `AnalysisStreamReturn` interface + useCallback implementation
- Files modified: src/hooks/queries/use-analysis-stream.ts
- Commit: 8ecc891

**2. [Rule 1 - Bug] prevAnalysisIdRef initialized from stream value (not null)**
- Found during: Fix 2 test writing
- Issue: Initializing ref as null caused spurious router.push on permalink-replay mounts where analysisId was already set
- Fix: `useRef<string | null>(stream.analysisId)` instead of `useRef<string | null>(null)`
- Files modified: src/components/board/InputDrawer.tsx
- Commit: 5bfd305

**3. [Rule 2 - Missing] Added abort:vi.fn() to all existing stream mock objects**
- Found during: TypeScript check
- Issue: 4 test files used typed AnalysisStreamReturn mocks missing the new required abort field
- Fix: Added abort:vi.fn() to result-card.test.tsx and two audience-choreography test files
- Commit: 8ecc891

### Schema Deviations

- `insights` column: `string | null` in analysis_results (not Json as the plan suggested) — omitted from Fix 1 UPDATE to avoid type mismatch. `insights` is not a score column.
- `warnings` column: `string[]` not `Json` — cast correctly with `as unknown as string[]`.

## Known Stubs

None. All three fixes are wired to real behavior.

## Self-Check

- [x] Fix 1 commit 60f6537 exists: `git log --oneline | grep 60f6537` ✓
- [x] Fix 2 commit 5bfd305 exists ✓
- [x] Fix 3 commit 8ecc891 exists ✓
- [x] All key files modified exist on disk ✓
- [x] 1573 tests passing, 5 pre-existing failures unchanged ✓
- [x] 0 new TypeScript errors introduced ✓

## Self-Check: PASSED
