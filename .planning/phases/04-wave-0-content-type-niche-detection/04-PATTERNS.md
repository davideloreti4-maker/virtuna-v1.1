# Phase 4: Wave 0 — Content Type + Niche Detection - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 17 (10 new, 7 modified)
**Analogs found:** 17 / 17

## File Classification

### New files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/lib/engine/wave0/content-type-detector.ts` | service (LLM detector) | request-response + file-upload | `src/lib/engine/gemini.ts` (`analyzeVideoWithGemini` 409-542) | exact (same SDK, same file-upload pattern, same Zod-validated structured output) |
| `src/lib/engine/wave0/niche-detector.ts` | service (LLM detector) | request-response (text) | `src/lib/engine/deepseek.ts` (`reasonWithDeepSeek` 509-650) | exact (same OpenAI SDK client, same STABLE_SYSTEM + VOLATILE_USER cache pattern, same Zod validation) |
| `src/lib/engine/wave0/content-type-weights.ts` | utility (pure function + constants) | transform | `src/lib/engine/aggregator.ts` `selectWeights()` 50-85 | role-match (pure function operating on a typed object; matrix-like constant) |
| `src/lib/engine/wave0/prompts.ts` | utility (prompt builder) | transform | `src/lib/engine/deepseek.ts` `STABLE_SYSTEM_PROMPT` 54-123 + `buildDeepSeekUserMessage` 435-492 | exact (same STABLE/VOLATILE split for DeepSeek cache prefix stability) |
| `src/lib/engine/__tests__/wave0-content-type.test.ts` | test (unit, mocked LLM) | request-response | `src/lib/engine/__tests__/gemini.test.ts` 1-100 | exact (Gemini SDK mocking pattern, env-var setup, calibration fs mock) |
| `src/lib/engine/__tests__/wave0-niche-detector.test.ts` | test (unit, mocked LLM) | request-response | `src/lib/engine/__tests__/deepseek.test.ts` 1-120 | exact (OpenAI SDK mocking via `vi.mock("openai")`, Gemini-fallback wiring) |
| `src/lib/engine/__tests__/wave0-orchestration.test.ts` | test (unit, callback-driven) | event-driven | `src/lib/engine/__tests__/stubs.test.ts` (Wave 0 suite 16-44) | exact (same `runWave0` callback assertion pattern, `Promise.allSettled` isolation, event ordering) |
| `src/lib/engine/__tests__/content-type-weights.test.ts` | test (unit, pure function) | transform | `src/lib/engine/__tests__/aggregator.test.ts` `selectWeights` suite 72-194 | exact (pure-function exhaustive lookup tests + sum invariant) |
| `src/lib/niches/__tests__/taxonomy.test.ts` | test (unit, data invariants) | transform | EXISTING `src/lib/niches/__tests__/taxonomy.test.ts` 10-50 | exact (extend in-place — same describe-block style, same invariant-assertion idioms) |

### Modified files

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/lib/engine/wave0.ts` (body swap) | controller (orchestrator) | parallel pub-sub | `src/lib/engine/pipeline.ts` Wave 1 `Promise.all` 381-386 (refactored to `Promise.allSettled` for graceful degradation) | role-match (orchestrator firing parallel detectors with event emission) |
| `src/lib/engine/types.ts` (lines 205-209 widen + add Zod) | model (type + schema) | transform | Existing `GeminiResponseSchema` / `GeminiVideoSignalsSchema` 244-256 and `DeepSeekResponseSchema` 303-309 | exact (same `z.object` → `z.infer` pattern, same `.optional()` + nullable composition) |
| `src/lib/engine/pipeline.ts` (line 269 pre-fetch insert) | controller (pipeline orchestrator) | request-response | Existing `creatorPromise` block 343-359 (move + cache via PipelineOptions) | exact (same `timed()` wrapper, same fallback-on-error path) |
| `src/lib/engine/aggregator.ts` (lines 197-203 + ~281 + ~287-303) | service (score aggregator) | transform | EXISTING `assembleFeatureVector` 149-201 + `availability` block 289-303 | exact (extend in-place; add 2 boolean keys + 1 optional parameter) |
| `src/lib/engine/deepseek.ts` (line 19 — DO NOT FLIP; add new env constant) | service (LLM client) | request-response | Existing `DEEPSEEK_MODEL` line 19 (KEEP) — add `DEEPSEEK_NICHE_MODEL` env constant in `niche-detector.ts` | Per RESEARCH Topic #12: introduce NEW constant in detector file, leave deepseek.ts line 19 unchanged |
| `src/lib/engine/gemini.ts` (NO CHANGE) | service (LLM client) | request-response | Existing `GEMINI_MODEL` line 17 (KEEP) — add `GEMINI_WAVE0_MODEL` env constant in `content-type-detector.ts` | Per CONTEXT D-04 / RESEARCH: introduce separate model env in detector file, do not touch gemini.ts |
| `src/lib/niches/taxonomy.ts` (extend `NichePrimary` type + add data) | model (typed data tree) | transform | Existing `NICHE_TREE` 30-175 (add `personas` + `benchmark_filters` per primary) | exact (extend in-place, same TypeScript const-tree pattern) |

### Tests extended in place (no new files)

| Extended Test File | Pattern Source |
|--------------------|----------------|
| `src/lib/engine/__tests__/pipeline.test.ts` (extension) | Existing `pipeline.test.ts` 220-260 — same `describe("pipeline integration tests")` block, same `beforeEach` mock reset, same Supabase chain override pattern |
| `src/lib/engine/__tests__/aggregator.test.ts` (extension) | Existing `aggregator.test.ts` 200-290 — same `describe("aggregateScores")` block, same `makePipelineResult` factory override pattern |

---

## Pattern Assignments

### `src/lib/engine/wave0/content-type-detector.ts` (service, request-response + file-upload)

**Analog:** `src/lib/engine/gemini.ts` (specifically `analyzeVideoWithGemini` lines 409-542)

**Imports pattern** (gemini.ts:1-13):
```typescript
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  GeminiResponseSchema,
  // ...
  type AnalysisInput,
  type GeminiAnalysis,
} from "./types";
```
For wave0 detector use the same shape:
```typescript
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import type { ContentPayload, Wave0ContentTypeResult } from "../types";
import { Wave0ContentTypeResultSchema } from "../types";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
```

**Module-level constants + client init** (gemini.ts:17-31, 81-88):
```typescript
const log = createLogger({ module: "gemini" });

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_RETRIES = 2;
const VIDEO_TIMEOUT_MS = 30_000;
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024;
const VIDEO_POLL_INTERVAL_MS = 500;
const VIDEO_POLL_TIMEOUT_MS = 60_000;

