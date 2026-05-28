# Phase 15: Calibration Refit on Qwen Corpus - Research

**Researched:** 2026-05-24
**Domain:** Platt scaling refit + threshold sweep + aggregator wiring for Qwen-scored pipeline
**Confidence:** HIGH

## Summary

This phase is **highly pre-decided** — CONTEXT.md (D-01 through D-23) locks every meaningful architecture choice, including the column-add path for `engine_version`, reuse of `full.2026-05-11` corpus (225 rows), the re-interpretation of CALIB-03 (Wave-3/4 "thresholds" → `VIRAL_SCORE_CUT`/`UNDER_SCORE_CUT` + `SCORE_WEIGHTS.platform_fit`), and the macro_f1 fallback decision tree (D-14). Research's job is **not to re-decide** — it is to confirm the live code matches CONTEXT's assumed shape and surface the load-bearing edit sites + verification commands the planner will encode into tasks.

Every claim in CONTEXT.md about live code was verified by reading the source. The aggregator hardcode (`plattParams = null; is_calibrated = false`) is exactly at lines 844-846; the existing aggregator test suite contains a regression test (`aggregator.test.ts:440`) that **asserts is_calibrated remains false even when Platt params are present** — this is calibration-debt scaffolding from Phase 13 and MUST be removed/inverted in Plan 15-04, otherwise the wiring flip will fail tests. The `benchmark_results` migration (`20260512000100`) is the template pattern for the new `_platt_engine_version.sql` migration — it already shows `engine_version TEXT NOT NULL` + composite index on `(corpus_version, engine_version)`, exactly the shape CONTEXT D-01/D-03 prescribe.

**Primary recommendation:** Sequence plans as CONTEXT D-22 specifies. The schema migration + CLI flag + `getPlattParameters` signature change should land together (Plan 15-01) because they form one type-safe envelope — the `database.types.ts` regen forces every consumer to either accept the new column or break the build. Plans 15-02 (refit run) and 15-03 (sweep + validation doc) flow naturally from there. Plan 15-04 (aggregator flip + test inversion + live E2E) gates on 15-03's macro_f1 number per D-14's three-branch fallback.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**engine_version Discriminator (CALIB-01)**
- **D-01:** Add column `engine_version TEXT NOT NULL` to `platt_parameters` via new Supabase migration. NOT JSONB metadata, NOT application-side filter only.
- **D-02:** Backfill existing rows (id=1, id=2) to `engine_version='2.1.0'` in the same migration's `UPDATE` step before applying the NOT NULL constraint. Atomic.
- **D-03:** Index `(engine_version, created_at DESC)`. Single composite index — do not split.
- **D-04:** Filter in query: `getPlattParameters` accepts new `engineVersion: string` param (default to `ENGINE_VERSION` from `src/lib/engine/version.ts`). Adds `.eq("engine_version", engineVersion)` before `.order`. Cache key becomes `platt-params:${engineVersion}`.
- **D-05:** Migration filename: `supabase/migrations/<stamp>_platt_engine_version.sql`.

**Refit Corpus & CLI (CALIB-01)**
- **D-06:** Reuse `full.2026-05-11` corpus (225 rows). Do NOT re-scrape.
- **D-07:** Extend `train-platt.ts` CLI with `--engine-version 3.0.0` flag (defaults to `ENGINE_VERSION`). Persist column on `platt_parameters` INSERT alongside existing `(a, b, fitted_at, sample_count)`.
- **D-08:** Cost ceiling: keep $50 cap (`maxTotalCostCents: 5000`). Estimated actual: ~$18 for 225 Qwen rows. Log `cost_cents_total` to stdout AND research doc. Cap-fire = deviation, surface and ask before raising.

**Wave 3 / Wave 4 "Threshold" Re-tune (CALIB-03)** — REQ-vs-code-reality mismatch:
- **D-09 (Wave 3):** Re-interpret "Wave 3 persona threshold" as score-bucket cutoffs `VIRAL_SCORE_CUT=70` / `UNDER_SCORE_CUT=30` in `src/lib/engine/corpus/eval-config.ts`. Sweep on Qwen 225-row corpus. Bounds: viralCut ∈ [55, 80], underCut ∈ [20, 45], viralCut > underCut + 20. Pick macro_f1-maximizer.
- **D-10 (Wave 3 parse-rate):** Validate `SUCCESS_THRESHOLD=7` empirically but DO NOT change unless evidence demands. Log per-row persona success counts. Keep 7 if Qwen parse rate ≥95% (≥9.5/10 avg). Surface if <85%, do not auto-edit.
- **D-11 (Wave 4):** Re-interpret as `SCORE_WEIGHTS.platform_fit` weight in `src/lib/engine/aggregator.ts` (currently 0.05). Sweep: 0.03/0.05/0.07/0.10. Pick macro_f1-maximizer.
- **D-12:** Document REQ-wording-vs-code mismatch in `qwen-stratified-validation.md` explicitly.

**Stratified Validation Rerun (CALIB-02)**
- **D-13:** Output `.planning/research/qwen-stratified-validation.md`. Required: macro_f1 + per-niche macro_f1 (5 niches) + per-bucket P/R/F1 + per-video diff vs `git show main:.planning/research/v2.1-baseline.md` (224-row v2.1 baseline) + score-band stratification (low/mid/high w/ mean ECE per band) + video-06 snapshot + `cost_cents_total` (train-platt + eval) + persona parse-rate distribution + chosen `(VIRAL_SCORE_CUT, UNDER_SCORE_CUT, platform_fit_weight)` triple + macro_f1 grid.
- **D-14:** macro_f1 fallback decision tree:
  - **≥ 0.338** → ship, lock thresholds/weight/Platt row, plan completes.
  - **0.300 ≤ f1 < 0.338** → retune VIRAL/UNDER cuts FIRST; if still <0.338 after best-cut, refit Platt on post-cut corpus; if still <0.338, accept-lower-with-rationale.
  - **< 0.300** → escalate to user before continuing. Do NOT auto-ship regression below v2.1's 0.294.
- **D-15:** Persist new `benchmark_results` row with `engine_version='3.0.0'` after eval rerun. Preserve existing 8 rows (no DELETE).

**Aggregator Wiring (CALIB-05)**
- **D-16:** Replace `src/lib/engine/aggregator.ts` lines 844-846:
  - `plattParams: PlattParameters | null = null` → `const plattParams = await getPlattParameters(ENGINE_VERSION);`
  - `is_calibrated = false` → `const is_calibrated = plattParams !== null;`
- **D-17:** Add `getPlattParameters` import from `src/lib/engine/calibration.ts` (already exported). 24-hour cache stays.
- **D-18:** Pass `engineVersion` explicitly from `version.ts`. Do not hardcode string literal.
- **D-19:** No fallback to v2.1 row. If `getPlattParameters('3.0.0')` returns null, `is_calibrated=false` and raw_overall_score passes through.

**E2E Verification (CALIB-05)**
- **D-20:** Single live `/api/analyze` E2E run after deploy. Pass: response JSON has `is_calibrated: true` AND `engine_version` matches new platt row. Capture payload in research doc.
- **D-21:** Local Vitest in `src/lib/engine/__tests__/aggregator.test.ts` mocking `getPlattParameters` to return v3.0.0 row, asserting `is_calibrated === true` flows. Add to existing suite — do NOT create new test file.

**Plan Sizing**
- **D-22:** Expected 3-4 plans (migration+CLI / refit run / sweep+doc / aggregator flip+E2E).
- **D-23:** 15-04 depends on 15-03's macro_f1 gate. Pause 15-04 if 15-03 escalates per D-14 `<0.300` branch.

