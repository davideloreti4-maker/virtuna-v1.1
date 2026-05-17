# Phase 3: Pipeline Infrastructure - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 12 (8 new files, 4 modified files)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/version.ts` (new) | constant module | static export | `src/lib/engine/aggregator.ts:17` (current ENGINE_VERSION) | role-match (constant module pattern) |
| `src/lib/engine/events.ts` (new) | type definitions + helper | type-only (no I/O) | `src/lib/engine/types.ts:255-263` (Zod schema + inferred type) | role-match (type module) |
| `src/lib/engine/cache/prediction-cache.ts` (new) | cache service | request-response w/ DB fallback | `src/lib/engine/creator.ts:27-100` (createCache + Supabase SELECT) | exact |
| `src/lib/engine/wave0.ts` (new stub) | pipeline stage | event-driven | `src/lib/engine/normalize.ts:39-64` (simple stage export) | role-match (typed stage module) |
| `src/lib/engine/wave3.ts` (new stub) | pipeline stage | event-driven | `src/lib/engine/normalize.ts:39-64` | role-match |
| `src/lib/engine/stage10-critique.ts` (new stub) | post-aggregation hook | event-driven | `src/lib/engine/normalize.ts:39-64` | role-match |
| `src/lib/engine/stage11-counterfactuals.ts` (new stub) | post-aggregation hook | event-driven | `src/lib/engine/normalize.ts:39-64` | role-match |
| `src/lib/engine/pipeline.ts` (modify) | orchestrator | streaming events | self (extend in place) | exact |
| `src/lib/engine/aggregator.ts` (modify) | scoring + provenance | transform | self (extend in place — keep math untouched) | exact |
| `src/lib/engine/deepseek.ts` (modify) | LLM call + telemetry | request-response | self (extend usage-field read in place) | exact |
| `src/app/api/analyze/route.ts` (modify) | route + SSE writer | streaming + JSON | self (extend in place — Accept-header branch + cache check) | exact |
| `supabase/migrations/<ts>_phase3_pipeline_columns.sql` (new) | DB migration | DDL | `supabase/migrations/20260216000000_v2_schema_expansion.sql` (analysis_results column additions) | exact |
| `src/types/database.types.ts` (regenerate) | type-gen output | generated | N/A — output of `npx supabase gen types typescript` | N/A (regenerate, no manual pattern) |

---

## Pattern Assignments

### `src/lib/engine/version.ts` (constant module, static export)

**Analog:** `src/lib/engine/aggregator.ts` (the existing home of `ENGINE_VERSION`)

**Current location** (`src/lib/engine/aggregator.ts:1-17`):
```typescript
import type {
  ConfidenceLevel,
  Factor,
  FeatureVector,
  PredictedEngagement,
  PredictionResult,
  RuleScoreResult,
  Suggestion,
  TrendEnrichment,
} from "./types";
import type { PipelineResult } from "./pipeline";
import { GEMINI_MODEL } from "./gemini";
import { DEEPSEEK_MODEL } from "./deepseek";
import { predictWithML, featureVectorToMLInput } from "./ml";
import { getPlattParameters, applyPlattScaling, type PlattParameters } from "./calibration";

export const ENGINE_VERSION = "2.1.0";
```

**What to copy:**
- Top-level `export const ENGINE_VERSION` declaration shape (single literal string).
- Naming convention: ALL_CAPS for the constant.

**What to adapt:**
- New value: `"3.0.0-dev"` (per D-05; flips to `"3.0.0"` at Phase 12 gate).
- File is a **leaf module** — imports nothing project-local. Avoids Pitfall 8 (circular import).
- After move, `aggregator.ts` line 17 changes to `import { ENGINE_VERSION } from "./version"; export { ENGINE_VERSION };` (re-export for back-compat — every existing `import { ENGINE_VERSION } from "./aggregator"` keeps working).

---

### `src/lib/engine/events.ts` (type definitions + helper)

**Analog:** `src/lib/engine/types.ts:185-263` (Zod schemas + `z.infer` typed exports)

**Imports + Zod schema pattern** (`src/lib/engine/types.ts:185-263`):
```typescript
// =====================================================
// Zod Schemas for LLM Response Validation (ENGINE-07)
// =====================================================

export const FactorSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string(),
  improvement_tip: z.string(),
});

// ... composed schemas ...

export const DeepSeekResponseSchema = z.object({
  behavioral_predictions: BehavioralPredictionsSchema,
  component_scores: ComponentScoresSchema,
  suggestions: z.array(SuggestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
  confidence: z.enum(["high", "medium", "low"]),
});

export type DeepSeekReasoning = z.infer<typeof DeepSeekResponseSchema>;
```