// ...

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
```
For wave0 detector: add **separate** `GEMINI_WAVE0_MODEL` env (default `"gemini-3-flash-preview"` per RESEARCH anti-pattern note — NOT `"gemini-3-flash"`).

**Gemini structured-output schema pattern** (gemini.ts:273-314):
```typescript
const VIDEO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          improvement_tip: { type: Type.STRING },
        },
        required: ["name", "score", "rationale", "improvement_tip"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    video_signals: {
      type: Type.OBJECT,
      // ...
    },
  },
  required: ["factors", "overall_impression", "content_summary", "video_signals"],
};
```

**Files-API upload + poll + fileData call** (gemini.ts:425-490) — copy verbatim, swap model + responseSchema + use `videoMetadata` with STRING offsets:
```typescript
const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
const uploadResult = await ai.files.upload({
  file: blob,
  config: { mimeType },
});

if (!uploadResult.name) {
  throw new Error("Video upload failed: no file name returned from Gemini Files API");
}
uploadedFileName = uploadResult.name;

const pollStart = Date.now();
let fileState = uploadResult.state;
let fileUri = uploadResult.uri;

while (fileState === "PROCESSING") {
  if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
    throw new Error(
      `Video processing timed out after ${VIDEO_POLL_TIMEOUT_MS / 1000}s.`
    );
  }
  await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
  const fileInfo = await ai.files.get({ name: uploadedFileName });
  fileState = fileInfo.state;
  fileUri = fileInfo.uri;
}

if (fileState === "FAILED") { throw new Error(/* ... */); }
if (!fileUri) { throw new Error(/* ... */); }

const response = await ai.models.generateContent({
  model: GEMINI_MODEL,
  contents: [
    {
      role: "user",
      parts: [
        { text: videoPrompt },
        { fileData: { fileUri, mimeType } },
        // NEW for Wave 0: videoMetadata with STRING offsets "0s"/"5s"
      ],
    },
  ],
  config: {
    responseMimeType: "application/json",
    responseSchema: VIDEO_RESPONSE_SCHEMA,
    abortSignal: controller.signal,
  },
});
```

**Cost calculation pattern** (gemini.ts:141-149):
```typescript
function calculateCost(
  promptTokens: number | undefined,
  candidateTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = candidateTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}
```

**Zod validation + fence-strip parse** (gemini.ts:91-116):
```typescript
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

