# Phase 1: Training Corpus & Eval Foundation - Research

**Researched:** 2026-05-11
**Domain:** Apify TikTok scraping, supervised-learning corpus construction, classification eval (macro-F1 + ECE), bootstrap hypothesis testing, Vercel cron stubs, Supabase service-role schema design
**Confidence:** HIGH (codebase patterns + existing engine code + verified Apify docs); MEDIUM on specific actor `oldestPostDateUnified` semantics; HIGH on the choice to hand-roll macro-F1 and bootstrap (no library covers our exact use case).

## Summary

This phase ships two coupled artifacts: a labeled **500-video training corpus** (Supabase `training_corpus` table, two-stage build via 50-video pilot → 500-video full corpus across 5 niches) and an **engine eval harness** (`scripts/eval.ts` CLI + `src/lib/engine/corpus/` module) that produces `benchmark_results` rows with macro-F1, ECE, per-niche breakdown, per-signal leave-one-out contribution, cost, latency, and curated failure cases. The first run of the harness measures the **v2.1 baseline** and the threshold formula it gates on is persisted in code (`src/lib/engine/corpus/eval-config.ts`) and doc (`.planning/research/v2.1-baseline.md`).

Every architectural decision below is constrained by the 21 locked decisions in CONTEXT.md and the milestone-wide rule "additive only — no changes to `pipeline.ts`, `aggregator.ts`, `types.ts`". The phase is deliberately structured so the pilot (Wave 1 of execution) calibrates the empirical thresholds that the full corpus build (Wave 2 of execution) uses — the pilot is load-bearing, not exploratory.

**Primary recommendation:** Scaffold a parallel module `src/lib/engine/corpus/` (NOT extension of `src/lib/scraping/`), write Apify orchestration as a self-contained class that composes three named scrape configs per niche, persist threshold constants in versioned TypeScript (not a Supabase config table), expose the eval harness via `tsx scripts/eval.ts` CLI (NOT an API route), use a paired bootstrap for v2.1-vs-vN comparison, and store curated failure cases in a `benchmark_failure_cases` Supabase table (NOT JSON files in `.planning/`).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Corpus build strategy:**
- **D-01:** Phased build — 50-video pilot first (~10 viral / 20 avg / 20 under, proportional stratification), then 500-video full corpus after pilot validates infrastructure. Pilot's primary job is empirical threshold calibration for the full build, not the v2.1 baseline measurement (baseline runs on the 500-video corpus).
- **D-02:** Per-bucket independent sourcing:
  - **Viral:** Apify per-niche trending feed scrape, filter to ≥ niche-viral view threshold
  - **Average:** trending tail + niche-hashtag recent posts, filter to mid-range views
  - **Under:** dedicated Apify hashtag-sorted-by-views-ascending sweep per niche, filter to ≤ niche-under threshold
- **D-03:** Niche set locked — Beauty, Fitness, Education ("Edu"), Comedy, Lifestyle.
- **D-04:** Min video age = 7 days before outcome metrics trusted.
- **D-05:** Max 3 videos per creator diversity cap.
- **D-06:** Three Apify scrape configs per niche × 5 niches = 15 small scrape jobs for the pilot. Same structure for the full build (just larger result sets).

**Outcome bucketing:**
- **D-07:** Per-niche absolute view thresholds for bucketing.
- **D-08:** Pilot starting thresholds (loose):

  | Niche | Viral floor | Under ceiling |
  |---|---|---|
  | Beauty | ≥ 250k | ≤ 5k |
  | Fitness | ≥ 200k | ≤ 5k |
  | Edu | ≥ 100k | ≤ 2k |
  | Comedy | ≥ 500k | ≤ 10k |
  | Lifestyle | ≥ 250k | ≤ 5k |

  Average = everything between viral floor and under ceiling.

- **D-09:** Empirical threshold recalibration after pilot — pull actual per-niche view distributions from pilot scrape data, recompute thresholds (niche P90 for viral, niche P30 for under). Lock recomputed thresholds into the full-corpus build's `corpus_version`.
- **D-10:** Hard cutoff at the threshold — no exclusion of borderline videos.
- **D-11:** Bucketing logic in TypeScript at `src/lib/engine/corpus/` (importable, Vitest-testable).
- **D-12:** `corpus_version` semver-style identifier — `pilot.YYYY-MM-DD`, `full.YYYY-MM-DD`. Every record in `benchmark_results` tagged with `corpus_version + engine_version` pair.
- **D-13:** Fixed-snapshot thresholds per `corpus_version` — thresholds compute once at version seal time.

**Eval harness metrics:**
- **D-14:** Primary gate metric = macro-F1 on 3-class bucket classification (viral / avg / under).
- **D-15:** Per-niche floor on the gate — global macro-F1 must improve vs v2.1 baseline AND no individual niche's macro-F1 may regress by more than 5 percentage points vs that niche's v2.1 baseline.
- **D-16:** Secondary metrics: ECE, per-class precision/recall, per-signal leave-one-out contribution, cost per analysis, Spearman ρ within niche, MAE on engagement-rate prediction, failure case curation (top 10 mispredictions per run), per-stage latency p50/p95/p99, drift detector, viral recall + under precision.

**Threshold rule (v3 acceptance formula):**
- **D-17:** Relative improvement + statistical significance both required: v3 global macro-F1 must improve by ≥ X% relative vs v2.1; bootstrap resample (≥ 200 iterations) p-value < 0.05.
- **D-18:** Sliding scale for X based on the measured v2.1 baseline:
  - v2.1 macro-F1 ≤ 0.40 → require ≥ 15% relative improvement
  - 0.40 < v2.1 ≤ 0.55 → require ≥ 10% relative improvement
  - v2.1 > 0.55 → require ≥ 7% relative improvement + significance
- **D-19:** Threshold formula persisted in both code (`src/lib/engine/corpus/eval-config.ts`) and doc (`.planning/research/v2.1-baseline.md`). Cross-linked.
- **D-20:** Phase 1 ships with: (1) baseline report at `.planning/research/v2.1-baseline.md`, (2) threshold formula in `eval-config.ts`, (3) `benchmark_results` table seeded with the v2.1 baseline run.

**Engine version tagging (bootstrap):**
- **D-21:** Hardcoded version string for v2.1 baseline — `engine_version = "2.1.0"` as a literal string in `benchmark_results` rows. Phase 3 picks up the structural work; Phase 1 only needs the field to exist with a stable value.

### Claude's Discretion (research recommends below)

1. **Apify scraper architectural detail** — extend `src/lib/scraping/` vs scaffold parallel `src/lib/scraping/corpus/`. **Recommendation: §A.1.** Neither. Scaffold inside `src/lib/engine/corpus/` (co-located with bucketing + eval, since the scrape is corpus-specific not engine-side scraping).
2. **Eval harness CLI vs API** — `tsx scripts/eval.ts` vs internal API route. **Recommendation: §C.7.** CLI only.
3. **Bootstrap method** — paired vs unpaired. **Recommendation: §D.1.** Paired bootstrap.
4. **Failure case curation storage** — JSON in `.planning/benchmarks/` vs `benchmark_failure_cases` Supabase table. **Recommendation: §C.5.** Supabase table.

### Deferred Ideas (OUT OF SCOPE)

- Drift-aware adaptive thresholds across corpus versions
- Confidence-weighted labels
- Outcome auto-scraper for in-product analyses (in-product loop comes later, not in this milestone)
- Four-class bucketing system (with explicit "borderline" class)
- Re-niching the corpus (default is stay the course unless pilot evidence demands change)
- Eval harness as a public dashboard / Studio page

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORPUS-01 | 500-video training corpus built, stratified across 100 viral / 200 average / 200 underperforming | §A scrape architecture, §B bucketing logic; pilot = 50, full = 500 (D-01) |
| CORPUS-02 | 30-day rolling refresh mechanism (Apify scrape scheduled) | §H — stub only this phase; cron endpoint at `/api/cron/refresh-corpus` |
| CORPUS-03 | Multi-niche coverage — minimum 5 niches represented (beauty, fitness, edu, comedy, lifestyle) | §A.2 niche-config table; locked per D-03 |
| CORPUS-04 | Outcome metadata captured per video — views, completion %, shares, comments, saves, creator follower tier | §A.3 enrichment matrix; follower tier from apidojo `channel.followers` |
| CORPUS-05 | Outcome bucketing logic (viral / average / underperforming thresholds per niche) | §B threshold function + `corpus_version` snapshot pattern |
| CORPUS-06 | Corpus storage schema in Supabase (`training_corpus` table with video metadata + outcomes) | §F.1 schema |
| CORPUS-07 | Apify scrape job for corpus refresh (separate from competitor scraping) | §A.4 separation strategy + §H stub |
| CORPUS-08 | Corpus quality validation (no duplicates, valid outcomes, recent within window) | §A.5 validation rules; dedup on `platform_video_id` + max-3-per-creator (D-05) |
| EVAL-01 | Engine evaluation harness runs predictions across full corpus, batched | §C.1 batched execution with rate-limit budget |
| EVAL-02 | Accuracy metrics computed — prediction error vs actual (MAE for engagement, classification accuracy for viral bucket) | §C.2 macro-F1 (primary, D-14); §C.6 MAE on engagement-rate prediction |
| EVAL-03 | Per-signal contribution analysis — which signals add accuracy, which subtract | §C.3 leave-one-out via aggregator's `SignalAvailability` (no `aggregator.ts` change) |
| EVAL-04 | Calibration drift measurement — how well predicted percentiles map to actual percentiles | §C.4 ECE via existing `computeECE()` in `calibration.ts` |
| EVAL-05 | Regression detection — compare engine versions, flag accuracy decrease | §C.4 ECE + §D bootstrap p-value |
| EVAL-06 | Benchmark report generation (markdown summary + JSON metrics, persisted) | §C.7 CLI writes JSON to disk + Markdown summary; Supabase row in `benchmark_results` |
| EVAL-07 | Pass/fail gate against accuracy target (defined in Phase 1) | §G threshold formula in `eval-config.ts` |
| EVAL-08 | Baseline measurement of current engine (v2.1) on corpus before any changes ship | §E baseline workflow + cost guardrail |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Apify scrape orchestration (corpus build) | Node script (CLI) | API/Cron stub (refresh) | One-shot batch is operator-driven; stub exists for future cron-based refresh in Phase 11/12. Not user-facing, no UI tier. |
| Bucketing function | Library (`src/lib/engine/corpus/`) | — | Pure function; consumed by scrape script + eval harness + any future cron refresh. Co-located with engine code per D-11. |
| Threshold persistence | Static TypeScript constants | — | D-13 says fixed-snapshot per `corpus_version`. Static code = trivial reproducibility. |
| Eval harness | Node script (CLI) | Library (`src/lib/engine/corpus/`) | Pure functions for metrics; CLI shells around them. No API route per §C.7. |
| Schema migrations | Database | — | Supabase migrations only. |
| Failure case storage | Database | — | Supabase table per §C.5. |
| `benchmark_results` writes | Database | — | Service-role only (system-wide, not user-scoped per locked decision: "RLS on user-scoped tables; service role bypass for cron writes"). |

## Project Constraints (from CLAUDE.md)

