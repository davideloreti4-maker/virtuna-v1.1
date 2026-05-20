---
phase: 09-platform-algo-fit-self-critique-counterfactuals
plan: 05
subsystem: engine
tags: [self-critique, consistency, deepseek-v3, confidence-calibration]
requires:
  - 09-01 (types + stubs)
provides:
  - runStage10Critique()
  - applyCritiqueAdjustment()
  - STABLE_CRITIQUE_SYSTEM_PROMPT
  - buildCritiqueUserMessage()
  - CritiqueResponseSchema
affects:
  - pipeline.ts (Plan 09-07 will call applyCritiqueAdjustment)
tech-stack:
  added:
    - Zod validation for V3 critique response
  patterns:
    - Same stable-system + volatile-user prompt discipline as wave3/persona-prompts.ts
    - Same retry-once + circuit-breaker pattern as wave3.ts
key-files:
  created:
    - src/lib/engine/stage10-critique-prompts.ts
  modified:
    - src/lib/engine/stage10-critique.ts (no-op → real V3 call)
    - src/lib/engine/__tests__/stage10-critique.test.ts (failing stubs → passing GREEN)
decisions:
  - "confidence_adjustment clamped to [-0.20, 0] in TypeScript — never trust model range (Pitfall 3 / D-11)"
  - "Creator past_wins/past_flops injected as counts only — never URLs (T-09-05-01)"
  - "buildCritiqueUserMessage sends summarized fields (top 3 factors, key scores), not full JSON blob (T-09-05-04 cost control)"
metrics:
  duration: ~8 min
  completed: 2026-05-20
---

# Phase 9 Plan 05: Implement Stage 10 Self-Critique Summary

Self-critique stage reads full PredictionResult post-aggregation and adjusts confidence downward (never overall_score) when internal inconsistencies are found. Replaces the no-op stub with a real DeepSeek V4 Flash call.

## Deliverables

### src/lib/engine/stage10-critique-prompts.ts (new)
- `STABLE_CRITIQUE_SYSTEM_PROMPT` — byte-identical constant with Cross-Creator Consensus (11 items), Numerical Rules table, and 4 locked D-13 consistency checks
- `buildCritiqueUserMessage(result, creatorContext)` — volatile user message with summarized fields, signal availability, persona aggregate, platform fit scores, and past_wins/past_flops counts (NEVER URLs)
- `CritiqueResponseSchema` — Zod schema: `{ consistency_score: 0-10, flags: max 8 strings of ≤400 chars, confidence_adjustment: -1..0 }`

### src/lib/engine/stage10-critique.ts (replaced)
- `runStage10Critique()` — real V4 Flash call with circuit breaker fast-fail, AbortController 15s timeout, cache-aware cost telemetry, single Zod retry, graceful null on failure
- `applyCritiqueAdjustment(currentConfidence, critique)` — exported helper: `Math.max(-0.20, Math.min(0, critique.confidence_adjustment))` clamp, returns `[0, 1]` adjusted confidence
- Adds optional `creatorContext?` param (non-breaking)

### src/lib/engine/__tests__/stage10-critique.test.ts (15 passing tests)
- CRITIQUE-01: non-null CritiqueResult with consistency_score 0-100
- CRITIQUE-02: flags array with inconsistency items
- CRITIQUE-03: confidence_adjustment in [-0.5, 0.5]
- URL safety: user message contains counts, never http:// or https://
- applyCritiqueAdjustment clamp: -0.30→-0.20 (upper bound), +0.10→0 (lower bound)
- D-13 Check #1 fixture: signal agreement flag
- D-13 Check #4 fixture: over-confidence thin signals flag
- Graceful degradation: V3 error → null, circuit breaker open → null, Zod parse fail → null
- CritiqueResponseSchema boundary validation (rejects out-of-range)

## 4 Locked D-13 Consistency Checks (in System Prompt)
1. **Signal Agreement** — |gemini_score - behavioral_score| > 30 → flag
2. **Score vs Factors** — overall_score vs top-3 factor scores contradiction → flag
3. **Card 6 Historical Match** — past_flops + current pattern matches known flop → flag
4. **Over-confidence Thin Signals** — confidence > 0.7 + 2+ unavailable signals → flag

## Commits
- `e40a45b` feat: implement stage10-critique with real V3 call + prompts
- `680ac85` test: add passing tests for stage10-critique

## Verification Results
- `applyCritiqueAdjustment` exported: ✅
- `Math.max(-0.20,...` clamp present: ✅
- `isCircuitOpen()` guard present: ✅
- 4 "Check #" D-13 checks in system prompt: ✅
- No URLs in prompt files: ✅
- All 15 stage10-critique tests pass: ✅
- Full suite — only pre-existing failures from other Phase 9 Wave 0 stubs (counterfactuals, platform-fit)

## Deviations from Plan
None — plan executed exactly as written.

## Self-Check: PASSED
All verification checks confirmed.
- File existence: stage10-critique.ts ✅, stage10-critique-prompts.ts ✅, stage10-critique.test.ts ✅
- Commit existence: e40a45b ✅, 680ac85 ✅