function parseGeminiVideoResponse(raw: string): GeminiVideoAnalysis {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = GeminiVideoResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini video response validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

**Error handling + Sentry + best-effort file cleanup** (gemini.ts:522-541):
```typescript
} catch (error) {
  Sentry.captureException(error, {
    tags: { stage: "gemini_video_analysis" },
  });
  if (error instanceof Error && error.name === "AbortError") {
    throw new Error(`Gemini video analysis timed out after ${VIDEO_TIMEOUT_MS}ms`);
  }
  if (error instanceof Error) throw error;
  throw new Error(`Video analysis failed: ${String(error)}`);
} finally {
  if (uploadedFileName) {
    try {
      await ai.files.delete({ name: uploadedFileName });
    } catch {
      // Best-effort cleanup
    }
  }
}
```
**Critical adaptation per CONTEXT D-16:** content-type-detector must NOT throw on caught errors — return `null` and let `runWave0` see the null. Replace the `throw` calls in the catch with `return null` plus `emitStageEnd(..., { ok: false, warning: errorMessage })`.

**Event emission pattern** (events.ts:19-49):
```typescript
const startTs = emitStageStart(onEvent, "wave_0_content_type", 0);
// ... work ...
emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
  cost_cents: +costCents.toFixed(4),
  ok: true,
  warning: result.warning,
});
```

---

### `src/lib/engine/wave0/niche-detector.ts` (service, request-response text)

**Analog:** `src/lib/engine/deepseek.ts` (specifically `reasonWithDeepSeek` lines 509-650)

**Imports pattern** (deepseek.ts:1-17):
```typescript
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  DeepSeekResponseSchema,
  type AnalysisInput,
  type DeepSeekReasoning,
  // ...
} from "./types";

const log = createLogger({ module: "deepseek" });
```

**Model env constant + lazy client init** (deepseek.ts:19, 243-253):
```typescript
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-reasoner";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }
  return client;
}
```
For niche-detector: **introduce a separate `DEEPSEEK_NICHE_MODEL` env defaulting to `"deepseek-v4-flash"`** per RESEARCH Topic #12 / Anti-Pattern (do NOT flip `DEEPSEEK_MODEL` itself — that would silently degrade Wave 2 thinking mode).

**STABLE / VOLATILE prompt split (load-bearing for cache hits)** (deepseek.ts:43-123 + 435-492):
```typescript
// STABLE system prompt — byte-identical across calls so DeepSeek's automatic
// input cache can match the prefix and apply the cache-hit discount.
const STABLE_SYSTEM_PROMPT = `You are an expert TikTok content strategist. Analyze the content provided in the user message ...`;

// Per RESEARCH Pattern 4 + Pitfall 3: dynamic content (calibration percentiles,
// creator context, content text, gemini signals, matched rules) MUST live in the
// user message — never here. The split is intentional and load-bearing for caching.

function buildDeepSeekUserMessage(
  context: DeepSeekInput,
  calibration: DeepSeekCalibrationData
): string {
  // ...
  return `## Content to Analyze
Content type: ${context.input.content_type}
Content:
${context.input.content_text}
...`;
}
```
For niche-detector: same split. STABLE prompt lists the locked `NICHE_TREE` primaries inline (so the model picks from the locked vocabulary); VOLATILE message carries caption + hashtags + creator handle + Card 1/4/5/6 context.

**Chat-completion call with system/user split for cache prefix** (deepseek.ts:537-547):
```typescript
const response = await ai.chat.completions.create(
  {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: STABLE_SYSTEM_PROMPT }, // byte-identical across calls
      { role: "user", content: userMessage },             // per-request volatile payload
    ],
    response_format: { type: "json_object" },
  },
  { signal: controller.signal }
);
```

**Cache-aware cost telemetry** (deepseek.ts:557-590) — reuse for niche detector:
```typescript
const usage = response.usage as unknown as {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
} | undefined;
const cacheHitTokens = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMissTokens = usage?.prompt_cache_miss_tokens ?? 0;
const totalPromptTokens = usage?.prompt_tokens ?? 0;
const completionTokens = usage?.completion_tokens ?? 0;

log.info("DeepSeek cache telemetry", {
  stage: "deepseek_reasoning",
  cache_hit_tokens: cacheHitTokens,
  cache_miss_tokens: cacheMissTokens,
  total_prompt_tokens: totalPromptTokens,
  cache_hit_rate:
    cacheHitTokens + cacheMissTokens > 0
      ? +(cacheHitTokens / Math.max(1, cacheHitTokens + cacheMissTokens)).toFixed(4)
      : 0,
});

const cost_cents = calculateDeepSeekCost(
  cacheHitTokens,
  cacheMissTokens,
  completionTokens,
  totalPromptTokens || undefined
);
```

**Strip-fence + Zod validation parse pattern** (deepseek.ts:311-326):
```typescript
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

function parseDeepSeekResponse(raw: string): DeepSeekReasoning {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = DeepSeekResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`DeepSeek response validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

**Error handling — graceful-degradation adaptation:** deepseek.ts:643-650 throws/returns null after retries + circuit-breaker tracking. Niche-detector should:
- NOT use the circuit breaker (it's tied to Wave 2's shared client + critical-path logic)
- Catch all errors → log.warn + Sentry.captureException + emit stage_end with `ok: false, warning: <message>` + `return null` (CONTEXT D-16 graceful contract)

---

### `src/lib/engine/wave0.ts` (controller, parallel pub-sub — body swap)

**Analog:** `src/lib/engine/pipeline.ts` Wave 1 block lines 295-386 (refactored from `Promise.all` to `Promise.allSettled` for graceful degradation per RESEARCH Pattern 1).

**Current stub** (wave0.ts:12-26) — KEEP signature shape; SWAP body:
```typescript
export async function runWave0(
  _payload: ContentPayload,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const ctStart = emitStageStart(onEvent, "wave_0_content_type", 0);
  const niStart = emitStageStart(onEvent, "wave_0_niche_detector", 0);

  // No-op — Phase 4 swaps with real V3 calls (content_type + hierarchical niche)
  const result: Wave0Result = { content_type: null, niche: null };

  emitStageEnd(onEvent, "wave_0_content_type", 0, ctStart, { cost_cents: 0, ok: true });
  emitStageEnd(onEvent, "wave_0_niche_detector", 0, niStart, { cost_cents: 0, ok: true });

  return result;
}
```

**Signature widening per D-17:** add `creatorContext: CreatorContext` parameter:
```typescript
export async function runWave0(
  payload: ContentPayload,
  creatorContext: CreatorContext,  // NEW Phase 4 (D-17/D-18)
  onEvent?: StageEventCallback,
): Promise<Wave0Result>
```

**Promise.allSettled isolation pattern** (RESEARCH Pattern 1, lines 226-242):
```typescript
const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
  detectContentType(payload, onEvent),
  detectNiche(payload, creatorContext, onEvent),
]);

if (contentTypeOutcome.status === "rejected") {
  log.warn("Content-type detector failed", { reason: String(contentTypeOutcome.reason) });
}
if (nicheOutcome.status === "rejected") {
  log.warn("Niche detector failed", { reason: String(nicheOutcome.reason) });
}

return {
  content_type: contentTypeOutcome.status === "fulfilled" ? contentTypeOutcome.value : null,
  niche: nicheOutcome.status === "fulfilled" ? nicheOutcome.value : null,
};
```

**Critical:** event emission ownership moves DOWN into each detector. The current stub double-emits from wave0.ts itself; Phase 4 detectors emit their own `stage_start`/`stage_end` pairs, and wave0.ts becomes pure orchestration. The `stubs.test.ts` "2 starts + 2 ends" assertion is preserved because the detectors emit the same event names (`wave_0_content_type`, `wave_0_niche_detector`).

---

### `src/lib/engine/wave0/content-type-weights.ts` (utility, transform)

**Analog:** `src/lib/engine/aggregator.ts` `selectWeights` function lines 50-85 (same "pure function on typed-object" shape + same `clamp` idiom).

**Constant + type pattern** (aggregator.ts:25-35):
```typescript
const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
} as const;
```

**For Wave 0 weights matrix** (RESEARCH lines 650-687) — same `Record<X, Y> as const` flavor + clamp helper:
```typescript
import type { GeminiVideoSignals } from "../types";

export type ContentTypeSlug =
  | "talking_head" | "b_roll" | "slideshow" | "action"
  | "tutorial" | "vlog" | "other";

export type SignalMultipliers = {
  visual_production_quality: number;
  hook_visual_impact: number;
  pacing_score: number;
  transition_quality: number;
};

export const CONTENT_TYPE_WEIGHT_MATRIX: Record<ContentTypeSlug, SignalMultipliers> = {
  talking_head: { visual_production_quality: 1.0, hook_visual_impact: 1.1, pacing_score: 1.0, transition_quality: 0.8 },
  b_roll:       { visual_production_quality: 1.2, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.2 },
  // ... 5 more rows (locked matrix per CONTEXT D-12)
};

export const MULTIPLIER_FLOOR = 0.5;
export const MULTIPLIER_CEILING = 1.5;

export function applyContentTypeWeights(
  signals: GeminiVideoSignals,
  contentType: ContentTypeSlug | null,
): GeminiVideoSignals {
  const mult = CONTENT_TYPE_WEIGHT_MATRIX[contentType ?? "other"];
  const clamp = (m: number) =>
    Math.max(MULTIPLIER_FLOOR, Math.min(MULTIPLIER_CEILING, m));
  return {
    visual_production_quality:
      Math.min(10, signals.visual_production_quality * clamp(mult.visual_production_quality)),
    hook_visual_impact:
      Math.min(10, signals.hook_visual_impact * clamp(mult.hook_visual_impact)),
    pacing_score:
      Math.min(10, signals.pacing_score * clamp(mult.pacing_score)),
    transition_quality:
      Math.min(10, signals.transition_quality * clamp(mult.transition_quality)),
  };
}
```

---

### `src/lib/engine/wave0/prompts.ts` (utility, transform)

**Analog:** `src/lib/engine/deepseek.ts` STABLE_SYSTEM_PROMPT (54-123) + `buildDeepSeekUserMessage` (435-492).

Same template-literal + `${dynamic}` interpolation pattern. Key load-bearing rules from analog (preserve in wave0/prompts.ts):
- System prompt is a **module-level `const`** (byte-identical for cache prefix matching)
- User-message-builder is a **pure function** that returns a string, no side effects
- Dynamic data MUST go in the user message (per `STABLE_SYSTEM_PROMPT` comment block, lines 49-53)
- For `NICHE_TREE` inlining: `NICHE_TREE.map(p => p.slug).join(", ")` resolved at module load — still byte-identical across calls
- User-supplied content (handles, URLs) sanitized via `<<<USER_CONTENT>>>` wrap pattern (creator.ts:251-253, 322-338)

---

### `src/lib/engine/types.ts` (model, type + schema — extension)

**Analog:** existing `GeminiResponseSchema` (types.ts:251-256), `GeminiVideoSignalsSchema` (244-249), `DeepSeekResponseSchema` (303-309).

**Existing Zod schema → type-infer pattern** (types.ts:244-258):
```typescript
export const GeminiVideoSignalsSchema = z.object({
  visual_production_quality: z.number().min(0).max(10),
  hook_visual_impact: z.number().min(0).max(10),
  pacing_score: z.number().min(0).max(10),
  transition_quality: z.number().min(0).max(10),
});

export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).length(5),
  overall_impression: z.string(),
  content_summary: z.string(),
  video_signals: GeminiVideoSignalsSchema.optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;
```

**Existing Wave0Result interface to widen** (types.ts:205-209):
```typescript
/** Wave 0 no-op stub return — Phase 4 fills content_type + niche. */
export interface Wave0Result {
  content_type: string | null;
  niche: { primary: string; sub: string; micro: string } | null;
}
```

**Phase 4 extension** (RESEARCH lines 911-957) — same `z.object/z.enum/.nullable()/z.infer` pattern:
```typescript
export const ContentTypeEnumSchema = z.enum([
  "talking_head", "b_roll", "slideshow", "action",
  "tutorial", "vlog", "other",
] as const);
export type ContentTypeSlug = z.infer<typeof ContentTypeEnumSchema>;

export const Wave0ContentTypeResultSchema = z.object({
  type: ContentTypeEnumSchema,
  confidence: z.number().min(0).max(1),
  warning: z.enum(["mixed_content_detected", "low_confidence"]).optional(),
});
export type Wave0ContentTypeResult = z.infer<typeof Wave0ContentTypeResultSchema>;

export const Wave0NicheResultSchema = z.object({
  primary: z.string(),
  sub: z.string(),
  micro: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["ai", "card1_fallback"]),
  warning: z
    .enum(["niche_drift_detected", "niche_low_confidence_no_fallback"])
    .optional(),
});
export type Wave0NicheResult = z.infer<typeof Wave0NicheResultSchema>;

export const Wave0ResultSchema = z.object({
  content_type: Wave0ContentTypeResultSchema.nullable(),
  niche: Wave0NicheResultSchema.nullable(),
});
export type Wave0Result = z.infer<typeof Wave0ResultSchema>;
```
Replace lines 205-209 of types.ts with these schema + inferred-type definitions.

---

### `src/lib/engine/pipeline.ts` (controller — pre-fetch insert at line 269)

**Analog:** existing `creatorPromise` block (pipeline.ts:343-358).

**Existing creator fetch (move + cache via PipelineOptions)** (pipeline.ts:343-359):
```typescript
const creatorPromise = (async (): Promise<CreatorContext> => {
  try {
    return await timed("creator_context", timings, () =>
      fetchCreatorContext(supabase, payload.creator_handle, payload.niche),
      { wave: 1, onEvent: onStageEvent }
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

**Phase 4 insertion point** (pipeline.ts:269 — BEFORE current `runWave0` call):
```typescript
// NEW: pre_creator_context step — runs after normalize, before Wave 0
const supabase = createServiceClient();
const creatorContext = opts?.creatorContext ?? await (async () => {
  try {
    return await timed(
      "pre_creator_context",
      timings,
      () => fetchCreatorContext(supabase, payload.creator_handle, payload.niche),
      { wave: 1, onEvent: onStageEvent }
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "pre_creator_context", requestId } });
    warnings.push(
      `Creator context pre-fetch unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    return DEFAULT_CREATOR_CONTEXT;
  }
})();

// Wave 0 now takes the pre-fetched creatorContext
const wave0Result = await runWave0(payload, creatorContext, onStageEvent);
```

**PipelineOptions extension** (pipeline.ts:65-78) — add `creatorContext?: CreatorContext`:
```typescript
export interface PipelineOptions {
  requestId?: string;
  onStageEvent?: StageEventCallback;
  bypassCache?: boolean;
  // NEW Phase 4 (D-17/D-18):
  creatorContext?: CreatorContext;
}
```

**Wave 1 creator promise simplification** (pipeline.ts:343-359 — replace with passthrough):
```typescript
const creatorPromise = (async () => {
  return await timed("creator_context", timings, async () => creatorContext, {
    wave: 1, onEvent: onStageEvent,
  });
})();
```
Preserves the `creator_context` Wave-1 stage_start/end event pair (backwards-compat with pipeline.test.ts), but the work has already been done by the pre-fetch.

---

### `src/lib/engine/aggregator.ts` (service, transform — additive extension)

**Analog:** existing `assembleFeatureVector` (aggregator.ts:149-201) + `availability` block (289-303).

**Existing SignalAvailability + availability computation** (types.ts:197-203 + aggregator.ts:289-303):
```typescript
// types.ts:197-203
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
}
```
```typescript
// aggregator.ts:289-303
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

**Phase 4 extension** (per RESEARCH lines 720-728 + CONTEXT D-20):
```typescript
// types.ts:197-203 — add 2 keys
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;  // NEW Phase 4 (D-20)
  niche: boolean;          // NEW Phase 4 (D-20)
}

// aggregator.ts ~line 287-303 — add 2 lines to the object literal
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules: /* unchanged */,
  trends: /* unchanged */,
  content_type: pipelineResult.wave0Result.content_type !== null,  // NEW
  niche: pipelineResult.wave0Result.niche !== null,                 // NEW
};
```
**IMPORTANT:** `selectWeights()` (aggregator.ts:50-85) — DO NOT add new keys to its iteration. The `SCORE_WEIGHTS` constant has only 5 keys; the new `content_type`/`niche` flags are provenance-only and must NOT be looped through `selectWeights`. Either filter the iteration to known SCORE_WEIGHTS keys, or pass a narrower subtype to `selectWeights`.

**Existing assembleFeatureVector signature to widen** (aggregator.ts:149-201) — accept optional adjusted video signals:
```typescript
// BEFORE (current)
function assembleFeatureVector(pipelineResult: PipelineResult): FeatureVector {
  const { payload, geminiResult, deepseekResult, ruleResult, trendEnrichment } =
    pipelineResult;
  const gemini = geminiResult.analysis;
  // ...
  return {
    // ...
    visualProductionQuality: gemini.video_signals?.visual_production_quality ?? null,
    hookVisualImpact: gemini.video_signals?.hook_visual_impact ?? null,
    pacingScore: gemini.video_signals?.pacing_score ?? null,
    transitionQuality: gemini.video_signals?.transition_quality ?? null,
    // ...
  };
}
```
**Phase 4 extension** (RESEARCH lines 1136-1148):
```typescript
function assembleFeatureVector(
  pipelineResult: PipelineResult,
  adjustedVideoSignals?: GeminiVideoSignals | null,  // NEW Phase 4 (D-12)
): FeatureVector {
  const { payload, geminiResult, deepseekResult, ruleResult, trendEnrichment } =
    pipelineResult;
  const gemini = geminiResult.analysis;
  const videoSignals = adjustedVideoSignals ?? gemini.video_signals ?? null;
  // ...
  return {
    // ...
    visualProductionQuality: videoSignals?.visual_production_quality ?? null,
    hookVisualImpact: videoSignals?.hook_visual_impact ?? null,
    pacingScore: videoSignals?.pacing_score ?? null,
    transitionQuality: videoSignals?.transition_quality ?? null,
    // ...
  };
}
```

**Call site change** (aggregator.ts:281 area):
```typescript
// NEW: lookup content type, compute adjusted signals
const wave0 = pipelineResult.wave0Result;
const contentTypeSlug = wave0.content_type?.type ?? null;
let adjustedVideoSignals = gemini.video_signals ?? null;
if (adjustedVideoSignals && contentTypeSlug !== null) {
  adjustedVideoSignals = applyContentTypeWeights(adjustedVideoSignals, contentTypeSlug);
}

const feature_vector = assembleFeatureVector(pipelineResult, adjustedVideoSignals);
```

---

### `src/lib/niches/taxonomy.ts` (model, transform — extension)

**Analog:** existing `NICHE_TREE` constant lines 30-175 + `NichePrimary` type lines 22-26.

**Existing type to extend** (taxonomy.ts:20-26):
```typescript
export type NicheSubItem = { slug: string; label: string };

export type NichePrimary = {
  slug: string;
  label: string;
  subs: NicheSubItem[];
};
```

**Phase 4 extension** (RESEARCH lines 1090-1129):
```typescript
export type PersonaMix = {
  archetype: string;
  weight: number;
};

export type BenchmarkFilters = {
  tag_filters: string[];
  min_corpus_size: number;
};

export type NichePrimary = {
  slug: string;
  label: string;
  subs: NicheSubItem[];
  personas: PersonaMix[];               // NEW Phase 4 (D-13)
  benchmark_filters: BenchmarkFilters;  // NEW Phase 4 (D-14)
};
```

**Existing data shape to extend** (taxonomy.ts:31-44 for Beauty primary):
```typescript
{
  slug: "beauty",
  label: "Beauty",
  subs: [
    { slug: "skincare", label: "Skincare" },
    { slug: "makeup", label: "Makeup" },
    // ...
  ],
}
```

**Phase 4 per-primary additions** (RESEARCH lines 1113-1128 — example for Beauty; mappings for all 10 in RESEARCH Topics #6 + #7):
```typescript
{
  slug: "beauty",
  label: "Beauty",
  subs: [/* unchanged */],
  personas: [
    { archetype: "fyp-female-gen-z",        weight: 4 },
    { archetype: "fyp-female-millennial",   weight: 2 },
    { archetype: "niche-beauty-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious",     weight: 1 },
  ],
  benchmark_filters: {
    tag_filters: ["beauty", "makeup", "skincare", "grwm", "tutorial", "haircare"],
    min_corpus_size: 20,
  },
},
```

---

### `src/lib/engine/__tests__/wave0-content-type.test.ts` (test, unit, mocked LLM)

**Analog:** `src/lib/engine/__tests__/gemini.test.ts` (lines 1-100).

**Module mocking pattern** (gemini.test.ts:5-77):
```typescript
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockGenerate = vi.fn();
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = {
      upload: mockFileUpload,
      get: mockFileGet,
      delete: mockFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      NUMBER: "NUMBER",
    },
  };
});

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue(JSON.stringify({/* calibration shape */})),
  },
}));