- TypeScript strict mode, no `any` (no exceptions in engine code)
- Server components by default; this phase has no UI tier
- Commit format: `type(phase): description` (e.g., `docs(01): research training corpus`)
- File organization: source in `/src`, tests in `/src/**/__tests__/`, scripts in `/scripts`, migrations in `/supabase/migrations/`
- ALWAYS run tests after code changes; Vitest with 80% engine coverage threshold (`vitest.config.ts:25-30`)
- NEVER commit secrets — `APIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` read from `.env.local`
- Prefer editing existing files over creating new — but this phase scaffolds an entirely new module (`src/lib/engine/corpus/`), which is justified per the additive-only milestone rule

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `apify-client` | 2.22.1 (already installed) | Run Apify actors, fetch dataset results | Already the project's scraping client; pattern set in `src/lib/scraping/apify-provider.ts` |
| `@supabase/supabase-js` | 2.93.1 (already installed) | DB writes (service role) | Existing pattern: `createServiceClient()` from `src/lib/supabase/service.ts:11` |
| `zod` | 4.3.6 (already installed) | Validate scrape outputs, eval CLI args | Existing schemas in `src/lib/schemas/competitor.ts` cover both clockworks and apidojo output shapes |
| `nanoid` | 5.1.6 (already installed) | Run IDs for eval runs | Already used in `pipeline.ts:176` |
| `tsx` | (already used via `npx tsx`) | Run `scripts/eval.ts` | Pattern in `package.json:23-24` (`analyze`, `benchmark`) |
| `tsconfig-paths` | (already used) | Resolve `@/` aliases in scripts | Pattern in `scripts/benchmark.ts:18-22` |
| `vitest` | 4.0.18 (already installed) | Unit tests for bucketing + metric functions | 80% threshold per `vitest.config.ts:25-30` |
| `dotenv` | 17.3.1 (already installed) | Load `.env.local` in scripts | Pattern in `scripts/import-apify-data.ts:6` |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@sentry/nextjs` | 10.39.0 (already installed) | Capture eval-harness exceptions | Same pattern as `calibration.ts:84-86` — tag with `{ stage: "eval_harness" }` |
| `simple-statistics` | NOT INSTALLED, do NOT add | (rejected) — see below | We hand-roll macro-F1 + bootstrap; the library does not cover bootstrap and adding it for one quantile call is bloat |

[VERIFIED: ran `npm view simple-statistics version` → 7.8.9 latest, 2026-05-11. Confirmed via [simple-statistics docs](https://simple-statistics.github.io/) and [GitHub repo](https://github.com/simple-statistics/simple-statistics) — package supports "descriptive, regression, and inference statistics" but does NOT ship bootstrap utilities, paired bootstrap, or permutation tests.]

### Alternatives Considered

| Instead of | Could Use | Why Not |
|---|---|---|
| Hand-rolled macro-F1 (~30 LOC) | `simple-statistics` or `ml-confusion-matrix` npm | Macro-F1 is 30 lines of pure TS; adding a dep for it has worse ROI than the in-repo test surface |
| Hand-rolled paired bootstrap (~40 LOC) | scipy-port libraries / `bootstrap` npm | No mature TS library exists; hand-roll is trivial and bounded scope (≥200 iterations, paired sampling, ~40 LOC) |
| Hand-rolled Spearman ρ (~15 LOC) | `simple-statistics` `sampleRankCorrelation` | One function; same ROI calculation as macro-F1 |
| `aggregator.ts` extension for leave-one-out | Compute LOO by mocking `SignalAvailability` at the call site | Per CONTEXT.md, milestone is additive-only. The harness sets `SignalAvailability` flags itself before calling `aggregateScores()` — no engine code change needed. See `aggregator.ts:50-85` `selectWeights` |
| Run v2.1 via internal API route | CLI script that imports `runPredictionPipeline()` directly | `scripts/benchmark.ts:24-25` already imports `pipeline` + `aggregator` directly. CLI avoids needing the Next dev server and isn't a tier the user touches |
| New Supabase config table for thresholds | Static TS constants in `eval-config.ts` | D-13 mandates fixed-snapshot per `corpus_version`. Constants in versioned code = bit-perfect reproducibility |

**Installation:** All required packages are already in `package.json`. **No new dependencies for this phase.**

**Version verification:** Verified `npm view apify-client version` → 2.23.2 (current latest). Project pins to `^2.22.1` (works with 2.23.x semver-wise). No version bump needed. [VERIFIED: 2026-05-11, npm registry]

## Architecture Patterns

### System Architecture Diagram

```
                              ┌──────────────────────────────┐
                              │  .env.local — APIFY_TOKEN,   │
                              │  SUPABASE_SERVICE_ROLE_KEY   │
                              └──────────────┬───────────────┘
                                             │
        ┌────────────────────────────────────┼──────────────────────────────────┐
        │ scripts/build-corpus.ts (CLI)      │                                  │
        │                                    │                                  │
        │  1. Niche loop (5 niches × 3 cfgs) │                                  │
        │  2. For each cfg: Apify actor call │                                  │
        │  3. Filter (age ≥7d, dedup, max-3) │                                  │
        │  4. Bucket via thresholds          │                                  │
        │  5. Upsert into training_corpus    │                                  │
        └──────────────────┬─────────────────┘                                  │
                           │                                                    │
                           ▼                                                    │
         ┌──────────────────────────────────┐                                   │
         │ Apify Cloud:                     │                                   │
         │   clockworks/tiktok-scraper      │                                   │
         │   (hashtags, dates, sort, limit) │                                   │
         └──────────────────┬───────────────┘                                   │
                            │ dataset items                                     │
                            ▼                                                   │
         ┌──────────────────────────────────┐                                   │
         │ src/lib/engine/corpus/           │                                   │
         │   normalize-scrape.ts            │  Zod-validated, normalized row    │
         │   bucket.ts (bucketRow)          │  → { bucket: viral|avg|under }    │
         │   thresholds.ts (per-version)    │                                   │
         └──────────────────┬───────────────┘                                   │
                            │                                                   │
                            ▼                                                   │
         ┌──────────────────────────────────┐                                   │
         │ Supabase: training_corpus        │ ← 50 (pilot) → 500 (full)         │
         └──────────────────┬───────────────┘                                   │
                            │                                                   │
                            │            ┌──────────────────────────────┐      │
                            ▼            ▼                              │      │
                     ┌────────────────────────────────────────────┐     │      │
                     │ scripts/eval.ts (CLI)                      │     │      │
                     │                                            │     │      │
                     │  --engine-version 2.1.0                    │     │      │
                     │  --corpus-version pilot.2026-05-12         │     │      │
                     │  --leave-one-out (optional)                │     │      │
                     │                                            │     │      │
                     │  For each row in training_corpus:          │     │      │
                     │   1. Build AnalysisInput from row          │     │      │
                     │   2. Call runPredictionPipeline()          │     │      │
                     │   3. Call aggregateScores()                │     │      │
                     │   4. Map overall_score → predicted bucket  │     │      │
                     │   5. Collect: pred, actual, cost, latency  │     │      │
                     │                                            │     │      │
                     │  Aggregate:                                │     │      │
                     │   - Macro-F1 (global + per-niche)          │     │      │
                     │   - ECE (computeECE from calibration.ts)   │     │      │
                     │   - Per-signal LOO (re-run with mocked SA) │     │      │
                     │   - Per-stage latency p50/p95/p99          │     │      │
                     │   - Top-10 failure cases                   │     │      │
                     │   - Bootstrap p-value (if comparing 2 runs)│     │      │
                     └─────────────┬───────────────────┬──────────┘     │      │
                                   │                   │                │      │
                                   ▼                   ▼                │      │
              ┌─────────────────────────────┐   ┌──────────────────┐   │      │
              │ Supabase: benchmark_results │   │ Supabase:        │   │      │
              │   (one row per metric, long │   │ benchmark_       │   │      │
              │    format; metric_metadata  │   │ failure_cases    │   │      │
              │    JSONB)                   │   │   (one row per   │   │      │
              └─────────────┬───────────────┘   │    misprediction)│   │      │
                            │                   └──────────────────┘   │      │
                            ▼                                          │      │
         ┌──────────────────────────────────┐                          │      │
         │ Output artifacts:                │                          │      │
         │  - .planning/research/           │                          │      │
         │    v2.1-baseline.md (one-time,   │                          │      │
         │    Phase 1)                      │                          │      │
         │  - .planning/benchmarks/         │                          │      │
         │    YYYY-MM-DD-runId.json (every  │                          │      │
         │    run)                          │                          │      │
         └──────────────────────────────────┘                          │      │
                                                                       │      │
         ┌──────────────────────────────────┐                          │      │
         │ src/app/api/cron/refresh-corpus  │ ◄── Vercel cron (Phase   │      │
         │   (STUB this phase, real Phase   │     11/12 wires it real) │      │
         │   11/12 — verifyCronAuth →       │                          │      │
         │   log "not yet implemented" →    │                          │      │
         │   200)                           │                          │      │
         └──────────────────┬───────────────┘                          │      │
                            │                                          │      │
                            └──────────────────────────────────────────┘      │
                                                                              │
         ┌────────────────────────────────────────────────────────────────────┘
         │
         ▼ (no UI tier — operator-driven; Phase 11/12 may surface results)
```

### Recommended Project Structure

```
src/lib/engine/corpus/                  # NEW module, additive
├── thresholds.ts                       # Per-corpus_version threshold constants (D-13)
├── eval-config.ts                      # Threshold formula (D-19); sliding-scale (D-18)
├── bucket.ts                           # bucketRow(row, thresholds, niche) → bucket
├── normalize-scrape.ts                 # Apify item → normalized row (covers clockworks + apidojo)
├── apify-jobs.ts                       # 3 named configs × 5 niches = scrape-job definitions
├── orchestrator.ts                     # buildCorpus(version, isPilot, dryRun) — sequential per-niche, isolated failures
├── eval-runner.ts                      # runEval(corpusVersion, engineVersion, opts) — fetches corpus, runs pipeline, returns metrics
├── metrics/
│   ├── macro-f1.ts                     # computeMacroF1(predicted, actual, classes) → { global, perClass: {viral, avg, under} }
│   ├── bootstrap.ts                    # pairedBootstrapPValue(arrA, arrB, statFn, iters=200, seed) → { p, ci }
│   ├── leave-one-out.ts                # runLeaveOneOut(row, signalName) → re-aggregates with that signal forced unavailable
│   ├── failure-cases.ts                # top10Mispredictions(rows) → curated list
│   └── stage-latency.ts                # aggregateStageLatencies(timings[]) → p50/p95/p99 per stage
└── __tests__/
    ├── bucket.test.ts                  # Table-driven: threshold edges, all 5 niches, hard cutoff (D-10)
    ├── thresholds.test.ts              # version lookup, stable snapshot semantics (D-13)
    ├── macro-f1.test.ts                # Known fixtures from sklearn outputs
    ├── bootstrap.test.ts               # Deterministic seed → reproducible p-value
    ├── normalize-scrape.test.ts        # apidojo + clockworks both → identical normalized shape
    └── eval-runner.test.ts             # Pipeline mocked; verify metric aggregation paths

scripts/
├── build-corpus.ts                     # CLI: build pilot or full corpus from Apify
└── eval.ts                             # CLI: run eval harness over corpus

src/app/api/cron/refresh-corpus/
└── route.ts                            # Stub: verifyCronAuth → log → 200

supabase/migrations/
├── 20260512000000_training_corpus.sql       # training_corpus table
├── 20260512000100_benchmark_results.sql     # benchmark_results table (long format)
└── 20260512000200_benchmark_failure_cases.sql  # benchmark_failure_cases table

.planning/research/
└── v2.1-baseline.md                    # Created on first baseline run; cross-linked to eval-config.ts

.planning/benchmarks/
└── (gitignored at root; per-run JSON dumps for offline inspection)
```

### Pattern 1: Pure-function metric layer + script-only side effects

**What:** Every metric computation is a pure function in `src/lib/engine/corpus/metrics/`. The CLI in `scripts/eval.ts` is the only side-effectful caller (DB read, DB write, file write). Vitest tests the metrics in isolation; the CLI is integration-tested end-to-end against a fixture corpus.

**When to use:** Throughout this module. This mirrors `calibration.ts:114-176` where `computeECE` is pure and `generateCalibrationReport` is the side-effectful wrapper.

**Example:**

```typescript
// src/lib/engine/corpus/metrics/macro-f1.ts
// [CITED: existing pattern from src/lib/engine/calibration.ts:114-176]

export type BucketLabel = "viral" | "avg" | "under";
const CLASSES: BucketLabel[] = ["viral", "avg", "under"];

export interface F1PerClass {
  precision: number;
  recall: number;
  f1: number;
  support: number; // number of actual examples in this class
}

export interface MacroF1Result {
  macroF1: number;                                // average of per-class F1
  perClass: Record<BucketLabel, F1PerClass>;
  confusionMatrix: number[][];                    // [actual][predicted]
}

/** Pure function: compute macro-F1 for 3-class bucket classification. */
export function computeMacroF1(
  predicted: BucketLabel[],
  actual: BucketLabel[]
): MacroF1Result {
  if (predicted.length !== actual.length) {
    throw new Error("predicted and actual must be same length");
  }

  const classIdx: Record<BucketLabel, number> = { viral: 0, avg: 1, under: 2 };
  const cm: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < predicted.length; i++) {
    cm[classIdx[actual[i]!]]![classIdx[predicted[i]!]]!++;
  }

  const perClass = {} as Record<BucketLabel, F1PerClass>;
  for (const c of CLASSES) {
    const idx = classIdx[c];
    const tp = cm[idx]![idx]!;
    const fp = cm.reduce((s, row, r) => s + (r === idx ? 0 : row[idx]!), 0);
    const fn = cm[idx]!.reduce((s, v, p) => s + (p === idx ? 0 : v), 0);
    const support = tp + fn;
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    perClass[c] = { precision, recall, f1, support };
  }

  const macroF1 = CLASSES.reduce((s, c) => s + perClass[c].f1, 0) / CLASSES.length;
  return { macroF1, perClass, confusionMatrix: cm };
}
```

[CITED: standard macro-F1 formula — [scikit-learn f1_score docs](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html) — "macro F1 = mean of per-class F1, treating each class equally."]

### Pattern 2: Versioned threshold snapshot

**What:** `corpus_version` is a typed identifier (e.g., `"pilot.2026-05-12"`, `"full.2026-05-19"`) whose thresholds are looked up via a switch / lookup table in `src/lib/engine/corpus/thresholds.ts`. New versions = new entry in the table. Old versions stay untouched, ever.

**When to use:** Every read/write involving thresholds. Eval harness always passes the corpus_version through.

**Example:**

```typescript
// src/lib/engine/corpus/thresholds.ts
// D-08 + D-13: snapshots are immutable per corpus_version

export type Niche = "beauty" | "fitness" | "edu" | "comedy" | "lifestyle";
export type CorpusVersion = `${"pilot" | "full"}.${string}`; // e.g., "pilot.2026-05-12"

export interface NicheThresholds {
  viralFloor: number;     // ≥ → viral
  underCeiling: number;   // ≤ → under
  // Average = between underCeiling (exclusive) and viralFloor (exclusive)
}

type ThresholdsByNiche = Record<Niche, NicheThresholds>;

/**
 * Threshold snapshots — one entry per corpus_version.
 * Add new entries; NEVER edit existing ones.
 */
const THRESHOLD_SNAPSHOTS: Record<CorpusVersion, ThresholdsByNiche> = {
  // D-08 starting (loose) thresholds — used for the pilot scrape
  "pilot.2026-05-12": {
    beauty:    { viralFloor: 250_000, underCeiling: 5_000 },
    fitness:   { viralFloor: 200_000, underCeiling: 5_000 },
    edu:       { viralFloor: 100_000, underCeiling: 2_000 },
    comedy:    { viralFloor: 500_000, underCeiling: 10_000 },
    lifestyle: { viralFloor: 250_000, underCeiling: 5_000 },
  },
  // D-09 — full corpus thresholds are recomputed from pilot P90/P30 and pinned here
  // (PLACEHOLDER — actual values written after pilot scrape completes; this MUST be
  // populated by the corpus build script's "seal version" step)
  // "full.2026-05-19": { ... },
};

