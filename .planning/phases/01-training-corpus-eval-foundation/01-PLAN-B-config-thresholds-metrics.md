---
phase: 1
plan: B
title: Eval config, thresholds, bucketing, and pure metrics
status: pending
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/engine/corpus/eval-config.ts
  - src/lib/engine/corpus/thresholds.ts
  - src/lib/engine/corpus/bucketing.ts
  - src/lib/engine/corpus/metrics/macro-f1.ts
  - src/lib/engine/corpus/metrics/bootstrap.ts
  - src/lib/engine/corpus/metrics/score-to-bucket.ts
  - src/lib/engine/corpus/metrics/leave-one-out.ts
  - src/lib/engine/corpus/metrics/stage-latency.ts
  - src/lib/engine/corpus/metrics/index.ts
  - src/lib/engine/corpus/__tests__/eval-config.test.ts
  - src/lib/engine/corpus/__tests__/thresholds.test.ts
  - src/lib/engine/corpus/__tests__/bucketing.test.ts
  - src/lib/engine/corpus/__tests__/macro-f1.test.ts
  - src/lib/engine/corpus/__tests__/bootstrap.test.ts
  - src/lib/engine/corpus/__tests__/leave-one-out.test.ts
  - src/lib/engine/corpus/__tests__/stage-latency.test.ts
autonomous: true
requirements: [CORPUS-05, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-07]
must_haves:
  truths:
    - "Bucketing classifier (TypeScript) classifies a row's views into viral/average/under given per-niche thresholds, hard-cutoff (D-10) at thresholds"
    - "Macro-F1 returns identical values to scikit-learn fixtures on known input/output pairs"
    - "Paired bootstrap returns reproducible p-values with the same seed"
    - "Leave-one-out math replicates aggregator.selectWeights redistribution without engine code change"
    - "Threshold formula requiredImprovementFor() honors D-18 sliding scale (15%/10%/7%)"
    - "ECE re-export from src/lib/engine/calibration is the single source of truth"
    - "All new pure-function code meets ≥80% Vitest coverage"
  artifacts:
    - path: src/lib/engine/corpus/eval-config.ts
      provides: "NICHES const, NICHE_THRESHOLDS pilot snapshot, TARGET_DISTRIBUTION, MAX_PER_NICHE_REGRESSION_PP, requiredImprovementFor(), BOOTSTRAP_ITERATIONS, SIGNIFICANCE_ALPHA, MIN_VIEWS_FOR_MAE_ENGAGEMENT"
      contains: "requiredImprovementFor"
    - path: src/lib/engine/corpus/thresholds.ts
      provides: "Per-corpus_version threshold snapshot lookup (D-13 immutable)"
      contains: "THRESHOLD_SNAPSHOTS"
    - path: src/lib/engine/corpus/bucketing.ts
      provides: "bucketByViews(views, niche, thresholds) → 'viral'|'average'|'under'"
      contains: "export function bucketByViews"
    - path: src/lib/engine/corpus/metrics/macro-f1.ts
      provides: "computeMacroF1(predicted, actual) → { macroF1, perClass, confusionMatrix }"
      contains: "computeMacroF1"
    - path: src/lib/engine/corpus/metrics/bootstrap.ts
      provides: "pairedBootstrapMacroF1(predictedA, predictedB, actual, iters, seed) → { pValue, observedDelta, ci95 }"
      contains: "pairedBootstrapMacroF1"
    - path: src/lib/engine/corpus/metrics/score-to-bucket.ts
      provides: "bucketFromScore(score, niche) — maps engine 0-100 score to bucket using 70/30 cut"
      contains: "bucketFromScore"
    - path: src/lib/engine/corpus/metrics/leave-one-out.ts
      provides: "scoreWithoutSignal(pipelineResult, signal) — replicates aggregator math with one signal forced unavailable"
      contains: "scoreWithoutSignal"
    - path: src/lib/engine/corpus/metrics/stage-latency.ts
      provides: "aggregateStageLatencies(timings[][]) → per-stage p50/p95/p99"
      contains: "aggregateStageLatencies"
  key_links:
    - from: src/lib/engine/corpus/metrics/index.ts
      to: src/lib/engine/calibration.ts
      via: "Re-export computeECE (single source of truth — no duplicate ECE implementation)"
      pattern: "export.*computeECE.*calibration"
    - from: src/lib/engine/corpus/metrics/leave-one-out.ts
      to: src/lib/engine/aggregator.ts
      via: "Import SCORE_WEIGHTS + ENGINE_VERSION + replicate selectWeights math (avoid string-matching warning fragility — Pitfall 7)"
      pattern: "import.*aggregator"
