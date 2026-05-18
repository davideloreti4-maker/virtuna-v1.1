---
phase: 5
slug: video-segmentation-hook-decomposition
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace dev dep) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test src/lib/engine/__tests__/gemini-segmented.test.ts --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~25 seconds (quick), ~3 min (full) |
| **Coverage threshold** | 80% lines / functions / branches / statements on `src/lib/engine/**/*.ts` |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test src/lib/engine/__tests__/gemini-segmented.test.ts --run` (~25s)
- **After every plan wave:** Run `pnpm test --run` (~3 min)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30s after Wave 1; 3 min after Wave 2/3

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | SEGMENT-06, HOOK-01..07 | T-5-01-01..04 | Per-model pricing prevents cost under-count | unit | `pnpm test src/lib/engine/__tests__/gemini-cost.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-01-02 | 01 | 1 | HOOK-01..07 | T-5-01-05 | Zod-at-boundary rejects malformed LLM output | unit | `pnpm test src/lib/engine/__tests__/gemini-schemas.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-01-03 | 01 | 1 | SEGMENT-06 | T-5-01-06 | Env-var indirection allows GA migration without code change | unit | `pnpm test src/lib/engine/__tests__/gemini-env.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-02-01 | 02 | 2 | SEGMENT-01..03, HOOK-01..07 | T-5-02-01..05 | AbortController per-segment prevents runaway cost | unit | `pnpm test src/lib/engine/__tests__/gemini-hook-segment.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-02-02 | 02 | 2 | SEGMENT-05 | T-5-02-06 | Null-safe merge handles partial-segment failure gracefully | unit | `pnpm test src/lib/engine/__tests__/gemini-merge.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-02-03 | 02 | 2 | SEGMENT-01..05, HOOK-01..07 | T-5-02-07..09 | Files API delete in outer finally prevents resource leak | integration | `pnpm test src/lib/engine/__tests__/gemini-segmented.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-03-01 | 03 | 3 | SEGMENT-04..06, HOOK-01..07 | T-5-03-01..03 | Per-segment events replace legacy single event without data loss | integration | `pnpm test src/lib/engine/__tests__/pipeline-wave1.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-03-02 | 03 | 3 | HOOK-01..07 | T-5-03-04..05 | CTA penalty only fires for content types that expect CTA | unit | `pnpm test src/lib/engine/__tests__/aggregator-cta.test.ts --run` | ❌ Wave 0 | ⬜ pending |
| 5-03-03 | 03 | 3 | SEGMENT-04..06, HOOK-01..07 | T-5-03-06..08 | AI-SPEC D1-D17 eval dimensions covered by reference set | eval | `pnpm eval:phase5` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Property-Based Invariants (from RESEARCH.md `## Validation Architecture`)

These are sampling-theorem-grade invariants that any correct Phase 5 implementation MUST satisfy. Tests verify them via mock fixtures + perturbation pairs:

1. **Single-upload invariant (SEGMENT-04):** Across all 3 segment calls, `fileUri` is identical AND `files.upload` is called exactly once AND `files.delete` is called exactly once.
2. **VideoMetadata window exclusivity:** Hook `endOffset` ≤ body `startOffset`; body `endOffset` ≤ CTA `startOffset`. No overlap.
3. **String-seconds format (Pitfall #4):** All `videoMetadata` values match `/^\d+(\.\d+)?s$/` — never numeric, never `HH:MM:SS`.
4. **Per-model cost correctness (Pitfall #9):** Hook call's `calculateCost` uses Pro pricing ($2/M in, $12/M out); body + CTA use Flash pricing ($0.50/M in, $3/M out). Cost differs ≥10× between Pro and Flash for identical token count.
5. **Outer-finally delete (Pitfall #1):** `files.delete` is NEVER called inside an individual segment helper's catch/finally. Only the orchestrator's outer `Promise.allSettled` finally invokes it.
6. **Zod-at-boundary:** Every segment helper calls `XxxSegmentZodSchema.safeParse(parsed)` before returning. Malformed LLM output returns `{ ok: false, error }`, never throws.
7. **Cognitive load polarity (HOOK-07):** For a low-density vs high-density video fixture pair, high-density MUST return strictly higher `cognitive_load` score. Perturbation test.
8. **Weakest modality coherence (HOOK-05):** If a sub-modality score is 0 (e.g., silent hook → `audio_hook_quality=0`), the model MUST NOT name that modality as `weakest_modality`. Fixture test.
9. **SignalAvailability provenance-only:** Adding `gemini_hook`, `gemini_body`, `gemini_cta` keys MUST NOT affect `SCORE_WEIGHT_KEYS` math. Assertion: `SCORE_WEIGHT_KEYS` equals `["behavioral", "gemini", "ml", "rules", "trends"]`.
10. **CTA penalty matrix (D-06):** For each of 7 content types × 2 cta_present states = 14 cases, the penalty applied matches the documented table. Plus null/clamp = 17 total cases.

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — already exists, no install needed
- [ ] `src/lib/engine/__tests__/gemini-hook-segment.test.ts` — created by Plan 02 Task 1
- [ ] `src/lib/engine/__tests__/gemini-merge.test.ts` — created by Plan 02 Task 2
- [ ] `src/lib/engine/__tests__/gemini-segmented.test.ts` — created by Plan 02 Task 3
- [ ] `src/lib/engine/__tests__/aggregator-cta.test.ts` — created by Plan 03 Task 2
- [ ] `src/lib/engine/__tests__/pipeline-wave1.test.ts` — extended by Plan 03 Task 1
- [ ] Fixture videos for cognitive_load polarity test — captured during Plan 02 Task 1 (low-density + high-density 30s clips)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Gemini API responses match schema in production | HOOK-01..07 | LLM non-determinism — production runs may surface schema drift that mocks miss | After Phase 5 ships, sample 5 real video analyses from production logs (Sentry breadcrumbs), verify each segment's response parses cleanly through its Zod schema. Run weekly for 4 weeks post-launch. |
| Preview model SDK compatibility | SEGMENT-06 | Preview models can change API shape without notice (no GA SLA) | Monitor Sentry for `ZodError` spikes; check Google's release notes weekly. If `gemini-3.1-pro-preview` or `gemini-3-flash-preview` change response shape, update schemas + re-deploy. |
| Cost vs budget tracking | BENCH-01..06 | Real per-video cost depends on actual token usage which varies by video content | Weekly Stripe + Sentry breadcrumb reconciliation. Average cost per video should sit below 2.5¢ (target ~2.0¢/video per CONTEXT.md D-01 cost breakdown). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (Wave 0 = test file creation in the plans themselves)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (test files listed above)
- [x] No watch-mode flags (`--run` enforced)
- [x] Feedback latency < 30s (quick) / 180s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18 (post-plan-checker artifact-hygiene cycle)
