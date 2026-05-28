# Phase 15: Calibration Refit on Qwen Corpus - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 7 (1 new + 6 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/<stamp>_platt_engine_version.sql` (NEW) | migration | DDL + backfill | `supabase/migrations/20260512000100_benchmark_results.sql` (composite-index shape) + `supabase/migrations/20260520000000_phase10_platt_parameters.sql` (target table) | role-match (no exact ADD COLUMN + backfill analog in tree; assemble from two templates) |
| `src/types/database.types.ts` (REGEN) | generated types | build-time artifact | regenerated via Supabase CLI per Phase 14 D-07 idiom (no hand-edit analog) | n/a — generated |
| `src/lib/engine/calibration.ts` (MODIFY) | service/library | request-response + cache | self (already has `getPlattParameters`); cache-key namespacing analog: `prediction-cache.ts` keying on `ENGINE_VERSION` | exact (in-place signature + cache-key change) |
| `src/lib/engine/corpus/cli/train-platt.ts` (MODIFY) | CLI / batch script | offline batch + DB INSERT | self (existing `getArg`/`hasFlag`); sibling pattern: `src/lib/engine/corpus/cli/eval-args.ts` already has `--engine-version` parsing at line 79 | exact (sibling CLI is canonical pattern) |
| `src/lib/engine/corpus/eval-config.ts` (MODIFY) | config constants | compile-time | self (lines 83-84 `VIRAL_SCORE_CUT`, `UNDER_SCORE_CUT`) | exact (constant flips only) |
| `src/lib/engine/aggregator.ts` (MODIFY — 2 sites) | engine library | async pipeline | self — lines 844-846 (wiring flip site) + line 50 (`SCORE_WEIGHTS.platform_fit` weight) | exact (in-place edits) |
| `src/lib/engine/__tests__/aggregator.test.ts` (MODIFY) | test | unit + mock | self (line 434 negative test + line 440 calibration-debt test); mock idiom at lines 46-49 | exact |
| `src/lib/engine/__tests__/calibration.test.ts` (MODIFY — additive `it` blocks) | test | unit + mock | self (existing 473 LOC; mock chain at lines 24-67; cache mock at line 60-67) | exact |
| `.planning/research/qwen-stratified-validation.md` (NEW) | research doc | doc | `git show main:.planning/research/v2.1-baseline.md` (baseline doc structure) | role-match (fetched out-of-worktree) |

## Pattern Assignments

### `supabase/migrations/<stamp>_platt_engine_version.sql` (migration, DDL + backfill)

**Analogs:**
- Column shape + composite index: `supabase/migrations/20260512000100_benchmark_results.sql`
- Target table current schema: `supabase/migrations/20260520000000_phase10_platt_parameters.sql`

**Imports pattern:** N/A (SQL only).

**Schema header / docblock pattern** (from `20260520000000_phase10_platt_parameters.sql:1-11`):
```sql
-- Phase 10: Platt calibration parameters for engine v3 score calibration.
--
-- Stores the fitted Platt scaling parameters (slope A, intercept B) used to
-- calibrate uncalibrated model scores into well-calibrated probabilities.
-- ...
-- Service role bypasses RLS for writes (ML pipeline → service client).
-- All statements use IF NOT EXISTS for idempotent re-runs.
```
Apply: lead the new migration with a 5-10 line docblock citing Phase 15 + CALIB-01 + D-01/D-02/D-03.

**`engine_version TEXT NOT NULL` column shape** (`20260512000100_benchmark_results.sql:27-28`):
```sql
corpus_version TEXT NOT NULL,
engine_version TEXT NOT NULL,                               -- "2.1.0" for baseline (D-21)
```
Use the inline comment idiom to mark backfill value (`'2.1.0'`) inline.

**Composite index pattern** (`20260512000100_benchmark_results.sql:66`):
```sql
CREATE INDEX idx_benchmark_results_corpus_engine ON benchmark_results(corpus_version, engine_version);
```
Adapt to D-03: `CREATE INDEX idx_platt_parameters_engine_created ON platt_parameters(engine_version, created_at DESC);`

