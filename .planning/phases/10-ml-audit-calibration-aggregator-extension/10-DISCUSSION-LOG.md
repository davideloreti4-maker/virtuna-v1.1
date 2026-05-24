# Phase 10: ML Audit + Calibration + Aggregator Extension - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 10-ml-audit-calibration-aggregator-extension
**Areas discussed:** ML decision mechanics, Platt training trigger, Signal weight rebalancing

---

## ML Decision Mechanics

### Q1: How is the retrain / down-weight / disable decision implemented?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual code change | Developer reads report, edits constant in ml.ts or aggregator.ts, commits | ✓ |
| Config flag in .env / config.json | ML_MODE=disabled flag, switchable without redeploy | |
| DB-driven toggle | Admin can flip ML on/off via DB record | |

**User's choice:** Manual code change  
**Notes:** Simple and auditable. No runtime switching complexity needed.

---

### Q2: Where does the ML audit script live?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse eval-harness.ts + eval-runner.ts | Add focused ml-audit.ts CLI that uses Phase 1 harness | ✓ |
| New standalone audit script | corpus/cli/ml-audit.ts with no eval harness dependency | |
| You decide | Planner picks based on existing code | |

**User's choice:** Reuse eval-harness.ts + eval-runner.ts

---

### Q3: What does 'down-weight' mean concretely?

| Option | Description | Selected |
|--------|-------------|----------|
| Reduce ML_SIGNAL_WEIGHT constant (e.g., 0.15 → 0.05) | Edit constant; selectWeights() redistributes remaining weight | ✓ |
| Disable ML signal entirely (weight = 0) | SignalAvailability.ml_classifier = false | |

**User's choice:** Reduce ML_SIGNAL_WEIGHT constant

---

### Q4: Where do retrain weights live?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed to repo as JSON file | Same pattern as calibration-baseline.json | ✓ |
| Stored in DB table | Hot-swappable but adds DB dependency to hot path | |
| You decide | Planner picks based on existing pattern | |

**User's choice:** Committed to repo as JSON file

---

## Platt Training Trigger

### Q1: How is Platt calibration training triggered?

| Option | Description | Selected |
|--------|-------------|----------|
| One-shot CLI script | corpus/cli/train-platt.ts; same pattern as calibrate-thresholds.ts | ✓ |
| Admin API endpoint | POST /api/admin/calibration/train | |
| Integrated into eval-runner | Auto-trains after each full eval run | |

**User's choice:** One-shot CLI script

---

### Q2: Where are fitted Platt parameters stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Existing DB table (check calibration.ts) | Whatever getPlattParameters() already reads from | |
| New platt_parameters table in Supabase | Explicit schema matching PlattParameters type | ✓ |
| Committed to repo as JSON | Load at build time, no DB read on hot path | |

**User's choice:** DB table (confirmed recommendation — platt_parameters table)  
**Notes:** User asked "what do you think is best?" — Claude recommended DB table consistent with existing getPlattParameters() cache pattern and presence of calibration-audit cron. User agreed.

---

### Q3: Which score does Platt calibrate?

| Option | Description | Selected |
|--------|-------------|----------|
| overall_score from aggregator | Final blended viral score vs corpus outcomes | ✓ |
| ML classifier raw probability only | More surgical, but ML sub-signal only | |
| Both independently | Separate params for ML and overall_score | |

**User's choice:** overall_score from aggregator

---

## Signal Weight Rebalancing

### Q1: Should retrieval (0.05) and platform_fit (0.05) be tuned now or left until Phase 12?

| Option | Description | Selected |
|--------|-------------|----------|
| Tune based on corpus analysis | Signal ablation eval, raise weight if accuracy improves | ✓ |
| Leave at 0.05 until Phase 12 | Keep dev placeholders until full v3 signal set runs | |
| You decide | Planner picks | |

**User's choice:** Tune based on corpus analysis

---

### Q2: Should personas get a dedicated aggregator weight key?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay under 'behavioral' key | behavioralScore already derived from persona aggregate in Phase 9 | ✓ |
| Rename 'behavioral' → 'personas' | Cleaner naming but risks breaking 203 existing tests | |

**User's choice:** Personas stay under 'behavioral' key

---

### Q3: Should hook_decomp become weight-bearing?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave hook as informational only | Hook quality already inside gemini signal | ✓ |
| Add hook as weight-bearing signal | Separate weight (~0.03-0.05) | |

**User's choice:** Informational only  
**Notes:** User initially questioned whether hook should have high weight. Claude explained hook quality is already baked into the gemini signal weight (Phase 5 hook-segment Gemini call). Adding hook_decomp separately would double-count it. User confirmed informational-only.

---

## Claude's Discretion

- Final numeric values for tuned retrieval and platform_fit weights — run signal ablation and pick values that maximize corpus accuracy improvement.
- Whether to create `platt_parameters` DB table via migration or confirm it already exists (read calibration.ts + Supabase schema).

## Deferred Ideas

None — discussion stayed within phase scope.
