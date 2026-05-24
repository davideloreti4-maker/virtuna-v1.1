# Phase 10: ML Audit + Calibration + Aggregator Extension - Research

**Researched:** 2026-05-20
**Domain:** ML classifier evaluation, Platt calibration, aggregator weight tuning
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Reuse `eval-harness.ts` + `eval-runner.ts` for ML audit. New script: `src/lib/engine/corpus/cli/ml-audit.ts` runs only the `ml.ts` classifier path, computes accuracy/confusion matrix, writes report to `.planning/research/ml-audit-report.md`.
- **D-02:** Decision encoded as a manual code change to a constant in `aggregator.ts`.
- **D-03:** Down-weight = reduce `ml` value in `SCORE_WEIGHTS` (e.g., 0.15 → 0.05). `selectWeights()` redistribution absorbs freed weight automatically.
- **D-04:** Retrain weights committed to repo as JSON file following `calibration-baseline.json` pattern. Loaded at startup. No DB dependency on hot path.
- **D-05:** Disable = set `ml` in `SCORE_WEIGHTS` to `0` and `SignalAvailability.ml = false` in aggregator construction. No code removal.
- **D-06:** One-shot CLI `src/lib/engine/corpus/cli/train-platt.ts` fetches prediction/outcome pairs from `training_corpus`, calls `fitPlattScaling()`, stores to `platt_parameters` DB table. Same CLI pattern as `calibrate-thresholds.ts`.
- **D-07:** Calibrates `overall_score` vs corpus actual outcomes (viral/average/underperforming).
- **D-08:** Parameters stored in `platt_parameters` DB table. If table doesn't exist, Phase 10 creates it. Schema: `(id, a, b, fitted_at, sample_count)`. `is_calibrated: true` flips when `getPlattParameters()` returns non-null.
- **D-09:** Tune `retrieval` (0.05) and `platform_fit` (0.05) weights via corpus signal ablation. Document final values + rationale in `.planning/research/weight-calibration-report.md`.
- **D-10:** Persona aggregate stays under `behavioral` key (0.35 weight). No key rename.
- **D-11:** `hook_decomp` remains informational-only; not weight-bearing.
- **D-12:** `ENGINE_VERSION` stays at `3.0.0-dev` this phase. Do NOT touch `version.ts`.

### Claude's Discretion

- Final numeric values for tuned `retrieval` and `platform_fit` weights — planner picks values that maximize corpus accuracy improvement, documents in `weight-calibration-report.md`.
- Whether to create `platt_parameters` DB table via Supabase migration or confirm it already exists.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ML-01 | Run existing ML classifier against corpus benchmark — measure current accuracy | `ml-audit.ts` CLI uses `eval-runner.ts` with ML-only scoring path |
| ML-02 | Accuracy report with current weight (0.15) impact analysis — does ML signal help or hurt? | LOO analysis pattern from `eval-harness.ts` SIGNALS/scoreWithoutSignal |
| ML-03 | Decision: retrain on corpus, down-weight, or disable signal | Manual code edit to `SCORE_WEIGHTS.ml` in `aggregator.ts` |
| ML-04 | Platt calibration training on corpus predictions vs actual outcomes | `fitPlattScaling()` already implemented; CLI calls it with corpus pairs |
| ML-05 | `is_calibrated` flag flips to `true` for predictions where calibration applies | `getPlattParameters()` already wired in aggregator at line ~846; needs DB read path added |
| ML-06 | ML weights file regenerated if retrained (commit to repo) | `trainModel()` + `stratifiedSplit()` exist in `ml.ts`; commit JSON following `calibration-baseline.json` |
| AGG-01 | `SignalAvailability` extended with new signals — personas, audio, retrieval, hook, algo-fit | All 5 already present in `types.ts`; Phase 10 confirms coverage / adds `ml_classifier` disable key if needed |
| AGG-02 | Dynamic weight redistribution rules updated for new signals | `selectWeights()` in aggregator already normalizes; SCORE_WEIGHT_KEYS needs `platform_fit` promoted from optional handling |
| AGG-03 | Engine version bumped to `v3.0.0` in `ENGINE_VERSION` constant | CONFLICT — D-12 says stay at `3.0.0-dev`; version.ts comment confirms Phase 12 owns the flip |
| AGG-04 | `PredictionResult` schema extended with new fields | Already extended across Phases 5-9; Phase 10 verifies all new fields present |
| AGG-05 | Existing tests pass without modification | 1170 tests currently passing (not 203) |
| AGG-06 | New aggregator tests cover dynamic redistribution with new signals | New test file covering weight sums with all 8 signals present/absent |
</phase_requirements>

