# Phase 9: Platform Algo Fit + Self-Critique + Counterfactuals — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 14 (5 modify, 9 new)
**Analogs found:** 14 / 14 (all have a direct in-repo precedent from Phase 5/6/7/8)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| NEW `src/lib/engine/wave4/platform-fit.ts` | orchestrator/service | request-response (V3 LLM) | `src/lib/engine/wave3.ts` | exact-role, single-call vs parallel (slimmer) |
| NEW `src/lib/engine/wave4/platform-fit-prompts.ts` | prompt builders + Zod | transform | `src/lib/engine/wave3/persona-prompts.ts` | exact |
| NEW `src/lib/engine/wave4/platform-fit-schemas.ts` (optional split) | schema | validation | `src/lib/engine/gemini/schemas.ts` | role-match |
| NEW `src/lib/engine/wave4/__tests__/platform-fit.test.ts` | unit test | mock LLM | `src/lib/engine/__tests__/wave3.test.ts` | exact |
| NEW `src/lib/engine/wave4/__tests__/platform-fit-prompts.test.ts` | unit test | snapshot | `src/lib/engine/__tests__/wave3-persona-prompts.test.ts` | exact |
| MODIFY `src/lib/engine/stage10-critique.ts` | orchestrator/service | request-response (V3 LLM) | `src/lib/engine/wave3.ts` (single-call subset) | role-match (currently no-op stub) |
| NEW `src/lib/engine/stage10-critique-prompts.ts` | prompt builders | transform | `src/lib/engine/wave3/persona-prompts.ts` | exact |
| NEW `src/lib/engine/__tests__/stage10-critique.test.ts` | unit test | mock LLM | `src/lib/engine/__tests__/wave3.test.ts` | role-match |
| MODIFY `src/lib/engine/stage11-counterfactuals.ts` | orchestrator/service | request-response (V3 LLM) | `src/lib/engine/wave3.ts` | role-match (currently no-op stub) |
| NEW `src/lib/engine/stage11-counterfactuals-prompts.ts` | prompt builders | transform | `src/lib/engine/wave3/persona-prompts.ts` | exact |
| NEW `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` | unit test | mock LLM + boundary | `src/lib/engine/__tests__/wave3.test.ts` | role-match |
| MODIFY `src/lib/engine/types.ts` | shared types | n/a | `src/lib/engine/types.ts` (Phase 8 retrieval extension lines 199-200, 264-271, 280-290) | self-reference precedent |
| MODIFY `src/lib/engine/aggregator.ts` | scoring | transform | `src/lib/engine/aggregator.ts` (Phase 8 retrieval lines 50-69, 146-252, 676-717, 789-812) | self-reference precedent |
| MODIFY `src/lib/engine/pipeline.ts` | orchestrator | wiring | `src/lib/engine/pipeline.ts` lines 749-755 (`runWave3` invocation) | exact wiring precedent |
| MODIFY `src/lib/engine/gemini/schemas.ts` | schema extension | validation | `src/lib/engine/gemini/schemas.ts` lines 49-62, 146-204 | self-reference precedent |
| MODIFY `src/lib/engine/gemini/prompts.ts` | prompt extension | transform | `src/lib/engine/gemini/prompts.ts` lines 30-67 (`buildHookSystemPrompt`) | self-reference precedent |

## Pattern Assignments

### `src/lib/engine/wave4/platform-fit.ts` (orchestrator, request-response)

**Analog:** `src/lib/engine/wave3.ts` (single-call subset — drop the 10-slot Promise.allSettled fan-out; keep client init, cost-aware pricing, retry-on-Zod, graceful degradation).

**Imports pattern** (mirror `wave3.ts:1-23`):

```typescript
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import { emitStageStart, emitStageEnd, type StageEventCallback } from "./events";
import { isCircuitOpen } from "./deepseek";
import {
  STABLE_PLATFORM_FIT_SYSTEM_PROMPT,
  buildPlatformFitUserMessage,
  PlatformFitResponseSchema,
} from "./platform-fit-prompts";
// types — PipelineResult, PlatformFitResult, target platform union
```

**Env + pricing constants** (copy from `wave3.ts:30-43`):

```typescript
const MODEL = process.env.DEEPSEEK_PLATFORM_FIT_MODEL ?? "deepseek-v4-flash";
const CACHE_HIT_PRICE  = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14   / 1_000_000;
const OUTPUT_PRICE     = 0.28   / 1_000_000;
const PER_CALL_TIMEOUT_MS = 15_000;
```