### Claude's Discretion

- Exact wording/structure of `qwen-stratified-validation.md` beyond required content checklist (D-13).
- Whether to split migration into one plan or fold into 15-02 — planner decides based on plan-size budget.
- Default rate-limit delay for Qwen rerun (M1 used 2s for DeepSeek; Qwen may tolerate less). Justify if raising in research doc.
- Persona success-count log format inside existing `wave3.ts` Sentry breadcrumb vs. new `logger.info` line — pick most grep-able.

### Deferred Ideas (OUT OF SCOPE)

- Re-scrape corpus / new `corpus_version` — future "Corpus Refresh" phase.
- Cron `calibration-audit` retraining path verification — Phase 18 VERIF.
- Per-niche Platt parameters — structural change, future tech-debt.
- `fit_score` floor / `platform_fit` availability gate — rejected D-11.
- Persona success-rate auto-tune of `SUCCESS_THRESHOLD` — rejected D-10.
- `VIRAL_SCORE_CUT`/`UNDER_SCORE_CUT` per-niche — structural, future.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CALIB-01 | Fresh `platt_parameters` row with `engine_version='3.0.0'`, `trained_at` post-2026-05-24, `sample_count` matches Qwen corpus; old text-mode row preserved | Migration template (`20260512000100_benchmark_results.sql`) shows the exact `engine_version TEXT NOT NULL` + composite-index pattern. `train-platt.ts` already inserts `(a, b, fitted_at, sample_count)` at lines 152-167; extend with `engine_version`. `fitPlattScaling` (`calibration.ts:221`) is pure and reusable verbatim. |
| CALIB-02 | `.planning/research/qwen-stratified-validation.md` with per-video diff, score-band stratification, video-06 snapshot, macro_f1 (≥0.338 OR rationale) | `runEvalHarness` (`eval-harness.ts:60`) already emits macro_f1 + per_niche_f1 + ECE + cost. Use `engineVersion: '3.0.0'` override (already supported, line 63). v2.1 baseline doc at `git show main:.planning/research/v2.1-baseline.md` — macro_f1=0.2940, ECE=0.3715, per-niche values + bucket distribution all in there. |
| CALIB-03 | Wave 3 persona threshold + Wave 4 numeric `platform_fit` threshold re-tuned, committed with comment citing tuning report | Per D-09/D-11: actual knobs are `VIRAL_SCORE_CUT`/`UNDER_SCORE_CUT` (`eval-config.ts:83-84`, both literals) and `SCORE_WEIGHTS.platform_fit=0.05` (`aggregator.ts:50`, also literal). Both are single-line edits. `bucketFromScore` (`score-to-bucket.ts:14`) reads from `eval-config.ts` — no further code touched on score-cut sweep. |
| CALIB-05 | `is_calibrated = true` flows through aggregator output for new analyses — verified by live `/api/analyze` E2E | Lines 844-846 are the only site. `is_calibrated` is consumed at `aggregator.ts:994` in the `PredictionResult` assembly. SSE schema requires no change (already emits). Existing test (`aggregator.test.ts:440`) **must be inverted** — it currently asserts `is_calibrated=false` even when Platt params are present, calling out "hard-coded false post-Qwen migration (calibration debt)". |

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase. Package manager: pnpm (preferred).
- **File organization:** Never save to root folder. Use `/src` for source, `/tests` for tests, `/docs` for markdown, `/scripts` for utility scripts. (NB: project convention places engine tests at `src/lib/engine/__tests__/`, not `/tests` — follow existing pattern per D-21.)
- **Architecture:** Domain-Driven Design, files <500 lines (NB: `aggregator.ts` is 49.6K and already exceeds; additive edits to lines 844-846 do not aggravate). Typed interfaces for public APIs.
- **Build/test:** `pnpm run build`, `pnpm test` (= `vitest run`), `pnpm run lint`. ALWAYS run tests after code changes. ALWAYS verify build before committing.
- **Security:** Never hardcode credentials. Validate user input at boundaries. (Phase 15 has no new user-facing input surface.)
- **Verification rule:** Never say "should work" — prove it. For API changes: curl/E2E. (Aligns with D-20 live E2E mandate.)
- **Parallel execution:** Batch independent tool calls in ONE message. Spawn ALL agents in one message for parallel execution.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema migration (`engine_version` column + backfill + index) | Database / Storage | — | DDL change applied to Supabase; only DB-tier write. Migration pattern follows `20260512000100_benchmark_results.sql`. |
| `database.types.ts` regen | API / Backend (build-time) | — | Generated types are TypeScript artifacts consumed app-wide; regenerated via Supabase CLI per Phase 14 D-07. |
| `getPlattParameters` query + cache | API / Backend (server-side library) | Database | Pure server module (`calibration.ts`); reads from Supabase, caches in-process. No browser exposure. |
| `train-platt.ts` CLI invocation | API / Backend (offline batch) | Database | Node CLI run via `npx tsx`; writes one row to `platt_parameters`. Out-of-band from request path. |
| `runEvalHarness` rerun + benchmark persistence | API / Backend (offline batch) | Database | Same offline tier; writes `benchmark_results` row. |
| Score-cut + weight constant edits (`eval-config.ts`, `aggregator.ts`) | API / Backend | — | Pure constant flips inside engine library. Compile-time consumers. |
| Aggregator wiring flip (lines 844-846) | API / Backend | Database (via cached query) | Engine library code; consumed by `runPredictionPipeline` in `/api/analyze` SSE route. |
| Live `/api/analyze` E2E verification | API / Backend (live deployment) | Browser/Client (request originator) | Single HTTP POST against deployed Vercel route; assert on response payload. |
| Vitest aggregator coverage | API / Backend (test runtime) | — | Existing test file `aggregator.test.ts`; mocks `getPlattParameters` per established pattern (line 46-49). |

## Standard Stack

### Core (already in tree — reuse verbatim)

| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| `fitPlattScaling` | `src/lib/engine/calibration.ts:221` | Gradient-descent fit on cross-entropy loss for (a, b) | Pure function, no Qwen assumptions, used by `train-platt.ts` |
| `applyPlattScaling` | `src/lib/engine/calibration.ts:275` | Apply sigmoid `1/(1+exp(a*x+b))` to raw 0-100 score | Pure, null-safe (returns raw if params null) |
| `getPlattParameters` | `src/lib/engine/calibration.ts:323` | Fetch latest Platt row + 24h cache | **MUST modify per D-04** to accept `engineVersion` arg + namespaced cache key |
| `runEvalOverCorpus` | `src/lib/engine/corpus/eval-runner.ts:61` | Iterate corpus rows → pipeline → aggregator, with cost cap | Used by both 15-02 (Platt fit) and 15-03 (sweep + validation) |
| `runEvalHarness` | `src/lib/engine/corpus/eval-harness.ts:60` | Wrap eval-runner output into `BenchmarkReport` + persist row | Already supports `engineVersion` override (line 63) |
| `computeMacroF1` | `src/lib/engine/corpus/metrics/macro-f1.ts:30` | sklearn-compatible macro-F1 on 3-bucket classification | Pure, hand-verified against sklearn |
| `computeECE` | `src/lib/engine/calibration.ts:114` | Expected Calibration Error over 10 bins | Pure; used for score-band stratification per D-13 |
| `bucketFromScore` | `src/lib/engine/corpus/metrics/score-to-bucket.ts:14` | `score >= VIRAL_SCORE_CUT → viral`, etc. | Reads constants from `eval-config.ts` — score-cut sweep requires NO code change here |