---

<objective>
Build the entire pure-function foundation of the corpus + eval module: typed constants, threshold snapshots (D-13 fixed-snapshot per corpus_version), bucketing classifier (D-07/D-10/D-11), and all metric math (macro-F1 D-14, paired bootstrap D-17, leave-one-out EVAL-03 without engine code changes, score-to-bucket mapping, stage latency aggregation). Every function is pure, exported, and unit-tested to the 80% engine coverage threshold.

Purpose: Provides the deterministic kernel that Plans D (orchestrator), E (eval harness), F (pilot run), and G (baseline) all consume. Zero I/O, zero side effects — runs entirely in process.

Output: The `src/lib/engine/corpus/` module skeleton with all pure helpers and full test coverage. No DB, no Apify, no CLI in this plan — those come in Plans C/D/E.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md
@.planning/phases/01-training-corpus-eval-foundation/01-RESEARCH.md
@.planning/phases/01-training-corpus-eval-foundation/01-PATTERNS.md
@src/lib/engine/aggregator.ts
@src/lib/engine/calibration.ts
@src/lib/engine/ml.ts
@src/lib/engine/types.ts
@src/lib/engine/pipeline.ts

<interfaces>
<!-- From src/lib/engine/aggregator.ts (NEVER edit per milestone additive-only rule) -->
- `ENGINE_VERSION = "2.1.0"` (line 17) — IMPORT, do not redefine
- `SCORE_WEIGHTS = { behavioral: 0.35, gemini: 0.25, ml: 0.15, rules: 0.15, trends: 0.10 }` (lines 23-29)
- `interface SignalAvailability { behavioral, gemini, ml, rules, trends: boolean }` (lines 35-41)
- `selectWeights(availability) → { behavioral, gemini, ml, rules, trends: number }` (lines 50-85) — replicate this math in leave-one-out.ts

<!-- From src/lib/engine/calibration.ts -->
- `computeECE(pairs, numBins)` (lines 114-176) — re-export, never reimplement

<!-- From src/lib/engine/ml.ts -->
- `mulberry32(seed)` seeded RNG pattern (lines 85-93) — copy for bootstrap reproducibility
- Confusion matrix shape: `cm[actual][predicted]` (lines 104-106)

<!-- From src/lib/engine/types.ts -->
- `ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"` (line 123) — mirror string-literal union pattern
- `interface PipelineResult` (defined in pipeline.ts:29-48) including `timings: StageTiming[]`

<!-- From src/lib/engine/pipeline.ts -->
- `interface StageTiming { stage: string; duration_ms: number }` (lines 34-48 area)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: eval-config, thresholds, and bucketing — pure constants and classifier</name>
  <files>src/lib/engine/corpus/eval-config.ts, src/lib/engine/corpus/thresholds.ts, src/lib/engine/corpus/bucketing.ts, src/lib/engine/corpus/__tests__/eval-config.test.ts, src/lib/engine/corpus/__tests__/thresholds.test.ts, src/lib/engine/corpus/__tests__/bucketing.test.ts</files>
  <behavior>
- `requiredImprovementFor(0.30)` → 0.15 (D-18: ≤ 0.40 floor)
- `requiredImprovementFor(0.40)` → 0.15 (boundary inclusive on lower band)
- `requiredImprovementFor(0.50)` → 0.10 (mid band)
- `requiredImprovementFor(0.55)` → 0.10 (boundary inclusive)
- `requiredImprovementFor(0.65)` → 0.07 (top band)
- `getThresholds("pilot.2026-05-12")` returns the D-08 snapshot with all 5 niches present
- `getThresholds("nonexistent.version")` throws (no silent default)
- `bucketByViews(1_000_000, "beauty", pilotThresholds)` → "viral" (D-08 beauty viralFloor 250k, ≥ is hard cutoff per D-10)
- `bucketByViews(250_000, "beauty", pilotThresholds)` → "viral" (boundary inclusive)
- `bucketByViews(249_999, "beauty", pilotThresholds)` → "average"
- `bucketByViews(5_001, "beauty", pilotThresholds)` → "average"
- `bucketByViews(5_000, "beauty", pilotThresholds)` → "under" (boundary inclusive)
- `bucketByViews(0, "beauty", pilotThresholds)` → "under"
- bigint inputs (`bucketByViews({ views: 1_000_000n })` after Number() coerce) classify identically to number inputs
  </behavior>
  <action>
