---
phase: "07"
plan: "02a"
type: execute
wave: 2
depends_on: ["07-01"]
files_modified:
  - src/lib/engine/types.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/aggregator.ts
  - src/lib/engine/__tests__/factories.ts
  - src/lib/engine/wave3/aggregator.ts
  - src/lib/engine/__tests__/wave3-aggregator.test.ts
autonomous: true
requirements:
  - PERSONA-08
  - PERSONA-09
  - PERSONA-11
  - PIPE-08

must_haves:
  truths:
    - "`PipelineResult` carries a new `personaBehavioralAggregate: PersonaBehavioralAggregate | null` field"
    - "`PredictionResult` carries new `persona_behavioral_aggregate` and `persona_simulation_results` fields (additive — D-20)"
    - "`makePipelineResult` factory default sets `personaBehavioralAggregate: null` (Plan 07-02b orchestrator + Plan 07-03 aggregator integration depend on this)"
    - "`aggregatePersonaResults(survivors, threshold=7)` is a PURE function returning `{ aggregate, warnings }` — `completion_pct` is mean; `share/comment/save_pct` are top-3-enthusiast-weighted (60/40 split); ties break by `ARCHETYPES.indexOf(archetype)` ASC"
    - "`<7` survivors → `aggregate: null` + warning `wave_3_below_threshold (N/7)` (D-13)"
    - "Pitfall 4 defensive path: when `remaining.length === 0` (n ≤ TOP_N), return `topMean` directly (no 60% shrinkage)"
  artifacts:
    - path: src/lib/engine/types.ts
      provides: "PredictionResult widened with persona_behavioral_aggregate + persona_simulation_results fields (D-20)"
      contains: "persona_behavioral_aggregate"
    - path: src/lib/engine/pipeline.ts
      provides: "PipelineResult widened with personaBehavioralAggregate field; PersonaBehavioralAggregate imported from ./types"
      contains: "personaBehavioralAggregate"
    - path: src/lib/engine/__tests__/factories.ts
      provides: "makePipelineResult factory default `personaBehavioralAggregate: null` — preserves existing test callers"
    - path: src/lib/engine/aggregator.ts
      provides: "Placeholder PredictionResult field assignments — persona_behavioral_aggregate + persona_simulation_results — full integration in Plan 07-03"
    - path: src/lib/engine/wave3/aggregator.ts
      provides: "aggregatePersonaResults(survivors, threshold) — per-metric different rule (mean for completion; top-3-weighted 60/40 for share/comment/save) + tie-break + ≥7 threshold check"
      exports: ["aggregatePersonaResults", "AggregationResult", "TOP_N", "TOP_WEIGHT_TOTAL", "REMAINING_WEIGHT_TOTAL"]
    - path: src/lib/engine/__tests__/wave3-aggregator.test.ts
      provides: "Pure-math tests — per-metric different rule, tie-break stability, threshold edge cases (n=7, n=6, n=0), Pitfall 4 defensive remaining=0 path"
  key_links:
    - from: src/lib/engine/wave3/aggregator.ts
      to: src/lib/engine/wave3/persona-registry.ts
      via: "imports ARCHETYPES for deterministic top-3 tie-break"
      pattern: "ARCHETYPES.indexOf"
    - from: src/lib/engine/wave3/aggregator.ts
      to: src/lib/engine/types.ts
      via: "consumes PersonaSimulationResult + produces PersonaBehavioralAggregate (both from Plan 07-01)"
      pattern: "PersonaBehavioralAggregate"
    - from: src/lib/engine/pipeline.ts
      to: src/lib/engine/types.ts
      via: "imports PersonaBehavioralAggregate for PipelineResult typing"
      pattern: "PersonaBehavioralAggregate"
---

<objective>
Phase 7 foundation: widen the type system (PredictionResult + PipelineResult), update the test factory, ship the pure-math aggregator helper (`wave3/aggregator.ts`), and add placeholder PredictionResult field assignments to `aggregator.ts` so the widened type compiles. This plan is intentionally SCOPED narrow — no `wave3.ts` rewrite, no full `aggregator.ts` integration (signal_availability.personas + behavioralSource swap), no orchestration tests. Those live in Plan 07-02b (Wave 3) and Plan 07-03 (Wave 4).

