---
status: partial
phase: 05-wire-surface
source: [05-VERIFICATION.md]
started: 2026-06-06T18:33:56Z
updated: 2026-06-06T18:33:56Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. R6 — Full E2E latency ≤90s on a live run
expected: `npx tsx scripts/measure-pipeline.ts <video-url>` completes ≤90s total; omni first paint ~17s; fold ∥ Apollo parallel (no serialization regression from the surface work).
result: [pending]

### 2. Live same-video-twice determinism gate (R8 / D-01)
expected: Run `/analyze` (or measure-pipeline) on the SAME video twice; both `overall_score` values are byte-identical OR land in the same D-02 band. Record both composites. (Arithmetic determinism is unit-proven; this confirms the live cure given thinking-mode residual + the untouched behavioral half.)
result: [pending]

### 3. Real-run DB persist of `variants.apollo.dimensions[].score` (D-01 threading)
expected: Run a real `/analyze`, query the `analysis_results` row, confirm the 6 dimension `score` values persist non-null; permalink reload renders the insight-hero from `variants.apollo`.
result: [pending]

### 4. Live R11 range surface + null-gate behavior
expected: On a fresh analysis with a creator baseline (follower_count > 0), the EngagementRangeCard renders a lo–hi range + confidence; on permalink reload (live-only design) it is absent with the "estimate available on fresh run" affordance reading as intentional; no card when no baseline.
result: [pending]

### 5. D-08 insight-hero visual hierarchy (incl. IN-02 ordering)
expected: Insight-hero reads as the board HERO; rewrites are struck-through original + copyable variants; 6 scored dimensions cited; score band demoted. Confirm the ceiling_capper (highest-leverage insight) vs confidence_scope (caveat) hierarchy reads correctly (IN-02 was flagged INFO — subjective).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
