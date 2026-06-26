# Phase 1: Engine / Pack Seam - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 8 (2 new, 6 modified)
**Analogs found:** 8 / 8 (every new/modified file has a strong in-repo analog — this is a pure indirection refactor, no greenfield logic)

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `src/lib/engine/domain-pack.ts` (or `DomainPack` block in `types.ts`) | NEW | interface/type def | request-response (contract) | `src/lib/engine/types.ts` (`PredictionResult`, `AnalysisInputSchema`) | exact (same module, same idioms) |
| `src/lib/engine/packs/socials.ts` (or `SOCIALS_PACK` const) | NEW | pack implementation | transform/wrapper | `aggregateScores` + `APOLLO_SYSTEM_PROMPT` consumers; const-object idiom (`SCORE_WEIGHTS`, `DEFAULT_PERSONA_WEIGHT_CONFIG`) | role-match |
| `src/lib/engine/aggregator.ts` | MOD (referenced, NOT refactored — D-07) | scoring wrapper target | transform | self (`aggregateScores` line 520) | exact — wrapped verbatim |
| `src/lib/engine/pipeline.ts` | MOD (indirect socials refs through pack) | core run path | request-response, input_mode-branched | self (`runPredictionPipeline` line 332) | exact |
| `src/app/api/analyze/route.ts` | MOD (2 call sites → pack dispatch) | route | request-response + SSE | self (lines 790/809, 1000/1027) | exact |
| `src/lib/engine/corpus/eval-runner.ts` | MOD (1 call site) | harness | batch | self (lines 123/127) | exact |
| `src/lib/engine/learning/predict.ts` | MOD (1 call site) | harness | batch | self (lines 70/71) | exact |
| `src/lib/engine/__tests__/pack-seam-smoke.test.ts` | NEW | smoke test | structural assertion | `__tests__/audience-regression-gate.test.ts` + `explore-runner.test.ts:300-319` | exact (blocking-gate idiom) + role-match (static-import check) |

## Pattern Assignments

### `src/lib/engine/domain-pack.ts` (interface/type def, contract)

**Analog:** `src/lib/engine/types.ts` — the engine's contract surface (1047 lines; holds `AnalysisInput`, `ContentPayload`, `PredictionResult`).

**Idiom to replicate — `interface` + `z.infer` types, not classes.** `types.ts` defines plain `export interface` for object contracts and `export const ...Schema = z.object(...)` + `export type X = z.infer<typeof Schema>` for validated boundaries. The `DomainPack` is a pure structural contract → plain `export interface DomainPack` (no zod, no class). Confirmed by research §"Alternatives Considered": plain typed object is idiomatic (cf. `SCORE_WEIGHTS`, `DEFAULT_PERSONA_WEIGHT_CONFIG`).