Purpose (B-4 split rationale): the original 07-02 plan touched 9-10 files and bundled the full `wave3.ts` rewrite (~280 LOC) with `wave3.test.ts` (~300 LOC). At >100K-token execution cost it risked context degradation mid-task. Splitting at the type/aggregator boundary gives the orchestrator (07-02b) a clean foundation: the types exist, the factories produce correct defaults, and the aggregator helper passes unit tests independently.

Output: 6 files touched. Pure additive type widening + one new pure-function module + one new test file + additive placeholder field assignments to `aggregator.ts` (legacy `behavioral_predictions` consumer untouched; full integration with `signal_availability.personas` + optional `behavioralSource` param lands in Plan 07-03). Zero changes to `wave3.ts`, `wave0.ts`, `wave0/*`, `deepseek.ts`, `taxonomy.ts`, route handlers.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-multi-persona-simulation/07-CONTEXT.md
@.planning/phases/07-multi-persona-simulation/07-RESEARCH.md
@.planning/phases/07-multi-persona-simulation/07-PATTERNS.md
@.planning/phases/07-multi-persona-simulation/07-VALIDATION.md
@.planning/phases/07-multi-persona-simulation/07-01-PLAN.md
@src/lib/engine/types.ts
@src/lib/engine/pipeline.ts
@src/lib/engine/wave0/content-type-weights.ts
@src/lib/engine/aggregator.ts
@src/lib/engine/__tests__/factories.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From Plan 07-01 output (src/lib/engine/types.ts):
```typescript
export const PersonaArchetypeSchema = z.enum([
  "high_engager", "saver", "lurker", "sharer", "tough_crowd", "purposeful_viewer",
  "niche_deep_buyer", "niche_deep_scout", "loyalist", "cross_niche_curiosity",
] as const);
export type PersonaArchetype = z.infer<typeof PersonaArchetypeSchema>;
export const PersonaSlotTypeSchema = z.enum(["fyp", "niche_deep", "loyalist", "cross_niche"] as const);
export type PersonaSlotType = z.infer<typeof PersonaSlotTypeSchema>;
export const PersonaSimulationResultSchema = z.object({ /* ... */ });
export type PersonaSimulationResult = z.infer<typeof PersonaSimulationResultSchema>;
export type PersonaBehavioralAggregate = BehavioralPredictions;
// SignalAvailability already widened with `personas: boolean` in Plan 07-01
```

From Plan 07-01 output (src/lib/engine/wave3/persona-registry.ts):
```typescript
export const ARCHETYPES = [/* 10 entries in canonical tie-break order */] as const;
export type Archetype = (typeof ARCHETYPES)[number];
```

From src/lib/engine/pipeline.ts (CURRENT lines 40-59 — to widen):
```typescript
export interface PipelineResult {
  // ... existing fields ...
  wave0Result: Wave0Result;
  wave3Result: PersonaSimulationResult[];
  // ↑ Phase 7 adds personaBehavioralAggregate here
  requestId: string;
  // ... rest ...
}
```

From src/lib/engine/types.ts (CURRENT lines 142-187 — to widen):
```typescript
export interface PredictionResult {
  // ... existing fields ...
  signal_availability: SignalAvailability;
  // ↑ Phase 7 adds persona_behavioral_aggregate + persona_simulation_results here
}
```

From src/lib/engine/__tests__/factories.ts (lines 250-271 — makePipelineResult factory):
```typescript
return {
  // ... existing fields ...
  wave0Result: { content_type: null, niche: null },
  wave3Result: [],
  // ↑ Phase 7 adds personaBehavioralAggregate: null here
  requestId: "test-req-123",
  // ... rest ...
};
```