**Atomic three-step ADD/UPDATE/SET NOT NULL** (Pattern 1 per RESEARCH.md — no in-tree analog; assemble per PostgreSQL idiom):
```sql
ALTER TABLE platt_parameters ADD COLUMN engine_version TEXT;
UPDATE platt_parameters SET engine_version = '2.1.0' WHERE engine_version IS NULL;
ALTER TABLE platt_parameters ALTER COLUMN engine_version SET NOT NULL;
CREATE INDEX idx_platt_parameters_engine_created ON platt_parameters(engine_version, created_at DESC);
```

**RLS pattern** (`20260520000000_phase10_platt_parameters.sql:23-24`):
```sql
ALTER TABLE platt_parameters ENABLE ROW LEVEL SECURITY;
-- (no policies — service role bypasses)
```
Already enabled on `platt_parameters`. No change in this migration.

**Filename stamp:** Use 14-digit local timestamp matching repo convention (`YYYYMMDDHHMMSS_*.sql`); Supabase re-stamps on apply. Latest in tree: `20260520100000_*.sql`. New stamp must be lexically greater.

---

### `src/types/database.types.ts` (regen artifact)

**Analog:** Phase 14 D-07 idiom. No hand-edit pattern — pure regen.

**Regen command** (canonical, per RESEARCH.md):
```bash
pnpm exec supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts
```
Do NOT use `--linked` flag (Phase 14 D-07 explicit constraint). Do NOT hand-patch (Phase 14 D-09 hand-patch rejection rule). Commit in same atomic commit as the migration.

---

### `src/lib/engine/calibration.ts` (service, request-response + cache)

**Analog:** Self (in-place modification of `getPlattParameters` at line 323 + cache key at line 312).

**Cache key namespacing pattern** (current `src/lib/engine/calibration.ts:309-313`):
```typescript
/** 24-hour TTL cache for fitted Platt parameters */
const plattCache = createCache<PlattCacheEntry>(24 * 60 * 60 * 1000);

const PLATT_CACHE_KEY = "platt-params";
```

**After (D-04):**
```typescript
import { ENGINE_VERSION } from "./version";

export async function getPlattParameters(
  engineVersion: string = ENGINE_VERSION,
): Promise<PlattParameters | null> {
  const cacheKey = `platt-params:${engineVersion}`;
  const cached = plattCache.get(cacheKey);
  if (cached !== null) return cached.params;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("platt_parameters")
    .select("a, b, fitted_at, sample_count, engine_version")
    .eq("engine_version", engineVersion)        // NEW filter
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  // ... PGRST116 + log + map to PlattParameters unchanged ...
  plattCache.set(cacheKey, { params });
  return params;
}
```

**Cache-null-wrapper idiom** (`calibration.ts:299-307` — preserve verbatim):
```typescript
/**
 * Wrapper to distinguish "not in cache" (null) from "cached null result"
 * (insufficient data). Without this, a null PlattParameters would cause
 * cache.get() to return null, which looks like a miss, triggering re-fetch
 * on every call.
 */
interface PlattCacheEntry {
  params: PlattParameters | null;
}
```

---

### `src/lib/engine/corpus/cli/train-platt.ts` (CLI script, offline batch)

**Primary analog:** Self (lines 47-61 `getArg`/`hasFlag`, lines 76-78 version-arg parsing, lines 153-162 INSERT).
**Sibling pattern analog:** `src/lib/engine/corpus/cli/eval-args.ts:79` — already implements `--engine-version` flag.

**Imports pattern** (`train-platt.ts:19-39`):
```typescript
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../../../../.env.local") });

// ... tsconfig-paths register block ...

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runEvalOverCorpus } = require("@/lib/engine/corpus/eval-runner");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fitPlattScaling } = require("@/lib/engine/calibration");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("@/lib/supabase/service");
```
Add: `const { ENGINE_VERSION } = require("@/lib/engine/version");` in the same require block.

**CLI flag parse pattern** (`train-platt.ts:47-61` — `getArg` + `hasFlag` helpers, reuse verbatim):
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

