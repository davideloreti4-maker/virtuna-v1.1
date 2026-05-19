---
phase: 07-multi-persona-simulation
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/run-persona-ab-eval.ts
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/lib/engine/__tests__/factories.ts
  - src/lib/engine/__tests__/pipeline.test.ts
  - src/lib/engine/__tests__/stubs.test.ts
  - src/lib/engine/__tests__/wave3-aggregator.test.ts
  - src/lib/engine/__tests__/wave3-cost-budget.test.ts
  - src/lib/engine/__tests__/wave3.test.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/corpus/eval-harness.ts
  - src/lib/engine/corpus/eval-runner.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/types.ts
  - src/lib/engine/wave3.ts
  - src/lib/engine/wave3/aggregator.ts
findings:
  critical: 3
  warning: 9
  info: 4
  total: 16
findings_resolved:
  critical: 3
  warning: 9
  info: 4
  total: 16
status: resolved
resolved_at: 2026-05-19T11:30:00Z
resolution_notes: "Critical + warning findings fixed in 10 atomic commits (9451272..19eb753) — see 07-REVIEW-FIX.md. Info findings fixed in 3 commits: IN-01 (20b685d), IN-04 (a1ba0b2), IN-02+IN-03 (6610cf8)."
---

# Phase 7: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 7 (Multi-Persona Simulation) ships a Wave 3 orchestrator that fires 10 parallel DeepSeek persona calls, an aggregator that merges them into a behavioral predictions object, type-level widening on `PredictionResult` / `PipelineResult` / `SignalAvailability`, and a CLI A/B eval script.

The persona aggregator math (top-3-weighted 60/40, Pitfall 4 remaining=0 short-circuit) is correctly implemented and well-tested. The Promise.allSettled isolation pattern is correct. The circuit-breaker fast-fail short-circuit is correctly placed before any API call. Tests are extensive and target real invariants.

However, three BLOCKER bugs put cost telemetry and cost-cap enforcement at risk:
1. The `cost_cents` rolled up by the aggregator does NOT include Wave 3 persona cost, so the eval-runner cost cap (`maxTotalCostCents`) is silently bypassed for hidden Wave 3 spend on every row.
2. The per-call cost in `wave3.ts` is overwritten on validation retry; the first attempt's cost is lost from both per-call telemetry and the wave-level total. The D-18 telemetry invariant ("per-call sum == wave-level total") only holds in the no-retry path.
3. The A/B CLI accepts `--max-rows`, `--max-cost-cents`, and `--rate-limit-ms` without validating that `parseInt` returned a number. `parseInt("abc", 10)` is `NaN`; `NaN` is falsy on the truthy check, so `maxRows=NaN` silently falls back to the full corpus, and `maxTotalCostCents=NaN` silently disables the cost cap (every `totalCost > NaN` comparison is `false`). A typo on the smoke run becomes a full-corpus run with no cost cap.

Additional warnings flag the missing Wave-3 cost in the production aggregator's `cost_cents` field (consumer-facing under-reporting), the semantic unit mismatch between `PersonaBehavioralAggregate` (0-100 intent scores) and `BehavioralPredictions` (0-100 percentages of views) that distorts `computePredictedEngagement` when `behavioralSource="personas"`, a type-level error in `makePipelineResult` factory (missing 14 required `CreatorContext` fields), and several lower-severity concerns around the optional-but-always-set `signal_availability.personas` flag and duplicate archetype definitions across files.

The A/B CLI script does NOT use `exec`, `spawn`, `eval`, or any shell-execution path — `--max-rows` and `--corpus-version` flow only into application data, so there is no shell-injection vulnerability. The corpus version string also flows into a string-templated Supabase query column predicate (parameterized via `.eq()`), not a raw SQL string, so it is not a SQL-injection vector either.

## Critical Issues

### CR-01: Wave 3 cost not included in `prediction.cost_cents` — eval-runner cost cap silently bypassed for hidden spend

