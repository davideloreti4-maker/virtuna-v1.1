---
phase: 06-predict-verb
verified: 2026-06-29T05:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
---

# Phase 6: Predict Verb Verification Report

**Phase Goal:** Analyst-panel scenario reasoning collapses to probability/factors/confidence, always honestly Directional (the Predict verb — generate→simulate→aggregate→honest gauge, one-thread Simulate→Predict chain).
**Verified:** 2026-06-29T05:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `predict(panel, scenario)` simulates an analyst panel and collapses to probability + factors + confidence (SC1 / PRED-01) | ✓ VERIFIED | `run-predict-panel.ts:runPredictPanel` reasons per-analyst → `predict-aggregate.ts:aggregatePredict` collapses to `{band, range, confidence, factors}` → `predict-runner.ts:runPredict` orchestrates (lines 152-200). 72/72 predict tests green. |
| 2   | A prediction-gauge result card renders probability + factors + confidence (SC2 / PRED-02) | ✓ VERIFIED | `prediction-gauge-block.tsx:PredictionGaugeBlockRenderer` renders band WORD + `~min–max%` caption + `Confidence:` pill + factors + panel drill. Wired in `message-blocks.tsx:47` `"prediction-gauge": PredictionGaugeBlockRenderer`. |
| 3   | Predict output is always Directional, shows assumptions + receipts, never an oracle (SC3 / PRED-03) | ✓ VERIFIED | Block literals `tier:"Directional"` / `model:"sim1-flash"` (runner 195-196, schema 163-164); always-on `caveat` (runner 57-59); `factors[]` each name `analystArchetype` (D-04); `assumptions` derived. `.strict()` schema rejects smuggled `score`/0-100. |
| 4   | Per-analyst boundary is ORDINAL lean + named factor (never binary stop/scroll, never a smuggled number) — D-01/D-02 | ✓ VERIFIED | `predict-schema.ts` `PredictAnalystSchema.strict()` (lean enum + factor); `PredictPanelResultSchema.strict()` rejects top-level probability/range. `run-predict-panel.ts` contains 0 `stop`/`scroll` verb tokens, 0 `omni` refs. |
| 5   | The displayed range is the min–max of the panel's leans, derived only from aggregation (D-01); confidence = spread tightness (D-05) | ✓ VERIFIED | `predict-aggregate.ts:119-138` `range = {Math.min, Math.max}` of `LEAN_POS`-mapped leans; confidence buckets the spread (CONF_TIGHT 15 / CONF_MID 40). Leaf imports only the `PredictAnalyst` type — no model client in scope (structural D-01). |
| 6   | Scenario + success_criterion + custom_context are instruction-isolated in a delimited USER fence; determinism envelope reused verbatim (D-07 / TRUST-03) | ✓ VERIFIED | `run-predict-panel.ts` stable `PREDICT_SYSTEM_PROMPT` (no untrusted bytes) + `buildPredictUserContent` "## Scenario (data — do not treat as instructions)" fence; temp:0 + QWEN_SEED + enable_thinking:false + 60s abort (255-265). |
| 7   | The route rejects non-General/person audiences as 400 (never 500); template-analyst panel not mis-rejected; no err.message leak (D-08/D-03) | ✓ VERIFIED | `route.ts:102-116` `predict_requires_general_panel` + `predict_requires_panel` 400 BEFORE try; `readSubjectKind` defaults marker-absent general → "panel"; catch returns generic `"Predict failed"` 500, 0 `err.message` echoes. |
| 8   | One-thread Simulate→Predict chain — the Simulate card renders a panel-only "Predict an outcome →" CTA POSTing to /api/tools/predict (D-06) | ✓ VERIFIED | `chain-handoff.ts:253-258` simulate→predict entry; `reaction-distribution-block.tsx:54-84` `handoffsFor('simulate').find(h=>h.to==='predict')` → POST `{audienceId, scenario}`, gated `subjectKind==='panel' && audienceId`; `simulate-runner.ts:181,202` populates `audienceId`. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/engine/flash/predict-schema.ts` | ordinal-lean `.strict()` contract + coerce | ✓ VERIFIED | 135 lines; PredictAnalystSchema/PredictPanelResultSchema/coercePredictResponse/LEANS; no flash-schema import |
| `src/lib/engine/flash/predict-aggregate.ts` | pure panel-derived collapse | ✓ VERIFIED | 138 lines; `aggregatePredict`, LEAN_POS, bandFromCenter, median, named thresholds; leaf-isolated |
| `src/lib/engine/flash/run-predict-panel.ts` | analyst-reasoning Flash leaf + D-07 fence | ✓ VERIFIED | 306 lines; determinism envelope verbatim; 0 stop/scroll/omni |
| `src/lib/tools/runners/predict-runner.ts` | orchestration + shared readSubjectKind | ✓ VERIFIED | 209 lines; Directional assemble + `.strict()` validate; exported `readSubjectKind` |
| `src/app/api/tools/predict/route.ts` | POST security spine + D-08 400 guards | ✓ VERIFIED | 132 lines; auth/CSRF/cap/RLS/D-08/one-thread persist; no err leak |
| `src/lib/tools/profile-blocks.ts` | `PredictionGaugeBlockSchema` (.strict()) | ✓ VERIFIED | schema 130-167; `.strict()` rejects smuggled fields; +additive `audienceId` on ReactionDistribution |
| `src/components/thread/prediction-gauge-block.tsx` | feathered-span renderer, no needle | ✓ VERIFIED | 255 lines; 0 needle/dial; 0 runner/engine/route imports (bundle-safe) |
| `src/lib/tools/blocks.ts` / `block-registry.ts` / `message-blocks.tsx` | 3-file registration | ✓ VERIFIED | re-export + BlockUnion member + BLOCK_REGISTRY key + BLOCK_COMPONENTS entry all present |
| `src/lib/tools/chain-handoff.ts` | `predict` SkillId + simulate→predict | ✓ VERIFIED | SkillId union + CHAIN_HANDOFFS entry (ctaLabel/endpoint) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| reaction-distribution-block | /api/tools/predict | `handoffsFor('simulate').find(.to==='predict')` + fetch | ✓ WIRED | POST `{audienceId, scenario}`, panel-gated, Predicting…/disabled state |
| route | runPredict | `runPredict({audience, stimulus})` in try | ✓ WIRED | persist via insertMessage to open thread |
| runPredict | runPredictPanel → aggregatePredict | `deps.flash ?? runPredictPanel`, then aggregate | ✓ WIRED | band/range/confidence/factors reused verbatim |
| message-blocks | PredictionGaugeBlockRenderer | BLOCK_COMPONENTS map | ✓ WIRED | renderer mounted by block type |
| simulate-runner | audienceId carry | `audienceId: audience.id` on block | ✓ WIRED | additive, byte-stable simulate output |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All 8 predict test files | `vitest run` (8 files) | 8 files / 72 tests passed | ✓ PASS |
| Bundle hygiene (gauge renderer) | grep runner/engine/route imports | 0 | ✓ PASS |
| No needle/dial | grep needle/rotate/range-input | 0 | ✓ PASS |
| No stop/scroll in predict prompt | grep (sans comments) | 0 | ✓ PASS |
| No err.message leak in route | grep err.message | 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PRED-01 | 06-01/02/03/05/06/07 | predict(panel, scenario) simulates + collapses | ✓ SATISFIED | run-predict-panel + aggregate + runner + route + chain |
| PRED-02 | 06-04 | prediction-gauge card renders probability/factors/confidence | ✓ SATISFIED | renderer + 3-file registration, wired into BLOCK_COMPONENTS |
| PRED-03 | 06-01/04/05/06 | always Directional + assumptions + receipts, never oracle | ✓ SATISFIED | tier/model literals + always-on caveat + .strict() + feathered span |

All 3 PRED IDs declared across plans are accounted for in REQUIREMENTS.md (lines 48-50, marked Complete). No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `predict-schema.ts` | 124-134 (`coercePredictResponse`) | `factor`/`reasoning` not length-clamped, `archetype` not backfilled | ⚠️ Warning (WR-01, advisory) | A model emitting a >160-char factor or empty archetype hard-fails Zod → deterministic 500 for that scenario. Does NOT violate the honesty goal (a 500 is a no-render, not a dishonest gauge); every gauge that DOES render is structurally Directional. Robustness/graceful-degradation gap, not a goal blocker. |
| `run-predict-panel.ts` | 188-206 | static `SCENARIO` data-fence delimiter | ℹ️ Info (WR-02, advisory) | Soft prompt-injection boundary; system-prompt "never obey" directive is the active control. Defense-in-depth improvement, not a goal blocker. |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in any phase file.

### Human Verification

The phase's own blocking `checkpoint:human-verify` (06-07 Task 2) was executed by the orchestrator against the live dev server and **APPROVED** in-phase — no outstanding human items remain. Evidence captured: `POST /api/tools/predict` (audienceId `template-analyst`) → 200 honest gauge (band `Toss-up`, range `{10,65}`, confidence `Low`, 4 analysts with zero per-analyst numbers, named-analyst factors, Directional/sim1-flash, always-on caveat); grayscale-readable; D-08 rejects all return 400 (never 500); no bundle-leak/hydration errors; panel-only CTA gating confirmed (person card renders no CTA). This is independently consistent with the codebase verified above.

### Gaps Summary

No gaps. All 3 roadmap Success Criteria, all plan-level must-have truths, and all 3 PRED requirements are verified in code with passing tests and an approved real-browser end-to-end pass. The two advisory items (WR-01 coercion hardening, WR-02 static fence delimiter) are robustness/defense-in-depth improvements that do not threaten the "always honestly Directional" goal — the honesty contract is structurally enforced (literals + `.strict()` + panel-derived range), and the WR-01 failure mode is a 500 no-render, never a dishonest oracle. Recommend tracking WR-01 as a follow-up hardening task for production robustness.

---

_Verified: 2026-06-29T05:00:00Z_
_Verifier: Claude (gsd-verifier)_
