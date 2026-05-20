---
phase: 10
slug: ml-audit-calibration-aggregator-extension
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --testPathPattern=aggregator` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~45 seconds (full suite: 1170 tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=aggregator`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green (1170+ tests)
- **Max feedback latency:** ~10 seconds (aggregator pattern)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-xx-01 | TBD | 1 | ML-01 | — | N/A | manual | `npx tsx src/lib/engine/corpus/cli/ml-audit.ts` → `.planning/research/ml-audit-report.md` written | ❌ Wave 0 | ⬜ pending |
| 10-xx-02 | TBD | 1 | ML-02 | — | N/A | unit | `npm test -- --testPathPattern=leave-one-out` | ✅ existing | ⬜ pending |
| 10-xx-03 | TBD | 1 | ML-03 | — | N/A | unit | `npm test -- --testPathPattern=aggregator` | ✅ existing | ⬜ pending |
| 10-xx-04 | TBD | 2 | ML-04 | T-10-V5 | Validate bucket values before mapping; clamp inputs to fitPlattScaling | unit + manual | `fitPlattScaling` unit test in `calibration.test.ts`; DB write integration-only | ✅ / ❌ Wave 0 | ⬜ pending |
| 10-xx-05 | TBD | 2 | ML-05 | — | N/A | unit | `npm test -- --testPathPattern=aggregator` | ✅ existing | ⬜ pending |
| 10-xx-06 | TBD | 1 | ML-06 | — | N/A | unit | `npm test -- --testPathPattern=ml` | ✅ existing | ⬜ pending |
| 10-xx-07 | TBD | 3 | AGG-01 | — | N/A | unit | `npm test -- --testPathPattern=aggregator` | ✅ existing | ⬜ pending |
| 10-xx-08 | TBD | 3 | AGG-02 | — | N/A | unit | `npm test -- --testPathPattern=aggregator-phase10` | ❌ Wave 0 | ⬜ pending |
| 10-xx-09 | TBD | 4 | AGG-04 | — | N/A | unit | `npm test -- --testPathPattern=aggregator` | ✅ existing | ⬜ pending |
| 10-xx-10 | TBD | 4 | AGG-05 | — | N/A | unit | `npm test` | ✅ existing | ⬜ pending |
| 10-xx-11 | TBD | 4 | AGG-06 | — | N/A | unit | `npm test -- --testPathPattern=aggregator-phase10` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/corpus/cli/ml-audit.ts` — empty scaffold for ML audit CLI (implementation is plan body)
- [ ] `src/lib/engine/__tests__/aggregator-phase10.test.ts` — AGG-02 + AGG-06 test file with stubs
- [ ] `supabase/migrations/20260520XXXXXX_phase10_platt_parameters.sql` — migration for `platt_parameters` table

*Note: `train-platt.ts` is NOT a Wave 0 scaffold — Plan 02 creates it fully and no test depends on it during Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ML audit report written to `.planning/research/ml-audit-report.md` | ML-01 | File system + human review of accuracy/confusion matrix | Run `npx tsx src/lib/engine/corpus/cli/ml-audit.ts`; check file exists and contains accuracy metric |
| Platt params stored in `platt_parameters` DB table | ML-04 | DB write requires live Supabase connection | Run `npx tsx src/lib/engine/corpus/cli/train-platt.ts`; verify row inserted in Supabase dashboard |
| Decision documented (retrain/down-weight/disable) | ML-02 | Requires developer judgment from audit report | Read ML audit report; apply decision as code change; document in `weight-calibration-report.md` |
| Weight calibration report committed | AGG-03 | Human review of ablation findings | Run signal ablation eval; commit `weight-calibration-report.md` to `.planning/research/` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