**Flag default-from-constant pattern** (`eval-args.ts:79` — adapt for train-platt):
```typescript
// Add alongside lines 76-78 in train-platt.ts:
const engineVersionArg = getArg(argv, "--engine-version");
const engineVersion = engineVersionArg ?? ENGINE_VERSION;
```

**Version-string validation pattern** (`train-platt.ts:82-88` — reuse shape for new flag; ASVS V5 per RESEARCH.md):
```typescript
const versionRegex = /^(pilot|full)\.\d{4}-\d{2}-\d{2}$/;
if (!versionRegex.test(version)) {
  err(`Invalid version format: "${version}". Expected pattern: (pilot|full).YYYY-MM-DD`);
  process.exit(1);
}
```
Add identical-shape regex for `--engine-version`: `/^\d+\.\d+\.\d+(-[\w.]+)?$/`.

**INSERT pattern** (`train-platt.ts:153-162` — add one field):
```typescript
const supabase = createServiceClient();
const { error: insertError } = await supabase
  .from("platt_parameters")
  .insert({
    a: params.a,
    b: params.b,
    fitted_at: params.fittedAt,
    sample_count: params.sampleCount,
    engine_version: engineVersion,   // NEW field
  });
```

**runEvalOverCorpus invocation pattern** (`train-platt.ts:99-104` — keep cost-cap shape):
```typescript
const results = await runEvalOverCorpus({
  corpusVersion: version,
  maxRows,
  maxTotalCostCents: 5000,            // D-08: $50 ceiling preserved
  rateLimitDelayMs: 2000,             // D-08 default; CONTEXT discretion may tune down
});
```

**Cost-logging pattern** (D-08 — no current analog logging `cost_cents_total` to stdout). Add per D-08 requirement: aggregate `row.cost_cents` across `results`, emit `log` line:
```typescript
const totalCostCents = results.reduce((s, r) => s + (r.cost_cents ?? 0), 0);
log(`cost_cents_total: ${totalCostCents.toFixed(2)}`);
if (totalCostCents > 3000) warn(`Cost exceeded $30 — flag as deviation per D-08`);
```

---

### `src/lib/engine/corpus/eval-config.ts` (config, compile-time)

**Analog:** Self, lines 83-84 (existing constants).

**Constant edit pattern** (`eval-config.ts:82-84`):
```typescript
// BEFORE
// score-to-bucket Phase 1 cuts (Phase 10 calibrates per-niche).
export const VIRAL_SCORE_CUT = 70;
export const UNDER_SCORE_CUT = 30;

// AFTER (Plan 15-03 — values TBD by sweep)
// Phase 15 (CALIB-03 / D-09): Re-tuned on Qwen full.2026-05-11 corpus.
// See .planning/research/qwen-stratified-validation.md §Score-cut grid sweep.
export const VIRAL_SCORE_CUT = <chosen>;
export const UNDER_SCORE_CUT = <chosen>;
```

**Inline-comment idiom** (existing pattern at `eval-config.ts:76`):
```typescript
// D-17: paired bootstrap minimum iterations + significance threshold.
```
Match this style for the Phase 15 retune comment.

---

### `src/lib/engine/aggregator.ts` (engine library, async pipeline) — TWO edit sites

#### Site A: `SCORE_WEIGHTS.platform_fit` weight (line 50) — Plan 15-03

**Pattern** (`aggregator.ts:45-54`):
```typescript
// BEFORE
export const SCORE_WEIGHTS = {
  behavioral:   0.40,
  gemini:       0.35,
  audio:        0.05,
  trends:       0.10,
  platform_fit: 0.05,  // video-derived from Wave 4
  ml:           0,
  retrieval:    0,
  rules:        0,
} as const;
```

**Edit comment style** matches existing inline comment style at line 48 (`// D-32 — audio_perceptual_score real; ...`). Add Phase 15 citation:
```typescript
platform_fit: <chosen>,  // Phase 15 D-11: re-tuned on Qwen corpus, see qwen-stratified-validation.md
```

#### Site B: Wiring flip (lines 844-846) — Plan 15-04

