# Phase 10: ML Audit + Calibration + Aggregator Extension - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Three coupled tasks:

1. **ML audit** — Run existing ML classifier (`src/lib/engine/ml.ts`) against the labeled corpus; measure accuracy. Based on the report, make one of three decisions: retrain on corpus, down-weight the signal, or disable entirely. Decision encoded as a manual code change.

2. **Platt calibration training** — Train Platt scaling on `overall_score` vs actual corpus outcomes (viral/average/underperforming). Fitted A/B parameters stored to `platt_parameters` DB table. Runtime path unchanged — `getPlattParameters()` already reads from DB and is cache-backed.

3. **Aggregator weight calibration** — Tune `retrieval` (0.05 placeholder) and `platform_fit` (0.05 placeholder) based on corpus eval signal-ablation. Confirm `behavioral` weight (0.35) remains appropriate for persona aggregate. Bump `ENGINE_VERSION` from `3.0.0-dev` to final if warranted (see Phase 12 note).

**Out of scope this phase:**
- UI rendering of calibration data
- Phase 12 acceptance gate (that flips `3.0.0-dev` → `3.0.0` in `version.ts`)
- Additional ML model architectures
- Any changes to non-aggregator pipeline stages

</domain>

<decisions>
## Implementation Decisions

### ML Audit + Decision Mechanics

- **D-01: Reuse eval-harness.ts + eval-runner.ts for the audit.** Phase 1 built these. Phase 10 adds a focused ML audit script (`src/lib/engine/corpus/cli/ml-audit.ts`) that runs only the `ml.ts` classifier path, compares predicted bucket vs actual outcome bucket, computes accuracy/confusion matrix, and writes a report to `.planning/research/ml-audit-report.md`.

- **D-02: Decision encoded as a manual code change.** Developer reads the audit report, then edits a constant in `aggregator.ts` (e.g., adjusts `ML_SIGNAL_WEIGHT` or sets a disable flag). Simple, auditable, no runtime switching overhead.

- **D-03: Down-weight = reduce `ML_SIGNAL_WEIGHT` constant.** If the audit shows ML helps but not at its current 0.15 weight, reduce the constant (e.g., → 0.05). Dynamic weight redistribution in `selectWeights()` absorbs the freed weight into other signals automatically.

- **D-04: Retrain weights committed to repo as JSON file.** If the decision is retrain, new weights are committed to `src/lib/engine/` as a JSON file (following the `calibration-baseline.json` pattern). Loaded at startup. No DB dependency on hot path.

- **D-05: Disable = set weight to 0 (not code removal).** If ML signal harms accuracy, set `ML_SIGNAL_WEIGHT = 0` and `SignalAvailability.ml_classifier = false`. Easy to re-enable without structural changes.

### Platt Calibration Training

- **D-06: One-shot CLI script triggers training.** New `src/lib/engine/corpus/cli/train-platt.ts` fetches prediction/outcome pairs from the `training_corpus` table, calls `fitPlattScaling()` from `calibration.ts`, stores fitted A/B parameters to the `platt_parameters` DB table. Run once manually post-audit. Same CLI pattern as `calibrate-thresholds.ts`.

- **D-07: Calibrates `overall_score` vs corpus actual outcomes.** The Platt scaling maps the final aggregated viral score to actual viral probability derived from corpus outcomes. This is the user-facing signal — the most impactful score to calibrate.

- **D-08: Parameters stored in `platt_parameters` DB table.** The runtime `getPlattParameters()` in `calibration.ts` already reads from DB with caching. If the table doesn't exist yet, Phase 10 creates it with schema matching `PlattParameters` type: `(id, a, b, fitted_at, sample_count)`. `is_calibrated: true` flips in the aggregator whenever `getPlattParameters()` returns non-null.

### Signal Weight Rebalancing

- **D-09: Tune retrieval and platform_fit weights via corpus signal ablation.** Both are currently at 0.05 dev placeholders with Phase 10 noted as the calibration owner. Run eval harness with/without each signal, measure accuracy delta, raise weight if signal lifts MAE. Document final values + rationale in `.planning/research/weight-calibration-report.md`.

- **D-10: Persona aggregate stays under `behavioral` key (0.35 weight).** Phase 9 already wired persona aggregate scores into `behavioralScore` in the aggregator. No key rename — `behavioral` effectively IS personas now. Phase 10 validates the weight is appropriate after corpus measurement.

