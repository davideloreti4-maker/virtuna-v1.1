# Phase 1: Training Corpus & Eval Foundation - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two coupled artifacts that unlock every downstream phase:

1. **Labeled training corpus** — 500 TikTok videos stratified 100 viral / 200 average / 200 underperforming across 5 niches (beauty, fitness, edu, comedy, lifestyle), with outcome metadata captured per video, refreshed on a 30-day rolling cadence. Built in two stages: 50-video pilot (validates scrape + bucketing + eval harness end-to-end) → 500-video full corpus (calibrated thresholds from pilot data).

2. **Engine evaluation harness** — runnable against any engine version, produces a benchmark report with macro-F1 (primary gate metric), per-niche breakdown, calibration ECE, per-signal contribution, cost/latency, drift detection, and curated failure cases. Measures v2.1 baseline once and persists it. Encodes the v3 acceptance threshold formula that Phase 12 enforces.

Out of scope this phase: the v3 engine changes themselves (Phases 4–10), creator profile (Phase 2), UI wiring (Phase 11), cron-driven 30-day refresh enforcement (covered structurally but full mechanism is operational concern carried into Phase 11/12).

</domain>

<decisions>
## Implementation Decisions

### Corpus Build Strategy

- **D-01:** **Phased build** — 50-video pilot first (~10 viral / 20 avg / 20 under, proportional stratification), then 500-video full corpus after pilot validates infrastructure. Pilot's primary job is empirical threshold calibration for the full build, not the v2.1 baseline measurement (baseline runs on the 500-video corpus).
- **D-02:** **Per-bucket independent sourcing** (replaces an earlier "same creators back-catalog" recommendation that was rejected during discussion):
  - **Viral:** Apify per-niche trending feed scrape, filter to ≥ niche-viral view threshold
  - **Average:** trending tail + niche-hashtag recent posts, filter to mid-range views
  - **Under:** dedicated Apify hashtag-sorted-by-views-ascending sweep per niche, filter to ≤ niche-under threshold
  - Rationale: back-catalog matching biases viral pool toward serial-creators with high variance and under-represents one-hit-wonders, which are a huge fraction of real TikTok virality. Independent sourcing per bucket preserves the full creator distribution.
- **D-03:** **Niche set locked** — Beauty, Fitness, Education ("Edu"), Comedy, Lifestyle.
- **D-04:** **Min video age = 7 days** before outcome metrics trusted. TikTok engagement curve substantially plateaus by day 5–7.
- **D-05:** **Max 3 videos per creator** diversity cap. Forces outcome variance to reflect content quality, not creator pull.
- **D-06:** **Three Apify scrape configs per niche × 5 niches = 15 small scrape jobs** for the pilot. Each is isolated and simple. Same structure for the full build (just larger result sets).

### Outcome Bucketing

- **D-07:** **Per-niche absolute view thresholds** for bucketing. Rejected: engagement-rate-per-follower (10M-view-low-engagement videos would mislabel as underperformer), per-niche percentile (less defensible at small sample sizes), absolute global thresholds (different niches have very different distributions).
- **D-08:** **Pilot starting thresholds** (loose, to ensure all buckets fill; treat as initial guesses, not load-bearing):

  | Niche | Viral floor | Under ceiling |
  |---|---|---|
  | Beauty | ≥ 250k | ≤ 5k |
  | Fitness | ≥ 200k | ≤ 5k |
  | Edu | ≥ 100k | ≤ 2k |
  | Comedy | ≥ 500k | ≤ 10k |
  | Lifestyle | ≥ 250k | ≤ 5k |

  Average = everything between viral floor and under ceiling.

