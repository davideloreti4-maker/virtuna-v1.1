---
phase: 04-adapt-frame-niche
plan: "01"
subsystem: engine/remix-types
tags: [types, fixtures, tests, wave-0, decode-adapt-contract]
dependency_graph:
  requires: []
  provides:
    - src/lib/engine/remix/decode-types.ts
    - src/lib/engine/remix/decode.fixture.ts
    - src/lib/engine/remix/__tests__/adapt.test.ts
    - src/app/api/remix/adapt/__tests__/route.test.ts
    - src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx
    - src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx
  affects:
    - Phase 3 (Decode) worktree — must import DecodeOutput from decode-types.ts (D-03)
    - Plans 04-02, 04-03, 04-04 — all build against these types and fixtures
tech_stack:
  added: []
  patterns:
    - Pick<DecodeOutput,...> structural content-leak guard (D-01)
    - Wave 0 test scaffold pattern (it.todo + green smoke tests)
    - Qwen mock via vi.mock('openai') + MockOpenAI class
key_files:
  created:
    - src/lib/engine/remix/decode-types.ts
    - src/lib/engine/remix/decode.fixture.ts
    - src/lib/engine/remix/__tests__/adapt.test.ts
    - src/app/api/remix/adapt/__tests__/route.test.ts
    - src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx
    - src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx
  modified: []
decisions:
  - "AdaptInput uses Pick<DecodeOutput, 4 structural fields + repeatable> & {niche} — omission of luck[] and caption is the structural content-leak guard (D-01)"
  - "DECODE_FIXTURE uses format-only language (no topic nouns) to enable no-caption-leak test assertions in plan 04-02"
  - "Wave 0 uses it.todo (not it.skip) so the suite reports todo count without false-red failures"
  - "Removed render/screen imports from AdaptConceptCard/AdaptFrameBody Wave 0 files to keep tsc clean; Wave 1 (plan 04-02) will re-add them when rendering is needed"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-02T08:31:23Z"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 04 Plan 01: Decode→Adapt Contract + Wave 0 Scaffolds Summary

Pinned the Decode→Adapt integration seam as a single canonical TypeScript type file plus a realistic format-only fixture; created four Wave 0 test scaffolds that enumerate the full VALIDATION map and pass green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author Decode→Adapt contract + fixture | cc4a40f2 | decode-types.ts, decode.fixture.ts |
| 2 | Wave 0 test scaffolds (four surfaces) | b4e6ca6d | adapt.test.ts, route.test.ts, AdaptConceptCard.test.tsx, AdaptFrameBody.test.tsx |
| 2 (fix) | Remove unused render/screen imports | 78c4f3e9 | AdaptConceptCard.test.tsx, AdaptFrameBody.test.tsx |

## What Was Built

**`decode-types.ts`** — Pure type file (no runtime deps, no Zod). Exports:
- `RepeatableItem` — `{ label, why_repeatable }`
- `DecodeOutput` — 4 structural fields + `repeatable[]` + `luck[]`
- `AdaptInput` — `Pick<DecodeOutput, 4 fields + repeatable> & { niche: string }` — structurally excludes `luck[]` and any caption field (D-01 content-leak guard)
- `AdaptConcept` — `{ hook, angle, who_its_for, format_borrowed }`
- Comment directing Phase 3 to import from here (D-03)

**`decode.fixture.ts`** — `DECODE_FIXTURE: DecodeOutput` with 3 repeatable items (format-only labels) and 2 luck items (textually distinct, distribution/timing language). Zero topic-specific nouns.

**Four Wave 0 test scaffolds** covering the full VALIDATION map (11 rows):
- `adapt.test.ts`: 5 `it.todo` + 6 green smoke tests (fixture verification, Qwen mock health, D-01 structural check)
- `route.test.ts`: 6 `it.todo` + 3 green smoke tests (body fixture, auth mock health)
- `AdaptConceptCard.test.tsx`: 6 `it.todo` + 2 green smoke tests (D-09 anatomy verification)
- `AdaptFrameBody.test.tsx`: 5 `it.todo` + 3 green smoke tests (import/fixture health, luck-exclusion from cards)

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run src/lib/engine/remix src/components/board/adapt src/app/api/remix` → 5 files passed, 20 green, 22 todo, exit 0
- `grep -c "Pick<DecodeOutput" src/lib/engine/remix/decode-types.ts` → 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused `render`/`screen` imports causing TS6192 errors**
- **Found during:** Post-task-2 tsc verification
- **Issue:** `AdaptConceptCard.test.tsx` and `AdaptFrameBody.test.tsx` imported `render, screen` from `@testing-library/react` but Wave 0 smoke tests don't use them (todo tests don't render). tsc reported TS6192 on both.
- **Fix:** Removed the `@testing-library/react` import lines; added comment noting Wave 1 (plan 04-02) will re-add when rendering is needed.
- **Files modified:** `AdaptConceptCard.test.tsx`, `AdaptFrameBody.test.tsx`
- **Commit:** 78c4f3e9

## Known Stubs

None. This plan is types + fixtures + test scaffolds — no runtime stub values that flow to UI rendering. The `it.todo` tests are intentional Wave 0 scaffolds, not stubs; they are tracked in VALIDATION.md and will be resolved in plan 04-02.

## Threat Flags

None. This plan creates types, a fixture, and test files. No new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] `src/lib/engine/remix/decode-types.ts` — FOUND
- [x] `src/lib/engine/remix/decode.fixture.ts` — FOUND
- [x] `src/lib/engine/remix/__tests__/adapt.test.ts` — FOUND
- [x] `src/app/api/remix/adapt/__tests__/route.test.ts` — FOUND
- [x] `src/components/board/adapt/__tests__/AdaptConceptCard.test.tsx` — FOUND
- [x] `src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx` — FOUND
- [x] Commits cc4a40f2, b4e6ca6d, 78c4f3e9 — FOUND in git log
- [x] tsc --noEmit clean (0 errors)
- [x] vitest exit 0 (5 files, 20 green, 22 todo)