**What to copy:**
- File-header banner pattern (`// ===` boxes).
- `export const SchemaName = z.object(...)` + `export type Name = z.infer<typeof SchemaName>` paired idiom.
- Module-init `import { z } from "zod"`.

**What to adapt:**
- No existing `z.discriminatedUnion` in codebase — Phase 3 introduces it (per RESEARCH Pattern 1 / CONTEXT D-02). New shape:
  ```typescript
  export const StageEventSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("stage_start"),
      stage: z.string(),
      wave: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal("aggregator"), z.literal("post")]),
      timestamp_ms: z.number(),
    }),
    z.object({
      type: z.literal("stage_end"),
      stage: z.string(),
      wave: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal("aggregator"), z.literal("post")]),
      duration_ms: z.number(),
      cost_cents: z.number(),
      ok: z.boolean(),
      warning: z.string().optional(),
    }),
    z.object({
      type: z.literal("pipeline_warning"),
      message: z.string(),
      stage: z.string().optional(),
    }),
  ]);
  export type StageEvent = z.infer<typeof StageEventSchema>;
  export type StageEventCallback = (event: StageEvent) => void;
  ```
- The `StageEvent` type is consumed server-side internally; runtime parsing is OPTIONAL (RESEARCH "Don't Hand-Roll" table — pure TS type narrows enough). Plan may export just the TS type and skip Zod if simpler.

---

### `src/lib/engine/cache/prediction-cache.ts` (cache service, request-response w/ DB fallback)

**Analog:** `src/lib/engine/creator.ts:27-100` — best match for two-tier cache (in-memory L1 + Supabase fallback).

**Imports pattern** (`src/lib/engine/creator.ts:1-5`):
```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { createCache } from "@/lib/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "creator" });
```

**L1 + Supabase SELECT + fallback pattern** (`src/lib/engine/creator.ts:26-63`):
```typescript
// Platform averages cache with 24h TTL — averages change slowly
const platformAveragesCache = createCache<CreatorContext["platform_averages"]>(24 * 60 * 60 * 1000);

async function getPlatformAverages(
  supabase: ReturnType<typeof createServiceClient>
): Promise<CreatorContext["platform_averages"]> {
  const CACHE_KEY = "platform_averages";
  const cached = platformAveragesCache.get(CACHE_KEY);
  if (cached) return cached;

  const FALLBACK: CreatorContext["platform_averages"] = { /* ... */ };

  const { data: videos, error } = await supabase
    .from("scraped_videos")
    .select("views, likes, comments, shares")
    .gt("views", 0)
    .limit(5000);

  if (error || !videos || videos.length === 0) {
    log.debug("Platform averages fallback", { reason: error ? "db_error" : "no_data" });
    platformAveragesCache.set(CACHE_KEY, FALLBACK);
    return FALLBACK;
  }
  // ... compute + hydrate L1 ...
  platformAveragesCache.set(CACHE_KEY, result);
  return result;
}
```

**Cached-null guard pattern** (`src/lib/engine/calibration.ts:299-335`):
```typescript
/**
 * Wrapper to distinguish "not in cache" (null) from "cached null result"
 * (insufficient data). Without this, a null PlattParameters would cause
 * cache.get() to return null, which looks like a miss, triggering re-fetch
 * on every call.
 */
interface PlattCacheEntry {
  params: PlattParameters | null;
}

/** 24-hour TTL cache for fitted Platt parameters */
const plattCache = createCache<PlattCacheEntry>(24 * 60 * 60 * 1000);

const PLATT_CACHE_KEY = "platt-params";

export async function getPlattParameters(): Promise<PlattParameters | null> {
  const cached = plattCache.get(PLATT_CACHE_KEY);
  if (cached !== null) {
    return cached.params;
  }
  const supabase = createServiceClient();
  const pairs = await fetchOutcomePairs(supabase);
  const params = fitPlattScaling(pairs);

  plattCache.set(PLATT_CACHE_KEY, { params });
  return params;
}
```

