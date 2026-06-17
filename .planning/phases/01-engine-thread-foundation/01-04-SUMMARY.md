---
phase: 01-engine-thread-foundation
plan: "04"
subsystem: composer-ui
tags: [tool-chips, composer, active-model, navigation-guard, D-07, D-08, D-09, THREAD-02]
dependency_graph:
  requires:
    - 01-01  # ToolRunner id/model vocabulary (tool-runner.ts)
    - 01-03  # Flash runner + sim1-max/sim1-flash model tags
  provides:
    - ToolChips component (chip row + active-model field)
    - Composer extended with activeTool state
    - Navigate-guard extended with chip-interaction tests
  affects:
    - src/components/app/home/composer.tsx
    - src/lib/tools/tool-runner.ts (vocabulary reused, not modified)
tech_stack:
  added: []
  patterns:
    - chip-state → placeholder mapping (activeTool drives input placeholder)
    - active-model field (chip → model label honesty spine D-09)
    - navigation guard extended (chip click never arms pendingNavRef)
key_files:
  created:
    - src/components/app/home/tool-chips.tsx
    - src/components/app/home/__tests__/tool-chips.test.tsx
  modified:
    - src/components/app/home/composer.tsx
    - src/components/app/home/__tests__/composer-navigate-guard.test.tsx
decisions:
  - "Chip accessible names include sr-only 'coming soon' text — tests use span[0] text matching not getByRole exact name"
  - "activePlaceholder: pinned layout always uses PLACEHOLDER_ACTIVE; centered layout follows active chip (D-07 + D-24 coexist cleanly)"
  - "ToolId type exported from tool-chips.tsx (not re-exported from tool-runner.ts) — avoids coupling UI chip type to server-side contract file"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-17"
  tasks: 2
  files: 4
---

# Phase 1 Plan 4: Composer Tool Chips Summary

**One-liner:** ToolChips component (Test/Idea/Hooks/Chat) wired into composer with active-model honesty field; only Test live; pendingNavRef navigation guard verified chip-safe.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ToolChips component (chip row + active-model field + disabled cost slots) | ee0f3c52 | tool-chips.tsx, tool-chips.test.tsx |
| 2 | Wire chips into composer, preserve Test navigation guard | 2be46791 | composer.tsx, composer-navigate-guard.test.tsx |

## What Was Built

**ToolChips** (`src/components/app/home/tool-chips.tsx`):
- 4 chips: Test · Idea · Hooks · Chat — ids reuse `ToolRunner` union from `tool-runner.ts` (single SSOT vocabulary, D-07)
- Only `test` enabled; `idea`/`hooks`/`chat` carry `disabled` + `aria-disabled` + sr-only "coming soon" (D-08)
- Active-model field maps `test → "SIM-1 Max"`, `idea|hooks|chat → "SIM-1 Flash"` (D-09)
- Reserved cost slot affordance via `data-cost-slot="credit"` on each chip (D-07 — live metering deferred)
- Raycast styling: 6% borders, 10% hover, 8px radius, coral only on active accent, no glow

**Composer extension** (`src/components/app/home/composer.tsx`):
- `activeTool` state (default `"test"`) + `<ToolChips onSelect={setActiveTool}>` above input row
- `activePlaceholder` follows active chip (pinned always uses follow-up copy; centered uses tool copy)
- `pendingNavRef.current = true` remains ONLY inside the two submit handlers (URL path + upload path)
- `setActiveTool` is the chip `onSelect` — no navigation armed, no stream.start dispatched (Pitfall #5 preserved)
- No idea/hooks/chat `stream.start` branch added (D-08 — non-Test tools deferred to P3/P4/P5)

**Navigate-guard extended** (`composer-navigate-guard.test.tsx`):
- New describe block "chip-select does NOT arm navigation" with 2 tests
- Proves chip click → no push; chip click + hydration id → still no push

## Test Results

```
5 test files, 33 tests — all passed
  tool-chips.test.tsx         13 tests
  composer-navigate-guard.test.tsx  4 tests (2 original + 2 new)
  composer-layout.test.tsx     3 tests
  home.test.tsx                7 tests
  composer.test.tsx            6 tests
```

## Verification

- `grep -nE "pendingNavRef|prevAnalysisIdRef" composer.tsx` — both refs present, arming only in submit handlers
- `grep -nE "SIM-1 Max|SIM-1 Flash" tool-chips.tsx` — both model labels present (D-09)
- `grep -niE "coming soon|disabled" tool-chips.tsx` — disabled chips confirmed (D-08)
- No `stream.start` or fetch branch for idea/hooks/chat in composer.tsx (D-08 — no half-built tool ships)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Accessible name mismatch in ToolChips tests**
- **Found during:** Task 1 test run
- **Issue:** `getByRole('button', { name: /^idea$/i })` failed — sr-only "coming soon" span appended to accessible name, making it "Idea coming soon" not "Idea". The component correctly uses `<span class="sr-only">coming soon</span>` for screen readers, but this becomes part of the computed accessible name.
- **Fix:** Updated test helper to match chips by their visible label span text (`spans[0].textContent`) instead of full accessible name. Behavior tested is identical — just uses the correct query approach for this DOM structure.
- **Files modified:** `src/components/app/home/__tests__/tool-chips.test.tsx`
- **Commit:** ee0f3c52

## Known Stubs

None — ToolChips renders its full intended P1 state (Test live, others disabled "coming soon"). The disabled chip copy is intentional per D-08, not a stub.

## Threat Flags

None — no new network endpoints, auth paths, or server-side trust boundaries introduced. ToolChips is a pure client UI component; composer extension adds no new server calls.

## Self-Check: PASSED
