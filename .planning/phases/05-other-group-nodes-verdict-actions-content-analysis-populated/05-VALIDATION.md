---
phase: 5
slug: other-group-nodes-verdict-actions-content-analysis-populated
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm vitest run --reporter=dot` |
| **Full suite command** | `pnpm vitest run && pnpm test:e2e` |
| **Estimated runtime** | ~30s unit, ~90s full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --reporter=dot` (scoped to changed files where possible)
- **After every plan wave:** Run `pnpm vitest run && pnpm test:e2e`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit), 90 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be populated by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Per-task rows will be filled by the planner from PLAN.md task lists. Each task with code changes must map to a vitest or playwright test command, or list a Wave 0 dependency for stubs that need to be installed first.*

---

## Wave 0 Requirements

- [ ] Install `react-markdown@^10.1.0` + `rehype-sanitize@^6.0.0` for R1.6 reasoning narrative
- [ ] Add test fixtures for `verdict`, `actions`, `content-analysis` group nodes (extend `src/test/fixtures/prediction-result.ts` or equivalent)
- [ ] Add Vitest test stubs for cross-group anti-virality state hook (`useAntiViralityAffectedFrames`)
- [ ] Add Playwright stub for collapsible section expand-state persistence across navigation

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recharts area chart visual rendering at all breakpoints | R1.7 | Visual correctness of gradient + axes hard to assert via DOM | Open `/result/test-fixture` in Playwright headed mode, resize viewport 320 / 768 / 1280 / 1920, screenshot each |
| Cross-group anti-virality ripple visual coordination | R1.9 | Multi-frame coordinated state needs visual inspection across Verdict / Audience / Actions simultaneously | Toggle AV state via fixture, verify all 3 frames update in single frame; capture before/after screenshot |
| Markdown citation footnotes link behavior | R1.6 | Hover/focus tooltip behavior depends on real RetrievalEvidenceItem data | Click each citation marker, confirm popover opens with source + timestamp |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