**Where it lands (Claude's discretion, D-05):** `types.ts` is already 1047 lines — a sibling `domain-pack.ts` that imports `PipelineResult` (pipeline.ts:55), `PredictionResult`/`AnalysisInput` (types.ts:300/199), and `AggregateScoresOptions` (aggregator.ts:497) keeps the contract co-located without ballooning `types.ts`. Either is defensible.

**7-field shape (D-05, all defined, Socials-only populated)** — recommended signature from RESEARCH §"DomainPack 7-Field Map", with the exact existing types each field references:
```typescript
export interface DomainPack {
  id: "socials";                       // domain axis key — orthogonal to input_mode
  populations: PopulationsSpec;        // → audience-types.ts Audience + wave3/persona-registry + flywheel/signature.ts
  grounding: GroundingSpec;            // → apollo-core.ts KNOWLEDGE_CORE/APOLLO_SYSTEM_PROMPT + creator-rulebook.ts
  stimulusTypes: readonly StimulusType[]; // → ["text","tiktok_url","video_upload"] (the input_mode enum, types.ts:157)
  reactionFrame: ReactionFrameSpec;    // → selectPersonaSlots + buildAudienceRepaint
  scoring: {                           // ← THE NEW SEAM (D-06)
    systemPrompt: string;              //   = APOLLO_SYSTEM_PROMPT (referenced, byte-unchanged)
    run(
      pipelineResult: PipelineResult,
      onStageEvent?: StageEventCallback,
      options?: AggregateScoresOptions, // { behavioralSource?, videoContext?, deferCounterfactuals? }
    ): Promise<PredictionResult>;       //   = aggregateScores, wrapped whole (D-07)
  };
  outputSchema: { /* PredictionResult shape descriptor */ }; // → types.ts:300
  calibration: CalibrationSpec;        // → calibration-baseline.json + flywheel/realized-signature.ts
}
```
The deferred-field placeholder specs (`PopulationsSpec`, `GroundingSpec`, `ReactionFrameSpec`, `CalibrationSpec`) are typed-but-thin this phase — they must be precise enough that `tsc --noEmit` proves `SOCIALS_PACK` satisfies the contract, but populated only for Socials (P3/P6 fill the others). Do not under-type them (D-05: avoid re-cutting the seam later).

---

### `src/lib/engine/packs/socials.ts` (pack implementation, wrapper)

**Analog:** the const-object idiom (`SCORE_WEIGHTS` in aggregator.ts, `DEFAULT_PERSONA_WEIGHT_CONFIG` in persona-weights.ts) + the wrap targets `aggregateScores` / `APOLLO_SYSTEM_PROMPT`.

**Core pattern — behavior-preserving scoring wrap (D-06/D-07).** The pack `scoring.run` IS `aggregateScores`, referenced not refactored. From RESEARCH §"Code Examples":
```typescript
import { aggregateScores } from "@/lib/engine/aggregator";
import { APOLLO_SYSTEM_PROMPT } from "@/lib/engine/apollo-core";

export const SOCIALS_PACK_SCORING: DomainPack["scoring"] = {
  systemPrompt: APOLLO_SYSTEM_PROMPT,   // referenced, unchanged (byte-stable DashScope cache prefix)
  run: aggregateScores,                 // the entire overall_score virality fold, opaque (D-07)
};
```

**`aggregateScores` signature to preserve VERBATIM** (aggregator.ts:520) — the wrap must not change arity or option shape (the 4 call sites depend on it):
```typescript
export async function aggregateScores(
  pipelineResult: PipelineResult,
  onStageEvent?: StageEventCallback,
  options?: AggregateScoresOptions,   // { behavioralSource?: "deepseek"|"fold"; videoContext?; deferCounterfactuals? } (line 497)
): Promise<PredictionResult>
```

**Anti-patterns (from RESEARCH §"Anti-Patterns" + §"Pitfall 4"):**
- Do NOT relocate `apollo-core.ts` / `deepseek.ts` / fold modules into `packs/` — reference by import. Moving files breaks ~20 importers and inflates the diff past D-08's "reviewable" bar. Warning sign: diff touches >15 files or churns engine import paths.
- Do NOT parameterize `aggregator.ts` into a domain-blind fold (D-07 forbids).
- Do NOT bump `ENGINE_VERSION` (stays `3.20.0` — see Shared Patterns).

**Cut Line A is RECOMMENDED (the #1 planner lock, RESEARCH §"The Wrap Boundary", Assumption A1):** `pack.scoring.run` = `aggregateScores` whole; Apollo + fold stay as pipeline simulation stages but read `pack.scoring.systemPrompt` / `pack.reactionFrame` instead of hardcoded imports. Cut Line B (swallowing Apollo+fold *execution* into `scoring`) is a much larger, D-08-hostile diff — confirm before adopting.

---

### `src/lib/engine/pipeline.ts` (core run path — indirect socials refs)

**Analog:** self. `runPredictionPipeline(input: AnalysisInput, opts?: PipelineOptions): Promise<PipelineResult>` (line 332).

**input_mode dispatch pattern the pack key MUST coexist with** (NOT replace — Claude's-discretion note + RESEARCH anti-pattern "Collapsing input_mode into the pack key"). The pipeline branches on `input_mode` as the STIMULUS axis:
```typescript
log.info("Pipeline started", { input_mode: input.input_mode });   // line 339
// ...
if (validated.input_mode === "video_upload" && validated.video_storage_path) { ... }  // line 415
if (validated.input_mode === "tiktok_url" && validated.tiktok_url) { ... }            // line 452
```
The pack key is the orthogonal DOMAIN axis. `input_mode` (the `z.enum(["text","tiktok_url","video_upload"])` discriminator, types.ts:157) stays exactly here. The pack's `stimulusTypes` field *describes* this enum; it does not move the branching.

**Socials-specific refs to indirect through the pack (Cut Line A):**
- `deepseek.ts:13,541` — `APOLLO_SYSTEM_PROMPT` import + use → read from `pack.scoring.systemPrompt`.
- `pipeline.ts:794` — `selectPersonaSlots(content_type, niche)` → `pack.reactionFrame`.
- `pipeline.ts:804` — `buildAudienceRepaint` → `pack.reactionFrame`.

**Security invariant — do NOT disturb the tiktok re-host token block (pipeline.ts:442-552)** when indirecting fold grounding refs (RESEARCH §"Security Domain").

---

### `src/app/api/analyze/route.ts` / `eval-runner.ts` / `learning/predict.ts` (4 call sites → pack dispatch)

**Analog:** self — all 4 sites do the identical two-call sequence today: `const pr = await runPredictionPipeline(...); const result = await aggregateScores(pr, ...);`.

**Seam dispatch pattern (after, from RESEARCH §"Code Examples"):**
```typescript
const pack = resolvePack("socials");                 // P1: always socials (domain axis)
const pipelineResult = await pack.run(validated, { requestId, bypassCache, userId, audience });
const result = await pack.scoring.run(pipelineResult, onStageEvent /* or undefined */, options);
```

**Per-site edits (RESEARCH §"Seam Cut Map"):**
| # | File | Lines | After |
|---|------|-------|-------|
| 1 | `route.ts` (JSON) | 790, 809 | `pack.run(...)` + `pack.scoring.run(pr, undefined)` |
| 2 | `route.ts` (SSE) | 1000, 1027 | `pack.scoring.run(pr, onStageEvent)` — preserve `aggregateMs` timing (keep two entrypoints, RESEARCH Open Q2) |
| 3 | `eval-runner.ts` | 123, 127 | `pack.scoring.run(pr, undefined, {behavioralSource})` |
| 4 | `learning/predict.ts` | 70, 71 | `pack.scoring.run(pr)` |

Also remove the now-dead direct `aggregateScores` imports: `route.ts:10`, `eval-runner.ts:5`, `learning/predict.ts:15`.

**Pitfall (RESEARCH §"Pitfall 1"):** edit ALL 4 sites. If only `route.ts` is migrated, eval-runner/learning still import `aggregateScores` directly → "no socials logic on core" violated for those entrypoints.

---

### `src/lib/engine/__tests__/pack-seam-smoke.test.ts` (smoke test — D-03 structural gate)

**Primary analog:** `src/lib/engine/__tests__/audience-regression-gate.test.ts` (the existing self-contained BLOCKING anchor).

**Blocking-gate structure to mirror:**
```typescript
import { describe, it, expect } from "vitest";
import { ENGINE_VERSION } from "../version";
// minimal fully-typed fixtures (the file inlines its own, e.g. generalAudience: Audience = {...})

describe("audience regression gate (AUD-03) — BLOCKING", () => {
  it("ENGINE_VERSION is exactly '3.20.0' ...", () => {
    expect(ENGINE_VERSION).toBe("3.20.0");
  });
  // ... assert contract invariants, not values
});
```
Header doc-comment names the requirement + states "The phase CANNOT pass with this red." Replicate that BLOCKING framing for PACK-01..04.

**Fixture source — do NOT hand-roll `PipelineResult` mocks (RESEARCH §"Don't Hand-Roll"):** use `src/lib/engine/__tests__/factories.ts` → `makePipelineResult(overrides?)` (line 260). Verify it covers both video and text/url `foldOutcome`/`personaBehavioralAggregate` shapes (RESEARCH Wave 0 gap).

**Secondary analog — static no-import check** for "core holds zero scoring logic" (PACK-01), mirror `explore-runner.test.ts:300-319`:
```typescript
const raw = fs.readFileSync(path.resolve(process.cwd(), "src/.../core-dispatcher.ts"), "utf8");
const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // strip comments first
expect(code).not.toMatch(/aggregateScores|ENGINE_VERSION/);
```
(Strip comments first so forbidden tokens named in prose don't trip the matcher.)

**What the D-03 smoke asserts (structural, NOT byte-identical — RESEARCH §"What the D-03 smoke asserts"):**
1. `pack.scoring.run(makePipelineResult())` returns without throwing (video + text variants).
2. Returned `PredictionResult` has all required keys present (`overall_score`, `confidence`, `confidence_label`, `behavioral_predictions`, `factors`, `signal_availability`, `engine_version`, `input_mode`, …) — assert KEYS not values.
3. `overall_score` is finite ∈ `[0, 100]` (the sane band).
4. `engine_version === "3.20.0"`.
5. The core dispatcher imports no `aggregateScores`/`apollo-core` directly (static regex above).

**Run command (CRITICAL — Pitfall 3):** `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0). After `npm install`, run:
```
node ./node_modules/vitest/vitest.mjs run src/lib/engine/__tests__/pack-seam-smoke.test.ts
```

## Shared Patterns

### ENGINE_VERSION pin (apply to: aggregator, pipeline, pack, smoke test)
**Source:** `src/lib/engine/version.ts` (`ENGINE_VERSION`); asserted by `audience-regression-gate.test.ts:48` and `version.test.ts`.
**Rule:** Keep `ENGINE_VERSION === "3.20.0"`. A behavior-preserving wrap must NOT bump it — the version is the `prediction_cache` invalidation key (`${contentHash}::${ENGINE_VERSION}::${userId}`, prediction-cache.ts:21) AND a blocking-test invariant. If a bump becomes "necessary," output drifted → the wrap was not behavior-preserving (RESEARCH Pitfall 2 / Assumption A4). The existing `audience-regression-gate.test.ts` + `version.test.ts` must stay green.

### Typed-object-not-class contract idiom (apply to: domain-pack.ts, socials pack)
**Source:** `types.ts` (`export interface`), aggregator.ts `SCORE_WEIGHTS`, persona-weights.ts `DEFAULT_PERSONA_WEIGHT_CONFIG`.
**Rule:** `DomainPack` = plain `export interface`; `SOCIALS_PACK` = plain `export const` typed `: DomainPack`. No class hierarchy / DI container (over-engineered for 1 pack; D-08 wants reviewable diff).

### Two-entrypoint dispatch (apply to: all 4 call sites)
**Source:** current route.ts two-call sequence (790/809).
**Rule:** Keep `pack.run` (= `runPredictionPipeline`) + `pack.scoring.run` (= `aggregateScores`) as TWO entrypoints, not one combined `pack.predict` — preserves the route's inter-call `aggregateMs` timing/logging (RESEARCH Open Q2). `input_mode` branching stays inside `pack.run`; pack key is the domain axis.

### Test runner + Wave 0 install (apply to: every test/tsc task)
**Source:** RESEARCH §"Environment Availability" + memory "Vitest rtk shim".
**Rule:** `node_modules` is ABSENT in this worktree — **Wave 0 MUST `npm install`** before any tsc/vitest task. Then always use `node ./node_modules/vitest/vitest.mjs run ...`; never trust `npm test`/`npx vitest` (fake PASS(0)).

## No Analog Found

None. Every new/modified file maps to an existing in-repo pattern — this phase is indirection + interface definition over existing, tested modules, not new logic (RESEARCH §"Don't Hand-Roll" key insight).

## Metadata

**Analog search scope:** `src/lib/engine/` (types, aggregator, pipeline, version, factories, __tests__), `src/app/api/analyze/`, `src/lib/engine/corpus/`, `src/lib/engine/learning/`, `src/lib/tools/runners/` (static-import-check analog).
**Files scanned:** ~12 (4 read in full/targeted: audience-regression-gate.test.ts, factories.ts excerpt, types.ts excerpts, explore-runner.test.ts excerpt; signatures grepped across aggregator/pipeline/version).
**Pattern extraction date:** 2026-06-26
</content>
</invoke>
