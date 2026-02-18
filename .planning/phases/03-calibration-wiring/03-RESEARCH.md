# Phase 3: Calibration Wiring - Research

**Researched:** 2026-02-18
**Domain:** Platt scaling integration, calibration audit cron, outcomes endpoint verification
**Confidence:** HIGH

## Summary

Phase 3 is a **wiring phase, not a build phase**. All the core calibration infrastructure already exists: `calibration.ts` has complete Platt scaling (`fitPlattScaling`, `applyPlattScaling`, `getPlattParameters`), ECE computation (`computeECE`), and report generation (`generateCalibrationReport`). The calibration-audit cron route exists and is already scheduled in vercel.json. The outcomes endpoint is fully built with Zod validation, auth, and pagination. What's missing is the **connection** between these pieces and the aggregator, plus an `is_calibrated` field on the prediction result.

The work is surgical: (1) import `getPlattParameters` + `applyPlattScaling` into `aggregator.ts` and apply conditionally after score computation, (2) add `is_calibrated: boolean` to the `PredictionResult` interface and populate it, (3) propagate `is_calibrated` through the DB insert in the analyze route, and (4) verify the cron and outcomes endpoint work as-is (they are already built — the task is verification, not construction).

**Primary recommendation:** Wire Platt scaling into `aggregateScores()` with a single async call to `getPlattParameters()`, apply it to `overall_score` only when params are non-null, set `is_calibrated` accordingly, and propagate through the response chain.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | API routes for cron + outcomes endpoints | Already in use |
| Supabase | 2.x | DB for outcomes table, service client for calibration | Already in use |
| Zod | 4.x | Input validation for outcomes endpoint | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | - | No new libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory Platt cache | DB-stored params | In-memory cache with 24hr TTL is simpler and already implemented; DB would survive cold starts but adds latency |

**Installation:**
```bash
# No new packages needed — all infrastructure exists
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/engine/
│   ├── aggregator.ts      # MODIFY: import + call getPlattParameters, apply scaling
│   ├── calibration.ts     # NO CHANGE: all functions already exist
│   └── types.ts           # MODIFY: add is_calibrated to PredictionResult
├── app/api/
│   ├── analyze/route.ts   # MODIFY: persist is_calibrated in DB insert
│   ├── cron/calibration-audit/route.ts  # VERIFY ONLY: already works
│   └── outcomes/route.ts  # VERIFY ONLY: already works
└── supabase/migrations/
    └── (possible new migration for is_calibrated column)
```

### Pattern 1: Conditional Calibration in Aggregator
**What:** The aggregator calls `getPlattParameters()` once per prediction. If params exist (>= 50 outcome samples), it applies Platt scaling to `overall_score`. If null, the raw score passes through unchanged.
**When to use:** Every prediction call.
**Example:**
```typescript
// In aggregateScores(), after computing overall_score:
import { getPlattParameters, applyPlattScaling } from "./calibration";

const plattParams = await getPlattParameters();
const calibratedScore = applyPlattScaling(overall_score, plattParams);
const is_calibrated = plattParams !== null;

return {
  overall_score: calibratedScore,
  is_calibrated,
  // ... rest of result
};
```

### Pattern 2: Graceful Degradation When No Outcome Data
**What:** Since there are no outcome pairs yet (the product is pre-launch / early), `getPlattParameters()` will return null (< 50 samples). The aggregator MUST handle this by using raw scores unchanged and setting `is_calibrated: false`.
**When to use:** This is the default behavior for the foreseeable future until users submit enough outcomes.
**Example:**
```typescript
// applyPlattScaling already handles null params — returns rawScore unchanged
export function applyPlattScaling(rawScore: number, params: PlattParameters | null): number {
  if (params === null) return rawScore;
  // ... sigmoid transform
}
```

### Pattern 3: Cache-First Platt Parameter Loading
**What:** `getPlattParameters()` already uses a 24-hour TTL in-memory cache. On cache miss, it fetches outcome pairs from Supabase, fits Platt parameters, and caches. This means the first prediction after a cold start pays a DB query cost, but subsequent calls within 24h are free.
**When to use:** Automatically handled by the existing cache in `calibration.ts`.

### Anti-Patterns to Avoid
- **Applying Platt scaling to individual signal scores (gemini_score, behavioral_score, etc.):** Only the final `overall_score` should be calibrated. Platt scaling is trained on `predicted_score` vs `actual_score` at the aggregate level, not per-signal.
- **Fetching Platt params inside the pipeline (before aggregation):** The pipeline runs before aggregation. Platt params are only needed at the aggregation stage. Don't add this to `runPredictionPipeline()`.
- **Blocking on Platt parameter errors:** If the Supabase query fails, catch the error and return `null` params (uncalibrated). Never let calibration lookup break a prediction.
- **Adding is_calibrated to the DB without a migration:** The `analysis_results` table needs a new column. Don't try to insert a field that doesn't exist in the schema.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Platt scaling math | Custom sigmoid | `applyPlattScaling()` in calibration.ts | Already implemented with proper clamping and null handling |
| Parameter fitting | Custom gradient descent | `fitPlattScaling()` in calibration.ts | Already implemented with PLATT_MIN_SAMPLES guard |
| Parameter caching | Custom cache | `getPlattParameters()` with plattCache | Already uses createCache with 24hr TTL and PlattCacheEntry wrapper |
| ECE computation | Manual binning | `computeECE()` in calibration.ts | Already implemented with proper bin assignment and edge handling |
| Outcomes validation | Manual validation | Zod schema in outcomes/route.ts | Already has OutcomeInputSchema with proper constraints |