**File:** `src/lib/engine/aggregator.ts:503-506`
**Issue:** The aggregator builds `cost_cents` as `(geminiResult.cost_cents + (deepseekResult?.cost_cents ?? 0))` and writes that to `PredictionResult.cost_cents`. Wave 3 fires 10 DeepSeek persona calls per row whose cost is emitted via stage_end telemetry but never folded into the rolled-up `cost_cents`. `runEvalOverCorpus` reads `prediction.cost_cents ?? 0` (eval-runner.ts:119) and uses that to enforce `if (totalCost > cap)` (eval-runner.ts:125). Result: every row burns up to ~2.5 cents of unmetered Wave 3 spend, and the smoke-mode `--max-cost-cents 500` short-circuit cannot see it. For a 225-row corpus this is ~5.6 cents of hidden spend in the cache-warm case and ~5.6 dollars at cache-miss-worst-case (still below the $50 default cap, but the cap math is broken on principle and breaks loudly if Wave 3 cost ever grows or cache eviction degrades). The script header even advertises "Run B substituted run adds Wave 3 cost on top of Phase 1 baseline ~$0.33" — but the cap cannot enforce that bound.

This is also a correctness bug for the comparison report written by `scripts/run-persona-ab-eval.ts`: `baseline.cost_cents_total` and `substituted.cost_cents_total` both under-report by the per-row Wave 3 cost (incurred in BOTH runs because the pipeline always runs Wave 3 regardless of `behavioralSource`).

**Fix:** Surface Wave 3 cost back through `PipelineResult` and fold it into the aggregator's roll-up. Plumb a `wave3CostCents` (or equivalent) out of `runWave3` and through the pipeline:
```ts
// wave3.ts — return cost alongside outcome
export interface Wave3Outcome {
  aggregate: PersonaBehavioralAggregate | null;
  results: PersonaSimulationResult[];
  warnings: string[];
  cost_cents: number; // NEW
}
// at end of runWave3:
return { aggregate, results: survivors, warnings, cost_cents: +totalCostCents.toFixed(4) };

// pipeline.ts — surface to PipelineResult
export interface PipelineResult {
  // ... existing fields
  wave3CostCents: number; // NEW
}
// at end of runPredictionPipeline:
return { ..., wave3CostCents: wave3Outcome.cost_cents };

// aggregator.ts — include in cost_cents roll-up
const cost_cents =
  Math.round(
    (geminiResult.cost_cents
      + (deepseekResult?.cost_cents ?? 0)
      + pipelineResult.wave3CostCents) * 10000
  ) / 10000;
```

### CR-02: Validation-retry path loses first-attempt cost from telemetry — D-18 invariant breaks

**File:** `src/lib/engine/wave3.ts:147-235`
**Issue:** The per-call body in `callPersona`:
```ts
let callCostCents = 0;
while (attempt <= 1) {
  try {
    const response = await ai.chat.completions.create(...);
    // line 182: callCostCents = (inputCost + completion * OUTPUT_PRICE) * 100;
    // ... parse + validate
    if (!validated.success) throw new Error(`validation failed: ...`);
    emitStageEnd(...{ cost_cents: +callCostCents.toFixed(6), ok: true });
    totalCostCents += callCostCents;   // adds successful-attempt cost only
    return result;
  } catch (err) {
    // validation-failure branch falls through to retry
    attempt++;
  }
}
```
On a validation-fail-then-retry-success path:
- Iteration 1: API call succeeds (charged), `callCostCents` is set to X, validation throws, X is NEVER added to `totalCostCents` and NEVER emitted via a per-call stage_end.
- Iteration 2: API call succeeds (charged again), `callCostCents` is OVERWRITTEN to Y. Validation passes. Emit `cost_cents: Y`, `totalCostCents += Y`.

Result: real cost is X+Y; reported wave cost is Y. Lost cost X never appears in per-call or wave-level telemetry. On retry-then-failure with iteration-2 API success, callCostCents=Y is emitted but neither X nor Y is added to `totalCostCents` (telemetry mismatch between per-call event and wave total). On retry-then-failure where iteration-2 API errors before line 182, callCostCents stays at X but is not added to `totalCostCents`.

