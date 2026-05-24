# Phase 1: Training Corpus & Eval Foundation - Pattern Map

**Mapped:** 2026-05-11
**Phase:** 1 — Training Corpus & Eval Foundation
**Files analyzed:** 12 new files/groups across 6 new locations
**Analogs found:** 12 / 12 (all have strong analogs in repo)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/engine/corpus/bucketing.ts` | utility (pure) | transform | `src/lib/engine/calibration.ts` `computeECE` + `applyPlattScaling` | exact (same module, pure functions, threshold-driven) |
| `src/lib/engine/corpus/eval-config.ts` | config (const-export) | static | `src/lib/engine/aggregator.ts` `SCORE_WEIGHTS` + `ENGINE_VERSION` constants | exact |
| `src/lib/engine/corpus/eval-harness.ts` | service | batch | `scripts/benchmark.ts` `main()` + `src/lib/engine/calibration.ts` `generateCalibrationReport` | role-match (orchestrates pipeline over many inputs + persists) |
| `src/lib/engine/corpus/baseline.ts` | service | batch | `scripts/benchmark.ts` (full file) | exact (this is literally a baseline measurement loop) |
| `src/lib/engine/corpus/metrics.ts` | utility (pure) | transform | `src/lib/engine/calibration.ts` `computeECE` + `src/lib/engine/ml.ts` `evaluate` (confusion matrix, per-class precision/recall) | exact |
| `src/lib/engine/corpus/corpus-version.ts` | utility (pure / IO) | request-response | `src/lib/engine/ml.ts` `loadModel()` (cached + Supabase Storage) **OR** `src/lib/engine/calibration.ts` `getPlattParameters` (cached + DB query) | exact |
| `scripts/eval.ts` | script entry | CLI | `scripts/benchmark.ts` + `scripts/extract-training-data.ts` | exact (same `tsx scripts/*.ts` pattern, same dotenv+tsconfig-paths bootstrap) |
| `src/lib/scraping/corpus/` (new subdir) | service | request-response | `src/lib/scraping/apify-provider.ts` (provider class) + `src/app/api/cron/scrape-trending/route.ts` (hashtag-driven `client.actor().start()` with webhook) | exact (extend module, add a corpus-specific scrape config) |
| `src/app/api/cron/refresh-corpus/route.ts` | api / cron | request-response | `src/app/api/cron/refresh-competitors/route.ts` (closest: daily batch + per-item isolation + revalidate) and `src/app/api/cron/scrape-trending/route.ts` (fire-and-forget Apify start + webhook) | exact |
| `supabase/migrations/YYYYMMDDHHMMSS_training_corpus.sql` | migration | schema | `supabase/migrations/20260213000000_content_intelligence.sql` (`scraped_videos` schema — system-wide table, BIGINT counters, hashtag TEXT[], JSONB metadata) | exact (closer than the competitor migration suggested in CONTEXT — `scraped_videos` has matching public-read-no-write RLS, `corpus_version`-style version column already implied) |
| `supabase/migrations/YYYYMMDDHHMMSS_benchmark_results.sql` | migration | schema | `supabase/migrations/20260213000000_content_intelligence.sql` (`outcomes` table — predicted/actual numeric scores, deleted_at) + `analysis_results` (jsonb result columns) | exact (system-wide table, no user_id) |
| `.planning/research/v2.1-baseline.md` | docs | static | `.planning/codebase/STACK.md` + existing `.planning/phases/*/01-CONTEXT.md` style | exact (markdown sectioned doc) |

> **CONTEXT.md says** "supabase/migrations/20260216100000_competitor_tables.sql" is the closest schema analog. After reading both, **`20260213000000_content_intelligence.sql` is a strictly better analog** for *both* new tables because:
> - It defines `scraped_videos` (system-wide, no `user_id`) — matches `training_corpus` system-wide RLS.
> - It defines `outcomes` (predicted_score/actual_score, deleted_at, score-as-NUMERIC(5,2)) — matches `benchmark_results` exactly.
> - The competitor migration is **user-scoped** with `auth.uid()` policies, which directly conflicts with the D-corollary "corpus is NOT user-scoped." See **Pitfalls** under each migration below.

---

## Pattern Assignments

### 1. `src/lib/engine/corpus/bucketing.ts` (utility, pure transform)

**Role:** Classify a corpus row into `"viral" | "average" | "under"` from per-niche absolute view thresholds. Pure function; D-11 explicitly says "TypeScript not SQL." D-13 says "thresholds are fixed-snapshot per corpus_version."

**Analog:** `src/lib/engine/calibration.ts` lines 114–176 (`computeECE`) and lines 275–293 (`applyPlattScaling`).

Why this is the analog: both are pure threshold/bin classifiers — `computeECE` bins a predicted score into one of N bins by checking range membership, `applyPlattScaling` maps a score through a parameterized rule. `bucketing.ts` does exactly the same shape: take a numeric (views) + a niche, look up a (viral_floor, under_ceiling) pair, return a label. Same file, same module, same import surface.

**Style to mirror:**
- No `createLogger` instance (pure functions). Same as `computeECE` / `applyPlattScaling` — neither calls the logger.
- Export each pure function as a named export. **Do not** wrap in a class.
- Use exact-equality `===` for the edge case (`>= floor` is viral, `<= ceiling` is under, else average) — matches D-10 "hard cutoff at the threshold."
- Return label as a string-literal union type, not an enum. Matches `ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"` in `src/lib/engine/types.ts:123`.
- Add per-niche type imports from `eval-config.ts` (analog: `aggregator.ts:17–29` imports `SCORE_WEIGHTS` from inline const, same module).

**Pitfalls:**
- `calibration.ts:140–151` has a subtle bug-trap with `noUncheckedIndexedAccess` — `bins[binIdx]` returns `T | undefined` even with a guarded index. The bucketing function MUST guard the niche lookup the same way: `const thresholds = NICHE_THRESHOLDS[niche]; if (!thresholds) return "average";` — do NOT use `!` non-null assertion.
- D-10 says **hard cutoff at the threshold**. Boundary semantics: `views >= viral_floor` is viral, `views <= under_ceiling` is under, otherwise average. Do not use `>` / `<`. The benchmark scripts use ranges like `if (v <= p20)` (see `retrain-ml/route.ts:107`) which is the exact pattern.
- Do NOT include `corpus_version` parameter in the function signature — the bucketing function reads thresholds from a config struct that's snapshotted per version (D-13). The caller (eval-harness, baseline script) is responsible for materializing the right snapshot. Mirror `applyPlattScaling(rawScore, params)` signature: caller passes the parameters.

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/bucketing.ts
import { NICHE_THRESHOLDS, type Niche, type Bucket } from "./eval-config";

export interface BucketingInput {
  views: number;
  niche: Niche;
}

/**
 * Classify a video into one of three outcome buckets using per-niche
 * absolute view thresholds (D-07 / D-10: hard cutoff, no exclusion).
 *
 * Pure function. Thresholds are snapshot per corpus_version (D-13)
 * and must be passed in at call site if caller wants a non-default snapshot.
 */
