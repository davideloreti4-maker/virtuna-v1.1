---
phase: 13
plan: "02"
subsystem: engine-stage11-aggregator-ui
tags: [stage11-rebuild, gemini, aggregator-weights, D-16, D-06, D-30, counterfactuals, signal-chips]
dependency_graph:
  requires:
    - "Plan 01 Gemini self-test verdict (PREVIEW — -preview suffix required)"
    - "Plan 01 trending_sounds probe (0 rows — audio weight 0.05)"
  provides:
    - "Stage 11 Gemini 3.1 Pro-preview contract (always-on, full context, discriminated schema)"
    - "D-16 SCORE_WEIGHTS (behavioral=0.40, gemini=0.35, audio=0.05, trends=0.10, platform_fit=0.05, ml/retrieval/rules=0)"
    - "AggregateScoresOptions.videoContext field for Plan 03 threading"
    - "gemini.ts exports: getClient, VIDEO_POLL_TIMEOUT_MS, VIDEO_POLL_INTERVAL_MS, VIDEO_MAX_SIZE_BYTES, EXT_TO_MIME"
    - "Band-adaptive SuggestionsSection (low/mid/high) with type badges Fix/Stretch/Strength"
    - "Three-state SignalAvailabilityChips (available/disabled/failed)"
    - "results-panel wired to result.counterfactuals.suggestions (D-06)"
  affects:
    - "Plan 03 pipeline.ts: imports getClient/VIDEO_POLL_TIMEOUT_MS/VIDEO_POLL_INTERVAL_MS/VIDEO_MAX_SIZE_BYTES/EXT_TO_MIME from gemini.ts (BLOCKER-1 resolved)"
    - "Plan 03 pipeline.ts: passes { videoContext } through AggregateScoresOptions"
    - "Plan 04 code review: any consumer of legacy result.suggestions field"
tech_stack:
  added:
    - "@testing-library/react 16.3.2 (devDependency — Rule 3 fix: was missing, blocking component tests)"
  patterns:
    - "GoogleGenAI discriminated-union Zod schema (z.discriminatedUnion band/low/mid/high)"
    - "AbortController + setTimeout retry-once pattern (PATTERN S7)"
    - "Three-state SignalState derived from DISABLED_THIS_PHASE set + boolean back-compat"
    - "HEADER_BY_BAND constant-driven adaptive section header"
key_files:
  created:
    - "src/components/app/simulation/__tests__/insights-section.test.tsx"
    - "src/components/app/simulation/__tests__/signal-availability-chips.test.tsx"
  modified:
    - "src/lib/engine/stage11-counterfactuals.ts"
    - "src/lib/engine/stage11-counterfactuals-prompts.ts"
    - "src/lib/engine/aggregator.ts"
    - "src/lib/engine/types.ts"
    - "src/lib/engine/gemini.ts"
    - "src/lib/engine/gemini/cost.ts"
    - "src/lib/engine/__tests__/stage11-counterfactuals.test.ts"
    - "src/lib/engine/__tests__/factories.ts"
    - "src/lib/engine/__tests__/aggregator.test.ts"
    - "src/components/app/simulation/insights-section.tsx"
    - "src/components/app/simulation/signal-availability-chips.tsx"
    - "src/components/app/simulation/results-panel.tsx"
    - "src/components/app/simulation/__tests__/signal-chips.test.tsx"
decisions:
  - "Stage 11 model: gemini-3.1-pro-preview (D-09 deferred — Plan 01 self-test confirmed bare forms 404 for hook/body/cta/stage11)"
  - "Audio weight: 0.05 (Plan 01 decision — trending_sounds 0 rows, conservative weight)"
  - "AggregateScoresOptions.videoContext: optional null default, Plan 03 supplies real values (BLOCKER-1)"
  - "calculateCost shim refactored to accept explicit model param (D-10 — no silent GEMINI_MODEL pin)"
  - "DISABLED_THIS_PHASE set includes ml, rules, retrieval (D-14/D-15/Phase 10)"
  - "@testing-library/react installed as devDependency (Rule 3 — blocking component tests)"
metrics:
  duration_minutes: 18
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 13
---

# Phase 13 Plan 02: Stage 11 Rebuild + Signal-Weight Retuning + UI Consumer Rewire Summary

Stage 11 rebuilt from DeepSeek V4 Flash to Gemini 3.1 Pro-preview — always-on, full signal context, discriminated-union band-adaptive output schema. Signal weights retuned per video-mode reality (D-16). UI consumer rewired from legacy `result.suggestions` to `result.counterfactuals`. Three-state chip rendering ships.

---

## Stage 11 Model ID (D-09 — critical for Plan 02)

**Verdict applied: KEEP `-preview` suffix — bare forms confirmed 404 for hook/body/cta/stage11.**

Per Plan 01 self-test (2026-05-22):

| Slot | Model used |
|------|-----------|
| GEMINI_STAGE11_MODEL | `gemini-3.1-pro-preview` |
| GEMINI_HOOK_MODEL | `gemini-3.1-pro-preview` (unchanged, -preview kept) |
| GEMINI_BODY_MODEL | `gemini-3-flash-preview` (unchanged, -preview kept) |
| GEMINI_CTA_MODEL | `gemini-3-flash-preview` (unchanged, -preview kept) |