**src/lib/engine/corpus/eval-config.ts** — per PATTERNS.md §2:

Header comment block:
```
// Threshold formula constants for the v3 acceptance benchmark (BENCH-01..06).
// Cross-referenced by: .planning/research/v2.1-baseline.md (D-19).
//
// IMPORTANT: NICHE_THRESHOLDS here are PILOT starting values (D-08). They are
// initial guesses, not load-bearing. D-09 mandates empirical recalibration from
// pilot scrape data before the 500-video corpus seals its corpus_version.
// Full-corpus thresholds are written into thresholds.ts THRESHOLD_SNAPSHOTS,
// not here.
```

Exports (per PATTERNS.md §2 concrete skeleton):
- `export const NICHES = ["beauty", "fitness", "edu", "comedy", "lifestyle"] as const`
- `export type Niche = (typeof NICHES)[number]`
- `export type Bucket = "viral" | "average" | "under"` (string-literal union per types.ts:123 idiom)
- `export const NICHE_THRESHOLDS = { ... } as const` — D-08 pilot snapshot (Beauty 250k/5k, Fitness 200k/5k, Edu 100k/2k, Comedy 500k/10k, Lifestyle 250k/5k)
- `export const TARGET_DISTRIBUTION_PILOT = { viral: 10, average: 20, under: 20 } as const` — D-01 pilot
- `export const TARGET_DISTRIBUTION_FULL = { viral: 100, average: 200, under: 200 } as const` — D-01 full
- `export const MAX_PER_NICHE_REGRESSION_PP = 0.05` — D-15 (per-niche floor, 5 percentage points)
- `export function requiredImprovementFor(baselineMacroF1: number): number` — D-18 sliding scale
  - `if (baselineMacroF1 <= 0.40) return 0.15;`
  - `if (baselineMacroF1 <= 0.55) return 0.10;`
  - `return 0.07;`
- `export const BOOTSTRAP_ITERATIONS = 200` — D-17 minimum (CLI flag overrides)
- `export const SIGNIFICANCE_ALPHA = 0.05` — D-17 p-value threshold
- `export const MIN_VIEWS_FOR_MAE_ENGAGEMENT = 1000` — Pitfall 4: noise threshold for engagement-rate MAE
- `export const VIRAL_SCORE_CUT = 70`, `export const UNDER_SCORE_CUT = 30` — bucketFromScore() Phase 1 simplification

CRITICAL: do NOT redefine `ENGINE_VERSION` here — IMPORT from `../aggregator` when needed downstream (D-21). This file is constants-only; no functions besides `requiredImprovementFor`.

**src/lib/engine/corpus/thresholds.ts** — per RESEARCH.md §"Pattern 2" and PATTERNS.md §6:

```typescript
import type { Niche, Bucket } from "./eval-config";
import { NICHE_THRESHOLDS } from "./eval-config";

/** corpus_version identifier — D-12 semver-style. */
export type CorpusVersion = `${"pilot" | "full"}.${string}`;

export interface NicheThresholds {
  viralFloor: number;     // ≥ → viral (D-10 hard cutoff)
  underCeiling: number;   // ≤ → under
}

export type ThresholdsByNiche = Record<Niche, NicheThresholds>;

/**
 * Threshold snapshots — one entry per corpus_version.
 * Add new entries; NEVER edit existing ones (D-13 immutability).
 *
 * Plan F (pilot retrospective) appends the empirically-recalibrated
 * "full.YYYY-MM-DD" entry; Phase 1 ships only the pilot snapshot.
 */
const THRESHOLD_SNAPSHOTS: Record<string, ThresholdsByNiche> = {
  "pilot.2026-05-12": NICHE_THRESHOLDS,
  // "full.2026-05-XX": { ... } — Plan F writes this after pilot recalibration
};

export function getThresholds(version: CorpusVersion | string): ThresholdsByNiche {
  const snap = THRESHOLD_SNAPSHOTS[version];
  if (!snap) {
    throw new Error(
      `Unknown corpus_version: ${version}. Add a snapshot to THRESHOLD_SNAPSHOTS before evaluating.`,
    );
  }
  return snap;
}

/** Test/debug helper — lists all known versions. NOT for production code. */
export function listKnownVersions(): string[] {
  return Object.keys(THRESHOLD_SNAPSHOTS);
}
```

