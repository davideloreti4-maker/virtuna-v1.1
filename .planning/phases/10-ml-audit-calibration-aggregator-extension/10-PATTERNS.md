# Phase 10: ML Audit + Calibration + Aggregator Extension - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/corpus/cli/ml-audit.ts` | CLI script | batch (corpus → report) | `scripts/calibrate-thresholds.ts` | exact |
| `src/lib/engine/corpus/cli/train-platt.ts` | CLI script | batch (corpus → DB write) | `scripts/calibrate-thresholds.ts` + `scripts/eval.ts` | exact |
| `supabase/migrations/20260520XXXXXX_phase10_platt_parameters.sql` | migration | - | `supabase/migrations/20260519000000_phase6_audio_fingerprint.sql` | exact |
| `src/lib/engine/calibration.ts` (modify `getPlattParameters`) | service | request-response (DB read → cache) | same file (existing function body swap) | self |
| `src/lib/engine/aggregator.ts` (modify `SCORE_WEIGHTS`, `availability`) | config + service | - | same file (weight constant edits) | self |
| `src/lib/engine/__tests__/aggregator-phase10.test.ts` | test | - | `src/lib/engine/__tests__/aggregator-platform-fit.test.ts` | exact |

---

## Pattern Assignments

### `src/lib/engine/corpus/cli/ml-audit.ts` (CLI script, batch)

**Analog:** `scripts/calibrate-thresholds.ts` (lines 1–201) + `scripts/eval.ts` (lines 1–88)

**Boilerplate header / env + tsconfig-paths bootstrap** (`scripts/calibrate-thresholds.ts` lines 21–37):
```typescript
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../.env.local") });

const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8")
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});
```

**Require-after-register pattern** (`scripts/calibrate-thresholds.ts` lines 40–44):
```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runEvalOverCorpus } = require("../src/lib/engine/corpus/eval-runner");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { scoreWithoutSignal, SIGNALS } = require("../src/lib/engine/corpus/metrics/leave-one-out");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadModelWeights } = require("../src/lib/engine/ml");
```

**Arg-parsing pattern** (`scripts/calibrate-thresholds.ts` lines 52–61):
```typescript
function getArg(argv: string[], flag: string): string | undefined {
  const i = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i < 0) return undefined;
  const a = argv[i]!;
  if (a.includes("=")) return a.split("=", 2)[1];
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) {
    throw new Error(`Flag ${flag} requires a value`);
  }
  return next;
}
```

**Version validation** (`scripts/calibrate-thresholds.ts` lines 74–77):
```typescript
if (!/^(pilot|full)\.\d{4}-\d{2}-\d{2}$/.test(version)) {
  err(`--version must match pilot.YYYY-MM-DD or full.YYYY-MM-DD (got: ${version})`);
  process.exit(1);
}
```

**main() + FATAL catch wrapper** (`scripts/calibrate-thresholds.ts` lines 197–201):
```typescript
main().catch((e) => {
  err(`FATAL: ${e instanceof Error ? e.message : String(e)}`);
  if (e instanceof Error && e.stack) err(e.stack);
  process.exit(1);
});
```

**Core pattern — ML-audit-specific usage of `evaluate()` from `ml.ts`:**

`ml.ts` lines 96–130 expose `evaluate()` as an internal function that returns `{ accuracy, confusionMatrix }`. The ML audit CLI must either:
- Call `runEvalOverCorpus()` to collect `signalScores.ml` per row, then separately map to bucket predictions and compute confusion matrix inline (preferred — text-mode corpus only, no extra cost).
- Or use `scoreWithoutSignal()` (`leave-one-out.ts` lines 61–75) for the LOO delta.

`evaluate()` function signature from `ml.ts` lines 98–130:
```typescript
// internal — not exported; replicate inline or use exported evaluate-adjacent path
function evaluate(
  features: number[][],
  labels: number[],
  weights: number[][],
  biases: number[]
): { accuracy: number; confusionMatrix: number[][] } {
  const confusionMatrix: number[][] = Array.from({ length: NUM_CLASSES }, () =>
    Array.from({ length: NUM_CLASSES }, () => 0)
  );
  let correct = 0;
  for (let i = 0; i < features.length; i++) {
    // predicted === actual bucket comparison
    if (predicted === actual) correct++;
    const row = confusionMatrix[actual];
    if (row !== undefined) row[predicted] = (row[predicted] ?? 0) + 1;
  }
  return { accuracy: features.length > 0 ? correct / features.length : 0, confusionMatrix };
}
```