From src/lib/engine/aggregator.ts (line 519-540 — PredictionResult assembly; Plan 07-03 owns the FULL integration, but this plan needs placeholder field initializers so the type compiles after PredictionResult is widened):
```typescript
const result: PredictionResult = {
  // ... existing fields ...
};
// Plan 07-02a adds:
//   persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null,
//   persona_simulation_results: pipelineResult.wave3Result,
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Widen PredictionResult + PipelineResult + factory; add aggregator.ts placeholder field assignments</name>
  <files>src/lib/engine/types.ts, src/lib/engine/pipeline.ts, src/lib/engine/aggregator.ts, src/lib/engine/__tests__/factories.ts</files>
  <read_first>
    - src/lib/engine/types.ts (lines 142-187 PredictionResult; Plan 07-01 widening at ~210-260 — PersonaArchetypeSchema, PersonaSlotTypeSchema, PersonaSimulationResultSchema, PersonaBehavioralAggregate alias; SignalAvailability at 198-207 already widened with `personas`)
    - src/lib/engine/pipeline.ts (lines 40-59 PipelineResult; lines 1-20 imports block — locate the existing `import type { ... } from "./types"` line to extend)
    - src/lib/engine/aggregator.ts (lines 519-540 — PredictionResult assembly block; the `const result: PredictionResult = { ... };` literal where the new fields need stub assignments)
    - src/lib/engine/__tests__/factories.ts (lines 230-271 — makePipelineResult factory; line 259 wave3Result: [] default)
    - .planning/phases/07-multi-persona-simulation/07-CONTEXT.md (D-09 persona_simulation_results; D-15 SignalAvailability.personas; D-20 PredictionResult additions)
    - .planning/phases/07-multi-persona-simulation/07-PATTERNS.md (lines 487-541 pipeline.ts widening pattern; lines 759-789 factories extension; Pitfall 9 explicit)
  </read_first>
  <behavior>
    - Test 1 (compile-only): `pnpm tsc --noEmit` exits 0 after all type widenings — no callers of `aggregateScores`, `runPredictionPipeline`, `makePipelineResult` broken.
    - Test 2 (factory default): `makePipelineResult()` returns object with `personaBehavioralAggregate === null` and `wave3Result === []`.
    - Test 3 (aggregator type-compiles): With the placeholder field assignments in aggregator.ts, the existing aggregator tests still pass (the assembly compiles against the widened PredictionResult).
  </behavior>
  <action>
**Step A: Widen `src/lib/engine/types.ts` PredictionResult.** Locate the existing `export interface PredictionResult { ... }` block (lines 142-187). After the existing `signal_availability: SignalAvailability;` line (line 186 — the last field), insert TWO new fields per D-20 + D-09 + Pitfall 9:

```typescript
  /** Phase 7 (D-20) — null when Wave 3 below threshold (D-13). */
  persona_behavioral_aggregate: PersonaBehavioralAggregate | null;
  /** Phase 7 (D-09) — per-persona detail for M2 audience-viz. Empty array on fallback. */
  persona_simulation_results: PersonaSimulationResult[];
```

`PersonaBehavioralAggregate` and `PersonaSimulationResult` types are exported from the same `types.ts` file (Plan 07-01 added them at the ~210-260 block) — no import needed; they resolve in-module.

**Step B: Widen `src/lib/engine/pipeline.ts` PipelineResult.** Edit the existing `export interface PipelineResult { ... }` block (lines 40-59).

**B.1 — Import.** Locate the existing `import type { ... } from "./types"` line near the top (lines 1-20 area). Extend it to include `PersonaBehavioralAggregate`:
```typescript
import type {
  // ...existing imports...
  PersonaBehavioralAggregate,
} from "./types";
```

**B.2 — Field addition.** After the existing `wave3Result: PersonaSimulationResult[];` line (line 52), insert:
```typescript
  /** Phase 7 (Pitfall 9) — aggregator reads this to set signal_availability.personas in Plan 07-03. */
  personaBehavioralAggregate: PersonaBehavioralAggregate | null;
```

**Step C: Extend `src/lib/engine/__tests__/factories.ts` makePipelineResult.** Locate the existing factory at lines 230-271. After the existing `wave3Result: [],` line (line 259), insert:

```typescript
    // NEW Phase 7 (Pitfall 9, A11) — default null preserves "no aggregate" semantics
    // for all existing aggregator.test.ts and pipeline.test.ts callers.
    personaBehavioralAggregate: null,
