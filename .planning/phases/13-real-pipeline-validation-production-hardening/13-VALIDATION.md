---
phase: 13
slug: real-pipeline-validation-production-hardening
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `13-RESEARCH.md` § Validation Architecture. The planner fills task IDs after PLAN.md is written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing engine tests) + ad-hoc `scripts/*.ts` for live-API + E2E smoke |
| **Config file** | `vitest.config.ts` (existing); `package.json` scripts |
| **Quick run command** | `pnpm vitest run src/lib/engine/` |
| **Full suite command** | `pnpm vitest run && pnpm exec tsc --noEmit && pnpm lint` |
| **Live-API audit** | `pnpm tsx scripts/engine-self-test.ts` |
| **E2E smoke** | `pnpm tsx scripts/smoke-tiktok-pipeline.ts <urls.txt>` |
| **Estimated runtime** | ~30s vitest · ~10s model audit · ~3–5min per E2E video |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/lib/engine/` (~30s)
- **After every plan wave:** Run `pnpm vitest run && pnpm exec tsc --noEmit` (~60s)
- **Before `/gsd-verify-work`:** Full suite + 10/10 real-video smoke + Gemini live audit must be green
- **Max feedback latency:** 60 seconds (unit/type) · pipeline smoke is human-attended

---

## Per-Task Verification Map

> Task IDs filled in by the planner once PLAN.md is written. The matrix below seeds the
> coverage shape — each plan's tasks map onto one of these test types.

| Plan / Task | Test Type | Automated Command | What It Validates |
|-------------|-----------|-------------------|-------------------|
| 01 / Task 1.1 (Gemini self-test) | live-API | `pnpm tsx scripts/engine-self-test.ts` | Every Gemini slot (Wave 0, hook, body, CTA, Stage 11) returns `response.modelVersion?.startsWith(requested)`. Probes BOTH bare AND `-preview` forms (Research A1). |
| 01 / Task 1.2 (Phase-12 obsolete env cleanup audit) | grep | `grep -r DEEPSEEK_COUNTERFACTUALS_MODEL src/ \|\| true` (will be empty after Plan 02) AND `grep -r DEEPSEEK_NICHE_MODEL src/ \|\| true` (empty after Plan 03). Audit doc captures inventory now. | Obsolete env vars catalogued; removal scheduled. |
| 01 / Task 1.3 (D-23 cache invalidation regression test) | unit | `pnpm vitest run src/lib/engine/cache/__tests__/prediction-cache.test.ts` | Cache lookup returns null when stored `engine_version != current ENGINE_VERSION`. |
| 02 / Task 2.1 (Stage 11 rebuild) | unit | `pnpm vitest run src/lib/engine/__tests__/stage11-counterfactuals.test.ts` | Stage 11 always runs (D-04); accepts full signal context; returns band-adaptive output (low: 3 fix, mid: 2 fix + 1 reinforce, high: 1 stretch + 2-3 reinforce); fileUri included when videoContext supplied. |
| 02 / Task 2.2 (aggregator SCORE_WEIGHTS + Gemini cost fix) | unit | `pnpm vitest run src/lib/engine/__tests__/aggregator.test.ts src/lib/engine/gemini/__tests__/cost.test.ts` | D-16 weights (behavioral=0.40, gemini=0.35, audio=0.05, trends=0.10, platform_fit=0.05, others=0). PRICING table has both bare + -preview keys. |
| 02 / Task 2.3 (UI rebuild + three-state chips) | unit (RTL) | `pnpm vitest run src/components/app/simulation/__tests__/insights-section.test.tsx src/components/app/simulation/__tests__/signal-availability-chips.test.tsx` | SuggestionsSection adaptive headers + type badges; chip ✓/✕/⚠ rendering. |
| 03 / Task 3.1 (Wave 0 niche fold D-17) | unit | `pnpm vitest run src/lib/engine/wave0/__tests__/ src/lib/engine/__tests__/wave0.test.ts && test ! -f src/lib/engine/wave0/niche-detector.ts` | Single Gemini call returns content_type + niche; niche-detector.ts deleted. |
| 03 / Task 3.2 (shared fileUri D-18) | unit | `pnpm vitest run src/lib/engine/__tests__/pipeline.test.ts` | Exactly one ai.files.upload call per video_upload pipeline run; videoContext threads through Wave 0, Wave 1, Stage 11. |
| 03 / Task 3.3 (287MB cap + D-24 full sweep) | full suite | `pnpm vitest run && pnpm exec tsc --noEmit && pnpm build` | VIDEO_MAX_SIZE_BYTES=287MB in both files; full test suite green. |
| 04 / Tasks 4.1-4.3 (cross-phase review) | review-doc | `test -f .planning/phases/13-*/13-CODE-REVIEW-PHASES-9-12.md && grep -c '## Phase 9\|## Phase 10\|## Phase 11\|## Phase 12' …` | Each phase has ≥4 findings; Bug Triage table populated; either "No BLOCKERS" or Task 4.5 follow-up plan present. |
| 05 / Task 5.1 (smoke runner) + 5.2 (1-video E2E) | E2E + manual | `pnpm tsx scripts/smoke-tiktok-pipeline.ts scripts/urls-1.txt` + manual UI cadence per D-25 | 1 real TikTok URL → all signal-completeness gates pass; validations/video-01.md PASS verdict. |
| 06 / Task 6.2 (5-video cadence) | E2E + manual | `pnpm tsx scripts/smoke-tiktok-pipeline.ts scripts/urls-5.txt` + manual cadence | Videos 2-5 pass; cumulative 5/5; stratification audit per D-26. |
| 07 / Task 7.2 (10-video cadence) + 7.3 (final report) | E2E + manual | `pnpm tsx scripts/smoke-tiktok-pipeline.ts scripts/urls-10.txt` + manual | Videos 6-10 pass; 13-FINAL-VALIDATION-REPORT.md recommendation = PASS. |
| 08 / Task 8.2 (ENGINE_VERSION flip) | unit + grep | `grep -E '^export const ENGINE_VERSION = "3\.0\.0"$' src/lib/engine/version.ts && pnpm vitest run` | version.ts reads "3.0.0" (no -dev); full suite green post-flip. |
| 08 / Task 8.3 (Phase 12 cleanup) | grep | `test ! -f .planning/research/smoke-v3.json && grep -c 'Closing Note' .planning/phases/12-*/12-HANDOFF.md` | smoke-v3.json deleted; 12-HANDOFF.md closing note appended; ROADMAP shows SUPERSEDED. |
| 08 / Task 8.4 (milestone merge) | git | `git log --oneline main -3 \| grep -c 'merge.*engine-foundation'` | --no-ff merge commit on main. |
| 08 / Task 8.5 (state closure) | grep | `grep -c 'status: complete\|Phase 13 Closure' .planning/STATE.md && grep -c 'Engine Foundation — Complete' .planning/MILESTONES.md` | STATE.md complete; MILESTONES.md append-only entry. |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/engine-self-test.ts` — live-API audit harness (Plan 01 Task 1.1)
- [ ] `scripts/smoke-tiktok-pipeline.ts` — E2E smoke runner (new)
- [ ] `scripts/urls-1.txt`, `urls-5.txt`, `urls-10.txt` — curated TikTok test corpora (user-provided seed list)
- [ ] `src/lib/engine/stages/stage11-prompt.test.ts` — Stage 11 prompt unit test (new)
- [ ] `src/lib/engine/deepseek.test.ts` — DeepSeek timeout unit test (extend existing if present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stage 11 UI wiring | SC#3 | `CounterfactualResult` visual rendering on prediction card | Run dev server, paste any TikTok URL, confirm `CounterfactualResult` block renders + merges with `result.suggestions[]` visibly. UI-SPEC.md is the contract. |
| E2E smoke video correctness | SC#4 | "Non-degraded output" requires human eyeball on real video content | After scripted pass, manually skim 2/10 video outputs end-to-end to catch silent semantic degradation that schema checks miss. |
| Milestone merge sign-off | SC#8 | Human gate by design | After 10/10 pass + version flip commit, run merge per `~/.claude/rules/gsd-worktree.md` merge protocol. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (scripts/*, stage11-prompt.test.ts, deepseek.test.ts)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for unit/type; E2E smoke is human-attended
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills task IDs)

**Approval:** pending