### Supporting

| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `train-platt.ts` CLI | `src/lib/engine/corpus/cli/train-platt.ts` | End-to-end refit (corpus → eval → fit → INSERT) | Extend with `--engine-version` flag (D-07); single edit point |
| `eval-args.ts` CLI parser | `src/lib/engine/corpus/cli/eval-args.ts` | Shared `--engine-version` flag idiom (already implemented!) | Pattern reference for `train-platt.ts` extension; do NOT duplicate parser |
| `ENGINE_VERSION` constant | `src/lib/engine/version.ts:9` | Single source of truth: `"3.0.0"` | Import for D-04 default + D-18 explicit pass |
| Supabase CLI (`supabase gen types`) | `pnpm exec supabase gen types typescript --project-id qyxvxleheckijapurisj > src/types/database.types.ts` | Regen TS types after migration | Phase 14 D-07 idiom — do NOT use `--linked` flag |

### Alternatives Considered (all rejected per CONTEXT)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Add `engine_version` column | JSONB metadata field | D-01: queried on every analysis; DB-enforced NOT NULL prevents silent drops |
| Filter `getPlattParameters` by engineVersion | Application-side post-fetch filter | D-04: cache key namespacing prevents stale cross-version reads |
| Reuse `full.2026-05-11` corpus | Re-scrape under apidojo | D-06: switching invalidates v2.1 comparability; sealed-immutable rule |
| Tune `SCORE_WEIGHTS.platform_fit` weight | Introduce `fit_score >= N` floor | D-11: only numeric knob today is the weight; floor is new logic |
| Validate `SUCCESS_THRESHOLD=7` empirically | Auto-tune constant | D-10: deliberate constant changes require their own phase |

**Installation:** No new dependencies. All listed modules already in tree.

**Version verification:** `supabase` CLI version in repo per `.planning/codebase/STACK.md` is 2.74.5 — unchanged from Phase 14. `pnpm exec supabase --version` confirms before any migration work.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────────────────────┐
                  │  PLAN 15-01: Migration + Types + Query Sig  │
                  │                                             │
                  │  supabase/migrations/<stamp>_platt_         │
                  │    engine_version.sql                       │
                  │   │                                         │
                  │   ▼  (apply via Supabase MCP or CLI)        │
                  │  Live DB: platt_parameters                  │
                  │    + engine_version TEXT NOT NULL           │
                  │    + idx (engine_version, created_at DESC)  │
                  │    + id=1,2 backfilled to '2.1.0'           │
                  │   │                                         │
                  │   ▼                                         │
                  │  pnpm exec supabase gen types typescript    │
                  │   │                                         │
                  │   ▼                                         │
                  │  src/types/database.types.ts (regen)        │
                  │   │                                         │
                  │   ▼  (TS compile pressure forces caller-edit)│
                  │  calibration.ts getPlattParameters(engineV) │
                  │  train-platt.ts --engine-version flag       │
                  └─────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────────────────────────────┐
                  │  PLAN 15-02: Refit Run (Qwen)               │
                  │                                             │
                  │  CLI: npx tsx src/lib/engine/corpus/cli/    │
                  │       train-platt.ts                        │
                  │       --version full.2026-05-11             │
                  │       --engine-version 3.0.0                │
                  │   │                                         │
                  │   ▼                                         │
                  │  runEvalOverCorpus (225 rows, Qwen pipeline)│
                  │   │  ◄── persona parse-rate logged (D-10)   │
                  │   │  ◄── cost_cents_total captured (D-08)   │
                  │   ▼                                         │
                  │  fitPlattScaling → (a, b, sample_count)     │
                  │   │                                         │
                  │   ▼                                         │
                  │  INSERT platt_parameters (engine_version=   │
                  │    '3.0.0', trained_at=NOW())               │
                  └─────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────────────────────────────┐
                  │  PLAN 15-03: Threshold + Weight Sweep       │
                  │                                             │
                  │  For (viralCut, underCut) in grid:          │
                  │    For weight in [0.03, 0.05, 0.07, 0.10]:  │
                  │      Compute macro_f1 using cached eval     │
                  │      results from 15-02 (re-bucket only)    │
                  │   │                                         │
                  │   ▼                                         │
                  │  Pick triple maximizing macro_f1            │
                  │   │                                         │
                  │   ▼                                         │
                  │  Branch on macro_f1 (D-14 decision tree)    │
                  │    │                                        │
                  │    ├─ ≥0.338 → commit eval-config.ts +      │
                  │    │            aggregator.ts SCORE_WEIGHTS │
                  │    │           write qwen-stratified-       │
                  │    │            validation.md              │
                  │    │                                        │
                  │    ├─ 0.300..0.338 → retune cuts → maybe    │
                  │    │   refit Platt → maybe accept-lower     │
                  │    │                                        │
                  │    └─ <0.300 → ESCALATE; pause 15-04        │
                  │   │                                         │
                  │   ▼                                         │
                  │  Persist benchmark_results row              │
                  │    (engine_version='3.0.0')                 │
                  └─────────────────────────────────────────────┘
                              │
                              ▼
                  ┌─────────────────────────────────────────────┐
                  │  PLAN 15-04: Aggregator Wiring + E2E        │
                  │                                             │
                  │  Edit aggregator.ts:844-846                 │
                  │    plattParams = await                      │
                  │      getPlattParameters(ENGINE_VERSION)     │
                  │    is_calibrated = plattParams !== null     │
                  │   │                                         │
                  │   ▼                                         │
                  │  INVERT existing test                       │
                  │    aggregator.test.ts:440 "hard-coded       │
                  │    false post-Qwen migration"               │
                  │   │  → becomes positive assertion           │
                  │   ▼                                         │
                  │  Add D-21 test: mock getPlattParameters     │
                  │    to return v3.0.0 row, assert             │
                  │    is_calibrated === true                   │
                  │   │                                         │
                  │   ▼                                         │
                  │  pnpm test + pnpm build + deploy            │
                  │   │                                         │
                  │   ▼                                         │
                  │  Live /api/analyze E2E                      │
                  │    assert response.is_calibrated === true   │
                  │    assert response.engine_version === '3.0.0'│
                  │    capture payload in research doc          │
                  └─────────────────────────────────────────────┘
```

### Recommended File-Touch Surface (consolidated)

```
src/
├── lib/engine/
│   ├── calibration.ts                        # Plan 15-01: modify getPlattParameters signature + cache key
│   ├── aggregator.ts                          # Plan 15-03: SCORE_WEIGHTS.platform_fit constant
│   │                                          # Plan 15-04: lines 844-846 wiring flip
│   ├── corpus/
│   │   ├── eval-config.ts                    # Plan 15-03: VIRAL_SCORE_CUT, UNDER_SCORE_CUT constants
│   │   └── cli/train-platt.ts                # Plan 15-01: add --engine-version flag, persist column
│   └── __tests__/
│       ├── aggregator.test.ts                 # Plan 15-04: invert :440 test, add D-21 positive test
│       └── calibration.test.ts                # Plan 15-01: cover new engineVersion param + cache namespacing
├── types/
│   └── database.types.ts                      # Plan 15-01: regen (touches platt_parameters Row/Insert/Update)
supabase/
└── migrations/
    └── <stamp>_platt_engine_version.sql       # Plan 15-01: new migration (column + backfill + index)