export function bucketByViews(
  input: BucketingInput,
  thresholds: typeof NICHE_THRESHOLDS = NICHE_THRESHOLDS,
): Bucket {
  const t = thresholds[input.niche];
  if (!t) return "average"; // unknown niche → average (safe default)
  if (input.views >= t.viralFloor) return "viral";
  if (input.views <= t.underCeiling) return "under";
  return "average";
}
```

---

### 2. `src/lib/engine/corpus/eval-config.ts` (config, static const-export)

**Role:** Hold the threshold formula constants (D-17 / D-18 sliding-scale rule) and per-niche bucketing thresholds. D-19 says this file is co-authoritative with `v2.1-baseline.md`.

**Analog:** `src/lib/engine/aggregator.ts` lines 17–29 (`ENGINE_VERSION`, `SCORE_WEIGHTS`).

Why: same purpose — typed `as const` literals that are read at runtime. Tests can import the same constants to assert against (`aggregator.test.ts:81–88` reads weights directly).

**Style to mirror:**
- Single file with named exports (no default export). Match `aggregator.ts:17` `export const ENGINE_VERSION = "2.1.0"`.
- Use `as const` for object literals to get literal types (e.g., `as const` on the weights object). Same as `SCORE_WEIGHTS` (`aggregator.ts:23–29`).
- Export type aliases derived from the constants (`type Niche = keyof typeof NICHE_THRESHOLDS`) — same idiom as `keyof typeof SCORE_WEIGHTS` used internally in `aggregator.ts:61`.
- Add a top-of-file comment cross-referencing `.planning/research/v2.1-baseline.md` (D-19 requires this exact cross-link).

**Pitfalls:**
- D-21: `ENGINE_VERSION` is **owned by `aggregator.ts:17`**, do NOT redefine. Import from there: `import { ENGINE_VERSION } from "../aggregator";`. The CONTEXT says baseline rows use literal `"2.1.0"` — but Phase 3 will refactor this, so reusing the existing constant is forward-compatible.
- D-18 sliding scale: the threshold formula depends on the **measured** v2.1 baseline. Baseline is unknown at code-time. Store the formula as a pure function `requiredImprovementFor(baselineMacroF1: number): number`, not as a precomputed value. Same pattern as `selectWeights(availability)` in `aggregator.ts:50–85` — a function that derives the answer at runtime.
- Pilot thresholds (D-08) are **explicitly disposable** ("treat as initial guesses, not load-bearing"). Mark with comment `/* PILOT — replaced by D-09 empirical recalibration */` so future devs know these are not the final numbers.

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/eval-config.ts
//
// Threshold formula constants for the v3 acceptance benchmark (BENCH-01..06).
// Cross-referenced by: .planning/research/v2.1-baseline.md (D-19).
//
// Pilot thresholds (NICHE_THRESHOLDS) are initial guesses; D-09 mandates
// empirical recalibration from pilot data before the 500-video build seals
// its corpus_version. Do not rely on these values being load-bearing.

export const NICHES = ["beauty", "fitness", "edu", "comedy", "lifestyle"] as const;
export type Niche = (typeof NICHES)[number];
export type Bucket = "viral" | "average" | "under";

/** Pilot starting thresholds (D-08). Recalibrated after pilot per D-09. */
export const NICHE_THRESHOLDS = {
  beauty:    { viralFloor: 250_000, underCeiling: 5_000 },
  fitness:   { viralFloor: 200_000, underCeiling: 5_000 },
  edu:       { viralFloor: 100_000, underCeiling: 2_000 },
  comedy:    { viralFloor: 500_000, underCeiling: 10_000 },
  lifestyle: { viralFloor: 250_000, underCeiling: 5_000 },
} as const;

/** Stratification target (D-01: 500-video full build). */
export const TARGET_DISTRIBUTION = { viral: 100, average: 200, under: 200 } as const;

/** D-15: per-niche regression floor (no niche may regress > 5pp vs v2.1). */
export const MAX_PER_NICHE_REGRESSION_PP = 0.05;

/** D-17/D-18: sliding-scale relative-improvement threshold. */
export function requiredImprovementFor(baselineMacroF1: number): number {
  if (baselineMacroF1 <= 0.40) return 0.15;
  if (baselineMacroF1 <= 0.55) return 0.10;
  return 0.07;
}

/** D-17: bootstrap significance gate. */
export const BOOTSTRAP_ITERATIONS = 200;
export const SIGNIFICANCE_ALPHA = 0.05;
```

---

### 3. `src/lib/engine/corpus/eval-harness.ts` (service, batch over pipeline)

**Role:** Run the engine over a `corpus_version` and emit a structured `BenchmarkReport` (macro-F1, per-niche, ECE, per-signal LOO, cost/latency, drift, top-10 failures). Persisted via `benchmark_results` row + optional failure-case storage.

**Analog (primary):** `scripts/benchmark.ts` lines 481–760 — already a 50-sample over-pipeline batch evaluator with summary statistics, latency aggregation, warning frequency. Read this file end-to-end before planning.

**Analog (secondary, for the persistence half):** `src/lib/engine/calibration.ts` lines 188–201 (`generateCalibrationReport`) — query → compute → return structured report.

**Style to mirror:**
- Module-level `const log = createLogger({ module: "corpus/eval-harness" })` — same as every cron route (`scrape-trending/route.ts:7`, `calibration-audit/route.ts:12`, `validate-rules/route.ts:6`). The CONTEXT names this exact pattern (`createLogger({ module: "eval" })`).
- Build the corpus iterator from a Supabase query, not file I/O. `scripts/extract-training-data.ts:249–268` shows the batched fetch loop with `range(offset, offset + BATCH_SIZE - 1)` — copy this exact pattern for the corpus fetch.
- For each corpus row: call `runPredictionPipeline(input)` then `aggregateScores(pipelineResult)` — same two-step from `scripts/benchmark.ts:514–515`. Do NOT inline scoring logic.
- Catch per-row failures and accumulate, mirror `scripts/benchmark.ts:551–578` exactly — error → record null-fields result with `error: errorMsg`, increment `failCount`, continue. Never let one row fail the whole run.
- Stage timings: piggyback on existing `timings: StageTiming[]` returned by `PipelineResult` (`pipeline.ts:34–48`) — collect them, compute p50/p95/p99 with `median()` helper from `benchmark.ts:95–102`. Do not introduce a parallel timing system.
- Sentry: wrap top-level orchestration with `Sentry.captureException(err, { tags: { stage: "eval_harness" } })` — exact pattern from `pipeline.ts:191–193`.

**Per-signal leave-one-out (LOO):** Re-score using `aggregateScores` after zeroing one signal source via the `availability` interface (`aggregator.ts:35–41` already supports this via `selectWeights`). Per-signal contribution = macro-F1(full) − macro-F1(without-signal). This is exactly how the existing aggregator dynamically redistributes weights — re-use that math (`aggregator.ts:288–304`).

**Pitfalls:**
- `scripts/benchmark.ts:582` has `sleep(2000)` between samples to avoid API rate limits. For 500 videos that's 16+ minutes. **Don't blindly copy** — for the eval harness, batch concurrency or remove the sleep is a Claude's-discretion decision. Document the choice.
- `scripts/benchmark.ts:514` does `aggregateScores(pipelineResult)` synchronously, **but in the current code (line 263) `aggregateScores` is `async`**. The benchmark.ts file has a known bug where `prediction: PredictionResult = aggregateScores(...)` would resolve to a Promise. Fix in new code: always `await aggregateScores(...)`.
- Don't suppress graceful degradation (`pipeline.ts:160–171` is load-bearing). CONTEXT explicitly says "eval harness measures pipeline outputs **including this fallback behavior** (don't suppress degradation in eval runs)."
- `scripts/benchmark.ts` is a script (`process.exit(0)`); `eval-harness.ts` is a library function returning a value. Strip out the `console.log` UX, return the structured report.

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/eval-harness.ts
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { runPredictionPipeline } from "../pipeline";
import { aggregateScores, ENGINE_VERSION } from "../aggregator";
import { bucketByViews } from "./bucketing";
import { computeMacroF1, computePerNicheF1, bootstrapSignificance } from "./metrics";
import type { Niche, Bucket } from "./eval-config";