**Pattern** (`aggregator.ts:838-846`):
```typescript
// BEFORE
// -------------------------------------------------
// Platt Calibration (CAL-01: conditional application)
// -------------------------------------------------
// TODO(post-Qwen): Platt parameters were fit on the Gemini+DeepSeek engine.
// Applying them to Qwen-scored outputs mis-calibrates. Bypassed until refit on
// a Qwen-scored corpus. Tracked as calibration debt out of Milestone 1.
const plattParams: PlattParameters | null = null;
const overall_score = applyPlattScaling(raw_overall_score, plattParams);
const is_calibrated = false;
```

**AFTER (D-16/D-17/D-18/D-19):**
```typescript
// -------------------------------------------------
// Platt Calibration (CAL-01 + CALIB-05: re-enabled on Qwen refit)
// -------------------------------------------------
// Phase 15 (CALIB-05): Platt parameters refit on Qwen corpus full.2026-05-11.
// See .planning/research/qwen-stratified-validation.md for tuning report.
// D-18: ENGINE_VERSION passed explicitly to avoid hardcoded literal.
// D-19: getPlattParameters returns null → is_calibrated=false, raw passthrough.
const plattParams = await getPlattParameters(ENGINE_VERSION);
const overall_score = applyPlattScaling(raw_overall_score, plattParams);
const is_calibrated = plattParams !== null;
```

**Import addition needed at top of file** (D-17 — `getPlattParameters` already exported from `./calibration`; current imports include `applyPlattScaling` + `PlattParameters` — add `getPlattParameters` to existing import line). Confirm `ENGINE_VERSION` import from `./version` is present (or add).

---

### `src/lib/engine/__tests__/aggregator.test.ts` (test, unit + mock) — Plan 15-04

**Analog:** Self.

**Mock setup pattern** (`aggregator.test.ts:46-49`, hoisted-mock idiom — reuse verbatim):
```typescript
vi.mock("../calibration", () => ({
  getPlattParameters: vi.fn().mockResolvedValue(null),
  applyPlattScaling: vi.fn((score: number, _params: unknown) => score),
}));
```

**Existing test to PRESERVE** (`aggregator.test.ts:434-438`):
```typescript
it("returns is_calibrated=false when no Platt params available", async () => {
  vi.mocked(getPlattParameters).mockResolvedValue(null);
  const result = await aggregateScores(makePipelineResult());
  expect(result.is_calibrated).toBe(false);
});
```
Keep — still describes correct behavior under D-19.

**Existing test to INVERT** (`aggregator.test.ts:440-452` — Pitfall 1 in RESEARCH.md):
```typescript
// BEFORE — calibration-debt regression test
it("is_calibrated is hard-coded false post-Qwen migration (calibration debt)", async () => {
  const mockParams = { a: -1, b: 0, fittedAt: "2026-01-01", sampleCount: 100 };
  vi.mocked(getPlattParameters).mockResolvedValue(mockParams);
  vi.mocked(applyPlattScaling).mockReturnValue(55);
  const result = await aggregateScores(makePipelineResult());
  expect(result.is_calibrated).toBe(false);
});
```

**AFTER (D-21):**
```typescript
it("returns is_calibrated=true when v3.0.0 Platt params present (CALIB-05)", async () => {
  const mockParams = { a: -1.2, b: 0.3, fittedAt: "2026-05-24T12:00:00Z", sampleCount: 224 };
  vi.mocked(getPlattParameters).mockResolvedValue(mockParams);
  vi.mocked(applyPlattScaling).mockReturnValue(55);
  const result = await aggregateScores(makePipelineResult());
  expect(result.is_calibrated).toBe(true);
});
```

**Imports pattern** (`aggregator.test.ts:88-92` — already imports `getPlattParameters`, `applyPlattScaling`; no new import needed):
```typescript
import { selectWeights, aggregateScores } from "../aggregator";
import { makePipelineResult, makeGeminiAnalysis } from "./factories";
import { getPlattParameters, applyPlattScaling } from "../calibration";
```

---

### `src/lib/engine/__tests__/calibration.test.ts` (test, unit + mock) — Plan 15-01 additive

**Analog:** Self. Existing test file has the supabase chain mock + cache mock — reuse.