**src/lib/engine/corpus/bucketing.ts** — per PATTERNS.md §1:

```typescript
import type { Niche, Bucket } from "./eval-config";
import type { NicheThresholds, ThresholdsByNiche } from "./thresholds";

export interface BucketingInput {
  views: number | bigint;
  niche: Niche;
}

/**
 * Classify a video into one of three outcome buckets using per-niche
 * absolute view thresholds (D-07).
 *
 * Boundary semantics (D-10 hard cutoff, no exclusion zone):
 *   views >= viralFloor → "viral"
 *   views <= underCeiling → "under"
 *   otherwise → "average"
 *
 * Pure function. Thresholds are snapshot per corpus_version (D-13).
 * Caller must pass the materialized snapshot.
 */
export function bucketByViews(
  input: BucketingInput,
  thresholds: ThresholdsByNiche,
): Bucket {
  const t = thresholds[input.niche];
  if (!t) return "average"; // safe default for unknown niche (guard per PATTERNS §1 pitfall)
  const v = typeof input.views === "bigint" ? Number(input.views) : input.views;
  if (v >= t.viralFloor) return "viral";
  if (v <= t.underCeiling) return "under";
  return "average";
}
```

**Test files** (table-driven per Vitest convention in `__tests__/`):

`__tests__/eval-config.test.ts` covers:
- `requiredImprovementFor` for each band (≤0.40, 0.40–0.55, >0.55) with boundary values
- `NICHES` length is exactly 5 and matches D-03 set
- `NICHE_THRESHOLDS` has entries for all 5 niches with `viralFloor` > `underCeiling`
- Constants: `BOOTSTRAP_ITERATIONS === 200`, `SIGNIFICANCE_ALPHA === 0.05`, `MAX_PER_NICHE_REGRESSION_PP === 0.05`

`__tests__/thresholds.test.ts` covers:
- `getThresholds("pilot.2026-05-12")` returns object with all 5 niche keys
- `getThresholds("nonexistent")` throws
- `listKnownVersions()` includes the pilot version

`__tests__/bucketing.test.ts` covers:
- Table-driven boundary tests for beauty + comedy (different thresholds): test view counts at and around each threshold for hard cutoff semantics (D-10)
- bigint input handling
- Unknown niche → "average" default (no throw)

Run tests after writing them; fix any failures by adjusting the implementation (not the tests).
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/eval-config.test.ts src/lib/engine/corpus/__tests__/thresholds.test.ts src/lib/engine/corpus/__tests__/bucketing.test.ts</automated>
  </verify>
  <done>All three test files pass. Files exist, exports match the contract above, no `as any` / `!` non-null assertions used (per PATTERNS §1 pitfall).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Macro-F1, paired bootstrap, score-to-bucket — eval metric math</name>
  <files>src/lib/engine/corpus/metrics/macro-f1.ts, src/lib/engine/corpus/metrics/bootstrap.ts, src/lib/engine/corpus/metrics/score-to-bucket.ts, src/lib/engine/corpus/__tests__/macro-f1.test.ts, src/lib/engine/corpus/__tests__/bootstrap.test.ts</files>
  <behavior>
**Macro-F1** (against scikit-learn fixtures):
- 3-class confusion matrix `[[2, 0, 0], [1, 2, 0], [0, 1, 2]]` (8 samples, perfect on viral, 1 fp avg, 1 fp under) → macro-F1 matches sklearn `f1_score(y_true, y_pred, average='macro')` to 4 decimal places
- Empty input → throws or returns 0 per spec
- Mismatched array lengths → throws
- All-correct case (perfect predictor) → macro-F1 === 1.0
- All-wrong case → macro-F1 between 0 and ~0.3 depending on bias

**Paired bootstrap:**
- Same `seed=42`, same inputs → same `pValue` across two consecutive calls (deterministic)
- B identical to A → `observedDelta === 0`, `pValue ≈ 0.5` (no improvement, half of bootstrap samples will be ≥ 0)
- B strictly better than A (50 predictions, B correct on 5 extra) → `pValue < 0.05`
- Mismatched lengths → throws
- 200 iters minimum enforced (per D-17)