**Client init pattern** (copy verbatim from `wave3.ts:45-53`):

```typescript
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}
```

**Circuit-breaker fast-fail** (copy from `wave3.ts:94-107`):

```typescript
const stageStart = emitStageStart(onEvent, "platform_fit", "post");
if (isCircuitOpen()) {
  emitStageEnd(onEvent, "platform_fit", "post", stageStart, {
    cost_cents: 0, ok: false, warning: "circuit_breaker_open",
  });
  return null; // graceful — signal_availability.platform_fit becomes false
}
```

**Cache-aware cost telemetry** (copy verbatim from `wave3.ts:180-197`):

```typescript
const usage = response.usage as unknown as {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
};
const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
const completion = usage?.completion_tokens ?? 0;
const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
const inputCost = hasBreakdown
  ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
  : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
const callCostCents = (inputCost + completion * OUTPUT_PRICE) * 100;
```

**Retry-once on Zod failure** (mirror `wave3.ts:162-256`, single-slot variant):

```typescript
let attempt = 0;
let lastError: Error | null = null;
while (attempt <= 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const response = await ai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: STABLE_PLATFORM_FIT_SYSTEM_PROMPT }, // STABLE — cache prefix
        { role: "user",   content: userMessage },                       // VOLATILE
      ],
      response_format: { type: "json_object" },
    }, { signal: controller.signal });
    clearTimeout(timer);
    // ... usage-cost block above ...
    const text = response.choices[0]?.message?.content ?? "{}";
    const parsed = PlatformFitResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      lastError = new Error(`validation failed: ${parsed.error.message}`);
      if (attempt === 0) { attempt++; continue; }
      throw lastError;
    }
    emitStageEnd(onEvent, "platform_fit", "post", stageStart, {
      cost_cents: +costCents.toFixed(4), ok: true,
    });
    return { results: parsed.data.platforms.filter(...), cost_cents: costCents };
  } catch (err) {
    clearTimeout(timer);
    lastError = err instanceof Error ? err : new Error(String(err));
    if (lastError.name === "AbortError" || attempt === 1) break;
    attempt++;
  }
}
Sentry.captureException(lastError, { tags: { stage: "platform_fit" } });
emitStageEnd(onEvent, "platform_fit", "post", stageStart, {
  cost_cents: +costCents.toFixed(4), ok: false, warning: lastError?.message,
});
return null;
```

**Cost-cents float precision:** match aggregator/wave3 norm — emit `+costCents.toFixed(4)` on stage events (`wave3.ts:284-289`), `+costCents.toFixed(6)` for per-call telemetry. Use the 4-digit form for the stage-end of single-call stages.

---

### `src/lib/engine/wave4/platform-fit-prompts.ts` (prompt builder, transform)

**Analog:** `src/lib/engine/wave3/persona-prompts.ts` (D-17 cache discipline + Zod boundary + volatile user message).

**Stable system prompt convention** (copy structure from `persona-prompts.ts:30-66`):

```typescript
/**
 * Cache-stable system prompt (D-17 / Phase 7) + D-20 / Phase 9.
 * Same inputs → byte-identical output. NEVER interpolate Date.now() / Math.random()
 * / request IDs here — that would drop DeepSeek input-cache hit rate.
 * Per-platform rubric + creator-tier rules live HERE (not in the user message).
 */
export const STABLE_PLATFORM_FIT_SYSTEM_PROMPT = `You are a TikTok / Instagram Reels / YouTube Shorts platform algorithm fit scorer trained on the explicit rules of Jenny Hoyos, Ava Yuergens, and Alex Hormozi.

[~400-token distilled excerpt from .planning/research/creator-intelligence.md per CONTEXT D-19:
 - Platform Algorithm Insights (Jenny + Ava + Hormozi platform rules)
 - Numerical Rules table rows 1-10
 - Cross-Creator Consensus items 5/8/10
 - Creator-tier rules: TikTok favors nano-creators]

## Scoring Methodology
... [score 0-100 + rationale (2-4 sentences citing a framework or numerical rule by name) + watermark_penalty boolean] ...

## Output JSON Schema
{ "platforms": [ { "platform": "tiktok"|"ig_reels"|"yt_shorts", "fit_score": 0-100, "rationale": string, "watermark_penalty": boolean } ] }