const log = createLogger({ module: "corpus/eval-harness" });

export interface BenchmarkReport {
  corpus_version: string;
  engine_version: string;
  macro_f1: number;
  per_niche_f1: Record<Niche, number>;
  ece: number;
  cost_cents_avg: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  failures: Array<{ corpus_row_id: string; predicted: Bucket; actual: Bucket }>;
  generated_at: string;
}

export async function runEvalHarness(opts: {
  corpusVersion: string;
  engineVersion?: string;
}): Promise<BenchmarkReport> {
  const supabase = createServiceClient();
  // batched fetch loop — see scripts/extract-training-data.ts:249–268
  // for each row: runPredictionPipeline + await aggregateScores
  // accumulate timings, costs, predicted/actual bucket pairs
  // compute macro-F1, per-niche F1, ECE, latency percentiles
  // persist to benchmark_results
  // return report
  log.info("Eval harness started", { corpusVersion: opts.corpusVersion });
  // ...
}
```

---

### 4. `src/lib/engine/corpus/baseline.ts` (service, one-shot batch)

**Role:** D-20 deliverable — measure v2.1 baseline once against the full 500-video corpus, persist the row to `benchmark_results`, return the report. Effectively a wrapper around `runEvalHarness` that pins `engine_version = ENGINE_VERSION` (= "2.1.0") and writes the canonical baseline row.

**Analog:** `scripts/benchmark.ts` end-to-end (this IS the baseline pattern, just refactored from script to library + caller).

**Style to mirror:**
- Single async function `measureV21Baseline(corpusVersion: string): Promise<BenchmarkReport>` — same shape as `generateCalibrationReport` (`calibration.ts:188–201`).
- Hard-code `engine_version = ENGINE_VERSION` (from `aggregator.ts:17`) per D-21. CONTEXT says "Phase 3 picks up structural versioning."
- Insert the `benchmark_results` row inside this function (don't make the caller do it). Mirror `calibration-audit/route.ts:73–80` — the cron pattern is "function returns the report, route persists it"; baseline is closer to a one-shot, so persistence inside is fine. Document the side effect in the JSDoc.

**Pitfalls:**
- D-13: thresholds are snapshotted **per corpus_version**. The baseline function reads the version's threshold snapshot via `corpus-version.ts`, NOT from `eval-config.ts` defaults. Don't accidentally use the in-code default thresholds; if the user re-runs after recalibration (D-09), they want the version-pinned values.
- Sliding-scale rule (D-18) is **computed from this baseline**. The baseline function does NOT compute the v3 acceptance threshold — it just emits the baseline metric. The threshold formula is applied by Phase 12, not here. Phase 1's responsibility is only: "measure baseline, store baseline."

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/baseline.ts
import { ENGINE_VERSION } from "../aggregator";
import { runEvalHarness, type BenchmarkReport } from "./eval-harness";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "corpus/baseline" });

/**
 * D-20: One-time measurement of the v2.1 baseline against a sealed
 * corpus_version. Persists the row to benchmark_results.
 *
 * Side effect: writes one row to benchmark_results with
 * engine_version = "2.1.0" (D-21, hardcoded until Phase 3).
 */
export async function measureV21Baseline(
  corpusVersion: string,
): Promise<BenchmarkReport> {
  log.info("v2.1 baseline measurement started", { corpusVersion });
  const report = await runEvalHarness({
    corpusVersion,
    engineVersion: ENGINE_VERSION, // "2.1.0" via aggregator.ts:17
  });
  // INSERT into benchmark_results with the report fields
  // log.info("baseline persisted", { macro_f1: report.macro_f1 })
  return report;
}
```

---

### 5. `src/lib/engine/corpus/metrics.ts` (utility, pure transform)

**Role:** Pure math functions consumed by `eval-harness.ts`: macro-F1, per-niche F1, ECE (reuse existing!), leave-one-out, bootstrap p-value, MAE, Spearman ρ.

**Analog:** Two existing utility files in the same module:
- `src/lib/engine/calibration.ts:114–176` `computeECE` — **directly reusable, do not duplicate**.
- `src/lib/engine/ml.ts:98–130` `evaluate` — produces confusion matrix + accuracy. Lines 252–278 (`logPerClassMetrics`) shows precision/recall computation from a confusion matrix.

**Style to mirror:**
- Pure functions, named exports, no module-level state. Same as `calibration.ts` and `ml.ts` math helpers.
- Confusion matrix indexed by class, exactly as `ml.ts:104–106`: `confusionMatrix[actual][predicted]`. Reuse this shape for 3-class macro-F1.
- Use `Math.round(x * 10000) / 10000` for 4-decimal precision — same as `calibration.ts:162–165` (ECE rounding to 4 dp).
- Seeded RNG for bootstrap reproducibility — use `seededRandom(seed)` pattern from `ml.ts:85–93` (mulberry32). Same idiom as `stratifiedSplit` in `ml.ts:205–246`.

**Pitfalls:**
- D-17 says "bootstrap p-value < 0.05 with ≥ 200 iterations." The bootstrap is a **paired-vs-unpaired** Claude's-discretion call (CONTEXT line 96). Default to paired (same corpus rows resampled, both engine versions evaluated on the resampled set) — it has higher power. Document the choice.
- macro-F1 averages F1 across classes (D-14), not micro-F1 (which is biased toward the majority class given the 20/40/40 distribution). Calculation: `F1_viral`, `F1_avg`, `F1_under` → arithmetic mean. Don't accidentally implement weighted-F1.
- ECE function ALREADY EXISTS at `calibration.ts:114–176` — re-export from this module, do NOT reimplement: `export { computeECE } from "../calibration";`. The CONTEXT line 124 explicitly calls this out: "ECE computation foundation."
- Leave-one-out (LOO) per-signal: re-run `aggregateScores` with one signal's availability flag toggled off (`aggregator.ts:288–304` already supports this). The metric doesn't compute LOO — the harness does. Metrics module just exposes the F1 / ECE / MAE primitives that LOO loops over.

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/metrics.ts
import type { Bucket } from "./eval-config";

// Re-export — single source of truth for ECE (CONTEXT line 124)
export { computeECE } from "../calibration";

interface ConfusionMatrix3x3 {
  // [actual][predicted]
  matrix: Record<Bucket, Record<Bucket, number>>;
}

export function buildConfusionMatrix(
  pairs: Array<{ actual: Bucket; predicted: Bucket }>,
): ConfusionMatrix3x3 {
  // empty 3x3, accumulate counts — see ml.ts:104–130 for pattern
}

