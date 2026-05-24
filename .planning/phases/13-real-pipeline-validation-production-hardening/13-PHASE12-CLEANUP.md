# Phase 12 Reconciliation + Obsolete Env Inventory (D-29)

**Authored:** 2026-05-22
**Purpose:** Phase 12 archival note + obsolete env var inventory for Plan 02/03 removal tasks

---

## Phase 12 Disposition

Phase 12 (Accuracy Benchmark + Acceptance Gate) ran in text-only mode against the 225-row corpus. The Phase 13 CONTEXT.md reclassifies it as superseded by the real-video validation approach.

### KEEP

| Artifact | Location | Reason |
|----------|----------|--------|
| `--max-rows` flag in `scripts/eval.ts` | `scripts/eval.ts` | Utility for capped evaluation runs; useful for fast smoke runs |
| `platt_parameters` DB row | Supabase `analysis_results` (via calibration.ts) | Text-mode-trained; flag as "text-mode-trained, video-mode re-train pending". Do NOT delete — re-train in Plan 08 or M2 after real-video corpus is built. |
| All `12-*.md` planning artifacts | `.planning/phases/12-accuracy-benchmark-acceptance-gate/` | Historical record; archival value; never delete |
| `12-HANDOFF.md` | `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-HANDOFF.md` | Closing note; points forward to Phase 13. Actual update of ROADMAP Phase 12 status → "Superseded by Phase 13" happens in Plan 08. |

### DISCARD (staged — do NOT delete in this plan)

| Artifact | Location | Reason | Cleanup plan |
|----------|----------|--------|-------------|
| `.planning/research/smoke-v3.json` | `.planning/research/smoke-v3.json` | Transient smoke-test output; superseded by Plan 05-07 real-video E2E | Plan 08 final cleanup |

### UPDATE (deferred — happens in Plan 08)

| File | Required update |
|------|----------------|
| `12-HANDOFF.md` | Closing note pointing forward to Phase 13 real-video validation as the actual acceptance gate |
| `ROADMAP.md` | Mark Phase 12 status = "Superseded by Phase 13" |

---

## Obsolete Env Table (input for Plan 02/03 removal tasks)

These env vars will become dead code after the specified plans ship. Document here for Plan 02/03 executor.

| Env var | Current default | Defined at | Becomes obsolete after | Removal plan |
|---------|-----------------|------------|----------------------|--------------|
| `DEEPSEEK_COUNTERFACTUALS_MODEL` | `deepseek-v4-flash` | `src/lib/engine/stage11-counterfactuals.ts:16` | Plan 02 (Stage 11 → Gemini rebuild, D-02) | Plan 02 deletes the line; entire `stage11-counterfactuals.ts` call site changes to Gemini |
| `DEEPSEEK_NICHE_MODEL` | `deepseek-v4-flash` | `src/lib/engine/wave0/niche-detector.ts:18` | Plan 03 (D-17 fold Wave 0 niche into Gemini) | Plan 03 deletes the line + eventually the entire `wave0/niche-detector.ts` file |
| `DEEPSEEK_CRITIQUE_MODEL` | `deepseek-v4-flash` | `src/lib/engine/stage10-critique.ts:17` | Future (Stage 10 remains DeepSeek for now; flag for M2 Gemini migration) | M2 milestone if critique moves to Gemini |

Note: `DEEPSEEK_MODEL` (main reasoner) and `DEEPSEEK_API_KEY` remain active — Wave 2 DeepSeek reasoning continues in Phase 13.

---

## Pre-Existing Test Count (D-24 scoping baseline)

**Captured:** 2026-05-22 during Plan 01 execution

**Source of truth:** `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`

**Count: 89 test files** in `src/` directory.

Note: Full vitest suite had infrastructure issues at Plan 01 execution time (missing `@testing-library/jest-dom` devDep). Fixed by installing `@testing-library/jest-dom@6.9.1` + `happy-dom@20.9.0` into `/Users/davideloreti/virtuna-v1.1/node_modules`. After fix: `prediction-cache.test.ts` runs 16 tests passing.

**Assumption A7 comparison:** Phase 12 CONTEXT notes ~1191 tests. Current count of 89 test FILES (not individual tests) reflects multi-test files. At ~15-20 tests per file average, total test count is roughly 1000-1500 individual tests — consistent with A7.

**Categories most at risk from Plan 02/03 changes:**

| Category | File pattern | Risk | Reason |
|----------|-------------|------|--------|
| Aggregator weight assertions | `aggregator*.test.ts` | HIGH | D-16: all weights change |
| Rules scoring | tests asserting `rules_score > 0` | HIGH | D-14: rules weight=0 |
| Retrieval contribution | tests asserting `retrieval_score > 0` | HIGH | D-15: retrieval weight=0 |
| Stage 11 shape | any `stage11*.test.ts` | HIGH | Complete rebuild DeepSeek→Gemini |
| Caption-dependent paths | any test passing real caption content | MEDIUM | Caption now non-signal; tests asserting caption-driven scores will need rewrite |

**Plan 02/03 test-update executor note:** Expect ~40-60 test failures immediately after weight redistribution. These are expected and must be fixed as part of Plan 02 — CI red blocks milestone merge (D-24).

---

## References

- D-29: Archive Phase 12 as superseded — from `13-CONTEXT.md`
- D-24: Pre-existing tests need update — from `13-CONTEXT.md`
- `13-AUDIT-CAPTION-LESS.md` — companion document with per-stage caption audit verdicts
- `12-HANDOFF.md` — Phase 12 final state (to be updated in Plan 08)
