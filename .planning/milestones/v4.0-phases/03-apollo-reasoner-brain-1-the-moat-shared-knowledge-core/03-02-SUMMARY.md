---
phase: 03-apollo-reasoner-brain-1-the-moat-shared-knowledge-core
plan: "02"
subsystem: engine/apollo
tags: [apollo-reasoner, verbatim-backstop, r2, r5-partial, d01-dormant, d08, d10, tdd]
dependency_graph:
  requires:
    - Plan 03-01 (APOLLO_SYSTEM_PROMPT from apollo-core.ts)
    - Plan 03-01 Task 1 (D-02 outlier number in KNOWLEDGE-CORE.md §2.0a)
  provides:
    - Apollo Reasoner: deepseek.ts uses APOLLO_SYSTEM_PROMPT prefix (byte-stable cached)
    - Extended DeepSeekResponseSchema: dimensions[6] + composite_score 0-100 + rewrites[2-3] + ceiling_capper + confidence_scope
    - R2 verbatim backstop: rewrite.original overwritten from fed verbatim hook on mismatch (TS, not model)
    - D-01 satisfied: creator-rules.ts dormant; APOLLO_SYSTEM_PROMPT single SSOT
    - R5-partial: composite_score available for Plan 04 blend
  affects:
    - Plan 04 (aggregator reads composite_score, wires verbatim into DeepSeekInput)
    - All callers of reasonWithDeepSeek (DeepSeekInput now has verbatim? field)
tech_stack:
  added: []
  patterns:
    - Apollo byte-stable system prefix (APOLLO_SYSTEM_PROMPT module const, zero interpolation)
    - Post-parse backstop pattern (normalize-whitespace compare + TS overwrite on mismatch)
    - Verbatim volatile-user-message threading (R2 load-bearing split)
    - Dormant convention (_dormant/engine/ move, git mv)
key_files:
  created: []
  modified:
    - path: src/lib/engine/types.ts
      change: Added ApolloDimensionSchema, ApolloRewriteSchema; extended DeepSeekResponseSchema additively with dimensions[6], composite_score, ceiling_capper, confidence_scope, rewrites[2-3], platform_note?
    - path: src/lib/engine/deepseek.ts
      change: Swapped STABLE_SYSTEM_PROMPT→APOLLO_SYSTEM_PROMPT; added verbatim? to DeepSeekInput; verbatim block in user message; R2 post-parse backstop; removed loadCalibrationData/calibration blocks; kept circuit breaker/retries/cost/Sentry
    - path: src/lib/engine/__tests__/deepseek.test.ts
      change: Updated Wave 0 scaffold to GREEN assertions; added apollo uses shared core prefix + rewrite original backstopped on mismatch tests; updated CACHE-03 tests for new content
    - path: src/lib/engine/__tests__/factories.ts
      change: Updated makeDeepSeekReasoning factory with Apollo §4 extension fields (6 dims, composite_score, ceiling_capper, confidence_scope, rewrites)
    - path: src/lib/engine/__tests__/wave3-persona-prompts.test.ts
      change: Local makeDeepSeekResult updated with Apollo extension fields (Rule 1 auto-fix — TS type error)
    - path: src/lib/engine/__tests__/creator-rules.test.ts
      change: Updated import path from ../creator-rules to ../_dormant/engine/creator-rules (tracks dormanted file)
  moved:
    - from: src/lib/engine/creator-rules.ts
      to: src/lib/engine/_dormant/engine/creator-rules.ts
      reason: D-01 — APOLLO_SYSTEM_PROMPT is single SSOT; prompt-injection constants dormant
decisions:
  - Wave 0 test scaffolds updated to GREEN assertions (fields present, not undefined) in TDD RED phase
  - creator-rules.test.ts import updated to _dormant path to preserve test coverage of dormanted constants
  - Dynamic content test updated to use unique string (UNIQUE_DYNAMIC_CONTENT_XYZ) to avoid APOLLO_SYSTEM_PROMPT substring collision with content_text "test"
metrics:
  duration: ~30 minutes
  completed: "2026-06-05T10:29:15Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 5
  files_moved: 1
---

# Phase 03 Plan 02: Apollo Reasoner Reframe Summary