.planning/research/
└── qwen-stratified-validation.md              # Plan 15-03: validation report (REQUIRED per D-13)
```

### Pattern 1: Migration with Backfill + NOT NULL (Phase 14 + benchmark_results idiom)
**What:** Add column nullable → UPDATE existing rows → ALTER to NOT NULL — all in a single atomic migration.
**When to use:** D-01 + D-02 mandate this exact shape.
**Example:**
```sql
-- Source: supabase/migrations/20260512000100_benchmark_results.sql (template)
-- New: supabase/migrations/<stamp>_platt_engine_version.sql

ALTER TABLE platt_parameters ADD COLUMN engine_version TEXT;

UPDATE platt_parameters SET engine_version = '2.1.0' WHERE engine_version IS NULL;

ALTER TABLE platt_parameters ALTER COLUMN engine_version SET NOT NULL;

CREATE INDEX idx_platt_parameters_engine_created
  ON platt_parameters(engine_version, created_at DESC);
```

### Pattern 2: Cache Key Namespacing (D-04)
**What:** When a query gets a new discriminator argument, the cache key MUST include it.
**Source:** `src/lib/engine/calibration.ts:312` (`PLATT_CACHE_KEY = "platt-params"`)
**Example:**
```typescript
// Before
const PLATT_CACHE_KEY = "platt-params";
const cached = plattCache.get(PLATT_CACHE_KEY);

// After (D-04)
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
    .eq("engine_version", engineVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  // ... rest unchanged
  plattCache.set(cacheKey, { params });
  return params;
}
```

### Pattern 3: CLI Flag via shared `getArg`/`hasFlag` helper
**What:** `train-platt.ts:47-61` already has `getArg` + `hasFlag` helpers. Reuse, do not invent.
**Example:**
```typescript
// Source: train-platt.ts:47-61 (existing helpers)
const engineVersionArg = getArg(argv, "--engine-version");
const engineVersion = engineVersionArg ?? ENGINE_VERSION;
// ... pass to runEvalOverCorpus (no current support — confirm in plan) AND
//     into INSERT statement at line 156-162
```

### Pattern 4: Aggregator-test mock idiom
**What:** `aggregator.test.ts:46-49` mocks `../calibration` with `getPlattParameters` returning null by default. Tests opt-in to non-null via `vi.mocked(getPlattParameters).mockResolvedValue(...)`.
**Source:** `src/lib/engine/__tests__/aggregator.test.ts:46-49`
**Example:**
```typescript
// Source: aggregator.test.ts:90-91 (existing import)
import { getPlattParameters, applyPlattScaling } from "../calibration";

// New D-21 test (replaces or sits next to inverted line :440 test)
it("returns is_calibrated=true when v3.0.0 Platt params present", async () => {
  const mockParams = { a: -1.2, b: 0.3, fittedAt: "2026-05-24T...", sampleCount: 224 };
  vi.mocked(getPlattParameters).mockResolvedValue(mockParams);
  vi.mocked(applyPlattScaling).mockReturnValue(55);
  const result = await aggregateScores(makePipelineResult());
  expect(result.is_calibrated).toBe(true);
});
```

### Anti-Patterns to Avoid

- **Splitting the migration across multiple files.** D-01 + D-02 are a single atomic unit. NULLable insert → backfill → NOT NULL must happen in one migration so partial-apply states cannot exist.
- **Hand-editing `database.types.ts`** after regen. Phase 14 D-09 hand-patch rejection rule applies here.
- **Hardcoding `'3.0.0'` string literal at the aggregator call site.** D-18 explicit constraint — use `ENGINE_VERSION` from `version.ts`.
- **Re-scraping corpus or introducing new `corpus_version`.** D-06 hard-locks reuse of `full.2026-05-11`.
- **Keeping the calibration-debt test (`aggregator.test.ts:440`) intact.** This test will FAIL after the wiring flip (it asserts `is_calibrated=false` even when Platt params present). Plan 15-04 MUST update or delete it; failing to do so blocks merge.
- **Inserting v3.0.0 row before the migration lands.** D-19 mandates `is_calibrated=false` if no v3.0.0 row exists; but the column is `NOT NULL` so the INSERT itself fails without the migration. Sequence is rigid: migration → CLI extension → refit run.
- **Mid-pipeline cost polling.** Smoke-runner billing pattern (MILESTONE.md "Stack decisions") reads at end of run only. Phase 15 doesn't touch smoke runner (that's Phase 17), but the `cost_cents_total` capture follows the same end-of-run idiom in `train-platt.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Logistic regression / sigmoid fit | Custom gradient descent | `fitPlattScaling` in `calibration.ts:221` | Already exists, 1000 iterations, learning rate 0.01, cross-entropy loss. Hand-verified. |
| Score → bucket mapping | Custom thresholding | `bucketFromScore` in `metrics/score-to-bucket.ts:14` | Reads constants from `eval-config.ts`; pure; one site to test. |
| Macro-F1 computation | NumPy-style averaging | `computeMacroF1` in `metrics/macro-f1.ts:30` | sklearn-compatible, hand-tested against fixtures. |
| Expected Calibration Error | Custom binning | `computeECE` in `calibration.ts:114` | 10-bin equal-width, weighted gap, already returns `{ ece, bins }`. |
| Corpus iteration with cost cap | Custom loop | `runEvalOverCorpus` in `eval-runner.ts:61` | Per-row spike monitor, cost-cap, per-row retry-and-continue. CostCapExceededError typed. |
| Benchmark persistence | Custom Supabase INSERT | `persistBenchmarkRow` inside `runEvalHarness` | Already wraps the INSERT with Sentry capture + JSONB casts. |
| Platt cache | Custom Map / TTL logic | `createCache<PlattCacheEntry>(24*60*60*1000)` | Already in `calibration.ts:310`; null-result wrapper pattern proven. |
| CLI flag parsing | New flag parser | `getArg`/`hasFlag` in `train-platt.ts:47-61` OR `parseEvalArgs` in `cli/eval-args.ts` | Two existing idioms; pick whichever matches existing CLI style. |

**Key insight:** This phase is **almost entirely constant-flips and one-column-add on top of fully-built infrastructure.** The Platt fitting math, the eval harness, the cost cap, the benchmark schema, the cache layer — all exist. Plan tasks should be measured in lines-of-diff (most <20), not new modules. The only genuinely new file is the migration SQL.

## Runtime State Inventory