**What to copy:**
- `const L1 = createCache<PredictionResult>(24 * 60 * 60 * 1000)` — same TTL as `creator.ts:27` and `calibration.ts:310`.
- Module-init logger via `createLogger({ module: "prediction-cache" })`.
- `createServiceClient()` for L2 SELECT (already used by `creator.ts:53` and `calibration.ts:329`).
- L1 lookup → DB SELECT → hydrate L1 → return flow.
- Cached-null wrapper if `null` results need to be cached (e.g., to avoid re-fetching when L2 also misses — optional for prediction-cache; planner decides).

**What to adapt:**
- L2 query targets `analysis_results` (not `scraped_videos`); use:
  ```typescript
  const cutoff = new Date(Date.now() - L1_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("content_hash", contentHash)
    .eq("engine_version", ENGINE_VERSION)
    .eq("user_id", userId)
    .gt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  ```
- Composite key format: `${contentHash}::${ENGINE_VERSION}::${userId}` (string-template per RESEARCH "Don't Hand-Roll" — deterministic, debuggable).
- Add `rowToPredictionResult(row)` helper for L2-hit row → `PredictionResult` rehydration (per RESEARCH Open Question 2). Use Zod parse on JSONB columns (Pitfall 5).
- `bypassCache: true` must skip BOTH read AND write (Pitfall 6).
- Export `lookupPredictionCache`, `populatePredictionCache`, and `computeContentHash` from this module (or split `computeContentHash` into a hashing helper — planner's choice).

---

### `src/lib/engine/wave0.ts`, `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts` (4 no-op stubs)

**Analog:** `src/lib/engine/normalize.ts:39-64` — minimal pure-function stage module, single export, no DB I/O.

**Module-shape pattern** (`src/lib/engine/normalize.ts:1-40`):
```typescript
import type { AnalysisInput, ContentPayload } from "./types";

/**
 * Extract hashtags from text content.
 * Matches #word patterns, returns lowercase unique list.
 */
function extractHashtags(text: string): string[] {
  // ...
}

/**
 * Normalize AnalysisInput into ContentPayload for pipeline consumption.
 * [doc block]
 */
export function normalizeInput(input: AnalysisInput): ContentPayload {
  const contentText = input.content_text ?? "";
  // ...
}
```

**Event emission pattern** (synthesized from RESEARCH Code Examples + pipeline.ts:59-71 `timed()`):
```typescript
// src/lib/engine/wave0.ts — NEW
import type { ContentPayload } from "./types";
import type { StageEventCallback } from "./events";

export interface Wave0Result {
  content_type: string | null;     // Phase 4 fills
  niche: { primary: string; sub: string; micro: string } | null;  // Phase 4 fills
}

export async function runWave0(
  payload: ContentPayload,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const start = performance.now();
  onEvent?.({ type: "stage_start", stage: "wave_0_content_type", wave: 0, timestamp_ms: start });
  onEvent?.({ type: "stage_start", stage: "wave_0_niche_detector", wave: 0, timestamp_ms: start });

  // No-op — Phase 4 swaps with real V3 calls
  const result: Wave0Result = { content_type: null, niche: null };

  const end = performance.now();
  onEvent?.({
    type: "stage_end",
    stage: "wave_0_content_type",
    wave: 0,
    duration_ms: Math.round(end - start),
    cost_cents: 0,
    ok: true,
  });
  onEvent?.({
    type: "stage_end",
    stage: "wave_0_niche_detector",
    wave: 0,
    duration_ms: Math.round(end - start),
    cost_cents: 0,
    ok: true,
  });

  return result;
}
```

**What to copy:**
- Single `export async function run<StageName>(...)` shape from `normalize.ts:39`.
- Type-only imports from sibling modules (`./types`, `./events`).
- Module-init logger pattern from other engine files (skip if stub never logs).

**What to adapt:**
- Each stub returns a typed shape from `types.ts` (Phase 3 adds): `Wave0Result`, `PersonaSimulationResult[]`, `CritiqueResult | null`, `CounterfactualResult | null` (per CONTEXT D-19).
- Wave 0 stub emits **2 start + 2 end** events (content_type + niche_detector — fine-grained per D-01 / D-16).
- Wave 3 stub emits **1 start + 1 end** for `wave_3_personas` (D-17), returns `[]`.
- Stage 10 / 11 stubs each emit **1 start + 1 end** for `stage_10_critique` / `stage_11_counterfactuals` (D-18), return `null`.
- Use `performance.now()` for timestamps (NOT `Date.now()` — Anti-pattern in RESEARCH; matches `pipeline.ts:64` `timed()`).
- All four stubs return `cost_cents: 0` on `stage_end` (no LLM calls).

---

### `src/lib/engine/pipeline.ts` (modify — orchestrator, streaming events)

**Analog:** itself — extend in place. Established patterns to preserve verbatim.

**`timed()` wrapper** (current, lines 59-71):
```typescript
async function timed<T>(
  name: string,
  timings: StageTiming[],
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings.push({
    stage: name,
    duration_ms: Math.round(performance.now() - start),
  });
  return result;
}
```

**Options-bag entry point** (current, lines 172-178):
```typescript
export async function runPredictionPipeline(
  input: AnalysisInput,
  opts?: { requestId?: string }
): Promise<PipelineResult> {
  const requestId = opts?.requestId ?? nanoid(12);
  const log = createLogger({ requestId, module: "pipeline" });
  log.info("Pipeline started", { input_mode: input.input_mode });
```

**Wave parallelism pattern** (current, lines 313-318):
```typescript
// Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03)
const [geminiResult, audioResult, creatorContext, ruleResult] = await timed(
  "wave_1",
  timings,
  () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise])
);
```

**Graceful-degradation pattern at every stage** (current, lines 277-292):
```typescript
const creatorPromise = (async (): Promise<CreatorContext> => {
  try {
    return await timed("creator_context", timings, () =>
      fetchCreatorContext(supabase, payload.creator_handle, payload.niche)
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "creator_context", requestId },
    });
    warnings.push(
      `Creator context unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "creator_context", duration_ms: 0 });
    return DEFAULT_CREATOR_CONTEXT;
  }
})();
```

**What to copy:**
- Keep `timed()` wrapping every stage — Phase 3 adds events at the same boundaries (D-01).
- Keep graceful-degradation try/catch + warnings.push pattern at every non-critical stage.
- Keep `Sentry.captureException` + `Sentry.addBreadcrumb` at wave-completion points (lines 320-326).
- Keep `Promise.all` wave parallelism.

**What to adapt:**
- Extend options bag: `opts?: PipelineOptions` where `PipelineOptions = { requestId?, onStageEvent?, bypassCache? }` (RESEARCH Pattern 1).
- Refactor `timed()` to take wave label + emit callback (RESEARCH Pattern 1):
  ```typescript
  async function timed<T>(
    name: string,
    wave: StageEvent["wave"],
    timings: StageTiming[],
    onEvent: StageEventCallback | undefined,
    fn: () => Promise<T>,
    costCents: number = 0
  ): Promise<T> { ... }
  ```
  All existing call sites get an updated wave label argument; behavior with `onEvent === undefined` is byte-identical (CONTEXT D-04).
- Insert `await runWave0(payload, opts?.onStageEvent)` BEFORE Wave 1 `Promise.all` (D-16, integration point in CONTEXT `code_context`).
- Insert `await runWave3(payload, deepseekResult, opts?.onStageEvent)` AFTER Wave 2 `Promise.all` (D-17).
- (Stage 10 / 11 stubs live in `aggregator.ts` flow, not `pipeline.ts` — see aggregator entry below; or wrap them in `pipeline.ts` after aggregator call per D-18, planner picks.)
- Surface `signal_availability` on `PredictionResult` so the route can persist without recomputing (CONTEXT `code_context` → "Aggregator ⟷ `signal_availability`").

---

### `src/lib/engine/aggregator.ts` (modify — scoring + provenance)

**Analog:** itself — extend in place. **DO NOT touch math** (CONTEXT `code_context` "NO changes to").

**Existing `SignalAvailability` interface** (current, lines 35-41):
```typescript
interface SignalAvailability {
  behavioral: boolean; // DeepSeek produced component scores
  gemini: boolean;     // Gemini produced real factor scores (false when using fallback — HARD-03)
  ml: boolean;         // ML model loaded and prediction succeeded
  rules: boolean;      // Rule scoring produced real matches (not default fallback)
  trends: boolean;     // Trend enrichment found matches (not default fallback)
}
```

**Existing availability computation** (current, lines 287-302):
```typescript
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules:
    ruleResult.matched_rules.length > 0 &&
    !pipelineResult.warnings.some((w) =>
      w.includes("Rule scoring unavailable")
    ),
  trends:
    trendEnrichment.matched_trends.length > 0 &&
    !pipelineResult.warnings.some((w) =>
      w.includes("Trend enrichment unavailable")
    ),
};
```

**Existing return shape** (current, lines 466-491):
```typescript
return {
  overall_score,
  confidence: conf.confidence,
  // ... 20+ fields ...
  engine_version: ENGINE_VERSION,
  // ...
};
```

**What to copy:**
- Keep `SignalAvailability` interface shape verbatim (D-07 — 5 keys this phase).
- Keep all weight tables, calibration, confidence math untouched.
- Keep `engine_version: ENGINE_VERSION` field on return.

**What to adapt:**
- Replace local `export const ENGINE_VERSION` (line 17) with `import + re-export`:
  ```typescript
  import { ENGINE_VERSION } from "./version";
  export { ENGINE_VERSION }; // back-compat for any external `import { ENGINE_VERSION } from "./aggregator"`
  ```
- **Export** the `SignalAvailability` interface (currently `interface`, not `export interface`) so route + cache module can import it (Pitfall 5 — pair with Zod schema if reading from DB).
- Add `signal_availability: availability` field to the returned `PredictionResult` so the route writes it directly to the new column without recomputing (CONTEXT `code_context` integration point).
- Optional: invoke `stage10_critique(result)` + `stage11_counterfactuals(result)` stubs at end of `aggregateScores()` (D-18 — planner picks pipeline.ts vs aggregator.ts).
- Update `PredictionResult` type in `types.ts:141-183` to ADD `signal_availability: SignalAvailability` field (additive only).

---

### `src/lib/engine/deepseek.ts` (modify — LLM call + telemetry)

**Analog:** itself — extend in place.

**Existing `ai.chat.completions.create` call** (current, lines 477-484):
```typescript
const response = await ai.chat.completions.create(
  {
    model: DEEPSEEK_MODEL,
    messages: [{ role: "user", content: userMessage }],
    response_format: { type: "json_object" },
  },
  { signal: controller.signal }
);
```

**Existing cost-calculation pattern** (current, lines 232-240):
```typescript
function calculateDeepSeekCost(
  promptTokens: number | undefined,
  completionTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = completionTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}
