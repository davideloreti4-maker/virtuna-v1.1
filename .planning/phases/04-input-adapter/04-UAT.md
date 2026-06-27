---
status: testing
phase: 04-input-adapter
source: [04-VERIFICATION.md]
started: "2026-06-27T20:35:51Z"
updated: "2026-06-27T20:35:51Z"
---

## Current Test

number: 1
name: Live qwen3.7-plus base64 data:-URL vision read (Assumption A2)
expected: |
  qwen3.7-plus accepts a base64 `data:` URL image and returns a parseable
  `{ read: ... }` JSON (HTTP 200). If the model rejects base64 data: URLs,
  trigger the documented Storage→signed-URL fallback (readImageWithVision
  signature unchanged).
awaiting: user response

## Tests

### 1. Live qwen3.7-plus base64 data:-URL vision read (Assumption A2)
command: |
  RUN_VISION_LIVE_SMOKE=1 DASHSCOPE_API_KEY=<valid> \
    node ./node_modules/vitest/vitest.mjs run \
    src/lib/engine/stimulus/__tests__/vision.test.ts
expected: |
  qwen3.7-plus accepts a base64 data: URL image and returns a parseable
  { read: ... } JSON (HTTP 200). If rejected, trigger the documented
  Storage→signed-URL fallback (signature unchanged).
why_human: |
  External service (DashScope) integration + paid network call requiring
  explicit human spend approval. Unit tests mock getQwenClient; the live
  base64 data:-URL acceptance (Assumption A2) is the one behavioral surface
  not provable by automation. The proven live wave3 pattern uses URL-based
  images (keyframeUris), not base64 data: URLs, so A2 is not transitively
  confirmed.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
