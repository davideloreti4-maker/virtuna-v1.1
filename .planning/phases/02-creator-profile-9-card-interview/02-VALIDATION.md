---
phase: 02
slug: creator-profile-9-card-interview
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-17
audited: 2026-05-18
---

# Phase 02 — Validation Strategy

> Per-phase validation contract — every requirement has automated verification under 60s feedback latency.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 (unit) + playwright (e2e) |
| **Config file** | `vitest.config.ts`, `e2e/playwright.config.ts` |
| **Quick run command** | `pnpm test --run` |
| **Full Phase 02 suite** | `pnpm test --run src/lib/__tests__/handle-parser.test.ts src/lib/niches/__tests__/taxonomy.test.ts src/lib/engine/__tests__/creator.test.ts src/lib/schemas/__tests__/creator-profile.test.ts src/hooks/__tests__/use-pending-profile-gate.test.tsx src/components/app/cards/__tests__ src/components/app/__tests__/truthfulness-callout.test.tsx src/stores/__tests__/onboarding-store.test.ts` |
| **E2E command** | `pnpm exec playwright test` |
| **Unit runtime** | ~3.5s (150 tests / 15 files) |
| **E2E runtime** | ~3–5 min |
| **DOM environment** | happy-dom (per-file `@vitest-environment` pragma) |
| **Setup file** | `src/test/setup.ts` (testing-library matchers + Radix polyfills) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run` scoped to changed module
- **After every plan wave:** Run full vitest suite
- **Before `/gsd-verify-work`:** Full vitest + Playwright e2e must be green
- **Max feedback latency:** 60 seconds (unit) — currently 3.5s ✓

---

## Per-Task Verification Map

| REQ ID | Plan | Test Type | Test File | Automated Command | Status |
|--------|------|-----------|-----------|-------------------|--------|
| PROFILE-01 | 02-01, 02-06 | unit (integration) | `src/lib/engine/__tests__/creator.test.ts` | `pnpm test --run src/lib/engine/__tests__/creator.test.ts` | ✅ green |
| PROFILE-02 | 02-04 | e2e | `e2e/profile-interview.spec.ts` (happy path) | `pnpm exec playwright test e2e/profile-interview.spec.ts` | ✅ green |
| PROFILE-03 | 02-03 | unit | `src/components/app/cards/__tests__/platform-picker.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/platform-picker.test.tsx` | ✅ green |
| PROFILE-04 | 02-02, 02-03 | unit | `src/lib/niches/__tests__/taxonomy.test.ts` | `pnpm test --run src/lib/niches/__tests__/taxonomy.test.ts` | ✅ green |
| PROFILE-05 | 02-03 | unit | `src/components/app/cards/__tests__/audience-picker.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/audience-picker.test.tsx` | ✅ green |
| PROFILE-06 | 02-03 | unit | `src/components/app/cards/__tests__/goal-stage-picker.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/goal-stage-picker.test.tsx` | ✅ green |
| PROFILE-07 | 02-03 | unit | `src/components/app/cards/__tests__/content-style-picker.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/content-style-picker.test.tsx` | ✅ green |
| PROFILE-08 | 02-03, 02-06 | unit | `src/lib/__tests__/handle-parser.test.ts` + `src/components/app/cards/__tests__/reference-creators-input.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/reference-creators-input.test.tsx` | ✅ green |
| PROFILE-09 | 02-03 | unit | `src/components/app/cards/__tests__/wins-flops-input.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/wins-flops-input.test.tsx` | ✅ green |
| PROFILE-10 | 02-03 | unit | `src/components/app/cards/__tests__/cadence-picker.test.tsx` | `pnpm test --run src/components/app/cards/__tests__/cadence-picker.test.tsx` | ✅ green |
| PROFILE-11 | 02-03, 02-05 | unit | `src/components/app/cards/__tests__/pain-points-input.test.tsx` + `src/lib/schemas/__tests__/creator-profile.test.ts` | `pnpm test --run src/components/app/cards/__tests__/pain-points-input.test.tsx src/lib/schemas/__tests__/creator-profile.test.ts` | ✅ green |
| PROFILE-12 | 02-04 | unit | `src/components/app/__tests__/truthfulness-callout.test.tsx` | `pnpm test --run src/components/app/__tests__/truthfulness-callout.test.tsx` | ✅ green |
| PROFILE-13 | 02-01, 02-04 | e2e | `e2e/profile-interview.spec.ts` (happy + skip-all) | `pnpm exec playwright test e2e/profile-interview.spec.ts` | ✅ green |
| PROFILE-14 | 02-04 | unit + e2e | `src/hooks/__tests__/use-pending-profile-gate.test.tsx` + `e2e/profile-interview.spec.ts` | `pnpm test --run src/hooks/__tests__/use-pending-profile-gate.test.tsx` | ✅ green |
| PROFILE-15 | 02-05 | unit + e2e | `src/lib/schemas/__tests__/creator-profile.test.ts` + e2e settings edit | `pnpm test --run src/lib/schemas/__tests__/creator-profile.test.ts` | ✅ green |
| PROFILE-16 | 11 | manual-only | (Deferred to Phase 11 per D-14) | n/a | ⏭️ deferred |
| PROFILE-17 | 02-06 | unit | `src/lib/engine/__tests__/creator.test.ts` (9-card extension) | `pnpm test --run src/lib/engine/__tests__/creator.test.ts` | ✅ green |
| INT-02 | 02-04 | e2e | `e2e/profile-interview.spec.ts` (happy path) | `pnpm exec playwright test e2e/profile-interview.spec.ts` | ✅ green |
| INT-04 | 02-05 | unit | `src/stores/__tests__/onboarding-store.test.ts` | `pnpm test --run src/stores/__tests__/onboarding-store.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⏭️ deferred*