```

**Existing prompt-build site** (current, lines 305-436): `buildDeepSeekPrompt(context, calibration)` interpolates calibration percentile values directly into the prompt body — **Pitfall 3 alert** (calibration changes invalidate the cache prefix).

**What to copy:**
- Keep the `openai` client init (`getClient()` lines 147-157) — no changes.
- Keep circuit breaker + Gemini fallback unchanged.
- Keep the `response.usage?.prompt_tokens` / `completion_tokens` read pattern.

**What to adapt:**
- **NO `Cache-Control` header on the call** — DeepSeek caching is automatic (RESEARCH "Pattern 4" + Pitfall 3 + Anti-Patterns + "Don't Hand-Roll"). The lever is **prompt prefix stability**.
- Restructure `buildDeepSeekPrompt`:
  - Move the 5-step rubric (`## 5-Step Reasoning Framework` through `## Output Format`) into a **stable system message** that is byte-identical across calls.
  - Move calibration percentiles + dynamic content (creator context, content_text, gemini signals, matched rule names, trend context) into the **volatile user message**, which goes AFTER the system message.
  - Switch the `messages` array to `[{ role: "system", content: STABLE_SYSTEM_PROMPT }, { role: "user", content: userMessage }]`.
- Read DeepSeek cache telemetry:
  ```typescript
  const cacheHitTokens = response.usage?.prompt_cache_hit_tokens ?? 0;
  const cacheMissTokens = response.usage?.prompt_cache_miss_tokens ?? 0;
  log.info("DeepSeek cache telemetry", {
    cache_hit_tokens: cacheHitTokens,
    cache_miss_tokens: cacheMissTokens,
    cache_hit_rate: cacheHitTokens / Math.max(1, cacheHitTokens + cacheMissTokens),
  });
  ```
