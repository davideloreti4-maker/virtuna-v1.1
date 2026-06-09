---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
plan: "01"
subsystem: engine/apollo
tags: [knowledge-core, byte-stability, wave-0-tests, d02-guard, r2, r12]
dependency_graph:
  requires: []
  provides:
    - KNOWLEDGE_CORE constant (apollo-core.ts)
    - APOLLO_INSTRUCTION constant (apollo-core.ts)
    - APOLLO_SYSTEM_PROMPT constant (apollo-core.ts)
    - D-02 guard satisfied (outlier number in KNOWLEDGE-CORE.md §2.0a)
    - Wave 0 test scaffolds for R2/R5/R12
  affects:
    - Plans 02 and 03 (import APOLLO_SYSTEM_PROMPT)
    - Plan 04 (aggregator blend rewire; R5/D-04 Wave 0 RED cases)
    - creator-rules.ts dormant (Plan 02) — now unblocked by D-02 guard
tech_stack:
  added: []
  patterns:
    - Byte-stable module-level const (KNOWLEDGE_CORE, APOLLO_INSTRUCTION, APOLLO_SYSTEM_PROMPT)
    - Zero-interpolation embedded template literal (backtick-escaped markdown)
    - Wave 0 documented-red test scaffold pattern (assert current state, comment future state)
key_files:
  created:
    - path: src/lib/engine/apollo-core.ts
      purpose: Three byte-stable module-level constants — KNOWLEDGE_CORE, APOLLO_INSTRUCTION, APOLLO_SYSTEM_PROMPT
    - path: src/lib/engine/__tests__/apollo-core.test.ts
      purpose: 16 GREEN tests — byte-stability, zero-interpolation, composition, content assertions
    - path: src/lib/engine/__tests__/remix-core-grounding.test.ts
      purpose: R12 + D-13 Wave 0 scaffolds — D-13 beat-mapping GREEN, R12 documented-red until Plan 03
  modified:
    - path: .planning/corpus/KNOWLEDGE-CORE.md
      change: Added outlier benchmark row to §2.0a table (D-02 BLOCKING guard)
    - path: src/lib/engine/__tests__/deepseek.test.ts
      change: +3 Apollo schema + R2 Wave 0 cases (documented-red until Plan 02)
    - path: src/lib/engine/__tests__/aggregator.test.ts
      change: +2 R5/D-04 blend Wave 0 cases (documented-red until Plan 04)
decisions:
  - Wave 0 scaffolds use "assert current state, comment future state" pattern — tests stay GREEN by asserting the pre-Plan-02/03/04 state, with comments documenting which assertions flip at each downstream plan
  - aggregator.test.ts Wave 0 cases use dynamic import() to avoid require() ESM hoisting issue
  - apollo-core.ts generated via Python script to handle backtick escaping correctly (5 backticks in KNOWLEDGE-CORE.md)
metrics:
  duration: ~15 minutes
  completed: "2026-06-05T10:12:47Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 03 Plan 01: Apollo Core Foundation Summary

Laid Phase 3 foundation in three atomic tasks: ported the D-02 BLOCKING calibration number, generated the byte-stable `apollo-core.ts` constant module, and authored Wave 0 test scaffolds for all R2/R5/R12 behaviors.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Port outlier calibration number into KNOWLEDGE-CORE.md §2.0a (D-02 BLOCKING) | a37df0ff | GREEN |
| 2 | Generate byte-stable apollo-core.ts constant module | 1284ab90 | GREEN (16 tests) |
| 3 | Author Wave 0 test scaffolds for all R2/R5/R12 behaviors | 98240ae9 | GREEN (full suite 1807/1807) |

## What Was Built

**Task 1 — D-02 guard satisfied:**
Added outlier benchmark row to KNOWLEDGE-CORE.md §2.0a calibration anchors table: "a video is an algorithmic outlier when views ≥ 5× the creator's follower count (Ava)." Additions-only within §2.0a; §4/§5/§6 untouched. This unblocks the creator-rules.ts dormant in Plan 02 with zero silent number loss.