---

## Wave 0 Requirements (Historical — closed during Plan 02-01)

- [x] `src/lib/niches/__tests__/taxonomy.test.ts` — owned by Plan 02-02 (12 active assertions)
- [x] `src/lib/engine/__tests__/creator.test.ts` — extended with 9-card describe block in Plan 02-06 (4 active assertions)
- [x] `src/lib/__tests__/handle-parser.test.ts` — created in Plan 02-01 (2 active assertions, 1 skipped)
- [x] `e2e/profile-interview.spec.ts` — activated in Plan 02-06 (3 active scenarios)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reference creator scrape lands competitor data | PROFILE-08 | Apify async webhook (minutes-to-hours latency) | Add TikTok handle to Card 5, save, wait 30 min, verify `competitor_profiles` row has scrape fields populated |
| Modal renders with Raycast design tokens | PROFILE-04 | Visual fidelity check | Open modal in dev, screenshot, compare against UI-SPEC §"Visual" |
| Re-prompt micro-card every 10 analyses | PROFILE-16 | Deferred to Phase 11 per Phase 02 D-14 — no counter column, no trigger code in Phase 2 | Will be verified in Phase 11 |
| RLS policy enforcement on `creator_profiles` 9-card columns | PROFILE-01 | Requires authenticated session against live DB | Sign in as user A, attempt PATCH with user_id=user_B in body; expect 401/200-but-write-to-A's row |

---

## Validation Audit 2026-05-18

| Metric | Count |
|--------|-------|
| Gaps found | 12 |
| Resolved | 12 |
| Escalated | 0 |
| New test files | 12 |
| New tests | 122 |
| Phase 02 total tests | 150 passed + 1 skipped |
| Runtime | ~3.5s (well under 60s budget) |

### Test Infrastructure Changes

- `vitest.config.ts` — added `.tsx` to include glob, registered `src/test/setup.ts` as setupFiles
- `src/test/setup.ts` — created (testing-library matchers + Radix polyfills for ResizeObserver/matchMedia/DOMRect)
- `package.json` — added devDependencies: `@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`, `@testing-library/user-event@14.6.1`, `happy-dom@20.9.0`

### Implementation Notes (no escalations)

- **PROFILE-11 PainPointsInput**: implementation uses grapheme-aware JS truncation via `Intl.Segmenter` (see `WR-12` comment in `pain-points-input.tsx`) instead of HTML `maxLength`. Test verifies the behavioral cap (programmatic 600-char input → 500-char emitted onChange payload) rather than the structural HTML attribute. zod schema in `creator-profile.ts` provides the second cap at the API boundary.

### Out-of-Scope Test Failures (Pre-existing, Documented)

- `src/lib/engine/__tests__/cost-benchmark.test.ts` (2 failed) — ENOENT on hardcoded fixture at `/Users/davideloreti/virtuna-v1.1/...mp4`
- `src/lib/engine/__tests__/video-e2e.test.ts` (1 failed) — same ENOENT

Both predate Phase 02 and are tracked in `.planning/phases/02-creator-profile-9-card-interview/deferred-items.md`. Not in Phase 02 scope.

---

## Validation Sign-Off

- [x] All requirements have `<automated>` verify or manual-only entry
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (taxonomy, handle-parser, creator-context-merger, e2e)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (current: 3.5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — 2026-05-18
