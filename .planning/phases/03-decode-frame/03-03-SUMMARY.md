---
phase: 03-decode-frame
plan: "03"
subsystem: ui
tags: [decode, react, tailwind, sse, permalink, tdd]

requires:
  - phase: 03-01
    provides: decode-types (DecodeResult/DecodeBeat/LuckCategory/BEAT_IDS/Zod schemas)
  - phase: 03-02
    provides: persistDecodeToVariants + SSE complete event carrying variants.remix.decode + overall_score:null

provides:
  - DecodeShellNode component: 4 beat blocks + 2 lanes + in-flight + error states
  - m3 permalink hydration: direct variants.remix.decode read when overall_score:null
  - Component test: 6 cases (render, muted, lanes, no-advice-verb, in-flight, m3)

affects: [phase-04-adapt, phase-05-develop]

tech-stack:
  added: []
  patterns: [dual-read-stream-permalink, animate-skeleton-breathe, raycast-neutral-palette]

key-files:
  created:
    - src/components/board/decode/__tests__/DecodeShellNode.test.tsx
  modified:
    - src/components/board/decode/DecodeShellNode.tsx

key-decisions:
  - "No dedicated sub-components extracted — inline functions (DecodingState, DecodeErrorState, DecodedBody) keep the 160-line file under 500 lines and avoid inter-file prop threading"
  - "Beat order enforced via beatMap.get(id) loop over BEAT_IDS — deterministic regardless of API array order"
  - "m3 fallback reads permalinkData.variants.remix.decode directly (not via stream) — avoids use-analysis-stream short-circuit that gates on overall_score != null"
  - "Mock pattern (useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue — matches ContentAnalysisFrame.test.tsx convention, no ReturnType cast on value object"

patterns-established:
  - "dual-read-stream-permalink: useAnalysisStream({ initialData: permalinkData }) + direct permalinkData fallback for overall_score:null rows (m3)"
  - "animate-skeleton-breathe: reused from VerdictSkeleton for honest in-flight (no fake content skeletons)"
  - "beat-body muting: text-white/60 for present, text-white/35 for absent|weak — Raycast neutral palette"

requirements-completed: [DECODE-01, DECODE-02]

duration: 25min
completed: "2026-06-02"
---

# Phase 03 Plan 03: DecodeShellNode Frame Component Summary

**DecodeShellNode replaced with full decode UI: 4 fixed-order beat blocks + repeatable/luck lanes + honest in-flight skeleton + m3 permalink hydration — reading variants.remix.decode via dual-read (live SSE + direct permalink fallback)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-02T10:30:00Z
- **Completed:** 2026-06-02T11:00:00Z
- **Tasks:** 2 auto + 1 checkpoint (Task 3 human-verify satisfied via orchestrator static verification)
- **Files modified:** 2

## Accomplishments

- `DecodeShellNode` body replaced: renders all 4 beats in BEAT_IDS fixed order (hook_pattern → structure_pacing → the_turn → emotional_beat), absent/weak beats muted (`text-white/35`) with honest body text — never hidden
- Repeatable lane (em-dash bullets) + Luck lane (fixed-taxonomy `LuckCategory` display-name tag + note) render below a `border-white/[0.06]` divider
- Honest in-flight state (`Decoding structure…` + `—` glyph, both `animate-skeleton-breathe`) — no fabricated beat/bullet skeletons
- m3 fix: direct `permalinkData.variants.remix.decode` read when the stream result has `overall_score: null` (use-analysis-stream short-circuit never fires for remix rows)
- 6 component tests GREEN; 0 TSC errors; content-analysis 50-test regression clean

## Task Commits

1. **Task 1: Wave 0 — DecodeShellNode component test (RED)** — `f4c10aef` (test)
2. **Task 2: Implement DecodeShellNode body** — `cec6c2f8` (feat)
3. **Task 3: Human-verify checkpoint** — satisfied via static verification (see Deviations)

## Files Created/Modified

- `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` — 6-case component test: beats/order, muted-absent, lanes/luck-category, no-advice-verb, in-flight, m3 permalink
- `src/components/board/decode/DecodeShellNode.tsx` — full decode UI body replacing the 24-line descriptor stub

