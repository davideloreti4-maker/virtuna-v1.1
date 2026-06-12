---
phase: 2
slug: view-model-data-contract-eng-06-d-12
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.0.18 (existing) |
| **Config file** | existing repo Vitest config |
| **Quick run command** | `pnpm test src/lib/reading` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~quick: <10s for lib/reading; full: existing suite |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test src/lib/reading`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** <30 seconds (lib unit tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | DATA-01 | — | N/A (pure module) | unit | `pnpm test src/lib/reading` | ❌ W0 | ⬜ pending |
| TBD (planner fills) | — | — | DATA-02 | — | identical-render deep-equal | unit | `pnpm test src/lib/reading` | ❌ W0 | ⬜ pending |
| TBD (planner fills) | — | — | DATA-03 | — | N/A (doc artifact) | manual/doc | consumed-vs-dead map present | ❌ W0 | ⬜ pending |
| TBD (planner fills) | — | — | DATA-04 | — | band+why, never generic | unit | `pnpm test src/lib/reading` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Real persisted fixtures** — capture live `PredictionResult` JSON + persisted `/api/analysis/[id]` row for the SAME analysis id (extend `scripts/smoke-tiktok-pipeline.ts` per RESEARCH). Hand-authored mocks are UNACCEPTABLE for D-12 (success criteria 1+2 demand real persisted fixtures).
- [ ] Test files for `lib/reading/view-model.ts` (`toReadingBlocks`) and `fromPersistedRow` normalizer.

*The fixture capture is the one true execution prerequisite (RESEARCH finding 5).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consumed-vs-dead field map documented | DATA-03 | Doc artifact, not runtime behavior | Verify the map lists every KEEP block field and every DROP field with rationale (resolves F27/F28/F43); confirm no `lib/engine/` edits and ENGINE_VERSION unchanged |

*The identical-render contract (DATA-02) is the load-bearing automated check: `toReadingBlocks(liveFixture)` deep-equals `toReadingBlocks(fromPersistedRow(persistedFixture))` for the same analysis.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (real fixtures)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