The D-18 "per-call sum equals wave-level total" invariant only holds when no slot retries. Test 4 in `wave3-cost-budget.test.ts` proves this only for the happy path; the retry path is exercised by `wave3.test.ts` Test 10 but never asserts cost telemetry consistency on that path.

**Fix:** Accumulate per-attempt cost into a `callCostAccum` and emit the accumulator on every stage_end. Always credit `totalCostCents` even on terminal failure paths if the API was actually called.
```ts
let callCostAccum = 0;
while (attempt <= 1) {
  let attemptCostCents = 0;
  try {
    const response = await ai.chat.completions.create(...);
    // ... compute attemptCostCents from usage
    callCostAccum += attemptCostCents;
    // ... validate
    if (!validated.success) throw new Error(`validation failed: ...`);
    emitStageEnd(..., { cost_cents: +callCostAccum.toFixed(6), ok: true });
    totalCostCents += callCostAccum;
    return result;
  } catch (err) {
    // ... if terminal:
    emitStageEnd(..., { cost_cents: +callCostAccum.toFixed(6), ok: false, warning });
    totalCostCents += callCostAccum;   // credit even on terminal failure — API was charged
    throw lastError;
  }
}
```
Also add a regression test that asserts `perCallSum == waveCost` for a 1-validation-retry case.

### CR-03: A/B CLI accepts NaN for `--max-rows` / `--max-cost-cents` / `--rate-limit-ms`, silently disabling cost cap and row cap

**File:** `scripts/run-persona-ab-eval.ts:63-71`
**Issue:**
```ts
const maxCostRaw = getArg("--max-cost-cents");
const maxRowsRaw = getArg("--max-rows");
const rateLimitMsRaw = getArg("--rate-limit-ms");
return {
  corpusVersion: corpusVersion as string,
  maxTotalCostCents: maxCostRaw ? parseInt(maxCostRaw, 10) : undefined,
  maxRows: maxRowsRaw ? parseInt(maxRowsRaw, 10) : undefined,
  rateLimitMs: rateLimitMsRaw ? parseInt(rateLimitMsRaw, 10) : 2000,
  engineVersionPrefix: getArg("--engine-version-prefix") ?? "3.0.0-dev",
};
```
`parseInt("abc", 10)` returns `NaN`. Downstream:
- `maxRows: NaN` flows to `runEvalOverCorpus`. `effective = opts.maxRows ? allRows.slice(0, opts.maxRows) : allRows`. `!NaN === true`, so `effective = allRows` — the full corpus runs silently when the user thinks they're running a smoke subset.
- `maxTotalCostCents: NaN` flows into `cap = opts.maxTotalCostCents ?? 5000`. `??` only catches `null`/`undefined`, so `cap = NaN`. Then `if (totalCost > NaN)` is always `false` — **cost cap is disabled**.
- `rateLimitMs: NaN` flows into `await sleep(NaN)` → `setTimeout(..., NaN)` which Node treats as 1ms — bursts requests at native loop speed, can trip provider rate limits.

A typo on the smoke command (`--max-cost-cents 50O` with letter O instead of zero, `--max-rows ten`, copy-paste of `--max-cost-cents=500` instead of `--max-cost-cents 500`) becomes a full-corpus run with no cap. The "lightweight A/B eval" framing implies this is a routinely-run script.

