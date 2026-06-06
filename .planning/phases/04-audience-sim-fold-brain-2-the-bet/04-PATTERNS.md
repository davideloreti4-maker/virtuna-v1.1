# Phase 4: Audience-Sim Fold (Brain 2) — Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 7 new/modified files
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/engine/wave3/fold.ts` | service / orchestrator | request-response (single LLM call, thinking mode) | `src/lib/engine/wave3/pass2.ts` | exact |
| `src/lib/engine/wave3/fold-prompts.ts` | utility / prompt builder | transform | `src/lib/engine/wave3/persona-prompts-pass2.ts` | exact |
| `src/lib/engine/aggregator.ts` (modify) | service | request-response | `src/lib/engine/aggregator.ts` lines 847-931 | exact (seam extension) |
| `src/lib/engine/wave3/__tests__/fold-schema.test.ts` | test | batch | `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts` | role-match |
| `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` | test | batch | `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts` | role-match |
| `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` | test | batch | `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts` | role-match |
| `scripts/ab-fold-referee.ts` | script / integration runner | batch (real API, 6 videos × 2 paths × 2 runs) | `scripts/measure-pipeline.ts` | exact |

---

## Pattern Assignments

### `src/lib/engine/wave3/fold.ts` (service, request-response)

**Analog:** `src/lib/engine/wave3/pass2.ts`

**Imports pattern** (pass2.ts lines 15-33):
```typescript
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { selectPersonaSlots, type PersonaSlot } from "./persona-registry";
import {
  STABLE_FOLD_SYSTEM_PROMPT,     // rename from STABLE_PASS2_SYSTEM_PROMPT
  buildFoldUserContent,           // rename from buildPass2UserContent
  FoldResponseSchema,             // rename from Pass2ResponseSchema
} from "./fold-prompts";
import { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } from "../qwen/client";
import { calculateCost } from "../qwen/cost";
import type { ContentTypeSlug, PersonaSimulationResult, SegmentGrid, EmotionArcPoint } from "../types";
export type { Pass2PersonaResult } from "./weighted-aggregator";
import type { Pass2PersonaResult } from "./weighted-aggregator";
```

**Env/constants pattern** (pass2.ts lines 36-46):
```typescript
const PER_CALL_TIMEOUT_MS = 90_000;  // match pass2.ts — thinking-mode tail latency
const FOLD_THINKING_BUDGET = Number(process.env.FOLD_THINKING_BUDGET) || 4000;  // D-08: 2× pass2's 2000
const FOLD_MAX_TOKENS      = Number(process.env.FOLD_MAX_TOKENS)      || 8000;  // D-08: sized for 10-archetype output
const COST_ALERT_THRESHOLD_CENTS = 50;
```

**Bounded-thinking call pattern** (pass2.ts lines 158-181 + deepseek.ts lines 373-393):
```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);

const callParams = {
  model: QWEN_REASONING_MODEL,
  messages: [
    { role: "system" as const, content: STABLE_FOLD_SYSTEM_PROMPT }, // byte-stable cache prefix (D-17)
    { role: "user" as const,   content: buildFoldUserContent(slots, segments, keyframeUris, verbatim, emotionArc) as never },
  ],
  response_format: { type: "json_object" as const },
};
// @ts-expect-error — DashScope extension: enable_thinking not in OpenAI types
callParams.enable_thinking = true;
// @ts-expect-error
callParams.thinking_budget = FOLD_THINKING_BUDGET;
// @ts-expect-error
callParams.temperature = 0;
// @ts-expect-error
callParams.seed = QWEN_SEED;
// @ts-expect-error
callParams.max_tokens = FOLD_MAX_TOKENS;
const response = await ai.chat.completions.create(callParams as never, { signal: controller.signal });
clearTimeout(timer);
```

**Cache-aware cost telemetry pattern** (wave3.ts lines 171-188 — copy verbatim):
```typescript
const usage = response.usage as unknown as
  | {
      prompt_tokens?: number;
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
      completion_tokens?: number;
    }
  | undefined;
const cacheHit  = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
const completion = usage?.completion_tokens ?? 0;
const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
const inputCost = hasBreakdown
  ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
  : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