This phase IS a refit + wiring change. Audit each category explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (1) `platt_parameters` rows id=1 (sample_count=79, fitted_at=2026-05-21T08:25) and id=2 (sample_count=224, fitted_at=2026-05-21T10:47) — both text-mode-trained. Must be backfilled to `engine_version='2.1.0'` per D-02 (the migration handles this). (2) `benchmark_results` 8 rows across `[2.1.0, 3.0.0-dev, 3.0.0-dev-personasA, 3.0.0-dev-personasB]` — preserved verbatim per D-15. (3) `training_corpus` 225 rows under `corpus_version='full.2026-05-11'` — read-only reuse per D-06. (4) Phase 6 `analysis_results` cache rows keyed on `engine_version` — when v3.0.0 row gets the Platt flip, `is_calibrated` will change in the response shape; cache keying on `engine_version` (per Phase 13 D-23 cache invariant in `version.ts`) means cached `3.0.0-dev` rows are already invalidated by the prior version flip; no fresh invalidation needed in Phase 15. | Migration backfill (D-02) handles platt_parameters. No code edit needed for benchmark/training/cache. |
| Live service config | None — no n8n / Datadog / Tailscale / Cloudflare config that references the calibration row by name. Vercel cron `/api/cron/calibration-audit` reads `platt_parameters` via `getPlattParameters` only, so it auto-picks-up the new column after the function signature update. Cron's first run is 2026-06-01 (deferred to Phase 18 VERIF per CONTEXT). | None this phase. Phase 18 verifies cron with new column. |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd registration touches Platt scaling or aggregator. | None — verified by grep of `~/personal-system/` and STATE.md (no engine-side OS registrations exist). |
| Secrets/env vars | `DASHSCOPE_API_KEY` (Qwen API auth) is consumed by the existing Qwen client during the refit eval run — already wired, no rename. `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for migration + INSERT — already wired in `createServiceClient`. Cost-cap env: none — `maxTotalCostCents` is a function arg, not env-driven. | None — verified by reading `train-platt.ts` (line 24 reads `.env.local` only for the shared Supabase + Qwen vars). |
| Build artifacts / installed packages | `database.types.ts` regen produces an artifact that must be committed in the same commit as the migration per Phase 14 D-07 atomicity rule. No npm/pnpm install changes needed. No compiled binaries. | Regen + commit in Plan 15-01. |

**The canonical question — after every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?**

Answer for Phase 15: (1) the prior in-process `plattCache` value under key `"platt-params"` (no engine version suffix) will be stale across the deploy boundary — but it's process-local and 24h TTL, so it auto-evicts on first cold start. The cache-key namespacing (D-04 → new key `"platt-params:3.0.0"`) means the old key is simply orphaned — no explicit invalidation needed. (2) The `analysis_results` cache keyed on `engine_version` — already on `3.0.0` from the prior Phase 13 flip per `version.ts:8-9`, so the `is_calibrated` field will start flipping `true` only for NEW analyses keyed under v3.0.0 with the new platt row in place; old cached rows under `3.0.0-dev` and `3.0.0` (pre-Plan-15-04 deploy) keep their original `is_calibrated=false`. This is the desired behavior per D-19 ("No fallback to v2.1 row").

## Common Pitfalls

### Pitfall 1: The calibration-debt regression test
**What goes wrong:** `aggregator.test.ts:440` explicitly asserts `is_calibrated=false` even when `getPlattParameters` returns a non-null Platt row. The wiring flip in Plan 15-04 will produce `is_calibrated=true` for that exact scenario, making the test fail.
**Why it happens:** Phase 13 final-validation locked this assertion to document the deliberate calibration-debt hardcode. The test was a *guard* against accidental re-enabling — now it's a *blocker* against the intended re-enabling.
**How to avoid:** Plan 15-04's task list MUST include "invert or remove `aggregator.test.ts:440`" as an explicit subtask. New D-21 positive test (mock Platt returns v3.0.0 row → assert `is_calibrated=true`) sits alongside or replaces it.
**Warning signs:** `pnpm test src/lib/engine/__tests__/aggregator.test.ts` fails on the "hard-coded false post-Qwen migration (calibration debt)" describe-block after the wiring flip.

### Pitfall 2: Atomic migration ordering
**What goes wrong:** `ALTER TABLE ... ADD COLUMN engine_version TEXT NOT NULL` without a default and without backfill will fail when existing rows (id=1, id=2) are present.
**Why it happens:** PostgreSQL enforces NOT NULL at column-add time unless a DEFAULT is specified for back-fill.
**How to avoid:** Three-step atomic migration (Pattern 1 above): ADD as nullable → UPDATE to '2.1.0' → ALTER to SET NOT NULL. All in one `.sql` file so partial-apply states cannot exist.
**Warning signs:** Migration error "column engine_version contains null values" — means step 2 was skipped or ran with zero rows in the table.

### Pitfall 3: Score-cut + weight grid runtime
**What goes wrong:** Naive nested loop runs the full eval pipeline (225 rows × ~30s each = ~2 hours per grid point) for every (viralCut, underCut, weight) combination. With ~5×5×4 = 100 combinations, that's 200+ hours.
**Why it happens:** Conflating "run the engine over the corpus" with "compute macro_f1 from cached predictions."
**How to avoid:** Run the engine ONCE on the Qwen pipeline (Plan 15-02 already does this for the Platt fit). Cache `predicted_overall_score` per row. The sweep only varies how scores → buckets (`bucketFromScore` w/ different `VIRAL_SCORE_CUT`/`UNDER_SCORE_CUT`) AND how `platform_fit_weight` re-weights the already-computed component scores (need to re-run only the linear combination at `aggregator.ts:816-836`, which is microseconds per row). Sweep should complete in <10 seconds for 100 grid points.
**Warning signs:** Plan 15-03 task description says "rerun eval-harness for each grid point" — that's wrong. Should say "reuse cached predictions; re-bucket and re-weight only."

### Pitfall 4: Cost cap silent passthrough on Qwen
**What goes wrong:** $50 cap was sized for DeepSeek+Gemini (M1). Qwen is ~10× cheaper per row, so the cap is far above realistic spend. If a regression in the eval-runner causes cost calculation to silently return 0 (e.g., wave3CostCents not folded in), the cap never fires and the run completes "successfully" with $0 reported.
**Why it happens:** D-08 estimates ~$18 actual vs $50 cap — 64% headroom. A bug that under-reports cost could go unnoticed.
**How to avoid:** Log `cost_cents_total` + per-stage breakdown (Wave 1 Qwen vision + Wave 3 persona calls + Wave 4 platform-fit calls) in the train-platt stdout. Compare against expected ~$18 in the research doc. Flag if actual is wildly off (CONTEXT D-08: ">$30 = deviation").
**Warning signs:** `cost_cents_total < 1000` (<$10) in stdout — implies a stage's cost is being zero'd out. Cross-check against per-row `cost_cents` distribution.

### Pitfall 5: Cache invalidation across deploy boundary
**What goes wrong:** After Plan 15-04 deploys, an `/api/analyze` request hits a warm Vercel function with a cached `plattCache` entry under the OLD key shape (`"platt-params"`, no engine_version suffix). The function returns `is_calibrated=false` even though the v3.0.0 row exists.
**Why it happens:** Vercel functions warm-start with in-process state; the cache key namespacing (D-04) means the old key is orphaned but the OLD cache entry would have already been a null result anyway (since no v3.0.0 row existed pre-15-02).
**How to avoid:** Verify the cache key namespacing is in place BEFORE 15-04 deploys. Confirm in Plan 15-01 that `PLATT_CACHE_KEY` is updated to template literal `\`platt-params:${engineVersion}\``. The first cold-start after deploy of 15-04 will populate the new key with the v3.0.0 row → `is_calibrated=true` flows.
**Warning signs:** First D-20 E2E run shows `is_calibrated=false` despite v3.0.0 row in DB — likely cache from previous deploy still warm. Wait 24h or force a cold restart, then retry.

### Pitfall 6: Persona parse-rate noise
**What goes wrong:** D-10 says "validate `SUCCESS_THRESHOLD=7` empirically." If a small fraction of the 225 corpus rows experience Qwen rate-limits or transient parse failures, the observed parse-rate distribution will be noisy — easy to misread as a structural problem.
**Why it happens:** Wave 3 fires 10 parallel persona calls per row. Even 99% per-call success → 90.4% per-row "all 10 succeeded" rate. The bar in D-10 is ≥95% per-row averaged across the corpus, NOT per-call.
**How to avoid:** Log per-row success counts (0..10) and aggregate to "mean successes per row" — that's what the ≥9.5/10 bar refers to. Distinguish per-row aggregate parse-rate from per-call success rate (the latter is naturally higher and not what D-10 specifies).
**Warning signs:** Distribution shows a long tail with several rows at 5/10 or below — those are likely rate-limited rows, not parse failures. Check Qwen API rate-limit headers + sleep delay (D-08 default 2000ms — may need to raise for the 225-row run).