D-09 bare-form drop is **blocked for all 4 slots** until Google promotes to GA. Comment added to `gemini.ts` referencing Plan 01 summary.

---

## Audio Weight Final Value

**`audio: 0.05`** — revised downward from D-16 plan target of 0.10.

Decision (Plan 01 Checkpoint 1.4, approved 2026-05-22): trending_sounds table is empty (0 rows with audio_embedding). User chose 0.05 (not 0.07 or 0.10) for conservative weighting given zero fingerprint-match contribution. `audio_perceptual_score` (Gemini-derived) is real signal but reflects only perceptual quality, not trending-match contribution.

---

## D-16 SCORE_WEIGHTS (new values)

| Weight key | Old value | New value | Reason |
|------------|-----------|-----------|--------|
| behavioral | 0.35 | 0.40 | Primary CoT, video-aware |
| gemini | 0.25 | 0.35 | Core video understanding + Stage 11 |
| audio | 0.07 | 0.05 | D-32: trending_sounds empty; conservative (user decision) |
| trends | 0.10 | 0.10 | Unchanged |
| platform_fit | 0.05 | 0.05 | Unchanged |
| ml | 0 | 0 | Unchanged (Phase 10 disabled) |
| retrieval | 0.05 | 0 | D-15: corpus embeddings caption-derived |
| rules | 0.15 | 0 | D-14: all 17 regex rules operate on caption text |

Sum = 1.00. ✓

---

## D-24 Test Files Updated (weight assertion rewrites)

| File | Tests changed | Nature of change |
|------|--------------|-----------------|
| `src/lib/engine/__tests__/aggregator.test.ts` | 4 tests changed value-expectations | D-16 normalized weight values (behavioral≈0.471, gemini≈0.412, rules=0, retrieval=0); Stage 11 mock added |
| `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` | Complete rewrite (14 tests) | OpenAI mock → GoogleGenAI mock; discriminated-union band tests |
| `src/components/app/simulation/__tests__/signal-chips.test.tsx` | 3 tests updated | Three-state behavior (✕ vs ⚠ semantics) |

---

## D-10 Silent-Fallback Fix

`calculateCost` shim in `gemini.ts` refactored from 2-arg signature (auto-pinning global `GEMINI_MODEL`) to 3-arg signature requiring explicit model:

```diff
- function calculateCost(promptTokens, candidateTokens): number {
-   return calculateCostPerModel(GEMINI_MODEL, { ... }) // pinned global!
+ function calculateCost(model, promptTokens, candidateTokens): number {
+   return calculateCostPerModel(model, { ... })        // explicit model
```

Both callers in `gemini.ts` (text path ~443, video path ~600) updated to pass `GEMINI_MODEL` explicitly. D-10 fix touched **1 file** (gemini.ts only) — within 3-file scope threshold.

---

## gemini.ts Symbols Newly Exported for Plan 03

Plan 03 pipeline.ts will import these from `src/lib/engine/gemini.ts`:

| Symbol | Purpose |
|--------|---------|
| `getClient()` | Gemini API client singleton (already exported — confirmed) |
| `VIDEO_POLL_TIMEOUT_MS` | 60s poll timeout for Files API PROCESSING state |
| `VIDEO_POLL_INTERVAL_MS` | 500ms poll interval |
| `VIDEO_MAX_SIZE_BYTES` | 50MB cap (Plan 03 Task 3.3 bumps to 287MB) |
| `EXT_TO_MIME` | Extension → MIME type map (mp4, mov, avi, webm, mkv, m4v) |

**BLOCKER-1 resolved:** `gemini.ts` ownership stays in Plan 02. Plan 03 only edits `pipeline.ts`.

---

## AggregateScoresOptions Extension (before/after)

**Before:**
```typescript
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "personas";
}
```

**After:**
```typescript
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "personas";
  // D-01/D-18 — Plan 03 pipeline.ts uploads video once at entry, threads fileUri through here.
  videoContext?: { fileUri: string; mimeType: string } | null;
}
```

**Stage 11 call site (aggregator.ts):**
```typescript
const counterfactualResult = await runStage11Counterfactuals(
  result,
  options?.videoContext ?? null,  // D-01 — Plan 03 threads real values
  onStageEvent,
);
```

Plan 03 pipeline.ts only needs to add `{ videoContext }` to its `aggregateScores` options call — no other changes to aggregator.ts.

---

## Legacy result.suggestions Consumers (Plan 04 Code Review Audit)

Per D-06, `result.suggestions` field is semantically "internal-only" after this plan. UI wiring moved to `result.counterfactuals.suggestions`. The following usages of `result.suggestions` still exist and should be audited in Plan 04 code review:

- `src/lib/engine/aggregator.ts` (populates `result.suggestions` from DeepSeek output — source; intentional)
- `src/lib/engine/deepseek.ts` (produces `suggestions` array in DeepSeek response schema — source; intentional)
- Any route handler persisting `result.suggestions` to `analysis_results` table (persistence path; likely intentional)

