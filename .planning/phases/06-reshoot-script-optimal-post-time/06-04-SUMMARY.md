---
phase: 06-reshoot-script-optimal-post-time
plan: "04"
subsystem: script-ui-components
tags: [script, copy-button, tanstack-query, sheet, phosphor-icons, tdd, telemetry, a11y]
dependency_graph:
  requires: ["06-01 (script-types, script-constants, TELEMETRY)", "06-02 (GET /script endpoint contract)"]
  provides: ["CopyButton", "useScript", "ScriptEmptyState", "ScriptBody", "ScriptInspectorTrigger"]
  affects: ["06-06 (ActionsReshootHeroSlot wires these into slot)"]
tech_stack:
  added: ["@phosphor-icons/react (Copy, CheckCircle, FilmScript, CheckCircle)", "@tanstack/react-query (useQuery)"]
  patterns: ["TDD (RED/GREEN/REFACTOR)", "discriminated-union type narrowing", "TanStack Query phase-gate", "Sheet mobile/desktop side branching", "useRef telemetry-once guard"]
key_files:
  created:
    - src/components/board/actions/script/CopyButton.tsx
    - src/components/board/actions/script/use-script.ts
    - src/components/board/actions/script/ScriptEmptyState.tsx
    - src/components/board/actions/script/ScriptBody.tsx
    - src/components/board/actions/script/ScriptInspectorTrigger.tsx
    - src/components/board/actions/script/__tests__/CopyButton.test.tsx
    - src/components/board/actions/script/__tests__/ScriptEmptyState.test.tsx
    - src/components/board/actions/script/__tests__/ScriptBody.test.tsx
  modified: []
decisions:
  - "CopyButton uses useCopyToClipboard(1500) — explicit 1500ms override per S-4 (tight feedback loop)"
  - "Copy-all GlassPill has NO onClick prop — inner CopyButton owns the click to prevent nested <button> HTML"
  - "useScript phase-gated: enabled only when phase === 'complete' prevents streaming-phase fetch"
  - "ScriptBody returns null for is_empty_state (defensive guard — host branches to ScriptEmptyState)"
  - "useIsMobile hook exists at src/hooks/useIsMobile.ts — used directly, no inlining needed"
  - "cn utility exists at src/lib/utils.ts — used directly"
  - "CopyButton test clipboard polyfill uses Object.defineProperty not Object.assign (happy-dom read-only constraint)"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 0
  tests_passing: 12
  tests_total: 12
---

# Phase 6 Plan 4: Script UI Components Summary

5 client-side components + TanStack Query hook for reshoot script display with per-section clipboard copy, Sheet inspector, and empty-state/error handling.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | CopyButton + ScriptEmptyState + use-script hook | f65bc88 | CopyButton.tsx, use-script.ts, ScriptEmptyState.tsx + 2 test files |
| 2 | ScriptBody + ScriptInspectorTrigger | c3ac729 | ScriptBody.tsx, ScriptInspectorTrigger.tsx + ScriptBody.test.tsx |

## What Was Built

**CopyButton** — generic copy primitive. Phosphor `Copy` icon default state; swaps to `CheckCircle` + "Copied!" in coral for 1.5s after successful copy. WCAG 44×44 tap target. `useCopyToClipboard(1500)` explicit override.

**useScript** — TanStack Query hook. Query key `['script', analysisId]`, `staleTime: Infinity`, `gcTime: 5m`. Phase-gated: `enabled: !!analysisId && phase === 'complete'` prevents fetch during streaming. Throws `Error('script_fetch_failed')` on non-OK response.

**ScriptEmptyState** — two variants: `empty-state` (green CheckCircle + "Your video is solid" + A/B opening variants with per-variant CopyButton) and `error` (retry button). `SCRIPT_EMPTY_STATE_SHOWN` telemetry fires once per mount via `useRef` guard.

**ScriptBody** — renders 4 sections (NEW OPENING, SCENE ORDER, VOICEOVER, CAPTIONS), each with uppercase label + body content + per-section CopyButton. Sticky Copy-all GlassPill at top-right assembles markdown-headered output (`REWRITE SCRIPT (analysis {id})` header). Returns `null` when given `is_empty_state: true`.