**Supabase chain mock pattern** (`calibration.test.ts:29-58` — reuse verbatim, no edit):
```typescript
const mockSupabaseChain = () => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "not", "gte", "gt", "or", "order", "limit", "single"];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => { resolve(mockOutcomesResult); };
  return chain;
};
```
Note: `.eq` is already in the mocked methods list — supports the new `.eq("engine_version", ...)` call without change.

**Cache mock pattern** (`calibration.test.ts:60-67` — reuse verbatim):
```typescript
const mockCache = new Map<string, unknown>();
vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn((key: string) => mockCache.get(key) ?? null),
    set: vi.fn((key: string, value: unknown) => { mockCache.set(key, value); }),
    invalidate: vi.fn((key: string) => { mockCache.delete(key); }),
  }),
}));
```
The `Map`-backed cache means `mockCache.has("platt-params:3.0.0")` is directly assertable — namespacing test is trivial.

**New test blocks to add** (additive `it` blocks within existing `describe("getPlattParameters", ...)`):
1. `it("filters by engineVersion argument")` — pass `engineVersion: "3.0.0"`, assert mock chain's `.eq` called with `("engine_version", "3.0.0")`.
2. `it("uses default ENGINE_VERSION when arg omitted")` — assert default `"3.0.0"` flows through.
3. `it("namespaces cache key per engineVersion")` — call twice with `"3.0.0"` then `"2.1.0"`, assert two distinct cache keys populated (`platt-params:3.0.0` and `platt-params:2.1.0`).

---

### `.planning/research/qwen-stratified-validation.md` (research doc)

**Analog:** `git show main:.planning/research/v2.1-baseline.md` (out-of-worktree per CONTEXT canonical_refs — must `git show` fresh per `<specifics>` "do not copy-paste").

**Required content checklist** (D-13 — verbatim from CONTEXT):
- macro_f1 (with `engine_version='3.0.0', corpus_version='full.2026-05-11'`)
- per-niche macro_f1 (5 niches)
- per-bucket precision/recall/F1 (3 buckets)
- per-video diff vs v2.1-baseline (list which corpus_row_ids flipped buckets)
- score-band stratification (low/mid/high confidence buckets, with mean ECE per band)
- video-06 snapshot (canonical M1 reference — full prediction shape)
- `cost_cents_total` (train-platt + eval rerun, separately)
- persona parse-rate distribution (per D-10)
- chosen `(VIRAL_SCORE_CUT, UNDER_SCORE_CUT, platform_fit_weight)` triple + macro_f1 grid
- D-12 explicit documentation of REQ-vs-code wording mismatch
- D-14 fallback-branch outcome (which of the three branches landed)