**Plan 04 should flag:** any NEW consumer that reads `result.suggestions` for UI rendering after this plan ships.

---

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 2.1 — Stage 11 rebuild (Gemini, always-on, discriminated schema) | `9cb691b` | `stage11-counterfactuals.ts`, `stage11-counterfactuals-prompts.ts`, `types.ts`, `__tests__/stage11-counterfactuals.test.ts`, `__tests__/factories.ts` |
| 2.2 — D-16 weights + videoContext threading + gemini.ts exports | `50e03f4` | `aggregator.ts`, `gemini.ts`, `gemini/cost.ts`, `__tests__/aggregator.test.ts` |
| 2.3 — SuggestionsSection + three-state chips + results-panel rewire | `b68ec5c` | `insights-section.tsx`, `signal-availability-chips.tsx`, `results-panel.tsx`, `__tests__/insights-section.test.tsx`, `__tests__/signal-availability-chips.test.tsx`, `__tests__/signal-chips.test.tsx` |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @testing-library/react missing from devDependencies**
- **Found during:** Task 2.3 (running component tests)
- **Issue:** `@testing-library/react` not installed in main repo `node_modules`. Component tests (`signal-chips.test.tsx`, new `insights-section.test.tsx`, `signal-availability-chips.test.tsx`) all fail with `Failed to resolve import "@testing-library/react"`. Pre-existing issue but blocks Task 2.3 completion.
- **Fix:** `pnpm add -D @testing-library/react 16.3.2` from main repo root
- **Files modified:** `package.json`, `pnpm-lock.yaml` (node_modules only — not tracked in worktree)
- **Commit:** inline with Task 2.3 (package.json change not committed separately — node_modules pattern)

**2. [Deviation - Field names] HookDecomposition + GeminiAudioSignals not on PredictionResult**
- **Found during:** Task 2.1 implementation
- **Issue:** Plan's `<interfaces>` section showed `hook_decomposition`, `audio_signals`, `matched_trends` as PredictionResult fields, but they didn't exist on the type. buildSignalContextUserMessage needed to reference these.
- **Fix:** Added optional `hook_decomposition?: HookDecomposition | null`, `audio_signals?: GeminiAudioSignals | null`, `matched_trends?: Array<{...}>` to PredictionResult. Using `as Record<string, unknown>` casts in prompt builder for safe access.
- **Files modified:** `types.ts`
- **Commit:** 9cb691b

**3. [Deviation - D-24] signal-chips.test.tsx updated for D-30 three-state behavior**
- **Found during:** Task 2.3 (running component tests)
- **Issue:** Pre-existing `signal-chips.test.tsx` was already broken (missing `@testing-library/react`). After fixing the dependency, tests failed because the three-state D-30 rebuild changed the chip behavior (false → ⚠ not ✕ for non-disabled signals; ml/retrieval always ✕ from DISABLED_THIS_PHASE).
- **Fix:** Updated `signal-chips.test.tsx` to reflect new three-state semantics (D-24 test update).
- **Files modified:** `src/components/app/simulation/__tests__/signal-chips.test.tsx`
- **Commit:** b68ec5c

---

## Known Stubs

None — all artifacts contain real data (live Gemini model IDs from Plan 01 self-test, actual D-16 weights, real signal availability logic).

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: prompt_injection | `stage11-counterfactuals-prompts.ts` | T-13-06: result.reasoning (DeepSeek output) injected verbatim into Gemini prompt. Mitigated: server-derived only (no raw user input post-D-11 caption demotion). |
| threat_flag: financial_dos | `stage11-counterfactuals.ts` | T-13-08: Stage 11 Gemini 3.1 Pro call has 30s PER_CALL_TIMEOUT_MS + single retry + Sentry on failure. ~$0.13 expected per call. |

---

## Self-Check: PASSED

- [x] `src/lib/engine/stage11-counterfactuals.ts` exists and contains `GoogleGenAI`: FOUND
- [x] `src/lib/engine/stage11-counterfactuals-prompts.ts` exists and contains `z.discriminatedUnion`: FOUND
- [x] `src/lib/engine/aggregator.ts` contains `behavioral:   0.40`: FOUND
- [x] `src/lib/engine/gemini.ts` exports VIDEO_POLL_TIMEOUT_MS, VIDEO_POLL_INTERVAL_MS, VIDEO_MAX_SIZE_BYTES, EXT_TO_MIME (5 symbols): FOUND (5 export lines)
- [x] `src/components/app/simulation/insights-section.tsx` contains `HEADER_BY_BAND`: FOUND
- [x] `src/components/app/simulation/results-panel.tsx` contains `result.counterfactuals.suggestions`: FOUND
- [x] Commits 9cb691b, 50e03f4, b68ec5c exist in git log: VERIFIED
- [x] 14 stage11 tests + 45 aggregator tests + 11 cost tests + 31 simulation component tests = 101 tests passing: VERIFIED
