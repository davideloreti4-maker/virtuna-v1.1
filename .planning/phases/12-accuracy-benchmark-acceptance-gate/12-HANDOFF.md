# Phase 12 Handoff — Accuracy Benchmark + Acceptance Gate

**Written:** 2026-05-21
**Context:** Executing the final phase of the Engine Foundation milestone. Worker (DeepSeek) got stuck on DeepSeek API reliability issues. Need Sonnet to continue.

---

## What's Done

### ✅ Plan 12-01: Platt Training + Prep (COMPLETE)

**Platt params trained and persisted:**
- a=-3.5358, b=-4.6587, sample_count=79
- Row written to `platt_parameters` table in Supabase
- Used `--max-rows 80` (not full 225) due to ~50s/row API latency

**Tests pass:** 1191 passed, 0 failures (88 files, 4 skipped)

**Phase 11 readiness:** All 5 plans executed. Remaining human-verify UI items (signal chips, data disclosure, settings toggle, goal recheck banner) acknowledged as non-blocking for benchmark.

**Output:** `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-01-SUMMARY.md`

---

### ✅ Plan 12-02 Task 1: --max-rows flag (COMPLETE)

Added `--max-rows <N>` CLI flag to `scripts/eval.ts` and `eval-args.ts`. Verified:
```ts
parseEvalArgs(['--corpus-version', 'full.2026-05-11', '--max-rows', '25']) // → maxRows: 25
parseEvalArgs(['--corpus-version', 'full.2026-05-11']) // → maxRows: undefined
```

**Files changed:**
- `src/lib/engine/corpus/cli/eval-args.ts` — added `maxRows` to `EvalArgs` interface, parsing, help text
- `scripts/eval.ts` — threaded `maxRows` to `runEvalHarness`

---

### ❌ Plan 12-02 Task 2: v2.1 Rebaseline (BLOCKED — DeepSeek API hangs)

**Issue:** DeepSeek API at `api.deepseek.com` (IP: 3.173.21.63) has a systemic issue where HTTP connections establish but never complete. No timeout mechanism can kill them:
- `AbortController.signal` — JS promise aborts but underlying TCP connection stays open
- `openai` SDK `timeout` option — doesn't kill in-flight responses
- Native `fetch: globalThis.fetch` — same result
- Connection stays in `ESTABLISHED` state indefinitely with 0% CPU

**Attempts made:** 4 full-run attempts, all hung on row 1 or row 7 after ~2h stuck on a single DeepSeek call.

**Pragmatic conclusion:** The "v2.1 rebaseline" is also meaningless because the codebase has evolved. `measureV21Baseline()` uses `ENGINE_VERSION` from aggregator which is now `3.0.0-dev`, so it runs the exact same code as the v3 benchmark. The original Phase 1 baseline (macro_f1=0.294) is already saved in `.planning/research/v2.1-baseline.md` and `benchmark_results` table.

**Files reverted:**
- `src/lib/engine/corpus/eval-runner.ts` — reverted Promise.race timeout guard (ineffective, HTTP stays open)

---

### ⚠️ Plan 12-02 Task 3: v3 Smoke Run (PARTIAL — Gemini-only)

**25 rows processed with leave-one-out.** Niche detection failures cascaded into poor metrics.

**Results:**
```
macro_f1:             0.2095  (vs baseline 0.294, target 0.338)
ece:                  0.5407  (vs baseline 0.3715)
cost_cents_avg:       0.0537  ($0.0005/row — under budget)
latency_p50:          33.9s
latency_p95:          73.3s
```

**Why metrics are bad:**
- DeepSeek was forced off via invalid API key (`DEEPSEEK_API_KEY=force_gemini_fallback`)
- Niche detection (Wave 0) uses DeepSeek → failed on every row → no niche assigned
- Without niche, `retrieval_pool_too_small` → no retrieval evidence
- DeepSeek reasoning fell back to Gemini → cheaper but worse predictions
- Per-niche F1 only computed for "beauty" (default), all others 0

**Signal contribution (still meaningful):**
```
behavioral: -0.0056 ⚠️ (slightly negative)
gemini:     +0.1817 ✓
ml:         +0.0903 ✓
rules:      +0.1817 ✓
trends:     +0.0903 ✓
```

**Output:** `.planning/research/smoke-v3.json`

---

## Code Changes Made (Unreverted)

### `src/lib/engine/deepseek.ts` — 3 changes:
1. `maxRetries: 0` added to OpenAI constructor
2. `fetch: globalThis.fetch` added to OpenAI constructor
3. `timeout: TIMEOUT_MS` (currently 20_000ms) added to OpenAI constructor
4. `TIMEOUT_MS` reduced from 90_000 to 20_000

