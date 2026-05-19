---
phase: 8
slug: benchmark-retrieval
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run src/lib/engine/retrieval` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10s (retrieval module) / ~60s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (retrieval module tests)
- **After every plan wave:** Run full suite (catch cross-stage regressions in pipeline.test.ts + aggregator.test.ts)
- **Before `/gsd-verify-work`:** Full suite must be green; 203 existing tests must still pass (BENCH-05)
- **Max feedback latency:** ~10s

---

## Per-Task Verification Map

> Populated by the planner from PLAN.md frontmatter `automated:` blocks. Initial sketch (planner refines):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-XX | 01 | 1 | RETRIEVAL-01 | — | N/A | unit | `pnpm vitest run src/lib/engine/retrieval/embedder.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-XX | 02 | 1 | RETRIEVAL-03 | — | N/A | unit | `pnpm vitest run src/lib/engine/retrieval/pgvector-client.test.ts` | ❌ W0 | ⬜ pending |
| 08-03-XX | 03 | 2 | RETRIEVAL-04,05 | — | N/A | integration | `pnpm vitest run src/lib/engine/retrieval/retrieval-stage.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-XX | 04 | 2 | RETRIEVAL-06 | — | N/A | unit | `pnpm vitest run src/lib/engine/aggregator.test.ts` | ✅ | ⬜ pending |
| 08-05-XX | 05 | 3 | RETRIEVAL-02 | — | N/A | manual | one-time `pnpm tsx scripts/embed-corpus.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/retrieval/embedder.test.ts` — subject-text formula determinism, null-field handling (D-06)
- [ ] `src/lib/engine/retrieval/bucket-derivation.test.ts` — calibrated vs derived branches (D-03a)
- [ ] `src/lib/engine/retrieval/re-ranker.test.ts` — hashtag overlap math, edge cases (D-04a)
- [ ] `src/lib/engine/retrieval/retrieval-stage.test.ts` — hierarchical relaxation transitions, graceful degradation, `min_corpus_size` gate (D-04, D-04b)
- [ ] `src/lib/engine/retrieval/pgvector-client.test.ts` — query shape + filter combinations (mocked supabase client)
- [ ] Extend `src/lib/engine/aggregator.test.ts` — SCORE_WEIGHTS redistribution with `retrieval` slot; null-retrieval pathway via `SignalAvailability` (D-03b, D-10)
- [ ] Extend `src/lib/engine/pipeline.test.ts` — Wave 1 parallel stage adds retrieval sibling; events emit correctly (D-09)
- [ ] No new framework install — Vitest already present (Phase 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applied successfully | RETRIEVAL-01 | Live DB state | `pnpm supabase db push` then verify `\d training_corpus`, `\d scraped_videos`, `\d analysis_results` show `embedding`, `retrieval_evidence`, `retrieval_score` |
| pgvector extension enabled | RETRIEVAL-01 | Live DB state | `SELECT extname FROM pg_extension WHERE extname = 'vector';` returns one row |
| HNSW indexes created | RETRIEVAL-01 | Live DB state | `\di idx_*_embedding` shows hnsw access method |
| One-time backfill complete | RETRIEVAL-02 | One-shot CLI | Run `pnpm tsx scripts/embed-corpus.ts`; verify `SELECT count(*) FROM training_corpus WHERE embedding IS NULL` returns 0 and same for scraped_videos |
| Predict-time retrieval <1s | RETRIEVAL-03 | Live pipeline latency | Run `pnpm tsx scripts/run-prediction.ts` (or eval harness sample), inspect `retrieval` stage_end event `duration_ms` < 1000 |
| Retrieval signal contributes to aggregator | RETRIEVAL-06 | End-to-end | Eval harness sample with retrieval present + retrieval absent (force null) — `final_score` shifts measurably |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files listed above)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 10s (quick command) / <60s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter (planner promotes after wiring tasks to map)

**Approval:** pending
