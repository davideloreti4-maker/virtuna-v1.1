---
phase: 02-remix-mode-one-board-two-config
plan: 03
subsystem: ui
tags: [react, typescript, content-form, board, remix-mode, intent-selector, tdd]

# Dependency graph
requires:
  - phase: 02-remix-mode-one-board-two-config/02-01
    provides: AnalysisInputSchema.mode + DB column (Plan 01)
  - phase: 02-remix-mode-one-board-two-config/02-02
    provides: resolveBoardLayout(measured, mode) + DecodeShellNode/AdaptShellNode (Plan 02)
provides:
  - Two-segment Score/Remix intent selector in ContentForm (D-01/D-02)
  - Remix tab-coupling: Text tab removed from DOM, caption suppressed (D-04/D-05)
  - ContentFormData.mode: 'score'|'remix' field (default 'score')
  - AnalysisStreamInput.mode?: 'score'|'remix' field forwarded into POST body
  - Board.tsx: explicit mode: data.mode in handleContentSubmit stream.start allowlist (Pitfall 7)
  - boardMode derived from stream.result.mode ?? permalinkQuery.data.mode ?? submittedIntent
  - resolveBoardLayout(measuredH, boardMode) replaces hardcoded 'score' placeholder
  - BoardMobile receives boardMode (MOBILE_ORDER_REMIX for remix)
  - Live board and /analyze/[id] permalink reload agree on frame set (REMIX-02 crit 5)
affects: [03-decode-frame, 04-adapt-frame]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "submittedIntent state: hold user intent in Board local state for live path (A4 risk — engine finalResult does not echo mode)"
    - "boardMode derivation order: stream.result?.mode ?? permalinkQuery.data?.mode ?? submittedIntent"
    - "Intent selector tablist: role=tablist/tab + aria-selected, bg-white/[0.08] selected fill (NOT coral)"
    - "Tab-coupling reset: flip to Remix while Text active → reset activeTab + formData.input_mode to video_upload (Pitfall 8)"

key-files:
  created:
    - src/components/app/__tests__/content-form.test.tsx
  modified:
    - src/components/app/content-form.tsx
    - src/hooks/queries/use-analysis-stream.ts
    - src/components/board/Board.tsx

key-decisions:
  - "submittedIntent useState over ref: refs don't trigger re-renders; intent change must reflow the layout synchronously"
  - "boardMode priority: stream.result.mode (future-proof) > permalinkQuery.data.mode (permalink D-15) > submittedIntent (live path A4 mitigation)"
  - "Playlist of 3 touch points confirmed: ContentFormData.mode → AnalysisStreamInput.mode? → stream.start({mode: data.mode}) (Pitfall 7)"
  - "effectivePlaceholder helper: remix URL override isolated from PLACEHOLDERS constant (avoids mutating shared const)"

requirements-completed: [REMIX-01, REMIX-02]

# Metrics
duration: ~25min
completed: 2026-06-01
---

# Phase 02 Plan 03: Intent Selector + Mode Loop Closure Summary