**Key insight:** Everything in calibration.ts is already built and tested (pure functions with sensible defaults). The work is purely wiring — importing and calling existing functions in the right place.

## Common Pitfalls

### Pitfall 1: Breaking the Aggregator's Return Type
**What goes wrong:** Adding `is_calibrated` to `PredictionResult` without updating all consumers causes TypeScript compilation errors.
**Why it happens:** `PredictionResult` is used in: aggregator.ts (return), analyze/route.ts (DB insert + SSE send), analysis API routes (GET responses), and possibly frontend types.
**How to avoid:** Add `is_calibrated: boolean` to the `PredictionResult` interface in `types.ts`. Then follow the compiler errors to update all consumers.
**Warning signs:** TypeScript errors after modifying the interface.

### Pitfall 2: Platt Scaling Producing NaN or Infinity
**What goes wrong:** If Platt parameters A and B produce extreme logit values, `Math.exp()` can overflow to Infinity, making the sigmoid evaluate to 0 or NaN.
**Why it happens:** Poorly fitted parameters from insufficient or unbalanced outcome data.
**How to avoid:** The existing `applyPlattScaling` already clamps: `Math.max(0, Math.min(100, scaled))`. But the `PLATT_MIN_SAMPLES = 50` guard in `fitPlattScaling` prevents fitting on too-small data. Additionally, the sigmoid `1 / (1 + exp(x))` is bounded [0, 1] by definition. The only risk is if A*normalized + B overflows exp(), but JavaScript's `Math.exp` returns Infinity for very large values, making the sigmoid evaluate to ~0, which is then scaled and clamped. This is safe.
**Warning signs:** `overall_score` values clustering near 0 or 100 after calibration is enabled.

### Pitfall 3: Forgetting to Add DB Column for is_calibrated
**What goes wrong:** The API route tries to insert `is_calibrated` into `analysis_results` but the column doesn't exist, causing a Supabase insert error.
**Why it happens:** The field is added to the TypeScript type but not to the database schema.
**How to avoid:** Create a migration adding `is_calibrated BOOLEAN DEFAULT FALSE` to `analysis_results`. Run it before deploying the code change.
**Warning signs:** 500 errors on the analyze endpoint after deployment.

### Pitfall 4: Double-Counting Calibration Cost on Latency
**What goes wrong:** `getPlattParameters()` makes a Supabase query on cache miss, adding latency to the aggregation step.
**Why it happens:** Cold start or cache expiry triggers a DB round-trip.
**How to avoid:** The 24-hour cache TTL makes this a rare event. The query is lightweight (fetch outcome pairs + fit parameters). On Vercel serverless, module-level cache persists within a function instance's lifetime. Accept the rare cold-start cost.
**Warning signs:** Occasional spikes in `latency_ms` on the first prediction after deployment.

### Pitfall 5: Calibration-Audit Cron Already Logs ECE But Silently Skips
**What goes wrong:** The cron appears to "work" but always returns `status: "skipped"` because there are fewer than 50 outcome samples.
**Why it happens:** No users have submitted outcomes yet (product is early).
**How to avoid:** This is expected behavior. The verification criterion should be: "cron completes without throwing" and "when given sufficient data, logs ECE". Test with a fixture of >= 50 dummy outcome rows if end-to-end verification is needed.
**Warning signs:** The cron always returns `{ status: "skipped" }` indefinitely.

## Code Examples

Verified patterns from the existing codebase:

### Wiring getPlattParameters into aggregateScores
```typescript
// Source: aggregator.ts — modification needed at the end of aggregateScores()
import { getPlattParameters, applyPlattScaling } from "./calibration";

// After computing overall_score (line ~291 in current code):
const plattParams = await getPlattParameters();
const calibrated_overall = applyPlattScaling(overall_score, plattParams);
const is_calibrated = plattParams !== null;

// Use calibrated_overall instead of overall_score in the return
return {
  overall_score: calibrated_overall,
  is_calibrated,
  // ... existing fields
};
```

### Adding is_calibrated to PredictionResult
```typescript
// Source: types.ts — add to PredictionResult interface
export interface PredictionResult {
  // Core prediction
  overall_score: number;
  confidence: number;
  confidence_label: ConfidenceLevel;
  is_calibrated: boolean; // CAL-02: whether Platt scaling was applied

  // ... rest of existing fields
}
```

### DB Migration for is_calibrated
```sql
-- Source: new migration file
ALTER TABLE analysis_results
  ADD COLUMN is_calibrated BOOLEAN DEFAULT FALSE;
```