LOO delta computation (`src/lib/engine/corpus/metrics/leave-one-out.ts` lines 61–75):
```typescript
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
  return round2(weighted);
}
```

**Write-report-to-disk pattern** (`scripts/eval.ts` lines 72–78):
```typescript
if (args.output) {
  const dir = dirname(args.output);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(args.output, JSON.stringify(report, null, 2));
  log(`Wrote JSON report -> ${args.output}`);
}
```

**Error handling** (`scripts/calibrate-thresholds.ts` lines 103–108):
```typescript
try {
  rows = await readRawCache(cachePath);
} catch (e) {
  err(`Failed to read cache file: ${cachePath}`);
  err(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
```

---

### `src/lib/engine/corpus/cli/train-platt.ts` (CLI script, batch → DB write)

**Analog:** `scripts/calibrate-thresholds.ts` (full structure) + `scripts/eval.ts` (require pattern)

**Boilerplate header:** Identical to `ml-audit.ts` above (lines 21–37 of `calibrate-thresholds.ts`).

**Require-after-register pattern** — Platt-specific:
```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runEvalOverCorpus } = require("../src/lib/engine/corpus/eval-runner");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fitPlattScaling } = require("../src/lib/engine/calibration");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");
```

**Corpus pagination pattern** (`src/lib/engine/corpus/eval-runner.ts` lines 80–92):
```typescript
let offset = 0;
const allRows: Array<Record<string, unknown>> = [];
while (true) {
  const { data, error } = await supabase
    .from("training_corpus")
    .select("id, niche, bucket, caption, hashtags, views, ...")
    .eq("corpus_version", opts.corpusVersion)
    .range(offset, offset + FETCH_BATCH - 1);
  if (error) throw new Error(`Corpus fetch failed: ${error.message}`);
  if (!data || data.length === 0) break;
  allRows.push(...data);
  if (data.length < FETCH_BATCH) break;
  offset += FETCH_BATCH;
}
```

**fitPlattScaling call** (`src/lib/engine/calibration.ts` lines 221–267):
```typescript
export function fitPlattScaling(
  pairs: OutcomePair[]  // { predicted: number (0-1), actual: number (0-1) }
): PlattParameters | null {
  // Returns null if pairs.length < 50 (PLATT_MIN_SAMPLES)
  // Returns { a, b, fittedAt, sampleCount } on success
}
```

**DB write pattern** — follow `src/lib/engine/corpus/eval-harness.ts` lines 202–223:
```typescript
const { error } = await supabase.from("platt_parameters").insert({
  a: params.a,
  b: params.b,
  fitted_at: params.fittedAt,
  sample_count: params.sampleCount,
});
if (error) {
  err(`platt_parameters insert failed: ${error.message}`);
  process.exit(1);
}
```

**Bucket → actual mapping** (per RESEARCH Pitfall 4 — binary Platt):
```typescript
// Map corpus bucket string to 0/1 actual for binary Platt fit
function bucketToActual(bucket: string): number {
  if (bucket === "viral") return 1.0;
  if (bucket === "average") return 0.5;
  return 0.0; // "underperforming"
}
```

**Error handling + FATAL wrapper:** Same as `ml-audit.ts` above.

---

### `supabase/migrations/20260520XXXXXX_phase10_platt_parameters.sql` (migration)

**Analog:** `supabase/migrations/20260519000000_phase6_audio_fingerprint.sql` (full file)

**Header comment style** (`20260519000000_phase6_audio_fingerprint.sql` lines 1–9):
```sql
-- Phase 10: Platt Calibration Parameters — platt_parameters table.
-- Per CONTEXT D-08 (schema: id, a, b, fitted_at, sample_count).
-- Written by train-platt.ts CLI; read by getPlattParameters() in calibration.ts.
-- All statements use IF NOT EXISTS for idempotent re-runs.
```

