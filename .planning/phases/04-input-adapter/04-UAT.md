---
status: complete
phase: 04-input-adapter
source: [04-VERIFICATION.md]
started: "2026-06-27T20:35:51Z"
updated: "2026-06-28T16:05:23Z"
---

## Current Test

[testing complete]

## Tests

### 1. Live qwen3.7-plus base64 data:-URL vision read (Assumption A2)
command: |
  RUN_VISION_LIVE_SMOKE=1 node ./node_modules/vitest/vitest.mjs run \
    src/lib/engine/stimulus/__tests__/vision.test.ts
expected: |
  qwen3.7-plus accepts a base64 data: URL image and returns a parseable
  { read: ... } JSON (HTTP 200). If rejected, trigger the documented
  Storage→signed-URL fallback (signature unchanged).
result: pass
verified: "2026-06-28 — with human spend approval"
evidence: |
  A2 CONFIRMED. First run returned 401, which diagnosis traced to a TEST-HARNESS
  bug (not the credential): vision.test.ts:49 forced DASHSCOPE_API_KEY='test-key'
  when unset, and vitest does not load .env.local into process.env, so the probe
  called DashScope with the dummy key. The real key works (HTTP 200 on the intl
  endpoint the code uses). A second latent bug: the 1×1 PNG fixture is rejected by
  the model with HTTP 400 'image format illegal'.
  Fixed both (commit 709ec21c, test-only): real-key capture with .env.local
  fallback + gate on real key (never dummy) + valid 64×64 PNG fixture.
  Live smoke now passes 6/6 with RUN_VISION_LIVE_SMOKE=1 (and skips 5/1 without).
  Direct verification of the exact A2 payload returned HTTP 200 with an accurate
  read: {"read":"A blue square with a white diagonal line ..."} — base64 data:
  URL accepted + read + JSON-parseable. Storage→signed-URL fallback NOT needed.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