process.env.GEMINI_API_KEY = "test-key";
```

**Test happy-path pattern** (gemini.test.ts:92-100+):
```typescript
describe("analyzeWithGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid analysis and cost on success", async () => {
    const analysis = makeGeminiAnalysis();
    mockGenerate.mockResolvedValue({
      text: JSON.stringify(analysis),
      // ...
    });
    // assertions
  });
});
```

For wave0-content-type.test.ts: same shape; add tests per RESEARCH Topic #9 row 1 (10 test cases — 7-cat enum, video_upload guard, upload failure, FAILED state, polling timeout, schema validation, event emission, cost>0, low_confidence warning, mixed_content warning).

---

### `src/lib/engine/__tests__/wave0-niche-detector.test.ts` (test, unit, mocked LLM)

**Analog:** `src/lib/engine/__tests__/deepseek.test.ts` (lines 1-120).

**OpenAI SDK mocking pattern** (deepseek.test.ts:21-27):
```typescript
const mockCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});
```

**Env-var + module-under-test import order pattern** (deepseek.test.ts:103-114):
```typescript
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.GEMINI_API_KEY = "test-key";

import { isCircuitOpen, resetCircuitBreaker, reasonWithDeepSeek } from "../deepseek";
import { DeepSeekResponseSchema } from "../types";
import {
  makeGeminiAnalysis,
  makeRuleScoreResult,
  makeTrendEnrichment,
  makeDeepSeekReasoning,
} from "./factories";
```

For wave0-niche-detector.test.ts: same shape; 14 test cases per RESEARCH Topic #9 row 2 (full result, Card 1 fallback, AI source, drift detection, low_confidence_no_fallback warning, micro null, confidence boundaries 0.59/0.60, unknown slug paths, stage event emission, cost telemetry).

---

### `src/lib/engine/__tests__/wave0-orchestration.test.ts` (test, unit, callback-driven)

**Analog:** existing `src/lib/engine/__tests__/stubs.test.ts` Wave 0 suite (lines 16-44).

**Callback-driven event-assertion pattern** (stubs.test.ts:22-39):
```typescript
it("emits 2 stage_start + 2 stage_end events with wave=0 and cost_cents=0", async () => {
  const cb = vi.fn();
  await runWave0(fakePayload, cb);
  const events = cb.mock.calls.map(c => c[0] as StageEvent);
  expect(events).toHaveLength(4);
  const starts = events.filter(e => e.type === "stage_start");
  const ends = events.filter(e => e.type === "stage_end");
  expect(starts).toHaveLength(2);
  expect(ends).toHaveLength(2);
  expect(starts.map(e => "stage" in e && e.stage).sort()).toEqual(["wave_0_content_type", "wave_0_niche_detector"]);
  for (const e of ends) {
    if (e.type === "stage_end") {
      expect(e.wave).toBe(0);
      expect(e.cost_cents).toBe(0);
      expect(e.ok).toBe(true);
    }
  }
});
```

For wave0-orchestration.test.ts: same shape; 6 test cases per RESEARCH Topic #9 row 3 (parallel timing, both fail, one fails, event ordering, pre-fetch reuse, no double-fetch). To assert `Promise.allSettled` isolation: have one mocked detector reject + verify the other still returns a value AND `Wave0Result.content_type/niche` reflects exactly one null.

---

### `src/lib/engine/__tests__/content-type-weights.test.ts` (test, unit, pure function)

**Analog:** `src/lib/engine/__tests__/aggregator.test.ts` `selectWeights` suite (lines 72-194).

**Pure-function exhaustive lookup + invariant pattern** (aggregator.test.ts:72-90):
```typescript
describe("selectWeights", () => {
  it("returns base weights when all signals are available", () => {
    const weights = selectWeights({
      behavioral: true, gemini: true, ml: true, rules: true, trends: true,
    });
    expect(weights).toEqual({
      behavioral: 0.35, gemini: 0.25, ml: 0.15, rules: 0.15, trends: 0.1,
    });
  });
  // ... more lookup variations
});
```

For content-type-weights.test.ts: 8 test cases per RESEARCH Topic #9 row 4 (7 lookup variations + cap/floor enforcement + null passthrough + 4 fields independent + slideshow halves pacing + action up-weights all). No mocks needed — pure function.

---

### `src/lib/niches/__tests__/taxonomy.test.ts` (test extension, unit, data invariants)

**Analog:** EXISTING `src/lib/niches/__tests__/taxonomy.test.ts` lines 10-50 (extend in place — same `describe` blocks, same invariant style).

**Existing invariant pattern** (taxonomy.test.ts:35-49):
```typescript
it("each primary has 8-12 sub-niches", () => {
  for (const primary of NICHE_TREE) {
    expect(primary.subs.length).toBeGreaterThanOrEqual(8);
    expect(primary.subs.length).toBeLessThanOrEqual(12);
  }
});

