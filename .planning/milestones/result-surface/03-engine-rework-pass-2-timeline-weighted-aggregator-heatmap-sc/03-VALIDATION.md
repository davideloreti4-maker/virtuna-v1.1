---
phase: 3
slug: engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run --reporter=dot src/lib/engine` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~30 seconds (engine subset), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run quick (engine subset)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (quick), 90 seconds (full)

---

## Per-Task Verification Map

> Planner populates this table per task during planning. Rows below are placeholders to be filled in by gsd-planner.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | R2 | — | Pass 2 parses qwen3.6-plus thinking output | unit | `pnpm vitest run pass2.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/wave3/__tests__/pass2.test.ts` — stubs for R2 (Pass 2 timeline)
- [ ] `src/lib/engine/wave3/__tests__/weighted-aggregator.test.ts` — stubs for R2 (weighted aggregator)
- [ ] `src/lib/engine/filmstrip/__tests__/extract.test.ts` — stubs for R2 (filmstrip pipeline)
- [ ] `src/lib/engine/__tests__/persona-weights.test.ts` — stubs for R2.3 (weight overrides)
- [ ] `src/lib/engine/__tests__/anti-virality.test.ts` — timeline-pattern trigger fixtures for R1.9
- [ ] Vitest config already present — no install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pass 2 thinking-mode quality on real videos | R2 | Requires live DashScope + real video corpus; no fixtures match production model behavior | Run `pnpm tsx scripts/eval-pass2.ts <fixture_id>` against ≥10 corpus videos; inspect attention curves for sanity |
| Anti-virality timeline threshold false-positive rate | R1.9 | No outcomes corpus yet; calibration is empirical | Run corpus sweep on training-data.json; expect <10% false-positive rate on "actually good" videos |
| Filmstrip keyframe visual quality | R2 | Image quality is subjective | Spot-check 5 analyses' filmstrips in Supabase Storage UI; confirm scene boundaries match keyframes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
