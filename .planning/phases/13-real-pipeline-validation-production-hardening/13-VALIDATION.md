---
phase: 13
slug: real-pipeline-validation-production-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Plan | Type | Test Type | Automated Command | What It Validates |
|------|------|-----------|-------------------|-------------------|
| 01 — Gemini self-test + Phase-12 cleanup | live-API | `pnpm tsx scripts/engine-self-test.ts` | Every slot in `src/lib/engine/gemini.ts` (hook/body/CTA) returns 2xx + non-degenerate response. Probes both bare and `-preview` forms (Research A1). |
| 01 — Phase-12 obsolete env cleanup | unit + grep | `grep -r DEEPSEEK_COUNTERFACTUALS_MODEL src/ \|\| true` (must return empty) | `DEEPSEEK_COUNTERFACTUALS_MODEL` and `DEEPSEEK_NICHE_MODEL` removed from `.env*`, `src/`, and config. |
| 02 — Stage 11 rebuild | unit | `pnpm vitest run src/lib/engine/stages/stage11` | Stage 11 always runs (no skip on `overall_score ≥ 70`); accepts full signal context payload; returns ≥1 suggestion with signal references; merges with `result.suggestions[]` without double-counting. |
| 02 — Stage 11 prompt schema | unit | `pnpm vitest run src/lib/engine/stages/stage11-prompt.test.ts` | Prompt receives Gemini factor scores, fired rules, trend matches, persona dissent, platform fit; output schema validated via Zod. |
| 03 — DeepSeek hang mitigation | unit | `pnpm vitest run src/lib/engine/deepseek.test.ts` | `AbortSignal.timeout(N)` wrapper kills a mocked slow server within deadline; in-process `Promise.race` fallback documented (D-22). `gtimeout` path verified at `/opt/homebrew/bin/gtimeout`. |
| 04 — Cross-phase code-logic review | review-doc | `test -f .planning/phases/13-*/13-CODE-REVIEW-09-12.md` | Wave wiring (Wave N inputs match N-1 outputs), signal fallback paths (no silent degradations), error swallowing patterns documented. Read-only — no inline edits. |
| 05 — E2E smoke (1 URL) | E2E | `pnpm tsx scripts/smoke-tiktok-pipeline.ts urls-1.txt` | 1 real TikTok URL → `/api/analyze` returns 2xx; audio fingerprint non-null; Wave 3 ≥3 personas with verdicts; Wave 4 numeric platform_fit; Stage 11 ≥1 suggestion. |
| 06 — E2E smoke (5 URLs) | E2E | `pnpm tsx scripts/smoke-tiktok-pipeline.ts urls-5.txt` | 5/5 pass with same non-degraded criteria as Plan 05. |
| 07 — E2E smoke (10 URLs) | E2E | `pnpm tsx scripts/smoke-tiktok-pipeline.ts urls-10.txt` | 10/10 pass with same criteria. Snapshot per video → diff against Plan 06 baseline; no silent degradations. |
| 08 — Version flip + milestone merge | unit + git | `grep -E "3\.0\.0[^-]" src/lib/engine/version.ts` (must succeed); `git log milestone/engine-foundation..main` (must be non-empty after merge) | `ENGINE_VERSION` reads `3.0.0` (no `-dev` suffix); `prediction-cache.ts` key auto-invalidates on flip (read-only verify per Research D-23); branch merged with `--no-ff`. |

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