**bucketFromScore:**
- `bucketFromScore(85, "beauty")` → "viral" (≥70)
- `bucketFromScore(70, "beauty")` → "viral" (boundary inclusive per VIRAL_SCORE_CUT)
- `bucketFromScore(50, "beauty")` → "average"
- `bucketFromScore(30, "beauty")` → "under" (boundary inclusive per UNDER_SCORE_CUT)
- `bucketFromScore(10, "beauty")` → "under"
- Niche argument currently unused (Phase 1 simplification — Phase 10 calibrates per-niche)
  </behavior>
  <action>
**src/lib/engine/corpus/metrics/macro-f1.ts** — per RESEARCH §"Pattern 1" + PATTERNS §5:

```typescript
import type { Bucket } from "../eval-config";

const CLASSES: Bucket[] = ["viral", "average", "under"];

export interface F1PerClass {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface MacroF1Result {
  macroF1: number;
  perClass: Record<Bucket, F1PerClass>;
  confusionMatrix: number[][]; // [actual][predicted], rows/cols in CLASSES order
}

/** Pure function: macro-F1 for 3-class bucket classification (D-14). */
export function computeMacroF1(
  predicted: Bucket[],
  actual: Bucket[],
): MacroF1Result {
  if (predicted.length !== actual.length) {
    throw new Error("predicted and actual must be the same length");
  }
  if (predicted.length === 0) {
    throw new Error("cannot compute macro-F1 on empty arrays");
  }

  const classIdx: Record<Bucket, number> = { viral: 0, average: 1, under: 2 };
  const cm: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < predicted.length; i++) {
    const a = actual[i]!;
    const p = predicted[i]!;
    cm[classIdx[a]]![classIdx[p]]!++;
  }

  const perClass = {} as Record<Bucket, F1PerClass>;
  for (const c of CLASSES) {
    const idx = classIdx[c];
    const tp = cm[idx]![idx]!;
    const fp = cm.reduce((s, row, r) => s + (r === idx ? 0 : row[idx]!), 0);
    const fn = cm[idx]!.reduce((s, v, p) => s + (p === idx ? 0 : v), 0);
    const support = tp + fn;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perClass[c] = {
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
      support,
    };
  }

  const macroF1 = round4(CLASSES.reduce((s, c) => s + perClass[c].f1, 0) / CLASSES.length);
  return { macroF1, perClass, confusionMatrix: cm };
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
```

**src/lib/engine/corpus/metrics/bootstrap.ts** — per RESEARCH §D.1 + PATTERNS §5 (mulberry32 from ml.ts:85-93):

```typescript
import type { Bucket } from "../eval-config";
import { computeMacroF1 } from "./macro-f1";

export interface BootstrapResult {
  pValue: number;
  observedDelta: number;
  ci95: [number, number];
  iterations: number;
}

/**
 * Paired bootstrap test: does engine B have a HIGHER macro-F1 than engine A?
 * H0: B's macro-F1 ≤ A's macro-F1. Reject if pValue < SIGNIFICANCE_ALPHA (D-17).
 *
 * Inputs are PAIRED — predictedA[i] and predictedB[i] are predictions for the
 * SAME corpus row (the actuals at position i). Same-corpus comparison only
 * (Pitfall 6).
 */
export function pairedBootstrapMacroF1(
  predictedA: Bucket[],
  predictedB: Bucket[],
  actual: Bucket[],
  iters: number = 200,  // D-17 minimum
  seed: number = 42,
): BootstrapResult {
  if (predictedA.length !== predictedB.length || predictedA.length !== actual.length) {
    throw new Error("predictedA, predictedB, actual must all be the same length");
  }
  if (iters < 200) {
    throw new Error(`bootstrap iters must be >= 200 (D-17), got ${iters}`);
  }
  const n = actual.length;

  const observedDelta =
    computeMacroF1(predictedB, actual).macroF1 -
    computeMacroF1(predictedA, actual).macroF1;

  const rng = mulberry32(seed);
  const deltas: number[] = [];

  for (let it = 0; it < iters; it++) {
    // Resample paired indices with replacement
    const idx: number[] = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);

    const sampleA: Bucket[] = idx.map((i) => predictedA[i]!);
    const sampleB: Bucket[] = idx.map((i) => predictedB[i]!);
    const sampleY: Bucket[] = idx.map((i) => actual[i]!);

    const delta =
      computeMacroF1(sampleB, sampleY).macroF1 -
      computeMacroF1(sampleA, sampleY).macroF1;
    deltas.push(delta);
  }

  // One-sided p-value: fraction of bootstrap deltas ≤ 0 (i.e., B is NOT better)
  const pValue = deltas.filter((d) => d <= 0).length / iters;

  // 95% CI on the delta distribution (percentile method)
  deltas.sort((a, b) => a - b);
  const lo = deltas[Math.floor(0.025 * iters)]!;
  const hi = deltas[Math.ceil(0.975 * iters) - 1]!;

  return {
    pValue: round4(pValue),
    observedDelta: round4(observedDelta),
    ci95: [round4(lo), round4(hi)],
    iterations: iters,
  };
}

/** mulberry32 — seeded RNG. Copy of ml.ts:85-93 idiom for cross-module consistency. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
```