## Code Examples

### Migration template (D-01 + D-02 + D-03 atomically)
```sql
-- Source: supabase/migrations/20260512000100_benchmark_results.sql (template for column shape + composite index)
-- New: supabase/migrations/<stamp>_platt_engine_version.sql

-- Step 1: Add column as nullable (existing rows tolerated)
ALTER TABLE platt_parameters ADD COLUMN engine_version TEXT;

-- Step 2: Backfill text-mode rows (id=1, id=2 per live-state evidence)
UPDATE platt_parameters SET engine_version = '2.1.0' WHERE engine_version IS NULL;

-- Step 3: Enforce NOT NULL post-backfill
ALTER TABLE platt_parameters ALTER COLUMN engine_version SET NOT NULL;

-- Step 4: Composite index for getPlattParameters ordering
CREATE INDEX idx_platt_parameters_engine_created
  ON platt_parameters(engine_version, created_at DESC);
```

### `getPlattParameters` signature change (D-04)
```typescript
// Source: src/lib/engine/calibration.ts:323 (BEFORE)
export async function getPlattParameters(): Promise<PlattParameters | null> {
  const cached = plattCache.get(PLATT_CACHE_KEY);
  // ...
}

// AFTER (Plan 15-01)
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
    .eq("engine_version", engineVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  // ... PGRST116 + log + map to PlattParameters unchanged ...
  plattCache.set(cacheKey, { params });
  return params;
}
```

### `train-platt.ts` CLI flag extension (D-07)
```typescript
// Source: src/lib/engine/corpus/cli/train-platt.ts:76-78 (BEFORE)
const version = getArg(argv, "--version");
// ...

// AFTER (Plan 15-01)
const version = getArg(argv, "--version");
const engineVersionArg = getArg(argv, "--engine-version");
const engineVersion = engineVersionArg ?? ENGINE_VERSION;
// ... validation unchanged ...
// At INSERT (line 156-162):
const { error: insertError } = await supabase
  .from("platt_parameters")
  .insert({
    a: params.a,
    b: params.b,
    fitted_at: params.fittedAt,
    sample_count: params.sampleCount,
    engine_version: engineVersion,  // NEW
  });
```

### Aggregator wiring flip (D-16, D-17, D-18, D-19)
```typescript
// Source: src/lib/engine/aggregator.ts:840-846 (BEFORE)
// TODO(post-Qwen): Platt parameters were fit on the Gemini+DeepSeek engine.
// Applying them to Qwen-scored outputs mis-calibrates. Bypassed until refit on
// a Qwen-scored corpus. Tracked as calibration debt out of Milestone 1.
const plattParams: PlattParameters | null = null;
const overall_score = applyPlattScaling(raw_overall_score, plattParams);
const is_calibrated = false;

// AFTER (Plan 15-04)
// Phase 15 (CALIB-05): Platt parameters refit on Qwen corpus full.2026-05-11.
// See .planning/research/qwen-stratified-validation.md for tuning report.
// D-18: ENGINE_VERSION passed explicitly to avoid hardcoded literal.
// D-19: getPlattParameters returns null → is_calibrated=false, raw passthrough.
const plattParams = await getPlattParameters(ENGINE_VERSION);
const overall_score = applyPlattScaling(raw_overall_score, plattParams);
const is_calibrated = plattParams !== null;
```

### Aggregator score-cut + weight constant flips (D-09, D-11)
```typescript
// Source: src/lib/engine/corpus/eval-config.ts:83-84 (BEFORE)
export const VIRAL_SCORE_CUT = 70;
export const UNDER_SCORE_CUT = 30;

// AFTER (Plan 15-03 — values TBD by sweep)
// Phase 15 (CALIB-03): Re-tuned on Qwen full.2026-05-11 corpus.
// See .planning/research/qwen-stratified-validation.md §Score-cut grid sweep.
export const VIRAL_SCORE_CUT = <chosen>;
export const UNDER_SCORE_CUT = <chosen>;

// Source: src/lib/engine/aggregator.ts:45-54 (BEFORE)
export const SCORE_WEIGHTS = {
  // ...
  platform_fit: 0.05,  // video-derived from Wave 4
  // ...
};

// AFTER (Plan 15-03 — value TBD by sweep)
// Phase 15 (CALIB-03): Re-tuned weight on Qwen pipeline.
// See .planning/research/qwen-stratified-validation.md §platform_fit weight sweep.
platform_fit: <chosen>,
```

