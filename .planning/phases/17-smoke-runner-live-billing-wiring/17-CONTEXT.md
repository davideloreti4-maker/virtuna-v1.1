# Phase 17: Smoke Runner Live Billing Wiring - Context

**Gathered:** 2026-05-25
**Status:** Ready for execution (inline — no separate plan needed)

<domain>
## Phase Boundary

Rename `cost_cents` → `cost_cents_estimated` in `scripts/smoke-tiktok-pipeline.ts` — the `SmokeResult` type and all 11 touch points in the script. No billing API. CALIB-04 closes as estimate-from-tokens is sufficient while `qwen3.5-omni-plus` is free during preview.

**Live-state finding that compressed scope:** The original CALIB-04 specified sourcing `cost_cents_actual` from the DashScope International billing endpoint. During discussion, it emerged that:
1. `qwen3.5-omni-plus` (Wave 0/1) is **free during preview** — billing API would return $0 for the most expensive wave.
2. The existing `cost_cents` field is **already token-usage-based** (`calculateCost(model, response.usage)` from the API response) — not a static guess, but computed from actual API-returned token counts.
3. Wave 3 (`qwen3.6-flash`) and reasoning (`qwen3.6-plus`) ARE charged, and the estimate already captures these.
4. Hitting a separate DashScope billing endpoint adds complexity (different auth flow, time-range queries, billing settlement delays) with minimal payoff.

Decision: rename the field to make semantics explicit. No new billing endpoint code needed.

</domain>

<decisions>
## Implementation Decisions

### Field Naming (CALIB-04)
- **D-01:** Rename `cost_cents` → `cost_cents_estimated` in `SmokeResult` type (line 109) and all 11 touch points in `scripts/smoke-tiktok-pipeline.ts`. Do NOT rename `PredictionResult.cost_cents` in the engine — that is a separate interface and out of scope.
- **D-02:** No `cost_cents_actual` field. The billing API is deferred until `qwen3.5-omni-plus` exits the free preview period. When the billing API is wired in a future phase, `cost_cents_actual` can be added alongside `cost_cents_estimated` at that time.
- **D-03:** CALIB-04 closes as: "estimate-from-tokens is accurate (computed from actual API `usage` response). Billing API deferred while omni is free. Field renamed to make semantics explicit."

### Scope
- **D-04:** Changes limited to `scripts/smoke-tiktok-pipeline.ts` only. No engine files touched. No new tests needed (rename is type-safe).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — CALIB-04 definition and current status
- `.planning/MILESTONE.md` — Stack decisions block (smoke runner billing decision)

### Smoke Runner
- `scripts/smoke-tiktok-pipeline.ts` — the file being modified; `SmokeResult` type at line 109, all `cost_cents` references at lines 163, 165, 260, 449, 537, 566, 576

### Engine Cost Model
- `src/lib/engine/qwen/cost.ts` — `calculateCost()` function; pricing table shows omni-plus is $0 (free preview), flash/plus are charged; this is what `cost_cents_estimated` represents
- `src/lib/engine/qwen/client.ts` — model constants: `QWEN_OMNI_MODEL=qwen3.5-omni-plus`, `QWEN_FAST_MODEL=qwen3.6-flash`, `QWEN_REASONING_MODEL=qwen3.6-plus`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SmokeResult` type at `scripts/smoke-tiktok-pipeline.ts:109` — rename `cost_cents: number` → `cost_cents_estimated: number`

### Established Patterns
- `cost_cents` field on `PredictionResult` (engine) remains unchanged — rename is scoped to the smoke runner output schema only
- Budget overage check at line 163: `if (result.cost_cents > 40)` becomes `if (result.cost_cents_estimated > 40)`

### Integration Points
- JSON `--json-out` aggregate output (lines 566, 576) — consuming scripts (Nyquist verifiers) will see the renamed field; update any probe assertions if they reference `cost_cents` by name

</code_context>

<specifics>
## Specific Ideas

User confirmed "rename only" — no per-model breakdown, no `cost_cents_actual: null` placeholder. Keep it minimal.

</specifics>

<deferred>
## Deferred Ideas

- **DashScope billing API integration** — wire `cost_cents_actual` from `https://dashscope-intl.aliyuncs.com` billing endpoint once `qwen3.5-omni-plus` exits free preview. Requires researching billing endpoint auth + time-range query API (separate from compatible-mode `/v1` endpoint).

</deferred>

---

*Phase: 17-smoke-runner-live-billing-wiring*
*Context gathered: 2026-05-25*