- **D-09:** **Empirical threshold recalibration after pilot** — pull actual per-niche view distributions from pilot scrape data, recompute thresholds (niche P90 for viral, niche P30 for under). Lock recomputed thresholds into the full-corpus build's `corpus_version`.
- **D-10:** **Hard cutoff at the threshold** — no exclusion of borderline videos. Label noise at edges accepted; models handle noise. Rejected: confidence-weighted labels (eval math complexity), four-class system (overengineered for sample size).
- **D-11:** **Bucketing logic in TypeScript** at `src/lib/engine/corpus/` (importable, Vitest-testable). Reads thresholds from `corpus_version` config + computes bucket from a row's metrics. Rejected: SQL generated columns (can't reference cross-row percentiles), materialized views (refresh management overkill).
- **D-12:** **`corpus_version` semver-style identifier** — `pilot.YYYY-MM-DD`, `full.YYYY-MM-DD`, `full.YYYY-MM-DD` for 30-day refreshes. Every record in `benchmark_results` tagged with `corpus_version + engine_version` pair.
- **D-13:** **Fixed-snapshot thresholds per `corpus_version`** — thresholds compute once at version seal time. Each 30-day refresh = new `corpus_version` = new snapshot, but a given version's thresholds never change. Predictions made under v2.1 against `pilot.2026-05-XX` are reproducible forever.

### Eval Harness Metrics

- **D-14:** **Primary gate metric** = **macro-F1 on 3-class bucket classification** (viral / avg / under). Averages F1 across classes to handle the 20/40/40 class imbalance fairly. Interpretable as "X% of videos predicted into the correct outcome bucket."
- **D-15:** **Per-niche floor on the gate** — global macro-F1 must improve vs v2.1 baseline AND no individual niche's macro-F1 may regress by more than 5 percentage points vs that niche's v2.1 baseline. Prevents shipping a model that's strong on Comedy but worse on Edu.
- **D-16:** **Secondary metrics persisted in every benchmark report:**
  - Calibration ECE (Expected Calibration Error) — critical for Phase 10 calibration training
  - Per-class precision / recall — see which buckets the model wins or regresses on
  - Per-signal leave-one-out contribution — EVAL-03; catches signal-level regressions per phase
  - Cost per analysis (USD) — BENCH-03 caps at $0.075 average
  - Spearman ρ within niche — rank-correlation quality, useful for hook-comparison features in M2
  - MAE on engagement-rate prediction — continuous error tracking
  - **Failure case curation** — top 10 mispredictions per benchmark run, persisted as JSON with full pipeline trace + reasoning. Enables "where does v3 fail?" investigation.
  - **Per-stage latency** p50 / p95 / p99 + cost breakdown — instrumentation for the 5+ stages being added in subsequent phases.
  - **Drift detector** — compare bucket distribution + niche distribution between consecutive corpus versions; flags TikTok platform dynamic shifts.
  - **Viral recall + under precision** — bucket-specific metrics. Viral recall = "do we catch viral correctly?" Under precision = "do we falsely accuse content of being underperforming?" Useful for the anti-virality warning feature in Phase 9.

### Threshold Rule (v3 Acceptance Formula)

- **D-17:** **Relative improvement + statistical significance** both required:
  - v3 global macro-F1 must improve by ≥ X% relative vs v2.1
  - Bootstrap resample (≥ 200 iterations) p-value < 0.05
- **D-18:** **Sliding scale** for X based on the measured v2.1 baseline:
  - v2.1 macro-F1 ≤ 0.40 → require ≥ 15% relative improvement
  - 0.40 < v2.1 ≤ 0.55 → require ≥ 10% relative improvement
  - v2.1 > 0.55 → require ≥ 7% relative improvement + significance
  - Rationale: diminishing returns — 15% gain on 0.30 is achievable, 15% on 0.65 (= 0.10 absolute) is enormous and possibly infeasible.
- **D-19:** **Threshold formula persisted in both** code and doc:
  - `.planning/research/v2.1-baseline.md` — full baseline metrics, statistical reasoning, threshold rule rationale (human-readable)
  - `src/lib/engine/corpus/eval-config.ts` — threshold formula constants the eval harness reads at runtime (executable)
  - Cross-linked: doc references the code constants; code header comment references the doc.
- **D-20:** **Phase 1 ships** with: (1) baseline report at `.planning/research/v2.1-baseline.md`, (2) threshold formula in `eval-config.ts`, (3) `benchmark_results` table seeded with the v2.1 baseline run.

### Engine Version Tagging (Bootstrap)

- **D-21:** **Hardcoded version string for v2.1 baseline** — since proper engine versioning is added in Phase 3, the baseline measurement uses `engine_version = "2.1.0"` as a literal string in `benchmark_results` rows. Phase 3 picks up the structural work; Phase 1 only needs the field to exist with a stable value.

