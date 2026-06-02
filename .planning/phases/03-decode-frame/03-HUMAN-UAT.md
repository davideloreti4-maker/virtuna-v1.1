---
status: partial
phase: 03-decode-frame
source: [03-VERIFICATION.md]
started: 2026-06-02
updated: 2026-06-02
---

## Current Test

[awaiting human testing — deferred from 03-03 Task 3 by user decision; replaced with orchestrator static verification (tsc 0, eslint 0, 41/41 decode suite, 505/505 broad sweep)]

## Tests

### 1. Live remix render + latency
expected: Paste a known viral TikTok URL in Remix mode → `Decoding structure…` honest in-flight (no fake beat skeletons) → ~70–100s decode (NOT the ~332s score pipeline) → all 4 beat blocks render (absent beats show honest absence text, never fabricated); `What you can repeat` non-empty structural moves; `What was luck / timing` non-empty with ≥1 fixed-taxonomy category tag.
result: [pending]

### 2. Permalink m3 hydration
expected: Reload `/analyze/[id]` for a remix row → Decode frame re-renders from `variants.remix.decode` (not stuck on loading). overall_score-null rows hydrate via direct permalink read.
result: [pending]

### 3. Mobile parity + Raycast styling
expected: <768px card-stack shows same 4 beats + 2 lanes, no truncation. Neutral palette throughout — no coral on luck lane; 6% borders; honest teardown copy (no fix/improve/should/try, no "you" outside the repeatable-lane header).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