### Inverted aggregator test (D-21)
```typescript
// Source: src/lib/engine/__tests__/aggregator.test.ts:440-452 (BEFORE — DELETE or invert)
it("is_calibrated is hard-coded false post-Qwen migration (calibration debt)", async () => {
  // ... Phase 13 calibration-debt scaffolding ...
  expect(result.is_calibrated).toBe(false);
});

// AFTER (Plan 15-04)
it("returns is_calibrated=true when v3.0.0 Platt params present (CALIB-05)", async () => {
  const mockParams = { a: -1.2, b: 0.3, fittedAt: "2026-05-24T12:00:00Z", sampleCount: 224 };
  vi.mocked(getPlattParameters).mockResolvedValue(mockParams);
  vi.mocked(applyPlattScaling).mockReturnValue(55);

  const result = await aggregateScores(makePipelineResult());

  expect(result.is_calibrated).toBe(true);
});

// Keep the existing "returns is_calibrated=false when no Platt params available" (line :434) UNCHANGED —
// it still describes correct behavior under D-19 (null Platt row → is_calibrated=false).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single Platt row, no engine discriminator | `engine_version`-keyed Platt rows | Phase 15 (this) | Multiple engine versions coexist; historical preservation rule honored |
| Hardcoded `is_calibrated=false` in aggregator | Computed from `getPlattParameters(ENGINE_VERSION)` | Phase 15 Plan 15-04 | UI / SSE consumers see real calibration flag |
| Score-cuts derived from M1 text-mode corpus (70/30) | Score-cuts re-tuned on Qwen corpus | Phase 15 Plan 15-03 | Match score-distribution shift from Qwen pipeline |
| `platform_fit` weight 0.05 (M1 guess) | Weight re-tuned on Qwen corpus | Phase 15 Plan 15-03 | Optimize macro_f1 under Qwen scoring shape |

**Deprecated/outdated:**
- The Phase 13 calibration-debt hardcode (`aggregator.ts:844-846`): obsolete after Plan 15-04 lands.
- The Phase 13 regression test (`aggregator.test.ts:440`): obsolete after Plan 15-04 lands.
- v2.1 Platt rows (id=1, id=2): NOT deleted — preserved as historical reference per `engine_version='2.1.0'` discriminator (REQUIREMENTS rule, MILESTONE.md "Stack decisions").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Qwen output pricing ≈ $0.28/M tokens (per CONTEXT D-08) — used to derive ~$18 estimate for 225 rows | Pitfall 4 / Don't Hand-Roll cost section | If Qwen pricing changed since 2026-05-22, cost ceiling math is off. Mitigation: D-08 already says to log actual + flag deviation. Low risk because CONTEXT was gathered 2026-05-24 and pricing references `src/lib/engine/qwen/cost.ts` as authoritative — CONTEXT D-08 implicitly verified this. |
| A2 | The 24h cache TTL on `plattCache` is acceptable for the deploy-day window during which old vs new key shapes coexist | Pitfall 5 | If a stale cache entry under the old key shape lingers in a warm Vercel function for >24h, an E2E test could spuriously return `is_calibrated=false`. Mitigation: this is process-local cache; Vercel functions cold-start within minutes-to-hours under normal traffic. Low risk. |
| A3 | The persona-parse-rate aggregate "≥9.5/10 average" interpretation matches the D-10 intent (not "≥9.5 individual calls out of 10 across all rows") | Pitfall 6 | If user intended per-call rate, the threshold ladder shifts; D-10 then needs reinterpretation. Mitigation: surface this interpretation explicitly in `qwen-stratified-validation.md` per D-12; user can correct. |
| A4 | Vercel cron `/api/cron/calibration-audit` next run is 2026-06-01 and is out of scope per CONTEXT deferred-ideas | Runtime State Inventory § Live service config | If cron runs unexpectedly between Plan 15-01 and Plan 15-04 deploys, it could attempt to INSERT into `platt_parameters` without the engine_version arg — fails NOT NULL. Mitigation: verify cron has not been triggered manually; pause cron via Vercel dashboard during the deploy window if user wants belt-and-suspenders. Low risk because cron is monthly and next fire is 7+ days away from research date. |

**Note on confidence:** Every other claim in this research is `[VERIFIED]` against live source code (paths + line numbers given inline) or `[CITED]` from CONTEXT.md / REQUIREMENTS.md / MILESTONE.md / ROADMAP.md / existing migration SQL. The four assumptions above are flagged because they're the only places where live-tool verification (Qwen API call, Vercel cron logs, etc.) was not performed in this session — CONTEXT.md asserts them, but they cross a tool boundary the planner may want to re-verify.

## Open Questions

1. **Cost cap auto-raise vs. surface-and-ask if Qwen actual exceeds $30?**
   - What we know: D-08 says "surface and ask before raising." CONTEXT estimate is ~$18.
   - What's unclear: whether the planner should encode an explicit "if cost > $30, abort and ask" subtask, or treat the cost-cap fire as a soft signal that the runner already raises.
   - Recommendation: Plan 15-02 task explicitly checks `cost_cents_total` against $30 threshold post-run and writes a deviation note to the research doc — no implicit abort beyond the existing $50 cap.

2. **Where exactly does the `is_calibrated` field land in `/api/analyze` SSE response?**
   - What we know: `aggregator.ts:994` puts it on `PredictionResult`. CONTEXT integration-points note "SSE emits `is_calibrated` in the SSE `complete` event payload."
   - What's unclear: exact JSON path for the D-20 E2E assertion — is it `response.is_calibrated` or `response.result.is_calibrated` or under `complete.data.is_calibrated`?
   - Recommendation: Plan 15-04 task that scaffolds the E2E should first probe an existing successful `/api/analyze` response (from current production with `is_calibrated=false`) to identify the exact path, then encode the assertion. This is a 2-minute curl, but doing it blind risks an E2E that asserts on a non-existent path.

3. **Should the rate-limit delay (`rateLimitDelayMs`) be tuned down for Qwen?**
   - What we know: M1 used 2000ms for DeepSeek. CONTEXT Claude's Discretion entry suggests Qwen may tolerate less.
   - What's unclear: actual Qwen rate-limit headers + current quota usage. No tool call available to confirm without hitting the live API.
   - Recommendation: Plan 15-02 task keeps `rateLimitDelayMs: 2000` as the conservative default for the 225-row run. Justify any decrease in the research doc with evidence (e.g., persona success-count distribution). Out-of-scope to optimize until we have a successful run to measure against.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project `qyxvxleheckijapurisj` | Plan 15-01 migration apply, Plan 15-02 INSERT, Plan 15-03 benchmark persist | Confirmed live per CONTEXT canonical_refs | n/a | None — hard dependency |
| Supabase CLI (`supabase`) | Plan 15-01 types regen | Per `.planning/codebase/STACK.md` v2.74.5 | 2.74.5 | None — hard dependency |
| `supabase` MCP server | Plan 15-01 alternative apply path | Available (mentioned in system MCP instructions) | n/a | Use `supabase` CLI directly |
| Qwen / DashScope International API (`DASHSCOPE_API_KEY`) | Plan 15-02 refit eval run, Plan 15-03 sweep | Already in production use | n/a | None — required by ENGINE_VERSION=3.0.0 by design |
| pnpm | All plans (build/test) | Per CLAUDE.md preferred package manager | unspecified | npm fallback if needed |
| `npx tsx` | `train-platt.ts` invocation | Standard in tree (per `package.json` `eval`/`benchmark` scripts) | n/a | — |
| Vercel deploy access | Plan 15-04 live E2E | User must have deploy permissions | n/a | Plan 15-04 pauses pending deploy if not available |
| Vitest | All plans (unit testing) | Per `package.json` `test` script | unspecified | — |

**Missing dependencies with no fallback:** None — all dependencies are in production use already.

**Missing dependencies with fallback:** Supabase MCP can fall back to direct `supabase` CLI invocation per Phase 14 D-07 idiom.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (per `package.json` `"test": "vitest run"`) |
| Config file | Vitest default discovery; project standard tests live in `src/lib/engine/__tests__/` and `src/**/__tests__/` |
| Quick run command | `pnpm test src/lib/engine/__tests__/aggregator.test.ts src/lib/engine/__tests__/calibration.test.ts` |
| Full suite command | `pnpm test` (= `vitest run`) — baseline currently 996/996 passing, 17 skipped (per MILESTONE.md "Pre-flight green state") |
| Phase gate | Full suite green + `pnpm exec tsc --noEmit` 0 errors + `pnpm build` green before `/gsd-verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALIB-01 | Migration applies cleanly; backfilled row carries `engine_version='2.1.0'`; new column NOT NULL | integration (Supabase) | Manual: query `SELECT engine_version, count(*) FROM platt_parameters GROUP BY engine_version` post-apply | ❌ Wave 0 — migration test is post-apply DB query, not Vitest. Plan 15-01 task list documents the query. |
| CALIB-01 | `getPlattParameters(engineVersion)` filters by column + namespaces cache | unit | `pnpm test src/lib/engine/__tests__/calibration.test.ts -t "getPlattParameters"` | ⚠️ `calibration.test.ts` exists (473 LOC) but Wave 0 needs new `it` blocks covering the engineVersion param + cache key namespacing |
| CALIB-01 | `train-platt.ts --engine-version 3.0.0` persists the column | smoke (CLI) | `npx tsx src/lib/engine/corpus/cli/train-platt.ts --version full.2026-05-11 --engine-version 3.0.0 --max-rows 5 --dry-run` | ❌ Wave 0 — no existing CLI test harness for train-platt; CONTEXT D-22 implies smoke-only verification via dry-run |
| CALIB-02 | `qwen-stratified-validation.md` exists with required content per D-13 | doc-existence | `test -f .planning/research/qwen-stratified-validation.md && grep -q "macro_f1" .planning/research/qwen-stratified-validation.md` | ❌ Wave 0 — file produced by Plan 15-03 |
| CALIB-02 | macro_f1 ≥0.338 OR D-14 fallback rationale logged | doc-content | Manual grep of the validation doc | ❌ Wave 0 — produced by Plan 15-03 |
| CALIB-02 | `benchmark_results` has v3.0.0 row post-rerun | integration (Supabase) | Manual: `SELECT engine_version, macro_f1 FROM benchmark_results WHERE engine_version='3.0.0'` | ❌ Wave 0 |
| CALIB-03 | Score-cut + weight constants committed with comment citing tuning report | unit (compile-time) | `pnpm exec tsc --noEmit` + `git log -p src/lib/engine/corpus/eval-config.ts src/lib/engine/aggregator.ts` shows comment | ✅ Existing — `pnpm exec tsc --noEmit` is part of full gate |
| CALIB-05 | `is_calibrated === true` when `getPlattParameters` returns non-null v3.0.0 row | unit | `pnpm test src/lib/engine/__tests__/aggregator.test.ts -t "is_calibrated"` (after D-21 test added) | ⚠️ Existing file (`aggregator.test.ts` 1055 LOC), Wave 0 = invert :440 + add D-21 positive test |
| CALIB-05 | Live `/api/analyze` E2E returns `is_calibrated: true` + matching `engine_version` | manual / smoke | Live curl/Playwright against deployed Vercel route per D-20 | ❌ Manual; capture payload in research doc |