**Fix:** Validate parses with `Number.isFinite` and exit on bad input:
```ts
function parseIntStrict(flag: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Invalid ${flag} value: "${raw}" — must be a positive integer`);
    process.exit(1);
  }
  return n;
}
const maxTotalCostCents = parseIntStrict("--max-cost-cents", maxCostRaw);
const maxRows = parseIntStrict("--max-rows", maxRowsRaw);
const rateLimitMs = parseIntStrict("--rate-limit-ms", rateLimitMsRaw) ?? 2000;
```
Also harden `runEvalOverCorpus` defensively: if `opts.maxTotalCostCents` is non-finite, treat it as `undefined` (apply the 5000 default).

## Warnings

### WR-01: `PersonaBehavioralAggregate` aliases `BehavioralPredictions` but units differ — `computePredictedEngagement` produces 15-20× inflated engagement when `behavioralSource="personas"`

**File:** `src/lib/engine/aggregator.ts:262-269`, `src/lib/engine/types.ts:382-387`, `src/lib/engine/wave3/aggregator.ts:43-65`
**Issue:** `BehavioralPredictions.share_pct` (DeepSeek output) is a **percentage of views** (typical values 0.2-2). `PersonaBehavioralAggregate.share_pct` is computed via `topNWeighted(survivors, "share_intent")` — and `share_intent` is documented as **0-100 intent score** (persona-prompts.ts:152, `z.number().min(0).max(100)`). Yet `types.ts:387` declares `PersonaBehavioralAggregate = BehavioralPredictions` (structural alias).

When `behavioralSource="personas"`, the aggregator substitutes the persona aggregate as `behavioral_predictions` then feeds it to `computePredictedEngagement(overall_score, behavioral_predictions)`:
```ts
const shareRate = Math.max(0.002, (behavioral.share_pct / 100) * (0.5 + jitter(4) * 0.3));
```
With DeepSeek share_pct=4.2 → shareRate ≈ 2-3% of views (correct).
With persona share_pct=75 → shareRate ≈ 37-60% of views (15-20× inflated).

While `runEvalOverCorpus` only reads `predicted_overall_score` (so this doesn't directly poison the macro-F1 metric), it WILL distort `viral_recall` / `under_precision` if any downstream metric reads `predicted_engagement`, and the `predicted_engagement` field is exposed on every `PredictionResult` for UI/persistence. Anyone consuming the substituted result will see absurd engagement numbers.

**Fix:** Either:
- Rescale `PersonaBehavioralAggregate` values to match `BehavioralPredictions` units in `wave3/aggregator.ts` (intent score → percentage-of-views), with the mapping documented and tested.
- OR break the type alias: make `PersonaBehavioralAggregate` a distinct interface (still 0-100 but documented as intent), and at the aggregator substitution point (aggregator.ts:526-529) convert to `BehavioralPredictions` semantics explicitly.

### WR-02: `signal_availability.personas` is declared optional on the type but always set by aggregator — schema/code drift

**File:** `src/lib/engine/types.ts:211-217`, `src/lib/engine/aggregator.ts:358-362`
**Issue:** `types.ts:217` declares `personas?: boolean` (optional with `?:`). The Phase 4 sibling keys `content_type: boolean` and `niche: boolean` (lines 209-210) are required. The aggregator always sets `personas: pipelineResult.personaBehavioralAggregate !== null` (aggregator.ts:362), so the field is never absent from a Phase 7+ result. Downstream consumers reading `signal_availability.personas` must defensively treat `undefined` as `false`, but tests (`aggregator.test.ts:704-716`) and route persistence treat it as guaranteed. The optional declaration is stale documentation that masks intent and will let a future regression silently elide the flag.

**Fix:** Promote to required:
```ts
export interface SignalAvailability {
  // ... existing
  /** Phase 7 (D-15) — true when persona_behavioral_aggregate !== null (≥7-of-10 personas succeeded). */
  personas: boolean;
}
```
The same comment block at types.ts:213-216 mentions "Plan 07-02 will consider promoting this key to required once the aggregator path is exercised by tests" — that's now the case, so promote it.

### WR-03: Factory `makePipelineResult` produces a structurally-invalid `CreatorContext` (14 required fields missing) — type-checking depends on test runner tolerance

**File:** `src/lib/engine/__tests__/factories.ts:236-249`
**Issue:** `PipelineResult.creatorContext` is typed as `CreatorContext`, which (per `src/lib/engine/creator.ts:11-46`) requires 19 fields including `target_platforms`, `niche_primary`, `niche_sub`, `target_audience`, `primary_goal`, `creator_stage`, `content_style`, `cuts_per_second`, `reference_creators`, `past_wins`, `past_flops`, `time_of_day_aware`, `pain_points`. The factory provides only 7. All missing fields are `T | null` (nullable), but **not optional** — TypeScript with `strict: true` (per tsconfig.json:7) should reject this. The codebase ships because Vitest's esbuild-backed transform strips types without type-checking; `next build` doesn't include `__tests__/*.ts` in its production graph. The wave3.test.ts `makeCreatorContext()` fixture (lines 95-123) includes all required fields, so this is purely a factory drift.

This blocks any future move to add `tsc --noEmit` as a CI step covering tests, and it's an actual type error today.

**Fix:** Add the missing fields:
```ts
creatorContext: {
  found: false,
  follower_count: null,
  avg_views: null,
  engagement_rate: null,
  niche: null,
  posting_frequency: null,
  platform_averages: { /* unchanged */ },
  // Phase 2 — 9-card profile fields (all nullable, default null)
  target_platforms: null,
  niche_primary: null,
  niche_sub: null,
  target_audience: null,
  primary_goal: null,
  creator_stage: null,
  content_style: null,
  cuts_per_second: null,
  reference_creators: null,
  past_wins: null,
  past_flops: null,
  time_of_day_aware: null,
  pain_points: null,
},
```

### WR-04: Failed-call cost (timeout, non-validation error) is not credited to wave-level total — under-reports real spend on partial failures

**File:** `src/lib/engine/wave3.ts:147-227`
**Issue:** When a persona call fails (timeout `AbortError`, network error, or non-validation API error), the catch branch emits `cost_cents: +callCostCents.toFixed(6)` on the per-call stage_end (line 222) but never adds `callCostCents` to `totalCostCents` (the wave-level accumulator). If the API call SUCCEEDED at the transport level (line 182 assigned `callCostCents`) but then validation failed terminally, the spent tokens are charged by DeepSeek but invisible to the wave-level cost. Combined with CR-02 this means failure modes systematically under-report spend.

Note: AbortError on timeout typically aborts BEFORE the response is read, so `usage` is undefined and `callCostCents` stays 0 — but DeepSeek may still have charged the request. The current code can't see provider-side billing.

**Fix:** Credit any non-zero `callCostCents` to `totalCostCents` in the catch path's terminal branch:
```ts
if (isTimeout || attempt === 1 || !isValidation) {
  // ... existing
  if (callCostCents > 0) totalCostCents += callCostCents;
  emitStageEnd(...);
  throw lastError;
}
```
Documented separately: on `AbortError`, there is no way to recover the provider's actual token charge without an out-of-band reconciliation.

### WR-05: `percentileLabel` in `wave3/aggregator.ts` mislabels intent-score buckets as percentile bands — confusing semantics persisted to result

**File:** `src/lib/engine/wave3/aggregator.ts:103-109`
**Issue:** The function returns `"top 10%"`, `"top 25%"`, etc. for `share_pct`/`comment_pct`/`save_pct` values, but those values are not percentile ranks — they're top-3-weighted intent scores in the 0-100 range. A `share_pct=75` labeled `"top 25%"` reads as "this content ranks in the top 25% for shares against a corpus baseline" but actually means "the average top-3 enthusiast persona's share-intent score was 75/100." The label propagates to `PredictionResult.behavioral_predictions.share_percentile` and is consumer-readable.

The code comment acknowledges this is "a lightweight decile heuristic for Phase 7 ship" — but the strings persist into production result schemas regardless.

**Fix:** Either:
- Rename labels to reflect intent: `"very high intent"` / `"high intent"` / `"moderate intent"` / `"low intent"`, with thresholds reset accordingly.
- OR omit percentile labels for persona-aggregate output, returning a sentinel like `"persona-intent"` or `null` until Phase 10's corpus-driven percentile bands replace the heuristic.

### WR-06: `ARCHETYPES` constant duplicated between `wave3/persona-registry.ts:22-34` and `types.ts:344-356` — silent drift risk for tie-break determinism

**File:** `src/lib/engine/types.ts:344-356`, `src/lib/engine/wave3/persona-registry.ts:22-34`
**Issue:** The 10-archetype list exists twice:
- `types.ts` exports `PersonaArchetypeSchema = z.enum([...10 names...])` and derives `type PersonaArchetype = z.infer<...>`.
- `persona-registry.ts` exports `ARCHETYPES = [...same 10 names...] as const` and derives `type Archetype = (typeof ARCHETYPES)[number]`.

`wave3/aggregator.ts:86` uses `ARCHETYPES.indexOf(...)` for the top-3 tie-break (load-bearing for determinism). If a future edit adds an archetype to `PersonaArchetypeSchema` but forgets the registry array (or vice versa), the tie-break order will silently drift relative to the Zod schema, while tests like `wave3-aggregator.test.ts` Test 8 (tie-break determinism) will keep passing against the inconsistent state.

**Fix:** Make one the source of truth and derive the other:
```ts
// persona-registry.ts is the canonical source — types.ts derives from it
import { ARCHETYPES } from "./wave3/persona-registry";
export const PersonaArchetypeSchema = z.enum(ARCHETYPES);
export type PersonaArchetype = (typeof ARCHETYPES)[number];
```
Or vice versa, but pick one.

### WR-07: Cost cap comment in `eval-runner.ts:122-128` is inaccurate after Wave 3 cost exclusion

**File:** `src/lib/engine/corpus/eval-runner.ts:122-128`
**Issue:** The comment claims "One over-budget row is tolerated within the 33% safety buffer ($50 cap vs $37.50 ceiling)." This budget math is computed against an undercount of true spend (see CR-01). When Wave 3 cost is excluded, the buffer is larger than 33% (because the cap operates on less than total cost), so the comment misleads readers into trusting a safety margin that doesn't apply to actual provider charges.

**Fix:** Update the comment once CR-01 is fixed, or qualify it now: "Cap math currently excludes Wave 3 cost (~0.5-2.5 cents/row hidden). True ceiling is approximately $cap + (rows × Wave3CostPerRow)."

### WR-08: A/B CLI report writes to a relative path (`.planning/research/...`) — succeeds or silently mis-targets depending on caller cwd

**File:** `scripts/run-persona-ab-eval.ts:188-194`
**Issue:** `path.join(".planning", "research", ...)` resolves against `process.cwd()`. The header says `npx tsx scripts/run-persona-ab-eval.ts ...`, implying the script is run from the repo root, but there's no enforcement. Running from any other directory (e.g., from a worktree subdir, or from `tmux` in a different pane) writes the report to the wrong location or fails on `fs.mkdir` if the path target doesn't exist. The 200+ line of LLM cost burns first and the report write fails last — wasting the run.

**Fix:** Anchor to the repo root:
```ts
const REPO_ROOT = resolve(__dirname, "..");
const reportPath = path.join(REPO_ROOT, ".planning", "research", `persona-aggregate-ab-${date}.md`);
```
Or `process.chdir(REPO_ROOT)` at the start of main(). Either preserves the relative-path read pattern.

### WR-09: `run-persona-ab-eval.ts` `register()` call from `tsconfig-paths` is placed after import statements but TS hoists imports — code intent doesn't match runtime order

**File:** `scripts/run-persona-ab-eval.ts:25-41`
**Issue:** The file looks like:
```ts
import { config } from "dotenv";
import { resolve } from "path";
config({ path: ... });                            // line 25 — looks like first non-import
import { register } from "tsconfig-paths";        // line 28
import { readFileSync, promises as fs } from "fs";
const tsconfig = JSON.parse(...);                 // line 31
register({...});                                  // line 34
import path from "node:path";                     // line 39
import { runEvalHarness, ... } from "...";        // line 40
```
TypeScript/ESM hoist ALL imports before any non-import statements. So `runEvalHarness` is imported BEFORE `register()` runs. If `tsx` didn't natively handle `tsconfig.json` paths, the `@/` aliases inside the transitive imports would fail. The code works only because `tsx` resolves paths natively, making `register()` redundant. Either remove the `tsconfig-paths` machinery or move it into a side-effect-only pre-loaded file (e.g., `--require ./scripts/setup-paths.mjs`).

**Fix:** Delete the `tsconfig-paths` block (lines 28-37) since `tsx` already supports tsconfig paths. Or document the historical reason and convert to an `import` of a setup module that runs `register()` as a hoisted side effect.

## Info

### IN-01: Stale "Plan 07-03 owns the FULL integration" comment in `aggregator.ts:568-572`

**File:** `src/lib/engine/aggregator.ts:568-573`
**Issue:** Comment reads "Phase 7 (Plan 07-02a) — placeholder field assignments... Plan 07-03 owns the FULL integration: optional `behavioralSource` param, `signal_availability.personas` flag, real aggregator reads of personaBehavioralAggregate." But all three items ARE now implemented in this file. The comment misleads readers into looking for an "upcoming" change that already landed.

**Fix:** Replace with a stable comment documenting the final state, or delete it. E.g., "Phase 7 — persona_behavioral_aggregate surfaced from pipelineResult; persona_simulation_results carries per-persona detail for audience-viz consumers."

### IN-02: `--max-rows` flag not documented in CLI header

**File:** `scripts/run-persona-ab-eval.ts:16-19`
**Issue:** Header `Usage:` example only shows `--corpus-version` and `--max-cost-cents`. `--max-rows`, `--rate-limit-ms`, and `--engine-version-prefix` are parsed by `parseArgs` but undocumented. Users who don't read the source can't discover them.

**Fix:** Expand the usage block:
```
 * Usage:
 *   npx tsx scripts/run-persona-ab-eval.ts --corpus-version <version>
 *   Optional flags:
 *     --max-cost-cents <n>        Cost cap per run (default 5000 = $50)
 *     --max-rows <n>              Smoke subset row cap (default: full corpus)
 *     --rate-limit-ms <n>         Inter-row sleep (default 2000)
 *     --engine-version-prefix <s> Tag prefix for benchmark_results rows (default "3.0.0-dev")