Reframed `deepseek.ts` as the Apollo Reasoner: swapped the generic 5-step `STABLE_SYSTEM_PROMPT` for the shared `APOLLO_SYSTEM_PROMPT` (from apollo-core.ts), extended `DeepSeekResponseSchema` additively with 6 dimensions + composite 0–100 + 2–3 verbatim-grounded rewrites + confidence_scope, added the R2 verbatim backstop (TS overwrites paraphrased original from the fed hook), removed calibration scaffolding, and dormanted `creator-rules.ts`.

## Tasks Completed

| Task | Name | Commit (RED → GREEN) | Status |
|------|------|----------------------|--------|
| 1 | Extend DeepSeekResponseSchema additively with §4 Apollo output contract | d23e59a8 → 1539eb67 | GREEN (1811 tests) |
| 2 | Reframe deepseek.ts — APOLLO_SYSTEM_PROMPT prefix, verbatim feed, backstop, calibration cleanup | 42c10208 → 04948a15 | GREEN (1815 tests) |
| 3 | Dormant creator-rules.ts prompt-injection constants (D-01) | 5be2fd45 | GREEN (1815 tests) |

## What Was Built

**Task 1 — DeepSeekResponseSchema extension:**
Added `ApolloDimensionSchema` (6 named dims, band strong/mid/weak, lever + evidence) and `ApolloRewriteSchema` (original=verbatim anchor, variant, lever_fixed for D-08 distinct levers). Extended `DeepSeekResponseSchema` ADDITIVELY with `dimensions: length(6)`, `composite_score: 0–100`, `ceiling_capper`, `confidence_scope`, `rewrites: min(2).max(3)`, `platform_note?: optional`. Kept `behavioral_predictions` + `component_scores` REQUIRED (D-05 — behavioral term stays separate until P4). Updated `makeDeepSeekReasoning` factory and `wave3-persona-prompts.test.ts` local factory with Apollo extension defaults.

**Task 2 — deepseek.ts Apollo Reasoner reframe:**
- System message: `APOLLO_SYSTEM_PROMPT` imported from `./apollo-core` — byte-stable knowledge core, replaces old generic `STABLE_SYSTEM_PROMPT` (deleted).
- Verbatim feed: `DeepSeekInput.verbatim?: VerbatimPayload | null` added; `buildDeepSeekUserMessage` emits verbatim hook+segments in the VOLATILE user message only (never system prefix), with instruction "copy hook line VERBATIM into each rewrite's `original`" (Pitfall 4 guard).
- R2 backstop: `parseDeepSeekResponse` normalize-whitespace-compares each `rewrite.original` to `verbatim.hook.spoken_words` (fallback `on_screen_text`); on mismatch, overwrites from the fed verbatim in TS (not the model).
- Calibration cleanup: removed `loadCalibrationData()`, `DeepSeekCalibrationData` interface+schema+FALLBACK, `cachedCalibration` var, and the viral-differentiators + duration-sweet-spot block from the user message (superseded by core §2.0a/§4.1). Also removed `import { promises as fs }`, `import path`, `import { z }` (no longer needed).
- PRESERVED: circuit breaker (INFRA-03, HARD-04), `MAX_RETRIES=2`, `BACKOFF_SCHEDULE_MS`, `calculateCost` + soft-cap warn, `Sentry.captureException`, `TIMEOUT_MS=90_000`, retry-nudge on USER message.

**Task 3 — creator-rules.ts dormant:**
Confirmed D-02 gate: KNOWLEDGE-CORE.md §2.0a carries "≥ 5× follower count (Ava)". `git mv` to `_dormant/engine/creator-rules.ts` per P1/P2 convention. Updated `creator-rules.test.ts` import to the new path. No live (non-dormant) importers remain. `creator-rulebook.ts` fully untouched (D-03). Single knowledge brain SSOT is `APOLLO_SYSTEM_PROMPT` (D-01).

## Verification Results