export function getThresholds(version: CorpusVersion): ThresholdsByNiche {
  const snap = THRESHOLD_SNAPSHOTS[version];
  if (!snap) throw new Error(`Unknown corpus_version: ${version}`);
  return snap;
}
```

### Pattern 3: Leave-one-out without engine code changes

**What:** Per EVAL-03, eval harness must produce per-signal contribution. The existing aggregator (`src/lib/engine/aggregator.ts:50-85`) already has `selectWeights(availability)` that redistributes weights when signals are missing. To get LOO, the harness calls `aggregateScores()` once normally, then once per signal with the `SignalAvailability` flag forced to `false` for that signal. The aggregator code never changes; the harness drives the flag by mutating the `pipelineResult.warnings` array (which is what `selectWeights` reads — see `aggregator.ts:288-302`).

**When to use:** EVAL-03. Generates `{ baseline_score, score_without_ml, score_without_trends, score_without_rules, ... }` per row.

**Example:**

```typescript
// src/lib/engine/corpus/metrics/leave-one-out.ts
import { aggregateScores } from "@/lib/engine/aggregator";
import type { PipelineResult } from "@/lib/engine/pipeline";

const SIGNALS = ["behavioral", "gemini", "ml", "rules", "trends"] as const;
type Signal = typeof SIGNALS[number];

/**
 * Re-run aggregation with one signal forced unavailable.
 * Mutation strategy: append a synthetic warning that selectWeights() matches.
 * This is the same mechanism the pipeline itself uses to signal degraded stages.
 */
export async function aggregateWithoutSignal(
  pipelineResult: PipelineResult,
  signal: Signal
): Promise<number> {
  // Clone pipelineResult so we don't mutate the original (eval rotates through all signals)
  const cloned: PipelineResult = {
    ...pipelineResult,
    warnings: [...pipelineResult.warnings, `${signalKeyToWarning(signal)} unavailable`],
  };
  // For behavioral, override deepseekResult to null directly
  if (signal === "behavioral") cloned.deepseekResult = null;
  // For gemini, zero out factor scores (HARD-03 pattern from aggregator.ts:290)
  if (signal === "gemini") {
    cloned.geminiResult = {
      ...cloned.geminiResult,
      analysis: {
        ...cloned.geminiResult.analysis,
        factors: cloned.geminiResult.analysis.factors.map((f) => ({ ...f, score: 0 })),
      },
    };
  }
  // For ml/rules/trends, the warning string is what selectWeights() reads
  // (see aggregator.ts:288-302 for the exact warning-string matching logic)
  const result = await aggregateScores(cloned);
  return result.overall_score;
}

const signalKeyToWarning: Record<Signal, string> = {
  behavioral: "DeepSeek reasoning",
  gemini: "Gemini analysis",
  ml: "ML model",         // NOTE: not actually matched by selectWeights — see §C.3 caveat
  rules: "Rule scoring",
  trends: "Trend enrichment",
};
```

⚠️ **Important caveat (§C.3):** Reading `aggregator.ts:288-302` carefully, the `availability.ml` flag depends on `predictWithML(features) !== null`, NOT a warning string. To force `ml: false` cleanly, the harness must either (1) mock `predictWithML` to return null for that one pass, or (2) replicate the aggregator math directly using `selectWeights({...availability, ml: false})`. The plan should pick one — **researcher recommends (2): replicate aggregator's score math in the harness for the LOO case only.** This adds ~30 LOC of duplication but avoids module mocking inside scripts.

### Anti-Patterns to Avoid

- **Storing thresholds in a Supabase config table.** D-13 mandates immutable snapshots. A DB row is mutable (someone WILL `UPDATE` it during an incident). Versioned TypeScript is bit-perfectly reproducible — old commits replay exactly.
- **Querying Apify for "viral" videos directly via a hardcoded view count.** The Apify scraper does not support server-side view-count filters (verified — `clockworks/tiktok-scraper` has `oldestPostDate`/`newestPostDate`, NOT min/max view filters). Filter view counts *client-side* after the scrape.
- **Running corpus scrape via a Vercel API route.** Vercel functions have a 60s default timeout (300s on Pro). 15 sequential Apify calls × ~30s each = 450s. Use the CLI (`tsx scripts/build-corpus.ts`) on a developer machine. The cron stub for the 30-day refresh (§H) is separate — it triggers Apify jobs (which run on Apify's infra) but does not wait for them.
- **Skipping the pilot.** D-01 makes the pilot load-bearing for threshold calibration (D-09). Skipping to 500-video full build with the loose D-08 thresholds will under- or over-fill buckets and force a re-run anyway.
- **Allowing the corpus scrape to write directly to the engine's `scraped_videos` table.** That table is for the `competitors` / trending feature. The `training_corpus` table is the corpus's storage — they have different lifecycle (corpus has `corpus_version`, scraped_videos is append-only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Apify run + dataset fetch | Custom HTTP wrapper around Apify REST API | `apify-client` v2.22.1 (already installed) | Existing pattern in `src/lib/scraping/apify-provider.ts:11-15`; retries, pagination, dataset listing all handled |
| Zod parsing Apify output | Manual field-by-field check | Reuse `apifyVideoSchema` from `src/lib/schemas/competitor.ts:52-69` for clockworks format; build parallel `apidojoVideoSchema` matching `scripts/import-apify-data.ts:11-44` for apidojo format | `safeParse` + skip-on-fail pattern at `apify-provider.ts:65-77` |
| Cron auth | Hand-rolled secret check | `verifyCronAuth(request)` from `src/lib/cron-auth.ts:9-18` | Single helper, used by all 7 existing crons |
| ECE computation | Re-implement binning | `computeECE(pairs, numBins)` from `src/lib/engine/calibration.ts:114-176` | Already tested, already in repo, already at 80% coverage |
| Platt scaling | Re-implement sigmoid fit | `fitPlattScaling` + `applyPlattScaling` from `calibration.ts:221-293` | Same — already used in `aggregator.ts:353-360` |
| Service-role Supabase client | New client setup | `createServiceClient()` from `src/lib/supabase/service.ts:11` | Pattern: bypasses RLS, used by all crons |
| Structured logger | `console.log` | `createLogger({ module: "corpus" })` from `src/lib/logger.ts:63` | JSON in prod, pretty in dev, level-filtered |
| Apify dataset → DB upsert mapping | Reinvent format detection | Reuse `mapToRecord()` from `scripts/import-apify-data.ts:64-119` (handles both clockworks and apidojo formats) | Extract into `src/lib/engine/corpus/normalize-scrape.ts`, share with the existing import script |
| Stage timing for pipeline | Re-instrument | `runPredictionPipeline()` already returns `timings: StageTiming[]` (see `pipeline.ts:29-32`, `pipeline.ts:431`); harness aggregates p50/p95/p99 from this array | No engine change |

**Key insight:** This phase has very low net-new infrastructure. The 500-video corpus + eval harness sits on top of: Apify (existing), Supabase (existing), `runPredictionPipeline` (untouched), `calibration.ts` ECE (existing), and `tsx` script pattern (existing). New code is mostly orchestration glue + pure metric functions + one schema migration. **The biggest risk is mis-using the existing primitives, not building new ones.**

## Runtime State Inventory

> Not a rename/refactor phase — this section omitted per agent instructions. Greenfield additive module.

## Common Pitfalls

### Pitfall 1: Apify min-age filter must be client-side
**What goes wrong:** Operator wants "videos ≥ 7 days old" (D-04). Setting `oldestPostDate` filters videos uploaded ON OR AFTER that date — gives the OPPOSITE of what we want (only recent videos).
**Why it happens:** Apify's documented `oldestPostDate` semantics — "only scrapes videos uploaded after or on the specified date" (verified [WebSearch result on clockworks scraper changelog/issues](https://apify.com/clockworks/tiktok-scraper/input-schema), 2026-05-11).
**How to avoid:**
1. Set `newestPostDate = (today - 7 days)` in the Apify input (videos uploaded ON OR BEFORE that date)
2. Also set `oldestPostDate = (today - 90 days)` as a sanity bound (avoid scraping ancient videos)
3. In `normalize-scrape.ts`, additionally filter by `posted_at <= now - 7 days` client-side as belt-and-suspenders (Apify date filters reportedly only work with `Latest`/`Oldest` sort)

**Warning signs:** Pilot returns 0 videos for some niches; a sample row has `posted_at` within last 24h.

### Pitfall 2: Apify hashtag scraper has no server-side view-count sort
**What goes wrong:** D-02 asks for "Apify hashtag-sorted-by-views-ascending sweep" for the under bucket. `clockworks/tiktok-scraper` and `clockworks/tiktok-hashtag-scraper` don't expose a view-ascending sort.
**Why it happens:** Verified — input schema for both actors lacks a `sortType` matching "least viewed". `apidojo/tiktok-scraper-api` has `sortType` but only `RELEVANCE | MOST_LIKED | DATE_POSTED`. None give "least viewed first".
**How to avoid:**
1. Scrape with `resultsPerPage` high (e.g., 200–400) sorted by `DATE_POSTED` (apidojo) or default sort (clockworks)
2. **Filter to ≤ underCeiling client-side**
3. If client-side filter yields <40 underperforming videos per niche, increase `resultsPerPage` and re-scrape. Document this in the pilot retrospective for the full-corpus build.

**Warning signs:** Under bucket under-fills; debug by logging the view-count distribution of raw scrape items per niche.

### Pitfall 3: Max-3-per-creator dedup must run AFTER bucketing
**What goes wrong:** Naive dedup (max 3 per `author`) at scrape ingestion time happens before the bucketing classifier runs. If you dedup before bucketing, you might drop a creator's viral video in favor of two of their average ones.
**Why it happens:** Order matters. The right order is: (1) scrape all, (2) bucket, (3) within each bucket, max-3-per-creator.
**How to avoid:**
1. Normalize all rows
2. Bucket all rows
3. For each bucket, group by `creator_handle`, drop to top-3 (sort: by views desc within viral/avg, by views asc within under) per creator
4. THEN stratified sample down to bucket targets (100 viral / 200 avg / 200 under)

**Warning signs:** A single creator dominates one bucket; bucket distribution is skewed toward 2-3 creators.

### Pitfall 4: Engagement-rate noise on tiny-view videos
**What goes wrong:** A 50-view video with 5 likes is "10% engagement rate"; a 1M-view video with 50K likes is "5% engagement rate." Treating either as ground truth for MAE-on-engagement-rate (EVAL-02) over-rewards low-view noise.
**Why it happens:** Engagement rate is `(likes + ... ) / views`. At view counts <500, the denominator is too small for the ratio to be stable.
**How to avoid:**
1. For the under bucket (where views <= underCeiling), exclude MAE-on-engagement-rate from the per-niche aggregation
2. Document this in `eval-config.ts` as a constant: `MIN_VIEWS_FOR_MAE_ENGAGEMENT = 1000`
3. Report MAE-on-engagement-rate only across "viral + avg" buckets globally; report the under bucket's MAE separately if computed

**Warning signs:** Per-niche MAE looks suspiciously high for the under bucket only; investigation shows it's noise on low-denominator ratios.

### Pitfall 5: Pipeline cost guardrail must hard-cap before $37.50
**What goes wrong:** v2.1 baseline run = 500 videos × ~$0.075/analysis = $37.50 worst-case. If a Gemini API outage causes retry-storm, costs can multiply. No mid-run abort = silent burn.
**Why it happens:** `aggregateScores()` returns `cost_cents` per analysis; harness sums but doesn't gate.
**How to avoid:**
1. Track running total; abort at $50 (33% safety buffer over the $37.50 ceiling)
2. Implement a per-row max cost — if a single row reports `cost_cents > 15` (i.e., $0.15 — 2× the avg), log a warning. If 3 in a row exceed, abort.
3. CLI flag `--max-total-cost-cents 5000` (= $50)

**Warning signs:** `cost_cents` field on consecutive rows trends upward; total mid-run already over $20.

### Pitfall 6: Bucket bin distribution shift across versions
**What goes wrong:** Comparing v2.1 macro-F1 from `pilot.2026-05-12` against vN macro-F1 from `full.2026-05-19` is APPLES TO ORANGES because the corpus changed. Drift in TikTok user behavior alone moves the distribution.
**Why it happens:** EVAL-05 calls for "regression detection across engine versions." Locked decision is `benchmark_results` tagged with `corpus_version + engine_version` pair (D-12).
**How to avoid:**
1. **All eval comparisons MUST hold corpus_version constant.** v2.1 baseline runs on the 500-video corpus (D-01); v3 acceptance benchmark in Phase 12 runs on the SAME corpus_version.
2. Bootstrap p-value (§D.1) is paired on the same videos. Reject any unpaired comparison.
3. Document in `eval-config.ts`: `enforceSameCorpusVersion(runA, runB)` throws if versions differ.

**Warning signs:** Big delta in macro-F1 between two engine versions; investigation shows the corpus_version differs.

### Pitfall 7: `selectWeights` warning-string fragility
**What goes wrong:** Leave-one-out (§C.3) relies on warning-string matching at `aggregator.ts:294-301`. If someone changes the warning string in a future commit, LOO silently breaks.
**Why it happens:** String-based detection is brittle.
**How to avoid:**
1. Use approach (2) from §C.3: replicate the aggregator's score math in `metrics/leave-one-out.ts` rather than mutating warnings
2. Add a regression test: `aggregator.test.ts` verifies the exact warning strings the LOO module depends on
3. The Phase 3 versioning work has structural changes — LOO must be revisited then

**Warning signs:** LOO contributions all flatline at exactly the same number across signals.

### Pitfall 8: Vitest 80% coverage threshold on metric code
**What goes wrong:** `vitest.config.ts:14-30` requires 80% on `src/lib/engine/**/*.ts`. The new `src/lib/engine/corpus/` subdirectory inherits this. A few uncovered branches in bootstrap edge-cases (empty input, all-equal arrays) tank coverage.
**Why it happens:** Coverage is enforced globally.
**How to avoid:**
1. Write tests FIRST for `bucket.ts`, `metrics/macro-f1.ts`, `metrics/bootstrap.ts` (these are pure functions; trivial to test)
2. Use table-driven tests; one test file per metric module
3. CLI files (`scripts/build-corpus.ts`, `scripts/eval.ts`) are NOT in `src/lib/engine/` so they don't count toward this threshold

**Warning signs:** `npm test:coverage` fails after merging the corpus module.

## Code Examples

Verified patterns from existing code + targeted research.

### A.1 Apify scrape job per niche × per config

```typescript
// src/lib/engine/corpus/apify-jobs.ts
// [CITED: clockworks/tiktok-scraper input schema — Apify docs]
// https://apify.com/clockworks/tiktok-scraper/input-schema

