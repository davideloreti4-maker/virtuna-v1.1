---
status: partial
phase: 01-strip-to-senses
source: [01-VERIFICATION.md]
started: "2026-06-04"
updated: "2026-06-04"
---

## Current Test

[awaiting human testing — R12 live remix smoke]

## Tests

### 1. R6 — E2E latency under the 300s cap (LIVE)
expected: full pipeline run on a fixed video completes < 300s (target ≤90s)
result: PASS — orchestrator ran measure-pipeline.ts live during the 01-06 checkpoint: 95–96s (down from 154–159s pre-strip baseline). User-approved at the E2E gate.

### 2. R8 — same-video determinism within tolerance band (LIVE)
expected: same video twice yields overall_score within the provider noise band (amended R8 — not byte-identity)
result: PASS — live runs 74 vs 77 (±3), within band. Consistent with the locked "determinism = tolerance band" decision. User-approved at the E2E gate.

### 3. R12 — live remix decode/adapt smoke (DEFERRED)
expected: POST /api/analyze with mode:'remix' + a tiktok_url, then POST /api/remix/adapt with the decode result, completes end-to-end without error on a running authed server
result: pending — could NOT run in this offline env (needs a running authed server + outbound network to fetch a TikTok URL). Structurally covered: 24 remix unit/integration tests + decode-route.test.ts pass green; the `mode === "remix"` branch is present + untouched (R12 grep-confirmed). Run this manually before/after deploy.

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

(none — R6/R8 live-verified + approved; R12 deferred to manual smoke due to offline-env limitation, test-covered)
