---
status: testing
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
source: [14-VERIFICATION.md]
started: 2026-06-20T02:00:00Z
updated: 2026-06-20T02:00:00Z
---

## Current Test

number: 1
name: LIVE slop-vs-strong recalibration on the resolved-niche production path
expected: |
  Run `DASHSCOPE_API_KEY=… npx vitest run src/lib/engine/flash/__tests__/slop-vs-strong.test.ts`.
  LIVE half resolves a non-placeholder niche via resolveNicheKey('fitness'); ≥5 known-slop land
  < MIXED_THRESHOLD, ≥5 known-strong land ≥ STRONG_THRESHOLD, strongStops - slopStops >= 2.
  Record observed stop-counts; confirm 6/3 thresholds hold (or adjust + update the drift gate in lockstep).
awaiting: user response

## Tests

### 1. LIVE slop-vs-strong recalibration on the resolved-niche production path
expected: Run `DASHSCOPE_API_KEY=… npx vitest run src/lib/engine/flash/__tests__/slop-vs-strong.test.ts`. LIVE half resolves a non-placeholder niche via resolveNicheKey('fitness'); ≥5 known-slop land < MIXED_THRESHOLD, ≥5 known-strong land ≥ STRONG_THRESHOLD, strongStops - slopStops >= 2. Record stop-counts; confirm 6/3 thresholds (or adjust + update drift gate in lockstep).
result: [pending]

### 2. Live rubric-critic verdict quality on known-slop vs known-strong items (KCQ-02/04/07)
expected: With a key, fire critiqueAgainstRubric against ≥3 known-slop and ≥3 known-strong Ideas/Hooks; slop → pass:false with a sensible predictedFailureMode, strong → pass:true with null. Confirms the Value Bar rubric discriminates on real Flash output, not just wiring/fail-safe/coercion.
result: [pending]

### 3. Voice + 26-exemplar grounding produce on-voice, non-templated output end-to-end (KCQ-08 / D-16/17)
expected: Generate Ideas/Hooks for a creator with a writing_voice_sample under a real BUNDLE_CHAR_CAP load; output sounds like the creator (voice survived the cap) and hooks are pattern-inspired by the 26 exemplars WITHOUT emitting any template verbatim or any [placeholder]/[SLUG] leak.
result: [pending]

### 4. Idea/hook card surface — visual + interaction (KCQ-09 + KCQ-04)
expected: On a rendered idea card, "Made for you — {whyItFits}" reads as plain-language micro-copy (muted, no coral, scroll-quote still leads). The "If this could flop →" affordance is hidden on the face, reachable inside the disclosure, warning-toned, reveals predictedFailureMode only on the second drill. Hook card shows the flop reveal but no made-for-you line.
result: [pending]

### 5. Operator-facing review decision on the 6 code-review warnings (WR-01..WR-06)
expected: Decide whether the 6 standing warnings from 14-REVIEW.md are acceptable for this phase or must be closed first. Most material — WR-02/WR-03 (resolver mis-route / non-resolution on common short free-text niche inputs like "finance"/"tech", and cross-niche token collisions like "history of fashion"→education) and WR-01 (critic-only infra failure silently drops Strong candidates with no warning recorded).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