export type Niche = "beauty" | "fitness" | "edu" | "comedy" | "lifestyle";
export type ScrapeConfigKind = "trending" | "average" | "under";

export interface ApifyScrapeConfig {
  actorId: string;
  input: Record<string, unknown>;
  expectedItems: number;       // post-filter target (rough)
}

const NICHE_HASHTAGS: Record<Niche, string[]> = {
  beauty:    ["beauty", "skincare", "makeup", "glowup"],
  fitness:   ["fitness", "gym", "workout", "gymtok"],
  edu:       ["learnontiktok", "education", "studytips", "edutok"],
  comedy:    ["comedy", "funny", "humor", "fyp"],
  lifestyle: ["lifestyle", "dayinmylife", "morningroutine", "aesthetic"],
};

const TRENDING_FEED_HASHTAGS: Record<Niche, string[]> = {
  beauty:    ["beauty", "fyp"],          // viral candidates — high-traffic tags
  fitness:   ["fitness", "fyp"],
  edu:       ["learnontiktok", "fyp"],
  comedy:    ["comedy", "fyp"],
  lifestyle: ["lifestyle", "fyp"],
};

/** Date helpers — D-04: min video age = 7 days */
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0]!; // YYYY-MM-DD
}

const ACTOR_CLOCKWORKS_TIKTOK = "clockworks/tiktok-scraper";

/**
 * Build the three Apify configs per niche.
 * Pilot uses smaller resultsPerPage; full uses larger.
 */
export function buildApifyJobs(niche: Niche, isPilot: boolean): Record<ScrapeConfigKind, ApifyScrapeConfig> {
  const sizeMultiplier = isPilot ? 1 : 5;
  // D-04: min age = 7d → newestPostDate is 7 days ago (no videos newer than that)
  const newestPostDate = daysAgo(7);
  // Sanity bound: don't go back beyond 90 days
  const oldestPostDate = daysAgo(90);

  return {
    // Config 1: per-niche TRENDING feed for viral candidates
    trending: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        hashtags: TRENDING_FEED_HASHTAGS[niche],
        resultsPerPage: 40 * sizeMultiplier,
        newestPostDate,
        oldestPostDate,
        excludePinnedPosts: true,
      },
      expectedItems: isPilot ? 15 : 60,    // post-filter, into viral bucket
    },
    // Config 2: niche-hashtag recent posts for average bucket
    average: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 60 * sizeMultiplier,
        newestPostDate,
        oldestPostDate,
        excludePinnedPosts: true,
      },
      expectedItems: isPilot ? 25 : 100,   // post-filter, into average bucket
    },
    // Config 3: hashtag scrape for under bucket
    // ⚠️ Pitfall 2: no server-side ascending-by-views sort exists.
    // Scrape broadly, filter client-side to ≤ underCeiling.
    under: {
      actorId: ACTOR_CLOCKWORKS_TIKTOK,
      input: {
        hashtags: NICHE_HASHTAGS[niche],
        resultsPerPage: 80 * sizeMultiplier,
        newestPostDate,
        oldestPostDate,
        excludePinnedPosts: true,
        // Apify's default sort returns more recent + diverse view counts;
        // client-side filter does the heavy lifting.
      },
      expectedItems: isPilot ? 25 : 100,   // post-filter, into under bucket
    },
  };
}
```

[VERIFIED: 2026-05-11, Apify clockworks/tiktok-scraper input schema covers `hashtags`, `resultsPerPage`, `oldestPostDate`, `newestPostDate`, `oldestPostDateUnified`, `excludePinnedPosts`. View-count filtering is NOT supported server-side — confirmed via WebFetch of [clockworks/tiktok-scraper Apify page](https://apify.com/clockworks/tiktok-scraper).]

### A.2 Sequential per-niche orchestration with isolated failures

```typescript
// src/lib/engine/corpus/orchestrator.ts
// [CITED: pattern from src/app/api/cron/refresh-competitors/route.ts:50-100 — per-handle isolation]

import { ApifyClient } from "apify-client";
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import { buildApifyJobs, type Niche, type ScrapeConfigKind } from "./apify-jobs";
import { normalizeScrapedItem } from "./normalize-scrape";
import { bucketRow } from "./bucket";
import { getThresholds, type CorpusVersion } from "./thresholds";

const log = createLogger({ module: "corpus/orchestrator" });

const NICHES: Niche[] = ["beauty", "fitness", "edu", "comedy", "lifestyle"];
const CONFIGS: ScrapeConfigKind[] = ["trending", "average", "under"];

const BUCKET_TARGETS_PILOT = { viral: 10, avg: 20, under: 20 };
const BUCKET_TARGETS_FULL = { viral: 100, avg: 200, under: 200 };

/**
 * Build the training corpus end-to-end.
 *
 * Strategy: 5 niches × 3 configs = 15 sequential Apify calls.
 * Sequential (not parallel) for two reasons:
 *   1. Apify free/starter plans have concurrent-run caps
 *   2. Per-niche-config failures should be isolated, not abort the whole batch
 *      (mirrors refresh-competitors:50-100 pattern)
 */