**RLS pattern for service-role-only tables** (`supabase/migrations/20260518000000_phase8_pgvector.sql` lines 1–10 and training_corpus pattern):
```sql
CREATE TABLE IF NOT EXISTS platt_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  a DOUBLE PRECISION NOT NULL,
  b DOUBLE PRECISION NOT NULL,
  fitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: service-role writes only; no anon SELECT needed (same pattern as training_corpus).
ALTER TABLE platt_parameters ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for anon; service role bypasses RLS.
-- No UPDATE/DELETE policy; rows are append-only (train-platt writes one row per run).
```

---

### `src/lib/engine/calibration.ts` — `getPlattParameters()` body update

**File:** `src/lib/engine/calibration.ts`
**Modify:** Lines 323–335 (cache-miss path only — signature and call sites unchanged)

**Current body to replace** (`calibration.ts` lines 323–335):
```typescript
// CURRENT (reads from outcomes table, recomputes):
const supabase = createServiceClient();
const pairs = await fetchOutcomePairs(supabase);
const params = fitPlattScaling(pairs);
plattCache.set(PLATT_CACHE_KEY, { params });
return params;
```

**New body pattern** (RESEARCH Pattern 4):
```typescript
// NEW (reads from platt_parameters table, latest row):
const supabase = createServiceClient();
const { data, error } = await supabase
  .from("platt_parameters")
  .select("a, b, fitted_at, sample_count")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (error && error.code !== "PGRST116") {
  // PGRST116 = no rows found (table empty before first train-platt run)
  log.error("Failed to fetch platt_parameters", { error: error.message });
}

const params: PlattParameters | null = data
  ? { a: data.a, b: data.b, fittedAt: data.fitted_at, sampleCount: data.sample_count }
  : null;

plattCache.set(PLATT_CACHE_KEY, { params });
return params;
```

**Supabase client pattern** (`calibration.ts` line 329 — already in file):
```typescript
import { createServiceClient } from "@/lib/supabase/service";
```

**Error logging pattern** (`calibration.ts` lines 83–88 — already in file):
```typescript
if (error) {
  log.error("Failed to fetch outcome pairs", { error: error.message });
  Sentry.captureException(new Error(error.message), {
    tags: { stage: "calibration" },
  });
  throw new Error(`Failed to fetch outcome pairs: ${error.message}`);
}
```

---

### `src/lib/engine/aggregator.ts` — `SCORE_WEIGHTS` and `availability` edits

**File:** `src/lib/engine/aggregator.ts`
**Modify:** Lines 53–62 (`SCORE_WEIGHTS`), lines 684–729 (`availability` construction)

**Current weight block** (`aggregator.ts` lines 53–62):
```typescript
export const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,          // Phase 10 tunes this (down-weight or disable per audit)
  rules: 0.15,
  trends: 0.10,
  audio: 0.07,
  retrieval: 0.05,   // Phase 10 tunes this (signal ablation)
  platform_fit: 0.05, // Phase 10 tunes this (signal ablation)
} as const;
```

**D-03 down-weight edit pattern** (one-line change):
```typescript
ml: 0.05, // D-03: down-weighted after Phase 10 audit (was 0.15); selectWeights normalizes
```

**D-05 disable pattern** (RESEARCH Pattern 5 — two-part):
```typescript
// Part 1: weight to 0 (aggregator.ts line 56)
ml: 0,  // D-05: disabled after Phase 10 audit

// Part 2: force ml availability false in availability object (aggregator.ts line 689)
ml: false,  // D-05: override even if predictWithML() returns a value
```

**Availability construction reference** (`aggregator.ts` lines 684–729 — existing pattern for adding/changing flags):
```typescript
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: false,     // overwritten below at line 735
  ml: mlAvailable,   // THIS LINE changes to `false` for D-05 disable
  rules: ...,
  trends: ...,
  content_type: ...,
  niche: ...,
  gemini_hook: ...,
  gemini_body: ...,
  gemini_cta: ...,
  personas: ...,
  audio: audioSignals != null,
  audio_fingerprint: audioFingerprintResult !== null,
  retrieval: pipelineResult.retrievalResult.availability,
  platform_fit: ((pipelineResult as ...).platformFitResult?.length ?? 0) > 0,
};
```

---

### `src/lib/engine/__tests__/aggregator-phase10.test.ts` (test, AGG-02 + AGG-06)