attemptCostCents = (inputCost + completion * OUTPUT_PRICE) * 100;
```

**Output interface pattern** (pass2.ts lines 94-100):
```typescript
export interface Wave3FoldOutcome {
  pass2Results: Pass2PersonaResult[];          // for assembleHeatmapPayload (unchanged)
  personaSimResults: PersonaSimulationResult[]; // for aggregatePersonaResults (unchanged)
  warnings: string[];
  cost_cents: number;
  fold_success: boolean;  // true when the fold emitted all 10 archetypes with valid shape
}
```

**Sentry error pattern** (pass2.ts lines 261-270):
```typescript
Sentry.captureException(lastError, {
  tags: {
    stage: "wave_3_fold",
    archetype: "all_10",
  },
});
```

**Post-parse diversity guard hook** (D-07 — inserted immediately after `FoldResponseSchema.safeParse`):
```typescript
const avgRange = computeAvgCurveRange(validated.data.personas);
if (avgRange < DIVERSITY_FLOOR) {
  log.warn("fold diversity guard: curves may be homogenized", { avgRange, floor: DIVERSITY_FLOOR });
  // warn only — do not throw; let the A/B referee gate the production flip
}
```

---

### `src/lib/engine/wave3/fold-prompts.ts` (utility, transform)

**Analog:** `src/lib/engine/wave3/persona-prompts-pass2.ts`

**Imports pattern** (persona-prompts-pass2.ts lines 14-16):
```typescript
import { z } from "zod";
import type { PersonaSlot } from "./persona-registry";
import type { SegmentGrid, PersonaSimulationResult, EmotionArcPoint } from "../types";
import { ARCHETYPE_DEFINITIONS } from "./persona-registry"; // feeds the byte-stable system prefix
```

**Byte-stable system prompt pattern** (persona-prompts-pass2.ts lines 41-99):

The `STABLE_FOLD_SYSTEM_PROMPT` must follow the SAME byte-stability contract as `STABLE_PASS2_SYSTEM_PROMPT`:
- Export as `export const STABLE_FOLD_SYSTEM_PROMPT = \`...\`` — a plain string constant, never a function
- Content = ALL 10 `ARCHETYPE_DEFINITIONS` (verbatim from `persona-registry.ts:80-101`) + static task/schema/divergence instructions
- NEVER interpolate `Date.now()`, `Math.random()`, request IDs, video-specific data
- All volatile data (verbatim, segments, keyframes, emotion arc) goes in the USER message via `buildFoldUserContent`

```typescript
// Cache discipline: NEVER interpolate Date.now() / Math.random() / request IDs here.
// The 10 ARCHETYPE_DEFINITIONS block is the cache prefix — byte-identical across every video.
export const STABLE_FOLD_SYSTEM_PROMPT = `You are simulating TEN TikTok viewer archetypes watching a video.

## Archetype Definitions (feed ALL 10 — these MUST produce divergent curves)

### high_engager
${ARCHETYPE_DEFINITIONS.high_engager}

### saver
${ARCHETYPE_DEFINITIONS.saver}

[... all 10 archetypes verbatim ...]

## Critical Divergence Requirement
These 10 archetypes have FUNDAMENTALLY different tolerances. Near-identical attention curves
across archetypes is a FAILURE. tough_crowd must drop earliest; loyalist stays latest.
Require relative drop-point ordering grounded in the definitions above.

## Output Schema
[static schema block — no per-video values]`;
```

**Volatile user content builder pattern** (persona-prompts-pass2.ts lines 115-135):
```typescript
type ContentItem =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

export function buildFoldUserContent(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
): ContentItem[] {
  const items: ContentItem[] = [];
  // image_url items FIRST (mirrors buildPass2UserContent:124-134)
  for (const uri of keyframeUris) {
    if (uri !== null && uri !== undefined) {
      items.push({ type: "image_url", image_url: { url: uri } });
    }
  }
  // text block ALWAYS last
  items.push({ type: "text", text: buildFoldTextBlock(slots, segments, verbatim, emotionArc) });
  return items;
}
```