**src/lib/engine/corpus/metrics/score-to-bucket.ts** — per RESEARCH §C.2:

```typescript
import type { Bucket, Niche } from "../eval-config";
import { VIRAL_SCORE_CUT, UNDER_SCORE_CUT } from "../eval-config";

/**
 * Map the engine's continuous overall_score (0-100) to a bucket label.
 * Phase 1 simplification: same cuts for all niches. Phase 10 (ML audit +
 * calibration) revisits per-niche cuts. Niche arg currently unused but
 * preserved in the signature for forward compatibility.
 */
export function bucketFromScore(score: number, _niche: Niche): Bucket {
  if (score >= VIRAL_SCORE_CUT) return "viral";
  if (score <= UNDER_SCORE_CUT) return "under";
  return "average";
}
```

**Tests:**

`__tests__/macro-f1.test.ts`:
- Fixture: 8 samples with known [actual, predicted] pairs producing a confusion matrix `[[2,0,0],[1,2,0],[0,1,2]]`. Compute by hand (or via sklearn pre-run) the expected macro-F1 and assert exact match to 4 decimals.
- Perfect predictor (all match) → macroF1 === 1.0
- Empty arrays throw
- Mismatched lengths throw
- All-wrong → macroF1 < 0.5

`__tests__/bootstrap.test.ts`:
- Deterministic: same inputs + seed → identical pValue across two calls
- A === B (same predictions) → pValue ≈ 0.5 (allow ± 0.05 tolerance — bootstrap noise)
- B strictly better → pValue < 0.05 (use 60-sample fixture where B is correct on 10 more)
- iters < 200 throws
- Mismatched lengths throw

Run tests after writing them; fix any failures by adjusting the implementation (not the tests).
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/macro-f1.test.ts src/lib/engine/corpus/__tests__/bootstrap.test.ts</automated>
  </verify>
  <done>Both test files pass with the deterministic seed guarantee. confused-matrix fixture matches expected macro-F1 to 4 decimals.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Leave-one-out, stage-latency, metrics index — completes the metrics module</name>
  <files>src/lib/engine/corpus/metrics/leave-one-out.ts, src/lib/engine/corpus/metrics/stage-latency.ts, src/lib/engine/corpus/metrics/index.ts, src/lib/engine/corpus/__tests__/leave-one-out.test.ts, src/lib/engine/corpus/__tests__/stage-latency.test.ts</files>
  <behavior>
**Leave-one-out** (per RESEARCH §C.3 caveat — replicate aggregator math, no engine code change):
- `scoreWithoutSignal(stub, "behavioral", baseScores)` with all signals at score 50 → returns weighted aggregate excluding the behavioral 0.35 weight; remaining weights renormalize to sum=1
- Forcing every signal off in sequence yields 5 distinct ablation scores (assuming non-equal base scores)
- Sum of (baseline - ablation) absolute values across all 5 signals is non-zero for non-uniform input scores
- Forcing a signal whose base contribution is 0 has minimal effect on the aggregate

**Stage latency:**
- `aggregateStageLatencies([])` returns empty array
- `aggregateStageLatencies([[{stage:"gemini",duration_ms:100},{stage:"gemini",duration_ms:200}]])` returns one record for "gemini" with p50=150, count=2
- p50/p95/p99 computed via linear interpolation matching `quantile()` from RESEARCH §C.8

**Index:**
- `metrics/index.ts` re-exports `computeECE` from `../../calibration` (single source of truth per CONTEXT line 124) plus all other metric exports
  </behavior>
  <action>
**src/lib/engine/corpus/metrics/leave-one-out.ts** — per RESEARCH §C.3 caveat and PATTERNS §5:

```typescript
import type { Bucket } from "../eval-config";

/**
 * Per-signal LOO score computation, replicating aggregator.selectWeights math
 * directly (per RESEARCH §C.3 caveat — Pitfall 7).
 *
 * We do NOT call aggregator.aggregateScores() with a mutated PipelineResult,
 * because aggregator's signal-availability detection relies on warning-string
 * matching that is fragile to refactors. Instead, given the five base signal
 * scores and a flag for which signal to force unavailable, we replicate the
 * selectWeights redistribution and return the resulting weighted aggregate.
 */

export const SCORE_WEIGHTS_BASE = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
} as const;

export type Signal = keyof typeof SCORE_WEIGHTS_BASE;
export const SIGNALS: Signal[] = ["behavioral", "gemini", "ml", "rules", "trends"];

export interface SignalScores {
  behavioral: number;
  gemini: number;
  ml: number;
  rules: number;
  trends: number;
}

/**
 * Compute the engine's weighted aggregate when one signal is forced unavailable.
 * Weights of the missing signal are redistributed PROPORTIONALLY to the
 * remaining signals (matches aggregator.selectWeights at aggregator.ts:50-85).
 */
export function scoreWithoutSignal(
  signals: SignalScores,
  forceUnavailable: Signal,
): number {
  const available = SIGNALS.filter((s) => s !== forceUnavailable);
  const baseSum = available.reduce((s, k) => s + SCORE_WEIGHTS_BASE[k], 0);
  if (baseSum === 0) return 0;

  let weighted = 0;
  for (const sig of available) {
    const normalizedWeight = SCORE_WEIGHTS_BASE[sig] / baseSum;
    weighted += signals[sig] * normalizedWeight;
  }
  return Math.round(weighted * 100) / 100; // 2-dec like aggregator output
}

/** Compute the baseline (all signals available) using the canonical weights. */
export function scoreBaseline(signals: SignalScores): number {
  let weighted = 0;
  for (const sig of SIGNALS) weighted += signals[sig] * SCORE_WEIGHTS_BASE[sig];
  return Math.round(weighted * 100) / 100;
}
```

**src/lib/engine/corpus/metrics/stage-latency.ts** — per RESEARCH §C.8 + pipeline.ts StageTiming:

```typescript
import type { StageTiming } from "@/lib/engine/pipeline";

export interface StageLatencyMetric {
  stage: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  count: number;
}

/**
 * Aggregate per-stage latency across N pipeline runs.
 * Input: timings[][]: outer index = run, inner = per-stage timing array
 * Output: one metric record per unique stage name.
 */
export function aggregateStageLatencies(
  allRunsTimings: StageTiming[][],
): StageLatencyMetric[] {
  const byStage = new Map<string, number[]>();
  for (const runTimings of allRunsTimings) {
    for (const t of runTimings) {
      if (!byStage.has(t.stage)) byStage.set(t.stage, []);
      byStage.get(t.stage)!.push(t.duration_ms);
    }
  }
  return Array.from(byStage.entries()).map(([stage, ds]) => ({
    stage,
    p50_ms: quantile(ds, 0.5),
    p95_ms: quantile(ds, 0.95),
    p99_ms: quantile(ds, 0.99),
    count: ds.length,
  }));
}

/** Linear-interpolation quantile (matches RESEARCH §C.8 implementation). */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
```

**src/lib/engine/corpus/metrics/index.ts** — barrel + re-export of ECE (RESEARCH §C.4 + PATTERNS §5):

```typescript
// Single source of truth: re-export ECE from the existing calibration module.
// Do NOT reimplement — see CONTEXT.md line 124.
export { computeECE } from "@/lib/engine/calibration";

export * from "./macro-f1";
export * from "./bootstrap";
export * from "./score-to-bucket";
export * from "./leave-one-out";
export * from "./stage-latency";
```

**Tests:**

`__tests__/leave-one-out.test.ts`:
- All-signals-50 input: `scoreBaseline({...all 50})` → 50.0 (weights sum to 1.0)
- `scoreWithoutSignal({all 50}, "behavioral")` → 50.0 (uniform input → ablation should also be 50)
- Non-uniform input `{behavioral:80, gemini:20, ml:50, rules:50, trends:50}` → `scoreWithoutSignal` for "behavioral" differs from baseline by a measurable amount
- Validate proportional redistribution: weights without "behavioral" should sum to exactly 1.0 (assert numerical: sum of `SCORE_WEIGHTS_BASE[s]/baseSum` for s !== "behavioral" === 1)