- `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "apollo schema validates"` — 7/7 GREEN
- `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "rewrite original matches verbatim hook"` — GREEN (correct original + backstop both verified)
- `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "apollo uses shared core prefix"` — GREEN (system === APOLLO_SYSTEM_PROMPT)
- `grep -q "APOLLO_SYSTEM_PROMPT" src/lib/engine/deepseek.ts` — exits 0
- `grep -c "STABLE_SYSTEM_PROMPT" src/lib/engine/deepseek.ts` — 0
- `grep -c "loadCalibrationData" src/lib/engine/deepseek.ts` — 0
- `grep -vi '^\s*//' src/lib/engine/deepseek.ts | grep -ci "top.*%\|percentile"` — 0
- `grep -q "isCircuitOpen\|circuit" src/lib/engine/deepseek.ts` — exits 0 (circuit breaker preserved)
- `test ! -f src/lib/engine/creator-rules.ts` — exits 0 (gone)
- `test -f src/lib/engine/_dormant/engine/creator-rules.ts` — exits 0 (exists)
- `grep -rn "from.*creator-rules\"" src --include=*.ts | grep -v _dormant | grep -v rulebook` — empty
- `npm test` — 1815/1815 GREEN (169 files, 0 failures)
- `npx tsc --noEmit` — 0 errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wave3-persona-prompts.test.ts local factory missing Apollo fields**
- **Found during:** Task 1 GREEN phase (`npx tsc --noEmit`)
- **Issue:** Local `makeDeepSeekResult()` function in `wave3-persona-prompts.test.ts` returns type `DeepSeekReasoning` but didn't include the newly required Apollo extension fields — TypeScript error TS2739
- **Fix:** Added `dimensions`, `composite_score`, `ceiling_capper`, `confidence_scope`, `rewrites` with sensible defaults to the local factory
- **Files modified:** `src/lib/engine/__tests__/wave3-persona-prompts.test.ts`
- **Commit:** 1539eb67

**2. [Rule 1 - Bug] Dynamic content test substring collision with APOLLO_SYSTEM_PROMPT**
- **Found during:** Task 2 GREEN phase — CACHE-03 test `expect(sys).not.toContain("test")` fails because APOLLO_SYSTEM_PROMPT legitimately contains the word "test" (in `scripts/apollo-core-smoke.ts` reference)
- **Fix:** Changed test to use distinctive string `"UNIQUE_DYNAMIC_CONTENT_XYZ"` as `content_text` so the assertion is unambiguous
- **Files modified:** `src/lib/engine/__tests__/deepseek.test.ts`
- **Commit:** 04948a15

**3. [Rule 1 - Bug] creator-rules.test.ts import path broke after git mv**
- **Found during:** Task 3 — moving `creator-rules.ts` to `_dormant/` breaks the existing test import
- **Fix:** Updated import in `creator-rules.test.ts` to `../_dormant/engine/creator-rules` — test now tracks the dormanted file
- **Files modified:** `src/lib/engine/__tests__/creator-rules.test.ts`
- **Commit:** 5be2fd45

## Known Stubs

None — this plan is engine/schema/reasoner code; no UI-rendering data flows. `verbatim` is accepted optionally on `DeepSeekInput`; Plan 04 wires the aggregator to actually pass it. The optional field is intentional (not a stub — it degrades gracefully when absent).

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries. All mitigations from the plan's `<threat_model>` are implemented:
- T-03-03 (prompt injection via verbatim): verbatim stays in user (data) role, never system prefix. MITIGATED.
- T-03-04 (malformed Apollo JSON breaks parse): Zod safeParse + retry-nudge + post-parse backstop + TIMEOUT_MS + MAX_RETRIES + circuit breaker all preserved. MITIGATED.
- T-03-05 (model paraphrases hook → R2 false pass): TS backstop overwrites original from fed verbatim on normalize-whitespace mismatch. MITIGATED.

## Self-Check

- [x] `src/lib/engine/types.ts` modified — ApolloDimensionSchema, ApolloRewriteSchema, extended DeepSeekResponseSchema
- [x] `src/lib/engine/deepseek.ts` reframed — APOLLO_SYSTEM_PROMPT, verbatim feed, backstop, calibration removed
- [x] `src/lib/engine/__tests__/deepseek.test.ts` extended — 32 tests total, all GREEN
- [x] `src/lib/engine/__tests__/factories.ts` updated — makeDeepSeekReasoning factory with Apollo defaults
- [x] `src/lib/engine/_dormant/engine/creator-rules.ts` exists (git mv from creator-rules.ts)
- [x] `src/lib/engine/creator-rules.ts` gone
- [x] Commits exist: d23e59a8, 1539eb67, 42c10208, 04948a15, 5be2fd45
- [x] `npm test` — 1815/1815 GREEN (0 failures)
- [x] `npx tsc --noEmit` — 0 errors

## Self-Check: PASSED