it("all slugs are lowercase and hyphen-separated (no spaces, no underscores, no uppercase)", () => {
  for (const primary of NICHE_TREE) {
    expect(primary.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const sub of primary.subs) {
      expect(sub.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  }
});
```

For Phase 4 additions: 5 test cases per RESEARCH Topic #9 row 7 (every primary has non-empty `personas`, personas weights sum to 10, every primary has non-empty `benchmark_filters.tag_filters`, `min_corpus_size > 0` integer, existing helpers regress green). Drop into the same file — no new test file.

---

### `src/lib/engine/__tests__/pipeline.test.ts` (test extension)

**Analog:** existing `pipeline.test.ts` test scaffolding (lines 200-260+).

**Existing Supabase mock + beforeEach reset + test happy-path pattern** (pipeline.test.ts:223-283):
```typescript
describe("pipeline integration tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCircuitBreaker();
    supabaseTableOverrides = {};
    // Default Gemini mock
    mockGeminiGenerate.mockResolvedValue({
      text: JSON.stringify(makeGeminiAnalysis()),
      usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300 },
    });
    // Default DeepSeek mock
    mockDeepSeekCreate.mockResolvedValue({/* ... */});
    supabaseTableOverrides = {
      rule_library: { data: [], error: null },
      // ...
    };
  });

  it("happy path: all stages succeed and produce a complete PipelineResult", async () => {
    const result = await runPredictionPipeline(input);
    expect(result.payload.input_mode).toBe("text");
    // ...
  });
});
```

For Phase 4 extensions: 6 new it() blocks per RESEARCH Topic #9 row 5 (pre_creator_context emitted before wave_0_*; creator_context Wave-1 still fires; opts.creatorContext bypasses DB; absent opts triggers internal fetch; Wave 0 ordering before Wave 1; wave0Result populated). All slot into the existing `describe("pipeline integration tests")` block — no new file.

To assert event ordering, capture a callback array and verify index of `pre_creator_context` < index of `wave_0_*`:
```typescript
const events: StageEvent[] = [];
const result = await runPredictionPipeline(input, {
  onStageEvent: (e) => events.push(e),
});
const preIdx = events.findIndex(e => e.type === "stage_start" && e.stage === "pre_creator_context");
const w0Idx = events.findIndex(e => e.type === "stage_start" && e.stage === "wave_0_content_type");
expect(preIdx).toBeGreaterThanOrEqual(0);
expect(preIdx).toBeLessThan(w0Idx);
```

---

### `src/lib/engine/__tests__/aggregator.test.ts` (test extension)

**Analog:** existing `aggregator.test.ts` `describe("aggregateScores")` block (lines 200-290+).

**Existing factory-driven test pattern** (aggregator.test.ts:211-228):
```typescript
it("returns valid result with all signals (happy path)", async () => {
  const result = await aggregateScores(makePipelineResult());
  expect(result.overall_score).toBeGreaterThanOrEqual(0);
  expect(result.overall_score).toBeLessThanOrEqual(100);
  expect(result.confidence).toBeGreaterThanOrEqual(0);
  // ...
});
```

For Phase 4 extensions: 6 it() blocks per RESEARCH Topic #9 row 6 (signal_availability.content_type set from wave0Result; signal_availability.niche set from wave0Result; feature_vector uses adjusted signals when content_type present; feature_vector uses raw signals when content_type null; matrix application doesn't change `gemini.factors[]` math; existing tests still pass).

To exercise adjusted signals, factory-override `wave0Result`:
```typescript
const pipeline = makePipelineResult({
  wave0Result: {
    content_type: { type: "slideshow", confidence: 0.9 },
    niche: { primary: "beauty", sub: "skincare", micro: null, confidence: 0.8, source: "ai" },
  },
  geminiResult: {
    analysis: makeGeminiAnalysis({
      video_signals: {
        visual_production_quality: 8,
        hook_visual_impact: 8,
        pacing_score: 8,
        transition_quality: 8,
      },
    }),
    cost_cents: 0.5,
  },
});
const result = await aggregateScores(pipeline);
// slideshow matrix: pacing_score multiplier 0.5 → adjusted = 8 * 0.5 = 4
expect(result.feature_vector.pacingScore).toBeCloseTo(4, 1);
```

Note: `makePipelineResult` factory (factories.ts:226-270) currently builds `wave0Result: { content_type: null, niche: null }` which matches the OLD `Wave0Result` shape. Per Phase 4 typing widening (`content_type: Wave0ContentTypeResult | null`), the factory itself is type-compatible (null is still a valid value). Override only when a test specifically exercises non-null Wave 0 outputs.

---

## Shared Patterns

### Authentication / Authorization
**N/A** — Wave 0 detectors are server-side LLM calls invoked from within the pipeline, no per-request auth. The route layer (`/api/analyze`) already enforces Supabase auth before invoking the pipeline. Detectors inherit that boundary.

### Error Handling — Graceful Degradation (LOAD-BEARING)
**Source:** Per CONTEXT D-16 + RESEARCH Pattern 1 + existing `pipeline.ts` non-critical stage pattern (lines 343-359, 362-378, 402-437, 440-456).
**Apply to:** All new detector files (`content-type-detector.ts`, `niche-detector.ts`) + `wave0.ts` orchestrator.

**Standard wrapper pattern** (pipeline.ts:343-359):
```typescript
const xPromise = (async (): Promise<XResult | null> => {
  try {
    return await timed("stage_name", timings, async () => doWork(), {
      wave: 1,
      onEvent: onStageEvent,
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "stage_name", requestId },
    });
    warnings.push(
      `Stage X unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "stage_name", duration_ms: 0 });
    return DEFAULT_X_RESULT;  // or null
  }
})();
```

**Detector-internal adaptation** (per RESEARCH Pattern 2 + 3 — DO NOT throw, emit warning event + return null):
```typescript
try {
  // ... LLM call + Zod parse ...
  emitStageEnd(onEvent, "wave_0_X", 0, startTs, {
    cost_cents: +costCents.toFixed(4),
    ok: true,
    warning: result.warning,
  });
  return result;
} catch (error) {
  Sentry.captureException(error, { tags: { stage: "wave_0_X" } });
  log.warn("Detector failed", { error: error instanceof Error ? error.message : String(error) });
  emitStageEnd(onEvent, "wave_0_X", 0, startTs, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: error instanceof Error ? error.message : String(error),
  });
  return null;  // graceful degradation per CONTEXT D-16
}
```

### Validation — Zod at LLM Boundary
**Source:** types.ts:244-309 + gemini.ts:96-116 + deepseek.ts:311-326.
**Apply to:** Every detector that parses an LLM response.

**Three-step pattern:**
```typescript
// 1. Define schema in types.ts at module scope
export const Wave0XSchema = z.object({/* ... */});
export type Wave0X = z.infer<typeof Wave0XSchema>;

// 2. Strip fences (gemini.ts:91-94 / deepseek.ts:311-315)
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  return fenced ? fenced[1]!.trim() : text.trim();
}

// 3. Parse + safeParse + throw-on-invalid
const cleaned = stripFences(raw);
const parsed = JSON.parse(cleaned);
const result = Wave0XSchema.safeParse(parsed);
if (!result.success) {
  throw new Error(`Wave0X response validation failed: ${result.error.message}`);
}
return result.data;
```
The thrown error is caught by the detector's outer try/catch (above) and converted into `null + stage_end{ok: false, warning}` — never bubbles to the pipeline.

### Logging — createLogger module tag
**Source:** All engine files (gemini.ts:15, deepseek.ts:17, creator.ts:5, pipeline.ts:226).
**Apply to:** Every new detector + helper file.

```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "wave0.content-type" });  // or wave0.niche, wave0.weights, etc.
```

### Stage Event Emission — performance.now via emitStageStart/emitStageEnd
**Source:** events.ts:19-49.
**Apply to:** Every detector (`detectContentType`, `detectNiche`); wave0.ts orchestrator NO LONGER emits its own pairs (per RESEARCH Pattern 1 — detectors own their event lifecycle).

```typescript
const startTs = emitStageStart(onEvent, "wave_0_content_type", 0);
// ... work ...
emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
  cost_cents: +costCents.toFixed(4),
  ok: true,
  warning: result.warning,
});
```

### Sentry Instrumentation — Breadcrumb + captureException
**Source:** gemini.ts:374-379, 522-526; deepseek.ts:607-613, 643-646; pipeline.ts:271-276, 388-393.
**Apply to:** All new detectors; matches existing engine convention.

```typescript
Sentry.addBreadcrumb({
  category: "engine.wave0",
  message: "Content-type detection complete",
  level: "info",
  data: { duration_ms, cost_cents: +costCents.toFixed(4), model: GEMINI_WAVE0_MODEL },
});

// On error:
Sentry.captureException(error, {
  tags: { stage: "wave_0_content_type" },
});
```

### LLM Client Lazy Init + Env-Var Guard
**Source:** gemini.ts:81-88, deepseek.ts:243-253.
**Apply to:** Both new detectors (separate clients per file — both use lazy `let client | null` pattern).

```typescript
let client: GoogleGenAI | null = null;  // or OpenAI | null
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
```

### Retry + Timeout Pattern — AbortController + exponential backoff
**Source:** gemini.ts:329-392 (Gemini 1s/3s backoff) + deepseek.ts:523-636 (DeepSeek 1s/3s backoff with circuit breaker).
**Apply to:** content-type-detector (use Gemini-style retry — no circuit breaker needed); niche-detector (use simpler one-shot try, NO circuit breaker — that's reserved for the shared Wave 2 client).

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

const response = await ai.models.generateContent({
  model: MODEL,
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
    abortSignal: controller.signal,
  },
});

clearTimeout(timeout);
```

### STABLE/VOLATILE Prompt Split (cache prefix stability)
**Source:** deepseek.ts:43-123 (STABLE_SYSTEM_PROMPT) + deepseek.ts:435-492 (`buildDeepSeekUserMessage`).
**Apply to:** `wave0/prompts.ts` for the niche detector — same architectural rule (per RESEARCH Pitfall 3): dynamic content (caption, hashtags, creator fields) MUST live in user message; system prompt is byte-identical across calls.

### Cost Telemetry — performance.now duration + cost_cents in stage_end
**Source:** gemini.ts:354-372 + deepseek.ts:585-606.
**Apply to:** Both detectors — same pattern: token-based cost calculation + `log.info` + `Sentry.addBreadcrumb` + `cost_cents` carried in `emitStageEnd` event.

### Test Module Mocking — Hoisted vi.mock + factory imports last
**Source:** gemini.test.ts:5-77 + deepseek.test.ts:6-105 + pipeline.test.ts:18-200.
**Apply to:** All new test files. Key idioms:
1. `vi.mock(...)` calls at top of file (hoisted by Vitest)
2. `process.env.X = "test-key"` BEFORE imports
3. Module-under-test imported AFTER all mocks
4. Factory imports from `./factories.ts` last
5. `beforeEach(() => { vi.clearAllMocks(); })`

---

## No Analog Found

All Phase 4 files have strong analogs. No "no analog" cases.

---

## Critical Cross-File Constraints (planner: enforce explicitly)

1. **stubs.test.ts MUST stay green.** The current Wave 0 stub-test contract is "2 starts + 2 ends with wave=0 and cost_cents=0" (stubs.test.ts:22-39). Phase 4's filled detectors must:
   - Emit the SAME event names: `wave_0_content_type`, `wave_0_niche_detector`
   - Emit the SAME wave number: `0`
   - When no video is uploaded (input_mode != "video_upload") or DeepSeek fails: still emit a start/end pair with `cost_cents: 0, ok: true` and a warning string
   - Return `{ content_type: null, niche: null }` matches the same JSON shape as the widened type (null is still valid for both keys per Wave0ResultSchema)

2. **factories.makePipelineResult `wave0Result: { content_type: null, niche: null }` (line 257) is type-compatible** with the widened type — both fields accept null. Existing aggregator tests do NOT need factory updates unless they exercise non-null Wave 0 paths.

3. **selectWeights() (aggregator.ts:50-85) iterates `Object.entries(availability)` — if SignalAvailability gains `content_type`/`niche` keys, `selectWeights` will try to look them up in `SCORE_WEIGHTS` and find `undefined`.** The plan MUST either:
   - Filter the iteration to known SCORE_WEIGHTS keys (`if (key in SCORE_WEIGHTS)`)
   - Or use a `Pick<SignalAvailability, "behavioral" | "gemini" | "ml" | "rules" | "trends">` subtype on the selectWeights parameter
   - The current code reads `SCORE_WEIGHTS[key as keyof typeof SCORE_WEIGHTS]` which would silently return undefined and break the sum → critical bug if not addressed.

4. **DO NOT flip `DEEPSEEK_MODEL` (deepseek.ts:19)** per RESEARCH Topic #12. Introduce `DEEPSEEK_NICHE_MODEL` env in niche-detector.ts ONLY. CONTEXT D-03's "flip" is reinterpreted as "introduce a new env constant for V4 Flash for the Wave 0 call; keep deepseek-reasoner for Wave 2 until 2026-07-24 grace period closes."

5. **DO NOT change `GEMINI_MODEL` (gemini.ts:17)** per CONTEXT D-04. Introduce `GEMINI_WAVE0_MODEL` env in content-type-detector.ts ONLY. Default to `"gemini-3-flash-preview"` (NOT `"gemini-3-flash"` per RESEARCH Anti-Pattern).

6. **Wave 0 stage events must fire BEFORE Wave 1 stage events.** Current pipeline.ts:269 runs `runWave0` before the wave-1 `Promise.all`. Phase 4 must preserve this; add `pre_creator_context` event BEFORE `wave_0_*` events.

7. **Event emission ownership moves from wave0.ts to the individual detectors.** Current stub double-emits in wave0.ts itself; Phase 4 detectors emit their own pairs and wave0.ts becomes pure `Promise.allSettled` orchestration. Net event count to outer observer is unchanged (2 starts + 2 ends), preserving stubs.test.ts assertions.

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/lib/engine/__tests__/`, `src/lib/niches/`, `src/lib/niches/__tests__/`
**Files scanned:** 17 engine source files + 18 engine test files + 1 niches source file + 1 niches test file = 37 files (read 11 in detail; light-skim on the rest)
**Pattern extraction date:** 2026-05-18