**Task 2 — apollo-core.ts:**
Created `src/lib/engine/apollo-core.ts` exporting three module-level const strings:
- `KNOWLEDGE_CORE` — full post-Task-1 KNOWLEDGE-CORE.md embedded verbatim (5 backticks escaped, zero `${` interpolation)
- `APOLLO_INSTRUCTION` — lifted verbatim from `scripts/apollo-core-smoke.ts` (A/B-validated production suffix, scores 26–86)
- `APOLLO_SYSTEM_PROMPT = ${KNOWLEDGE_CORE}\n\n---\n\n${APOLLO_INSTRUCTION}` — the complete byte-stable cached system prefix
Header mirrors `creator-rules.ts` BYTE-STABILITY CONTRACT with source-of-truth note pointing to `.planning/corpus/KNOWLEDGE-CORE.md`. TypeScript build passes (0 errors).

**Task 3 — Wave 0 scaffolds:**
- `apollo-core.test.ts` (16 tests, GREEN): byte-stability, zero-interpolation (no `${`/`Date.now`/`Math.random`), composition contract, content assertions
- `remix-core-grounding.test.ts` (10 tests, GREEN): D-13 beat-mapping GREEN (BEAT_IDS 1:1 §5 exact match for all 4 beats); R12 decode/adapt `references KNOWLEDGE_CORE` cases documented-red until Plan 03
- `deepseek.test.ts` extension (+3 cases): "apollo schema validates" (documents the extended schema shape; RED marker correctly asserts Apollo fields are absent from current schema), "rewrite original matches verbatim hook" (structural GREEN), "rewrites fix distinct §2 levers" (structural GREEN)
- `aggregator.test.ts` extension (+2 cases): "blend uses behavioral + apollo" and "gemini retired from raw_overall_score" — both correctly assert current state (gemini key present, apollo absent) as documented-red until Plan 04

## Verification Results

- `grep "follower count" .planning/corpus/KNOWLEDGE-CORE.md` — exits 0, line 51 (between §2.0a header line 38 and §2.1 header line 53)
- `grep -c "export const" src/lib/engine/apollo-core.ts` — returns 3
- `grep -q "follower count" src/lib/engine/apollo-core.ts` — exits 0 (embedded core is post-Task-1)
- `grep -q "KNOWLEDGE-CORE.md" src/lib/engine/apollo-core.ts` — exits 0
- `npx tsc --noEmit` — 0 errors (template literal compiles)
- `npx vitest run src/lib/engine/__tests__/apollo-core.test.ts` — 16/16 GREEN
- `npx vitest run src/lib/engine/__tests__/remix-core-grounding.test.ts` — 10/10 GREEN (D-13 beat-mapping GREEN)
- `npm test` — 169 test files passed, 1807 tests passed, 0 failures
- `grep -c "KNOWLEDGE_CORE" src/lib/engine/__tests__/remix-core-grounding.test.ts` — 22 (≥2 required)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM require() incompatibility in Wave 0 scaffolds**
- **Found during:** Task 3 execution (test run)
- **Issue:** `require("../types")` and `require("../aggregator")` fail in vitest's ESM context
- **Fix:** Replaced with `DeepSeekResponseSchema` from top-level import (already imported in deepseek.test.ts); used `async/await import()` for aggregator Wave 0 cases
- **Files modified:** `deepseek.test.ts`, `aggregator.test.ts`
- **Commit:** 98240ae9

**2. [Rule 1 - Bug] Wave 0 "apollo schema validates" assertion design**
- **Found during:** Task 3 — first iteration asserted `result.success === false` but Zod strips unknown keys silently (returns success=true with extension fields stripped)
- **Fix:** Redesigned assertion to document RED state accurately: parse succeeds (base fields valid), but Apollo extension fields are absent from the result (undefined in the parsed data)
- **Files modified:** `deepseek.test.ts`
- **Commit:** 98240ae9

## Known Stubs

None — this plan is content + constants + test scaffolds; no UI-rendering data flows.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. All artifacts are build-time constants and test files.

## Self-Check

- [x] `.planning/corpus/KNOWLEDGE-CORE.md` modified — git diff confirms addition only
- [x] `src/lib/engine/apollo-core.ts` created — file exists, 32KB, 3 exports
- [x] `src/lib/engine/__tests__/apollo-core.test.ts` created — 16 tests, all GREEN
- [x] `src/lib/engine/__tests__/remix-core-grounding.test.ts` created — 10 tests, all GREEN
- [x] `src/lib/engine/__tests__/deepseek.test.ts` extended — 24 tests total, all GREEN
- [x] `src/lib/engine/__tests__/aggregator.test.ts` extended — 52 tests total, all GREEN
- [x] Commits exist: a37df0ff, 1284ab90, 98240ae9
- [x] `npm test` — 1807/1807 GREEN (0 failures)

## Self-Check: PASSED