**FoldResponseSchema Zod pattern** (persona-prompts-pass2.ts lines 214-229):
```typescript
// Per-archetype entry — carries BOTH Pass-1 intents AND Pass-2 segment_reactions
const FoldArchetypeSchema = z.object({
  archetype:           z.enum([/* 10 archetypes */]),
  persona_id:          z.string(),
  // Pass-1 behavioral intents (for aggregatePersonaResults)
  watch_through_pct:   z.number().min(0).max(100),
  share_intent:        z.number().min(0).max(100),
  comment_intent:      z.number().min(0).max(100),
  save_intent:         z.number().min(0).max(100),
  rewatch_intent:      z.number().min(0).max(100),
  scroll_past_second:  z.number().min(0),
  // Pass-2 segment reactions (for assembleHeatmapPayload)
  segment_reactions: z.array(
    z.object({
      t_start:         z.number().min(0),
      t_end:           z.number().min(0),
      attention:       z.number().min(0).max(1),        // clamped [0,1] — mirror Pass2ResponseSchema
      reason:          z.string().max(200).optional(),  // inflection-point only
      swipe_predicted: z.boolean(),
    }),
  ),
});

export const FoldResponseSchema = z.object({
  personas: z.array(FoldArchetypeSchema).length(10), // exactly 10 — D-01
});

export type FoldResponse = z.infer<typeof FoldResponseSchema>;
```

---

### `src/lib/engine/aggregator.ts` (modify — `behavioralSource` seam extension)

**Analog:** `src/lib/engine/aggregator.ts` lines 347-355 + 847-931 (the seam + heatmap branch)

**Interface extension** (aggregator.ts lines 347-355):
```typescript
// EXTEND this type — add "fold" to the union:
export interface AggregateScoresOptions {
  behavioralSource?: "deepseek" | "personas" | "fold";  // add "fold"
  // ... existing fields unchanged ...
}
```

**Behavioral source branch** (aggregator.ts lines 847-862 — add "fold" branch):
```typescript
const behavioralSource = options?.behavioralSource ?? "deepseek";
const behavioral_predictions =
  behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null
    ? pipelineResult.personaBehavioralAggregate
    : behavioralSource === "fold" && pipelineResult.foldOutcome?.personaBehavioralAggregate != null
    ? pipelineResult.foldOutcome.personaBehavioralAggregate
    : (deepseek?.behavioral_predictions ?? FALLBACK_BEHAVIORAL);
```

**Heatmap branch** (aggregator.ts lines 911-931 — add fold path parallel to pass2Outcome path):
```typescript
// Fold path: foldOutcome.pass2Results is already Pass2PersonaResult[] — feeds assembleHeatmapPayload unchanged
const pass2Source = behavioralSource === "fold"
  ? pipelineResult.foldOutcome
  : pipelineResult.pass2Outcome;
// ... rest of the heatmap assembly uses pass2Source.pass2Results identically
```

---

### `src/lib/engine/wave3/__tests__/fold-schema.test.ts` (test, batch)

**Analog:** `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts`

**Test file structure pattern** (pass2-drop-fallback.test.ts lines 1-3):
```typescript
import { describe, it, expect } from "vitest";
import { FoldResponseSchema } from "../fold-prompts";
// No API calls — pure unit over the Zod schema
```

**Test pattern** (pass2-drop-fallback.test.ts lines 27-72):
```typescript
describe("FoldResponseSchema", () => {
  it("accepts valid 10-archetype × N-segment fold output", () => { ... });
  it("rejects attention outside [0,1]", () => { ... });
  it("rejects fewer than 10 archetypes", () => { ... });
  it("rejects segment_reactions length != segments.length", () => { ... });
  it("accepts optional reason ≤ 200 chars, rejects > 200", () => { ... });
});
```

---

### `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` (test, batch)

**Analog:** `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts` (structure) + `weighted-aggregator-client.test.ts` (adapter parity pattern)

**Test file structure pattern** (weighted-aggregator-client.test.ts lines 1-9):
```typescript
import { describe, it, expect } from "vitest";
import { adaptFoldToPersonaSimResults, adaptFoldToPass2Results } from "../fold";
import { aggregatePersonaResults } from "../aggregator";
import { buildWeightedCurve } from "../weighted-aggregator";
import type { FoldResponse } from "../fold-prompts";
```