Return ONLY this JSON object. Never use vague language ("could be better"). Always reference a specific rule, score, or timestamp.`;
```

**Volatile user message builder** (mirror `persona-prompts.ts:73-138`):

```typescript
export function buildPlatformFitUserMessage(
  pipelineResult: PipelineResult,
  targetPlatforms: ReadonlyArray<"tiktok" | "ig_reels" | "yt_shorts">,
  isRetry: boolean,
): string {
  const sections: string[] = ["## Video to Score"];
  // - target_platforms (explicit "ONLY score: tiktok" instruction when single — Pitfall 5)
  // - creator follower_tier (from getFollowerTier — corpus/follower-tier.ts:11)
  // - gemini factor scores + hook decomposition
  // - persona aggregate (watch_through_pct, scroll_past_second median)
  // - retrieval evidence top-3 (label only — no URLs per Phase 2 T-02-01)
  // - watermark flags from Gemini hook segment (watermark_detected.{tiktok,ig,yt})
  // - duration_hint (Pitfall 6 — bound timestamps in [0, duration_hint])
  return sections.join("\n");
}
```

**Zod boundary schema** (mirror `persona-prompts.ts:148-157` + Pitfall 5 cardinality bound):

```typescript
export const PlatformFitResultSchema = z.object({
  platform: z.enum(["tiktok", "ig_reels", "yt_shorts"]),
  fit_score: z.number().min(0).max(100),
  rationale: z.string().min(1).max(500),
  watermark_penalty: z.boolean(),
});
export const PlatformFitResponseSchema = z.object({
  platforms: z.array(PlatformFitResultSchema).min(1).max(3),
});
```

---

### `src/lib/engine/stage10-critique.ts` (orchestrator, request-response — FILL no-op)

**Current state (no-op stub) — `stage10-critique.ts:11-22`:**

```typescript
export async function runStage10Critique(
  _aggregateResult: PredictionResult,
  onEvent?: StageEventCallback,
): Promise<CritiqueResult | null> {
  const start = emitStageStart(onEvent, "stage_10_critique", "post");
  const result: CritiqueResult | null = null;
  emitStageEnd(onEvent, "stage_10_critique", "post", start, { cost_cents: 0, ok: true });
  return result;
}
```

**Keep:** function signature + stage event names (`stage_10_critique` / `post`).
**Fill:** same V3 call shell as `platform-fit.ts` above (client + STABLE prompt + Zod parse + retry-once + graceful null).
**Distinct logic:** TS-side clamp on `confidence_adjustment` to `[-0.20, 0]` (Pitfall 3; D-11). Apply in caller (aggregator side-effect) OR via a helper:

```typescript
// Pattern source: aggregator.ts:846-848 (HARD-03 confidence floor override)
export function applyCritiqueAdjustment(currentConfidence: number, critique: CritiqueResult): number {
  const adjustment = Math.max(-0.20, Math.min(0, critique.confidence_adjustment));
  return Math.max(0, Math.min(1, currentConfidence + adjustment));
}
```

**CritiqueResult shape (already defined `types.ts:280-285`)** — verify field names match Zod output schema before V3 call:

```typescript
export interface CritiqueResult {
  consistency_score: number;
  flags: string[];                 // D-12: human-readable strings, NOT code labels
  confidence_adjustment: number;   // clamped to [-0.20, 0] in TS, not in prompt
}
```

---

### `src/lib/engine/stage11-counterfactuals.ts` (orchestrator — FILL no-op)

**Current state (no-op stub) — `stage11-counterfactuals.ts:11-22`** — identical shape to stage10.

**Fill:** same V3 shell.
**Distinct logic:**
1. Zod cardinality `length(3)` on suggestions (D-15, Pitfall 1).
2. LIKELY_FLOP deterministic derivation runs AFTER critique adjustment (Pitfall 7). Pattern:

```typescript
// Pattern source: aggregator.ts:855-869 (warnings push pattern)
export function maybeAppendLikelyFlopWarning(result: PredictionResult): void {
  if (result.overall_score >= 30 || result.confidence <= 0.7) return;
  const top2Negative = [...result.factors]
    .filter((f) => f.score <= 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((f) => `${f.name} (${f.score}/10)`);
  const suffix = top2Negative.length > 0 ? ` Primary drag: ${top2Negative.join(", ")}.` : "";
  result.warnings.push(
    `LIKELY_FLOP: High-confidence prediction this video will underperform (score ${result.overall_score}/100, confidence ${(result.confidence * 100).toFixed(0)}%).${suffix}`,
  );
}
```

