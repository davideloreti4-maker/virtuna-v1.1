---
status: partial
phase: 01-foundation-scaffold
source: [01-VERIFICATION.md]
started: 2026-05-24T11:30:00Z
updated: 2026-05-24T11:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Skip-to-content Tab-order on /v3
expected: Pressing Tab once after page load focuses the "Skip to main content" link (visually revealed at top-left with coral outline) before any LandingHeader anchor receives focus
result: [pending]

### 2. Bundle deduplication for animation runtime
expected: `@next/bundle-analyzer` (or `pnpm build --profile`) confirms the /v3 client bundle ships a single animation runtime — `framer-motion` is present only as motion's transitive (deduplicated by Next/Turbopack), not as a separate chunk
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