**Heading shape** (from `<specifics>` Claude's Discretion D-13 freedom): match the section style of `15-RESEARCH.md` itself — bolded ID anchors, level-2 sections for each required content block.

---

## Shared Patterns

### Atomic migration + types regen (Phase 14 D-07 idiom)
**Source:** Phase 14 establishes the pattern — single atomic commit covers (1) SQL migration apply, (2) `database.types.ts` regen, (3) all caller-edits that the regen forces. No `.new` files checked in. No hand-edits to generated types.
**Apply to:** Plan 15-01 (single commit covers migration + regen + `calibration.ts` signature change + `train-platt.ts` flag + `calibration.test.ts` new `it` blocks).
**Anti-pattern:** Splitting migration apply from types regen across two commits — leaves intermediate state where TS compiles against stale types.

### Cache-key namespacing per discriminator
**Source:** `src/lib/engine/calibration.ts:312` (current `PLATT_CACHE_KEY = "platt-params"`) → must become `\`platt-params:${engineVersion}\``. Parallel pattern: `src/lib/cache/prediction-cache.ts` already keys on `ENGINE_VERSION` (per Phase 13 D-23 cache invariant noted in `version.ts:6-7`).
**Apply to:** Any file gaining a new discriminator argument that participates in caching. Phase 15 surface: `calibration.ts` only.
**Anti-pattern:** Adding a query filter without updating the cache key — produces stale-cross-version reads.

### Single source of truth for engine version
**Source:** `src/lib/engine/version.ts:9` — `export const ENGINE_VERSION = "3.0.0"`.
**Apply to:** All call sites that need engine_version. Specifically D-04 default + D-07 CLI default + D-18 aggregator pass-through.
**Anti-pattern (D-18 explicit constraint):** Hardcoding `"3.0.0"` string literal at the aggregator call site or anywhere downstream of `version.ts`.

### Sealed-immutable corpus reuse
**Source:** `corpus_version='full.2026-05-11'` (225 rows) — per D-06, do NOT re-scrape.
**Apply to:** Plan 15-02 train-platt invocation + Plan 15-03 sweep — both reuse the same corpus_version constant.
**Anti-pattern:** Introducing a new `corpus_version` to "freshen" the data — would invalidate v2.1 comparability.

### Mock-then-import test ordering (Vitest hoisted-mock idiom)
**Source:** `src/lib/engine/__tests__/aggregator.test.ts:46-49` (mocks before imports). Same pattern in `calibration.test.ts:24-67`.
**Apply to:** All new `it` blocks in Plan 15-01 (`calibration.test.ts`) and Plan 15-04 (`aggregator.test.ts`).
**Anti-pattern:** Importing the SUT before `vi.mock` calls — mocks won't apply.

### Sweep reuses cached predictions, not re-runs eval
**Source:** RESEARCH.md Pitfall 3 — the engine runs ONCE per corpus row in Plan 15-02. Plan 15-03 sweep varies only `bucketFromScore` cuts and `platform_fit_weight` linear-combination weight against already-computed component scores. No re-run of `runEvalOverCorpus` per grid point.
**Apply to:** Plan 15-03 sweep script.
**Anti-pattern:** "rerun eval-harness for each grid point" — 200+ hours; must be "reuse cached predictions; re-bucket and re-weight only."

### Cost-cap log + flag-as-deviation idiom
**Source:** D-08 + RESEARCH.md Pitfall 4. No in-tree analog — Phase 15 adds the pattern.
**Apply to:** Plan 15-02 train-platt stdout + Plan 15-03 sweep + research doc.
**Pattern:** Aggregate `row.cost_cents` post-run, log `cost_cents_total`, warn if > $30, hard-fail at existing $50 cap.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Score-cut + weight sweep harness (Plan 15-03 scaffolding — likely inline in train-platt or new `scripts/sweep-thresholds.ts`) | CLI / batch | offline batch | No existing sweep script in tree. Per RESEARCH.md Pitfall 3, this is a fresh script that consumes cached predictions from Plan 15-02 and runs `bucketFromScore` + linear-combination math in a nested loop. Pattern: borrow CLI shape from `train-platt.ts` (lines 19-44 imports + tsconfig-paths register + dotenv); borrow grid-search logic from RESEARCH.md §System Architecture Diagram §Plan 15-03. |
| Live `/api/analyze` E2E curl + payload capture (Plan 15-04) | manual smoke | live request | No existing E2E harness for `/api/analyze` is in-tree. Per RESEARCH.md Open Question 2, executor must first probe live response shape (curl with current `is_calibrated=false`) to identify exact JSON path, then assert against `is_calibrated: true` + `engine_version` matching. No automation analog — manual curl + payload commit. |

## Metadata

**Analog search scope:**
- `/Users/davideloreti/virtuna-engine-hardening/supabase/migrations/` (26 files)
- `/Users/davideloreti/virtuna-engine-hardening/src/lib/engine/` (verified target files cited in 15-RESEARCH.md §Sources)
- `/Users/davideloreti/virtuna-engine-hardening/src/lib/engine/__tests__/` (30 files)
- `/Users/davideloreti/virtuna-engine-hardening/src/lib/engine/corpus/cli/` (4 files)

**Files scanned:** 6 read directly (migrations: 2; aggregator.ts targeted regions; calibration.ts targeted region; train-platt.ts full; eval-args.ts full; aggregator.test.ts + calibration.test.ts targeted regions; eval-config.ts targeted region; version.ts full).

**Pattern extraction date:** 2026-05-24