- Cost-math update for cache-hit pricing (RESEARCH Pattern 4 — but flag as `[ASSUMED]` per Assumption A1 / Open Question 1):
  ```typescript
  const CACHE_HIT_PRICE_PER_TOKEN = 0.0028 / 1_000_000;
  const CACHE_MISS_PRICE_PER_TOKEN = 0.14 / 1_000_000;
  // cost = hit_tokens * hit_price + miss_tokens * miss_price + output_tokens * output_price
  ```
- The Gemini fallback path (`reasonWithGeminiFallback`, lines 580-627) does NOT benefit from DeepSeek cache — leave its cost math unchanged.

---

### `src/app/api/analyze/route.ts` (modify — route + SSE writer + JSON branch)

**Analog:** itself — extend in place. Multiple sub-patterns from current file.

**Existing SSE encoder** (current, lines 154-162):
```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: unknown) => {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    };
```

**Existing pipeline-call pattern** (current, lines 167-179):
```typescript
send("phase", {
  phase: "analyzing",
  message: "Analyzing content with Gemini and loading creator context...",
});
const pipelineResult = await runPredictionPipeline(validated, { requestId });

send("phase", { phase: "scoring", message: "..." });
const result = await aggregateScores(pipelineResult);
```

**Existing analysis_results INSERT** (current, lines 197-228):
```typescript
const { error: insertError } = await service.from("analysis_results").insert({
  user_id: user.id,
  content_text: validated.content_text ?? "",
  content_type: validated.content_type,
  // ... 20+ fields ...
  engine_version: finalResult.engine_version,
  gemini_model: finalResult.gemini_model,
  deepseek_model: finalResult.deepseek_model,
  // v2 columns
  behavioral_predictions: finalResult.behavioral_predictions as unknown as null,
  feature_vector: finalResult.feature_vector as unknown as null,
  // ...
});
```