- **D-11: hook_decomp remains informational-only (not weight-bearing).** Hook quality is already captured inside the `gemini` signal weight (Phase 5 hook-segment Gemini call feeds into the gemini score). Making hook_decomp a separate weight-bearing signal would double-count it. Hook decomp's value is surfacing specific timestamps for counterfactuals and critique.

- **D-12: ENGINE_VERSION stays at `3.0.0-dev` this phase.** `version.ts` comment explicitly reserves the `3.0.0-dev` → `3.0.0` flip for Phase 12's acceptance gate. Phase 10 does not touch `version.ts`.

### Claude's Discretion

- Final numeric values for tuned retrieval and platform_fit weights — planner runs the signal ablation and picks values that maximize corpus accuracy improvement. Document in `weight-calibration-report.md`.
- Whether to create the `platt_parameters` DB table via Supabase migration or confirm it already exists (read `calibration.ts` + Supabase schema before deciding).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Aggregator + Signal Architecture
- `src/lib/engine/aggregator.ts` — SCORE_WEIGHTS, SCORE_WEIGHT_KEYS, selectWeights(), SignalAvailability pattern. Lines 40-75 are the weight-definition block Phase 10 edits.
- `src/lib/engine/version.ts` — ENGINE_VERSION. Comment explicitly says Phase 12 flips `3.0.0-dev` → `3.0.0`. Do NOT touch this file in Phase 10.

### ML Classifier
- `src/lib/engine/ml.ts` — existing ML classifier (~600 lines). Phase 10 runs an audit against this, does not rewrite it unless the decision is retrain.
- `src/lib/engine/__tests__/ml.test.ts` — existing ML tests; must still pass after any weight/disable changes.

### Platt Calibration (Runtime)
- `src/lib/engine/calibration.ts` — `fitPlattScaling()`, `applyPlattScaling()`, `getPlattParameters()`, `PlattParameters` type. Phase 10's CLI script calls `fitPlattScaling()` and writes to DB. Runtime path uses `getPlattParameters()` — do not change this.
- `src/lib/engine/__tests__/calibration.test.ts` — must still pass.
- `src/app/api/admin/calibration-report/` — existing admin calibration report route (may inform table schema).
- `src/app/api/cron/calibration-audit/` — existing cron (DB-backed params confirmed).

### Corpus Infrastructure
- `src/lib/engine/corpus/eval-harness.ts` — reuse for ML audit and signal ablation runs.
- `src/lib/engine/corpus/eval-runner.ts` — reuse for corpus eval pipeline.
- `src/lib/engine/corpus/calibration.ts` — corpus-specific niche threshold calibration (different from Platt; do not confuse).

### Requirements
- `.planning/REQUIREMENTS.md` §ML-01..06, §AGG-01..06 — locked requirements for this phase.
- `.planning/ROADMAP.md` §Phase 10 — success criteria and plan count (~3 plans).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eval-harness.ts` + `eval-runner.ts`: Phase 10 ML audit script uses these for corpus eval runs.
- `fitPlattScaling()` in `calibration.ts`: already implemented, just needs a CLI caller.
- `calibration-baseline.json` pattern: ML retrain weights follow the same committed-JSON pattern.

### Established Patterns
- `SignalAvailability` extension: additive — add new availability keys without modifying existing ones.
- `selectWeights()`: normalizes any subset of signals — tuning a weight value is a one-line constant change, redistribution is automatic.
- CLI scripts pattern: `corpus/cli/*.ts` for one-shot corpus operations (see `calibrate-thresholds.ts` as the model for `train-platt.ts`).

### Integration Points
- Aggregator `SCORE_WEIGHTS` constant: where retrieval + platform_fit weights get tuned.
- `getPlattParameters()`: already wired in aggregator at line ~850; `is_calibrated` flips when it returns non-null.
- `platt_parameters` DB table: CLI writes → runtime reads. Check `calibration.ts` + Supabase schema to confirm existence before writing a migration.

</code_context>

<specifics>
## Specific Ideas

- ML audit report → `.planning/research/ml-audit-report.md`
- Weight calibration report → `.planning/research/weight-calibration-report.md`
- Platt training CLI → `src/lib/engine/corpus/cli/train-platt.ts`
- ML audit CLI → `src/lib/engine/corpus/cli/ml-audit.ts`
- Follow `calibration-baseline.json` pattern if ML retrain weights need to be committed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-ML Audit + Calibration + Aggregator Extension*
*Context gathered: 2026-05-20*