### Sampling Rate

- **Per task commit:** `pnpm test <touched-test-file>` (quick run)
- **Per wave merge:** `pnpm test && pnpm exec tsc --noEmit` (full suite)
- **Phase gate:** Full suite green + `pnpm build` green + live E2E (D-20) capture committed before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/engine/__tests__/calibration.test.ts` — new `it` blocks for engineVersion param + cache key namespacing (additive to existing 473 LOC file)
- [ ] `src/lib/engine/__tests__/aggregator.test.ts` — invert/remove :440 calibration-debt test; add D-21 positive test asserting `is_calibrated=true` flows
- [ ] No new test framework install needed (Vitest already in tree)
- [ ] No shared fixtures changes needed — existing `factories.ts` (`makePipelineResult`, `makeGeminiAnalysis`) covers the aggregator suite

## Security Domain

This phase is database-schema + engine-internal code edits with no new user-facing input surface. ASVS analysis confined to data-integrity and access-control items relevant to the engine library and the migration.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | `platt_parameters` table is service-role-only via RLS (`ALTER TABLE platt_parameters ENABLE ROW LEVEL SECURITY` with no policies — service role bypasses RLS). New migration preserves this (no new policies added). |
| V5 Input Validation | yes (light) | `train-platt.ts --engine-version` arg accepted from CLI invocation; validated against `ENGINE_VERSION` default. Recommend regex validation matching `version.ts` shape (`/^\d+\.\d+\.\d+(-\w+)?$/`) before passing to INSERT — prevents accidental SQL-injection vector via misconfigured CLI invocation (low-severity since it's an offline CLI but defense-in-depth). |
| V6 Cryptography | no | No crypto changes |
| V9 Communication | no | No new external HTTP surface (existing Supabase + DashScope clients reused) |

### Known Threat Patterns for engine library

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale cache returns wrong calibration version | Information Disclosure | Cache-key namespacing per D-04 (`platt-params:${engineVersion}`); 24h TTL bounds blast radius |
| Migration partial-apply leaves table in inconsistent state | Tampering / Denial of Service | Atomic 3-step migration (Pattern 1) ensures either fully-applied or fully-reverted; Supabase migrations are wrapped in implicit transactions |
| CLI `--engine-version` accepts arbitrary string → INSERT injects unexpected value | Tampering | Validate against version regex before INSERT; default to `ENGINE_VERSION` constant — never allow user-supplied unvalidated string into DB |
| Live E2E (D-20) exposes internal `is_calibrated` flag to API response | Information Disclosure (intentional) | This is the *desired* behavior per CALIB-05; not a vulnerability. No PII or secret in `is_calibrated` boolean. |

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md** (`.planning/phases/15-calibration-refit-on-qwen-corpus/15-CONTEXT.md`) — D-01 through D-23, full re-interpretation locked
- **REQUIREMENTS.md** (`.planning/REQUIREMENTS.md`) — CALIB-01..05 wording + traceability table
- **ROADMAP.md** (`.planning/ROADMAP.md`) — Phase 15 goal + success criteria + parallelization shape
- **MILESTONE.md** (`.planning/MILESTONE.md`) — "Stack decisions" block, Qwen-only lock, engine_version discriminator rule
- **STATE.md** (`.planning/STATE.md`) — Engine Hardening status; Phase 14 just completed
- Live source files (all read in this session):
  - `src/lib/engine/calibration.ts` (323 LOC) — `getPlattParameters`, `fitPlattScaling`, `applyPlattScaling`, `plattCache`
  - `src/lib/engine/aggregator.ts` (lines 30-100, 490-590, 770-1000) — wiring site at 844-846, `SCORE_WEIGHTS` at 45-54, `is_calibrated` consumed at 994
  - `src/lib/engine/version.ts` (9 LOC) — `ENGINE_VERSION = "3.0.0"`
  - `src/lib/engine/corpus/cli/train-platt.ts` (176 LOC) — `getArg`/`hasFlag` helpers, INSERT path
  - `src/lib/engine/corpus/cli/eval-args.ts` (81 LOC) — `--engine-version` flag idiom already implemented in sibling CLI
  - `src/lib/engine/corpus/eval-config.ts` — `VIRAL_SCORE_CUT=70`, `UNDER_SCORE_CUT=30` at lines 83-84
  - `src/lib/engine/corpus/eval-runner.ts` — `runEvalOverCorpus` with cost cap
  - `src/lib/engine/corpus/eval-harness.ts` — `runEvalHarness` already supports `engineVersion` override
  - `src/lib/engine/corpus/metrics/macro-f1.ts` — `computeMacroF1`
  - `src/lib/engine/corpus/metrics/score-to-bucket.ts` — `bucketFromScore`
  - `src/lib/engine/wave3.ts` (lines 1-60) — `SUCCESS_THRESHOLD=7` at line 38
  - `src/lib/engine/__tests__/aggregator.test.ts` (lines 1-100, 425-460) — existing mock idiom + calibration-debt regression test
  - `src/lib/engine/corpus/baseline.ts` — `measureV21Baseline` template
  - `src/types/database.types.ts` (lines 880-918) — confirms `platt_parameters` has NO `engine_version` column today
  - `supabase/migrations/20260512000100_benchmark_results.sql` — template for column shape + composite index
  - `supabase/migrations/20260520000000_phase10_platt_parameters.sql` — current schema (NO engine_version)
- **v2.1 baseline doc** (via `git show main:.planning/research/v2.1-baseline.md`) — macro_f1=0.2940, ECE=0.3715, viral_recall=0.1064, per-niche values, full bucket distribution

### Secondary (MEDIUM confidence)

- **`.planning/codebase/STACK.md`** — Supabase CLI 2.74.5
- **CLAUDE.md** (project root) — Tailwind v4 / Raycast design notes (not load-bearing for Phase 15, included for completeness)

### Tertiary (LOW confidence — none flagged)

All claims in this research are verified against either CONTEXT.md (which itself cites live Supabase MCP evidence and code line numbers) or directly against source files I read in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reusable module's path + line number verified by reading source in this session
- Architecture: HIGH — CONTEXT.md locks the structure; this research confirms code matches CONTEXT's assumed shape
- Pitfalls: HIGH — Pitfall 1 (calibration-debt test) and Pitfall 3 (sweep runtime) are the most load-bearing; both verified by reading the test file and the aggregator score computation respectively
- Security: HIGH — minimal new attack surface; ASVS V4 + V5 items grounded in existing patterns

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — codebase is stable; Phase 14 just landed and the engine library is under additive-only milestone rule)