**Existing response headers** (current, lines 266-272):
```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

**What to copy:**
- Auth pattern (lines 36-44) — no change.
- INFRA-04 input validation (lines 49-109) — no change.
- INFRA-01 rate limiting (lines 113-149) — no change.
- `send(event, data)` SSE helper inside `ReadableStream.start` — reuse verbatim.
- `service.from("analysis_results").insert({...})` INSERT idiom — extend with new columns.
- Usage tracking + storage cleanup (lines 235-255) — no change.

**What to adapt:**
- **Add route segment config at top of file** (RESEARCH Pitfall 1 + 2):
  ```typescript
  export const runtime = "nodejs";     // SSE requires nodejs runtime, not edge
  export const dynamic = "force-dynamic"; // prevent Vercel route caching of stream
  export const maxDuration = 300;      // bump from 120 → 300 for Fluid Compute default
  ```
- **Add Accept-header content negotiation** (D-03):
  ```typescript
  const acceptHeader = request.headers.get("accept") ?? "";
  const wantsSSE = acceptHeader.includes("text/event-stream");
  ```
  Both branches share auth + validation + cache check; only the response shape differs.
- **Add cache check BEFORE pipeline call** (CONTEXT `code_context` integration point):
  ```typescript
  const contentHash = computeContentHash(validated, videoBuffer);
  const cached = await lookupPredictionCache(contentHash, user.id);
  if (cached) {
    // short-circuit — return cached result via current response shape (SSE or JSON)
  }
  ```
  On hit, send `complete` immediately on the SSE path; return `Response.json(cached)` on the JSON path.
- **Forward `onStageEvent` into pipeline**:
  ```typescript
  const pipelineResult = await runPredictionPipeline(validated, {
    requestId,
    onStageEvent: (event) => send("stage", event), // new fine-grained events
  });
  ```
  Keep emitting the legacy `event: phase` envelope for back-compat (D-02 last line).
- **Add new SSE response headers** (RESEARCH Pitfall 1+2):
  ```typescript
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",  // NEW — disable proxy buffering
      Vary: "Accept",             // NEW — signal cache layers
    },
  });
  ```
- **Extend INSERT with new columns**:
  ```typescript
  content_hash: contentHash,
  signal_availability: finalResult.signal_availability as unknown as null,
  ```
- **Hydrate L1 after successful INSERT**: `populatePredictionCache(contentHash, user.id, finalResult)`.

---

### `supabase/migrations/<timestamp>_phase3_pipeline_columns.sql` (new — DB migration)

**Analog:** `supabase/migrations/20260216000000_v2_schema_expansion.sql` — exact match for additive ALTER TABLE + CREATE INDEX on `analysis_results`.

**Header + ALTER TABLE pattern** (`20260216000000_v2_schema_expansion.sql:1-29`):
```sql
-- v2 Prediction Engine Schema Expansion
-- Adds behavioral predictions, feature vector, reasoning, and input mode tracking
-- to analysis_results. Adds evaluation tier and contribution tracking to rule_library.
-- All statements use IF NOT EXISTS for idempotent re-runs.