**CounterfactualResult shape (already defined `types.ts:287-290`)** — already `Array<{ change, timestamp_ms, expected_impact }>`. Zod must enforce `.length(3)`. Timestamp range refinement: `[0, payload.duration_hint]` (Pitfall 6).

---

### `src/lib/engine/types.ts` (shared types — EXTEND)

**Analog (self-reference):** Phase 8 retrieval extension at `types.ts:199-200, 220-222, 264-271`.

**Add `PlatformFitResult` type next to `CritiqueResult` (line 280):**

```typescript
/** Phase 9 D-03 — per-platform fit signal. */
export interface PlatformFitResult {
  platform: "tiktok" | "ig_reels" | "yt_shorts";
  fit_score: number;        // 0-100
  rationale: string;        // 2-4 sentences citing creator framework
  watermark_penalty: boolean;
}
```

**Extend `PredictionResult` (after line 222 `retrieval_evidence`):**

```typescript
// Phase 9 D-07: platform-fit signal output (optional for back-compat — Phase 7/8 precedent).
platform_fit?: PlatformFitResult[];
critique?: CritiqueResult;
counterfactuals?: CounterfactualResult;
```

**Extend `PredictionResult.score_weights` literal (lines 191-201):**

```typescript
score_weights: {
  behavioral: number;
  gemini: number;
  ml: number;
  rules: number;
  trends: number;
  audio?: number;
  retrieval?: number;
  /** Phase 9 D-07 — 0.05 base; redistributes when SignalAvailability.platform_fit = false. */
  platform_fit?: number;
};
```

**Extend `SignalAvailability` interface (after line 271 `retrieval?: boolean`):**

```typescript
/**
 * NEW Phase 9 (D-07) — true when V3 platform-fit call returned ≥1 PlatformFitResult.
 * Weight-bearing — IS in SCORE_WEIGHT_KEYS.
 * Optional for back-compat with Phase 4-8 callsites.
 */
platform_fit?: boolean;
```

**Pattern marker:** every Phase 9 addition is `?:` optional (Phase 7 D-20 + Phase 8 wiring precedent), preserving compile against the 200+ existing callsites.

---

### `src/lib/engine/aggregator.ts` (scoring — EXTEND)

**Analog (self-reference):** Phase 8 retrieval — `aggregator.ts:50-69, 146-252, 676-717, 789-812`.

**1. SCORE_WEIGHTS extension (lines 50-58):**

```typescript
export const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
  audio: 0.07,
  retrieval: 0.05,
  platform_fit: 0.05, // Phase 9 (D-07) — Phase 10 calibrates
} as const;
```

**2. SCORE_WEIGHT_KEYS tuple (line 69):**

```typescript
export const SCORE_WEIGHT_KEYS = [
  "behavioral", "gemini", "ml", "rules", "trends", "audio", "retrieval", "platform_fit",
] as const;
```

**3. `selectWeights` hasOwnProperty back-compat (lines 172-176):**

```typescript
const audioInInput = Object.prototype.hasOwnProperty.call(availability, "audio");
const retrievalInInput = Object.prototype.hasOwnProperty.call(availability, "retrieval");
const platformFitInInput = Object.prototype.hasOwnProperty.call(availability, "platform_fit");
const activeKeys = (SCORE_WEIGHT_KEYS.filter(
  (k) =>
    (k !== "audio" || audioInInput) &&
    (k !== "retrieval" || retrievalInInput) &&
    (k !== "platform_fit" || platformFitInInput),
) as readonly ScoreWeightKey[]);
```

**4. `selectWeights` return-shape widening (lines 146-156, 195-209):** add `platform_fit?: number` to `WeightsOut` and `initWeights()`. The normalization at lines 211-249 absorbs the new term automatically.

**5. `availability` construction (after line 716 `retrieval:`):**

```typescript
// Phase 9 D-07: platform-fit availability — true when runPlatformFit returned non-null.
platform_fit: pipelineResult.platformFitResult !== null && pipelineResult.platformFitResult.length > 0,
```

