---
phase: 9
slug: platform-algo-fit-self-critique-counterfactuals
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (project standard) |
| **Config file** | `vitest.config.ts` at repo root |
| **Quick run command** | `pnpm vitest run src/lib/engine/wave4/ src/lib/engine/__tests__/stage10*.test.ts src/lib/engine/__tests__/stage11*.test.ts src/lib/engine/__tests__/aggregator.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run `pnpm vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green + BENCH-05 regression check
- **Max feedback latency:** ~45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 | 01 | 1 | types.ts interfaces | — | Zod schemas validate every V3 output | unit | `pnpm vitest run aggregator` | ✅ extends existing | ⬜ pending |
| 09-02 | 02 | 1 | ALGO-06 | T-P9-watermark | Watermark booleans return correctly | unit | `pnpm vitest run gemini-schemas` | ✅ extends existing | ⬜ pending |
| 09-03 | 03 | 2 | ALGO-01..06 | T-P9-prompt-injection | Platform-fit V3 returns per-platform score 0-100 | unit (mock V3) | `pnpm vitest run platform-fit` | ❌ Wave 0 | ⬜ pending |
| 09-04 | 04 | 2 | AGG-extension | — | platform_fit signal in selectWeights; available=false redistributes | unit | `pnpm vitest run aggregator-platform-fit` | ❌ Wave 0 | ⬜ pending |
| 09-05 | 05 | 2 | CRITIQUE-01..03 | T-P9-prompt-injection | Confidence clamped to [-0.20, 0]; URLs never in prompt | unit + snapshot | `pnpm vitest run critique` | ❌ Wave 0 | ⬜ pending |
| 09-06 | 06 | 2 | COUNTER-01..04 | — | Exactly 3 suggestions; LIKELY_FLOP fires on boundary | unit | `pnpm vitest run counterfactuals` | ❌ Wave 0 | ⬜ pending |
| 09-07 | 07 | 3 | BENCH-05 + pipeline | — | runPlatformFit order + stage events + full regression | integration + regression | `pnpm vitest run` | ✅ extends existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/engine/wave4/__tests__/platform-fit.test.ts` — stubs for ALGO-01..06
- [ ] `src/lib/engine/wave4/__tests__/platform-fit-prompts.test.ts` — user-message construction snapshot (ALGO-05)
- [ ] `src/lib/engine/__tests__/stage10-critique.test.ts` — CRITIQUE-01..03 + 4 consistency check fixtures (CRITIQUE-13)
- [ ] `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` — COUNTER-01..04 + LIKELY_FLOP boundary fixtures
- [ ] `src/lib/engine/__tests__/aggregator-platform-fit.test.ts` — AGG-extension for platform_fit signal (or extend `aggregator.test.ts`)
- [ ] Extend `src/lib/engine/__tests__/gemini-schemas.test.ts` — watermark Zod schema assertions
- [ ] Extend `src/lib/engine/__tests__/pipeline.test.ts` — runPlatformFit invocation order + stage events

*Wave 0 test stubs should be created in Plan 09-01 (interface-first plan) before implementation plans run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DeepSeek input cache hit rate ≥80% for platform-fit/critique/counterfactual system prompts | ALGO-01 / D-20 | Cache telemetry requires live DeepSeek API call | Run a prediction → check server logs for `cache_hit_ratio` on deepseek.ts telemetry line; expect ≥0.8 after first call warms cache |
| Counterfactual suggestions cite creator framework by name when applicable | COUNTER-01 / D-16 | LLM output quality check — not automatable | Manual review of 3 sample predictions: verify suggestions reference creator names (e.g., "per Jenny Hoyos's structure…") when creator-intelligence.md content is relevant |
| Gemini watermark detection accuracy on platform-branded overlays | ALGO-06 | Requires real video files with known watermarks | Upload a TikTok-watermarked video; verify `watermark_detected.tiktok = true` and `fit_score` for IG/YT is penalized |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