-- =====================================================
-- ANALYSIS RESULTS — 7 new columns for v2 prediction outputs
-- =====================================================

-- Behavioral predictions (completion_pct, share_pct, comment_pct, save_pct with percentiles)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS behavioral_predictions JSONB;

-- Feature vector — 26-signal backbone consumed by aggregator
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS feature_vector JSONB;

-- Input mode discriminator (text, tiktok_url, video_upload)
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS input_mode TEXT DEFAULT 'text' CHECK (input_mode IN ('text', 'tiktok_url', 'video_upload'));
```

**Partial-index pattern** (`20260216000000_v2_schema_expansion.sql:46-49`):
```sql
-- Index for filtering analyses by input mode
CREATE INDEX IF NOT EXISTS idx_analysis_results_input_mode ON analysis_results(input_mode) WHERE deleted_at IS NULL;

-- Index for video analyses (partial — only rows with video)
CREATE INDEX IF NOT EXISTS idx_analysis_results_has_video ON analysis_results(has_video) WHERE has_video = true AND deleted_at IS NULL;
```

**Deleted-at filter** (cross-reference `20260213000000_content_intelligence.sql:114`):
```sql
CREATE INDEX idx_analysis_results_non_deleted ON analysis_results(user_id, created_at DESC) WHERE deleted_at IS NULL;
```

**What to copy:**
- File header banner (`-- ===` boxes + section names).
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` idempotent idiom for every column add.
- `CREATE INDEX IF NOT EXISTS ... WHERE deleted_at IS NULL` partial-index pattern for `analysis_results` (consistent with 5 other indexes on this table).
- Default values inline (`JSONB DEFAULT '{}'` matches `rule_library.rule_contributions` in this same migration file, line 39).

**What to adapt:**
- New columns + index (RESEARCH Code Example "Phase 3 migration SQL"):
  ```sql
  -- Phase 3: signal availability provenance + content-hash cache columns.

  -- signal_availability JSONB: which signals fired during this prediction.
  ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS signal_availability JSONB DEFAULT '{}';

  -- content_hash TEXT: SHA-256 hex digest of input (buffer/url/text).
  ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

  -- Compound index supporting the L2 cache SELECT:
  --   WHERE content_hash = ? AND engine_version = ? AND user_id = ? AND created_at > ?
  CREATE INDEX IF NOT EXISTS idx_analysis_results_cache_lookup
    ON analysis_results(user_id, content_hash, engine_version, created_at DESC)
    WHERE deleted_at IS NULL;
  ```