### Claude's Discretion

- **Apify scraper architectural detail** — whether to extend `apify-client` usage in existing `src/lib/scraping/` or scaffold a parallel `src/lib/scraping/corpus/` module. Researcher / planner to evaluate based on existing module boundaries.
- **Eval harness CLI vs API** — whether `eval-harness` exposes a `tsx scripts/eval.ts` CLI or routes through an internal API endpoint. Defer to planning.
- **Exact bootstrap method** — paired bootstrap (sample same videos under both engine versions) vs unpaired. Defer to researcher.
- **Failure case curation storage** — JSON in `.planning/benchmarks/` vs a `benchmark_failure_cases` Supabase table. Defer to planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase 1 — phase goal, dependencies, success criteria (5 numbered items)
- `.planning/REQUIREMENTS.md` §Training Corpus (CORPUS-01..08) — corpus requirements
- `.planning/REQUIREMENTS.md` §Evaluation Framework (EVAL-01..08) — eval harness requirements
- `.planning/REQUIREMENTS.md` §Acceptance Benchmark (BENCH-01..06) — what Phase 12 enforces against the threshold this phase sets
- `.planning/PROJECT.md` §Current Milestone: Engine Foundation — milestone goal, acceptance gate, engine architecture overview
- `.planning/STATE.md` §Accumulated Context: Decisions — milestone-start decisions (two-milestone split, additive-only engine, persona allocation, etc.)

### Codebase Maps
- `.planning/codebase/STACK.md` — TypeScript / Next.js 16 / Supabase / Vitest 80% threshold / Vercel Cron
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline structure, wave-parallel execution, `timed()` wrapper, graceful degradation
- `.planning/codebase/INTEGRATIONS.md` — Apify integration patterns (`apify-client` v2.22.1, webhook handler, dataset ID storage)

### Existing Engine Code (for v2.1 baseline measurement)
- `src/lib/engine/pipeline.ts` — wave-parallel pipeline; baseline harness runs predictions through this
- `src/lib/engine/aggregator.ts` — score aggregation; produces `PredictionResult` to compare against corpus labels
- `src/lib/engine/types.ts` — `PredictionResult`, `FeatureVector`, signal types
- `src/lib/engine/ml.ts` — existing ML classifier (audited against corpus in Phase 10)
- `src/lib/engine/calibration.ts` — Platt calibration pattern; outcome-pair fetch logic; ECE computation foundation
- `src/app/api/cron/calibration-audit/route.ts` — closest pattern for a periodic eval-style cron job
- `supabase/migrations/20260216100000_competitor_tables.sql` — closest schema precedent for the new `training_corpus` table
- `src/lib/logger.ts` — `createLogger({ module })` factory used throughout engine code

### Phase 1 Outputs (will be created)
- `.planning/research/v2.1-baseline.md` — to be created; full baseline metrics + threshold reasoning
- `src/lib/engine/corpus/eval-config.ts` — to be created; threshold formula constants

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Apify client + scraping module** (`src/lib/scraping/`, `apify-client` v2.22.1) — corpus scrape jobs reuse this pattern; new actor configs slot in alongside existing trending + competitor configs
- **`outcomes` table + calibration query pattern** (`src/lib/engine/calibration.ts`) — `benchmark_results` table mirrors this pattern; bootstrap p-value computation can reuse the predicted-vs-actual fetch logic style
- **Vercel Cron pattern** (`vercel.json` + `src/app/api/cron/*/route.ts`, 7 existing jobs) — corpus refresh cron slots in here; existing convention is `0 X * * *` style declarative scheduling
- **`createServiceClient()`** (`src/lib/supabase/service.ts`) — service-role client for cron writes that bypass RLS; corpus refresh + eval harness both use this
- **Structured logger** (`src/lib/logger.ts`) — `createLogger({ module: "corpus" })`, `createLogger({ module: "eval" })`; JSON output in prod, pretty in dev
- **Sentry instrumentation** — `Sentry.captureException(err, { tags: { stage: "..." } })` pattern from calibration.ts; eval harness errors get the same treatment
- **Vitest with 80% coverage threshold** (`vitest.config.ts`) — corpus + eval modules must meet this bar