**6. `raw_overall_score` weighted-sum extension (lines 795-812):**

```typescript
const platformFitMean =
  pipelineResult.platformFitResult && pipelineResult.platformFitResult.length > 0
    ? pipelineResult.platformFitResult.reduce((s, p) => s + p.fit_score, 0) / pipelineResult.platformFitResult.length
    : 0;

const raw_overall_score = Math.min(
  100,
  Math.max(
    0,
    Math.round(
      behavioral_score * weights.behavioral +
        ctaPenaltyApplied_gemini_score * weights.gemini +
        (mlScore ?? 0) * weights.ml +
        ruleResult.rule_score * weights.rules +
        effectiveTrendEnrichment.trend_score * weights.trends +
        audio_score * (weights.audio ?? 0) +
        ((pipelineResult.retrievalResult.score ?? 0) * 100) * (weights.retrieval ?? 0) +
        platformFitMean * (weights.platform_fit ?? 0) // Phase 9
    )
  )
);
```

---

### `src/lib/engine/pipeline.ts` (orchestrator — EXTEND)

**Analog (self-reference):** `pipeline.ts:749-755` (`runWave3` invocation between Wave 2 and the aggregator handoff).

**Wiring excerpt (insert AFTER line 768 "Wave 3 complete" breadcrumb, BEFORE the "Stage 9: Aggregate" comment at line 770):**

```typescript
// -------------------------------------------------------
// Stage 8.5: Platform algorithm fit (Phase 9 D-08).
// Sequential AFTER Wave 3 (needs persona data per CONTEXT D-08).
// Self-emits stage_start/stage_end — DO NOT wrap in timed().
// -------------------------------------------------------
const platformFitOutcome = await runPlatformFit(
  {
    payload,
    creatorContext,
    wave0Result,
    geminiResult,
    deepseekResult: deepseekRaw?.reasoning ?? null,
    personaBehavioralAggregate,
    retrievalResult,
    audioFingerprintResult,
    // ...whichever fields the new orchestrator reads (see platform-fit.ts contract)
  },
  onStageEvent,
);
const platformFitResult = platformFitOutcome?.results ?? null;
const platformFitCostCents = platformFitOutcome?.cost_cents ?? 0;
```

**PipelineResult shape extension:** add `platformFitResult: PlatformFitResult[] | null` and roll `platformFitCostCents` into `total_cost_cents` (line 782-785).

**Stage 10 / Stage 11 invocations:** existing no-op stubs are already imported by `aggregator.ts:25-26`. After fill, the call sites do not change names — only behavior. Critique runs INSIDE `aggregateScores` AFTER the score+confidence are computed; counterfactuals runs LAST (Pitfall 7 ordering invariant).

---

### `src/lib/engine/gemini/schemas.ts` (schema — EXTEND)

**Analog (self-reference):** `gemini/schemas.ts:49-62` (HookDecompositionZodSchema) + `:174-200` (HOOK_SEGMENT_GEMINI_SCHEMA).

**Zod extension (after line 61 `cognitive_load`, before closing brace):**

```typescript
export const HookDecompositionZodSchema = z.object({
  visual_stop_power: ScoreSchema,
  audio_hook_quality: ScoreSchema,
  text_overlay_score: ScoreSchema,
  first_words_speech_score: ScoreSchema,
  weakest_modality: z.enum([
    "visual_stop_power", "audio_hook_quality", "text_overlay_score", "first_words_speech_score",
  ]),
  visual_audio_coherence: ScoreSchema,
  cognitive_load: ScoreSchema,
  // NEW Phase 9 (ALGO-06):
  watermark_detected: z.object({
    tiktok: z.boolean(),
    ig: z.boolean(),
    yt: z.boolean(),
  }).optional(),  // optional → back-compat with pre-Phase-9 cached JSONB rows (RESEARCH A4)
});
```

**Gemini literal extension (after line 200 `cognitive_load: { type: Type.NUMBER }`):**

```typescript
// Inside HOOK_SEGMENT_GEMINI_SCHEMA.properties.hook_decomposition.properties:
watermark_detected: {
  type: Type.OBJECT,
  properties: {
    tiktok: { type: Type.BOOLEAN },
    ig:     { type: Type.BOOLEAN },
    yt:     { type: Type.BOOLEAN },
  },
  required: ["tiktok", "ig", "yt"],
},
// DO NOT add watermark_detected to the parent `required` array — keep optional for back-compat.
```

