---
phase: 09-platform-algo-fit-self-critique-counterfactuals
plan: 06
subsystem: engine
tags:
  - counterfactuals
  - stage11
  - V3
  - LIKELY_FLOP
  - COUNTER
depends_on:
  - "09-01"
provides:
  - "Stage 11 counterfactual generation (V3)"
  - "maybeAppendLikelyFlopWarning() pure-TS check"
  - "CounterfactualsResponseSchema with .length(3) enforcement"
affects:
  - "pipeline.ts (via runStage11Counterfactuals call -> PredictionResult.counterfactuals)"
tech-stack:
  added:
    - "stage11-counterfactuals.ts — V3 orchestration with circuit-breaker, retry, cache-aware cost telemetry"
    - "stage11-counterfactuals-prompts.ts — cache-stable system prompt + Zod response schema"
  patterns:
    - "Follows stage10-critique.ts pattern exactly (retry + abort + Zod validation)"
key-files:
  created:
    - "src/lib/engine/stage11-counterfactuals-prompts.ts"
  modified:
    - "src/lib/engine/stage11-counterfactuals.ts"
    - "src/lib/engine/__tests__/stage11-counterfactuals.test.ts"
decisions:
  - "High-score short-circuit: overall_score >= 70 returns null without V3 call"
  - "LIKELY_FLOP uses post-critique PredictionResult.confidence (strict > 0.70, not >=)"
  - "Schema enforces .length(3) at Zod level — V3 retries on validation failure"
metrics:
  duration: "~15 min"
  completed: "2026-05-20"
---

# Phase 9 Plan 06: Implement Stage 11 counterfactuals

Replaced the `stage11-counterfactuals.ts` no-op stub with a real V3 (deepseek-v4-flash) counterfactual generation function. Added `maybeAppendLikelyFlopWarning()` as a pure-TS deterministic check. Created `stage11-counterfactuals-prompts.ts` with cache-stable system prompt, dynamic user message builder, and Zod response schema enforcing exactly 3 suggestions.

## Tasks Completed

1. **Created `stage11-counterfactuals-prompts.ts`** — Exports `STABLE_COUNTERFACTUALS_SYSTEM_PROMPT`, `buildCounterfactualsUserMessage()` (flags `gemini_hook` availability), and `CounterfactualsResponseSchema` with `.length(3)` on suggestions array + `z.number().min(0)` on timestamp_ms.

2. **Implemented `stage11-counterfactuals.ts`** — `runStage11Counterfactuals()` follows stage10-critique pattern: circuit-breaker, OpenAI client init, retry (1 retry), abort timeout (15s), cache-aware cost telemetry, Zod response validation. Short-circuits with `null` when `overall_score >= 70`. Exports `maybeAppendLikelyFlopWarning()` — appends `LIKELY_FLOP` warning to `result.warnings[]` when `score < 30 AND confidence > 0.70`.

3. **Updated test file** — 14 tests including COUNTER-01..04 (V3 mocked), 4 LIKELY_FLOP boundary fixtures (score/confidence boundary conditions), Zod schema enforcement tests (rejects 2/4 suggestions, rejects negative timestamp_ms), and prompt builder content tests (gemini_hook AVAILABLE/UNAVAILABLE status).

## Requirements Satisfied

| ID | Name | Status |
| --- | --- | --- |
| COUNTER-01 | Returns CounterfactualResult with suggestions | PASS ✓ |
| COUNTER-02 | Suggestion shape (change, timestamp_ms, expected_impact) | PASS ✓ |
| COUNTER-03 | Suggestions for low-scoring content | PASS ✓ |
| COUNTER-04 | Null for high-scoring content (>=70) | PASS ✓ |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None found — all functions fully implemented.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. V3 call reuses existing `DEEPSEEK_API_KEY` and `openai` client pattern.

## Self-Check: PASSED

- [x] `src/lib/engine/stage11-counterfactuals.ts` exists
- [x] `src/lib/engine/stage11-counterfactuals-prompts.ts` exists
- [x] `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` exists
- [x] Commit `a13fef2` exists in git log
- [x] 14/14 tests GREEN
- [x] No type errors in stage11 files
- [x] No stubs or placeholders found