## Decisions Made

- **No separate sub-component files** — `DecodingState`, `DecodeErrorState`, `DecodedBody` defined inline as module-scope functions; keeps file under 200 lines, avoids prop-threading overhead for single-use components
- **Beat order guard via Map lookup** — `beatMap.get(id)` iterated over `BEAT_IDS` constant; deterministic order regardless of LLM array ordering
- **m3 direct permalink read** — `row?.variants?.remix?.decode ?? permalinkData?.variants?.remix?.decode ?? null`; two-level fallback mirrors the plan's declared interface exactly
- **Mock pattern aligned with ContentAnalysisFrame.test.tsx** — `(useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue(...)` avoids TSC conflicts on `AnalysisStreamReturn` shape (missing `abort`/`reset`/`start: Promise<void>` fields caused TS2352)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock return type missing abort/reset/async start fields**
- **Found during:** Task 2 — `npx tsc --noEmit`
- **Issue:** Test mocks used `as ReturnType<typeof useAnalysisStream>` cast — TSC rejected because `abort`, `reset`, and `start: () => Promise<void>` were absent/typed incorrectly
- **Fix:** Switched to `(useAnalysisStream as ReturnType<typeof vi.fn>).mockReturnValue(...)` pattern (identical to ContentAnalysisFrame.test.tsx) with a shared `BASE_STREAM` object; `vi.fn()` cast bypasses the strict `AnalysisStreamReturn` shape check while keeping runtime behavior identical
- **Files modified:** `src/components/board/decode/__tests__/DecodeShellNode.test.tsx`
- **Verification:** `npx tsc --noEmit` — 0 errors; all 6 tests GREEN
- **Committed in:** cec6c2f8 (Task 2 commit, inline fix)

### Task 3 — Live UAT deferred

**Task 3 (human-verify checkpoint):** Live UAT skipped by user decision. Orchestrator ran static verification instead:
- `npx tsc --noEmit` — exit 0
- ESLint on `DecodeShellNode.tsx` — exit 0
- Full decode test sweep: 41/41 green (6 component + 21 engine + 14 route)
- Component reviewed: fixed-order beats, dual-read stream + permalink m3 fallback, honest in-flight/error states, no advice verbs, Raycast 6% borders + neutral palette confirmed

Live render (dev server + real remix URL) was not performed. Deferred; can surface in Phase 5 regression sweep or at a future QA gate if needed.

---

**Total deviations:** 1 auto-fixed (Rule 1 — test type bug), 1 process deviation (live UAT replaced by static verification per user decision)
**Impact on plan:** Auto-fix essential for TSC clean bill. UAT deferral noted — static verification covers the component contract fully; live E2E latency/render not independently confirmed this session.

## Issues Encountered

None beyond the TSC mock-type issue (auto-fixed, see Deviations).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `DecodeShellNode` is production-ready: renders DECODE-01 (structural teardown) and DECODE-02 (repeatable-vs-luck split) from `variants.remix.decode` on both live SSE and permalink reads
- Phase 4 (Adapt Frame) can begin immediately — it consumes only the Decode repeatable-lane output via `variants.remix.decode.repeatable`
- Phase 5 regression sweep should include a live remix decode render to confirm E2E latency and mobile parity

## Known Stubs

None. All 4 beats, both lanes, in-flight and error states are fully wired to live data. No hardcoded values flow to UI rendering.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes. Decode strings rendered via JSX text children only (React auto-escapes) — T-03-07 mitigated.

## Self-Check: PASSED

- [x] `src/components/board/decode/__tests__/DecodeShellNode.test.tsx` — exists
- [x] `src/components/board/decode/DecodeShellNode.tsx` — exists, modified
- [x] Commit f4c10aef exists (Task 1 RED test)
- [x] Commit cec6c2f8 exists (Task 2 implementation)
- [x] 6 component tests GREEN
- [x] 0 TypeScript errors
- [x] Content-analysis 50-test regression clean

---
*Phase: 03-decode-frame*
*Completed: 2026-06-02*
