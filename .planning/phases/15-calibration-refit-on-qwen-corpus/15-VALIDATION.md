---
phase: 15
slug: calibration-refit-on-qwen-corpus
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by gsd-planner per RESEARCH.md Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TBD (planner: read RESEARCH.md Validation Architecture) |
| **Config file** | TBD |
| **Quick run command** | TBD |
| **Full suite command** | TBD |
| **Estimated runtime** | TBD |

---

## Sampling Rate

- **After every task commit:** Run quick suite
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** TBD

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | CALIB-01..05 | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Per RESEARCH.md Validation Architecture — populate by planner

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `/api/analyze` E2E showing `is_calibrated = true` | CALIB-05 | Requires running dev server + live Qwen call | Start dev, POST one analyze request, inspect SSE for is_calibrated field |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBD s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