```

**Step D: Extend `src/lib/engine/aggregator.ts` PredictionResult assembly** with placeholder field assignments so the widened `PredictionResult` type compiles. Locate the `const result: PredictionResult = { ... }` block (lines 519-540). After the existing fields and before the closing `};`, add:

```typescript
    persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null,
    persona_simulation_results: pipelineResult.wave3Result,
```

NOTE: These are PLACEHOLDER assignments. The full integration (optional `behavioralSource` param, `signal_availability.personas` flag, real aggregator reads of persona aggregate) lands in Plan 07-03. This task only surfaces the type-level fields so subsequent plans can compile.

Verify the build:
```bash
pnpm tsc --noEmit
```

Should exit 0 with no new errors. Any caller of `aggregateScores(pipelineResult)` or downstream consumers of `PredictionResult` continue to compile because the new fields are additive (TS structural typing doesn't reject extra fields on object literals).
  </action>
  <verify>
    <automated>pnpm tsc --noEmit 2>&1 | grep -i "error" | head -10 || echo "TSC CLEAN" ; pnpm vitest run src/lib/engine/__tests__/factories 2>&1 | tail -10 ; pnpm vitest run src/lib/engine/__tests__/aggregator 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/engine/types.ts` PredictionResult contains exact line `persona_behavioral_aggregate: PersonaBehavioralAggregate | null;` (grep matches once)
    - `src/lib/engine/types.ts` PredictionResult contains exact line `persona_simulation_results: PersonaSimulationResult[];` (grep matches once)
    - `src/lib/engine/pipeline.ts` PipelineResult contains exact line `personaBehavioralAggregate: PersonaBehavioralAggregate | null;` (grep matches once)
    - `src/lib/engine/pipeline.ts` imports `PersonaBehavioralAggregate` from `./types`: `grep -c "PersonaBehavioralAggregate" src/lib/engine/pipeline.ts` returns ≥ 2 (import + field type)
    - `src/lib/engine/__tests__/factories.ts` contains line `personaBehavioralAggregate: null,` (grep matches once)
    - `src/lib/engine/aggregator.ts` PredictionResult assembly contains both lines `persona_behavioral_aggregate:` AND `persona_simulation_results:` (grep each matches once)
    - `pnpm tsc --noEmit` shows no new errors beyond pre-existing baseline
    - Existing aggregator.test.ts + factories tests continue to pass
    - `git diff --name-only src/lib/engine/wave3.ts src/lib/engine/wave0.ts src/lib/engine/deepseek.ts src/lib/niches/taxonomy.ts` returns empty (those files untouched in 07-02a)
  </acceptance_criteria>
  <done>PredictionResult + PipelineResult widened additively; makePipelineResult factory produces correct default; aggregator.ts has placeholder field assignments. Type compilation clean. Plan 07-02b (orchestrator) and Plan 07-03 (full aggregator integration) can now build on this foundation.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create wave3/aggregator.ts — per-metric different rule + ≥7 threshold + top-3 tie-break + pure-math tests</name>
  <files>src/lib/engine/wave3/aggregator.ts, src/lib/engine/__tests__/wave3-aggregator.test.ts</files>
  <read_first>
    - src/lib/engine/wave0/content-type-weights.ts (lines 38-55 — pure-function shape, null-input fallback, returns new object)
    - src/lib/engine/aggregator.ts (lines 354-368 — flat-mean reduction idiom, the `sum / count` pattern Phase 7 mirrors for completion_pct)
    - .planning/phases/07-multi-persona-simulation/07-RESEARCH.md (lines 965-1064 — Pattern 4 full aggregator source: TOP_N, TOP_WEIGHT_TOTAL, aggregatePersonaResults() body, topNWeighted() helper, tie-break via ARCHETYPES.indexOf)
    - .planning/phases/07-multi-persona-simulation/07-CONTEXT.md (D-06 per-metric rule verbatim; D-13 threshold; Claude's Discretion notes on surviving-subset math + tie-break)
    - .planning/phases/07-multi-persona-simulation/07-PATTERNS.md (lines 316-400 — aggregator analog patterns; Pitfall 4 defensive remaining=0 path; lines 388-393 explicit edge-case handling)
    - src/lib/engine/wave3/persona-registry.ts (Plan 07-01 output — read ARCHETYPES tuple order for tie-break determinism)
    - src/lib/engine/__tests__/content-type-weights.test.ts (pure-fn test shape mirror — read full file)
    - src/lib/engine/types.ts (post-Task-1 + Plan 07-01 widening — PersonaSimulationResult + PersonaBehavioralAggregate)
  </read_first>
  <behavior>
    - Test 1 (D-13 happy path n=10): All 10 survivors with `watch_through_pct: 50` → `aggregate.completion_pct === 50`. `warnings === []`.
    - Test 2 (D-13 threshold met n=7): 7 survivors → aggregate non-null + no `wave_3_below_threshold` warning.
    - Test 3 (D-13 threshold not met n=6): 6 survivors → `aggregate === null` + warnings array contains string starting with `"wave_3_below_threshold (6/7)"`.
    - Test 4 (D-13 zero survivors): 0 survivors → `aggregate === null` + warnings contains `"wave_3_below_threshold (0/7)"`.
    - Test 5 (D-06 completion_pct = mean): survivors with watch_through_pct `[100, 90, 80, 70, 60, 50, 40, 30, 20, 10]` → `aggregate.completion_pct === 55`.
    - Test 6 (D-06 share_pct top-3-weighted): survivors with 3 personas at `share_intent: 90` + 7 at `share_intent: 10`. Top-3 mean = 90, remaining mean = 10. Weighted = 0.60 * 90 + 0.40 * 10 = 58. Assert `aggregate.share_pct === 58` (allow 0.5 epsilon tolerance).
    - Test 7 (D-06 contrast with flat mean): same input as Test 6 — assert the value is NOT 34 (the flat mean of all 10), proving top-3 weighting is active.
    - Test 8 (D-06 tie-break by archetype enum order): create 10 survivors all with `share_intent: 50`. Then call `aggregatePersonaResults` twice — verify determinism (call aggregator twice with identical survivors → identical aggregate values).
    - Test 9 (Pitfall 4 remaining=0 defensive path): with successThreshold lowered to 3, and 3 survivors with `share_intent: 80` → `share_pct === 80` (NOT 48 = 0.60 * 80). Documents the `remaining.length === 0 → return topMean` branch.
    - Test 10 (D-06 comment_pct and save_pct apply same top-3 rule): Test the comment_intent and save_intent metrics with the same Test-6 input pattern; assert both produce 58.
    - Test 11 (constants invariant): `TOP_WEIGHT_TOTAL + REMAINING_WEIGHT_TOTAL` equals 1.0.
  </behavior>
  <action>
**(1) Create `src/lib/engine/wave3/aggregator.ts`** as a pure-function helper module. Mirror `wave0/content-type-weights.ts` for the pure-function-no-side-effects pattern; mirror `aggregator.ts:354-368` for the mean reduction idiom.

```typescript
import { ARCHETYPES } from "./persona-registry";
import type { PersonaSimulationResult, PersonaBehavioralAggregate } from "../types";

/**
 * Phase 7 D-06: per-metric DIFFERENT aggregation rule.
 *   - completion_pct = mean of survivors' watch_through_pct (population rate)
 *   - share_pct / comment_pct / save_pct = top-3-enthusiast-weighted
 *     (top-3 most enthusiastic personas count 60% of weight; remaining 7 split 40%)
 *
 * Phase 7 D-13: ≥7 of 10 personas must succeed; below threshold → null + warning.
 * Top-3 tie-break: stable sort by metric DESC then by ARCHETYPES enum order ASC (deterministic).
 */
const TOP_N = 3;
const TOP_WEIGHT_TOTAL = 0.60;
const REMAINING_WEIGHT_TOTAL = 0.40;

export { TOP_N, TOP_WEIGHT_TOTAL, REMAINING_WEIGHT_TOTAL };

export interface AggregationResult {
  aggregate: PersonaBehavioralAggregate | null;
  warnings: string[];
}

/**
 * Per CONTEXT D-13 + D-06: aggregate surviving persona results into a
 * BehavioralPredictions-shaped object, OR return null + warning if below threshold.
 *
 * @param survivors - successful PersonaSimulationResult entries (out of 10 attempts)
 * @param successThreshold - minimum surviving count for non-null aggregate (default 7 per D-13)
 */
export function aggregatePersonaResults(
  survivors: PersonaSimulationResult[],
  successThreshold: number = 7,
): AggregationResult {
  if (survivors.length < successThreshold) {
    return {
      aggregate: null,
      warnings: [`wave_3_below_threshold (${survivors.length}/${successThreshold})`],
    };
  }

  // D-06 completion_pct = flat mean of watch_through_pct
  const completion_pct = mean(survivors.map((s) => s.watch_through_pct));

  // D-06 share/comment/save = top-3-enthusiast-weighted
  const share_pct = topNWeighted(survivors, "share_intent");
  const comment_pct = topNWeighted(survivors, "comment_intent");
  const save_pct = topNWeighted(survivors, "save_intent");

  // Percentile labels: lightweight decile heuristic for Phase 7 ship.
  // Plan 07-04's runEvalHarness consumer doesn't read percentile labels — only the numeric metrics.
  // Phase 10 may revise to corpus-driven percentile bands.
  const aggregate: PersonaBehavioralAggregate = {
    completion_pct,
    completion_percentile: percentileLabel(completion_pct),
    share_pct,
    share_percentile: percentileLabel(share_pct),
    comment_pct,
    comment_percentile: percentileLabel(comment_pct),
    save_pct,
    save_percentile: percentileLabel(save_pct),
  };

  return { aggregate, warnings: [] };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function topNWeighted(
  survivors: PersonaSimulationResult[],
  metric: "share_intent" | "comment_intent" | "save_intent",
): number {
  const n = survivors.length;
  if (n === 0) return 0;

  // Stable sort: metric DESC; tie-break by ARCHETYPES enum index ASC.
  // ARCHETYPES order (Plan 07-01): high_engager, saver, lurker, sharer,
  // tough_crowd, purposeful_viewer, niche_deep_buyer, niche_deep_scout,
  // loyalist, cross_niche_curiosity.
  const sorted = [...survivors].sort((a, b) => {
    const diff = b[metric] - a[metric];
    if (diff !== 0) return diff;
    return ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype);
  });

  const topN = Math.min(TOP_N, n);
  const top = sorted.slice(0, topN);
  const remaining = sorted.slice(topN);

  const topMean = mean(top.map((s) => s[metric]));

  // Pitfall 4: when no remaining personas exist (n ≤ TOP_N),
  // return topMean directly — NEVER topMean * 0.60 (silent shrinkage).
  if (remaining.length === 0) return topMean;

  const remainingMean = mean(remaining.map((s) => s[metric]));
  return TOP_WEIGHT_TOTAL * topMean + REMAINING_WEIGHT_TOTAL * remainingMean;
}

function percentileLabel(pct: number): string {
  if (pct >= 90) return "top 10%";
  if (pct >= 75) return "top 25%";
  if (pct >= 50) return "top 50%";
  if (pct >= 25) return "top 75%";
  return "bottom 25%";
}
```

**(2) Create `src/lib/engine/__tests__/wave3-aggregator.test.ts`** — pure-function unit tests; no LLM client mocks needed.

```typescript
import { describe, it, expect } from "vitest";
import { aggregatePersonaResults, TOP_WEIGHT_TOTAL, REMAINING_WEIGHT_TOTAL } from "../wave3/aggregator";
import type { PersonaSimulationResult } from "../types";
import type { Archetype } from "../wave3/persona-registry";

function makePersona(overrides: Partial<PersonaSimulationResult> = {}): PersonaSimulationResult {
  return {
    persona_id: "fyp-saver-beauty",
    archetype: "saver",
    slot_type: "fyp",
    niche: "beauty",
    scroll_past_second: 5,
    watch_through_pct: 50,
    comment_intent: 50,
    share_intent: 50,
    save_intent: 50,
    reasoning: "default test reasoning",
    ...overrides,
  };
}

function makeSurvivors(count: number, override: (i: number) => Partial<PersonaSimulationResult> = () => ({})): PersonaSimulationResult[] {
  const archetypes: Archetype[] = [
    "high_engager", "saver", "lurker", "sharer", "tough_crowd",
    "purposeful_viewer", "niche_deep_buyer", "niche_deep_scout",
    "loyalist", "cross_niche_curiosity",
  ];
  return Array.from({ length: count }, (_, i) =>
    makePersona({ persona_id: `p${i}`, archetype: archetypes[i % archetypes.length], ...override(i) }),
  );
}

describe("aggregatePersonaResults (Phase 7 D-06 + D-13)", () => {
  it("Test 1: 10 survivors all watch_through_pct=50 → completion_pct=50, no warnings", () => {
    const result = aggregatePersonaResults(makeSurvivors(10));
    expect(result.aggregate).not.toBeNull();
    expect(result.aggregate!.completion_pct).toBe(50);
    expect(result.warnings).toEqual([]);
  });

  it("Test 2: D-13 threshold met at n=7 → aggregate non-null", () => {
    const result = aggregatePersonaResults(makeSurvivors(7));
    expect(result.aggregate).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("Test 3: D-13 threshold NOT met at n=6 → aggregate null + warning", () => {
    const result = aggregatePersonaResults(makeSurvivors(6));
    expect(result.aggregate).toBeNull();
    expect(result.warnings[0]).toMatch(/^wave_3_below_threshold \(6\/7\)/);
  });

  it("Test 4: D-13 zero survivors → aggregate null + warning", () => {
    const result = aggregatePersonaResults([]);
    expect(result.aggregate).toBeNull();
    expect(result.warnings[0]).toMatch(/^wave_3_below_threshold \(0\/7\)/);
  });

  it("Test 5: D-06 completion_pct = flat mean of watch_through_pct", () => {
    const watches = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
    const survivors = makeSurvivors(10, (i) => ({ watch_through_pct: watches[i]! }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.completion_pct).toBe(55);
  });

  it("Test 6: D-06 share_pct top-3-weighted (3 enthusiasts at 90, 7 lukewarm at 10) → 58", () => {
    const survivors = makeSurvivors(10, (i) => ({ share_intent: i < 3 ? 90 : 10 }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.share_pct).toBeCloseTo(58, 1);
  });

  it("Test 7: D-06 contrast — top-3 weighting is NOT flat mean", () => {
    const survivors = makeSurvivors(10, (i) => ({ share_intent: i < 3 ? 90 : 10 }));
    const result = aggregatePersonaResults(survivors);
    // flat mean would be (90*3 + 10*7)/10 = 34. Top-3-weighted is 58.
    expect(result.aggregate!.share_pct).not.toBeCloseTo(34, 1);
  });

  it("Test 8: D-06 tie-break — all 10 personas share_intent=50 → deterministic across runs", () => {
    const survivors = makeSurvivors(10, () => ({ share_intent: 50 }));
    const a = aggregatePersonaResults(survivors);
    const b = aggregatePersonaResults(survivors);
    expect(a.aggregate!.share_pct).toBe(b.aggregate!.share_pct);
  });

  it("Test 9: Pitfall 4 — n=3 with threshold=3 → topMean returned directly (no 60% shrinkage)", () => {
    const survivors = makeSurvivors(3, () => ({ share_intent: 80 }));
    const result = aggregatePersonaResults(survivors, 3);
    // remaining.length === 0 path → topMean (80) NOT 0.60 * 80 = 48
    expect(result.aggregate!.share_pct).toBe(80);
  });

  it("Test 10: D-06 comment_pct + save_pct apply same top-3-weighted rule", () => {
    const survivors = makeSurvivors(10, (i) => ({
      comment_intent: i < 3 ? 90 : 10,
      save_intent: i < 3 ? 90 : 10,
    }));
    const result = aggregatePersonaResults(survivors);
    expect(result.aggregate!.comment_pct).toBeCloseTo(58, 1);
    expect(result.aggregate!.save_pct).toBeCloseTo(58, 1);
  });

  it("Test 11: constants — TOP_WEIGHT_TOTAL + REMAINING_WEIGHT_TOTAL sum to 1.0", () => {
    expect(TOP_WEIGHT_TOTAL + REMAINING_WEIGHT_TOTAL).toBeCloseTo(1.0, 6);
  });
});
```
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/engine/__tests__/wave3-aggregator.test.ts --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/engine/wave3/aggregator.ts` exists
    - File contains exact string `export function aggregatePersonaResults(`
    - File contains exact string `successThreshold: number = 7`
    - File contains exact string `TOP_WEIGHT_TOTAL = 0.60`
    - File contains exact string `REMAINING_WEIGHT_TOTAL = 0.40`
    - File contains exact string `wave_3_below_threshold (${survivors.length}/${successThreshold})`
    - File contains exact string `ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype)`
    - File contains exact string `if (remaining.length === 0) return topMean;` (Pitfall 4 defensive path)
    - File contains exact string `const completion_pct = mean(survivors.map((s) => s.watch_through_pct));`
    - `src/lib/engine/__tests__/wave3-aggregator.test.ts` exists with 11+ test cases
    - `pnpm vitest run src/lib/engine/__tests__/wave3-aggregator.test.ts` exits with code 0; reports ≥ 11 passed tests
  </acceptance_criteria>
  <done>wave3/aggregator.ts exports a pure aggregatePersonaResults helper with correct per-metric rule, ≥7 threshold, top-3 tie-break by ARCHETYPES enum order, and Pitfall 4 defensive path. All 11+ tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Persona survivors (≥7) → aggregate computation | Threshold-gated; null + warning emitted below threshold |
| Pure-function aggregator | No side effects; deterministic for identical inputs (Test 8) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-02a-01 | Tampering | aggregatePersonaResults non-determinism (sort ties) | mitigate | ARCHETYPES.indexOf tie-break + Array.sort stability guarantee + Test 8 assertion |
| T-07-02a-02 | Tampering | Pitfall 4 silent shrinkage (remaining=0 → topMean × 0.60) | mitigate | Explicit `if (remaining.length === 0) return topMean;` guard + Test 9 assertion |
| T-07-02a-03 | Information Disclosure | persona_simulation_results on PredictionResult | accept | Field shape exposed via type widening only; persistence semantics unchanged (analysis_results RLS inherited from Phase 1-4) |
</threat_model>

<verification>
- Both tasks complete with `<automated>` commands exiting 0
- `pnpm vitest run src/lib/engine/__tests__/wave3-aggregator.test.ts src/lib/engine/__tests__/factories src/lib/engine/__tests__/aggregator` exits 0
- `pnpm tsc --noEmit` shows no new errors
- `git diff --name-only` shows exactly these 6 files: `src/lib/engine/types.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/lib/engine/__tests__/factories.ts`, `src/lib/engine/wave3/aggregator.ts`, `src/lib/engine/__tests__/wave3-aggregator.test.ts`
</verification>

<success_criteria>
- PipelineResult + PredictionResult widened additively (PIPE-08 type substrate ✓ + D-09/D-15/D-20 ✓)
- aggregator.ts placeholder field assignments compile (Plan 07-03 finalizes the integration)
- factories.ts default produces correct `personaBehavioralAggregate: null` for existing test callers
- `aggregatePersonaResults` exports a pure function passing 11+ unit tests covering per-metric rule (D-06), threshold (D-13), tie-break determinism, and Pitfall 4 defensive path
- Plan 07-02b (orchestrator) and Plan 07-03 (full aggregator integration) have a buildable foundation
</success_criteria>

<output>
After completion, create `.planning/phases/07-multi-persona-simulation/07-02a-SUMMARY.md` capturing:
- 5-file diff summary
- 11+ aggregator unit tests pass count
- Plan 07-02b dependency confirmation: `import { aggregatePersonaResults } from "./wave3/aggregator"` resolves; PipelineResult has `personaBehavioralAggregate`; factories default correct
</output>