**Critical:** hand-write BOTH schemas (Pitfall 7 / Phase 5 precedent — `zod-to-json-schema` emits incompatible keywords for Gemini's OpenAPI-3 subset).

---

### `src/lib/engine/gemini/prompts.ts` (prompt — EXTEND)

**Analog (self-reference):** `gemini/prompts.ts:25-67` (`buildHookSystemPrompt`).

**Extension point (insert before the closing `Return JSON matching the schema exactly.` at line 67):**

```text
## Watermark Detection
Examine the hook frame for platform-export watermarks (CHROME, not creator branding):
- TikTok: '@username' bottom-right with TikTok logo or 'TikTok' wordmark.
- Instagram: Instagram Reels logo bottom-left or '@username' on a coloured gradient.
- YouTube Shorts: Shorts logo + '@channel' bottom-center.

DO NOT mark as watermark: creator-added branding, decorative username overlays, stylized text without platform chrome.
ONLY mark true when the platform's logo OR a visible export wordmark is present.

Return watermark_detected.{tiktok|ig|yt} as boolean. Set false unless you see actual platform chrome.
```

**Negative examples are non-optional** — Pitfall 2 (UGC text overlay false positives).

---

### `src/lib/engine/wave4/__tests__/platform-fit.test.ts` (unit test — NEW)

**Analog:** `src/lib/engine/__tests__/wave3.test.ts` lines 1-120.

**Mock scaffolding (verbatim from `wave3.test.ts:27-61`):**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const { mockCreate, mockIsCircuitOpen } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockIsCircuitOpen: vi.fn(() => false),
}));

vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