export function computeMacroF1(cm: ConfusionMatrix3x3): number {
  // for each class: precision = tp / (tp + fp), recall = tp / (tp + fn)
  // f1 = 2 * p * r / (p + r). Average across 3 classes.
  // Pattern: see ml.ts:252–278 logPerClassMetrics, adapted.
}

export function bootstrapPValue(opts: {
  baseline: number[]; // per-sample macro-F1 contributions for v2.1
  candidate: number[]; // per-sample contributions for v3
  iterations: number; // ≥ 200 per D-17
  seed: number;
}): number {
  // Seeded RNG via ml.ts:85–93 mulberry32 pattern
  // Paired bootstrap: resample indices with replacement, compute diff
  // p-value = fraction of bootstrap diffs <= 0
}
```

---

### 6. `src/lib/engine/corpus/corpus-version.ts` (utility, cached IO)

**Role:** Materialize a `corpus_version` identifier + its snapshotted threshold values + niche distribution. Used by `eval-harness.ts` and `baseline.ts` to pin a reproducible snapshot (D-12, D-13).

**Analog:** `src/lib/engine/ml.ts:474–495` (`loadModel` — Supabase Storage download + module-level cache).

**Style to mirror:**
- Module-level cache + `loadCorpusVersion(version: string)` function.
- Cache key by `corpus_version` string (one entry per version). Use `createCache` from `@/lib/cache` (referenced in `calibration.ts:310`) with a generous TTL — corpus versions never mutate (D-13 fixed-snapshot), so cache-forever is correct.
- Read from a `corpus_versions` JSON column on a metadata row, OR from a sealed JSON file in Supabase Storage (Claude's discretion — either works, the analog supports both).

**Pitfalls:**
- D-13: thresholds are **immutable per version**. Cache eviction should be manual-only (mirror `invalidatePlattCache` in `calibration.ts:344–346`) — never expire automatically. A 24-hour TTL like Platt is wrong here.
- `ml.ts:475` returns `null` for "model not yet trained" — copy this pattern. For `loadCorpusVersion("future-version")` return `null` rather than throw; the caller decides whether absence is fatal.

**Concrete skeleton:**
```typescript
// src/lib/engine/corpus/corpus-version.ts
import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";
import type { Niche } from "./eval-config";

const log = createLogger({ module: "corpus/corpus-version" });

export interface CorpusVersionSnapshot {
  version: string; // e.g., "pilot.2026-05-15", "full.2026-05-22"
  niche_thresholds: Record<Niche, { viralFloor: number; underCeiling: number }>;
  sealed_at: string; // ISO timestamp
  row_count: number;
}

// Cache forever — D-13 fixed-snapshot.
const cache = createCache<CorpusVersionSnapshot>(Number.MAX_SAFE_INTEGER);

