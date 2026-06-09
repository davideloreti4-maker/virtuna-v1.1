---
phase: 1
slug: strip-to-senses
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (already excludes `**/_dormant/**`) |
| **Quick run command** | `npx vitest run src/lib/engine/__tests__/<touched>.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60–120 seconds (suite); ~300s per `measure-pipeline.ts` E2E |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test>`
- **After every plan wave:** Run `npm test` (full suite, minus dormant)
- **Before `/gsd:verify-work`:** Full suite green + `npm run build` + one `measure-pipeline.ts` run (latency + score-delta) + remix smoke
- **Max feedback latency:** 120 seconds (unit); E2E gates run once at phase gate

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | — | — | R9 (jitter engagement gone) | — | N/A | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` | ✅ (update) | ⬜ pending |
| (planner fills) | — | — | R9 (dead keys gone from blend) | — | N/A | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts` | ✅ (update) | ⬜ pending |
| (planner fills) | — | — | R8 (same video → identical score) | — | N/A | integration | extended `measure-pipeline.ts` ×2 | ⚠️ W0 harness add | ⬜ pending |
| (planner fills) | — | — | R6 (E2E < 300s, target ≤90s) | — | N/A | integration | `npx tsx scripts/measure-pipeline.ts` | ✅ | ⬜ pending |
| (planner fills) | — | — | R12 (remix not regressed) | — | N/A | integration | `npx vitest run src/app/api/remix src/app/api/analyze/__tests__/decode-route.test.ts` | ✅ | ⬜ pending |
| (planner fills) | — | — | R5 (score + confidence still render) | — | N/A | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts src/lib/engine/__tests__/stage10-critique.test.ts` | ✅ (update) | ⬜ pending |
| (planner fills) | — | — | #9 (`_dormant` excluded, build green) | — | N/A | smoke | `npm run build && npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `scripts/measure-pipeline.ts` to log `result.overall_score` (D3.2 score-delta proof)
- [ ] Add null-input test for `verdict-derive.ts` platform_fit path (assert no crash — confirms existing null-safety)
- [ ] Add test asserting `predicted_engagement` absent → `TikTokResultCard` not rendered
- [ ] Reconcile `creator-rules.test.ts:9-10` cross-imports (stage11 + platform-fit prompts) before the dormant move

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DB row counts = 0 (`trending_sounds` / `scraped_videos` / `outcomes`) | reverify #3 | Live DB read, not unit-testable | `mcp__supabase__execute_sql`: `SELECT count(*) FROM trending_sounds; SELECT count(*) FROM scraped_videos; SELECT count(*) FROM outcomes;` — expect 0 each |
| Pre/post-strip score delta documented | D3.2 / reverify #2 | Requires real DashScope+Supabase E2E run on a fixed video, twice | Run extended `measure-pipeline.ts` on same video before+after strip; diff `overall_score`; document any shift as honesty correction |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