---

## Summary

Phase 10 has three coupled tasks: ML audit + decision, Platt calibration training, and aggregator weight rebalancing. All required code infrastructure already exists in the codebase from prior phases. The primary net-new work is two CLI scripts (`ml-audit.ts`, `train-platt.ts`), one Supabase migration (`platt_parameters` table), and weight constant edits in `aggregator.ts`.

**Critical findings from codebase inspection:**

1. **`platt_parameters` DB table does NOT exist.** The current `getPlattParameters()` fits Platt scaling in-memory from the `outcomes` table on every cache miss — there is no persistent `platt_parameters` table anywhere in migrations, `database.types.ts`, or source. D-08 confirms Phase 10 must create it AND update `getPlattParameters()` to read from it (instead of recomputing every 24h from raw outcomes).

2. **Test count discrepancy resolved.** ROADMAP says "203 existing tests" (Phase 1 artifact — stale). STATE.md Phase 3 says "549/0" — also stale. Actual current count: **1170 tests passing** (verified via `npx vitest run`). AGG-05 criterion should read 1170, not 203.

3. **ENGINE_VERSION conflict resolved.** ROADMAP SC#6 says "bump to 3.0.0". `version.ts` line 6 says `"3.0.0-dev"` with comment "Phase 12's acceptance gate flips". CONTEXT.md D-12 confirms: **do not touch `version.ts` in Phase 10.** AGG-03 is OUT OF SCOPE this phase.

4. **AGG-01 is largely complete.** `SignalAvailability` in `types.ts` already includes `personas`, `audio`, `audio_fingerprint`, `retrieval`, `platform_fit`. All are already wired in the aggregator. What remains: confirm `ml_classifier` boolean key for the disable-path (D-05), and verify `audio`, `retrieval`, `platform_fit` are promoted from `optional` to required in the type if Phase 10 uses them unconditionally.

5. **Calibration-audit cron does NOT persist to DB.** It re-fits Platt params in memory and invalidates the cache — but writes nothing to Supabase. The `train-platt.ts` CLI must be the first code to write to the new `platt_parameters` table, and `getPlattParameters()` must be updated to prefer DB read over in-memory recomputation.

**Primary recommendation:** Three sequential plans — Plan A (ML audit CLI + decision), Plan B (Platt table migration + train CLI + runtime update), Plan C (aggregator weight tuning + new tests). Plans A and B can run in parallel since they touch different files; Plan C depends on both to read corpus signals accurately.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ML accuracy measurement | CLI / corpus layer | — | One-shot eval script; not runtime |
| ML weight decision | Aggregator constants | — | `SCORE_WEIGHTS.ml` edit; `selectWeights()` redistributes |
| Platt parameter storage | Database (Supabase) | In-memory cache | Persist fitted A/B; cache for 24h TTL |
| Platt calibration training | CLI / corpus layer | — | One-shot script; runs after audit |
| Platt application at runtime | Aggregator | calibration.ts | Already wired at aggregator line ~846 |
| Signal ablation / weight tuning | CLI / corpus layer | Aggregator constants | Run eval harness with/without signals; edit constants |
| New aggregator tests | Test layer | — | Vitest unit tests; no DB needed |

---

## Standard Stack

