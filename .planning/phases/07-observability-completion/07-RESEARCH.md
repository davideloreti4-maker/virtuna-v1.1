# Phase 7: Observability Completion - Research

**Researched:** 2026-02-18
**Domain:** Structured logging migration, unified log schema enforcement
**Confidence:** HIGH

## Summary

Phase 7 is a gap closure phase that finishes the structured logging work started in Phase 4. The structured logger (`src/lib/logger.ts`) and the `createLogger` pattern are already fully established and battle-tested across all engine modules. This phase has three distinct scopes:

1. **Verify** that gemini.ts, deepseek.ts, and pipeline.ts already emit the 4 required fields (requestId, stage, duration_ms, cost_cents) on their happy paths -- source code review confirms they already do, so Plan 07-01 may be a verification-only plan or need minimal adjustments.
2. **Add** `createLogger` to `trends.ts` and `creator.ts` (the only two engine modules without it), and confirm `admin/costs/route.ts` already uses structured logger in its catch block.
3. **Migrate** all 7 cron route handlers and 2 webhook handlers from `console.*` to `createLogger`.

**Primary recommendation:** This is mechanical find-and-replace work with a well-established pattern. No new libraries, no architecture decisions. The only risk is breaking existing tests (logger mock patterns are already in place for trends.ts and creator.ts tests).

## Standard Stack

### Core

No new libraries required. Everything needed is already in the codebase:

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@/lib/logger` | N/A (internal) | Structured JSON logger with child logger pattern | Already exists, fully tested |

### Supporting

None. Zero dependencies for this phase.

### Alternatives Considered

None. The logger is locked by Phase 4 decisions. No alternatives to evaluate.

**Installation:**
```bash
# No installation needed — all tools already in place
```

## Architecture Patterns

### Established Logger Pattern (from Phase 4)

Every module follows this exact pattern:

```typescript
// At module level (for modules with fixed identity):
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "module-name" });

// Inside functions:
log.info("Operation complete", { stage: "stage_name", duration_ms, cost_cents: +cost_cents.toFixed(4) });
log.warn("Soft cap exceeded", { cost_cents, soft_cap: 0.5 });
log.error("Operation failed", { error: error instanceof Error ? error.message : String(error) });
```

For request-scoped loggers (pipeline, analyze route):
```typescript
const log = createLogger({ requestId, module: "pipeline" });
```

### Pattern for Cron/Webhook Routes

Cron and webhook routes should follow the same module-level pattern:

```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/calculate-trends" });