- Filename: `<NEW_TIMESTAMP>_phase3_pipeline_columns.sql` — single migration (per CONTEXT D's "Migration filename" discretion).
- Per CONTEXT D-08: do NOT add `degradation_reasons` or per-stage cost columns; only `signal_availability` + `content_hash`.

---

### `src/types/database.types.ts` (regenerate)

**Analog:** N/A — this file is the output of `npx supabase gen types typescript --local > src/types/database.types.ts` (auto-generated; do not hand-edit).

**What to do:**
- Run the type-gen command AFTER applying the new migration locally.
- The newly added `analysis_results.content_hash: string | null` and `analysis_results.signal_availability: Json` will appear in the generated `Database["public"]["Tables"]["analysis_results"]["Row"]` shape.
- Verify route.ts `service.from("analysis_results").insert({ content_hash: ..., signal_availability: ... })` type-checks against the regenerated types (Pitfall: missing regeneration breaks the build silently).
- The `signal_availability: Json` field is typed as `unknown`-ish — use Zod parse on read in `prediction-cache.ts` per Pitfall 5.

---

## Shared Patterns

### Logger pattern
**Source:** every engine module — e.g., `src/lib/engine/creator.ts:3-5`, `src/lib/engine/deepseek.ts:7-17`
**Apply to:** every new file (`prediction-cache.ts`, `wave0.ts`, `wave3.ts`, `stage10-critique.ts`, `stage11-counterfactuals.ts`) that does I/O or telemetry; **skip** for pure-stub event-only stubs unless they need warn-on-error.

```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "prediction-cache" });
// usage: log.info("...", { ... });  log.warn("..."); log.error("...");
```

### Sentry breadcrumb + capture pattern
**Source:** `src/lib/engine/pipeline.ts:191-198, 320-326, 394-399`; `src/lib/engine/deepseek.ts:514-519, 550-552`
**Apply to:** every pipeline boundary (existing `timed()` sites — Phase 3 keeps them) AND new stub boundaries when they fail (Phase 3 stubs cannot fail, so no captures needed). Add breadcrumb after each new wave/stage end emission for parity:

```typescript
Sentry.addBreadcrumb({
  category: "engine.pipeline",
  message: "Wave 0 complete",
  level: "info",
  data: { requestId, stages: ["content_type", "niche_detector"] },
});
```

### Graceful-degradation pattern
**Source:** `src/lib/engine/pipeline.ts:277-292` (creator), `:295-311` (rules), `:335-369` (deepseek)
**Apply to:** any stage that does external I/O. Phase 3 stubs cannot fail (return literal `null` / `[]`), so this pattern only matters when later phases (4/7/9) replace stub bodies. Document the contract in stub files:

```typescript
/**
 * Phase 4 contract: when filling this stub with real logic,
 * preserve null-return-on-failure + warning push. Never throw.
 */
```

### Service-role Supabase client
**Source:** `src/lib/engine/creator.ts:1` (`createServiceClient` import), `src/lib/engine/pipeline.ts:217`
**Apply to:** `prediction-cache.ts` L2 SELECT. Service role bypasses RLS but plan MUST keep `user_id` in the WHERE clause for ASVS V4 (no cross-user leakage — RESEARCH Security Domain).

```typescript
import { createServiceClient } from "@/lib/supabase/service";
const supabase = createServiceClient();
const { data } = await supabase
  .from("analysis_results")
  .select("*")
  .eq("user_id", userId)  // CRITICAL — keep this filter even on service role
  .eq("content_hash", contentHash)
  .eq("engine_version", ENGINE_VERSION)
  .gt("created_at", cutoff)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

### Vitest mock idiom for `createCache`
**Source:** `src/lib/engine/__tests__/creator.test.ts:18-24`, `src/lib/engine/__tests__/pipeline.test.ts:37-44`
**Apply to:** every new test file under `src/lib/engine/__tests__/` that imports a module using `createCache`. Always reset to no-hit by default; per-test mocks override.

```typescript
vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  }),
}));
```

### Vitest mock idiom for Supabase chainable queries
**Source:** `src/lib/engine/__tests__/creator.test.ts:29-57`
**Apply to:** `prediction-cache.test.ts` for mocking the L2 SELECT chain. The factory creates a chainable mock where every method returns the same `chain` object, with `then` resolving to the test-controlled response.

```typescript
const mockSupabaseChain = (tableResult: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "not", "gte", "gt", "or", "order", "limit", "maybeSingle"];
  for (const method of methods) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => resolve(tableResult);
  return chain;
};
```

### Mocked `@sentry/nextjs` + `nanoid` + `@/lib/logger`
**Source:** `src/lib/engine/__tests__/pipeline.test.ts:18-35`
**Apply to:** every new test file (events.test.ts, version.test.ts, prediction-cache.test.ts, stubs.test.ts, route.test.ts).

```typescript
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));
vi.mock("nanoid", () => ({ nanoid: vi.fn(() => "test-req-id") }));
```

---

## No Analog Found

| File | Role | Reason | Mitigation |
|------|------|--------|------------|
| `src/types/database.types.ts` (regenerated) | generated output | Auto-generated by Supabase CLI; not a pattern target | Run `npx supabase gen types typescript --local` after migration |
| `StageEvent` discriminated union shape | new runtime schema | `grep` found **zero** `z.discriminatedUnion` calls in codebase | Use RESEARCH Pattern 1 verbatim (CONTEXT D-02 lock); plain TS type acceptable if Zod overhead unjustified |

---

## Metadata

**Analog search scope:** `src/lib/engine/**`, `src/lib/cache.ts`, `src/app/api/analyze/route.ts`, `supabase/migrations/**`, `src/lib/engine/__tests__/**`
**Files scanned:** 35 source files + 20 migrations + 16 test files
**Pattern extraction date:** 2026-05-17
**Cross-reference:** CONTEXT.md D-01..D-19, RESEARCH.md Patterns 1-4 + Pitfalls 1-8 + Code Examples