**CURRENT STATE:** `DEEPSEEK_API_KEY` in `.env.local` is the real key (`sk-7c4e6a6cf1bb4ef3a6b365efc2ac9e00`). The 20s timeout + native fetch + maxRetries=0 changes are still in the code. They're improvements (shouldn't break anything), but the timeout may not actually help with the hanging issue.

### `src/lib/engine/corpus/cli/eval-args.ts` — `--max-rows` flag (keep)
### `scripts/eval.ts` — `maxRows` threading (keep)

---

## What the Worker Should Do Next

### 1. Restore `TIMEOUT_MS` to 90_000
The 20s timeout is too aggressive for DeepSeek reasoning. Revert to 90s (line 21 of deepseek.ts).

### 2. Run the Full 225-Row Benchmark with Proper DeepSeek
Key insight: DeepSeek hangs are INTERMITTENT. The first few rows of each attempt always succeeded before the hang. Strategy:
- Use real `DEEPSEEK_API_KEY` from `.env.local`
- Run in **batches of 25 rows** with `gtimeout 900` (15 min per batch)
- If a batch hangs, `gtimeout` kills the OS process → TCP connections cleaned up
- If a batch succeeds, continue to next batch
- Use `--max-rows 25 --output batch-N.json` per batch
- After all batches, aggregate reports

Or better: run the full 225-row benchmark direct with `gtimeout 14400` (4h). If DeepSeek is stable now, it'll complete. The native fetch + maxRetries=0 changes help.

### 3. Run the v2.1 Rebaseline (Optional)
If you want an apples-to-apples comparison, the rebaseline runs the same way but needs to be on the SAME code version. The current code won't produce v2.1 results.

### 4. Gate Evaluation (Plan 12-03)
When you have valid numbers:
- Compare macro_f1 against target (original baseline × 1.15 = 0.338 required for 0.294 baseline)
- Check BENCH-06 (no negative signal contributions — behavioral at -0.0056 is a concern)
- Flip ENGINE_VERSION from `3.0.0-dev` to `3.0.0` in `src/lib/engine/version.ts`
- Generate summary report at `.planning/baseline-report-v3.md`
- Present for user sign-off

### 5. Sign-Off
User reviews benchmark report. If passes, merge milestone/engine-foundation.

---

## Key Files
| File | Purpose |
|------|---------|
| `.planning/ROADMAP.md` §280 | Phase 12 definition |
| `.planning/REQUIREMENTS.md` §215 | BENCH-01..06 |
| `12-CONTEXT.md` | Discuss-phase decisions (D-01..D-08) |
| `12-RESEARCH.md` | Research findings |
| `12-01-SUMMARY.md` | Plan 01 results |
| `12-01-PLAN.md` | Plan 01 details |
| `12-02-PLAN.md` | Plan 02 details |
| `12-03-PLAN.md` | Plan 03 details |
| `.planning/research/smoke-v3.json` | Smoke run results (25 rows LOO) |
| `.planning/research/v2.1-baseline.md` | Original v2.1 baseline |
| `src/lib/engine/deepseek.ts` | Modified: timeout, fetch, maxRetries |
| `src/lib/engine/version.ts` | ENGINE_VERSION = "3.0.0-dev" |

---

## Closing Note — Superseded by Phase 13 (added 2026-05-24)

Phase 12 (text-mode benchmark + accuracy gate) was superseded as the milestone acceptance gate by Phase 13: Real Pipeline Validation + Production Hardening.

**Kept artifacts from Phase 12:**
- `--max-rows` flag in `scripts/eval.ts` (utility — kept for future text-mode evals)
- `platt_parameters` DB row (flagged "text-mode-trained, video-mode re-train pending" — M2 owns retraining)
- All `12-*.md` planning artifacts (historical record)

**Discarded:**
- `.planning/research/smoke-v3.json` — invalid test fixture (force-disabled DeepSeek + text-mode; not representative of v3)

**Forward reference:**
- Phase 13's final acceptance: `.planning/phases/13-real-pipeline-validation-production-hardening/13-FINAL-VALIDATION-REPORT.md`
- `ENGINE_VERSION` flipped to `"3.0.0"` per Phase 13 D-27 + D-28 (commit `791a577`)
- Milestone `engine-foundation` to be merged to main per worktree merge protocol (`~/.claude/rules/gsd-worktree.md`)