export async function buildCorpus(opts: {
  corpusVersion: CorpusVersion;
  isPilot: boolean;
  dryRun?: boolean;
}): Promise<{ inserted: number; failed: Array<{ niche: Niche; config: ScrapeConfigKind; error: string }> }> {
  const { corpusVersion, isPilot, dryRun = false } = opts;
  const supabase = createServiceClient();
  const apify = new ApifyClient({ token: process.env.APIFY_TOKEN! });
  const thresholds = getThresholds(corpusVersion);
  const failed: Array<{ niche: Niche; config: ScrapeConfigKind; error: string }> = [];

  // Collect all rows in memory first, then bucket + dedup + insert at the end
  const rawRows: Array<ReturnType<typeof normalizeScrapedItem>> = [];

  for (const niche of NICHES) {
    const jobs = buildApifyJobs(niche, isPilot);
    for (const config of CONFIGS) {
      const job = jobs[config];
      log.info("Starting scrape job", { niche, config, actorId: job.actorId });

      try {
        const run = await apify
          .actor(job.actorId)
          .call(job.input, { waitSecs: 600 }); // 10 min max — clockworks usually completes in <2min

        const { items } = await apify.dataset(run.defaultDatasetId).listItems();
        log.info("Scrape complete", { niche, config, raw_items: items.length });

        for (const item of items) {
          const normalized = normalizeScrapedItem(item, niche, corpusVersion);
          if (normalized) rawRows.push(normalized);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("Scrape job failed", { niche, config, error: msg });
        Sentry.captureException(err, {
          tags: { stage: "corpus_scrape", niche, config, corpusVersion },
        });
        failed.push({ niche, config, error: msg });
        // Continue to next config — DO NOT throw
      }
    }
  }

  log.info("All scrape jobs complete", { totalRawRows: rawRows.length });

  // Pitfall 1: extra client-side date filter for safety
  const SEVEN_DAYS_AGO = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const ageFiltered = rawRows.filter((r) => r && r.posted_at.getTime() <= SEVEN_DAYS_AGO);

  // Apply bucketing
  const bucketed = ageFiltered.map((r) => ({
    ...r!,
    bucket: bucketRow(r!, thresholds[r!.niche as Niche]),
  }));

  // Pitfall 3: dedup max-3-per-creator AFTER bucketing
  const dedupByCreatorWithinBucket = (rows: typeof bucketed, sortDir: "desc" | "asc") => {
    const byCreator = new Map<string, typeof bucketed>();
    for (const r of rows) {
      const key = r.creator_handle ?? "__unknown__";
      if (!byCreator.has(key)) byCreator.set(key, []);
      byCreator.get(key)!.push(r);
    }
    const out: typeof bucketed = [];
    for (const rows of byCreator.values()) {
      const sorted = [...rows].sort((a, b) =>
        sortDir === "desc" ? Number(b.views ?? 0) - Number(a.views ?? 0) : Number(a.views ?? 0) - Number(b.views ?? 0)
      );
      out.push(...sorted.slice(0, 3));
    }
    return out;
  };

  const viral = dedupByCreatorWithinBucket(bucketed.filter((r) => r.bucket === "viral"), "desc");
  const avg   = dedupByCreatorWithinBucket(bucketed.filter((r) => r.bucket === "avg"), "desc");
  const under = dedupByCreatorWithinBucket(bucketed.filter((r) => r.bucket === "under"), "asc");

  // Stratified sampling down to targets
  const targets = isPilot ? BUCKET_TARGETS_PILOT : BUCKET_TARGETS_FULL;
  const sampleTo = (rows: typeof bucketed, n: number) => rows.slice(0, n); // simple top-N; replace with stratified-per-niche if pilot reveals imbalance

  const final = [...sampleTo(viral, targets.viral), ...sampleTo(avg, targets.avg), ...sampleTo(under, targets.under)];

  log.info("Bucketing + dedup complete", {
    viral: viral.length, avg: avg.length, under: under.length,
    finalCount: final.length,
  });

  if (dryRun) {
    log.info("Dry run — skipping DB insert", { wouldInsert: final.length });
    return { inserted: 0, failed };
  }

  // Upsert into training_corpus (idempotent on platform_video_id + corpus_version)
  const { error } = await supabase
    .from("training_corpus")
    .upsert(final, { onConflict: "platform_video_id,corpus_version" });

  if (error) {
    log.error("Insert failed", { error: error.message });
    throw error;
  }

  log.info("Corpus build complete", { corpusVersion, inserted: final.length });
  return { inserted: final.length, failed };
}
```

### A.3 Scrape outcome metadata enrichment matrix

| Field (training_corpus) | Source | Notes |
|---|---|---|
| `platform_video_id` | `item.id` (clockworks) or `item.id` (apidojo) | Both formats share this |
| `video_url` | `webVideoUrl` (clockworks) or `postPage` (apidojo) | |
| `creator_handle` | `authorMeta.name` (clockworks) or `channel.username` (apidojo) | Normalize via `normalizeHandle()` from `schemas/competitor.ts:10-20` |
| `niche` | Set by orchestrator from which `buildApifyJobs(niche)` produced this row | NOT from the video itself |
| `views` | `playCount` (clockworks) or `views` (apidojo) | BIGINT — viral creators exceed MAX_INT |
| `likes` | `diggCount` (clockworks) or `likes` (apidojo) | |
| `comments` | `commentCount` (clockworks) or `comments` (apidojo) | |
| `shares` | `shareCount` (clockworks) or `shares` (apidojo) | |
| `saves` | `collectCount` (clockworks) or `bookmarks` (apidojo) | |
| `posted_at` | `createTime` Unix seconds (clockworks) or `uploadedAt` Unix (apidojo) | Convert to Date |
| `scraped_at` | `new Date()` at normalize time | NOW |
| `duration_seconds` | `videoMeta.duration` (clockworks) or `video.duration` (apidojo) | |
| `follower_count` | `authorMeta.fans` (clockworks) or `channel.followers` (apidojo) | nullable — clockworks profile-scraper fills this; some scrape configs may not |
| `follower_tier` | Computed from follower_count | Reuse `getFollowerTier()` from `scripts/extract-training-data.ts:68-75` — extract into `normalize-scrape.ts` |
| `caption` | `text` (clockworks) or `title` (apidojo) | For Gemini prompt at eval time |
| `hashtags` | `hashtags.map(h => h.name)` (clockworks) or `hashtags` array (apidojo) | TEXT[] |
| `completion_pct` | ⚠️ NOT available from scrape | This field exists in `training_corpus` schema (CORPUS-04) but Apify does not expose actual completion %. Leave as nullable; document as "not captured for v1 corpus; future scraper enhancement". |
| `corpus_version` | Set by orchestrator | e.g., `"pilot.2026-05-12"` |
| `bucket` | Computed by `bucketRow()` after scrape | viral | avg | under |

[VERIFIED: clockworks output fields confirmed via [WebFetch of clockworks/tiktok-scraper page](https://apify.com/clockworks/tiktok-scraper), 2026-05-11; apidojo output fields confirmed via [WebFetch of apidojo/tiktok-scraper-api page](https://apify.com/apidojo/tiktok-scraper-api), 2026-05-11; existing `scripts/import-apify-data.ts:64-119` handles the mapping for both formats.]

**Recommended primary actor: `clockworks/tiktok-scraper`** because:
1. Already in use elsewhere (`apify-provider.ts:9-10`, `scripts/import-apify-data.ts`)
2. Has `oldestPostDate`/`newestPostDate` for the 7-day age filter
3. Returns `authorMeta.fans` which gives us `follower_count` without a separate profile scrape
4. `excludePinnedPosts: true` removes creator's pinned content (which is often outdated)

**[ASSUMED]** `completion_pct` is not available from Apify TikTok scrapers. None of the WebFetch results mentioned it. Document as known gap; the planner should flag this for user confirmation. If the user has a specific completion_pct source in mind (e.g., a different actor, manual labeling), they should call it out before planning.

### A.4 Separation from existing scraping
- New table `training_corpus` is SEPARATE from `scraped_videos` (the trending feed feeds the latter)
- Same Apify actor (`clockworks/tiktok-scraper`); same `apify-client`; different inputs and outputs
- Different cron schedule (corpus refresh = 30-day cycle, distinct from `scrape-trending` 6-hour cycle)
- Different cron path (`/api/cron/refresh-corpus`, not `/api/cron/scrape-trending`)

### A.5 Quality validation rules (CORPUS-08)
The orchestrator MUST enforce these at insert time (before upsert):
1. **No duplicates within corpus_version**: enforced by UNIQUE(platform_video_id, corpus_version) constraint on the table
2. **Valid outcomes**: rows with `views < 1` rejected; rows with all-zero engagement (`likes + comments + shares = 0`) rejected (likely scrape error)
3. **Recent within 7-90 day window**: rows with `posted_at < (now - 90 days)` rejected; rows with `posted_at > (now - 7 days)` rejected (D-04)
4. **Max 3 per creator within bucket**: enforced by dedup step in orchestrator
5. **Bucket integrity**: row's `bucket` matches `bucketRow(row, thresholds[row.niche])` deterministically — add Vitest test fixture for this

### B Bucketing implementation

```typescript
// src/lib/engine/corpus/bucket.ts
// D-07 (per-niche absolute view thresholds), D-10 (hard cutoff)

import type { NicheThresholds } from "./thresholds";

export type BucketLabel = "viral" | "avg" | "under";

export interface BucketableRow {
  views: number | bigint;
}

/**
 * Pure function — given a row's view count and the niche's thresholds,
 * return the bucket label. Hard-cutoff (D-10), no exclusion zone.
 */
export function bucketRow(row: BucketableRow, t: NicheThresholds): BucketLabel {
  const views = typeof row.views === "bigint" ? Number(row.views) : row.views;
  if (views >= t.viralFloor) return "viral";
  if (views <= t.underCeiling) return "under";
  return "avg";
}
```

```typescript
// src/lib/engine/corpus/__tests__/bucket.test.ts (excerpt)

import { describe, it, expect } from "vitest";
import { bucketRow } from "../bucket";

describe("bucketRow", () => {
  const t = { viralFloor: 250_000, underCeiling: 5_000 }; // beauty pilot D-08

  it.each([
    [1_000_000, "viral"],
    [250_000,   "viral"],   // hard cutoff at viralFloor → viral
    [249_999,   "avg"],
    [5_001,     "avg"],
    [5_000,     "under"],    // hard cutoff at underCeiling → under
    [0,         "under"],
  ])("views=%i → %s", (views, expected) => {
    expect(bucketRow({ views }, t)).toBe(expected);
  });
});
```

### C.1 Batched eval execution

```typescript
// src/lib/engine/corpus/eval-runner.ts (excerpt)
// [CITED: existing pattern from scripts/benchmark.ts:506-584 — per-sample try/catch + 2s rate-limit delay]

import { runPredictionPipeline } from "@/lib/engine/pipeline";
import { aggregateScores } from "@/lib/engine/aggregator";
import { createLogger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";

const log = createLogger({ module: "corpus/eval-runner" });

const DELAY_MS_BETWEEN_SAMPLES = 2_000; // matches benchmark.ts:582
const COST_ABORT_CENTS = 5_000;          // Pitfall 5: $50 cap

export interface EvalRunOptions {
  corpusVersion: string;
  engineVersion: string;            // e.g., "2.1.0"
  maxRows?: number;                  // for dev
  leaveOneOut?: boolean;             // EVAL-03
}

export async function runEval(opts: EvalRunOptions) {
  const supabase = createServiceClient();

  // Fetch corpus rows
  const { data: rows, error } = await supabase
    .from("training_corpus")
    .select("*")
    .eq("corpus_version", opts.corpusVersion);
  if (error) throw error;
  if (!rows || rows.length === 0) throw new Error(`No rows for corpus_version=${opts.corpusVersion}`);

  const effectiveRows = opts.maxRows ? rows.slice(0, opts.maxRows) : rows;
  const results: Array<{ row: typeof rows[0]; predicted: { score: number; bucket: BucketLabel }; pipelineTimings: number[]; cost_cents: number }> = [];

  let totalCostCents = 0;

  for (let i = 0; i < effectiveRows.length; i++) {
    const row = effectiveRows[i]!;
    const start = performance.now();
    try {
      const pipelineResult = await runPredictionPipeline({
        input_mode: "text",                // baseline: use caption-as-text (no video)
        content_text: row.caption ?? "",
        content_type: "video",
        niche: row.niche,
        creator_handle: row.creator_handle ?? undefined,
      });
      const prediction = await aggregateScores(pipelineResult);

      // Map continuous overall_score → bucket
      // (uses same thresholds as bucketRow, but normalized for 0-100 → niche bucket cuts)
      // See §C.2.bucketFromScore.
      const predBucket = bucketFromScore(prediction.overall_score, row.niche);

      results.push({
        row,
        predicted: { score: prediction.overall_score, bucket: predBucket },
        pipelineTimings: pipelineResult.timings.map((t) => t.duration_ms),
        cost_cents: prediction.cost_cents,
      });

      totalCostCents += prediction.cost_cents;
      if (totalCostCents > COST_ABORT_CENTS) {
        log.error("Cost cap reached", { totalCostCents });
        throw new Error(`Cost cap $${COST_ABORT_CENTS / 100} exceeded at row ${i}`);
      }

      log.info("Row complete", { i, niche: row.niche, score: prediction.overall_score, actual_bucket: row.bucket });
    } catch (err) {
      log.error("Row failed", { i, error: err instanceof Error ? err.message : String(err) });
      // Continue — record failed prediction
    }

    if (i < effectiveRows.length - 1) await sleep(DELAY_MS_BETWEEN_SAMPLES);
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
```

### C.2 Macro-F1 + bucket-from-score

```typescript
// src/lib/engine/corpus/metrics/score-to-bucket.ts
// Maps the engine's continuous overall_score (0-100) → bucket label
// using a fixed cut. This is the engine's IMPLICIT prediction;
// it does NOT depend on the corpus thresholds.

export function bucketFromScore(score: number, _niche: string): BucketLabel {
  // Phase 1 keeps this simple — same cuts for all niches.
  // Phase 10 calibrates per-niche cuts if needed.
  if (score >= 70) return "viral";
  if (score <= 30) return "under";
  return "avg";
}
```

**Rationale:** The engine produces a 0-100 score, NOT a bucket. We need a mapping. The simplest is a global cut (70/30) — works as a strawman for v2.1 baseline. Phase 10 (ML audit + calibration) may refine this per-niche based on the corpus. Document this constant alongside the threshold formula.

`computeMacroF1()` itself is in §"Pattern 1" above.

### C.3 Per-signal leave-one-out
- Approach: replicate the aggregator's score math directly (per §C.3 caveat above)
- For each signal `s ∈ {behavioral, gemini, ml, rules, trends}`, compute `aggregateWithoutSignal(pipelineResult, s)` and bucket via `bucketFromScore`
- Report: macro-F1 with all signals, then macro-F1 without each signal → contribution = baseline − without_signal (positive means the signal helps; negative means it hurts; required by EVAL-03)
- Cost: LOO multiplies the eval cost by 6× (1 baseline + 5 ablations). Make this opt-in via `--leave-one-out` flag; default off for routine runs

### C.4 ECE
- Reuse `computeECE` from `src/lib/engine/calibration.ts:114-176` directly
- Convert: predictions are bucket labels but ECE needs predicted-vs-actual probability pairs. **Map:** `predicted = overall_score / 100`, `actual = 1 if bucket == "viral" else 0` (binary "did we correctly predict viral?")
- Or: per-class ECE (viral / under / avg each get their own ECE). Recommend per-class ECE for richer signal — extend `computeECE` slightly OR call it 3× with different `actual` definitions

### C.5 Failure case curation — `benchmark_failure_cases` Supabase table

**Recommendation: Supabase table, NOT JSON files in `.planning/benchmarks/`.**

Reasoning:
1. Curation is queryable: "show me all failure cases from `engine_version=2.1.0` where actual=viral, predicted=under". This is impossible with directory-scattered JSON.
2. Cross-run analysis: as M1 progresses (Phase 4, 5, 6, ...), we want to see "is this failure case fixed by Phase 7?" — needs joinable rows.
3. RLS is trivial — service-role only (system table).
4. JSON files in `.planning/` get out of sync with git history; the DB has a clean append-only audit trail.

The schema is given in §F.3.

### C.6 MAE on engagement-rate prediction
- For each row in the corpus, compute actual engagement rate = `(likes + comments + shares + saves) / views`
- The engine's prediction is `predicted_engagement` (`PredictionResult.predicted_engagement`, from `aggregator.ts:215-247`): computes likes/comments/shares/saves/views from the overall_score
- Re-derive predicted engagement rate the same way and compute MAE = mean(|actual_rate − predicted_rate|)
- Per Pitfall 4, restrict to rows with `views >= 1000`

### C.7 CLI vs API decision

**Recommendation: CLI only (`tsx scripts/eval.ts`). NO API route.**

Reasoning:
1. **Already the pattern.** `scripts/benchmark.ts:24-25` already imports `runPredictionPipeline` and `aggregateScores` directly. We literally extend this script (or fork it) — zero new architecture.
2. **Long-running.** 500 rows × 2s rate-limit delay = 17min minimum, plus actual pipeline latency (~5–10s per row at avg) = potentially 60+ minutes. Vercel function timeout (300s on Pro) makes API impossible without breaking it into chunks (over-engineering for an offline tool).
3. **No user-facing tier.** The eval harness is operator-driven (developer runs it locally or in CI). Phase 11 may surface results UI-side, but that consumes the `benchmark_results` table directly — it does not need to *trigger* a run.
4. **Easier to control cost.** CLI runs from a laptop with `.env.local` keys. Operator can `^C` mid-run. API route makes mid-run abort harder.

Invocation:
```bash
# Baseline run (Phase 1)
npx tsx scripts/eval.ts \
  --engine-version 2.1.0 \
  --corpus-version full.2026-05-19 \
  --output .planning/benchmarks/2026-05-XX-v2.1-baseline.json

# Future runs add per-signal contribution
npx tsx scripts/eval.ts \
  --engine-version 3.0.0-rc.1 \
  --corpus-version full.2026-05-19 \
  --leave-one-out \
  --compare-against 2.1.0 \    # triggers bootstrap p-value vs v2.1 from benchmark_results
  --output .planning/benchmarks/2026-XX-XX-v3-rc1.json
```

Add `"eval": "npx tsx scripts/eval.ts"` to `package.json:scripts`. Output: writes (1) markdown summary to stdout, (2) JSON to `--output` path, (3) `benchmark_results` rows in Supabase, (4) `benchmark_failure_cases` rows for top-10 mispredictions.

### C.8 Per-stage latency p50/p95/p99 across N runs

Aggregate strategy:
- Collect per-row: `pipelineResult.timings` (array of `{ stage, duration_ms }` from `pipeline.ts:431`)
- Group by stage name across all N corpus rows; for each stage compute p50/p95/p99 via `quantile()`
- Persist as one `benchmark_results` row per stage per metric (long format — see §F.2)

```typescript
// src/lib/engine/corpus/metrics/stage-latency.ts
import type { StageTiming } from "@/lib/engine/pipeline";

export interface StageLatencyMetric {
  stage: string;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  count: number;
}

export function aggregateStageLatencies(allRunsTimings: StageTiming[][]): StageLatencyMetric[] {
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

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}
```

### D.1 Paired bootstrap p-value

**Recommendation: PAIRED bootstrap, NOT unpaired.**

Reasoning:
1. **Same corpus.** D-12 + Pitfall 6 mandate identical `corpus_version` for v2.1 vs vN comparison. Both engines score the SAME 500 videos.
2. **Paired test removes between-row variance.** The viral video that's hard for both engines doesn't dominate the test; the per-row difference (`f1_v3_i - f1_v2_i`) is what matters.
3. **More statistical power.** For NLP and ML model comparison, [paired bootstrap is standard](https://medium.com/ai-enthusiast/comparing-nlp-models-with-confidence-the-paired-bootstrap-test-explained-c9a88532ea3d) (cited 2026-05-11). Unpaired loses power and ignores the matching structure.
4. **No library covers this for our exact shape.** `simple-statistics` does not ship bootstrap (verified). Hand-rolled is ~40 LOC.

```typescript
// src/lib/engine/corpus/metrics/bootstrap.ts
// [CITED: paired bootstrap — Neubig util-scripts:
//  https://github.com/neubig/util-scripts/blob/master/paired-bootstrap.py
//  Method generalized from NLP-model comparison literature.]

import { computeMacroF1, type BucketLabel } from "./macro-f1";

export interface BootstrapResult {
  pValue: number;
  observedDelta: number;       // metric(B) − metric(A) on the full sample
  ci95: [number, number];
  iterations: number;
}

/**
 * Paired bootstrap test: does engine B have a HIGHER macro-F1 than engine A?
 * H0: B's macro-F1 ≤ A's macro-F1
 * Reject H0 if p < 0.05 (D-17).
 *
 * Inputs MUST be paired — predicted[i] and actual[i] refer to the SAME corpus row
 * for both engines. So predictedA[i] and predictedB[i] are predictions for row i.
 */
export function pairedBootstrapMacroF1(
  predictedA: BucketLabel[],
  predictedB: BucketLabel[],
  actual: BucketLabel[],
  iters: number = 200,           // D-17 minimum
  seed: number = 42
): BootstrapResult {
  if (predictedA.length !== predictedB.length || predictedA.length !== actual.length) {
    throw new Error("predictedA, predictedB, actual must all have same length");
  }
  const n = actual.length;

  // Observed delta on the full sample
  const observedDelta =
    computeMacroF1(predictedB, actual).macroF1 -
    computeMacroF1(predictedA, actual).macroF1;

  // Seeded mulberry32 RNG for reproducibility
  let s = seed | 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const deltas: number[] = [];
  let countBLowerOrEqual = 0;       // for one-sided p-value

  for (let it = 0; it < iters; it++) {
    // Paired resample: pick n indices with replacement; both engines use the same indices
    const resampleIndices = Array.from({ length: n }, () => Math.floor(rng() * n));
    const a = resampleIndices.map((i) => predictedA[i]!);
    const b = resampleIndices.map((i) => predictedB[i]!);
    const y = resampleIndices.map((i) => actual[i]!);

    const f1a = computeMacroF1(a, y).macroF1;
    const f1b = computeMacroF1(b, y).macroF1;
    const delta = f1b - f1a;
    deltas.push(delta);

    // Bootstrap shift method: center the resampled deltas at H0
    // (i.e., assume null hypothesis is true: delta = 0)
    // Count how often the centered resample yields a delta ≥ observed
    if (delta - observedDelta >= 0) countBLowerOrEqual++; // p-value for "B ≤ A"
    // Note: This is the centered/shifted bootstrap variant. The intuition:
    // under H0, the resampled delta minus observed delta has mean 0.
    // We count how many resamples produce a centered-shifted delta ≥ 0
    // (i.e., as extreme as the observed in favor of "no effect"). Smaller count = lower p.
  }

  const pValue = countBLowerOrEqual / iters;

  // 95% CI from raw delta distribution
  deltas.sort((a, b) => a - b);
  const lo = deltas[Math.floor(iters * 0.025)]!;
  const hi = deltas[Math.floor(iters * 0.975)]!;

  return { pValue, observedDelta, ci95: [lo, hi], iterations: iters };
}
```

[CITED: paired bootstrap shift method — [Comparing NLP Models with Confidence: The Paired Bootstrap Test Explained](https://medium.com/ai-enthusiast/comparing-nlp-models-with-confidence-the-paired-bootstrap-test-explained-c9a88532ea3d) (Singh, 2024); [Neubig util-scripts paired-bootstrap.py](https://github.com/neubig/util-scripts/blob/master/paired-bootstrap.py) reference implementation; [scipy.stats.bootstrap docs](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html) for the centered-shift method intuition.]

**Implementation: hand-rolled.** Approx 40 LOC. Verified `simple-statistics` does not ship bootstrap. The Numpy/Scipy approach doesn't transplant to TS. Hand-rolling is the right call.

**Test reproducibility:** Seed must be deterministic. Add Vitest fixture: same predicted arrays → same p-value within 1e-9. This guards against floating-point regressions.

### E Baseline measurement workflow

```bash
# 1. Build corpus (assumes thresholds.ts has "pilot.2026-05-12" entry)
npx tsx scripts/build-corpus.ts \
  --corpus-version pilot.2026-05-12 \
  --pilot
# → inserts 50 rows into training_corpus

# 2. Inspect pilot view distributions to recompute thresholds (D-09)
npx tsx scripts/inspect-corpus.ts \
  --corpus-version pilot.2026-05-12 \
  --per-niche-percentiles 30,90
# → outputs: per-niche P30 (under) and P90 (viral) view counts

# 3. Operator updates thresholds.ts with "full.2026-05-19" entry,
#    commits, then runs full build:
npx tsx scripts/build-corpus.ts \
  --corpus-version full.2026-05-19
# → inserts 500 rows into training_corpus

# 4. Run v2.1 baseline eval (D-20)
npx tsx scripts/eval.ts \
  --engine-version 2.1.0 \
  --corpus-version full.2026-05-19 \
  --output .planning/benchmarks/2026-05-19-v2.1-baseline.json
# → writes ~30 rows into benchmark_results (one per metric)
# → writes top-10 mispredictions into benchmark_failure_cases
# → writes Markdown summary to stdout (capture into .planning/research/v2.1-baseline.md)

# 5. Apply threshold formula from D-18 to the measured macro-F1
#    → produces the X% requirement; commit to eval-config.ts
```

**Cost guardrail:** Per Pitfall 5, hard-cap mid-run at $50. Per BENCH-03, average per-analysis must be ≤ $0.075. Total ceiling for 500-video baseline = $37.50. Set CLI default `--max-total-cost-cents 5000` ($50, 33% buffer).

**Engine version tag:** D-21 — hardcoded `"2.1.0"` as a literal string. This is fine until Phase 3 introduces structural versioning. Until then, no env var, no constant — just a literal in the script invocation.

**Output: `.planning/research/v2.1-baseline.md`** — sections:
1. Run metadata (corpus_version, engine_version, run timestamp, command line invocation)
2. Macro-F1 global + per niche (5 niches) + per class (viral / avg / under)
3. ECE
4. Per-class precision/recall confusion matrix
5. Cost: total + average + max per row
6. Latency: per-stage p50/p95/p99
7. Failure cases: top 10 with full pipeline trace + reasoning (linked into `benchmark_failure_cases` rows for join queries)
8. Drift detector: N/A on first baseline
9. **Threshold rule applied** — given measured macro-F1, what is the required v3 improvement (D-18)?

Cross-link footer: "Threshold formula lives at `src/lib/engine/corpus/eval-config.ts`. See `requiredImprovement()`."

### F.1 `training_corpus` schema

```sql
-- supabase/migrations/20260512000000_training_corpus.sql

CREATE TABLE training_corpus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity & versioning
  platform_video_id TEXT NOT NULL,
  corpus_version TEXT NOT NULL,            -- D-12 e.g. "pilot.2026-05-12", "full.2026-05-19"
  niche TEXT NOT NULL CHECK (niche IN ('beauty', 'fitness', 'edu', 'comedy', 'lifestyle')),
  bucket TEXT NOT NULL CHECK (bucket IN ('viral', 'avg', 'under')),

  -- Source metadata
  video_url TEXT,
  creator_handle TEXT,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',

  -- Engagement outcomes (BIGINT — viral creators exceed MAX_INT, see competitor_videos:78-82)
  views BIGINT NOT NULL CHECK (views >= 0),
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,

  -- Creator/temporal
  follower_count BIGINT,                   -- nullable when scrape doesn't include it
  follower_tier TEXT CHECK (follower_tier IS NULL OR follower_tier IN ('nano', 'micro', 'mid', 'macro', 'mega')),
  duration_seconds INTEGER,
  posted_at TIMESTAMPTZ NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- NOT CAPTURED from Apify but reserved for future enrichment (CORPUS-04 partial)
  completion_pct NUMERIC(5, 2),            -- ⚠️ Apify doesn't expose this; field exists for future scrape enhancement

  -- Provenance
  source_actor_id TEXT NOT NULL,           -- e.g. "clockworks/tiktok-scraper"
  source_dataset_id TEXT,                  -- Apify dataset ID for traceability
  source_config_kind TEXT NOT NULL CHECK (source_config_kind IN ('trending', 'average', 'under')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One record per (video, corpus_version) — supports same video appearing
  -- in pilot AND full corpus with different rows
  UNIQUE(platform_video_id, corpus_version)
);

CREATE INDEX idx_training_corpus_corpus_version ON training_corpus(corpus_version);
CREATE INDEX idx_training_corpus_niche_bucket ON training_corpus(corpus_version, niche, bucket);
CREATE INDEX idx_training_corpus_posted_at ON training_corpus(posted_at DESC);

ALTER TABLE training_corpus ENABLE ROW LEVEL SECURITY;

-- RLS: service-role only (system-wide, not user-scoped)
-- No public read; service client (createServiceClient()) bypasses RLS.
-- No policies needed for service role; explicit DENY for anon/authenticated:
CREATE POLICY "Deny all to public roles"
  ON training_corpus FOR ALL
  TO anon, authenticated
  USING (false);

CREATE TRIGGER training_corpus_updated_at
  BEFORE UPDATE ON training_corpus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

[CITED: schema mirrors `competitor_videos` (`competitor_tables.sql:71-92`): BIGINT for view counts, TEXT[] hashtags, TIMESTAMPTZ for dates, `update_updated_at_column()` trigger reused. RLS pattern from existing `competitor_profiles` (`competitor_tables.sql:108-138`) but tightened to service-role-only since corpus is system-wide.]

### F.2 `benchmark_results` schema — LONG FORMAT (recommended)

**Recommendation: LONG format (one row per metric).**

Reasoning:
1. **Schema stability across phases.** New phases will add new metrics (e.g., per-persona drop-off in Phase 7). Wide format would require ALTER TABLE every time. Long format = add new `metric_name` value, no schema change.
2. **Cross-version queries.** "Show me macro_f1_global across all runs for `full.2026-05-19` corpus" is one row per run = clean.
3. **Per-niche metrics fit naturally.** macro_f1_niche_beauty, macro_f1_niche_fitness, etc., are just different rows with `metric_metadata = {"niche": "beauty"}`.
4. Storage cost is trivial (each run = ~30 rows, total < 1MB / year at expected pace).

```sql
-- supabase/migrations/20260512000100_benchmark_results.sql

CREATE TABLE benchmark_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Run identity
  run_id TEXT NOT NULL,                    -- nanoid(12) — groups metrics from a single eval run
  engine_version TEXT NOT NULL,            -- D-21 e.g. "2.1.0"; future: "3.0.0-rc.1"
  corpus_version TEXT NOT NULL,            -- D-12 e.g. "full.2026-05-19"

  -- Metric
  metric_name TEXT NOT NULL,
  -- Examples:
  --   macro_f1_global, macro_f1_niche, macro_f1_class
  --   ece_global, ece_class
  --   per_signal_contribution
  --   cost_per_analysis_avg, cost_per_analysis_p95
  --   latency_stage_p50, latency_stage_p95, latency_stage_p99
  --   spearman_rho_niche
  --   mae_engagement_rate
  --   viral_recall, under_precision
  --   bootstrap_p_value (only when --compare-against is set)
  metric_value NUMERIC(10, 6),             -- numeric value; NULL allowed for metrics where metadata carries the payload

  metric_metadata JSONB DEFAULT '{}',
  -- Examples:
  --   { "niche": "beauty" }
  --   { "stage": "gemini_analysis" }
  --   { "class": "viral" }
  --   { "signal": "behavioral", "delta_vs_baseline": 0.04 }
  --   { "compared_against": "2.1.0", "ci95": [0.02, 0.08], "iterations": 200 }

  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_benchmark_results_run_id ON benchmark_results(run_id);
CREATE INDEX idx_benchmark_results_version_pair ON benchmark_results(engine_version, corpus_version);
CREATE INDEX idx_benchmark_results_metric ON benchmark_results(metric_name);

ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all to public roles"
  ON benchmark_results FOR ALL
  TO anon, authenticated
  USING (false);
```

### F.3 `benchmark_failure_cases` schema

```sql
-- supabase/migrations/20260512000200_benchmark_failure_cases.sql

CREATE TABLE benchmark_failure_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  run_id TEXT NOT NULL,                    -- joins to benchmark_results.run_id
  engine_version TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  training_corpus_id UUID NOT NULL REFERENCES training_corpus(id) ON DELETE CASCADE,

  -- Misprediction
  actual_bucket TEXT NOT NULL CHECK (actual_bucket IN ('viral', 'avg', 'under')),
  predicted_bucket TEXT NOT NULL CHECK (predicted_bucket IN ('viral', 'avg', 'under')),
  predicted_score NUMERIC(5, 2) NOT NULL,
  confidence NUMERIC(5, 4),

  -- Pipeline trace
  pipeline_warnings TEXT[] DEFAULT '{}',
  feature_vector JSONB,                    -- PredictionResult.feature_vector
  factors JSONB,                           -- PredictionResult.factors (Gemini)
  reasoning TEXT,                          -- DeepSeek reasoning if present

  curated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_benchmark_failure_cases_run_id ON benchmark_failure_cases(run_id);
CREATE INDEX idx_benchmark_failure_cases_corpus ON benchmark_failure_cases(corpus_version, engine_version);
CREATE INDEX idx_benchmark_failure_cases_video ON benchmark_failure_cases(training_corpus_id);

ALTER TABLE benchmark_failure_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all to public roles"
  ON benchmark_failure_cases FOR ALL
  TO anon, authenticated
  USING (false);
```

### F.4 RLS pattern: service-role-only for system tables

All three tables follow the same pattern: **explicit DENY to `anon` and `authenticated`** roles. The service-role client (`createServiceClient()` from `src/lib/supabase/service.ts:11`) bypasses RLS so cron/script writes work. No public read.

This differs from `competitor_*` tables (which have `authenticated` user-scoped policies, see `competitor_tables.sql:108-150`) because the corpus and benchmarks are operator-internal data, not user-scoped.

### F.5 Migration filename convention
Pattern: `YYYYMMDDHHMMSS_description.sql`. Latest existing migration is `20260311000000_add_platform_to_tiktok_accounts.sql`. Use:
- `20260512000000_training_corpus.sql`
- `20260512000100_benchmark_results.sql`
- `20260512000200_benchmark_failure_cases.sql`

100-second increments are convention so they sort correctly regardless of execution order.

### G Threshold rule formula in executable form

```typescript
// src/lib/engine/corpus/eval-config.ts
// D-19: threshold formula persisted in code; doc cross-link below.
// Source of truth for D-17/D-18.
//
// Cross-reference: .planning/research/v2.1-baseline.md
// (Created by `scripts/eval.ts` on the first v2.1 baseline run;
// contains the measured baseline macro-F1 and the statistical reasoning.)

export interface AcceptanceRequirement {
  /**
   * Required RELATIVE improvement in macro-F1 vs v2.1 baseline.
   * E.g., 0.10 means v3 macroF1 must be ≥ baseline * 1.10.
   */
  relativeMin: number;

  /**
   * Whether bootstrap p-value test is REQUIRED on top of the relative
   * threshold. (D-18 third tier requires both.)
   */
  requiresPValue: boolean;

  /**
   * Required p-value threshold from paired bootstrap. Always 0.05 per D-17.
   */
  pValueMax: number;

  /**
   * Per-niche regression cap: no individual niche's macro-F1 may regress
   * by more than this many absolute percentage points. (D-15)
   */
  perNicheMaxRegressionPp: number;
}

/**
 * Sliding-scale acceptance requirement based on the measured v2.1 baseline.
 * D-18:
 *   v2.1 macro-F1 ≤ 0.40 → 15% relative improvement
 *   0.40 < v2.1 ≤ 0.55 → 10% relative improvement
 *   v2.1 > 0.55 → 7% relative improvement + significance required
 *
 * Note: bootstrap p-value is required for ALL tiers per D-17 (≥200 iters, p < 0.05).
 * The `requiresPValue` flag is for documentation; in practice all phases run it.
 */
export function requiredImprovement(v21MacroF1: number): AcceptanceRequirement {
  const base = {
    pValueMax: 0.05,                    // D-17
    perNicheMaxRegressionPp: 5,          // D-15: 5 percentage points
  };

  if (v21MacroF1 <= 0.40) {
    return { relativeMin: 0.15, requiresPValue: true, ...base };
  }
  if (v21MacroF1 <= 0.55) {
    return { relativeMin: 0.10, requiresPValue: true, ...base };
  }
  return { relativeMin: 0.07, requiresPValue: true, ...base };
}

/**
 * Convenience: given the v2.1 baseline macroF1 and a candidate's macroF1,
 * return whether the candidate passes the gate.
 * Per-niche check is the caller's responsibility (needs per-niche data).
 */
export interface GateResult {
  passes: boolean;
  reason: string;
  required: AcceptanceRequirement;
  observed: { baseline: number; candidate: number; relativeImprovement: number };
}

export function evaluateGate(
  baselineMacroF1: number,
  candidateMacroF1: number,
  pValue: number,
  perNicheRegressionsPp: Record<string, number>    // {beauty: 0.03, fitness: -0.06, ...}
): GateResult {
  const required = requiredImprovement(baselineMacroF1);
  const relativeImprovement =
    baselineMacroF1 === 0 ? Infinity : (candidateMacroF1 - baselineMacroF1) / baselineMacroF1;

  if (relativeImprovement < required.relativeMin) {
    return {
      passes: false,
      reason: `Relative improvement ${(relativeImprovement * 100).toFixed(2)}% < required ${(required.relativeMin * 100).toFixed(0)}%`,
      required,
      observed: { baseline: baselineMacroF1, candidate: candidateMacroF1, relativeImprovement },
    };
  }

  if (required.requiresPValue && pValue > required.pValueMax) {
    return {
      passes: false,
      reason: `p-value ${pValue.toFixed(4)} > required ${required.pValueMax}`,
      required,
      observed: { baseline: baselineMacroF1, candidate: candidateMacroF1, relativeImprovement },
    };
  }

  for (const [niche, regressionPp] of Object.entries(perNicheRegressionsPp)) {
    // regressionPp is positive when the niche regressed (e.g., 0.06 = 6 percentage point drop)
    if (regressionPp > required.perNicheMaxRegressionPp / 100) {
      return {
        passes: false,
        reason: `Niche ${niche} regressed by ${(regressionPp * 100).toFixed(2)}pp > cap ${required.perNicheMaxRegressionPp}pp`,
        required,
        observed: { baseline: baselineMacroF1, candidate: candidateMacroF1, relativeImprovement },
      };
    }
  }

  return {
    passes: true,
    reason: "All gates passed",
    required,
    observed: { baseline: baselineMacroF1, candidate: candidateMacroF1, relativeImprovement },
  };
}
```

**Reproducibility note:** `requiredImprovement()` is a pure function of one input (`v21MacroF1`). The v2.1 baseline value, once measured, gets pinned in `.planning/research/v2.1-baseline.md`. Any caller (Phase 12 acceptance check) reads the same value from `benchmark_results` and feeds it back into `requiredImprovement()` to recompute the gate. No state, no drift.

### H 30-day refresh cadence — cron stub

```typescript
// src/app/api/cron/refresh-corpus/route.ts
// Phase 1 STUB — full mechanism lands in Phase 11/12.
// Pattern: src/app/api/cron/calibration-audit/route.ts:26-106

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/refresh-corpus" });

/**
 * GET /api/cron/refresh-corpus
 *
 * Phase 1: STUB. Logs invocation and returns 200.
 * Phase 11/12: triggers Apify scrape jobs for a new corpus_version
 *               (rolling 30-day window), updates training_corpus.
 *
 * Scheduled in vercel.json: TBD by Phase 11/12 (likely "0 5 1 * *" = monthly @ 5am UTC).
 */
export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  log.info("Refresh-corpus cron triggered — not yet implemented", {
    phase: 1,
    full_implementation: "Phase 11 or 12",
  });

  return NextResponse.json({
    status: "stub",
    message: "Corpus refresh not yet implemented; Phase 1 ships the endpoint shell only.",
    invokedAt: new Date().toISOString(),
  });
}
```

Add to `vercel.json` only when Phase 11/12 wires the implementation. **Do NOT add to `vercel.json` in Phase 1** — Vercel will then attempt to schedule it, log "successful" runs that do nothing, and clutter the operations dashboard. Phase 1 ships the route, Phase 11/12 schedules the run.

Implementation in later phases:
1. Determine new `corpus_version = "full." + today.toISOString().split('T')[0]`
2. Add a new entry to `THRESHOLD_SNAPSHOTS` in `thresholds.ts` (or fetch from a new `corpus_version_thresholds` table — TBD by Phase 11/12)
3. Trigger `buildCorpus({ corpusVersion, isPilot: false })` — but with Vercel's 300s function timeout limit, this needs to be split (Apify-jobs-only inside the function, or move to Vercel-Background or a different runner)
4. Insert new rows into `training_corpus`
5. Re-run baseline eval for the latest engine version against the new corpus_version

[CITED: existing cron pattern from `src/app/api/cron/calibration-audit/route.ts:26-106` — `verifyCronAuth()`, structured logger, JSON response.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Engagement-rate-per-follower bucketing | Per-niche absolute view thresholds (D-07) | This phase | Avoids mislabel paradox where 10M-view low-engagement videos label as underperformer |
| Same-creator back-catalog matching | Per-bucket independent sourcing (D-02) | This phase | Avoids viral-pool bias toward serial creators |
| Hardcoded thresholds | Per-`corpus_version` snapshots in versioned TS (D-13) | This phase | Reproducibility — old commits replay exact thresholds |
| MAE on engagement rate (sole metric) | Macro-F1 primary + secondary metrics (D-14, D-16) | This phase | Macro-F1 handles class imbalance; secondaries surface what MAE hides |
| Global accuracy only | Macro-F1 per niche with regression cap (D-15) | This phase | Prevents shipping a model strong on Comedy but worse on Edu |
| `simple-statistics` for everything | Hand-rolled macro-F1 + bootstrap | This phase | No library covers bootstrap; hand-roll cleaner than mixing dep with hand-rolled |

**Deprecated/outdated:**
- The training data extraction script at `scripts/extract-training-data.ts` runs on `scraped_videos` + `calibration-baseline.json` and produces virality tiers 1-5. This is the V2 ML training pipeline and stays as-is for now. **This phase introduces a separate pipeline operating on `training_corpus` with 3 buckets** — they coexist. Phase 10 may consolidate them after the ML audit; until then, both paths run.
- `calibration-baseline.json` (the 5-tier WES-based bucketer) is NOT the same as the per-niche thresholds for this milestone. Don't read the baseline JSON; read `getThresholds(corpusVersion)`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `completion_pct` is NOT available from Apify TikTok scrapers (clockworks or apidojo) | §A.3 | If actually available via another field/actor, CORPUS-04 is satisfied without a future scrape enhancement. Field is nullable in schema so no breakage either way. Researcher recommends planner ask user. |
| A2 | The under bucket can be filled by client-side filtering of broad hashtag scrapes | Pitfall 2 + §A.1 | If real-world distributions skew so heavily toward high-view content that even 400-result hashtag scrapes yield <40 sub-5k-view videos per niche, the under bucket under-fills. Pilot validates this. |
| A3 | clockworks/tiktok-scraper `oldestPostDate`/`newestPostDate` filters work as documented (videos uploaded on-or-after / on-or-before) | §A.1 + Pitfall 1 | If actual semantics differ, client-side date filter (Pitfall 1's belt-and-suspenders step) catches it. Worst case: noisier scrape output, still bucketable. |
| A4 | The clockworks actor returns `authorMeta.fans` (follower count) inline with video items | §A.3 enrichment matrix | If only the profile-scraper actor returns follower count, corpus build needs an extra pass per creator (15 niches × 3 configs × N creators = many extra calls). Cost impact: marginal. Document and verify in pilot. |
| A5 | `selectWeights()` warning-string detection is stable across the milestone | Pattern 3 + §C.3 caveat | Phase 3 versioning work may change this. Researcher recommends approach (2) (replicate aggregator math in LOO module) which is immune to this. Pinned. |
| A6 | `--leave-one-out` flag is rare enough that 6× cost on opt-in runs is acceptable | §C.3 | If LOO is required every run, cost doubles. Current rec: opt-in flag. If user disagrees, default LOO on and budget accordingly. |
| A7 | 200 bootstrap iterations is sufficient for the milestone's sample sizes | §D.1 + D-17 | D-17 explicitly states "≥200". 200 is the floor; we can run more if the p-value is borderline. Performance is trivial (<1s for 200 iters). |
| A8 | The threshold rule (D-18) applies to GLOBAL macro-F1; per-niche regression cap (D-15) is the separate check | §G | If per-niche thresholds were also intended to slide, eval-config.ts needs extension. Current model is global-only relative + per-niche absolute cap. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. **It is not empty.** Items A1, A4, A8 are most likely to need user/planner confirmation.

## Open Questions

1. **Niche taxonomy with apidojo's existing categories**
   - What we know: clockworks scraper has no built-in niche categorization; the niche is set by which hashtag query we use
   - What's unclear: should the orchestrator cross-validate the niche label using something like a content classifier on the caption text? Phase 4 introduces the V3 niche classifier — that could be backfilled against the corpus
   - Recommendation: defer to Phase 10 (ML audit). For Phase 1, trust the hashtag-based niche assignment.

2. **`completion_pct` source**
   - What we know: Apify TikTok scrapers don't expose it in their public output
   - What's unclear: TikTok itself doesn't publish view-through rate via any public API. The `scrapecore`/other actors may have heuristics, but no verified source
   - Recommendation: leave `completion_pct` nullable in `training_corpus`. Document that "actual completion %" is an inferred metric for now — the engine's `behavioral_predictions.completion_pct` is the engine's prediction, not ground truth. CORPUS-04 lists completion % as captured outcome — flag this gap with the user during planning. Possible fallback: estimate completion as a function of `(likes + comments + shares + saves) / views` ratio plus duration — but that's a derived signal, not ground truth.

3. **`bucketFromScore` calibration**
   - What we know: Phase 1 uses a simple 70/30 cut for all niches
   - What's unclear: this may bias the v2.1 baseline downward (since the engine wasn't calibrated to these buckets). Per-niche calibration in Phase 10 is the right fix
   - Recommendation: accept the simple cut for Phase 1; explicitly note in `eval-config.ts` that this is a Phase 1 simplification. Phase 10 ML audit revisits.

4. **Bootstrap iterations — 200 vs higher**
   - What we know: D-17 says ≥200. Real ML model comparisons often use 1000+
   - What's unclear: at our sample size (n=500), 200 may give wide CIs
   - Recommendation: default 200 in `eval-config.ts`; CLI flag `--bootstrap-iters` allows bumping to 1000 or 10000 for tight comparisons. Each iteration is O(n) so 10000 iters × 500 rows × 3-class macro-F1 is ~1.5s — completely fine.

5. **Corpus refresh cadence (CORPUS-02)**
   - What we know: 30-day rolling refresh is the locked spec; stub the cron in Phase 1; real implementation in Phase 11/12
   - What's unclear: does each refresh produce a NEW `corpus_version`, or augment the existing one? CONTEXT.md "Fixed-snapshot thresholds per `corpus_version`" (D-13) implies new version.
   - Recommendation: each 30-day refresh = new `full.YYYY-MM-DD` corpus_version. Old versions stay in the table for historical comparison; the eval harness defaults to the latest unless `--corpus-version` is explicit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | All scripts | ✓ | 20+ (per `package.json:engines` inference) | — |
| Apify | §A scrape, §H refresh | ✓ | `apify-client ^2.22.1` (latest 2.23.2) | — |
| Supabase | §F schema, all writes | ✓ | `@supabase/supabase-js ^2.93.1` | — |
| `APIFY_TOKEN` env | Apify auth | Required at run time | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` env | Service-role client | Required at run time | — | — |
| `CRON_SECRET` env | Cron auth (§H stub) | Required for cron route | — | — |
| `tsx` | Run `scripts/*.ts` | ✓ used via `npx tsx` (no install) | — | — |
| `tsconfig-paths` | `@/` alias in scripts | ✓ used in `scripts/benchmark.ts:18-22` | — | — |
| Vitest | `__tests__/` unit tests | ✓ `^4.0.18` | — | — |
| Apify Apify Storage / cost budget | Pilot ~$5-10, Full ~$30-50 | Operator-dependent | — | Apify free tier 5USD/month; planner should confirm budget |
| Engine API costs (Gemini + DeepSeek) | v2.1 baseline run | Operator-dependent | — | Per Pitfall 5, mid-run cap at $50 ($37.50 ceiling + 33% buffer) |

**Missing dependencies with no fallback:**
- None — all required tooling is already installed and the cloud services are already integrated.

**Missing dependencies with fallback:**
- `apidojo/tiktok-scraper-api` actor (alternative for under-bucket scrape if clockworks under-fills): fallback is to retry with larger `resultsPerPage` on clockworks. Both actors are accessible with the same `APIFY_TOKEN`.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest 4.0.18 (already installed; pattern in `src/lib/engine/__tests__/`) |
| Config file | `vitest.config.ts` (includes `src/**/*.test.ts`; coverage threshold 80% on `src/lib/engine/**/*.ts`) |
| Quick run command | `npm test -- src/lib/engine/corpus/__tests__/bucket.test.ts` |
| Full suite command | `npm test` (or `npm run test:coverage` for the 80% gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| CORPUS-01 | Corpus has 500 rows with correct distribution | integration | `npm test -- src/lib/engine/corpus/__tests__/orchestrator.integration.test.ts` (mocks Apify, asserts post-bucketing row counts) | ❌ Wave 0 |
| CORPUS-03 | All 5 niches represented | unit | `npm test -- src/lib/engine/corpus/__tests__/orchestrator.test.ts -t "all niches"` | ❌ Wave 0 |
| CORPUS-04 | Engagement fields populated from scrape | unit | `npm test -- src/lib/engine/corpus/__tests__/normalize-scrape.test.ts` | ❌ Wave 0 |
| CORPUS-05 | Bucketing function deterministic + table-driven | unit | `npm test -- src/lib/engine/corpus/__tests__/bucket.test.ts` | ❌ Wave 0 |
| CORPUS-06 | Schema migration applies cleanly | migration | `supabase db reset --debug` (manual; rely on Supabase CLI per existing project) | manual |
| CORPUS-07 | Apify job builder produces correct config per niche | unit | `npm test -- src/lib/engine/corpus/__tests__/apify-jobs.test.ts` | ❌ Wave 0 |
| CORPUS-08 | Quality validation rejects bad rows | unit | `npm test -- src/lib/engine/corpus/__tests__/orchestrator.test.ts -t "quality"` | ❌ Wave 0 |
| EVAL-01 | Eval runner produces results for sample corpus | integration | `npm test -- src/lib/engine/corpus/__tests__/eval-runner.test.ts` (mocks `runPredictionPipeline`) | ❌ Wave 0 |
| EVAL-02 | Macro-F1 matches sklearn output on fixtures | unit | `npm test -- src/lib/engine/corpus/__tests__/macro-f1.test.ts` | ❌ Wave 0 |
| EVAL-03 | LOO produces per-signal scores | unit | `npm test -- src/lib/engine/corpus/__tests__/leave-one-out.test.ts` | ❌ Wave 0 |
| EVAL-04 | ECE reuses calibration.ts unchanged | unit | Existing `src/lib/engine/__tests__/calibration.test.ts` (no new file; verify import path) | ✅ |
| EVAL-05 | Bootstrap p-value reproducible with seed | unit | `npm test -- src/lib/engine/corpus/__tests__/bootstrap.test.ts` | ❌ Wave 0 |
| EVAL-06 | Eval CLI writes JSON + DB rows | smoke (CLI) | `tsx scripts/eval.ts --engine-version 2.1.0 --corpus-version test.fixture --output /tmp/test.json` against a test fixture corpus | ❌ Wave 0 (manual smoke) |
| EVAL-07 | Threshold formula evaluation | unit | `npm test -- src/lib/engine/corpus/__tests__/eval-config.test.ts` | ❌ Wave 0 |
| EVAL-08 | Baseline run completes within cost cap | smoke (CLI) | Run `scripts/eval.ts` with `--max-total-cost-cents 5000` flag; assert exit code 0 | manual |

### Sampling Rate
- **Per task commit:** `npm test -- src/lib/engine/corpus/__tests__/` (corpus + eval module tests only — fast, ~5s)
- **Per wave merge:** `npm test` (full suite, ~30s)
- **Phase gate:** Full suite green + `npm run test:coverage` 80% threshold met + manual smoke (`tsx scripts/build-corpus.ts --pilot --dry-run` produces valid output)

### Wave 0 Gaps
- [ ] `src/lib/engine/corpus/__tests__/bucket.test.ts` — covers CORPUS-05
- [ ] `src/lib/engine/corpus/__tests__/thresholds.test.ts` — version lookup + immutability
- [ ] `src/lib/engine/corpus/__tests__/normalize-scrape.test.ts` — covers CORPUS-04, both clockworks + apidojo formats
- [ ] `src/lib/engine/corpus/__tests__/apify-jobs.test.ts` — covers CORPUS-07
- [ ] `src/lib/engine/corpus/__tests__/orchestrator.test.ts` — covers CORPUS-01, CORPUS-03, CORPUS-08 (mocks Apify client)
- [ ] `src/lib/engine/corpus/__tests__/macro-f1.test.ts` — covers EVAL-02 (compare against sklearn fixture data)
- [ ] `src/lib/engine/corpus/__tests__/bootstrap.test.ts` — covers EVAL-05 (seeded reproducibility)
- [ ] `src/lib/engine/corpus/__tests__/leave-one-out.test.ts` — covers EVAL-03
- [ ] `src/lib/engine/corpus/__tests__/eval-config.test.ts` — covers EVAL-07
- [ ] `src/lib/engine/corpus/__tests__/eval-runner.test.ts` — covers EVAL-01 (with mocked pipeline)
- [ ] `src/lib/engine/corpus/__tests__/stage-latency.test.ts` — quantile correctness
- [ ] Framework install: no new install needed (Vitest already present)
- [ ] Test fixtures: tiny sklearn-output JSON for macro-F1 verification + a small `training_corpus` fixture (10 rows) for eval-runner integration tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes (cron stub only) | `verifyCronAuth()` Bearer token check from `src/lib/cron-auth.ts:9-18`. Stub returns 200 only after auth passes. |
| V3 Session Management | no | No user session involved; CLI scripts run with env-var auth; cron with Bearer secret. |
| V4 Access Control | yes | RLS enforced on all three new tables: `anon` and `authenticated` roles are explicitly DENIED. Service role bypasses RLS. This means the data CANNOT be accidentally read by a logged-in user via direct Supabase client — only by code that goes through `createServiceClient()`. |
| V5 Input Validation | yes (corpus build + eval CLI) | Zod schemas for Apify outputs (reuse `apifyVideoSchema`, build `apidojoVideoSchema`); Zod for CLI args in `scripts/eval.ts`; SQL CHECK constraints on `niche`, `bucket`, `follower_tier`. |
| V6 Cryptography | no | No cryptographic operations in this phase. Apify webhook HMAC is handled by existing webhook handler (untouched here). |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Cron endpoint exposed without auth | Spoofing | `verifyCronAuth()` Bearer token from `src/lib/cron-auth.ts` |
| Apify webhook spoofing (re-corpus refresh) | Tampering | This phase doesn't use Apify webhooks (scripts call Apify directly via authenticated `apify-client`). Phase 11/12 may; reuse existing webhook HMAC pattern at `src/lib/whop/webhook-verification.ts` if so. |
| Service-role key leak in logs | Information disclosure | Structured logger from `src/lib/logger.ts` never logs secrets; Sentry beforeSend strips PII per existing config; service-role key only loaded server-side, never sent to client |
| SQL injection via niche/bucket text | Tampering | Parameterized queries via `@supabase/supabase-js` (mandatory pattern, used everywhere); SQL CHECK constraints enforce enum at DB level |
| Cost runaway during eval run | DoS (self-inflicted) | Pitfall 5 mitigation: per-run cost cap CLI flag `--max-total-cost-cents 5000` |
| Corpus row tampering | Tampering | RLS denies all non-service-role writes; service role only available server-side; ALL writes go through orchestrator with quality validation per CORPUS-08 |
| LLM prompt injection through caption text | Tampering | Existing engine uses caption as input — same threat as production; no new surface here. (`Gemini` calls in `analyzeVideoWithGemini` and DeepSeek already accept user-controlled text; mitigations exist there.) |

**Out-of-scope security work for this phase:**
- Authentication/session: no user-facing surface
- GDPR: no PII collected by corpus (TikTok handles are public; no analytics joining to internal users); INT-07 deferred to Phase 11
- Audit logging: structured logger + Sentry covers it; no SIEM integration needed

## Sources

### Primary (HIGH confidence)

- **Existing codebase (most-cited, single source of truth):**
  - `src/lib/engine/pipeline.ts` — `runPredictionPipeline`, `timed()`, `StageTiming`, graceful degradation pattern
  - `src/lib/engine/aggregator.ts:17` — `ENGINE_VERSION = "2.1.0"` (the literal that D-21 mandates for baseline rows)
  - `src/lib/engine/aggregator.ts:50-85` — `selectWeights(availability)` for LOO mechanism
  - `src/lib/engine/aggregator.ts:288-302` — signal availability detection (warning-string matching)
  - `src/lib/engine/calibration.ts:114-176` — `computeECE` (reuse directly)
  - `src/lib/engine/calibration.ts:221-293` — `fitPlattScaling` + `applyPlattScaling`
  - `src/lib/scraping/apify-provider.ts:11-92` — Apify client usage pattern
  - `src/lib/scraping/index.ts:11-16` — provider factory pattern (reuse)
  - `src/lib/schemas/competitor.ts:31-69` — `apifyVideoSchema`, `apifyProfileSchema`, `normalizeHandle`
  - `src/lib/cron-auth.ts:9-18` — `verifyCronAuth()` Bearer auth
  - `src/lib/supabase/service.ts:11` — `createServiceClient()` (service-role)
  - `src/lib/logger.ts:63` — `createLogger({ module: "X" })`
  - `src/app/api/cron/calibration-audit/route.ts:26-106` — cron route pattern
  - `src/app/api/cron/refresh-competitors/route.ts:50-100` — per-handle isolated failures pattern
  - `src/app/api/cron/scrape-trending/route.ts:33-89` — Apify actor.start() with webhook
  - `supabase/migrations/20260216100000_competitor_tables.sql` — BIGINT counters, RLS pattern, UNIQUE constraints
  - `supabase/migrations/20260213000000_content_intelligence.sql:20-52` — `scraped_videos` reference, `update_updated_at_column()` trigger
  - `vitest.config.ts:14-30` — 80% coverage threshold on engine code
  - `vercel.json:1-31` — 7 existing crons; not adding to file in Phase 1
  - `scripts/benchmark.ts:24-25, 506-584` — `tsx`-based eval pattern + per-sample try/catch
  - `scripts/extract-training-data.ts:68-75` — `getFollowerTier()` reuse
  - `scripts/import-apify-data.ts:64-119` — `mapToRecord()` for clockworks + apidojo formats

- **External documentation (HIGH):**
  - [clockworks/tiktok-scraper Apify actor docs](https://apify.com/clockworks/tiktok-scraper) — input schema, output fields, date filters
  - [clockworks/tiktok-hashtag-scraper Apify](https://apify.com/clockworks/tiktok-hashtag-scraper) — alternative for hashtag-specific scraping
  - [apidojo/tiktok-scraper-api Apify](https://apify.com/apidojo/tiktok-scraper-api) — alternative actor with `dateRange` filter and `channel.followers` inline
  - [scikit-learn f1_score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.f1_score.html) — canonical macro-F1 definition
  - [Comparing NLP Models with Confidence: The Paired Bootstrap Test Explained](https://medium.com/ai-enthusiast/comparing-nlp-models-with-confidence-the-paired-bootstrap-test-explained-c9a88532ea3d) (Singh, 2024) — paired bootstrap rationale + shift method
  - [Neubig util-scripts paired-bootstrap.py](https://github.com/neubig/util-scripts/blob/master/paired-bootstrap.py) — reference Python implementation
  - [scipy.stats.bootstrap docs](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.bootstrap.html) — centered-shift method semantics

### Secondary (MEDIUM confidence)

- [Sushma Mullamuri — Understanding the Macro F1‑Score in Multi‑Class Classification](https://medium.com/@sushma.mullamuri420/understanding-the-macro-f1-score-in-multi-class-classification-21ca00c200da) — corroborated macro-F1 formula
- [Baeldung — F-1 Score for Multi-Class Classification](https://www.baeldung.com/cs/multi-class-f1-score) — corroborated macro-F1 + class imbalance handling
- [Bootstrapping (statistics) — Wikipedia](https://en.wikipedia.org/wiki/Bootstrapping_(statistics)) — general bootstrap theory
- [simple-statistics website](https://simple-statistics.github.io/) + [GitHub](https://github.com/simple-statistics/simple-statistics) — verified package does NOT ship bootstrap (negative claim — relied on docs absence + descriptive scope)

### Tertiary (LOW confidence, flagged)

- WebSearch results on Apify hashtag sort options were inconsistent — some scrapers expose `sortBy` ("playCount"), but no clockworks/apidojo actor was confirmed to support ascending-by-views server-side. **Mitigation: client-side filter, as documented in Pitfall 2.**
- Per-day video-age semantics of `oldestPostDateUnified` come from a single Apify search result. Verified via WebFetch on the actor page itself but minor uncertainty remains on inclusive/exclusive bounds. **Mitigation: belt-and-suspenders client-side date filter at normalize-scrape.ts.**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, all patterns proven in repo
- Architecture (scrape orchestration, eval harness, LOO): HIGH — leverages existing `runPredictionPipeline` + `aggregateScores` untouched, plus pure-function modules
- Schema design: HIGH — mirrors `competitor_*` patterns (BIGINT, RLS, migration filename convention); long-format `benchmark_results` is recommended choice with reasoning
- Threshold formula: HIGH — D-17/D-18 are spec; code is straight translation
- Bucketing: HIGH — D-07/D-10 are spec; pure function + table-driven test
- Bootstrap p-value: MEDIUM-HIGH — algorithm is standard; verified `simple-statistics` lacks it; hand-rolled is the cleaner path; only LOW-uncertainty is on seed reproducibility under floating-point noise (testable)
- LOO: MEDIUM — the warning-string mechanism in `aggregator.ts` is fragile; recommendation §C.3 caveat redirects to math replication
- Pitfalls: HIGH for 1-3, 5-8; MEDIUM for 4 (engagement-rate noise threshold of 1000 views is judgment-based)
- Cron stub: HIGH — `verifyCronAuth` + structured logger + 200 is trivially reproducible

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (30 days) — Apify actor schemas and Supabase patterns are stable; revisit if Apify changes `oldestPostDate` semantics or if Phase 3 changes the `aggregator.ts` signal availability detection