### Core (all already installed — no new packages needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Vitest | existing | Test runner — `npm test` | In use |
| tsx | existing | Run TypeScript CLI scripts | In use (calibrate-thresholds.ts pattern) |
| @supabase/supabase-js | existing | DB client for migration + CLI writes | In use |
| dotenv | existing | `.env.local` loading in CLI scripts | In use |
| tsconfig-paths | existing | `@/` alias resolution in CLI scripts | In use |

[VERIFIED: codebase grep — all packages already in package.json via existing scripts]

**No new npm installs required for Phase 10.**

---

## Architecture Patterns

### System Architecture Diagram

```
corpus (training_corpus table, 225 rows)
       |
       v
[ml-audit.ts CLI]
  runs eval-runner.ts (text-mode, ML signal only)
  computes: accuracy, confusion matrix, LOO delta
       |
       v
.planning/research/ml-audit-report.md
       |
       v
[Developer reads report — manual decision]
       |
      / \
     /   \
[retrain] [down-weight] [disable]
trainModel()   edit       edit
→ ml-weights.json  SCORE_WEIGHTS.ml  SCORE_WEIGHTS.ml=0
commit JSON        e.g. 0.05         + ml=false in
                                     availability{}
```

```
[train-platt.ts CLI]
  fetch training_corpus rows
  run aggregateScores() per row → overall_score (predicted)
  pair with bucket (actual, mapped to 0/1 probability)
  call fitPlattScaling(pairs) → PlattParameters {a, b}
  INSERT INTO platt_parameters (a, b, fitted_at, sample_count)
       |
       v
[getPlattParameters() — updated runtime path]
  cache hit → return PlattParameters from cache
  cache miss → SELECT from platt_parameters (latest row)
              → cache 24h TTL → return
       |
       v
[aggregateScores()] line ~846
  plattParams = await getPlattParameters()
  overall_score = applyPlattScaling(rawScore, plattParams)
  is_calibrated = plattParams !== null
```

### Recommended Project Structure (new files only)

```
src/lib/engine/corpus/cli/
├── ml-audit.ts          # NEW — ML classifier audit + confusion matrix
└── train-platt.ts       # NEW — Platt param training → DB write

supabase/migrations/
└── 20260520XXXXXX_phase10_platt_parameters.sql  # NEW — platt_parameters table

.planning/research/
├── ml-audit-report.md          # NEW — ML accuracy report (committed)
└── weight-calibration-report.md # NEW — weight ablation rationale (committed)
```

### Pattern 1: CLI Script (follow calibrate-thresholds.ts)

```typescript
// Source: src/scripts/calibrate-thresholds.ts (established pattern)
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ... } = require("../src/lib/engine/...");
```

[VERIFIED: inspected `scripts/calibrate-thresholds.ts` — this is the exact boilerplate for all corpus CLI scripts]

### Pattern 2: ML Audit Against Corpus

The ML audit script uses the EXISTING `scoreWithoutSignal` / leave-one-out infrastructure in `eval-harness.ts`. However, for a focused ML-only audit it should:

1. Run `runEvalOverCorpus()` to get per-row `signalScores.ml` values
2. Compare `predicted_bucket` (using only ml score) vs `actual_bucket`
3. Compute accuracy + confusion matrix inline

The simplest path: run eval with `leaveOneOut: false` (standard run), then separately compute LOO delta by calling `scoreWithoutSignal` for the `ml` signal key. SIGNALS in `leave-one-out.ts` already contains `"ml"`.

[VERIFIED: `src/lib/engine/corpus/metrics/leave-one-out.ts` — SIGNALS exports `"ml"` as a key]

### Pattern 3: Platt Parameters DB Table Schema

```sql
-- Minimal schema matching PlattParameters type in calibration.ts
CREATE TABLE platt_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a DOUBLE PRECISION NOT NULL,
  b DOUBLE PRECISION NOT NULL,
  fitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: no user owns Platt params — service-role write only
ALTER TABLE platt_parameters ENABLE ROW LEVEL SECURITY;
-- No SELECT policy needed for anon; service role bypasses RLS.
```

