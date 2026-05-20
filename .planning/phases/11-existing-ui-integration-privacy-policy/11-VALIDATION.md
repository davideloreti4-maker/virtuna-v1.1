---
phase: 11
slug: existing-ui-integration-privacy-policy
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | INT-05 | T-11-01 | migration idempotent; columns added | unit | `grep -c "analysis_count" supabase/migrations/20260520100000_phase11_retention_counter.sql` | ✅ created in plan | ⬜ pending |
| 11-01-02 | 01 | 1 | PROFILE-16 | T-11-02 | types reflect new columns | unit | `grep -c "analysis_count\|storage_retention_opted_in\|video_storage_path" src/types/database.types.ts` | ✅ regen in plan | ⬜ pending |
| 11-02-01 | 02 | 2 | INT-05 | T-11-03 | cron skips opted-in users | unit | `npm test -- --run src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 2 | INT-05 | — | video_storage_path persisted on upload | unit | `npm test -- --run src/app/api/analyze/__tests__/route.test.ts` | ✅ existing | ⬜ pending |
| 11-03-01 | 03 | 2 | INT-03 | T-11-08 | chips render correct state per signal | unit | `npm test -- --run src/components/app/simulation/__tests__/signal-chips.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | PROFILE-16 | T-11-07 | banner dismissable; shows on count%10 | unit | `npm test -- --run src/components/app/simulation/__tests__/goal-recheck-banner.test.tsx` | ❌ W0 | ⬜ pending |
| 11-04-01 | 04 | 2 | INT-06 | T-11-11 | disclosure toggle+stopPropagation | unit | `npm test -- --run src/components/app/__tests__/video-upload-disclosure.test.tsx` | ❌ W0 | ⬜ pending |
| 11-04-02 | 04 | 2 | INT-05 | T-11-09 | retention toggle saves to DB | unit | `npm test -- --run` | ✅ suite | ⬜ pending |
| 11-05-01 | 05 | 3 | INT-01 | T-11-12 | no dev guards; smoke tiktok_url pass | smoke | `npm test -- --run src/app/api/analyze/__tests__/route.test.ts` | ✅ existing | ⬜ pending |
| 11-05-02 | 05 | 3 | INT-01 | T-11-12 | smoke video_upload pass (D-09) | smoke | `npm test -- --run src/app/api/analyze/__tests__/route.test.ts` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 test stubs are written inside the plans that create the corresponding components (per Nyquist rule). Stubs created by:

- **Plan 11-03, Task 1** (tdd="true"):
  - [ ] `src/components/app/simulation/__tests__/signal-chips.test.tsx` — covers INT-03 chip render (all 4 signals, available/unavailable variants)
  - [ ] `src/components/app/simulation/__tests__/goal-recheck-banner.test.tsx` — covers PROFILE-16 banner (render, dismiss, onDismiss callback)

- **Plan 11-04, Task 1** (tdd="true"):
  - [ ] `src/components/app/__tests__/video-upload-disclosure.test.tsx` — covers INT-06 expandable (toggle shows text, stopPropagation)

- **Plan 11-02** (cron route — executor writes test stub alongside route):
  - [ ] `src/app/api/cron/delete-retained-videos/__tests__/route.test.ts` — covers INT-05 cron logic (opt-in skip, non-opted deletion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retention policy text visible before upload | INT-06 | UI-only, no DOM test coverage | Open upload UI, verify text appears before file selector |
| Onboarding + 9-card profile no duplicate fields | INT-04 | Flow-level UX check | Run onboarding for new user with existing profile, confirm no repeated fields |

---

## Nyquist Compliance

All code-producing tasks have `<automated>` verify commands referencing specific test files. Wave 0 test stubs are created within the same plan as the production code (Plans 11-03 and 11-04 are `tdd="true"`). Plan 11-02 creates the cron stub alongside the route. No 3 consecutive code tasks exist without an automated verify.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 stubs created within same plan as production code (Plans 11-03, 11-04)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