### Propagating is_calibrated in analyze/route.ts
```typescript
// Source: analyze/route.ts — add to the DB insert object (around line 190)
await service.from("analysis_results").insert({
  // ... existing fields
  is_calibrated: finalResult.is_calibrated, // CAL-02
});
```

### Error-Safe getPlattParameters Call
```typescript
// getPlattParameters already handles errors internally via try-catch in the cache layer.
// But if we want extra safety in the aggregator:
let plattParams: PlattParameters | null = null;
try {
  plattParams = await getPlattParameters();
} catch {
  // Calibration lookup failed — proceed uncalibrated
  plattParams = null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No calibration | Platt scaling with conditional application | This phase | Scores will be more accurate once outcome data accumulates |
| No is_calibrated flag | Boolean flag on every prediction | This phase | API consumers can distinguish calibrated vs raw scores |

**Deprecated/outdated:**
- Nothing in this domain is deprecated. Platt scaling is a well-established technique (1999) and remains the standard for post-hoc probability calibration on binary/ordinal classifiers.

## Open Questions

1. **Should Platt scaling apply to individual signal scores or only overall_score?**
   - What we know: Platt scaling is trained on `predicted_score` vs `actual_score` at the aggregate level. The outcomes table stores aggregate-level scores only.
   - What's unclear: None — this is clearly aggregate-only.
   - Recommendation: Apply only to `overall_score`. This is the only score that has a corresponding `actual_score` in the outcomes table.

2. **Should the is_calibrated column in the DB be BOOLEAN or a richer type?**
   - What we know: The requirement says `is_calibrated: boolean`. A boolean is sufficient.
   - What's unclear: Future phases might want to know *which version* of Platt parameters were used.
   - Recommendation: Use BOOLEAN for now (matches requirement). Add `platt_params_fitted_at TIMESTAMPTZ` later if versioning is needed.

3. **What happens to confidence calculation when Platt scaling shifts the overall_score?**
   - What we know: The confidence calculation in `calculateConfidence()` is based on signal availability and model agreement, not the final score. Platt scaling changes the score but not the confidence.
   - What's unclear: Should confidence be higher when calibration is available?
   - Recommendation: Keep confidence independent of calibration status. Calibration improves accuracy, not confidence. If we want to signal trust, `is_calibrated` already serves that purpose.

4. **Does the calibration-audit cron need any modifications for this phase?**
   - What we know: The cron at `/api/cron/calibration-audit/route.ts` is fully implemented. It generates a calibration report, checks ECE drift, re-fits Platt parameters, and invalidates the cache.
   - What's unclear: Nothing — the cron appears complete.
   - Recommendation: Verify it compiles and runs without throwing. The success criterion is "completes without throwing and logs ECE" — with <50 outcomes, it will log the skip message, which is correct behavior.

5. **Does the outcomes endpoint need any modifications?**
   - What we know: POST `/api/outcomes` is fully built with Zod validation, auth, analysis ownership verification, delta calculation, unique constraint handling, and GET with cursor pagination.
   - What's unclear: Nothing — the endpoint appears complete.
   - Recommendation: Verify it works with a curl test (or integration test). The success criterion is "accepts a payload and persists it without error."

## Sources

### Primary (HIGH confidence)
- `/Users/davideloreti/virtuna-backend-reliability/src/lib/engine/calibration.ts` — Complete Platt scaling implementation (getPlattParameters, applyPlattScaling, fitPlattScaling, computeECE, generateCalibrationReport)
- `/Users/davideloreti/virtuna-backend-reliability/src/lib/engine/aggregator.ts` — Current aggregation logic, no calibration wiring present
- `/Users/davideloreti/virtuna-backend-reliability/src/lib/engine/types.ts` — PredictionResult interface (no is_calibrated field yet)
- `/Users/davideloreti/virtuna-backend-reliability/src/app/api/cron/calibration-audit/route.ts` — Full cron implementation with ECE check, Platt refit, cache invalidation
- `/Users/davideloreti/virtuna-backend-reliability/src/app/api/outcomes/route.ts` — Full POST + GET with Zod validation and pagination
- `/Users/davideloreti/virtuna-backend-reliability/src/app/api/analyze/route.ts` — Pipeline + aggregation call chain, DB insert logic
- `/Users/davideloreti/virtuna-backend-reliability/supabase/migrations/20260213000000_content_intelligence.sql` — outcomes table schema (has predicted_score, actual_score, delta)
- `/Users/davideloreti/virtuna-backend-reliability/vercel.json` — calibration-audit cron scheduled at `0 4 1 * *` (monthly, 1st of month at 4 AM)

### Secondary (MEDIUM confidence)
- None needed — this phase is fully within existing codebase patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new libraries. All infrastructure exists.
- Architecture: HIGH — Direct codebase analysis. The wiring points are precisely identified.
- Pitfalls: HIGH — All pitfalls derived from reading the actual code paths and understanding null/error handling.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable — no external dependencies changing)