export async function loadCorpusVersion(
  version: string,
): Promise<CorpusVersionSnapshot | null> {
  const cached = cache.get(version);
  if (cached !== null) return cached;

  const supabase = createServiceClient();
  // SELECT * FROM corpus_versions WHERE version = $1
  // OR storage.from("corpus-versions").download(`${version}.json`)
  // — Claude's discretion, mirror ml.ts:477–494 if Storage
  // cache.set(version, snapshot); return snapshot;
  return null;
}
```

---

### 7. `scripts/eval.ts` (CLI, batch entry point)

**Role:** Executable via `tsx scripts/eval.ts [--version pilot.2026-05-15] [--baseline]`. Loads env, registers path aliases, calls `runEvalHarness` or `measureV21Baseline`, prints the report and exits.

**Analog (primary):** `scripts/benchmark.ts` lines 1–22 (bootstrap) + `scripts/extract-training-data.ts` lines 1–8 (dotenv path).

**Style to mirror:**
- Top of file, in order, identical pattern to `scripts/benchmark.ts:1–22`:
  1. `import { config } from "dotenv"; import { resolve } from "path";` (line 1–2)
  2. `config({ path: resolve(__dirname, "../.env.local") })` (line 6)
  3. `import { register } from "tsconfig-paths"` (line 13) — needed because the engine modules use `@/` aliases that tsx doesn't resolve out of the box.
  4. Read `tsconfig.json`, call `register({ baseUrl, paths })` (lines 16–22).
  5. THEN import from `../src/lib/engine/corpus/*` (line 24+).
- Use `npx tsx scripts/eval.ts` (matches `package.json:24` `benchmark` script). Add `eval: "npx tsx scripts/eval.ts"` to `package.json` scripts.
- CLI flags via simple `process.argv` parsing (`scripts/benchmark.ts` has none yet, but D-20 needs two modes: full eval run vs. v2.1 baseline). Keep flag parsing minimal — no `commander` / `yargs`.
- `console.log` with a `[eval]` prefix (`benchmark.ts:93` uses `[benchmark]`). Match this voice.
- `process.exit(0)` on success, `process.exit(1)` on fatal (`benchmark.ts:760–768`).

**Pitfalls:**
- `package.json:5–24` defines `scripts` — must register the new script there alongside `benchmark`. Without this, the planner might forget the package.json edit.
- `tsconfig.json:38` excludes `"scripts"` from TypeScript checking. The CLI is intentionally untyped against the build. Don't try to enforce strict types via the build pipeline; rely on tsx + tsconfig-paths at runtime.
- The benchmark script's `aggregateScores(pipelineResult)` is missing `await` (`benchmark.ts:515`) — same warning as for `eval-harness.ts`. Fix in new code.
- Don't put orchestration logic in the script. The script is a thin CLI shell over `eval-harness.ts` / `baseline.ts`. Same as `scripts/extract-training-data.ts` — most of its 400 lines is data shape work, but the heavy lifting (feature extraction) could be moved to a library if reused. For `eval.ts`, **all** logic lives in `corpus/`.

**Concrete skeleton:**
```typescript
// scripts/eval.ts
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8")
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// After path registration: safe to import engine modules with @/ aliases
import { runEvalHarness } from "../src/lib/engine/corpus/eval-harness";
import { measureV21Baseline } from "../src/lib/engine/corpus/baseline";

const log = (msg: string) => console.log(`[eval] ${msg}`);

async function main() {
  const args = process.argv.slice(2);
  const versionFlag = args.find((a) => a.startsWith("--version="))?.split("=")[1];
  const isBaseline = args.includes("--baseline");

  if (!versionFlag) {
    log("Usage: tsx scripts/eval.ts --version=<corpus_version> [--baseline]");
    process.exit(1);
  }

  const report = isBaseline
    ? await measureV21Baseline(versionFlag)
    : await runEvalHarness({ corpusVersion: versionFlag });

  log(`macro_f1: ${report.macro_f1}`);
  log(`ece: ${report.ece}`);
  // ... print rest of report
  process.exit(0);
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
```

---

### 8. `src/lib/scraping/corpus/` (extend scraping module — Claude's discretion D-CONTEXT)

**Role:** Define 15 scrape configs (5 niches × 3 buckets) per D-06. Each config is a small Apify run config (hashtags, view filter, results-per-page) that produces rows for `training_corpus`.

**Analog (primary):** `src/lib/scraping/apify-provider.ts` (class with `client.actor(...).call()`) AND `src/app/api/cron/scrape-trending/route.ts:62–81` (`client.actor(actor_id).start(input, { webhooks })`).

**Style to mirror:**
- **Recommendation: extend existing `src/lib/scraping/`** with a new file (e.g., `src/lib/scraping/corpus-scrape.ts`), NOT a parallel subdir. The existing module is 3 small files (96 + 24 + 33 lines = 153 total). A `corpus/` subdir would over-modularize. Same actor (`clockworks~tiktok-scraper`), same client, same env vars — just different input shapes per bucket.
- Define each scrape config as a typed const, mirror `src/app/api/cron/scrape-trending/route.ts:12–17` `DEFAULT_HASHTAGS`. Lift these to a `CORPUS_SCRAPE_CONFIGS` object keyed by `${niche}_${bucket}`.
- Use `client.actor(APIFY_ACTOR_ID).start(input, { webhooks: [...] })` (`scrape-trending/route.ts:62`) for async dispatch — the webhook handler at `src/app/api/webhooks/apify/route.ts` already upserts to `scraped_videos`. **For the corpus, you'll need either a new webhook OR a `scrape_target` field in the payload** that the existing webhook routes to the right table.
- Alternative: synchronous `.call()` (`apify-provider.ts:23–26`) when the corpus build is small (pilot of 50 videos). Webhook only when scaling to 500.
- Schema validation: Zod schemas already exist (`apify-profile-schema`, `apify-video-schema` in `src/lib/schemas/competitor.ts:31–69`). Reuse `apifyVideoSchema` for video-level items. Add a corpus-specific extension if `corpus_version` / `bucket_target` needs to ride along.

**Pitfalls:**
- D-04: **min video age = 7 days** before outcome metrics trusted. The Apify trending feed returns brand-new videos. The scrape config must filter to `posted_at < now - 7 days`. The existing scrape-trending cron does NOT filter on age — copying it naively will pull day-0 videos.
- D-05: **max 3 videos per creator**. Must dedupe after the Apify dataset returns. There's no existing analog for this filter in the codebase; document as new logic. Cleanest place: a post-processor in `corpus-scrape.ts` that runs after the dataset is fetched and before inserting to `training_corpus`.
- D-08 view thresholds are applied at scrape time (under-bucket is "hashtag sweep sorted ascending"). For viral, the threshold filter is applied during ingest (after Apify returns) — Apify's trending feed isn't view-threshold-aware.
- The existing `scrape-trending` webhook (`apify/route.ts:69–90`) writes ALL items to `scraped_videos` — corpus items should NOT land there (they belong in `training_corpus`). Two options: (a) gate the webhook on a `scrape_target` field in the payload (b) introduce a parallel webhook endpoint. Either is fine; document the choice.

**Concrete skeleton:**
```typescript
// src/lib/scraping/corpus-scrape.ts
import { ApifyClient } from "apify-client";
import { apifyVideoSchema } from "@/lib/schemas/competitor";
import { createLogger } from "@/lib/logger";
import { NICHES, type Niche, type Bucket } from "@/lib/engine/corpus/eval-config";

const log = createLogger({ module: "scraping/corpus" });
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? "clockworks~tiktok-scraper";

interface CorpusScrapeConfig {
  niche: Niche;
  bucket: Bucket;
  hashtags: string[];
  resultsPerPage: number;
  sortBy?: "views_asc" | "trending"; // for under-bucket sweeps
}

// 15 configs: 5 niches × 3 buckets
export const CORPUS_SCRAPE_CONFIGS: CorpusScrapeConfig[] = [
  { niche: "beauty",  bucket: "viral",   hashtags: ["beauty", "skincare", "makeup"], resultsPerPage: 100, sortBy: "trending" },
  { niche: "beauty",  bucket: "average", hashtags: ["beautytips", "skincaretips"],   resultsPerPage: 100, sortBy: "trending" },
  { niche: "beauty",  bucket: "under",   hashtags: ["beautyroutine"],                 resultsPerPage: 100, sortBy: "views_asc" },
  // ... 12 more for fitness/edu/comedy/lifestyle
];

export async function runCorpusScrape(
  config: CorpusScrapeConfig,
  corpusVersion: string,
): Promise<void> {
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const run = await client.actor(APIFY_ACTOR_ID).start(
    { hashtags: config.hashtags, resultsPerPage: config.resultsPerPage },
    {
      webhooks: [{
        eventTypes: ["ACTOR.RUN.SUCCEEDED"],
        requestUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/apify`,
        payloadTemplate: `{
          "resource": {{resource}},
          "secret": "${process.env.APIFY_WEBHOOK_SECRET}",
          "scrape_target": "training_corpus",
          "corpus_version": "${corpusVersion}",
          "niche": "${config.niche}",
          "bucket_target": "${config.bucket}"
        }`,
      }],
    },
  );
  log.info("Corpus scrape started", { run_id: run.id, niche: config.niche, bucket: config.bucket });
}
```

---

### 9. `src/app/api/cron/refresh-corpus/route.ts` (api / cron)

**Role:** D-12 30-day rolling refresh. Stub for the pilot (CONTEXT line 15: "covered structurally but full mechanism is operational concern carried into Phase 11/12"). Phase 1 only needs the route file to exist with the right auth + skeleton.

**Analog (primary):** `src/app/api/cron/refresh-competitors/route.ts` lines 1–110 (daily batch + per-item isolation + `revalidatePath`).

**Analog (secondary):** `src/app/api/cron/scrape-trending/route.ts` lines 33–96 (Apify actor start + webhook + stale-data check).

**Style to mirror, in order:**
1. Imports (`refresh-competitors/route.ts:1–6`): `NextResponse`, `revalidatePath` (next/cache), `verifyCronAuth`, `createServiceClient`, `createLogger`, then domain-specific imports.
2. `const log = createLogger({ module: "cron/refresh-corpus" })` (line 8 pattern).
3. `export const maxDuration = 60;` (or 120 for retrain-ml-scale work). Match `refresh-competitors:11` if scrapes are kicked off as fire-and-forget; bump to 120 if there's substantial in-route work.
4. `export async function GET(request: Request)` with auth-first: `const authError = verifyCronAuth(request); if (authError) return authError;` — exact 2-line idiom from EVERY cron route (`refresh-competitors:24–25`, `scrape-trending:34–35`, `calibration-audit:27–28`, `validate-rules:43–44`, `retrain-ml:130–131`).
5. Wrap the body in try/catch; on failure: `log.error("Failed", { error: ... })` + `NextResponse.json({ error: "..." }, { status: 500 })` — exact pattern from `calibration-audit:97–105` and `validate-rules:273–278`.
6. Add to `vercel.json` — see Pitfalls.

**Pitfalls:**
- **vercel.json must be updated** — without this, the cron won't run on Vercel. Add an entry to `vercel.json:3–31` array. For the pilot stub, use a permissive schedule that won't fire frequently: `"0 6 * * *"` (daily at 6 AM) matches `refresh-competitors`. Or use `"0 6 1 * *"` (monthly 1st at 6 AM) to match the 30-day cadence — closer to the D-12 intent.
- `refresh-competitors:99` has the comment `// Continue to next profile — do NOT break or rethrow` — this isolation pattern matters for the corpus refresh too (one niche scrape failure shouldn't block the other 14).
- `revalidatePath("/competitors")` (`refresh-competitors:103`) doesn't apply — corpus isn't user-facing. Skip this line in the new route.
- For the pilot stub, return `{ status: "stubbed", message: "Phase 1 stub; full refresh in Phase 11/12" }` and skip the actual logic. CONTEXT explicitly says full mechanism is downstream. Don't over-build.

**Concrete skeleton:**
```typescript
// src/app/api/cron/refresh-corpus/route.ts
import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-corpus" });

export const maxDuration = 60;

/**
 * GET /api/cron/refresh-corpus
 *
 * D-12: Stub for the 30-day rolling refresh. Full implementation lands
 * in Phase 11/12 (operational concern). Phase 1 only needs this route
 * to exist with the cron-auth guard so vercel.json can register it.
 *
 * Configured for monthly trigger; full corpus rotation is scoped out
 * of Phase 1 (CONTEXT line 15).
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    log.info("Refresh-corpus stub invoked (no-op until Phase 11/12)");
    return NextResponse.json({
      status: "stubbed",
      message: "Phase 1 stub; full 30-day refresh implemented in Phase 11/12",
    });
  } catch (error) {
    log.error("Failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**vercel.json delta** (already-existing file, append one entry to `crons` array):
```jsonc
{
  "path": "/api/cron/refresh-corpus",
  "schedule": "0 6 1 * *"  // 1st of each month at 6 AM UTC (30-day cadence)
}
```

---

### 10. Migration: `training_corpus` table

**Filename:** `supabase/migrations/YYYYMMDDHHMMSS_training_corpus.sql` (use current timestamp like `20260512000000_training_corpus.sql`, mirroring `20260213000000_content_intelligence.sql:1`).

**Analog:** `supabase/migrations/20260213000000_content_intelligence.sql` lines 20–52 (`scraped_videos` table — system-wide table, BIGINT engagement counters, hashtags TEXT[], metadata JSONB, public-read no-write RLS).

> Overrides CONTEXT's "competitor_tables.sql is closest" — see top-of-file note. `scraped_videos` is a strictly better template because it is **system-wide (no `user_id`)** and has public-read-only RLS, which matches the corpus RLS profile.

**Style to mirror:**
- File header comment naming the table + RLS strategy (`content_intelligence.sql:1–4`).
- Reuse `update_updated_at_column()` trigger function — already defined in `content_intelligence.sql:9–15` AND `competitor_tables.sql:10–16`. Add `CREATE OR REPLACE FUNCTION` at the top, idempotent.
- Standard column shape:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (line 21)
  - `platform TEXT NOT NULL DEFAULT 'tiktok'` (line 22)
  - `platform_video_id TEXT NOT NULL` (line 23)
  - Engagement counters as `BIGINT DEFAULT 0` (lines 28–31) — viral creators exceed INT_MAX, this is explicitly called out at `competitor_tables.sql:3`.
  - `hashtags TEXT[] DEFAULT '{}'` (line 34)
  - `metadata JSONB DEFAULT '{}'` (line 37)
  - `created_at`, `updated_at` `TIMESTAMPTZ DEFAULT NOW()` (lines 39–40)
  - `UNIQUE(platform, platform_video_id)` (line 41)
- Indexes mirroring `content_intelligence.sql:44–47`: at minimum a created_at DESC index and a partial index for non-archived rows (the corpus equivalent is "rows tied to currently-active corpus_version").
- `update_updated_at_column()` trigger (lines 49–52).

**Corpus-specific additions** (not in any analog, document inline in the SQL):
- `corpus_version TEXT NOT NULL` — D-12 identifier
- `niche TEXT NOT NULL CHECK (niche IN ('beauty', 'fitness', 'edu', 'comedy', 'lifestyle'))` — D-03 locked set
- `bucket TEXT NOT NULL CHECK (bucket IN ('viral', 'average', 'under'))` — D-14 three-class
- `bucket_target TEXT CHECK (bucket_target IN ('viral', 'average', 'under'))` — what the scrape job was aiming for (vs. what bucketing actually classified it as); useful for debugging label noise.
- `creator_handle TEXT` — D-05 dedupe needs this
- `posted_at TIMESTAMPTZ` — D-04 7-day age check needs this
- All counters: `views BIGINT`, `likes BIGINT`, `comments BIGINT`, `shares BIGINT`

**RLS:** D-corollary "corpus is NOT user-scoped, system-wide." Mirror `content_intelligence.sql:214–222`:
```sql
ALTER TABLE training_corpus ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; no public SELECT policy needed.
-- If we want service-role-only writes AND public reads (for dashboard later):
-- CREATE POLICY "Anyone can view training corpus" ON training_corpus FOR SELECT USING (true);
```

**Pitfalls:**
- **Do NOT mirror `competitor_tables.sql:113–127`** RLS policies — those use `(SELECT auth.uid())` and require `user_id` foreign key. The corpus has no user owner.
- D-12 fixed-snapshot: `corpus_version` is the partition key. Indexes should include `(corpus_version, niche)` for harness queries.
- D-04 7-day age filter applies at scrape time, not in the schema. Don't add a CHECK constraint for `posted_at < now() - 7 days` — corpus seal date is a moving target.
- `competitor_videos:90` uses `UNIQUE(competitor_id, platform_video_id)` — for corpus, the analog is `UNIQUE(corpus_version, platform_video_id)` (same video can appear in pilot and full builds).

**Concrete skeleton:**
```sql
-- supabase/migrations/20260512000000_training_corpus.sql
-- Training Corpus Schema (Phase 1, D-01..06)
-- System-wide table (no user_id) — service-role writes, public reads.
-- BIGINT counters for viral videos (precedent: scraped_videos, competitor_videos).
-- corpus_version partitions snapshots per D-12; per-version threshold seal per D-13.

-- Reuse shared trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE training_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scrape provenance
  platform TEXT NOT NULL DEFAULT 'tiktok',
  platform_video_id TEXT NOT NULL,
  video_url TEXT,
  creator_handle TEXT,
  posted_at TIMESTAMPTZ,                                    -- D-04 (7-day age filter at scrape time)

  -- Engagement outcomes
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  duration_seconds INTEGER,

  -- Content for engine input
  description TEXT,
  hashtags TEXT[] DEFAULT '{}',
  sound_name TEXT,

  -- Corpus labeling
  corpus_version TEXT NOT NULL,                             -- D-12: pilot.YYYY-MM-DD / full.YYYY-MM-DD
  niche TEXT NOT NULL
    CHECK (niche IN ('beauty', 'fitness', 'edu', 'comedy', 'lifestyle')),  -- D-03
  bucket TEXT NOT NULL
    CHECK (bucket IN ('viral', 'average', 'under')),        -- D-14
  bucket_target TEXT
    CHECK (bucket_target IN ('viral', 'average', 'under')), -- what the scrape was aiming for

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(corpus_version, platform_video_id)                 -- same video can appear across versions
);

CREATE INDEX idx_training_corpus_version_niche ON training_corpus(corpus_version, niche);
CREATE INDEX idx_training_corpus_version_bucket ON training_corpus(corpus_version, bucket);
CREATE INDEX idx_training_corpus_posted_at ON training_corpus(posted_at DESC);
CREATE INDEX idx_training_corpus_creator ON training_corpus(creator_handle);    -- D-05 dedupe

ALTER TABLE training_corpus ENABLE ROW LEVEL SECURITY;
-- System-wide: service role bypasses RLS; no user-scoped policies.
-- Optional public-read for future dashboard surface:
-- CREATE POLICY "Anyone can view training corpus"
--   ON training_corpus FOR SELECT USING (true);

CREATE TRIGGER training_corpus_updated_at
  BEFORE UPDATE ON training_corpus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### 11. Migration: `benchmark_results` table

**Filename:** `supabase/migrations/YYYYMMDDHHMMSS_benchmark_results.sql` (timestamp slightly later than `training_corpus.sql`, e.g., `20260512000100_benchmark_results.sql`).

**Analog:** `supabase/migrations/20260213000000_content_intelligence.sql` lines 124–149 (`outcomes` table — predicted/actual scores, `deleted_at`, foreign-key off `analysis_results`).

**Style to mirror:**
- Same header / trigger reuse pattern as `training_corpus`.
- `predicted_score`-style columns as `NUMERIC(5,2)` (matches `outcomes.predicted_score:132`).
- `factors`-style structured columns as `JSONB DEFAULT '{}'` (matches `analysis_results.factors:92`).
- `deleted_at TIMESTAMPTZ` for soft deletes (matches `outcomes.deleted_at:137`).
- Index on `(corpus_version, engine_version)` for the canonical lookup.

**Benchmark-specific columns:**
- `corpus_version TEXT NOT NULL` (FK relation by string, not UUID — versions live in JSON or self-describing rows)
- `engine_version TEXT NOT NULL` (D-21: "2.1.0" hardcoded baseline)
- `macro_f1 NUMERIC(5,4) NOT NULL`
- `per_niche_f1 JSONB NOT NULL` — `{ "beauty": 0.42, "fitness": 0.38, ... }`
- `ece NUMERIC(5,4)` — primary metric for calibration health
- `per_class_metrics JSONB DEFAULT '{}'` — precision/recall per bucket
- `signal_contribution JSONB DEFAULT '{}'` — LOO per signal source
- `cost_cents_avg NUMERIC(10,4)` — BENCH-03 cap is $0.075
- `latency_p50 INTEGER`, `latency_p95 INTEGER`, `latency_p99 INTEGER` (milliseconds, INTEGER per `analysis_results.latency_ms:101`)
- `stage_timings JSONB DEFAULT '{}'` — per-stage p50/p95/p99
- `drift_metrics JSONB DEFAULT '{}'` — bucket-distribution drift vs. prior version
- `failure_cases JSONB DEFAULT '[]'` — top 10 mispredictions (D-secondary; CONTEXT defers storage to Claude's discretion — JSONB column wins by simplicity)
- `notes TEXT`
- `run_at TIMESTAMPTZ DEFAULT NOW()`
- `created_at`, `updated_at`, `deleted_at` standard

**RLS:** System-wide, service-role-only writes. Same as `training_corpus`. No user_id FK.

**Pitfalls:**
- **Do NOT add `user_id`** — benchmarks are not user-scoped. The CONTEXT decision logs make this explicit (system-wide tables for the corpus + eval infrastructure).
- The CONTEXT says (line 158): "`benchmark_failure_cases` (TBD per Claude's discretion) — possibly Supabase, possibly JSON files." The simplest and least-fragmenting choice is a `failure_cases JSONB` column on `benchmark_results` (10 cases × 200 byte = 2KB; well within JSONB limits). Avoid a separate table unless the failure-case row count is expected to balloon.
- `outcomes:126` has a `UNIQUE(analysis_id)` constraint (one outcome per analysis). For `benchmark_results`, the equivalent is `UNIQUE(corpus_version, engine_version, run_at)` is too strict — multiple runs per (corpus_version, engine_version) pair are legitimate (regression testing). Skip the UNIQUE, rely on `id` PK.
- D-20: Phase 1 ships with **one** seeded row (`engine_version = "2.1.0"`, the v2.1 baseline). The migration should NOT seed data — the `measureV21Baseline` function does that at runtime. Migrations are schema-only.

**Concrete skeleton:**
```sql
-- supabase/migrations/20260512000100_benchmark_results.sql
-- Engine Eval Harness Output Schema (Phase 1, D-14..20)
-- System-wide table (no user_id) — eval harness service-role inserts.
-- Schema mirrors analysis_results + outcomes patterns from content_intelligence.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version tagging (D-12, D-21)
  corpus_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,                              -- "2.1.0" for the v2.1 baseline row

  -- Primary gate metric (D-14)
  macro_f1 NUMERIC(5,4) NOT NULL,
  per_niche_f1 JSONB NOT NULL,                               -- D-15 floor

  -- Secondary metrics (D-16)
  ece NUMERIC(5,4),
  per_class_metrics JSONB DEFAULT '{}',
  signal_contribution JSONB DEFAULT '{}',                    -- LOO contribution per signal
  cost_cents_avg NUMERIC(10,4),                              -- BENCH-03: target ≤ 0.075
  latency_p50 INTEGER,
  latency_p95 INTEGER,
  latency_p99 INTEGER,
  stage_timings JSONB DEFAULT '{}',                          -- per-stage p50/p95/p99
  drift_metrics JSONB DEFAULT '{}',                          -- bucket-distribution drift vs prior version
  failure_cases JSONB DEFAULT '[]',                          -- top 10 mispredictions

  -- Run context
  notes TEXT,
  run_at TIMESTAMPTZ DEFAULT NOW(),

  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_benchmark_results_corpus_engine
  ON benchmark_results(corpus_version, engine_version, run_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_benchmark_results_run_at
  ON benchmark_results(run_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;
-- System-wide: service role bypasses RLS; no user-scoped policies.

CREATE TRIGGER benchmark_results_updated_at
  BEFORE UPDATE ON benchmark_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

### 12. `.planning/research/v2.1-baseline.md` (docs)

**Role:** D-19 / D-20 — human-readable baseline report. Cross-references `eval-config.ts` for the executable constants.

**Analog:** Repo doesn't have a precedent baseline doc, but the section / sub-section / metric-table shape of `.planning/codebase/STACK.md` and `01-CONTEXT.md` (in this phase) is the right voice — bullet-heavy, table-anchored, link-rich.

**Style to mirror:**
- Top-level H1 with date + phase ref (mirror `STACK.md:1–3`).
- Sections: Baseline Methodology, Corpus Version, Results (with table per niche + global), Threshold Formula Rationale (D-17/18), Cross-References.
- Tables for per-niche F1, per-bucket precision/recall, per-stage timings.
- Cross-link `eval-config.ts` constants by name (D-19: "doc references the code constants").

**Pitfalls:**
- The doc is **written after** running the v2.1 baseline (`measureV21Baseline`). Phase 1 plan should sequence: (1) write code, (2) run migration, (3) execute baseline, (4) capture metrics, (5) write `v2.1-baseline.md` last. The PATTERNS doc can't pre-specify the numbers.
- Don't duplicate the constants — link to `eval-config.ts` symbols, don't restate the values inline (drift hazard).

**Concrete skeleton:**
```markdown
# v2.1 Engine Baseline Report

**Measured:** [DATE_AFTER_BASELINE_RUN]
**Corpus version:** `full.YYYY-MM-DD`
**Engine version:** `2.1.0` (`src/lib/engine/aggregator.ts:17`)
**Phase:** 1 — Training Corpus & Eval Foundation
**Cross-ref:** `src/lib/engine/corpus/eval-config.ts` (executable constants)

## Methodology

- 500-video corpus, stratified 100 / 200 / 200 across viral / average / under (D-01)
- 5 niches: beauty, fitness, edu, comedy, lifestyle (D-03)
- Bucket assignment via `bucketByViews()` with `corpus_version`-sealed thresholds (D-09, D-13)
- Pipeline: `runPredictionPipeline` → `aggregateScores` (no engine modifications)

## Results

### Global
| Metric | Value |
|---|---|
| macro-F1 | [TBD] |
| ECE | [TBD] |
| Cost per analysis | [TBD] cents |
| Latency p95 | [TBD] ms |

### Per-Niche macro-F1
| Niche | macro-F1 |
|---|---|
| beauty | [TBD] |
| fitness | [TBD] |
| edu | [TBD] |
| comedy | [TBD] |
| lifestyle | [TBD] |

## Threshold Formula

Applied per `requiredImprovementFor()` in `src/lib/engine/corpus/eval-config.ts`.

Given measured baseline = [TBD], the v3 acceptance requirement is:
- Relative improvement: ≥ [X]%
- Bootstrap p-value: < 0.05 (≥ 200 iterations, paired)
- Per-niche floor: no niche regresses by > 5pp (D-15)

## Cross-References

- Code: `src/lib/engine/corpus/eval-config.ts`
- Code: `src/lib/engine/corpus/baseline.ts`
- Persisted row: `benchmark_results` WHERE `engine_version = '2.1.0'`
- Phase Context: `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md`
```

---

## Shared Patterns

These cross-cutting patterns apply to ALL relevant new files. Planner should reference these once per plan.

### Pattern A: Logger Setup

**Source:** `src/lib/logger.ts` lines 63–75 (the `createLogger` factory).

**Apply to:** Every new file that produces side effects (eval-harness, baseline, corpus-version, corpus-scrape, refresh-corpus cron). NOT to pure-function files (bucketing, metrics, eval-config).

**Excerpt:**
```typescript
// At top of file, after imports:
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "<domain>/<file-name>" });

// Inside functions:
log.info("descriptive event", { structured: data });
log.error("Failed", { error: err instanceof Error ? err.message : String(err) });
```

The module string convention from the existing crons:
- `cron/calibration-audit`, `cron/refresh-competitors`, `cron/retrain-ml` → so use `cron/refresh-corpus`
- `pipeline`, `ml`, `calibration` → so use `corpus/eval-harness`, `corpus/baseline`, `corpus/corpus-version`, `scraping/corpus`

### Pattern B: Cron Auth Guard

**Source:** `src/lib/cron-auth.ts` lines 9–18.

**Apply to:** `src/app/api/cron/refresh-corpus/route.ts` (the only cron in this phase).

**Excerpt:**
```typescript
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;
  // ... rest of handler
}
```

This is the FIRST line of every cron route handler. No exceptions.

### Pattern C: Service Client (Bypasses RLS)

**Source:** `src/lib/supabase/service.ts` lines 11–21.

**Apply to:** Every server-side function that reads or writes `training_corpus` / `benchmark_results` / `outcomes`. The corpus tables are system-wide; the service client is the **only** write path.

**Excerpt:**
```typescript
import { createServiceClient } from "@/lib/supabase/service";

const supabase = createServiceClient();
const { data, error } = await supabase
  .from("training_corpus")
  .select("...")
  .eq("corpus_version", version);
```

**Critical:** Never instantiate the service client in client components (`"use client"` files). For `corpus/`, this is fine — all code runs server-side.

### Pattern D: Sentry Instrumentation

**Source:** `src/lib/engine/pipeline.ts` lines 190–197 (stage-tagged exception capture).

**Apply to:** `eval-harness.ts`, `baseline.ts`, `corpus-scrape.ts`. NOT pure-function files.

**Excerpt:**
```typescript
import * as Sentry from "@sentry/nextjs";

try {
  // ... work
} catch (error) {
  Sentry.captureException(error, {
    tags: { stage: "eval_harness", corpusVersion },
  });
  throw error; // or graceful degradation as policy
}
```

### Pattern E: Graceful Degradation in Pipeline Calls

**Source:** `src/lib/engine/pipeline.ts` lines 232–271 (Gemini stage with HARD-03 fallback).

**Apply to:** `eval-harness.ts` only. When iterating the corpus, a single pipeline failure must not break the run.

**Excerpt:** see `scripts/benchmark.ts:551–578` for the exact per-row failure handling — record null result with error message, increment fail counter, continue.

### Pattern F: TypeScript Coverage Gate

**Source:** `vitest.config.ts` lines 17–31 — 80% threshold on `src/lib/engine/**/*.ts`.

**Apply to:** All `src/lib/engine/corpus/*.ts` files. They are inside the coverage glob.

**Test file location:** `src/lib/engine/corpus/__tests__/{bucketing,eval-harness,metrics,corpus-version,baseline}.test.ts` — mirror the existing `src/lib/engine/__tests__/` directory layout.

**Mock setup pattern:** Copy lines 1–60 of `src/lib/engine/__tests__/aggregator.test.ts` exactly — `vi.mock("@/lib/logger", …)`, `vi.mock("@/lib/supabase/service", …)`, `vi.mock("@sentry/nextjs", …)`. Same boilerplate, every file.

**Factories:** Mirror `src/lib/engine/__tests__/factories.ts` — provide `makeCorpusRow`, `makeBenchmarkReport` helpers that return valid defaults with `Partial<T>` overrides. This pattern is already in active use (`factories.ts:1–267`).

### Pattern G: Zod Schemas at System Boundaries

**Source:** `src/lib/schemas/competitor.ts:31–69` + `src/lib/engine/types.ts:53–84`.

**Apply to:**
- Apify response shapes in `corpus-scrape.ts` (reuse existing `apifyVideoSchema`).
- CLI flag parsing in `scripts/eval.ts` if structured input is taken.
- Any cross-process input (Supabase rows can be typed via `Database` types; no Zod needed there).

### Pattern H: CLI Bootstrap

**Source:** `scripts/benchmark.ts:1–22` + `scripts/extract-training-data.ts:1–8`.

**Apply to:** `scripts/eval.ts` only.

The exact import + register order (dotenv first, tsconfig-paths second, engine imports third) is load-bearing. See concrete skeleton under file #7 above. Don't reorder; tsx will fail to resolve `@/` aliases otherwise.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (none) | — | — | All 12 new files have at least one strong analog. |

The closest "weak match" is the corpus refresh cron stub, since `refresh-corpus` is a stub that will be fleshed out in Phase 11/12 — but the cron skeleton itself (auth + log + try/catch) is well-modeled by all 7 existing cron routes.

---

## Metadata

**Analog search scope:**
- `src/lib/engine/` (entire directory)
- `src/lib/engine/__tests__/` (entire directory)
- `src/lib/scraping/` (entire directory — 3 files)
- `src/lib/supabase/` (service.ts)
- `src/lib/cron-auth.ts`, `src/lib/logger.ts`
- `src/app/api/cron/` (all 7 routes)
- `src/app/api/webhooks/apify/route.ts`
- `scripts/` (benchmark.ts, extract-training-data.ts)
- `supabase/migrations/` (content_intelligence + v2_schema_expansion + competitor_tables)
- `vercel.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`
- `.planning/codebase/` (STACK.md + ARCHITECTURE.md + INTEGRATIONS.md)
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md`

**Files scanned:** 24 source files end-to-end + 3 architecture docs.

**Pattern extraction date:** 2026-05-11