**Adapter test pattern** (weighted-aggregator-client.test.ts lines 15-30):
```typescript
// Build a FoldResponse fixture with known values, assert both adapted arrays are valid
// and that aggregatePersonaResults + buildWeightedCurve accept them without error.
// This is the D-11/D-12 lossless mapping proof.
describe("fold output adapter", () => {
  it("adaptFoldToPersonaSimResults produces PersonaSimulationResult[] aggregatePersonaResults accepts", () => { ... });
  it("adaptFoldToPass2Results produces Pass2PersonaResult[] buildWeightedCurve accepts", () => { ... });
  it("slot_type niche_deep→niche map applied correctly (Pitfall 5)", () => { ... });
});
```

---

### `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` (test, batch)

**Analog:** `src/lib/engine/wave3/__tests__/pass2-drop-fallback.test.ts`

**Test file structure pattern**:
```typescript
import { describe, it, expect, vi } from "vitest";
import { computeAvgCurveRange, checkDiversityGuard, DIVERSITY_FLOOR } from "../fold";
// Tests the post-parse guard (D-07) — pure over attention arrays, no API
```

**Guard test pattern**:
```typescript
describe("fold diversity guard (D-07)", () => {
  it("returns avgRange for varied curves (expected pass)", () => { ... });
  it("warns but does NOT throw when curves are flat (avgRange < FLOOR)", () => { ... });
  it("avgRange computation matches measure-pipeline.ts:146-160 formula", () => {
    // max-min per persona, mean over all 10
    // This ensures the guard metric IS the referee metric (same formula, one source)
  });
});
```

---

### `scripts/ab-fold-referee.ts` (script, batch / real-API)

**Analog:** `scripts/measure-pipeline.ts`

**Bootstrap header pattern** (measure-pipeline.ts lines 14-21 — copy verbatim):
```typescript
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });
```

**Imports that follow the bootstrap** (measure-pipeline.ts lines 23-28):
```typescript
import { createClient } from "@supabase/supabase-js";
import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { StageEvent } from "../src/lib/engine/events";
import type { AnalysisInput } from "../src/lib/engine/types";
// ADDITIONAL for referee:
import type { AggregateScoresOptions } from "../src/lib/engine/aggregator";
```

**Env guard pattern** (measure-pipeline.ts lines 37-40):
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");
```

**Video upload pattern** (measure-pipeline.ts lines 42-50):
```typescript
const buf = readFileSync(VIDEO_PATH);
const storagePath = `smoke-measure/${Date.now()}.mp4`;
const up = await supabase.storage.from("videos").upload(storagePath, buf, {
  contentType: "video/mp4",
  upsert: true,
});
if (up.error) throw new Error("upload failed: " + up.error.message);
```

**AnalysisInput + pipeline invocation pattern** (measure-pipeline.ts lines 52-82):
```typescript
const input: AnalysisInput = {
  input_mode: "video_upload",
  video_storage_path: storagePath,
  content_type: "video",
  niche: "fitness",
};
const pipelineResult = await runPredictionPipeline(input, {
  requestId: "ab-referee-" + Date.now(),
  bypassCache: true,
  onStageEvent: onEvent,
});
// Run BOTH paths on same pipelineResult:
const resultPersonas = await aggregateScores(pipelineResult, onEvent, { behavioralSource: "personas" });
const resultFold     = await aggregateScores(pipelineResult, onEvent, { behavioralSource: "fold" });
```

**Avg curve range metric** (measure-pipeline.ts lines 146-160 — copy verbatim for D-03.2 + D-07 parity):
```typescript
const ranges: number[] = [];
for (const r of p2Ends) {
  const att = r.e.attentions ?? [];
  if (!att.length) continue;
  const range = +(Math.max(...att) - Math.min(...att)).toFixed(2);
  ranges.push(range);
}
const avgRange = ranges.length
  ? +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2)
  : 0;