**ScriptInspectorTrigger** — compact teaser card (`data-testid="actions-reshoot-teaser"`) showing opening_line preview. Tap opens Sheet: `side="right"` on desktop (`max-w-[400px]`), `side="bottom"` on mobile (`max-h-[85dvh]`). `onCloseAutoFocus` returns focus to trigger button. Fires `SCRIPT_INSPECTOR_OPENED` telemetry.

## Test Results

3 suites / 12 tests — all passing:
- CopyButton: 3 tests (render, onCopy callback, optional label)
- ScriptEmptyState: 3 tests (empty-state render, error variant, telemetry once-guard)
- ScriptBody: 6 tests (4 sections, content, section copy telemetry, copy-all telemetry, null guard, testid)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CopyButton test clipboard polyfill**
- **Found during:** Task 1 test run
- **Issue:** `Object.assign(navigator, { clipboard: ... })` throws `TypeError: Cannot set property clipboard of [object Object] which has only a getter` in happy-dom
- **Fix:** Replaced with `Object.defineProperty(navigator, 'clipboard', { value: ..., writable: true, configurable: true })`
- **Files modified:** `__tests__/CopyButton.test.tsx`
- **Commit:** f65bc88

**2. [Rule 2 - Pattern adjustment] ScriptEmptyState test uses TELEMETRY constant directly**
- **Found during:** Task 1 — plan note said to use literal string if TELEMETRY was mocked away
- **Fix:** Test imports `TELEMETRY` from `actions-constants` (not mocked) and uses `TELEMETRY.SCRIPT_EMPTY_STATE_SHOWN` directly. Logger mock only stubs `logger.info`, not the TELEMETRY constants. Result: test is more robust (enum value not hardcoded).

**3. [Rule 2 - Section aria labels] Derived from SCRIPT_COPY constants**
- **Found during:** Task 2 — plan template used hardcoded `"Copy New Opening section"` etc. in aria labels
- **Fix:** aria labels use `\`Copy ${SCRIPT_COPY.SECTION_*} section\`` so they stay in sync with constant values. Test regex uses `/Copy New Opening section/i` which matches.

## Output Notes (per plan `<output>` block)

**Copy-all GlassPill without onClick:** Confirmed — `GlassPill` receives no `onClick` prop. The `div.absolute.right-3.top-2` wrapper contains `<GlassPill size="sm" className="px-0 py-0">` with an inner `<CopyButton>` that owns the click event. No nested-button shape exists in the output.

**useIsMobile and cn status:** Both exist. `src/hooks/useIsMobile.ts` present and used directly. `cn` from `src/lib/utils.ts` present and used directly. No inlining needed.

**SR aria-live announcement strategy:** ScriptBody renders `<span className="sr-only">{SCRIPT_COPY.ARIA_SCRIPT_READY}</span>` ("Reshoot script ready — 4 sections.") as a stable DOM text node. The parent `ActionsNode` (Phase 5) already wraps the slot region in `aria-live="polite"` — so adding another `aria-live` attribute on ScriptBody would double-announce. The `sr-only` span approach lets the parent's live region announce on content change without adding a second announcement source.

## Threat Surface Scan

No new threat surface introduced beyond what the plan's `<threat_model>` covered:
- All script content rendered via React text nodes (`{body.opening_line}`, `{item}`) — no `dangerouslySetInnerHTML`
- Clipboard writes only from user gesture (click handler)
- Focus return via `onCloseAutoFocus` prevents focus escape (T-06-23)

## Self-Check: PASSED

Files created:
- FOUND: src/components/board/actions/script/CopyButton.tsx
- FOUND: src/components/board/actions/script/use-script.ts
- FOUND: src/components/board/actions/script/ScriptEmptyState.tsx
- FOUND: src/components/board/actions/script/ScriptBody.tsx
- FOUND: src/components/board/actions/script/ScriptInspectorTrigger.tsx
- FOUND: src/components/board/actions/script/__tests__/CopyButton.test.tsx
- FOUND: src/components/board/actions/script/__tests__/ScriptEmptyState.test.tsx
- FOUND: src/components/board/actions/script/__tests__/ScriptBody.test.tsx

Commits:
- FOUND: f65bc88 (Task 1)
- FOUND: c3ac729 (Task 2)

Tests: 12/12 passing
TypeScript: 0 errors in script/