[ASSUMED] — schema above matches `PlattParameters` interface in `calibration.ts` (fields: `a`, `b`, `fittedAt`, `sampleCount`). Column names translate camelCase → snake_case per Supabase convention.

### Pattern 4: Updated getPlattParameters() Runtime Path

**Current behavior:** Recomputes from `outcomes` table every 24h cache miss.

**Required behavior after Phase 10:** On cache miss, SELECT latest row from `platt_parameters` table. This is a non-trivial change to `calibration.ts` — the planner must include a task to update `getPlattParameters()`.

```typescript
// NEW path (illustrative — replace outcomes computation with DB read):
const { data } = await supabase
  .from("platt_parameters")
  .select("a, b, fitted_at, sample_count")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

const params: PlattParameters | null = data
  ? { a: data.a, b: data.b, fittedAt: data.fitted_at, sampleCount: data.sample_count }
  : null;
```

[VERIFIED: inspected full `calibration.ts` — no `platt_parameters` table read exists; current code recomputes from `outcomes` table]

### Pattern 5: SCORE_WEIGHTS ML Disable (D-05)

```typescript
// In aggregator.ts — two-part change:
// 1. Set weight to 0
export const SCORE_WEIGHTS = {
  // ...
  ml: 0,  // D-05: disabled after Phase 10 audit; set SignalAvailability.ml = false below
  // ...
} as const;

// 2. Force ml availability to false in aggregateScores()
const availability: SignalAvailability = {
  // ...
  ml: false,  // D-05: override even if predictWithML() returns a value
  // ...
};
```

[VERIFIED: `aggregator.ts` lines 684-729 — availability object constructed manually; ml key at line 689 currently uses `mlAvailable` from `predictWithML()`]

### Anti-Patterns to Avoid

- **Skipping `getPlattParameters()` update:** The CLI writes to `platt_parameters` table, but if `getPlattParameters()` still reads from `outcomes` table, the runtime path never uses the newly trained params. Both sides must be updated in the same plan.
- **Touching `version.ts`:** D-12 and the `version.ts` comment explicitly reserve the flip for Phase 12. Any edit to this file in Phase 10 is wrong.
- **Adding `hook_decomp` to SCORE_WEIGHT_KEYS:** D-11 confirms it's informational-only. Double-counting would inflate gemini signal.
- **Writing SCORE_WEIGHTS with values that sum to exactly 1.0 after edits:** `selectWeights()` normalizes automatically. Hand-tuning to sum=1.0 is brittle — let the normalizer do it.
- **Running eval harness without a rate-limit delay:** `EvalRunnerOptions.rateLimitDelayMs` defaults to 2000ms. Omitting it causes API rate-limit failures on 225+ corpus rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platt scaling fit | Custom logistic regression | `fitPlattScaling()` in `calibration.ts` | Already implemented with gradient descent, epsilon clipping, 1000 iterations |
| Weight normalization | Manual redistribution math | `selectWeights()` in `aggregator.ts` | Normalizes any subset correctly; tested in `aggregator.test.ts` |
| Corpus iteration | Custom DB loop | `runEvalOverCorpus()` in `eval-runner.ts` | Handles pagination, cost cap, rate limiting |
| LOO signal ablation | Custom signal-drop logic | `scoreWithoutSignal()` in `leave-one-out.ts` | Already covers all 5 base signals including `ml` |
| Confusion matrix | Custom matrix math | Extend `ml.ts` `evaluate()` function | Already computes `confusionMatrix: number[][]` |

---

## Critical Conflicts Resolved

### CONFLICT: AGG-03 ENGINE_VERSION

**ROADMAP SC#6:** "ENGINE_VERSION bumped to `3.0.0`"
**CONTEXT.md D-12:** "ENGINE_VERSION stays at `3.0.0-dev` this phase"
**`version.ts` line 6:** `export const ENGINE_VERSION = "3.0.0-dev";` with comment "Phase 12's acceptance gate flips 3.0.0-dev → 3.0.0"

**Resolution:** D-12 wins. AGG-03 is out of scope for Phase 10. The planner MUST NOT include any task touching `version.ts`. The ROADMAP SC#6 was written before D-12 was locked in discussion.