`__tests__/stage-latency.test.ts`:
- Empty input → []
- Single run, single stage `[{stage:"a",duration_ms:100}]` → p50=p95=p99=100, count=1
- Multi-run, multi-stage with known values — verify p50 matches median, p95 matches 95th percentile by linear interpolation
- `quantile([1,2,3,4,5], 0.5)` → 3 (exact midpoint)
- `quantile([1,2,3,4], 0.5)` → 2.5 (linear interp between positions 1.5)

Run tests after writing them; fix any failures by adjusting the implementation (not the tests).
  </action>
  <verify>
    <automated>npx vitest run src/lib/engine/corpus/__tests__/leave-one-out.test.ts src/lib/engine/corpus/__tests__/stage-latency.test.ts && grep -q 'export.*computeECE' src/lib/engine/corpus/metrics/index.ts && npx vitest run src/lib/engine/corpus/__tests__/ --coverage 2>&1 | tail -20</automated>
  </verify>
  <done>Both test files pass. metrics/index.ts re-exports computeECE. Coverage report shows corpus module ≥80% (run after all 3 tasks complete).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Pure-function module → callers | All exports here are pure; no I/O, no DB, no network. Trust boundary is solely on input validation (which is in this module's tests). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-B-01 | Tampering | Bootstrap seed reproducibility under floating-point noise | mitigate | Deterministic seed test asserts pValue equality across two calls with identical inputs. mulberry32 RNG matches the existing pattern at ml.ts:85-93. |
| T-01-B-02 | Information disclosure | Threshold constants are public knowledge | accept | Public-by-design (cross-linked to .planning/research/v2.1-baseline.md). Threshold formula constants are not secrets. |
| T-01-B-03 | Tampering | THRESHOLD_SNAPSHOTS edited post-seal | mitigate | Tests assert pilot.2026-05-12 has the exact D-08 values. Plan F appends NEW entries (full.YYYY-MM-DD), never edits existing. |
</threat_model>

<verification>
- `npx vitest run src/lib/engine/corpus/__tests__/` passes (all 7 new test files)
- `npx vitest run src/lib/engine/corpus/__tests__/ --coverage` reports ≥80% line/branch coverage on the corpus module
- `npx tsc --noEmit` passes with no new errors
- No file imports from `apify-client` or `@/lib/supabase/*` (this plan is pure-function only)
</verification>

<success_criteria>
1. All 7 test files exist and pass
2. Pure-function module compiles under TypeScript strict mode (no `any`, no `!` non-null assertions where guards are required per PATTERNS §1)
3. ECE is re-exported from `../../calibration` — NOT reimplemented
4. `requiredImprovementFor` honors the exact D-18 sliding scale (15%/10%/7%)
5. Bootstrap is deterministic with `seed=42`, enforces ≥200 iters (D-17)
6. Bucketing applies hard cutoff (D-10) at boundary values
</success_criteria>

<requirement_coverage>
| Requirement | Cross-link | Task |
|---|---|---|
| CORPUS-05 | REQUIREMENTS.md §Training Corpus | T1 (bucketing.ts) |
| EVAL-02 | REQUIREMENTS.md §Evaluation Framework | T2 (macro-f1.ts) |
| EVAL-03 | REQUIREMENTS.md §Evaluation Framework | T3 (leave-one-out.ts) |
| EVAL-04 | REQUIREMENTS.md §Evaluation Framework | T3 (metrics/index.ts re-exports computeECE) |
| EVAL-05 | REQUIREMENTS.md §Evaluation Framework | T2 (bootstrap.ts paired test) |
| EVAL-07 | REQUIREMENTS.md §Evaluation Framework | T1 (requiredImprovementFor in eval-config.ts) |
</requirement_coverage>

<out_of_scope>
- DB I/O (Plan A migrations land first; Plan E eval-runner consumes these pure helpers)
- Apify orchestration (Plan C/D)
- CLI script (Plan E)
- Actual measured v2.1 baseline (Plan G)
- The `full.YYYY-MM-DD` corpus_version threshold entry (Plan F adds it after pilot recalibration)
- Per-niche ECE expansion (RESEARCH §C.4 notes per-class ECE is a "future extension"; Phase 1 uses the binary `did we predict viral?` mapping if needed downstream)
</out_of_scope>

<output>
After completion, create `.planning/phases/01-training-corpus-eval-foundation/01-B-SUMMARY.md` per `@$HOME/.claude/get-shit-done/templates/summary.md`.
</output>
