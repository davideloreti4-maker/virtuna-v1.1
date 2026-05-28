---
phase: 15
slug: calibration-refit-on-qwen-corpus
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-24
updated: 2026-05-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated per RESEARCH.md Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | Vitest default discovery; tests live under `src/lib/engine/__tests__/` |
| **Quick run command** | `pnpm exec vitest run src/lib/engine/__tests__/aggregator.test.ts src/lib/engine/__tests__/calibration.test.ts` |
| **Full suite command** | `pnpm exec vitest run` (baseline: 996/996 passing, 17 skipped per MILESTONE.md "Pre-flight green state") |
| **Type-check command** | `pnpm exec tsc --noEmit` (0 errors required) |
| **Build command** | `pnpm build` |
| **Estimated runtime** | Quick: ~10s · Full: ~3-5 min · Type-check: ~30s · Build: ~60s |

---

## Sampling Rate

- **After every task commit:** Run quick suite for touched test files
- **After every plan wave:** Run full vitest suite + `pnpm exec tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + `pnpm build` green + live E2E (D-20) capture committed
- **Max feedback latency:** Quick ≤ 15s · Full ≤ 5 min

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 15-01 | 1 | CALIB-01 | T-15-02 | Atomic migration prevents partial-apply | grep | `grep -q "ADD COLUMN engine_version TEXT" supabase/migrations/20260524000000_platt_engine_version.sql` | ❌ (Wave 0 creates) | ⬜ pending |
| 15-01-T2 | 15-01 | 1 | CALIB-01 | T-15-04 | No hand-edits to generated types | grep | `grep -c "engine_version.*string" src/types/database.types.ts` ≥ 3 | ✅ | ⬜ pending |
| 15-01-T3 | 15-01 | 1 | CALIB-01 | T-15-03 | Cache key namespacing prevents stale reads | vitest | `pnpm exec vitest run src/lib/engine/__tests__/calibration.test.ts` | ✅ | ⬜ pending |
| 15-01-T4 | 15-01 | 1 | CALIB-01 | T-15-01 | CLI input validated against regex | grep + tsc | `grep -q "engine_version: engineVersion" src/lib/engine/corpus/cli/train-platt.ts && pnpm exec tsc --noEmit` | ✅ | ⬜ pending |
| 15-01-T5 | 15-01 | 1 | CALIB-01 | n/a | Full quick suite green | vitest + tsc | `pnpm exec vitest run src/lib/engine/__tests__/{aggregator,calibration}.test.ts && pnpm exec tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-T1 | 15-02 | 2 | CALIB-01 | T-15-08 | Pre-flight blocks INSERT on un-migrated table | manual SQL | Operator runs SQL queries, confirms `2.1.0 \| 2` | n/a | ⬜ pending |
| 15-02-T2 | 15-02 | 2 | CALIB-01 | T-15-06 | Cost cap fires before $50 overrun | grep on stdout | `grep -q "Platt parameters stored" /tmp/15-02-refit-run.log && grep -q "cost_cents_total:" /tmp/15-02-refit-run.log` | ❌ (Task 2 creates) | ⬜ pending |
| 15-02-T3 | 15-02 | 2 | CALIB-01 | T-15-07 | Capture has no PII (only metric fields) | node | `node -e "const d=require('/tmp/15-02-eval-capture.json'); if (d.length<200) process.exit(1)"` | ❌ (Task 3 creates) | ⬜ pending |
| 15-02-T4 | 15-02 | 2 | CALIB-01 | n/a | Research doc captures (a,b) + cost | grep | `test -f .planning/research/qwen-refit-run.md && grep -q "Fitted Parameters" .planning/research/qwen-refit-run.md` | ❌ (Task 4 creates) | ⬜ pending |
| 15-02-T5 | 15-02 | 2 | CALIB-01 | n/a | Operator approval gate | manual | Operator reviews qwen-refit-run.md, types `approved` | n/a | ⬜ pending |
| 15-03-T1 | 15-03 | 3 | CALIB-02, CALIB-03 | T-15-11 | Sweep harness reuses sidecar (no engine re-run) | grep + tsc | `grep -q "computeMacroF1" scripts/15-03-sweep-thresholds.ts && pnpm exec tsc --noEmit` | ❌ (Task 1 creates) | ⬜ pending |
| 15-03-T2 | 15-03 | 3 | CALIB-02 | n/a | Best triple within D-09 bounds | node | `node -e "const r=require('/tmp/15-03-sweep-results.json'); if (r.best.viralCut <= r.best.underCut + 20) process.exit(1)"` | ❌ (Task 2 creates) | ⬜ pending |
| 15-03-T3 | 15-03 | 3 | CALIB-02 | n/a | Operator confirms D-14 branch | manual | Operator types `branch-A` / `branch-B-ship` / `branch-C-escalate` | n/a | ⬜ pending |
| 15-03-T4 | 15-03 | 3 | CALIB-03 | T-15-10, T-15-13 | Citation comment cites doc + decision IDs | grep + tsc | `grep -q "Phase 15 D-09" src/lib/engine/corpus/eval-config.ts && grep -q "Phase 15 D-11" src/lib/engine/aggregator.ts && pnpm exec tsc --noEmit` | ✅ | ⬜ pending |
| 15-03-T5 | 15-03 | 3 | CALIB-02 | T-15-12 | benchmark_results INSERT preserves 8 existing rows | manual SQL + grep | `grep -q "Headline" .planning/research/qwen-stratified-validation.md && ! grep -q "<fill>" .planning/research/qwen-stratified-validation.md` | ❌ (Task 5 creates) | ⬜ pending |
| 15-04-T1 | 15-04 | 4 | CALIB-05 | n/a | Gate from 15-03 honored (D-23) | grep | `grep -qE "(branch.A\|branch.B.ship)" .planning/phases/15-calibration-refit-on-qwen-corpus/15-03-SUMMARY.md` | ❌ (15-03 SUMMARY creates) | ⬜ pending |
| 15-04-T2 | 15-04 | 4 | CALIB-05 | n/a | RED step — D-21 test fails BEFORE wiring flip | vitest | `pnpm exec vitest run -t "is_calibrated=true when v3.0.0 Platt"` shows 1 FAIL | ✅ | ⬜ pending |
| 15-04-T3 | 15-04 | 4 | CALIB-05 | T-15-15, T-15-17 | GREEN step — wiring flip lands, all tests green | vitest + tsc | `pnpm exec vitest run src/lib/engine/__tests__/aggregator.test.ts && pnpm exec tsc --noEmit` | ✅ | ⬜ pending |
| 15-04-T4 | 15-04 | 4 | CALIB-05 | T-15-18 | Build + commit with audit trail | bash | `pnpm build && git log -1 --oneline \| grep -qE "(15-04\|CALIB-05)"` | n/a | ⬜ pending |
| 15-04-T5 | 15-04 | 4 | CALIB-05 | T-15-16, T-15-19 | Live E2E proves is_calibrated=true | manual curl | Operator pastes response with `is_calibrated: true` + `engine_version: "3.0.0"` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 = test scaffolding that MUST exist before Wave 1 production code lands. For Phase 15:

- [ ] `src/lib/engine/__tests__/calibration.test.ts` — additive `it` blocks for: (1) `filters by engineVersion argument`, (2) `defaults to ENGINE_VERSION when arg omitted`, (3) `namespaces cache key per engineVersion`. Created in Plan 15-01 Task 3 alongside the production change (Vitest TDD pattern — write tests before signature update in same task).
- [ ] `src/lib/engine/__tests__/aggregator.test.ts` — invert the calibration-debt test at line 440 to assert `is_calibrated=true` when v3.0.0 mock returns. Created in Plan 15-04 Task 2 (RED step) BEFORE the wiring flip in Task 3 (GREEN step). Preserves negative test at line 434 (D-19 behavior unchanged).
- [x] No new test framework install needed (Vitest already in tree)
- [x] No shared fixtures changes needed — existing `factories.ts` (`makePipelineResult`, `makeGeminiAnalysis`) covers the aggregator suite

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration applies cleanly to live Supabase + backfills existing rows | CALIB-01 | DDL applies to qyxvxleheckijapurisj; not a Vitest concern | Plan 15-01 Task 2: `supabase db push` exit 0; SQL query returns `2.1.0 \| 2` |
| train-platt CLI produces v3.0.0 row with sample_count near 225 | CALIB-01 | ~2 hour live Qwen run with billing | Plan 15-02 Task 2: capture stdout to /tmp/15-02-refit-run.log; confirm row via SQL |
| macro_f1 meets D-14 acceptance bar OR fallback rationale logged | CALIB-02 | Sweep + branching decision requires human gate | Plan 15-03 Task 3: operator confirms branch A / B-ship / B-refit / C-escalate |
| Live `/api/analyze` E2E showing `is_calibrated = true` + `engine_version = "3.0.0"` | CALIB-05 | Requires running dev server + live Qwen call against deployed app | Plan 15-04 Task 5: curl `<deploy-url>/api/analyze`, paste response payload to qwen-stratified-validation.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (verified — checkpoints are interleaved with automated tasks across all 4 plans)
- [ ] Wave 0 covers all MISSING references (calibration.test.ts + aggregator.test.ts coverage scaffolded inside the relevant plans)
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 5 min for full suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending operator review after first plan execution.