export async function GET(request: Request) {
  // Replace: console.error("[calculate-trends] Fetch error:", fetchError);
  // With:   log.error("Fetch error", { error: fetchError.message });

  // Replace: console.log(`[calculate-trends] Processed ${n} videos...`);
  // With:   log.info("Processed videos", { videos: n, sounds: m, upserted: k });
}
```

**Key convention:** The `[module-name]` prefix used in existing console.log calls becomes the `module` binding in `createLogger`. Structured data replaces string interpolation.

### Anti-Patterns to Avoid

- **String interpolation in log messages:** Don't `log.info(\`Processed ${n} videos\`)`. Use `log.info("Processed videos", { count: n })`.
- **Logging raw error objects:** Always use `error instanceof Error ? error.message : String(error)` for JSON serialization safety (established decision from 04-03).
- **Forgetting to import createLogger:** Every file that logs must import from `@/lib/logger`.

## Current State Analysis

### Plan 07-01: gemini.ts, deepseek.ts, pipeline.ts — Stage Completion Logs

**Finding (HIGH confidence — verified from source code):**

All three files ALREADY emit the required 4-field log entries:

**gemini.ts** (lines 367-372):
```typescript
log.info("Text analysis complete", {
  stage: "gemini_text_analysis",
  duration_ms,
  cost_cents: +cost_cents.toFixed(4),
  model: GEMINI_MODEL,
});
```
Also emits for video analysis (lines 507-512) with `stage: "gemini_video_analysis"`.

**deepseek.ts** (lines 507-512):
```typescript
log.info("Reasoning complete", {
  stage: "deepseek_reasoning",
  duration_ms,
  cost_cents: +cost_cents.toFixed(4),
  model: DEEPSEEK_MODEL,
});
```
Also emits for Gemini fallback (lines 608-611) with duration_ms and cost_cents.

**pipeline.ts** (lines 383-388):
```typescript
log.info("Pipeline complete", {
  stage: "pipeline",
  duration_ms: total_duration_ms,
  cost_cents: +total_cost_cents.toFixed(4),
  warnings_count: warnings.length,
});
```
Pipeline logger already includes `requestId` from the `createLogger({ requestId, module: "pipeline" })` binding.

**NOTE:** The `requestId` field is provided via logger bindings (set at logger creation time), not as a per-call data field. This is the correct pattern per the emit() design (04-02 decision: "emit() separates bindings from per-call data for efficient child logger pattern").

**Assessment:** Plan 07-01 may be a pure verification plan. All three files already satisfy SC-1 and SC-2. The planner should confirm this and either make it a verification-only plan or identify any edge cases (e.g., the DeepSeek->Gemini fallback log on line 608 does not include `stage` field — only `duration_ms` and `cost_cents`).

**One gap identified:** The DeepSeek Gemini fallback log (line 608) says `"DeepSeek->Gemini fallback complete"` but does NOT include a `stage` field. It has `duration_ms` and `cost_cents` but is missing `stage`. This should be added: `stage: "deepseek_gemini_fallback"`.

### Plan 07-02: trends.ts, creator.ts, admin/costs catch block

**Finding (HIGH confidence — verified from source code):**

**trends.ts:** Does NOT import or use `createLogger`. Zero logging calls anywhere in the file. It uses:
- `@/lib/supabase/service` (imported via parameter)
- `@/lib/cache` for caching
- `./fuzzy` for matching

Needs: Import `createLogger`, create module-level logger, add structured log calls for:
- Trending sounds fetch/cache status
- Match results summary
- Hashtag scoring summary

Test file (`trends.test.ts`) already mocks `@/lib/logger` with the correct mock shape. No test changes needed.

**creator.ts:** Does NOT import or use `createLogger`. Zero logging calls anywhere in the file. It uses:
- `@/lib/supabase/service` (imported via parameter)
- `@/lib/cache` for caching

Needs: Import `createLogger`, create module-level logger, add structured log calls for:
- Platform averages fetch/cache status
- Creator profile lookup result
- Fallback to defaults scenarios

Test file (`creator.test.ts`) already mocks `@/lib/logger` with the correct mock shape. No test changes needed.

**admin/costs/route.ts:** ALREADY uses `createLogger` correctly. Has:
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "admin/costs" });
```
And the catch block (line 90) already uses:
```typescript
log.error("Failed to aggregate costs", {
  error: error instanceof Error ? error.message : String(error),
});
```

**Assessment:** Plan 07-02 work is needed for `trends.ts` and `creator.ts`. The `admin/costs/route.ts` part is already done -- SC-4 is already satisfied. Planner should note this to avoid unnecessary work.

### Plan 07-03: Cron and Webhook Migration

**Finding (HIGH confidence — verified from source code):**

There are **7 cron routes** (not 6 as the phase description states) and **2 webhook routes**:

| Route | console.* calls | Types |
|-------|-----------------|-------|
| `cron/calculate-trends` | 4 | error(2), log(1), error(1) |
| `cron/calibration-audit` | 6 | log(3), warn(1), log(1), error(1) |
| `cron/refresh-competitors` | 2 | error(2) |
| `cron/scrape-trending` | 3 | warn(1), log(1), error(1) |
| `cron/validate-rules` | 6 | error(4), log(1), error(1) |
| `cron/sync-whop` | 3 | error(3) |
| `cron/retrain-ml` | 7 | error(1), log(4), warn(1), error(1) |
| `webhooks/apify` | 4 | warn(1), error(1), log(1), error(1) |
| `webhooks/whop` | 8 | warn(3), error(3), log(1), error(1) |

**Total: 43 console.* calls across 9 files to migrate.**

Each route needs:
1. `import { createLogger } from "@/lib/logger";`
2. `const log = createLogger({ module: "cron/route-name" });` at module level
3. Replace each `console.error(...)` with `log.error(...)` using structured data
4. Replace each `console.log(...)` with `log.info(...)` using structured data
5. Replace each `console.warn(...)` with `log.warn(...)` using structured data

**Migration complexity per route:**

- **Simple** (2-3 calls): `refresh-competitors`, `sync-whop`, `scrape-trending`
- **Medium** (4-6 calls): `calculate-trends`, `calibration-audit`, `validate-rules`, `webhooks/apify`
- **Complex** (7-8 calls): `retrain-ml`, `webhooks/whop`

**Whop webhook note:** The whop webhook has `console.warn` calls with two arguments (message string + data object). These translate naturally to `log.warn(message, data)`.

**No existing tests for cron/webhook routes.** These routes are not unit-tested. The only verification is `pnpm build` (TypeScript compilation) and `pnpm test` (existing engine tests still pass).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging | Custom console wrapper | `@/lib/logger.ts` (already built) | Phase 4 built this; reuse it exactly |
| JSON serialization of errors | `JSON.stringify(error)` | `error instanceof Error ? error.message : String(error)` | Error objects don't stringify cleanly; this pattern is established |

**Key insight:** This entire phase is about applying an existing pattern consistently. There is nothing to build, only to apply.

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests
**What goes wrong:** Adding `createLogger` import to a file that already has test mocks for it is fine, but forgetting to mock it in a file that didn't have it before causes test failures.
**Why it happens:** `createLogger` is called at module import time (module-level `const log = createLogger(...)`)
**How to avoid:** Check if the test file already mocks `@/lib/logger`. For `trends.ts` and `creator.ts`, the mocks are already in place. For cron/webhook routes, there are no tests to break.
**Warning signs:** `TypeError: createLogger is not a function` in test output.

### Pitfall 2: String Interpolation Instead of Structured Data
**What goes wrong:** Converting `console.log(\`[route] Processed ${n} items\`)` to `log.info(\`Processed ${n} items\`)` preserves human-readable format but loses structured queryability.
**Why it happens:** Mechanical find-and-replace without restructuring the data.
**How to avoid:** Always extract variables into the data object: `log.info("Processed items", { count: n })`.
**Warning signs:** Log messages containing template literals or concatenation.

### Pitfall 3: Logging Raw Supabase Error Objects
**What goes wrong:** Passing a Supabase error object directly to the logger. These objects may contain circular references or excessive nesting.
**Why it happens:** Old code does `console.error("Failed:", error)` where `error` is a Supabase PostgrestError.
**How to avoid:** Always use `error.message` for Supabase errors (PostgrestError has a `.message` string property). Pattern: `log.error("Operation failed", { error: error.message })`.
**Warning signs:** `[object Object]` in log output, or circular reference errors.

### Pitfall 4: Inconsistent Module Names
**What goes wrong:** Using `cron/calculate_trends` vs `calculate-trends` vs `cron:calculate-trends` across different routes.
**Why it happens:** No enforced convention for module binding values.
**How to avoid:** Use consistent naming: `cron/<route-name>` for cron routes, `webhook/<provider>` for webhooks. Match the URL path segment.
**Warning signs:** Difficulty filtering logs by module in production.

### Pitfall 5: Count Mismatch — "6 Cron Routes" vs Reality
**What goes wrong:** Phase description says "6 cron route handlers" but there are actually 7 (`calculate-trends`, `calibration-audit`, `refresh-competitors`, `scrape-trending`, `validate-rules`, `sync-whop`, `retrain-ml`).
**Why it happens:** Count was off in the original audit.
**How to avoid:** Planner should target all 7, not 6.
**Warning signs:** One cron route left with console.* calls after migration.

## Code Examples

### Example 1: Cron Route Migration (calculate-trends)

Before:
```typescript
console.error("[calculate-trends] Fetch error:", fetchError);
console.error(`[calculate-trends] Upsert error (offset ${i}):`, error);
console.log(`[calculate-trends] Processed ${videos.length} videos into ${trendRecords.length} sounds (${upsertedCount} upserted)`);
console.error("[calculate-trends] Failed:", error);
```

After:
```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "cron/calculate-trends" });

// In handler:
log.error("Fetch error", { error: fetchError.message });
log.error("Upsert error", { offset: i, error: error.message });
log.info("Trends calculated", { videos: videos.length, sounds: trendRecords.length, upserted: upsertedCount });
log.error("Failed", { error: error instanceof Error ? error.message : String(error) });
```

### Example 2: Webhook Route Migration (whop)

Before:
```typescript
console.warn("membership.went_valid: missing supabase_user_id in metadata", { whop_user_id: data.user_id, membership_id: data.id });
console.error("Failed to upsert subscription:", error);
console.log("Unknown webhook event:", event);
console.error("Webhook handler error:", error);
```

After:
```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "webhook/whop" });

log.warn("Missing supabase_user_id in metadata", { event: "membership.went_valid", whop_user_id: data.user_id, membership_id: data.id });
log.error("Failed to upsert subscription", { error: error.message });
log.info("Unknown webhook event", { event });
log.error("Webhook handler error", { error: error instanceof Error ? error.message : String(error) });
```

### Example 3: Adding Logger to trends.ts

```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "trends" });

// Inside enrichWithTrends, after computing results:
log.info("Trend enrichment complete", {
  matched_sounds: matched_trends.length,
  hashtag_count: hashtags.length,
  trend_score: normalizedScore,
  hashtag_relevance: +hashtag_relevance.toFixed(3),
});
```

### Example 4: Adding Logger to creator.ts

```typescript
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "creator" });

// Inside fetchCreatorContext, after lookup:
log.info("Creator context resolved", {
  found: !!profile,
  creator_handle: creator_handle ?? "none",
});
```

## Pre-Existing State Summary

| File | Has createLogger? | Has console.*? | Action Needed |
|------|-------------------|----------------|---------------|
| `gemini.ts` | YES | NO | Verify 4-field log entries (SC-1) |
| `deepseek.ts` | YES | NO | Add `stage` field to fallback log (minor) |
| `pipeline.ts` | YES | NO | Verify cost_cents in "Pipeline complete" log (SC-2) |
| `trends.ts` | NO | NO | Add createLogger + structured logs (SC-3) |
| `creator.ts` | NO | NO | Add createLogger + structured logs (SC-3) |
| `admin/costs/route.ts` | YES | NO | Already done (SC-4 satisfied) |
| `cron/calculate-trends` | NO | YES (4) | Full migration (SC-5) |
| `cron/calibration-audit` | NO | YES (6) | Full migration (SC-5) |
| `cron/refresh-competitors` | NO | YES (2) | Full migration (SC-5) |
| `cron/scrape-trending` | NO | YES (3) | Full migration (SC-5) |
| `cron/validate-rules` | NO | YES (6) | Full migration (SC-5) |
| `cron/sync-whop` | NO | YES (3) | Full migration (SC-5) |
| `cron/retrain-ml` | NO | YES (7) | Full migration (SC-5) |
| `webhooks/apify` | NO | YES (4) | Full migration (SC-5) |
| `webhooks/whop` | NO | YES (8) | Full migration (SC-5) |

## Open Questions

1. **Plan 07-01 scope — verification only?**
   - What we know: gemini.ts, deepseek.ts, and pipeline.ts already emit stage/duration_ms/cost_cents logs. The one gap is the DeepSeek Gemini fallback log missing `stage` field.
   - What's unclear: Whether the planner should make this a full plan with tasks or a lightweight verification plan with one minor fix.
   - Recommendation: Make it a lightweight plan. One task to add `stage: "deepseek_gemini_fallback"` to the fallback log in deepseek.ts, plus verification that the other logs are correct. Run `pnpm test` to confirm no regressions.

2. **7 cron routes vs "6" in phase description**
   - What we know: There are 7 cron route directories under `src/app/api/cron/`.
   - What's unclear: Whether the original count intentionally excluded one (perhaps `retrain-ml` was considered already covered).
   - Recommendation: Migrate all 7 to be thorough. The phase description count was likely a miscount.

3. **Broader console.* calls beyond scope**
   - What we know: There are 46 files in `src/` with `console.*` calls, but Phase 7 scope is limited to: engine modules, admin/costs, cron routes, webhook routes.
   - What's unclear: Whether broader migration (API routes, components, etc.) is desired.
   - Recommendation: Strictly follow Phase 7 file ownership list. Other files (components, non-engine API routes) are out of scope for this milestone.

## Sources

### Primary (HIGH confidence)
- Source code inspection of all 15 target files in the codebase
- Phase 4 plans (04-02-PLAN.md, 04-03-PLAN.md) for established logger patterns
- STATE.md accumulated decisions for prior logging decisions
- Existing test files for mock patterns (trends.test.ts, creator.test.ts)

### Secondary (MEDIUM confidence)
- None needed — this is internal codebase analysis only

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, everything already exists
- Architecture: HIGH — pattern is established across 8+ engine modules
- Pitfalls: HIGH — common migration issues are well-understood
- Current state: HIGH — all 15 files were read and analyzed directly

**Research date:** 2026-02-18
**Valid until:** N/A (internal codebase analysis, valid as long as source unchanged)
