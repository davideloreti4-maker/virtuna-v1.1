---
phase: 3
slug: apollo-reasoner-brain-1-the-moat-shared-knowledge-core
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-05
updated: 2026-06-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.0.18` |
| **Config file** | package.json `test` = `vitest run` |
| **Quick run command** | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts src/lib/engine/__tests__/aggregator.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (unit, mocked Qwen) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched module(s)
- **After every plan wave:** Run `npm test` (full suite — remix tests guard D-12)
- **Before `/gsd:verify-work`:** Full suite green + one real-video `apollo-core-smoke.ts` run (Plan 04 checkpoint)
- **Max feedback latency:** ~60 seconds (unit); the live R8/R6 check is the manual checkpoint

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | D-02 (R2/R12 gate) | T-03-01 | core carries outlier number before dormant | content/grep | `grep -q "5× follower count" .planning/corpus/KNOWLEDGE-CORE.md` | ✅ | ⬜ pending |
| 3-01-02 | 01 | 1 | R2/R12 (delivery) | T-03-01/T-03-02 | byte-stable, zero interpolation | unit | `npx vitest run src/lib/engine/__tests__/apollo-core.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 1 | R2/R5/R12 | — | all behaviors have a named test | unit | `npx vitest run src/lib/engine/__tests__/remix-core-grounding.test.ts` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 2 | R2/R5 | T-03-04 | Apollo schema validates (6 dims/composite/rewrites) | unit | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "apollo schema validates"` | ⚠️ extend | ⬜ pending |
| 3-02-02 | 02 | 2 | R2 | T-03-03/T-03-05 | rewrite.original == verbatim hook (backstop) | unit | `npx vitest run src/lib/engine/__tests__/deepseek.test.ts -t "rewrite original matches verbatim hook"` | ⚠️ extend | ⬜ pending |
| 3-02-03 | 02 | 2 | D-01/D-02 | — | creator-rules dormant, no dual base, rulebook untouched | unit/suite | `npm test` | ✅ | ⬜ pending |
| 3-03-01 | 03 | 2 | R12 | T-03-06/T-03-07 | DECODE_SYSTEM_PROMPT references core; 4 beats preserved | unit | `npx vitest run src/lib/engine/__tests__/remix-core-grounding.test.ts -t "decode"` | ❌ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | R12 | T-03-06/T-03-08 | ADAPT_SYSTEM_PROMPT references core; concepts[3]; nudge on user msg | unit | `npx vitest run src/lib/engine/__tests__/remix-core-grounding.test.ts -t "adapt"` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 3 | R5 | T-03-09/T-03-10 | blend = behavioral + apollo (renorm); gemini retired; verbatim threaded | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "blend uses behavioral + apollo"` | ⚠️ extend | ⬜ pending |
| 3-04-02 | 04 | 3 | R5 | T-03-09/T-03-10/T-03-11 | variants.apollo read-merge-write; user-scoped; ENGINE_VERSION 3.3.0 | unit/suite | `npm test` | ✅ | ⬜ pending |
| 3-04-03 | 04 | 3 | R2/R8/R6 | T-03-11 | live: rewrite.original==hook, ±1–2 band, under cap | manual (checkpoint) | `npx tsx scripts/apollo-core-smoke.ts` + `npx tsx scripts/measure-pipeline.ts` 2× | exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/__tests__/apollo-core.test.ts` — byte-stability + zero-interpolation + embedded-number + composition (Plan 01 Task 2/3)
- [ ] `src/lib/engine/__tests__/remix-core-grounding.test.ts` — decode/adapt reference KNOWLEDGE_CORE (R12) + §5-beats==BEAT_IDS static assert (D-13) (Plan 01 Task 3)
- [ ] Extend `src/lib/engine/__tests__/deepseek.test.ts` — apollo schema validates, rewrite-original-matches-verbatim, distinct-levers (Plan 01 Task 3, green in Plan 02)
- [ ] Extend `src/lib/engine/__tests__/aggregator.test.ts` — behavioral+apollo blend, gemini retired, renorm math (Plan 01 Task 3, green in Plan 04)
- [ ] Port "outlier = ≥5× follower count" into core §2.0a (Plan 01 Task 1 — content task; GATES the creator-rules dormant)

Framework (Vitest) already installed — no install task. Wave 0 is authored in Plan 01 Task 3; documented-red cases turn green as Plans 02/03/04 land.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verbatim-grounded rewrite on a REAL run | R2 | Needs a real video through Omni → Apollo; unit tests mock Qwen | `npx tsx scripts/apollo-core-smoke.ts` on a fixed .mp4; confirm rewrites[].original == verbatim hook |
| Composite determinism band on re-run | R8 | Provider-level nondeterminism; tolerance band not byte-identity (STATE.md amendment) | Run measure-pipeline.ts 2× on same video; composite within ±1–2 |
| E2E latency under cap | R6 | Real pipeline timing | `npx tsx scripts/measure-pipeline.ts`; total under 300s (target ≤90s) |
| Stale-cache invalidation | Pitfall 3 | Requires re-analyzing a known persisted video | Re-analyze; overall_score reflects new blend, not pre-Apollo number (ENGINE_VERSION 3.3.0) |

These are bundled into the Plan 04 blocking human-verify checkpoint (Task 3).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the lone manual is the Plan 04 checkpoint by design — live R2/R8/R6)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (apollo-core, remix-core-grounding, deepseek/aggregator extensions)
- [x] No watch-mode flags (all `vitest run`)
- [x] Feedback latency < 60s (unit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-05