**Two-segment Score/Remix selector above input tabs with full remix coupling; mode threads form → AnalysisStreamInput → POST body → boardMode derivation; live board and permalink reload agree on frame set**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (each TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- `ContentFormData.mode: "score" | "remix"` added; `formData` default `mode: "score"` (D-02)
- Two-segment intent selector renders above the input tab bar: `role="tablist"`, each segment `role="tab"` + `aria-selected`, `bg-white/[0.08]` selected fill (NOT coral — UI-SPEC §1)
- Remix coupling (D-04): Text tab filtered from DOM when `intent === 'remix'`; `activeTab` reset to `video_upload` if Text was active (Pitfall 8 guard)
- Caption suppression (D-05): video caption textarea short-circuited when `intent === 'remix'`
- URL placeholder override: "Paste a TikTok URL to decode..." in Remix mode (UI-SPEC §Copywriting)
- `AnalysisStreamInput.mode?:` field added; forwarded verbatim via `JSON.stringify(input)` at `:323`
- `handleContentSubmit` in Board.tsx: explicit `mode: data.mode` in `stream.start({...})` allowlist (Pitfall 7)
- `boardMode` derived from `stream.result?.mode ?? permalinkQuery.data?.mode ?? submittedIntent` — live and permalink agree
- `submittedIntent` state set in `handleContentSubmit` before `stream.start()` (A4 risk: engine `finalResult` doesn't carry mode)
- `resolveBoardLayout(measuredH, boardMode)` replaces Plan-02 placeholder `'score'` constant
- `BoardMobile` already receives `boardMode` prop from Board (Plan 02 wired this); derivation now provides correct live value
- 1760 tests pass, 0 failures; `tsc --noEmit` clean; `npm run build` succeeds

## Task Commits

Each task was committed atomically (TDD: RED test commit then GREEN feat commit):

1. **Task 1 RED** — `6c867795` (test: failing tests for intent selector + remix coupling + mode field)
2. **Task 1 GREEN** — `4bbb70ca` (feat: intent selector + remix coupling + mode field on ContentFormData)
3. **Task 2 + fix** — `c543328f` (feat: thread mode form → AnalysisStreamInput → POST body)
4. **Task 3** — `4361b1ff` (feat: derive boardMode from live result + permalink row, feed resolver + mobile)

## Files Created/Modified

- `src/components/app/__tests__/content-form.test.tsx` — 12 assertions covering all intent-selector behaviors (TDD RED)
- `src/components/app/content-form.tsx` — `ContentFormData.mode`, `intent` state, `handleIntentChange`, intent selector JSX, tab coupling, caption suppression, URL placeholder override
- `src/hooks/queries/use-analysis-stream.ts` — `AnalysisStreamInput.mode?: "score" | "remix"` field
- `src/components/board/Board.tsx` — `submittedIntent` state, `boardMode` derivation, `mode: data.mode` in `stream.start`, `resolveBoardLayout(measuredH, boardMode)` useMemo

## Decisions Made

- `submittedIntent` as `useState` (not `useRef`) — refs don't trigger re-renders; layout must reflow immediately on submit
- `boardMode` derivation placed after `stream` and `permalinkQuery` declarations (TypeScript forward-declaration error avoided by restructuring useMemo order)
- `effectivePlaceholder` helper function — isolates the remix URL override without mutating the `PLACEHOLDERS` constant shared with score mode
- Score path entirely unchanged (D-03): all existing score tests pass, no regression

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript forward-declaration error in boardMode derivation**
- **Found during:** Task 3 implementation
- **Issue:** `boardMode` derivation at line 105 referenced `stream` (line 166) and `permalinkQuery` (line 153) before their declarations — TS2448/TS2454
- **Fix:** Moved `boardMode` derivation + `resolvedFrames` + `presetTargets` useMemos to after `stream` and `permalinkQuery` declarations; kept `submittedIntent` state near `measuredH` for grouping
- **Files modified:** src/components/board/Board.tsx
- **Verification:** `tsc --noEmit` reports 0 errors after fix

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript forward-declaration)
**Impact on plan:** Zero scope change. Structural reorder only.

## Must-Haves / Success Criteria Status

| Criterion | Status |
|-----------|--------|
| Score/Remix selector above input tabs, default Score, no auto-detect (D-01/D-02) | PASS |
| Remix hides Text tab from DOM + no caption textarea (D-04/D-05) | PASS |
| Coupling reset: flip to Remix while Text active resets to video_upload (Pitfall 8) | PASS |
| Remix submit carries mode='remix' through form → AnalysisStreamInput → POST body | PASS |
| boardMode derived from live result + permalink row; fallback 'score' | PASS |
| Live board renders remix frame set without reload (submittedIntent) | PASS |
| /analyze/[id] permalink renders mode-correct frame set (permalinkQuery.data.mode) | PASS |
| Score path regression-free (verdict+actions unchanged) | PASS |
| Selected segment fill bg-white/[0.08] not coral (UI-SPEC §1) | PASS |
| URL placeholder "Paste a TikTok URL to decode..." in Remix | PASS |
| 1760 tests green, tsc 0 errors, build succeeds | PASS |

## Known Stubs

None — shells (DecodeShellNode/AdaptShellNode) are intentionally empty this phase per D-10/D-11. Content arrives in Phase 3 (Decode) and Phase 4 (Adapt).

## Self-Check: PASSED

All created files exist. All 4 task commits verified in git log.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The T-02-09, T-02-10, T-02-11 mitigations from the plan are implemented:
- T-02-09: Text tab removed from DOM in remix + activeTab reset → remix+text UI state unrepresentable
- T-02-10: Single boardMode derivation chain ensures live + reload render identical config
- T-02-11: mode re-validated server-side by AnalysisInputSchema enum (Plan 01, already in place)