### Established Patterns
- **Graceful degradation** — every non-critical pipeline stage wraps work in try/catch and falls back to defaults with `warnings[]` array; eval harness measures pipeline outputs including this fallback behavior (don't suppress degradation in eval runs)
- **RLS on user-scoped tables; service role bypass for cron writes** — corpus table is *not* user-scoped (system-wide), so RLS is service-role-only access (no public read)
- **TypeScript strict mode + Zod** — corpus + eval schemas validated end-to-end
- **`timed()` wrapper** for stage timing (`src/lib/engine/pipeline.ts`) — eval harness piggybacks on this for per-stage latency p50/p95/p99
- **Migration filename convention** — `supabase/migrations/YYYYMMDDHHMMSS_description.sql`; new tables follow this

### Integration Points
- **New Supabase tables:**
  - `training_corpus` — video metadata + outcome metrics + bucket label + corpus_version + niche
  - `benchmark_results` — eval harness output rows tagged with engine_version + corpus_version + metric values + cost + latency + run timestamp
  - `benchmark_failure_cases` (TBD per Claude's discretion) — possibly Supabase, possibly JSON files
- **New cron endpoint:** `/api/cron/refresh-corpus` (Vercel cron, daily or weekly trigger; not in pilot scope but stubbed for full corpus 30-day refresh)
- **New module:** `src/lib/engine/corpus/` — bucketing classifier, threshold config, eval harness entry point, baseline measurement script
- **New script:** `scripts/eval.ts` (executable via `tsx scripts/eval.ts`) — CLI for the eval harness (per Claude's discretion D-21)
- **No changes to:** `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/lib/engine/types.ts` — phase is additive (consistent with milestone-wide additive-only constraint)

</code_context>

<specifics>
## Specific Ideas

- **User explicitly pushed back twice** during bucketing discussion — engagement-rate-per-follower mislabel paradox (10M-view low-engagement video), and excluding borderlines feeling wrong. Both pushbacks were correct and the locked decisions (per-niche absolute thresholds, hard cutoff with no exclusion) reflect that.
- **User flagged the per-niche accuracy concern unprompted** during primary-metric discussion — this directly produced D-15 (per-niche floor on the gate). This is a strong signal that downstream phases must keep per-niche performance visible, not just global averages.
- **Phased pilot → full build philosophy is the user's instinct** — "test with 50 videos and then go to the 500" was the user's framing upfront. Treat the pilot as load-bearing: it both validates infrastructure AND calibrates thresholds. Skipping or shortcutting the pilot is a deviation.
- **User asks for honest engineering analysis when uncertain** — when threshold numbers were proposed without strong evidence, user explicitly asked "think it through" / "whats the best solution". The agreed-on answer was: don't pretend to know; make pilot's job to calibrate empirically. Apply this pattern in research and planning — flag uncertain choices for empirical calibration rather than guessing.

</specifics>

<deferred>
## Deferred Ideas

- **Drift-aware adaptive thresholds across corpus versions** — D-13 keeps thresholds fixed per corpus_version; an adaptive scheme that smooths across version boundaries is overkill for this milestone but may matter for long-term outcome learning.
- **Confidence-weighted labels** — rejected in D-10 in favor of hard cutoffs. Revisit only if pilot reveals label noise at edges materially degrades eval signal.
- **Outcome auto-scraper for in-product analyses** (vs. corpus scrapes) — out of scope per PROJECT.md "Deferred (Future Milestones)" section. Corpus scrapes here, in-product loop later.
- **Four-class bucketing system** (with explicit "borderline" class) — rejected as overengineered for pilot sample size; could revisit if hard cutoffs cause downstream model confusion.
- **Re-niching the corpus** — if pilot scrape data reveals one of (Beauty / Fitness / Edu / Comedy / Lifestyle) has very weak per-niche signal, re-evaluate niche selection. Default is stay the course unless evidence demands change.
- **Eval harness as a public dashboard / Studio page** — Phase 11 surfaces UI for engine results; a benchmark dashboard for the team is downstream of M1, not in this milestone.

</deferred>

---

*Phase: 1-Training Corpus & Eval Foundation*
*Context gathered: 2026-05-11*