**Analog:** `src/lib/engine/__tests__/aggregator-platform-fit.test.ts` (full file — 75 lines)

**Imports + describe block pattern** (`aggregator-platform-fit.test.ts` lines 1–8):
```typescript
import { describe, it, expect } from "vitest";
import { selectWeights } from "../aggregator";

describe("selectWeights — [signal] signal (Phase 10 [requirement])", () => {
```

**Full SignalAvailability object shape** (`aggregator.test.ts` lines 78–91) — ALL keys required to avoid `platform_fit` silent-exclusion pitfall (RESEARCH Pitfall 2):
```typescript
const weights = selectWeights({
  behavioral: true,
  gemini: true,
  ml: true,
  rules: true,
  trends: true,
  content_type: false,
  niche: false,
  gemini_hook: false,
  gemini_body: false,
  gemini_cta: false,
  personas: false,
  audio: true,
  audio_fingerprint: false,
  retrieval: true,
  platform_fit: true,  // MUST be explicit per Pitfall 2
});
```

**Weight sum assertion pattern** (`aggregator-platform-fit.test.ts` lines 57–74):
```typescript
it("weights sum to ~1.0 when [signals] are included", () => {
  const weights = selectWeights({ ...fullAvailability });
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  expect(sum).toBeCloseTo(1, 2);
});
```

**Redistribution assertion pattern** (`aggregator.test.ts` lines 106–130):
```typescript
it("redistributes weight when ML is unavailable", () => {
  const weights = selectWeights({ ...availability, ml: false });
  expect(weights.ml).toBe(0);
  expect(weights.behavioral).toBeGreaterThan(0.33);
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  expect(sum).toBeCloseTo(1, 2);
});
```

---

## Shared Patterns

### Supabase Service Client
**Source:** `src/lib/engine/calibration.ts` lines 1–6
**Apply to:** `train-platt.ts` CLI, `getPlattParameters()` update
```typescript
import { createServiceClient } from "@/lib/supabase/service";
// Usage: const supabase = createServiceClient();
```

### Logger
**Source:** `src/lib/engine/calibration.ts` lines 6
**Apply to:** Any runtime file (not CLI scripts — CLI scripts use `console.log/warn/error` directly)
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "calibration" });
// log.info / log.warn / log.error
```

### CLI Log Helpers
**Source:** `scripts/calibrate-thresholds.ts` lines 46–48
**Apply to:** `ml-audit.ts`, `train-platt.ts`
```typescript
const log = (msg: string) => console.log(msg);
const warn = (msg: string) => console.warn(`[WARN] ${msg}`);
const err = (msg: string) => console.error(`[ERROR] ${msg}`);
```

### Cost Cap in Eval Runner
**Source:** `src/lib/engine/corpus/eval-runner.ts` lines 46–73
**Apply to:** `ml-audit.ts` when calling `runEvalOverCorpus()`
```typescript
// Always pass maxTotalCostCents to avoid unbounded spend (RESEARCH Pitfall 5)
await runEvalOverCorpus({
  corpusVersion: version,
  maxTotalCostCents: 5000,   // $50 hard cap
  rateLimitDelayMs: 2000,    // default; omitting causes rate-limit failures on 225 rows
});
```

### `OutcomePair` Type for Platt
**Source:** `src/lib/engine/calibration.ts` lines 36–39
**Apply to:** `train-platt.ts`
```typescript
export interface OutcomePair {
  predicted: number;  // 0-1 normalized
  actual: number;     // 0-1 normalized (viral=1.0, average=0.5, underperforming=0.0)
}
```

### Migration Header + Idempotency Convention
**Source:** `supabase/migrations/20260519000000_phase6_audio_fingerprint.sql` lines 1–12
**Apply to:** `platt_parameters` migration
- Lead comment: Phase number, decision refs, idempotency statement
- All DDL uses `IF NOT EXISTS`
- `CREATE OR REPLACE` for functions

---

## No Analog Found

None — all Phase 10 files have strong analogs in the codebase.

---

## Metadata

**Analog search scope:** `scripts/`, `src/lib/engine/`, `src/lib/engine/corpus/`, `src/lib/engine/__tests__/`, `supabase/migrations/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-20