### CONFLICT: AGG-05 Test Count

**ROADMAP SC:** "203 existing tests"
**Phase 3 STATE:** "549/0 tests"
**Actual (verified 2026-05-20):** **1170 tests passing, 0 failing**

**Resolution:** Use 1170 as the baseline. All plans must maintain 1170+ tests passing.

### FINDING: platt_parameters Table Missing

**CONTEXT.md D-08:** "If the table doesn't exist yet, Phase 10 creates it"
**Verified:** No migration, no DB type, no source reference to `platt_parameters` table exists anywhere in the codebase. The table must be created.

**Impact:** Phase 10 needs a Supabase migration AND a `getPlattParameters()` runtime update — this is more work than the CONTEXT implies (which assumes the runtime path just reads from the table). The current runtime re-fits from `outcomes` table; after Phase 10 it should SELECT from `platt_parameters`.

---

## Common Pitfalls

### Pitfall 1: `getPlattParameters()` Not Updated
**What goes wrong:** `train-platt.ts` writes A/B to DB, but runtime still recomputes from `outcomes` table on cache miss. `is_calibrated` stays false or uses stale params.
**Why it happens:** CONTEXT.md says "Runtime path unchanged" — misleading. The runtime path does NOT currently read from `platt_parameters` table (it doesn't exist). "Unchanged" means the `getPlattParameters()` function signature and call site don't change — but its internals must be updated.
**How to avoid:** Plan B must include a task to update `getPlattParameters()` body to SELECT from `platt_parameters` with ORDER BY created_at DESC LIMIT 1.
**Warning signs:** After running `train-platt.ts`, check `is_calibrated` in a test prediction — if still false, runtime path wasn't updated.

### Pitfall 2: `SCORE_WEIGHT_KEYS` Not Updated When Promoting Optional Keys
**What goes wrong:** `platform_fit` is declared as `optional` in `SignalAvailability`. If the `hasOwnProperty` check in `selectWeights()` fires `platformFitInInput = false` because the key is absent from a test fixture, the weight is silently excluded from math.
**Why it happens:** Phase 9 added `platform_fit` as optional for back-compat. All Phase 10 aggregator tests must construct `SignalAvailability` objects that include the key explicitly.
**How to avoid:** In new AGG-06 tests, always include `platform_fit: true/false` explicitly in the availability object.

### Pitfall 3: ML Audit Using Wrong Input Mode
**What goes wrong:** The corpus eval runner uses `input_mode: "text"` (text-mode). The ML classifier reads from `FeatureVector` which is assembled from `pipelineResult`. Text-mode pipelines produce a different feature vector than video-mode pipelines — `completion_pct` is null, audio signals absent, retrieval evidence thinner.
**Why it happens:** 222/225 corpus videos are on disk but video-mode eval is deferred (Supabase free-tier storage limit — see STATE.md pending todos).
**How to avoid:** ML audit report must note the text-mode limitation explicitly. Accuracy numbers reflect text-mode corpus eval, not live video analysis.

### Pitfall 4: Platt Training Pairs — What "Actual" Means
**What goes wrong:** `fitPlattScaling()` expects `OutcomePair[]` where `actual` is 0-1. Corpus `bucket` values are `'viral' | 'average' | 'underperforming'`. Naive mapping (`viral=1`, others=0) for binary Platt is correct for binary calibration, but multi-class (3 buckets) is different.
**Why it happens:** Existing `fitPlattScaling()` is binary (viral vs not). The CONTEXT says "calibrates `overall_score` vs actual corpus outcomes (viral/average/underperforming)" — this implies binary (viral=1, non-viral=0) or ordinal mapping.
**How to avoid:** `train-platt.ts` must map buckets: `viral → 1.0`, `average → 0.5`, `underperforming → 0.0` for ordinal; OR `viral → 1.0`, else → `0.0` for binary. Binary is simpler and consistent with existing `fitPlattScaling()` design (cross-entropy on 0/1 targets). Document choice in training CLI.

### Pitfall 5: Cost Cap During ML Audit
**What goes wrong:** Running full corpus eval (225 rows) for the ML audit incurs ~$0.33 LLM cost (v2.1 baseline was 32.99 cents). If Phase 10 runs multiple ablation passes (retrieval on/off, platform_fit on/off), costs multiply.
**Why it happens:** Each eval runner call runs the full pipeline per row.
**How to avoid:** Use `maxTotalCostCents` option in `RunEvalHarnessOptions`. LOO signal ablation (`scoreWithoutSignal`) computes from stored `signalScores` without re-running — it's near-zero cost since the LOO function is pure-math on top of existing scores. Only the INITIAL eval run costs money.

---

## Runtime State Inventory

Not applicable — this is not a rename/refactor phase. No stored state needs migration other than the new `platt_parameters` table (net-new, not a rename).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (remote) | platt_parameters migration | ✓ | Managed | Apply via Studio SQL editor (established pattern from Phase 2) |
| tsx | CLI scripts | ✓ | via package.json | — |
| .env.local | CLI Supabase credentials | ✓ | present | — |
| Corpus data (training_corpus) | ML audit + Platt training | ✓ | 225 rows (full.2026-05-11) | — |

No missing dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=aggregator` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ML-01 | ML audit CLI produces report | manual | Run `npx tsx scripts/ml-audit.ts` — check `.planning/research/ml-audit-report.md` written | ❌ Wave 0 |
| ML-02 | LOO delta for ml signal computed | unit | `npm test -- --testPathPattern=leave-one-out` | ✅ (existing) |
| ML-03 | Weight/disable change applied | unit | `npm test -- --testPathPattern=aggregator` | ✅ (existing) |
| ML-04 | `train-platt.ts` fits params and writes to DB | manual + unit | `fitPlattScaling` unit test in `calibration.test.ts` already covers the function; DB write is integration-only | ✅ / ❌ Wave 0 (DB write test) |
| ML-05 | `is_calibrated: true` when platt params non-null | unit | `npm test -- --testPathPattern=aggregator` (existing calibration mock tests) | ✅ (existing) |
| ML-06 | Retrained weights JSON loaded correctly | unit | `npm test -- --testPathPattern=ml` | ✅ (existing) |
| AGG-01 | All signal keys in SignalAvailability | unit | `npm test -- --testPathPattern=aggregator` | ✅ (existing) |
| AGG-02 | Weight redistribution correct with 8 signals | unit | new test in `aggregator-phase10.test.ts` | ❌ Wave 0 |
| AGG-04 | PredictionResult fields present | unit | `npm test -- --testPathPattern=aggregator` | ✅ (existing) |
| AGG-05 | All 1170 tests pass | unit | `npm test` | ✅ |
| AGG-06 | New redistribution tests | unit | `npm test -- --testPathPattern=aggregator-phase10` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=aggregator`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite (1170+) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/engine/corpus/cli/ml-audit.ts` — empty file to satisfy import (implementation is plan body)
- ~~`src/lib/engine/corpus/cli/train-platt.ts` — empty file scaffold~~ (removed: Plan 02 creates it fully; no test depends on it during Wave 0)
- [ ] `src/lib/engine/__tests__/aggregator-phase10.test.ts` — AGG-02 + AGG-06 test file
- [ ] `supabase/migrations/20260520XXXXXX_phase10_platt_parameters.sql` — migration for platt_parameters table

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CLI scripts run locally; no auth surface |
| V3 Session Management | no | — |
| V4 Access Control | yes | `platt_parameters` table: service-role writes only; no anon SELECT needed (same pattern as `training_corpus`) |
| V5 Input Validation | yes | `train-platt.ts` must validate bucket values before mapping to 0/1; clamp input to `fitPlattScaling` |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corpus row injection (malicious caption) | Tampering | Text-mode eval uses caption as LLM input; existing prompt-injection mitigations in pipeline apply |
| Uncapped Platt `a`/`b` params causing score overflow | Tampering | `applyPlattScaling()` already clamps output to `[0, 100]` — verified in calibration.ts |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS, SCORE_WEIGHT_KEYS, selectWeights(), SignalAvailability construction, getPlattParameters() call site
- `src/lib/engine/calibration.ts` — fitPlattScaling(), applyPlattScaling(), getPlattParameters() (reads from `outcomes` table, not `platt_parameters`)
- `src/lib/engine/ml.ts` — trainModel(), stratifiedSplit(), predictWithML(), ModelWeights interface
- `src/lib/engine/types.ts` — SignalAvailability interface (lines 241-281)
- `src/lib/engine/corpus/eval-harness.ts` — BenchmarkReport, RunEvalHarnessOptions, leaveOneOut pattern
- `src/lib/engine/corpus/eval-runner.ts` — runEvalOverCorpus(), text-mode evaluation pattern
- `src/lib/engine/corpus/metrics/leave-one-out.ts` — SIGNALS tuple, scoreWithoutSignal()
- `src/lib/engine/version.ts` — ENGINE_VERSION = "3.0.0-dev" with Phase 12 comment
- `scripts/calibrate-thresholds.ts` — CLI script boilerplate pattern
- `supabase/migrations/` — no platt_parameters migration found (confirmed absent)
- `npx vitest run` output — 1170 tests passing (verified 2026-05-20)

### Secondary (MEDIUM confidence)
- `src/app/api/cron/calibration-audit/route.ts` — confirms Platt fit does not persist to DB (only invalidates cache)
- `src/app/api/cron/retrain-ml/route.ts` — ML retrain infrastructure (trainModel, stratifiedSplit pattern)
- `.planning/phases/10-ml-audit-calibration-aggregator-extension/10-CONTEXT.md` — locked decisions

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `platt_parameters` DB table schema should use snake_case column names (`fitted_at`, `sample_count`) mapping to camelCase `PlattParameters` interface | Architecture Patterns — Pattern 3 | Migration compiles fine; TypeScript read path needs explicit column mapping in `getPlattParameters()` |
| A2 | Binary Platt mapping (`viral=1.0`, others=`0.0`) is correct for `fitPlattScaling()` | Pitfall 4 | If ordinal is needed, the gradient descent formula stays the same but `actual` values change — only report numbers differ |
| A3 | `SCORE_WEIGHT_KEYS` tuple does not need editing for Phase 10 | Architecture Patterns | If a new weight-bearing key is added (none locked in D-01–D-12), the tuple must be updated |

---

## Open Questions (RESOLVED)

1. **What `corpus_version` string should ml-audit and train-platt use?**
   - What we know: `full.2026-05-11` is the sealed canonical version (D-13 in STATE.md)
   - What's unclear: Should the planner hardcode this or accept it as a CLI arg?
   - Recommendation: Accept as `--version` CLI arg (matching `calibrate-thresholds.ts` pattern); document that `full.2026-05-11` is the correct value for Phase 10 runs

2. **Does `trainModel()` in `ml.ts` accept the `training_corpus` table directly, or does it need `training-data.json`?**
   - What we know: `ml.ts` loads from `training-data.json` (TRAINING_DATA_PATH) at startup; `retrain-ml/route.ts` fetches from `scraped_videos` table (not `training_corpus`)
   - What's unclear: For corpus-based retraining (D-04), does `train-platt.ts` need to build a parallel training-data JSON from `training_corpus` rows, or call `trainModel()` with a new data source?
   - Recommendation: If the decision is retrain, the plan should build a corpus-derived `ml-weights-corpus.json` using `extract-training-data.ts` pattern, then pass it to `trainModel()`. Out of scope unless audit says retrain.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in codebase
- Architecture: HIGH — inspected all canonical source files
- Pitfalls: HIGH — derived from direct code inspection (not assumptions)
- DB schema: MEDIUM — `platt_parameters` schema is inferred from `PlattParameters` interface; actual column types need verification on write

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (30 days — stable codebase, no fast-moving dependencies)