// D-03.2 pass: foldAvgRange >= 0.8 * tenPassAvgRange
// D-07 guard shares this exact formula
```

**Cleanup pattern** (measure-pipeline.ts line 170):
```typescript
await supabase.storage.from("videos").remove([storagePath]);
process.exit(0);
```

**main() + error pattern** (measure-pipeline.ts lines 175-178):
```typescript
main().catch((e) => {
  console.error("[ab-referee] FATAL:", e);
  process.exit(1);
});
```

---

## Shared Patterns

### Byte-stable cached system prefix
**Source:** `src/lib/engine/wave3/persona-prompts-pass2.ts` lines 37-99 (`STABLE_PASS2_SYSTEM_PROMPT`)
**Apply to:** `fold-prompts.ts` (`STABLE_FOLD_SYSTEM_PROMPT`)
- Export as a `const` string, never a function
- No `Date.now()`, `Math.random()`, or request IDs
- All volatile data (verbatim, segments, keyframes, emotion arc) to user message only
- Verify cache via `prompt_cache_hit_tokens` in telemetry (field name confirmed in `wave3.ts:175-181`)

### DashScope thinking-mode call envelope
**Source:** `src/lib/engine/wave3/pass2.ts` lines 158-181 + `src/lib/engine/deepseek.ts` lines 373-393
**Apply to:** `fold.ts` single call
- `enable_thinking: true` + `thinking_budget` + `max_tokens` all via `@ts-expect-error` DashScope extensions
- `temperature: 0` + `seed: QWEN_SEED` (7) on the same params object
- AbortController timeout `PER_CALL_TIMEOUT_MS = 90_000`
- Both budget values env-overridable (`FOLD_THINKING_BUDGET`, `FOLD_MAX_TOKENS`)

### Cache-aware cost telemetry
**Source:** `src/lib/engine/wave3.ts` lines 171-188
**Apply to:** `fold.ts` cost computation
- Cast `response.usage` to the inline type with `prompt_cache_hit_tokens`/`prompt_cache_miss_tokens`
- `hasBreakdown` guard selects between breakdown pricing and fallback
- Roll up into `totalCostCents` same as `pass2.ts:252` + `wave3.ts` pattern

### Sentry error tagging
**Source:** `src/lib/engine/wave3/pass2.ts` lines 261-270
**Apply to:** `fold.ts` catch block
```typescript
Sentry.captureException(lastError, { tags: { stage: "wave_3_fold" } });
```

### Zod output boundary validation
**Source:** `src/lib/engine/wave3/persona-prompts-pass2.ts` lines 214-229 (`Pass2ResponseSchema`)
**Apply to:** `fold-prompts.ts` (`FoldResponseSchema`)
- `safeParse` → throw on failure (triggers the retry loop)
- Clamp `attention` to `[0,1]` via `.min(0).max(1)`
- `reason` max 200 chars via `.max(200).optional()`
- Add segment-count guard after parse (mirror `pass2.ts:197-201`)

### Script bootstrap
**Source:** `scripts/measure-pipeline.ts` lines 14-21
**Apply to:** `scripts/ab-fold-referee.ts`
- Copy the `dotenv` + `tsconfig-paths` block verbatim — it is the established pattern for all `tsx` scripts in this repo

### `behavioralSource` seam pattern
**Source:** `src/lib/engine/aggregator.ts` lines 347-355 + 847-862
**Apply to:** `aggregator.ts` modification (add `"fold"` branch)
- Extend the union type: `"deepseek" | "personas" | "fold"`
- Default remains `"deepseek"` — production callers untouched (D-09)
- 10-pass dormant-not-deleted: `"personas"` branch stays functional for rollback

---

## No Analog Found

All files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/lib/engine/wave3/`, `src/lib/engine/`, `scripts/`
**Files scanned:** 9 source files read directly
**Key line refs verified:**
- `pass2.ts`: full file (352 lines) — thinking call, retry, telemetry, cost
- `persona-prompts-pass2.ts`: full file (230 lines) — STABLE prompt, builder, Pass2ResponseSchema
- `measure-pipeline.ts`: full file (179 lines) — bootstrap, avg-curve-range metric (146-160)
- `aggregator.ts`: lines 345-362 (interface) + 840-931 (behavioralSource seam + heatmap branch)
- `deepseek.ts`: lines 365-404 (Apollo bounded-thinking call template)
- `persona-registry.ts`: lines 1-101 (ARCHETYPE_DEFINITIONS byte-stable block)
- `wave3.ts`: lines 170-188 (cache-aware cost telemetry pattern)
- `wave3/__tests__/pass2-drop-fallback.test.ts`: full file — test structure
- `wave3/__tests__/weighted-aggregator-client.test.ts`: lines 1-50 — adapter test pattern
**Pattern extraction date:** 2026-06-05
