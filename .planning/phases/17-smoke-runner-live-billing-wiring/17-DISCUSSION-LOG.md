# Phase 17: Smoke Runner Live Billing Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 17-smoke-runner-live-billing-wiring
**Areas discussed:** Phase scope (billing API viability), Field naming

---

## Phase Scope (billing API viability)

| Option | Description | Selected |
|--------|-------------|----------|
| Wire billing API as planned | Hit DashScope /billing endpoint at end of run, persist cost_cents_actual alongside cost_cents_estimated | |
| Just rename the field | Rename cost_cents → cost_cents_estimated; no billing API | ✓ |
| Skip Phase 17 entirely | Cancel like phases 15/16 and move to Phase 18 | |

**User's choice:** "what do you think is best to do right now?" (deferred to Claude recommendation)
**Notes:** User raised that `qwen3.5-omni-plus` is free during preview, questioning whether the billing API would return useful data. After checking `qwen/cost.ts` and `qwen/client.ts`, confirmed: omni is free ($0), but Wave 3 (`qwen3.6-flash`) and reasoning (`qwen3.6-plus`) ARE charged. However, `cost_cents` already uses `calculateCost(model, response.usage)` — token-usage-based, not a static estimate. Claude recommended Option B (rename) as most practical given preview-free omni. User accepted.

---

## Field Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Rename only | cost_cents → cost_cents_estimated; ~10-line change | ✓ |
| Rename + per-model breakdown | Also expose { omni: 0, wave3_flash: X, reasoning: Y } breakdown | |
| Rename + cost_cents_actual: null | Add null placeholder for future billing API | |

**User's choice:** "Rename only (Recommended)"
**Notes:** User immediately accepted the simplest option. No breakdown needed.

---

## Inline Execution

**User's choice:** "do the edit inline and close phase 17?"
**Notes:** User chose to skip the discuss→plan→execute cycle given the minimal scope. Edit executed inline: renamed all 11 `cost_cents` references in `scripts/smoke-tiktok-pipeline.ts`. tsc clean after change. CALIB-04 marked closed in REQUIREMENTS.md.

---

## Claude's Discretion

- Decided to keep `PredictionResult.cost_cents` (engine field) unchanged — rename scoped to smoke runner output schema only
- Decided to update ROADMAP.md, REQUIREMENTS.md, STATE.md to reflect Phase 17 closed status

## Deferred Ideas

- **DashScope billing API** — wire `cost_cents_actual` from DashScope billing endpoint once `qwen3.5-omni-plus` exits free preview period. Noted in CONTEXT.md deferred section.