```

### IN-03: `formatComparisonReport` "Recommendation for Phase 10" section is a hardcoded `[TO BE FILLED BY HUMAN REVIEW...]` placeholder

**File:** `scripts/run-persona-ab-eval.ts:120-122`
**Issue:** Every report generation writes a literal `[TO BE FILLED BY HUMAN REVIEW AFTER READING METRICS]` line. If the same script runs more than once on the same date (e.g., re-run after corpus version bump same day), the report file is overwritten and any human-added recommendation is lost. Compare to `*-VERIFICATION.md` artifacts elsewhere in `.planning/` which carry an explicit "draft" / "final" distinction.

**Fix:** Either (a) append a timestamp suffix to the filename (`persona-aggregate-ab-${date}-${HH}${MM}.md`) to make each run a distinct artifact, or (b) refuse to overwrite an existing file (`fs.writeFile` with `{ flag: "wx" }`).

### IN-04: `personaBehavioralAggregate` field on PipelineResult duplicates information also exposed via `wave3Result` (the orchestrator now returns both) — consider folding

**File:** `src/lib/engine/pipeline.ts:51-56`, `src/lib/engine/wave3.ts:60-65`
**Issue:** `Wave3Outcome` already carries `aggregate`, `results`, and `warnings`. `PipelineResult` then surfaces these as two separate top-level fields (`wave3Result: PersonaSimulationResult[]` and `personaBehavioralAggregate: PersonaBehavioralAggregate | null`) plus warnings spread into the pipeline-level `warnings: string[]`. Consumers reading both fields have to know they came from the same underlying result. Consider holding `wave3Outcome: Wave3Outcome` as one field for clarity, with the existing fields kept as getters for back-compat if needed.

**Fix:** Optional refactor — not a defect, but a coupling smell. Hold off if Phase 8/9 doesn't add new Wave 3 consumers.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