vi.mock("../../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runPlatformFit } from "../platform-fit";
```

**Test surface (from RESEARCH validation table — ALGO-01..06):**
- single call, single platform → 1 result
- 3 platforms → 3 results
- empty target_platforms → defaults to TikTok (D-03)
- watermark flag in input → result has `watermark_penalty: true`
- Zod cardinality failure → retry once → success on 2nd
- AbortError → no retry, returns null
- circuit open → 0 V3 calls, returns null
- stage events: 1 start + 1 end emitted

**Fixture helpers:** reuse `src/lib/engine/__tests__/factories.ts` for `makePayload()`, `makeCreatorContext()`, `makeWave0Result()`. Extend with `makePlatformFitContext()`.

---

### `src/lib/engine/__tests__/stage10-critique.test.ts` (unit test — NEW)

**Analog:** same `wave3.test.ts` scaffold + clamp-specific assertions.

**Required fixtures (from RESEARCH CRITIQUE-13):**
- 4 consistency-check fixtures: signal-agreement divergence, score-vs-factors mismatch, Card 6 historical match, over-confidence with thin signals
- clamp boundary tests: input `-0.30` → output `-0.20`; input `+0.10` → output `0`
- card-6 URL absence assertion: scan user-message string with `expect(userMsg).not.toMatch(/https?:\/\//)`

---

### `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` (unit test — NEW)

**LIKELY_FLOP boundary fixtures (RESEARCH COUNTER-04):** 4 cases — (29, 0.71), (30, 0.71), (29, 0.69), (30, 0.69). Only the first should append `LIKELY_FLOP` to warnings.
**Cardinality:** `expect(result.suggestions).toHaveLength(3)`. Retry-on-bad-count test.
**Timestamp refinement (Pitfall 6):** `expect(result.suggestions.every(s => s.timestamp_ms <= durationHintMs)).toBe(true)`.

---

## Shared Patterns

### Stable system prompt + volatile user message (cache discipline)

**Source:** `src/lib/engine/wave3/persona-prompts.ts:23-66` (D-17), `src/lib/engine/gemini/prompts.ts:1-9` (AI-SPEC §4b).
**Apply to:** all three new V3 calls — platform-fit, critique, counterfactuals.

```typescript
// SYSTEM = byte-identical across calls. NEVER interpolate Date.now() / Math.random()
//          / request IDs. Per-platform / per-creator rubric goes HERE.
// USER   = per-request volatile context (PredictionResult fields, video data, follower_tier).
ai.chat.completions.create({
  model: MODEL,
  messages: [
    { role: "system", content: STABLE_PROMPT },  // cache prefix
    { role: "user",   content: userMessage },     // volatile
  ],
  response_format: { type: "json_object" },
});
```

**Pitfall 4 enforcement (planner discretion):** Add a Vitest snapshot pin-test that hashes each STABLE_*_SYSTEM_PROMPT. Any whitespace change breaks CI → forces intentional cache-warming acknowledgement.

---

### Stage event emission

**Source:** `src/lib/engine/wave3.ts:90, 285-289` + `stage10-critique.ts:15, 20`.
**Apply to:** every new stage (`platform_fit`, `stage_10_critique` already exists, `stage_11_counterfactuals` already exists).

```typescript
const stageStart = emitStageStart(onEvent, "platform_fit", "post");
// ... work ...
emitStageEnd(onEvent, "platform_fit", "post", stageStart, {
  cost_cents: +costCents.toFixed(4),
  ok: true | false,
  warning: optionalString,
});
```

**Wave parameter convention:** `"post"` for post-aggregator stages (matches `stage10-critique.ts:15`); use a numeric wave only for parallel waves.

---

### Graceful degradation (NEVER throw)

**Source:** `src/lib/engine/wave3.ts:83-107` (circuit-breaker early return), `src/lib/engine/retrieval/retrieval-stage.ts:61-66` (GRACEFUL_EMPTY constant).
**Apply to:** all three V3 calls + the Gemini watermark extension.

**Rule:** every catch path emits `emitStageEnd(..., { ok: false, warning })`, captures to Sentry with `tags: { stage: "<name>" }`, and returns `null` (or a `GRACEFUL_EMPTY` constant). The aggregator reads `signal_availability.platform_fit = false` and `selectWeights` redistributes.

---

### Zod boundary validation + single retry

**Source:** `src/lib/engine/wave3.ts:201-256` + Pitfall 1 / RESEARCH line 479.
**Apply to:** all three V3 calls.

```typescript
const parsed = SCHEMA.safeParse(JSON.parse(text));
if (!parsed.success) {
  lastError = new Error(`validation failed: ${parsed.error.message}`);
  if (attempt === 0) { attempt++; continue; }  // ONE retry only
  throw lastError;
}
```

**Cardinality enforcement:** counterfactuals MUST use `.length(3)` (D-15). Platform-fit MUST use `.min(1).max(3)` + post-parse filter to `targetPlatforms` (Pitfall 5).

---

### SignalAvailability + SCORE_WEIGHTS extension (Phase 8 precedent)

**Source:** `src/lib/engine/aggregator.ts:50-69, 146-252, 676-717` + `types.ts:264-271`.
**Apply to:** any new weight-bearing signal (Phase 9 = `platform_fit` only; watermark is provenance-derivative of `gemini_hook` and does NOT get a new key).

**Three edits per new signal:**
1. `SCORE_WEIGHTS["new_key"] = 0.0X` (Phase 10 calibrates).
2. Append `"new_key"` to `SCORE_WEIGHT_KEYS`.
3. Append `new_key?: boolean` to `SignalAvailability` and a parallel `hasOwnProperty` check in `selectWeights`.

`selectWeights` normalization automatically handles the renormalization at lines 211-249 — DO NOT manually rebalance other weights.

---

### Cost-aware DeepSeek pricing telemetry

**Source:** `src/lib/engine/wave3.ts:38-40, 180-197`.
**Apply to:** all three V3 calls.

```typescript
const CACHE_HIT_PRICE  = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14   / 1_000_000;
const OUTPUT_PRICE     = 0.28   / 1_000_000;
// usage.prompt_cache_hit_tokens / .prompt_cache_miss_tokens / .completion_tokens
// Fallback: legacy prompt_tokens → treat as cache miss.
```

**Pricing assumption (RESEARCH A2):** verify against `api-docs.deepseek.com/quick_start/pricing` at deploy time.

---

### Vitest mock scaffolding for OpenAI + isCircuitOpen

**Source:** `src/lib/engine/__tests__/wave3.test.ts:27-61`.
**Apply to:** all three new V3 stage tests.

- `vi.hoisted` for shared mock refs (`mockCreate`, `mockIsCircuitOpen`)
- `vi.mock("openai", ...)` returns a constructor that wires `mockCreate` into `chat.completions.create`
- `vi.mock("../deepseek", async (importOriginal) => ({ ...orig, isCircuitOpen: mockIsCircuitOpen }))` preserves all other deepseek exports
- `process.env.DEEPSEEK_API_KEY = "test-key"` set BEFORE the SUT import line
- Fixtures reuse `src/lib/engine/__tests__/factories.ts`

---

### Past-wins / past-flops prompt-injection mitigation

**Source:** `src/lib/engine/wave3/persona-prompts.ts:111-134` (hosts-only loyalist branch).
**Apply to:** critique user message ONLY (CRITIQUE-02). Counterfactuals + platform-fit do not receive Card 6 content.

**Rule:** never inject `past_wins[*].url` or `past_flops[*].url` into any prompt. Use counts only: `creatorContext.past_wins?.length ?? 0`. Phase 2 T-02-01 enforced project-wide.

---

## No Analog Found

None — every Phase 9 file has a direct in-repo analog. The closest "novel" surface is the watermark cross-platform penalty derivation, but it lives inside `platform-fit.ts` as deterministic TS logic on the Gemini-derived booleans (no separate file, no separate analog needed).

## Critical Cross-File Constraints (planner MUST enforce)

1. **SCORE_WEIGHT_KEYS must list `platform_fit`** (Phase 8 Cross-File Constraint #1 inheritance) — silent omission drops the new weight slot from `selectWeights`.
2. **`platform_fit?` in `SignalAvailability` is OPTIONAL** for back-compat with the 200+ pre-Phase-9 callsites. The aggregator+route always set it on Phase 9+ PredictionResult.
3. **Watermark detection lives INSIDE the existing hook-segment Gemini call.** No new Gemini call. Both Zod schema AND `HOOK_SEGMENT_GEMINI_SCHEMA` literal must be hand-edited (Pitfall 7).
4. **Confidence clamp is TS-side, never prompt-side** (Pitfall 3 / D-11). `Math.max(-0.20, Math.min(0, adjustment))`.
5. **LIKELY_FLOP runs LAST** — after critique has already adjusted confidence (Pitfall 7 ordering invariant). Live inside `stage11-counterfactuals.ts`.
6. **Counterfactual count is exactly 3** — Zod `.length(3)` + one retry on cardinality failure (D-15 / Pitfall 1).
7. **Platform-fit results filter to Card 0 targets post-parse** (Pitfall 5) — Zod allows `.min(1).max(3)`, then `.filter(p => targetPlatforms.includes(p.platform))`.
8. **Timestamp range refinement** — Zod refinement on counterfactual `timestamp_ms ∈ [0, payload.duration_hint * 1000]` (Pitfall 6). When `signal_availability.gemini_hook = false`, suggestions degrade to non-timestamped text.
9. **All three V3 calls use `deepseek-v4-flash`** (RESEARCH A1) via env override (`DEEPSEEK_PLATFORM_FIT_MODEL` / `DEEPSEEK_CRITIQUE_MODEL` / `DEEPSEEK_COUNTERFACTUAL_MODEL`).
10. **STABLE_SYSTEM_PROMPT byte-stability** (Pitfall 4) — every system prompt edit invalidates the DeepSeek input cache for ~1000 calls. Add a SHA-256 snapshot test per prompt.

## Metadata

**Analog search scope:**
- `src/lib/engine/wave3.ts`, `src/lib/engine/wave3/*`, `src/lib/engine/wave3/__tests__` (no such dir — tests live under `src/lib/engine/__tests__`)
- `src/lib/engine/aggregator.ts` (Phase 6 audio + Phase 8 retrieval signal extensions)
- `src/lib/engine/stage10-critique.ts`, `src/lib/engine/stage11-counterfactuals.ts` (existing no-op stubs)
- `src/lib/engine/pipeline.ts` (Wave 3 + retrieval wiring sites)
- `src/lib/engine/gemini/schemas.ts`, `src/lib/engine/gemini/prompts.ts` (Phase 5 hook segment)
- `src/lib/engine/deepseek.ts` (circuit breaker + client factory)
- `src/lib/engine/retrieval/retrieval-stage.ts` (Phase 8 new-stage scaffold)
- `src/lib/engine/types.ts` (PredictionResult / SignalAvailability / CritiqueResult / CounterfactualResult)
- `src/lib/engine/__tests__/wave3.test.ts`, `wave3-persona-prompts.test.ts` (Vitest scaffolding)

**Files scanned:** ~14 directly read, ~30 grepped for cross-references.

**Pattern extraction date:** 2026-05-20
