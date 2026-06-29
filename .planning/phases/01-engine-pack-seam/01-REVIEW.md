---
phase: 01-engine-pack-seam
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/engine/domain-pack.ts
  - src/lib/engine/packs/socials.ts
  - src/lib/engine/packs/index.ts
  - src/app/api/analyze/route.ts
  - src/lib/engine/corpus/eval-runner.ts
  - src/lib/engine/learning/predict.ts
  - src/lib/engine/__tests__/domain-pack.contract.test.ts
  - src/lib/engine/__tests__/pack-seam-smoke.test.ts
  - src/lib/engine/__tests__/packs-index.test.ts
  - src/lib/engine/__tests__/socials-pack.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-26
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The phase extracts the socials-specific scoring/orchestration behind a typed `DomainPack` seam and rewires 4 call sites from the direct `runPredictionPipeline(...)` + `aggregateScores(...)` sequence to `pack.run(...)` + `pack.scoring.run(...)`. Reviewed against the KEY INVARIANT: behaviour must be unchanged.

**The rewiring is faithful.** Verified directly:

- **Arguments preserved byte-for-byte** at all 4 sites. `git diff b64829c3..HEAD` shows only the callee identifier changed; every argument list (`validated` + opts object; `pipelineResult, undefined`; `pipelineResult, onStageEvent`; `pipelineResult, undefined, behavioralSource?`) is identical to the pre-cut code.
- **Signatures match verbatim.** `DomainPack.run(input: AnalysisInput, opts?: PipelineOptions): Promise<PipelineResult>` mirrors `runPredictionPipeline` (pipeline.ts:332). `DomainPackScoring.run(pipelineResult, onStageEvent?, options?)` mirrors `aggregateScores` (aggregator.ts:520).
- **No `this`-binding hazard.** Converting a free-function call to a method call (`pack.run(...)`) changes the `this` receiver — but both `runPredictionPipeline` and `aggregateScores` are module-level functions with zero `this` references (every `this` token in both bodies is inside comments/strings). Behaviour is identical whether invoked free or as a method.
- **No orphaned imports.** route.ts / eval-runner.ts / predict.ts drop the `runPredictionPipeline` + `aggregateScores` imports and add `resolvePack`. The only remaining `runPredictionPipeline`/`aggregateScores` tokens in those files are in comments.
- **Version invariant holds.** `ENGINE_VERSION = "3.20.0"` (version.ts), re-exported by aggregator.ts:66. The smoke test pulls it from `../version`; eval-runner/predict pull it from `../aggregator` — both resolve to the same constant. No accidental bump.
- **`resolvePack` dispatcher correct.** Literal `"socials"` always resolves; the `default` arm throws for future/unknown ids (exercised by packs-index.test.ts).
- **All `import type` references in domain-pack.ts resolve** (`AggregateScoresOptions`, `StageEventCallback`, `PipelineOptions`, `PipelineResult`, `AnalysisInput`, `PredictionResult`, `selectPersonaSlots`, `buildAudienceRepaint`) — zero runtime coupling.

No correctness, security, or data-loss defects found. The remaining findings concern the robustness of one BLOCKING guard and minor maintainability.

## Warnings

### WR-01: Contract gate uses a single forward assignment — param-type drift may slip past the "verbatim shape" claim

**File:** `src/lib/engine/__tests__/domain-pack.contract.test.ts:32` (interface at `src/lib/engine/domain-pack.ts:59-66`)
**Issue:** `domain-pack.contract.test.ts` is the BLOCKING de-risk for Plan 03 and its docstring claims it goes red "if the interface's `scoring.run` shape ever drifts from the verbatim `aggregateScores` signature." The guard is a single forward assignment:

```ts
const _scoringRunProbe: DomainPackScoring["run"] = aggregateScores;
```

`DomainPackScoring.run` is declared with **method-shorthand syntax** (`run(...): Promise<...>`), which TypeScript checks with **bivariant** parameter variance (method members are exempt from `strictFunctionTypes`). A one-directional assignment plus method-bivariance means the gate reliably catches return-type drift and arity changes, but a future **parameter-type widening** in `aggregateScores` (e.g. `pipelineResult: PipelineResult` relaxed to a supertype) can pass the check without going red — exactly the "shape drift" the gate advertises catching. The signatures match today; this is a gap in the guard, not a present defect.

**Fix:** Add a reverse-direction probe so drift is caught in both directions regardless of method variance:

```ts
// forward: aggregateScores fits the interface slot
const _scoringRunProbe: DomainPackScoring["run"] = aggregateScores;
// reverse: the interface slot fits aggregateScores (catches param-type drift)
const _scoringRunProbeRev: typeof aggregateScores =
  null as unknown as DomainPackScoring["run"];
void _scoringRunProbe;
void _scoringRunProbeRev;
```

(Alternatively, declare `run` as an arrow-property type — `run: (pipelineResult: PipelineResult, ...) => Promise<PredictionResult>` — on both `DomainPackScoring` and `DomainPack` so `strictFunctionTypes` applies contravariant param checking.)

## Info

### IN-01: Brittle absolute line-number references in docstrings

**File:** `src/lib/engine/domain-pack.ts:11,36,54,57,80,118,127,133` (e.g. `aggregator.ts:520`, `pipeline.ts:332`, `types.ts:157`, `types.ts:300`)
**Issue:** The header and per-field comments cite hard file:line anchors. All checked anchors are accurate *today* (aggregator.ts:520 = `aggregateScores`, pipeline.ts:332 = `runPredictionPipeline`, types.ts:157 = the input_mode enum, types.ts:300 = `PredictionResult`), but absolute line numbers rot silently on any unrelated edit to those files and become misleading. Note this matches an existing codebase convention, so this is a low-priority maintainability observation, not a defect.
**Fix:** Prefer symbol references (`aggregateScores` in aggregator.ts) over `file:line`; or drop the line component and keep the symbol/section name.

### IN-02: Forward-declared `DomainPack` fields are populated but unread this phase (intentional)

**File:** `src/lib/engine/packs/socials.ts:47-89` (`grounding`, `reactionFrame`, `populations`, `calibration`, `stimulusTypes`, `outputSchema`)
**Issue:** Six of the seven D-05 spec fields are populated by reference but never consumed at runtime in Phase 1 — a static analyzer would flag them as dead. This is **by design** (Cut Line A / D-05: define the contract now, wire it in Plan 03), and the phase intent explicitly locks this scope. Recorded only so a later structural pass does not mistake the forward-declared contract for genuine dead code and prematurely prune it.
**Fix:** None required this phase. Confirm these fields are read live when Plan 03 threads the pack into the pipeline.

---

_Reviewed: 2026-06-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
